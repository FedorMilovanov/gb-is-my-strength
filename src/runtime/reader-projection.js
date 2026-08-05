(() => {
  'use strict';

  const VERSION = 1;
  if (window.GBReaderProjection?.version === VERSION) return;

  const ROOT_SELECTOR = [
    '[data-reader-range]',
    '[data-reader-root] article.article-body',
    '[data-gill-v16] article.article-body',
    'article.article-body',
    'article[data-pagefind-body]',
    'main[data-pagefind-body]',
    'main article',
    'article',
  ].join(',');
  const BLOCK_SELECTOR = 'h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd';
  const EXCLUDE_SELECTOR = [
    'nav', 'aside', 'footer', '[hidden]', '[aria-hidden="true"]',
    '[data-pagefind-ignore]', '[data-reader-exclude]', '[data-no-speech]',
    '.breadcrumb', '.article-byline', '.footnote', '.footnotes', '.sources-block',
    '.reading-list-section', '.series-navigation', '.gb-tts-download-notice', '.gb-fc-toast',
  ].join(',');
  const INLINE_STRIP_SELECTOR = [
    'script', 'style', 'noscript', 'button', 'svg', 'audio', 'video',
    '[lang="en"]', '[lang^="en-"]', '.gtip', '.fn-marker', '.tooltip',
    '.footnote-popup', '[aria-hidden="true"]', '[data-reader-exclude]', '[data-no-speech]',
  ].join(',');
  const NOTE_SELECTOR = '.footnote,.footnotes,.fn-marker,.tooltip,.footnote-popup,[data-reader-note-policy="exclude"]';
  const PROJECTABLE_ADDITION_SELECTOR = [
    BLOCK_SELECTOR,
    '.article-lead',
    '.summary-card',
    '[data-reader-summary]',
    '[data-reader-include]',
    '[data-reader-section]',
    '[data-search-policy]',
    '[data-speakable]',
    '[data-speakable-policy]',
    '[data-print-policy]',
  ].join(',');
  const NON_PROJECTABLE_UI_SELECTOR = [
    '.fn-marker', '.tooltip', '.footnote-popup', '.footnote', '.footnotes',
    '.gterm .gtip', '.btip', '[data-generated-scripture-tip]',
    '[data-reader-exclude]', '[data-no-speech]',
    '[data-pagefind-ignore]', '[hidden]', '[aria-hidden="true"]',
  ].join(',');
  const SPEAKABLE_SELECTORS = Object.freeze(['h1', '.article-lead', '.summary-card', '[data-speakable]']);
  let observer = null;
  let observedRoot = null;
  let initializedRoot = null;
  let refreshQueued = false;
  let queuedReason = null;

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?»])/g, '$1')
      .replace(/([«])\s+/g, '$1')
      .trim();
  }

  function readerRoot(scope = document) {
    if (scope instanceof Element && scope.matches(ROOT_SELECTOR)) return scope;
    return scope.querySelector?.(ROOT_SELECTOR) || null;
  }

  function projectionOwner(root) {
    return root?.closest('[data-reader-root],[data-gill-v16],main') || root;
  }

  function isExcluded(element, policy = 'reader') {
    if (!(element instanceof Element)) return true;
    if (element.closest(EXCLUDE_SELECTOR)) return true;
    if (policy === 'search' && element.closest('[data-search-policy="exclude"]')) return true;
    if (policy === 'speakable' && element.closest('[data-speakable-policy="exclude"]')) return true;
    if (policy === 'print' && element.closest('[data-print-policy="exclude"]')) return true;
    return false;
  }

  function readableText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(INLINE_STRIP_SELECTOR).forEach((node) => node.remove());
    return normalizeText(clone.textContent);
  }

  function sectionFor(element, root) {
    const direct = element.closest('[data-reader-section]');
    if (direct && direct !== root) {
      return {
        id: direct.getAttribute('data-reader-section') || direct.id || null,
        label: direct.getAttribute('data-reader-section-label') || null,
      };
    }
    let cursor = element;
    while (cursor && cursor !== root) {
      let previous = cursor.previousElementSibling;
      while (previous) {
        const heading = previous.matches?.('h1,h2,h3,h4')
          ? previous
          : Array.from(previous.querySelectorAll?.('h1,h2,h3,h4') || []).at(-1);
        if (heading) {
          return {
            id: heading.getAttribute('data-reader-section') || heading.id || null,
            label: normalizeText(heading.textContent),
          };
        }
        previous = previous.previousElementSibling;
      }
      cursor = cursor.parentElement;
    }
    const heading = root.querySelector('h1');
    return {
      id: heading?.getAttribute('data-reader-section') || heading?.id || 'article',
      label: normalizeText(heading?.textContent) || 'Статья',
    };
  }

  function blockKind(element) {
    if (element.matches('h1,h2,h3,h4')) return 'heading';
    if (element.matches('li')) return 'list-item';
    if (element.matches('blockquote')) return 'quote';
    if (element.matches('figcaption')) return 'caption';
    if (element.matches('dt,dd')) return 'definition';
    return 'paragraph';
  }

  function blockElements(root, policy = 'reader') {
    if (!root) return [];
    return Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter((element) => {
      if (isExcluded(element, policy)) return false;
      if (element.matches('li') && element.querySelector(':scope > p, :scope > ul, :scope > ol')) return false;
      if (element.matches('blockquote') && element.querySelector(':scope > p')) return false;
      return Boolean(readableText(element));
    });
  }

  function getTtsSegments(scope = document) {
    const root = readerRoot(scope);
    if (!root) return [];
    return blockElements(root, 'reader').map((element, index) => {
      const section = sectionFor(element, root);
      return {
        index,
        text: readableText(element),
        element,
        kind: blockKind(element),
        sectionId: section.id,
        sectionLabel: section.label,
      };
    });
  }

  function getSearchText(scope = document) {
    const root = readerRoot(scope);
    return root ? normalizeText(blockElements(root, 'search').map(readableText).join(' ')) : '';
  }

  function getPrintNodes(scope = document) {
    const root = readerRoot(scope);
    return root ? blockElements(root, 'print') : [];
  }

  function getSpeakableNodes(scope = document) {
    const root = readerRoot(scope);
    if (!root) return [];
    const owner = projectionOwner(root);
    const seen = new Set();
    const nodes = [];
    for (const selector of SPEAKABLE_SELECTORS) {
      owner.querySelectorAll(selector).forEach((node) => {
        const isPageLead = node.matches('h1,.article-lead');
        if ((!root.contains(node) && !isPageLead) || seen.has(node) || isExcluded(node, 'speakable')) return;
        seen.add(node);
        nodes.push(node);
      });
    }
    return nodes;
  }

  function getCurrentSection(target = document.activeElement, scope = document) {
    const root = readerRoot(scope);
    if (!root) return null;
    const element = target instanceof Element && root.contains(target) ? target : root.querySelector(BLOCK_SELECTOR);
    return element ? sectionFor(element, root) : null;
  }

  function setMarker(element, name, value) {
    if (!(element instanceof Element)) return;
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function markPolicy(root) {
    if (!root) return null;
    const owner = projectionOwner(root);
    setMarker(root, 'data-reader-projection', String(VERSION));
    setMarker(root, 'data-reader-include', 'article');
    if (!root.hasAttribute('data-search-policy')) setMarker(root, 'data-search-policy', 'include');
    if (!root.hasAttribute('data-speakable-policy')) setMarker(root, 'data-speakable-policy', 'include');
    if (!root.hasAttribute('data-print-policy')) setMarker(root, 'data-print-policy', 'include');
    if (!root.hasAttribute('data-reader-note-policy')) setMarker(root, 'data-reader-note-policy', 'exclude');

    owner.querySelectorAll('h1,.article-lead').forEach((node) => {
      if (!isExcluded(node, 'speakable') && !node.hasAttribute('data-speakable-policy')) {
        setMarker(node, 'data-speakable-policy', 'include');
      }
    });

    root.querySelectorAll('.summary-card,[data-reader-summary]').forEach((summary) => {
      setMarker(summary, 'data-reader-summary', summary.getAttribute('data-reader-summary') || 'include');
      if (!summary.hasAttribute('data-reader-include')) setMarker(summary, 'data-reader-include', 'summary');
      if (!summary.hasAttribute('data-search-policy')) setMarker(summary, 'data-search-policy', 'include');
      if (!summary.hasAttribute('data-speakable-policy')) setMarker(summary, 'data-speakable-policy', 'include');
    });

    root.querySelectorAll('h1,h2,h3,h4').forEach((heading, index) => {
      const id = heading.id || `reader-section-${index + 1}`;
      setMarker(heading, 'data-reader-section', id);
      setMarker(heading, 'data-reader-section-label', normalizeText(heading.textContent));
    });

    root.querySelectorAll(NOTE_SELECTOR).forEach((note) => {
      setMarker(note, 'data-reader-note-policy', 'exclude');
      if (!note.hasAttribute('data-reader-include')) setMarker(note, 'data-reader-exclude', 'note');
      setMarker(note, 'data-no-speech', '');
    });
    root.querySelectorAll('[data-reader-exclude],[data-speakable-policy="exclude"]').forEach((node) => {
      setMarker(node, 'data-no-speech', '');
    });
    return root;
  }

  function synchronizeSpeakableJsonLd() {
    let updated = 0;
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      let payload;
      try { payload = JSON.parse(script.textContent || 'null'); } catch { return; }
      let changed = false;
      const visit = (value) => {
        if (!value || typeof value !== 'object') return;
        if (value.speakable && typeof value.speakable === 'object') {
          const current = value.speakable.cssSelector;
          const next = [...SPEAKABLE_SELECTORS];
          if (JSON.stringify(current) !== JSON.stringify(next)) {
            value.speakable.cssSelector = next;
            changed = true;
          }
        }
        Object.values(value).forEach(visit);
      };
      visit(payload);
      if (changed) {
        script.textContent = JSON.stringify(payload);
        updated += 1;
      }
    });
    return updated;
  }

  function ledger(scope = document) {
    const root = readerRoot(scope);
    if (!root) return { version: VERSION, root: false, tts: 0, speakable: 0, print: 0, searchChars: 0, sections: 0 };
    return {
      version: VERSION,
      root: true,
      tts: getTtsSegments(root).length,
      speakable: getSpeakableNodes(root).length,
      print: getPrintNodes(root).length,
      searchChars: getSearchText(root).length,
      sections: root.querySelectorAll('[data-reader-section]').length,
      summary: root.querySelectorAll('[data-reader-summary="include"]').length,
    };
  }

  function isProjectableElement(element) {
    if (!(element instanceof Element)) return false;
    if (element.matches(NON_PROJECTABLE_UI_SELECTOR) || element.closest(NON_PROJECTABLE_UI_SELECTOR)) return false;
    return element.matches(PROJECTABLE_ADDITION_SELECTOR);
  }

  function hasProjectableAddition(mutation) {
    if (mutation.type !== 'childList') return false;
    return Array.from(mutation.addedNodes).some((node) => {
      if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return false;
      if (node instanceof Element && node.matches?.(PROJECTABLE_ADDITION_SELECTOR) && isProjectableElement(node)) return true;
      return Array.from(node.querySelectorAll?.(PROJECTABLE_ADDITION_SELECTOR) || []).some(isProjectableElement);
    });
  }

  function observe(root) {
    if (!root) return;
    if (!observer) {
      observer = new MutationObserver((mutations) => {
        if (!mutations.some(hasProjectableAddition)) return;
        queueRefresh('semantic-mutation');
      });
    }
    if (observedRoot === root) return;
    observer.disconnect();
    observedRoot = root;
    observer.observe(root, { childList: true, subtree: true });
  }

  function disconnectObserver() {
    if (observer) observer.disconnect();
    observedRoot = null;
  }

  function refresh(scope = document, reason = 'manual') {
    refreshQueued = false;
    queuedReason = null;
    const resolvedRoot = readerRoot(scope);
    const root = markPolicy(resolvedRoot);
    if (root) {
      initializedRoot = root;
      observe(root);
    } else {
      initializedRoot = null;
      disconnectObserver();
    }
    const jsonLdUpdates = synchronizeSpeakableJsonLd();
    const report = { ...ledger(root || scope), jsonLdUpdates, reason };
    document.documentElement.setAttribute('data-gb-reader-projection-ready', String(VERSION));
    try { window.dispatchEvent(new CustomEvent('gb:reader-projection-ready', { detail: report })); } catch {}
    return report;
  }

  function queueRefresh(reason = 'semantic-mutation') {
    if (reason instanceof Event) reason = reason.type;
    if (!queuedReason) queuedReason = String(reason || 'semantic-mutation');
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      const nextReason = queuedReason || 'semantic-mutation';
      queuedReason = null;
      refresh(document, nextReason);
    }));
  }

  function init(reason = 'init', force = false) {
    const root = readerRoot(document);
    if (!force && root && initializedRoot === root) return ledger(root);
    if (!force && !root && initializedRoot === null && document.documentElement.hasAttribute('data-gb-reader-projection-ready')) {
      return ledger(document);
    }
    return refresh(root || document, reason);
  }

  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-fc-action="play"]')) refresh(document, 'play');
  }, true);
  document.addEventListener('gb:quiz-rendered', queueRefresh);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init('dom-content-loaded'), { once: true });
  } else init('module-ready');
  document.addEventListener('astro:page-load', () => init('astro-page-load'));
  window.addEventListener('pageshow', (event) => init(event.persisted ? 'pageshow-persisted' : 'pageshow', event.persisted));

  window.GBReaderProjection = Object.freeze({
    version: VERSION,
    policy: Object.freeze({
      rootSelector: ROOT_SELECTOR,
      blockSelector: BLOCK_SELECTOR,
      excludeSelector: EXCLUDE_SELECTOR,
      inlineStripSelector: INLINE_STRIP_SELECTOR,
      speakableSelectors: SPEAKABLE_SELECTORS,
    }),
    refresh,
    getRoot: readerRoot,
    getTtsSegments,
    getSpeakableSelectors: () => [...SPEAKABLE_SELECTORS],
    getSpeakableNodes,
    getSearchText,
    getPrintNodes,
    getCurrentSection,
    getLedger: ledger,
  });
})();
