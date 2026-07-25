/**
 * GB Print Pagination v1
 *
 * Shared semantic pagination for every reader surface. The runtime classifies
 * components by role and measured paper height; it never keys behaviour to a
 * route, article title or author. Small modules remain atomic, oversized
 * modules retain safe internal break points, headings/labels stay with the
 * following block, and compact closing marks are grouped with the preceding
 * semantic module in a reversible print-only wrapper.
 */
(function () {
  'use strict';

  if (window.GBPrintPagination && window.GBPrintPagination.version === 1) return;

  var VERSION = 1;
  var GENERATED = 'data-gb-print-generated';
  var ROOT_SELECTORS = [
    '[data-reader-range]',
    '[data-reader-root] article.article-body',
    '[data-gill-v16] article.article-body',
    'article.article-body[data-pagefind-body]',
    'article.article-body',
    'article[data-pagefind-body]',
    '#main-content article',
    'main article',
    'article'
  ];
  var CANDIDATE_SELECTOR = [
    '[data-print-keep]',
    'table',
    'figure',
    'blockquote',
    'pre',
    'details',
    '.table-scroll',
    '.timeline-entry',
    '.timeline-card',
    '.biography-timeline',
    '.chronology-item',
    '.milestone',
    '.event-item',
    '.history-item',
    '.manuscript-quote',
    '.ancient-epigraph',
    '.note-box',
    '.info-box',
    '.warn-box',
    '.quote-box',
    '.summary-card',
    '.callout',
    '.fact-card',
    '.source-card',
    '.author-card',
    '.original-author-card',
    '.gbs2-timeline',
    '.series-map',
    '.series-roadmap',
    '.series-overview',
    '.overview-grid',
    '.diagram',
    '.diagram-card',
    '.article-end-block',
    '.article-end-sdg-wrap',
    '.article-end-sdg',
    '.closing-mark',
    '.devotional-tail',
    '.epilogue'
  ].join(',');
  var ROLE_CLASS_RE = /(?:^|[\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\s_-])/i;
  var CHROME_SELECTOR = '.gbs-rail,.gbs-theme-corner,.mobile-top-bar,.mobile-bottom-bar,.toc-overlay,.gb-floater,.hrail,.gbs2-next,.gbs2-vignette,[aria-hidden="true"]';
  var TAIL_SELECTOR = '[data-print-tail],.article-end-block,.article-end-sdg-wrap,.article-end-sdg,.closing-mark,.devotional-tail,.epilogue';
  var STYLE_ID = 'gb-print-pagination-contract';
  var closingGroups = [];
  var report = null;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '@media print {',
      '  @page { size: A4; margin: 14mm; }',
      '  html body { orphans: 3; widows: 3; }',
      '  html body [data-print-flow="atomic"],',
      '  html body .gb-print-closing-group { break-inside: avoid-page !important; page-break-inside: avoid !important; }',
      '  html body [data-print-flow="splittable"] { break-inside: auto !important; page-break-inside: auto !important; }',
      '  html body [data-print-keep-next] { break-after: avoid-page !important; page-break-after: avoid !important; }',
      '  html body [data-print-row] { break-inside: avoid-page !important; page-break-inside: avoid !important; }',
      '  html body table thead { display: table-header-group !important; }',
      '  html body table tfoot { display: table-footer-group !important; }',
      '  html body [data-print-flow="atomic"].table-scroll { overflow: visible !important; max-height: none !important; }',
      '  html body .gb-print-closing-group { display: block !important; width: auto !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; }',
      '  html body [data-print-tail] { display: block !important; min-height: 0 !important; height: auto !important; margin: 5mm 0 0 !important; padding: 3mm 0 0 !important; break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html body [data-print-tail] > .article-end-sdg,',
      '  html body [data-print-tail].article-end-sdg { min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  /* GB_PRINT_TERMINAL_SEAL_V2_CSS */',
      '  html[data-print-terminal-root], html[data-print-terminal-root] body { min-height: 0 !important; height: auto !important; padding-bottom: 0 !important; margin-bottom: 0 !important; overflow: visible !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html body [data-print-terminal-flow] { min-height: 0 !important; height: auto !important; padding-bottom: 0 !important; margin-bottom: 0 !important; overflow: visible !important; break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html[data-print-terminal-root]::before, html[data-print-terminal-root]::after, html[data-print-terminal-root] body::before, html[data-print-terminal-root] body::after, html body [data-print-terminal-flow]::before, html body [data-print-terminal-flow]::after { break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html body [data-print-terminal-follower] { display: none !important; }',
      '  html body [data-print-flow] { box-shadow: none; }',
      '  html body article:last-child,',
      '  html body .article-body:last-child,',
      '  html body [data-reader-range]:last-child,',
      '  html body [data-print-tail]:last-child,',
      '  html body .gb-print-closing-group:last-child { break-after: auto !important; page-break-after: auto !important; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function resolveRoot() {
    for (var i = 0; i < ROOT_SELECTORS.length; i++) {
      try {
        var node = document.querySelector(ROOT_SELECTORS[i]);
        if (node) return node;
      } catch (_) {}
    }
    return null;
  }

  function isVisible(node) {
    if (!node || !node.getBoundingClientRect) return false;
    if (node.closest && node.closest(CHROME_SELECTOR)) return false;
    var style;
    try { style = window.getComputedStyle(node); } catch (_) { return false; }
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
    var rect = node.getBoundingClientRect();
    return rect.width > 8 && rect.height > 4;
  }

  function measureMm(mm) {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-10000px;top:0;width:1px;height:' + mm + 'mm;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    var value = probe.getBoundingClientRect().height;
    probe.remove();
    return value || (mm * 96 / 25.4);
  }

  function depth(node) {
    var value = 0;
    while (node && node.parentElement) { value += 1; node = node.parentElement; }
    return value;
  }

  function mark(node, name, value) {
    if (!node || !node.setAttribute) return;
    node.setAttribute(name, value || '1');
    node.setAttribute(GENERATED, '1');
  }

  function restoreClosingGroups() {
    for (var i = closingGroups.length - 1; i >= 0; i--) {
      var record = closingGroups[i];
      try {
        if (record.previousAnchor.parentNode) {
          record.previousAnchor.parentNode.insertBefore(record.previous, record.previousAnchor.nextSibling);
          record.previousAnchor.remove();
        }
        if (record.tailAnchor.parentNode) {
          record.tailAnchor.parentNode.insertBefore(record.tail, record.tailAnchor.nextSibling);
          record.tailAnchor.remove();
        }
        if (record.group.parentNode) record.group.remove();
      } catch (_) {}
    }
    closingGroups = [];
  }

  function clearGenerated() {
    restoreClosingGroups();
    var nodes = document.querySelectorAll('[' + GENERATED + ']');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].removeAttribute('data-print-flow');
      nodes[i].removeAttribute('data-print-keep-next');
      nodes[i].removeAttribute('data-print-row');
      nodes[i].removeAttribute('data-print-tail');
      nodes[i].removeAttribute('data-print-closing-group');
      nodes[i].removeAttribute('data-print-terminal-flow');
      nodes[i].removeAttribute('data-print-terminal-follower');
      nodes[i].removeAttribute('data-print-terminal-root');
      nodes[i].removeAttribute(GENERATED);
    }
  }

  function closestAtomic(node) {
    return node && node.parentElement && node.parentElement.closest
      ? node.parentElement.closest('[data-print-flow="atomic"]')
      : null;
  }

  function collectCandidates(root) {
    var scope = root && root.parentElement ? root.parentElement : document;
    var nodes = [];
    try { nodes = Array.prototype.slice.call(scope.querySelectorAll(CANDIDATE_SELECTOR)); } catch (_) {}
    var classNodes = [];
    try { classNodes = Array.prototype.slice.call(scope.querySelectorAll('[class]')); } catch (_) {}
    for (var i = 0; i < classNodes.length; i++) {
      var className = typeof classNodes[i].className === 'string' ? classNodes[i].className : '';
      if (ROLE_CLASS_RE.test(className) && nodes.indexOf(classNodes[i]) < 0) nodes.push(classNodes[i]);
    }
    return nodes.filter(isVisible).sort(function (a, b) { return depth(a) - depth(b); });
  }

  function markTable(node, pageHeight, stats) {
    var wrapper = node.matches && node.matches('.table-scroll') ? node : (node.closest ? node.closest('.table-scroll') : null);
    var target = wrapper && isVisible(wrapper) ? wrapper : node;
    var rect = target.getBoundingClientRect();
    if (rect.height <= pageHeight * 0.84) {
      mark(target, 'data-print-flow', 'atomic');
      stats.atomic += 1;
    } else {
      mark(target, 'data-print-flow', 'splittable');
      var rows = target.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) mark(rows[i], 'data-print-row', '1');
      stats.splittable += 1;
      stats.rows += rows.length;
    }
  }

  function collectOutermostTails(scope) {
    var tails = [];
    try { tails = Array.prototype.slice.call(scope.querySelectorAll(TAIL_SELECTOR)); } catch (_) {}
    return tails.filter(function (tail) {
      if (!isVisible(tail)) return false;
      var ancestor = tail.parentElement && tail.parentElement.closest ? tail.parentElement.closest(TAIL_SELECTOR) : null;
      return !ancestor;
    });
  }

  function precedes(node, reference) {
    if (!node || !reference || node === reference || node.contains(reference) || reference.contains(node)) return false;
    try { return !!(node.compareDocumentPosition(reference) & Node.DOCUMENT_POSITION_FOLLOWING); } catch (_) { return false; }
  }

  function previousSemanticFlow(tail, scope) {
    var nodes = [];
    try { nodes = Array.prototype.slice.call(scope.querySelectorAll('[data-print-flow],[data-print-keep-next]')); } catch (_) {}
    var previous = null;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!isVisible(node) || !precedes(node, tail)) continue;
      previous = node;
    }
    return previous;
  }

  function createClosingGroup(previous, tail) {
    if (!previous || !tail || !previous.parentNode || !tail.parentNode) return null;
    var previousAnchor = document.createComment('gb-print-previous');
    var tailAnchor = document.createComment('gb-print-tail');
    previous.parentNode.insertBefore(previousAnchor, previous);
    tail.parentNode.insertBefore(tailAnchor, tail);

    var group = document.createElement('div');
    group.className = 'gb-print-closing-group';
    group.setAttribute('data-print-closing-group', '1');
    group.setAttribute('data-print-flow', 'atomic');
    group.setAttribute(GENERATED, '1');
    previousAnchor.parentNode.insertBefore(group, previousAnchor.nextSibling);
    group.appendChild(previous);
    group.appendChild(tail);

    closingGroups.push({
      group: group,
      previous: previous,
      tail: tail,
      previousAnchor: previousAnchor,
      tailAnchor: tailAnchor
    });
    return group;
  }

  function hasMeaningfulFollowingContent(anchor, scope) {
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('p,li,dt,dd,h1,h2,h3,h4,h5,h6,table,figure,blockquote,pre,section,article,[data-pagefind-body]')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!precedes(anchor, node) || !isVisible(node)) continue;
      var text = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 0) return true;
      if (node.matches && node.matches('img,svg,canvas,video,table,figure')) return true;
    }
    return false;
  }

  function isMeaningfulPrintBlock(node) {
    if (!isVisible(node)) return false;
    var text = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 0) return true;
    return !!(node.matches && node.matches('img,svg,canvas,video,table,figure'));
  }

  function findTerminalAnchor(root, scope) {
    var selector = 'p,li,dt,dd,h1,h2,h3,h4,h5,h6,table,figure,blockquote,pre,.timeline-entry,.timeline-card,.chronology-item,.milestone,.event-item,.history-item,.note-box,.info-box,.warn-box,.quote-box,.summary-card,.callout,.fact-card,.source-card,.author-card,.series-map,.series-roadmap,.series-overview,.overview-grid,.diagram,.diagram-card,[data-print-tail]';
    var nodes = [];
    try { nodes = Array.prototype.slice.call((root || scope || document).querySelectorAll(selector)); } catch (_) {}
    var last = null;
    for (var i = 0; i < nodes.length; i++) {
      if (isMeaningfulPrintBlock(nodes[i])) last = nodes[i];
    }
    return last || root || null;
  }

  function markTerminalRegion(anchor, scope) {
    var result = { flow: 0, followers: 0 };
    if (!anchor) return result;
    mark(document.documentElement, 'data-print-terminal-root', '1');
    mark(document.body, 'data-print-terminal-root', '1');
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('*')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      if (!precedes(anchor, nodes[i])) continue;
      mark(nodes[i], 'data-print-terminal-flow', '1');
      mark(nodes[i], 'data-print-terminal-follower', '1');
      result.flow += 1;
      result.followers += 1;
    }
    var terminal = anchor.parentElement;
    while (terminal && terminal !== document.body && terminal !== document.documentElement) {
      mark(terminal, 'data-print-terminal-flow', '1');
      result.flow += 1;
      terminal = terminal.parentElement;
    }
    return result;
  }

  function classifyCandidates(root, pageHeight) {
    var candidates = collectCandidates(root);
    var stats = { candidates: candidates.length, atomic: 0, splittable: 0, rows: 0, keepNext: 0, tailPairs: 0, closingGroups: 0, terminalFlow: 0, terminalFollowers: 0, terminalAnchors: 0, nonTerminalTails: 0, tails: 0 };
    var atomicLimit = pageHeight * 0.84;

    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (closestAtomic(node)) continue;
      var table = node.matches && node.matches('table,.table-scroll');
      if (table) {
        markTable(node, pageHeight, stats);
        continue;
      }
      var rect = node.getBoundingClientRect();
      if (rect.height <= atomicLimit || node.hasAttribute('data-print-keep')) {
        mark(node, 'data-print-flow', 'atomic');
        stats.atomic += 1;
      } else {
        mark(node, 'data-print-flow', 'splittable');
        stats.splittable += 1;
        var entries = node.querySelectorAll('.timeline-entry,.timeline-card,.chronology-item,.milestone,.event-item,.history-item');
        for (var e = 0; e < entries.length; e++) {
          if (isVisible(entries[e]) && entries[e].getBoundingClientRect().height <= atomicLimit) {
            mark(entries[e], 'data-print-flow', 'atomic');
            stats.atomic += 1;
          }
        }
      }
    }

    var keepers = root.querySelectorAll('h1,h2,h3,h4,h5,h6,.section-label,.eyebrow,.overline,.foliant-mark,[class*="__kicker"],[class*="-kicker"],[class*="__label"]');
    for (var k = 0; k < keepers.length; k++) {
      var keeper = keepers[k];
      if (!isVisible(keeper) || closestAtomic(keeper)) continue;
      var next = keeper.nextElementSibling;
      while (next && !isVisible(next)) next = next.nextElementSibling;
      if (!next) continue;
      mark(keeper, 'data-print-keep-next', '1');
      stats.keepNext += 1;
    }

    var scope = root && root.parentElement ? root.parentElement : document;
    var tails = collectOutermostTails(scope);
    stats.tails = tails.length;
    for (var t = 0; t < tails.length; t++) {
      var tail = tails[t];
      if (hasMeaningfulFollowingContent(tail, scope)) {
        stats.nonTerminalTails += 1;
        continue;
      }
      mark(tail, 'data-print-flow', 'atomic');
      mark(tail, 'data-print-tail', '1');
      var previous = previousSemanticFlow(tail, scope);
      if (!previous) continue;
      var combined = previous.getBoundingClientRect().height + tail.getBoundingClientRect().height + measureMm(8);
      if (isPrintMedia() && combined <= pageHeight * 0.94) {
        var group = createClosingGroup(previous, tail);
        if (group) {
          stats.tailPairs += 1;
          stats.closingGroups += 1;
          stats.atomic += 1;
        }
      }
    }
    var terminalAnchor = closingGroups.length ? closingGroups[closingGroups.length - 1].group : findTerminalAnchor(root, scope);
    if (terminalAnchor) {
      var terminalRegion = markTerminalRegion(terminalAnchor, scope);
      stats.terminalFlow += terminalRegion.flow;
      stats.terminalFollowers += terminalRegion.followers;
      stats.terminalAnchors += 1;
    }
    return stats;
  }

  function prepare() {
    installStyle();
    clearGenerated();
    var root = resolveRoot();
    if (!root) {
      report = { version: VERSION, prepared: false, reason: 'reader root not found' };
      return report;
    }
    var pageHeight = measureMm(269);
    var stats = classifyCandidates(root, pageHeight);
    report = {
      version: VERSION,
      prepared: true,
      route: location.pathname,
      pageContentHeight: Math.round(pageHeight),
      stats: stats
    };
    document.documentElement.setAttribute('data-gb-print-pagination', 'ready');
    return report;
  }

  function reset() {
    clearGenerated();
    document.documentElement.removeAttribute('data-gb-print-pagination');
  }

  function isPrintMedia() {
    try { return window.matchMedia && window.matchMedia('print').matches; } catch (_) { return false; }
  }

  window.GBPrintPagination = {
    version: VERSION,
    prepare: prepare,
    reset: reset,
    getReport: function () { return report ? JSON.parse(JSON.stringify(report)) : null; }
  };

  window.addEventListener('beforeprint', prepare);
  window.addEventListener('afterprint', reset);
  try {
    var media = window.matchMedia('print');
    var onChange = function (event) { if (event.matches) prepare(); else reset(); };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (isPrintMedia()) prepare(); }, { once: true });
  } else if (isPrintMedia()) prepare();
})();
