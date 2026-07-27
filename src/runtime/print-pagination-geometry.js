(() => {
  'use strict';

  const GEOMETRY_VERSION = 1;
  const INSTALL_TIMEOUT_MS = 4000;
  const PAGE_EPSILON_PX = 2;
  const touched = new Map();
  let installTimer = 0;
  let installStartedAt = 0;

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

  function applyBreak(node) {
    remember(node);
    node.style.setProperty('break-before', 'page', 'important');
    node.style.setProperty('page-break-before', 'always', 'important');
    node.setAttribute('data-gb-print-geometry-break', '1');
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

  function topLevelAtomic(scope) {
    return [...scope.querySelectorAll('[data-print-flow="atomic"]')].filter((node) => {
      const parent = node.parentElement?.closest('[data-print-flow="atomic"]');
      return !parent && visible(node);
    });
  }

  function flowEvents(scope, atomicNodes) {
    const atomicSet = new Set(atomicNodes);
    const events = atomicNodes.map((node) => ({
      type: 'atomic',
      node,
      top: absoluteTop(node),
      bottom: absoluteTop(node) + node.getBoundingClientRect().height,
    }));

    for (const node of scope.querySelectorAll('*')) {
      if (!visible(node)) continue;
      const style = getComputedStyle(node);
      if (forcedBreakBefore(style) && !atomicSet.has(node)) {
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

  function stabilize(report) {
    clearGeometry();
    const root = readerRoot();
    const pageHeight = finite(report?.pageContentHeight);
    if (!root || pageHeight < 200) {
      return { version: GEOMETRY_VERSION, status: 'skipped', reason: !root ? 'reader-root-missing' : 'page-height-missing', applied: 0, considered: 0 };
    }

    const scope = root.parentElement || document.body;
    const atomicNodes = topLevelAtomic(scope);
    const events = flowEvents(scope, atomicNodes);
    const origin = finite(document.body?.getBoundingClientRect().top) + window.scrollY;
    let shift = 0;
    let applied = 0;

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

      if (forcedBreakBefore(style)) {
        shift += alignToNextPage(event.top + shift, origin, pageHeight);
        continue;
      }

      const logicalTop = event.top + shift;
      const pageOffset = modulo(logicalTop - origin, pageHeight);
      if (pageOffset + height <= pageHeight + PAGE_EPSILON_PX) continue;

      const inserted = alignToNextPage(logicalTop, origin, pageHeight);
      if (inserted <= PAGE_EPSILON_PX) continue;
      applyBreak(event.node);
      shift += inserted;
      applied += 1;
    }

    document.documentElement.setAttribute('data-gb-print-geometry-ready', '1');
    return {
      version: GEOMETRY_VERSION,
      status: 'prepared',
      pageContentHeight: pageHeight,
      considered: atomicNodes.length,
      applied,
    };
  }

  function install() {
    const api = window.GBPrintPagination;
    if (!api || api.version !== 1 || typeof api.prepare !== 'function') return false;
    if (api.geometryVersion === GEOMETRY_VERSION) return true;

    const originalPrepare = api.prepare.bind(api);
    const originalReset = typeof api.reset === 'function' ? api.reset.bind(api) : null;

    const wrappedPrepare = (...args) => {
      clearGeometry();
      const report = originalPrepare(...args);
      const geometry = stabilize(report);
      if (report && typeof report === 'object') report.geometry = geometry;
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
