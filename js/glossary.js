/* glossary.js — единый сайт-уровневый глоссарий с тултипами
 *
 * Подгружает /data/glossary.json и оборачивает термины в <abbr class="gterm">
 * с вложенным <span class="gtip">. Позиционирование и поведение делегируются
 * единому SiteUtils.makeTooltipController (из site.js).
 *
 * Работает на ЛЮБОЙ странице, где есть <article> (не только type=article).
 *
 * Ключевые отличия от предыдущей версии:
 *  — Убран дублирующий inline-tooltip (#gterm-inline-tip), конфликтовавший
 *    с makeTooltipController.
 *  — Исправлено извлечение определения: dict[key].definition.definition.
 *  — Снято ограничение pageType === 'article': глоссарий для всего сайта.
 *  — Дубликаты в glossary.json обрабатываются через alias-to-canonical map.
 */
(function () {
  'use strict';

  /* Ждём SiteUtils — он загружается раньше (site-utils.js + site.js). */
  if (!window.SiteUtils || typeof window.SiteUtils.getConfig !== 'function') return;

  /* Работаем на любой странице, где есть <article> или <main> с текстом.
     Это охватывает article-страницы, nagornaya/chast-*, about и т.д. */
  var root = document.querySelector('article') || document.querySelector('main[data-pagefind-body]');
  if (!root) return;
  if (window.__gbGlossaryInitialized) return;
  window.__gbGlossaryInitialized = true;

  var DATA_URL = '/data/glossary.json';

  fetch(DATA_URL)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (dict) {
      if (!dict || typeof dict !== 'object') return;

      /* ── Построение alias→canonical map ──────────────────────────── */
      var aliasToCanonical = {};
      var allSearchTerms = [];

      for (var canonical in dict) {
        if (!Object.prototype.hasOwnProperty.call(dict, canonical)) continue;
        var entry = dict[canonical];

        /* Извлекаем массив aliases. Поддерживаем два формата:
           1) entry.aliases (внешний массив)
           2) entry.definition.aliases (внутренний массив, legacy) */
        var aliases = [];
        if (Array.isArray(entry.aliases)) {
          aliases = entry.aliases;
        } else if (entry.definition && Array.isArray(entry.definition.aliases)) {
          aliases = entry.definition.aliases;
        }
        if (!aliases.length) aliases = [canonical];

        aliases.forEach(function (alias) {
          var lower = alias.toLowerCase();
          if (!aliasToCanonical[lower]) {
            aliasToCanonical[lower] = canonical;
          }
          if (allSearchTerms.indexOf(alias) === -1) {
            allSearchTerms.push(alias);
          }
        });
      }

      /* ── Сортировка: длинные термины первыми (жадный матч) ────────── */
      allSearchTerms.sort(function (a, b) { return b.length - a.length; });

      var escapedTerms = allSearchTerms.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|');

      /* ── Регулярка с Unicode word boundary ─────────────────────────── */
      var rx;
      try {
        rx = new RegExp('(^|[^\\p{L}\\p{N}_])(' + escapedTerms + ')(?=$|[^\\p{L}\\p{N}_])', 'giu');
      } catch (e) {
        try {
          rx = new RegExp('(^|[^а-яёА-ЯЁa-zA-Z0-9_])(' + escapedTerms + ')(?=$|[^а-яёА-ЯЁa-zA-Z0-9_])', 'gi');
        } catch (e2) { return; }
      }

      /* ── Извлечение текста и метаданных определения ────────────────── */
      function getDefinitionText(canonicalKey) {
        var e = dict[canonicalKey];
        if (!e) return canonicalKey;
        if (typeof e === 'string') return e;
        /* Структура glossary.json: { definition: { definition: "текст", aliases: [...] }, aliases: [...] } */
        if (e.definition) {
          if (typeof e.definition === 'string') return e.definition;
          if (typeof e.definition.definition === 'string') return e.definition.definition;
        }
        return canonicalKey;
      }

      function getEntryMeta(canonicalKey) {
        var e = dict[canonicalKey] || {};
        var d = e.definition && typeof e.definition === 'object' ? e.definition : {};
        return {
          category: e.category || d.category || '',
          categorySlug: e.categorySlug || e.category_slug || d.categorySlug || d.category_slug || ''
        };
      }

      /* ── TreeWalker: обходим текстовые ноды в root (article или main) ── */
      /* Переменная root определена выше (article или main) */
      var seen = {};

      /* Присваиваем абзацам индексы для «повторного» подсветки
         (термин повторно подсвечивается, если после него прошло >10 параграфов) */
      var pIdx = 0;
      root.querySelectorAll('p, div.reveal').forEach(function (el) {
        el.dataset.pIdx = String(pIdx++);
      });

      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          /* Не трогаем заголовки, ссылки, код, уже-обработанные элементы и
             содержимое других тултипов */
          if (p.closest('a, abbr, code, pre, kbd, samp, .fn-marker, .tooltip, .btip, .gtip, h1, h2, h3, h4, .quiz-wrapper, script, style')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      /* ── Замена текстовых нод на фрагменты с <abbr class="gterm"> ─── */
      nodes.forEach(function (n) {
        if (!rx.test(n.nodeValue)) return;
        rx.lastIndex = 0;

        var frag = document.createDocumentFragment();
        var last = 0;
        var m;
        var replaced = false;

        while ((m = rx.exec(n.nodeValue)) !== null) {
          var sep = m[1] || '';
          var term = m[2] || '';
          var canonicalKey = aliasToCanonical[term.toLowerCase()];
          if (!canonicalKey) continue;

          /* Определяем индекс параграфа для логики повторной подсветки */
          var parentEl = n.parentElement;
          while (parentEl && parentEl.tagName !== 'P' && parentEl.tagName !== 'DIV') {
            parentEl = parentEl.parentElement;
          }
          var currentPIdx = parentEl ? parseInt(parentEl.dataset.pIdx || '0', 10) : 0;

          /* Подсвечиваем если: первый раз ИЛИ прошло >10 параграфов */
          if (seen[canonicalKey] !== undefined && (currentPIdx - seen[canonicalKey]) <= 10) continue;
          seen[canonicalKey] = currentPIdx;

          replaced = true;
          var termIndex = m.index + sep.length;

          /* Текст до термина */
          frag.appendChild(document.createTextNode(n.nodeValue.slice(last, termIndex)));

          /* <abbr class="gterm"> с вложенным <span class="gtip"> */
          var abbr = document.createElement('abbr');
          abbr.className = 'gterm';
          abbr.dataset.term = canonicalKey;
          abbr.setAttribute('tabindex', '0');
          abbr.setAttribute('data-term-title', term);
          var meta = getEntryMeta(canonicalKey);
          if (meta.category) abbr.setAttribute('data-category', meta.category);
          if (meta.categorySlug) abbr.setAttribute('data-category-slug', meta.categorySlug);
          abbr.textContent = term;

          var tip = document.createElement('span');
          tip.className = 'gtip';
          if (meta.category) tip.setAttribute('data-category', meta.category);
          if (meta.categorySlug) tip.setAttribute('data-category-slug', meta.categorySlug);
          tip.innerHTML = getDefinitionText(canonicalKey);
          abbr.appendChild(tip);

          frag.appendChild(abbr);
          last = termIndex + term.length;
        }

        if (replaced) {
          frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
          n.parentNode.replaceChild(frag, n);
        }
      });

      /* ── Делегируем тултипы единому контроллеру ─────────────────────── */
      if (window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function') {
        window.SiteUtils.initGlossaryTooltips(root);
      }
    })
    .catch(function () { /* офлайн / нет /data/ — просто пропускаем */ });
})();
