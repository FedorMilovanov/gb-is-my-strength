(() => {
  'use strict';

  const GEOMETRY_VERSION = 2;
  const INSTALL_TIMEOUT_MS = 4000;
  const PAGE_EPSILON_PX = 2;
  const touched = new Map();
  let installTimer = 0;
  let installStartedAt = 0;
  let lifecycleBound = false;
  let originalPrepare = null;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function absoluteTop(node) {
    const rect = node.getBoundingClientRect();
    return rect.top + window.scrollY;
  }

  function visible(node) {
    if (!node?.getBoundingClientRect) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.position !== 'fixed'
      && rect.width > 8
      && rect.height > 4;
  }

  function inPrintMedia() {
    return Boolean(window.matchMedia?.('print').matches);
  }

  function forcedBreakBefore(style) {
    return /^(?:page|always|left|right|recto|verso)$/.test(style.breakBefore || '')
      || /^(?:always|left|right)$/.test(style.pageBreakBefore || '');
  }

  function forcedBreakAfter(style) {
    return /^(?:page|always|left|right|recto|verso)$/.test(style.breakAfter || '')
      || /^(?:always|left|right)$/.test(style.pageBreakAfter || '');
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function alignToNextPage(position, origin, pageHeight) {
    const offset = modulo(position - origin, pageHeight);
    if (offset <= PAGE_EPSILON_PX || pageHeight - offset <= PAGE_EPSILON_PX) return 0;
    return pageHeight - offset;
  }

  function remember(node) {
    if (touched.has(node)) return;
    touched.set(node, {
      breakBefore: node.style.breakBefore,
      pageBreakBefore: node.style.pageBreakBefore,
      marker: node.getAttribute('data-gb-print-geometry-break'),
    });
  }

  function applyBreak(node, atomicNode) {
    remember(node);
    node.style.setProperty('break-before', 'page', 'important');
    node.style.setProperty('page-break-before', 'always', 'important');
    node.setAttribute('data-gb-print-geometry-break', '1');
    if (atomicNode !== node) atomicNode.setAttribute('data-gb-print-geometry-grouped', '1');
  }

  function clearGeometry() {
    for (const [node, previous] of touched) {
      if (!node?.style) continue;
      if (previous.breakBefore) node.style.breakBefore = previous.breakBefore;
      else node.style.removeProperty('break-before');
      if (previous.pageBreakBefore) node.style.pageBreakBefore = previous.pageBreakBefore;
      else node.style.removeProperty('page-break-before');
      if (previous.marker === null) node.removeAttribute('data-gb-print-geometry-break');
      else node.setAttribute('data-gb-print-geometry-break', previous.marker);
    }
    touched.clear();
    document.querySelectorAll('[data-gb-print-geometry-grouped]').forEach((node) => {
      node.removeAttribute('data-gb-print-geometry-grouped');
    });
    document.documentElement.removeAttribute('data-gb-print-geometry-ready');
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

  function nextVisibleSibling(node) {
    let next = node?.nextElementSibling || null;
    while (next && !visible(next)) next = next.nextElementSibling;
    return next;
  }

  function previousVisibleSibling(node) {
    let previous = node?.previousElementSibling || null;
    while (previous && !visible(previous)) previous = previous.previousElementSibling;
    return previous;
  }

  function keepGroupStart(node) {
    let start = node;
    while (true) {
      const previous = previousVisibleSibling(start);
      if (!previous?.hasAttribute('data-print-keep-next')) break;
      if (nextVisibleSibling(previous) !== start) break;
      start = previous;
    }
    return start;
  }

  function topLevelAtomic(scope) {
    return [...scope.querySelectorAll('[data-print-flow="atomic"]')].filter((node) => {
      const parent = node.parentElement?.closest('[data-print-flow="atomic"]');
      return !parent
        && !node.closest('.gb-print-closing-group')
        && visible(node);
    });
  }

  function flowEvents(scope, atomicNodes) {
    const atomicSet = new Set(atomicNodes);
    const atomicEvents = [];
    const starts = new Set();

    for (const node of atomicNodes) {
      const startNode = keepGroupStart(node);
      if (starts.has(startNode)) continue;
      starts.add(startNode);
      atomicEvents.push({
        type: 'atomic',
        node,
        startNode,
        top: absoluteTop(startNode),
        bottom: absoluteTop(node) + node.getBoundingClientRect().height,
      });
    }

    const events = [...atomicEvents];
    for (const node of scope.querySelectorAll('*')) {
      if (!visible(node)) continue;
      const style = getComputedStyle(node);
      if (forcedBreakBefore(style) && !atomicSet.has(node) && !starts.has(node)) {
        events.push({ type: 'break-before', node, top: absoluteTop(node), bottom: absoluteTop(node) });
      }
      if (forcedBreakAfter(style)) {
        const rect = node.getBoundingClientRect();
        const bottom = rect.bottom + window.scrollY;
        events.push({ type: 'break-after', node, top: bottom, bottom });
      }
    }

    return events.sort((left, right) => {
      if (Math.abs(left.top - right.top) > 0.25) return left.top - right.top;
      if (left.type === right.type) return 0;
      if (left.type === 'break-before') return -1;
      if (right.type === 'break-before') return 1;
      return left.type === 'atomic' ? -1 : 1;
    });
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
      applied: 0,
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
        applied: 0,
      };
    }

    const scope = root.parentElement || document.body;
    const atomicNodes = topLevelAtomic(scope);
    const events = flowEvents(scope, atomicNodes);
    const origin = absoluteTop(document.body);
    let shift = 0;
    let applied = 0;
    const decisions = [];

    for (const event of events) {
      const style = getComputedStyle(event.node);
      if (event.type === 'break-before') {
        shift += alignToNextPage(event.top + shift, origin, pageHeight);
        continue;
      }
      if (event.type === 'break-after') {
        shift += alignToNextPage(event.bottom + shift, origin, pageHeight);
        continue;
      }

      const height = Math.max(0, event.bottom - event.top);
      if (height <= PAGE_EPSILON_PX || height >= pageHeight - PAGE_EPSILON_PX) continue;

      const startStyle = getComputedStyle(event.startNode);
      if (forcedBreakBefore(startStyle)) {
        shift += alignToNextPage(event.top + shift, origin, pageHeight);
        continue;
      }

      const logicalTop = event.top + shift;
      const pageOffset = modulo(logicalTop - origin, pageHeight);
      const crosses = pageOffset + height > pageHeight + PAGE_EPSILON_PX;
      decisions.push({
        tag: event.node.tagName.toLowerCase(),
        className: typeof event.node.className === 'string' ? event.node.className.slice(0, 96) : '',
        height: Math.round(height),
        pageOffset: Math.round(pageOffset),
        crosses,
      });
      if (!crosses) continue;

      const inserted = alignToNextPage(logicalTop, origin, pageHeight);
      if (inserted <= PAGE_EPSILON_PX) continue;
      applyBreak(event.startNode, event.node);
      shift += inserted;
      applied += 1;
    }

    document.documentElement.setAttribute('data-gb-print-geometry-ready', '1');
    return {
      version: GEOMETRY_VERSION,
      status: 'prepared',
      media: 'print',
      pageContentHeight: pageHeight,
      considered: atomicNodes.length,
      applied,
      decisions,
    };
  }

  function prepareGeometry(force = false) {
    if (!originalPrepare) return null;
    const report = originalPrepare();
    const geometry = force || inPrintMedia() ? stabilize(report) : deferredReport(report);
    attachGeometry(report, geometry);
    return report;
  }

  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    window.addEventListener('beforeprint', () => { prepareGeometry(true); });
    window.addEventListener('afterprint', clearGeometry);
  }

  function install() {
    const api = window.GBPrintPagination;
    if (!api || api.version !== 1 || typeof api.prepare !== 'function') return false;
    if (api.geometryVersion === GEOMETRY_VERSION) return true;

    originalPrepare = api.prepare.bind(api);
    const originalReset = typeof api.reset === 'function' ? api.reset.bind(api) : null;

    const wrappedPrepare = (...args) => {
      clearGeometry();
      const report = originalPrepare(...args);
      const geometry = inPrintMedia() ? stabilize(report) : deferredReport(report);
      attachGeometry(report, geometry);
      return report;
    };

    const wrappedReset = (...args) => {
      clearGeometry();
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
