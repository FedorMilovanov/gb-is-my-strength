(() => {
  'use strict';

  /**
   * Physical fragmentation fallback for Chromium paged media.
   *
   * GBPrintPagination v1 remains the semantic owner: it marks atomic blocks,
   * keep-with-next pairs and closing groups. This stage never guesses page
   * coordinates and never inserts forced page breaks. In print media only, it
   * turns short, full-width, ordinary block atomics into monolithic
   * inline-block boxes so the browser moves the whole box to the next sheet
   * when `break-inside: avoid` alone is ignored.
   */
  const GEOMETRY_VERSION = 3;
  const INSTALL_TIMEOUT_MS = 4000;
  const MAX_ATOMIC_PX = 240;
  const MAX_PAGE_FRACTION = 0.28;
  const MIN_ROOT_WIDTH_FRACTION = 0.72;
  const touched = new Map();
  let installTimer = 0;
  let installStartedAt = 0;
  let lifecycleBound = false;
  let originalPrepare = null;
  let preparedForPrint = false;
  let lastReport = null;

  const PROPERTIES = ['display', 'width', 'max-width', 'vertical-align', 'box-sizing'];

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function inPrintMedia() {
    return Boolean(window.matchMedia?.('print').matches);
  }

  function visible(node) {
    if (!node?.getBoundingClientRect) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && !['fixed', 'sticky', 'absolute'].includes(style.position)
      && rect.width > 8
      && rect.height > 4;
  }

  function readerRoot() {
    return document.querySelector(
      '[data-reader-range], '
      + '[data-reader-root] article.article-body, '
      + '[data-gill-v16] article.article-body, '
      + 'article.article-body, '
      + 'article[data-pagefind-body], '
      + 'main article, article'
    );
  }

  function previousVisibleSibling(node) {
    let previous = node?.previousElementSibling || null;
    while (previous && !visible(previous)) previous = previous.previousElementSibling;
    return previous;
  }

  function topLevelAtomic(scope) {
    return [...scope.querySelectorAll('[data-print-flow="atomic"]')].filter((node) => {
      const parent = node.parentElement?.closest('[data-print-flow="atomic"]');
      return !parent && visible(node);
    });
  }

  function hasKeepBoundary(node) {
    return node.hasAttribute('data-print-keep-next')
      || previousVisibleSibling(node)?.hasAttribute('data-print-keep-next');
  }

  function snapshot(node) {
    const properties = {};
    for (const property of PROPERTIES) {
      properties[property] = {
        value: node.style.getPropertyValue(property),
        priority: node.style.getPropertyPriority(property),
      };
    }
    return {
      properties,
      marker: node.getAttribute('data-gb-print-monolith'),
    };
  }

  function remember(node) {
    if (!touched.has(node)) touched.set(node, snapshot(node));
  }

  function restoreProperty(node, property, previous) {
    if (previous.value) node.style.setProperty(property, previous.value, previous.priority);
    else node.style.removeProperty(property);
  }

  function clearGeometry() {
    for (const [node, previous] of touched) {
      if (!node?.style) continue;
      for (const property of PROPERTIES) restoreProperty(node, property, previous.properties[property]);
      if (previous.marker === null) node.removeAttribute('data-gb-print-monolith');
      else node.setAttribute('data-gb-print-monolith', previous.marker);
    }
    touched.clear();
    preparedForPrint = false;
    document.documentElement.removeAttribute('data-gb-print-geometry-ready');
  }

  function makeMonolithic(node) {
    remember(node);
    node.style.setProperty('display', 'inline-block', 'important');
    node.style.setProperty('width', '100%', 'important');
    node.style.setProperty('max-width', '100%', 'important');
    node.style.setProperty('vertical-align', 'top', 'important');
    node.style.setProperty('box-sizing', 'border-box', 'important');
    node.setAttribute('data-gb-print-monolith', '1');
  }

  function decisionFor(node, rootRect, pageHeight) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const heightLimit = Math.min(MAX_ATOMIC_PX, pageHeight * MAX_PAGE_FRACTION);
    const tag = node.tagName.toLowerCase();
    const reasons = [];

    if (style.display !== 'block') reasons.push(`display:${style.display}`);
    if (style.float !== 'none') reasons.push(`float:${style.float}`);
    if (!String(style.breakInside || style.pageBreakInside || '').includes('avoid')) reasons.push('not-atomic-style');
    if (rect.height > heightLimit) reasons.push('too-tall');
    if (rect.width < rootRect.width * MIN_ROOT_WIDTH_FRACTION) reasons.push('not-full-width');
    if (hasKeepBoundary(node)) reasons.push('keep-pair');
    if (node.closest('.gb-print-closing-group')) reasons.push('closing-group');
    if (node.matches('table,figure,details,pre,fieldset')) reasons.push('complex-element');
    if (node.querySelector(':scope > table, :scope > figure, :scope > details')) reasons.push('complex-child');

    return {
      node,
      tag,
      className: typeof node.className === 'string' ? node.className.slice(0, 96) : '',
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      display: style.display,
      eligible: reasons.length === 0,
      reasons,
    };
  }

  function attachGeometry(report, geometry) {
    if (!report || typeof report !== 'object') return;
    try { report.geometry = geometry; } catch (_) {}
  }

  function deferredReport(report) {
    return {
      version: GEOMETRY_VERSION,
      status: 'deferred',
      reason: 'screen-media',
      pageContentHeight: finite(report?.pageContentHeight),
      considered: 0,
      stabilized: 0,
      decisions: [],
    };
  }

  function stabilize(report) {
    clearGeometry();
    const root = readerRoot();
    const pageHeight = finite(report?.pageContentHeight);
    if (!root || pageHeight < 200) {
      return {
        version: GEOMETRY_VERSION,
        status: 'skipped',
        reason: !root ? 'reader-root-missing' : 'page-height-missing',
        pageContentHeight: pageHeight,
        considered: 0,
        stabilized: 0,
        decisions: [],
      };
    }

    const scope = root.parentElement || document.body;
    const rootRect = root.getBoundingClientRect();
    const decisions = topLevelAtomic(scope).map((node) => decisionFor(node, rootRect, pageHeight));
    for (const decision of decisions) {
      if (decision.eligible) makeMonolithic(decision.node);
    }

    preparedForPrint = true;
    document.documentElement.setAttribute('data-gb-print-geometry-ready', '1');
    return {
      version: GEOMETRY_VERSION,
      status: 'prepared',
      media: 'print',
      strategy: 'short-atomic-inline-block',
      pageContentHeight: pageHeight,
      considered: decisions.length,
      stabilized: decisions.filter((decision) => decision.eligible).length,
      decisions: decisions.map(({ node: _node, ...decision }) => decision),
    };
  }

  function prepareForPrint() {
    if (!originalPrepare) return null;
    if (preparedForPrint && lastReport) return lastReport;
    const report = originalPrepare();
    attachGeometry(report, stabilize(report));
    lastReport = report;
    return report;
  }

  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    window.addEventListener('beforeprint', () => { prepareForPrint(); });
    window.addEventListener('afterprint', () => {
      clearGeometry();
      lastReport = null;
    });
  }

  function install() {
    const api = window.GBPrintPagination;
    if (!api || api.version !== 1 || typeof api.prepare !== 'function') return false;
    if (api.geometryVersion === GEOMETRY_VERSION) return true;

    originalPrepare = api.prepare.bind(api);
    const originalReset = typeof api.reset === 'function' ? api.reset.bind(api) : null;

    const wrappedPrepare = (...args) => {
      clearGeometry();
      lastReport = originalPrepare(...args);
      const geometry = inPrintMedia() ? stabilize(lastReport) : deferredReport(lastReport);
      attachGeometry(lastReport, geometry);
      return lastReport;
    };

    const wrappedReset = (...args) => {
      clearGeometry();
      lastReport = null;
      return originalReset ? originalReset(...args) : undefined;
    };

    try {
      api.prepare = wrappedPrepare;
      api.reset = wrappedReset;
      api.geometryVersion = GEOMETRY_VERSION;
    } catch (_) {
      window.GBPrintPagination = Object.assign({}, api, {
        prepare: wrappedPrepare,
        reset: wrappedReset,
        geometryVersion: GEOMETRY_VERSION,
      });
    }

    bindLifecycle();
    document.documentElement.setAttribute('data-gb-print-geometry-owner', String(GEOMETRY_VERSION));
    return true;
  }

  function scheduleInstall() {
    if (install()) {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
      return;
    }
    if (!installStartedAt) installStartedAt = Date.now();
    if (!installTimer) {
      installTimer = window.setInterval(() => {
        if (install()) {
          window.clearInterval(installTimer);
          installTimer = 0;
        } else if (Date.now() - installStartedAt > INSTALL_TIMEOUT_MS) {
          window.clearInterval(installTimer);
          installTimer = 0;
          console.error('[GBPrintPaginationGeometry] GBPrintPagination v1 was not available');
        }
      }, 20);
    }
  }

  scheduleInstall();
  document.addEventListener('DOMContentLoaded', scheduleInstall, { once: true });
  window.addEventListener('load', scheduleInstall, { once: true });
})();
