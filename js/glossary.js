/* glossary.js — единый сайт-уровневый глоссарий с тултипами
 *
 * Что делает:
 * 1) Загружает /data/glossary.json один раз
 * 2) Автоматически оборачивает термины в тексте article/main
 * 3) Гидратирует уже существующие .gterm[data-term] без .gtip
 *    (включая динамически рендеримые квизы)
 * 4) Делегирует поведение тултипов единому SiteUtils.initGlossaryTooltips
 */
(function () {
  'use strict';

  if (!window.SiteUtils || typeof window.SiteUtils.getConfig !== 'function') return;
  if (window.__gbGlossaryInitialized) return;
  window.__gbGlossaryInitialized = true;

  var DATA_URL = '/data/glossary.json';
  var root = document.querySelector('article') || document.querySelector('main[data-pagefind-body]');

  var runtime = window.__gbGlossaryRuntime || {
    promise: null,
    dict: null,
    aliasToCanonical: null,
    regex: null
  };
  window.__gbGlossaryRuntime = runtime;

  function normalizeTerm(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getDefinitionText(dict, canonicalKey) {
    var entry = dict && dict[canonicalKey];
    if (!entry) return canonicalKey;
    if (typeof entry === 'string') return entry;
    if (entry.definition) {
      if (typeof entry.definition === 'string') return entry.definition;
      if (typeof entry.definition.definition === 'string') return entry.definition.definition;
    }
    return canonicalKey;
  }

  function getEntryMeta(dict, canonicalKey) {
    var entry = (dict && dict[canonicalKey]) || {};
    var def = entry.definition && typeof entry.definition === 'object' ? entry.definition : {};
    return {
      category: entry.category || def.category || '',
      categorySlug: entry.categorySlug || entry.category_slug || def.categorySlug || def.category_slug || ''
    };
  }

  function buildRuntime(dict) {
    var aliasToCanonical = {};
    var allSearchTerms = [];

    for (var canonical in dict) {
      if (!Object.prototype.hasOwnProperty.call(dict, canonical)) continue;
      var entry = dict[canonical];
      var aliases = [];

      if (Array.isArray(entry && entry.aliases)) {
        aliases = entry.aliases.slice();
      } else if (entry && entry.definition && Array.isArray(entry.definition.aliases)) {
        aliases = entry.definition.aliases.slice();
      }

      if (aliases.indexOf(canonical) === -1) aliases.unshift(canonical);

      aliases.forEach(function (alias) {
        var lower = normalizeTerm(alias);
        if (!lower) return;
        if (!aliasToCanonical[lower]) aliasToCanonical[lower] = canonical;
        if (allSearchTerms.indexOf(alias) === -1) allSearchTerms.push(alias);
      });
    }

    allSearchTerms.sort(function (a, b) { return b.length - a.length; });
    var escapedTerms = allSearchTerms.map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|');

    var rx = null;
    if (escapedTerms) {
      try {
        rx = new RegExp('(^|[^\\p{L}\\p{N}_])(' + escapedTerms + ')(?=$|[^\\p{L}\\p{N}_])', 'giu');
      } catch (e) {
        try {
          rx = new RegExp('(^|[^а-яёА-ЯЁa-zA-Z0-9_])(' + escapedTerms + ')(?=$|[^а-яёА-ЯЁa-zA-Z0-9_])', 'gi');
        } catch (e2) {
          rx = null;
        }
      }
    }

    runtime.dict = dict;
    runtime.aliasToCanonical = aliasToCanonical;
    runtime.regex = rx;
    return runtime;
  }

  function getGlossaryRuntime() {
    if (runtime.dict && runtime.aliasToCanonical && runtime.regex) {
      return Promise.resolve(runtime);
    }
    if (runtime.promise) return runtime.promise;

    runtime.promise = fetch(DATA_URL)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dict) {
        if (!dict || typeof dict !== 'object') return null;
        return buildRuntime(dict);
      })
      .catch(function () { return null; });

    return runtime.promise;
  }

  function createTip(dict, canonicalKey, originalTitle) {
    var meta = getEntryMeta(dict, canonicalKey);
    var tip = document.createElement('span');
    tip.className = 'gtip';
    if (meta.category) tip.setAttribute('data-category', meta.category);
    if (meta.categorySlug) tip.setAttribute('data-category-slug', meta.categorySlug);
    tip.innerHTML = getDefinitionText(dict, canonicalKey);
    return tip;
  }

  function hydrateGlossaryTerms(scope) {
    var target = scope && scope.querySelectorAll ? scope : document;
    return getGlossaryRuntime().then(function (state) {
      if (!state || !state.dict || !state.aliasToCanonical) return;

      var items = target.querySelectorAll('.gterm[data-term]');
      Array.prototype.forEach.call(items, function (el) {
        if (el.querySelector('.gtip')) return;

        var key = normalizeTerm(el.getAttribute('data-term') || el.getAttribute('data-term-title') || el.textContent || '');
        var canonical = state.aliasToCanonical[key];
        if (!canonical) return;

        var originalTitle = el.getAttribute('data-term-title') || el.textContent || canonical;
        var meta = getEntryMeta(state.dict, canonical);

        el.classList.add('gterm');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.getAttribute('data-term-title')) el.setAttribute('data-term-title', originalTitle);
        if (meta.category) el.setAttribute('data-category', meta.category);
        if (meta.categorySlug) el.setAttribute('data-category-slug', meta.categorySlug);
        el.appendChild(createTip(state.dict, canonical, originalTitle));
      });

      if (window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function') {
        window.SiteUtils.initGlossaryTooltips(target);
      }
    });
  }

  function autoWrapTerms(scope) {
    if (!scope || !scope.querySelectorAll) return Promise.resolve();

    return getGlossaryRuntime().then(function (state) {
      if (!state || !state.regex) return;

      var seen = {};
      var pIdx = 0;
      scope.querySelectorAll('p, div.reveal').forEach(function (el) {
        el.dataset.pIdx = String(pIdx++);
      });

      var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('a, abbr, code, pre, kbd, samp, .fn-marker, .tooltip, .btip, .gtip, h1, h2, h3, h4, .quiz-wrapper, script, style')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach(function (node) {
        var rx = state.regex;
        if (!rx) return;
        if (!rx.test(node.nodeValue)) return;
        rx.lastIndex = 0;

        var frag = document.createDocumentFragment();
        var last = 0;
        var match;
        var replaced = false;

        while ((match = rx.exec(node.nodeValue)) !== null) {
          var sep = match[1] || '';
          var term = match[2] || '';
          var canonical = state.aliasToCanonical[normalizeTerm(term)];
          if (!canonical) continue;

          var parentEl = node.parentElement;
          while (parentEl && parentEl.tagName !== 'P' && !(parentEl.tagName === 'DIV' && parentEl.classList.contains('reveal'))) {
            parentEl = parentEl.parentElement;
          }
          var currentPIdx = parentEl ? parseInt(parentEl.dataset.pIdx || '0', 10) : 0;
          if (seen[canonical] !== undefined && (currentPIdx - seen[canonical]) <= 10) continue;
          seen[canonical] = currentPIdx;

          replaced = true;
          var termIndex = match.index + sep.length;
          frag.appendChild(document.createTextNode(node.nodeValue.slice(last, termIndex)));

          var abbr = document.createElement('abbr');
          abbr.className = 'gterm';
          abbr.dataset.term = canonical;
          abbr.setAttribute('tabindex', '0');
          abbr.setAttribute('data-term-title', term);

          var meta = getEntryMeta(state.dict, canonical);
          if (meta.category) abbr.setAttribute('data-category', meta.category);
          if (meta.categorySlug) abbr.setAttribute('data-category-slug', meta.categorySlug);
          abbr.textContent = term;
          abbr.appendChild(createTip(state.dict, canonical, term));

          frag.appendChild(abbr);
          last = termIndex + term.length;
        }

        if (replaced) {
          frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
          node.parentNode.replaceChild(frag, node);
        }
      });

      if (window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function') {
        window.SiteUtils.initGlossaryTooltips(scope);
      }
    });
  }

  SiteUtils.hydrateGlossaryTerms = hydrateGlossaryTerms;
  if (window.SiteUtils && window.SiteUtils !== SiteUtils) {
    window.SiteUtils.hydrateGlossaryTerms = hydrateGlossaryTerms;
  }

  if (root) {
    autoWrapTerms(root).then(function () {
      hydrateGlossaryTerms(root);
    });
  } else {
    hydrateGlossaryTerms(document);
  }

  document.addEventListener('gb:quiz-rendered', function (ev) {
    var target = ev && ev.detail && ev.detail.root ? ev.detail.root : document;
    hydrateGlossaryTerms(target);
  });
})();
