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

  var DATA_URL = (document.querySelector('script[data-glossary-url]') || {}).dataset?.glossaryUrl
              || '/data/glossary.json';

  fetch(DATA_URL).then(function (r) { return r.ok ? r.json() : null; }).then(function (dict) {
    if (!dict) return;
    var article = document.querySelector('article');
    var keys = Object.keys(dict).sort(function (a, b) { return b.length - a.length; });
    var rx = new RegExp('\\b(' + keys.map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')\\b', 'gi');

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

    nodes.forEach(function (n) {
      if (!rx.test(n.nodeValue)) return;
      rx.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = rx.exec(n.nodeValue)) !== null) {
        var key = Object.keys(dict).find(function (k) { return k.toLowerCase() === m[1].toLowerCase(); });
        if (!key || seen[key]) continue;
        seen[key] = 1;
        frag.appendChild(document.createTextNode(n.nodeValue.slice(last, m.index)));
        var abbr = document.createElement('abbr');
        abbr.className = 'gterm';
        abbr.setAttribute('title', dict[key].replace(/<[^>]+>/g, ''));
        abbr.dataset.term = key;
        abbr.textContent = m[0];
        frag.appendChild(abbr);
        last = m.index + m[0].length;
      }
      if (last > 0) {
        frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
        n.parentNode.replaceChild(frag, n);
      }
    });

    /* Cross-link: клик по <a class="gterm" data-term="..."> внутри подсказки */
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
      tip.innerHTML = '<strong>' + key + '.</strong> ' + dict[key];
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
