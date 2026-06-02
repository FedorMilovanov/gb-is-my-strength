/* glossary.js — автоматический <abbr> с тултипом для богословских терминов
 * (AUDIT_10_OF_10 → CONT-2.5 / TIP-7.1 / TIP-7.4)
 *
 * Подгружает /data/glossary.json и помечает первое вхождение каждого термина
 * в article-теле как <abbr class="gterm" title="...">. Срабатывает только для
 * страниц с pageType="article".
 */
(function () {
  'use strict';
  if (!window.SiteUtils) return;
  var pageType = SiteUtils.getConfig('page.type', '');
  if (pageType !== 'article') return;
  if (!document.querySelector('article')) return;
  if (window.__gbGlossaryInitialized) return;
  window.__gbGlossaryInitialized = true;

  var DATA_URL = (document.querySelector('script[data-glossary-url]') || {}).dataset?.glossaryUrl
              || '/data/glossary.json';

  fetch(DATA_URL).then(function (r) { return r.ok ? r.json() : null; }).then(function (dict) {
    if (!dict) return;

    if (!dict) return;
    var article = document.querySelector('article');
    
    var aliasToCanonical = {};
    var allSearchTerms = [];
    
    for (var canonical in dict) {
      var entry = dict[canonical];
      var def = typeof entry === 'string' ? entry : entry.definition;
      var aliases = typeof entry === 'object' ? entry.aliases : [canonical];
      
      aliases.forEach(function(alias) {
        aliasToCanonical[alias.toLowerCase()] = canonical;
        allSearchTerms.push(alias);
      });
    }
    
    allSearchTerms.sort(function(a, b) { return b.length - a.length; });
    var escapedTerms = allSearchTerms.map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\]/g, '\$&');
    }).join('|');

    var rx;
    try {
      rx = new RegExp('(^|[^\p{L}\p{N}_])(' + escapedTerms + ')(?=$|[^\p{L}\p{N}_])', 'giu');
    } catch (e) {
      try {
        rx = new RegExp('(^|[^а-яёА-ЯЁa-zA-Z0-9_])(' + escapedTerms + ')(?=$|[^а-яёА-ЯЁa-zA-Z0-9_])', 'gi');
      } catch (e2) { return; }
    }

    var seen = {};
    var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('a, abbr, code, pre, kbd, samp, .fn-marker, .tooltip, .gtip, .btip, h1, h2, h3, .quiz-wrapper, script, style')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    document.querySelectorAll('p, div.reveal').forEach(function(el, i) {
        el.dataset.pIdx = i;
    });

    nodes.forEach(function (n) {
      if (!rx.test(n.nodeValue)) return;
      rx.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m, replaced = false;
      while ((m = rx.exec(n.nodeValue)) !== null) {
        var sep = m[1] || '';
        var term = m[2] || '';
        var canonical = aliasToCanonical[term.toLowerCase()];
        if (!canonical) continue;
        
        var p = n.parentElement;
        while (p && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentElement;
        var pIdx = p ? parseInt(p.dataset.pIdx || 0) : 0;
        
        if (!seen[canonical] || (pIdx - seen[canonical] > 10)) {
          seen[canonical] = pIdx;
          replaced = true;
          var termIndex = m.index + sep.length;
          frag.appendChild(document.createTextNode(n.nodeValue.slice(last, termIndex)));
          var abbr = document.createElement('abbr');
          abbr.className = 'gterm';
          abbr.dataset.term = canonical;
          abbr.setAttribute('tabindex', '0');
          abbr.setAttribute('data-term-title', term);
          abbr.textContent = term;
          var tip = document.createElement('span');
          tip.className = 'gtip';
          tip.innerHTML = typeof dict[canonical] === 'string' ? dict[canonical] : dict[canonical].definition;
          abbr.appendChild(tip);
          frag.appendChild(abbr);
          last = termIndex + term.length;
        }
      }
      if (replaced) {
        frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
        n.parentNode.replaceChild(frag, n);
      }
    });

    if (window.SiteUtils && typeof SiteUtils.initGlossaryTooltips === 'function') {
      SiteUtils.initGlossaryTooltips(article);
    }


document.addEventListener('click', function (e) {
      var t = e.target.closest('a.gterm[data-term]');
      if (!t) return;
      e.preventDefault();
      var key = t.dataset.term;
      if (!dict[key]) return;
      /* Простейший inline tip: рядом со ссылкой */
      var existing = document.getElementById('gterm-inline-tip');
      if (existing) existing.remove();
      var tip = document.createElement('span');
      tip.id = 'gterm-inline-tip';
      tip.className = 'gtip is-open';
      tip.style.cssText = 'position:absolute;z-index:var(--z-tooltip);max-width:280px;padding:8px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.12);font-size:13px;line-height:1.5;color:var(--text);';
      var strong = document.createElement('strong');
      strong.textContent = key + '.';
      tip.appendChild(strong);
      tip.appendChild(document.createTextNode(' ' + dict[key]));
      document.body.appendChild(tip);
      var rect = t.getBoundingClientRect();
      tip.style.left = (window.scrollX + rect.left) + 'px';
      tip.style.top = (window.scrollY + rect.bottom + 6) + 'px';
      var off = function (ev) {
        if (ev && tip.contains(ev.target)) return;
        tip.remove();
        document.removeEventListener('click', off, true);
      };
      setTimeout(function () { document.addEventListener('click', off, true); }, 50);
    });
  }).catch(function () { /* офлайн / нет /data/ — просто пропускаем */ });
})();
