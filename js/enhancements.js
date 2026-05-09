/* ============================================================
   enhancements.js — Segmented Progress Bar + FAQPage JSON-LD
   Господь Бог — Сила Моя · v1.0
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     A. FAQPage JSON-LD Auto-Generation
     Сканирует .faq-accordion на странице и инжектирует
     FAQPage JSON-LD если его ещё нет
     ============================================================ */
  (function () {
    /* Проверяем — уже есть FAQPage в разметке? */
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var hasFaq = false;
    scripts.forEach(function(s) {
      try {
        var data = JSON.parse(s.textContent);
        if (data['@type'] === 'FAQPage' || (Array.isArray(data) && data.some(function(d){ return d['@type'] === 'FAQPage'; }))) {
          hasFaq = true;
        }
        if (data['@graph'] && data['@graph'].some(function(d){ return d['@type'] === 'FAQPage'; })) {
          hasFaq = true;
        }
      } catch(e) {}
    });

    if (hasFaq) return; /* Already present */

    var accordions = document.querySelectorAll('.faq-accordion');
    if (!accordions.length) return;

    var entities = [];
    accordions.forEach(function(acc) {
      var items = acc.querySelectorAll('.faq-accordion__item');
      items.forEach(function(item) {
        var qEl = item.querySelector('.faq-accordion__q');
        var aEl = item.querySelector('.faq-accordion__body-inner');
        if (!qEl || !aEl) return;

        /* O-05: клонируем qEl и удаляем .faq-accordion__icon из клона —
           иначе textContent включает текст иконки (стрелки, символа ±).     */
        var qClone = qEl.cloneNode(true);
        var icon = qClone.querySelector('.faq-accordion__icon');
        if (icon) icon.parentNode.removeChild(icon);
        var q = (qClone.textContent || '').trim().replace(/\s+/g, ' ');

        /* O-05: Schema.org принимает HTML в поле text — используем innerHTML
           чтобы сохранить ссылки и форматирование внутри ответа.            */
        var a = (aEl.innerHTML || '').replace(/\s+/g, ' ').trim();

        if (q && a) {
          entities.push({
            '@type': 'Question',
            'name': q,
            'acceptedAnswer': { '@type': 'Answer', 'text': a }
          });
        }
      });
    });

    if (!entities.length) return;

    var ld = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': entities
    };

    var scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.textContent = JSON.stringify(ld);
    document.head.appendChild(scriptEl);
  })();


  /* ============================================================
     B. Segmented Progress Bar (Mobile Bottom Bar)
     Заменяет единую полоску в btoc-overlay на сегменты по h2
     ============================================================ */
  (function () {
    var STYLES = `
      .btoc-seg-bar {
        display: flex;
        gap: 3px;
        width: 100%;
        height: 3px;
        align-items: center;
      }
      .btoc-seg {
        flex: 1;
        height: 3px;
        border-radius: 2px;
        background: rgba(20,16,11,0.15);
        transition: background .2s;
        position: relative;
        overflow: hidden;
      }
      html.dark .btoc-seg { background: rgba(255,255,255,.12); }
      .btoc-seg-fill {
        position: absolute;
        inset: 0;
        background: var(--gold, #b8882a);
        transform-origin: left;
        transform: scaleX(0);
        transition: transform .15s ease;
      }
      .btoc-seg.is-done .btoc-seg-fill { transform: scaleX(1); }
      .btoc-seg.is-active .btoc-seg-fill { background: var(--gold, #b8882a); }
      .btoc-seg.is-done .btoc-seg-fill { background: var(--gold-2, #7c5c18); opacity:.7; }
      @media (prefers-reduced-motion: reduce) {
        .btoc-seg { transition: none; }
        .btoc-seg-fill { transition: none; }
        .bottom-bar-seg .seg-dot { transition: none; }
      }

      /* Progress bar in bottom bar (circle replacement with line on mobile) */
      @media (max-width: 600px) {
        .bar-progress { display: none !important; }
        .bottom-bar-seg {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 4px;
          min-width: 40px;
          align-items: center;
          justify-content: center;
        }
        .bottom-bar-seg .seg-pct {
          font-family: var(--mono, monospace);
          font-size: 9px;
          letter-spacing: .06em;
          color: var(--ink-3, #8a7968);
          line-height: 1;
        }
        .bottom-bar-seg .seg-mini {
          display: flex; gap: 2px;
        }
        .bottom-bar-seg .seg-dot {
          width: 6px; height: 3px; border-radius: 1.5px;
          background: rgba(20,16,11,.15);
          transition: background .2s;
        }
        html.dark .bottom-bar-seg .seg-dot { background: rgba(255,255,255,.15); }
        .bottom-bar-seg .seg-dot.done { background: var(--gold-2, #7c5c18); opacity:.7; }
        .bottom-bar-seg .seg-dot.active { background: var(--gold, #b8882a); }
      }
    `;

    var styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);

    /* Only on article pages with bottom bar */
    var btocProgressWrap = document.querySelector('.btoc-progress-bar-wrap');
    var bottomBar = document.getElementById('bottomBar');
    if (!btocProgressWrap && !bottomBar) return;

    /* Collect h2 headings */
    var headings = Array.prototype.slice.call(
      document.querySelectorAll('article h2[id], .article-body h2[id], [data-pagefind-body] h2[id]')
    );
    if (headings.length < 2) return; /* Not enough sections */

    /* Build offset map */
    function getOffsets() {
      return headings.map(function(h, i) {
        var next = headings[i + 1];
        var start = h.getBoundingClientRect().top + window.scrollY;
        var end = next
          ? next.getBoundingClientRect().top + window.scrollY
          : document.body.scrollHeight;
        return { el: h, start: start, end: end };
      });
    }

    var offsets = [];
    function refreshOffsets() { offsets = getOffsets(); }
    refreshOffsets();
    window.addEventListener('resize', refreshOffsets, { passive: true });
    /* O-03: lazy-images и шрифты могут сдвигать заголовки после DOMContentLoaded.
       Пересчитываем offsets при полной загрузке страницы и готовности шрифтов.  */
    window.addEventListener('load', refreshOffsets, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refreshOffsets);
    }

    /* ── In btoc overlay: replace single bar with segmented ── */
    if (btocProgressWrap) {
      /* Replace inner content */
      var segBar = document.createElement('div');
      segBar.className = 'btoc-seg-bar';
      headings.forEach(function() {
        var seg = document.createElement('div');
        seg.className = 'btoc-seg';
        var fill = document.createElement('div');
        fill.className = 'btoc-seg-fill';
        seg.appendChild(fill);
        segBar.appendChild(seg);
      });
      btocProgressWrap.innerHTML = '';
      btocProgressWrap.appendChild(segBar);
    }

    /* ── In bottom bar: add mini segment dots next to progress circle ──
       B-06: используем ResizeObserver вместо одноразовой проверки window.innerWidth.
       Dots инжектируются/убираются динамически при изменении ширины окна.          */
    if (bottomBar) {
      var _miniWrapInjected = false;

      function injectMiniDots() {
        if (_miniWrapInjected) return;
        var barInner = bottomBar.querySelector('.bottom-bar-inner');
        if (!barInner) return;
        var miniWrap = document.createElement('div');
        miniWrap.className = 'bottom-bar-seg';
        var pctSpan = document.createElement('span');
        pctSpan.className = 'seg-pct';
        pctSpan.textContent = '0%';
        var miniDots = document.createElement('div');
        miniDots.className = 'seg-mini';
        headings.forEach(function() {
          var dot = document.createElement('div');
          dot.className = 'seg-dot';
          miniDots.appendChild(dot);
        });
        miniWrap.appendChild(pctSpan);
        miniWrap.appendChild(miniDots);
        barInner.insertBefore(miniWrap, barInner.firstChild);
        _miniWrapInjected = true;
      }

      function removeMiniDots() {
        if (!_miniWrapInjected) return;
        var existing = bottomBar.querySelector('.bottom-bar-seg');
        if (existing) existing.parentNode.removeChild(existing);
        _miniWrapInjected = false;
      }

      function handleResize() {
        /* CSS breakpoint @media (max-width: 600px) */
        if (bottomBar.offsetWidth <= 600) {
          injectMiniDots();
        } else {
          removeMiniDots();
        }
      }

      if (window.ResizeObserver) {
        new ResizeObserver(function () { handleResize(); }).observe(bottomBar);
      } else {
        /* Fallback для старых браузеров */
        window.addEventListener('resize', function () { handleResize(); }, { passive: true });
      }
      /* Инициализация при загрузке */
      handleResize();
    }

    /* ── Scroll update ── */
    function updateSegments() {
      var scrollY = window.scrollY;
      var winH = window.innerHeight;
      var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      var maxScroll = docH - winH;
      var pct = maxScroll > 0 ? Math.round(Math.min(scrollY / maxScroll * 100, 100)) : 0;

      var segs = document.querySelectorAll('.btoc-seg');
      var dots = document.querySelectorAll('.seg-dot');
      var pctEl = document.querySelector('.seg-pct');
      if (pctEl) pctEl.textContent = pct + '%';

      /* Also sync old btoc progress fill if exists */
      var oldFill = document.getElementById('btocProgressFill');
      if (oldFill) oldFill.style.width = pct + '%';
      var oldPct = document.getElementById('btocProgressPct');
      if (oldPct) oldPct.textContent = pct + '%';

      offsets.forEach(function(sec, i) {
        var seg = segs[i];
        var dot = dots[i];
        if (!seg && !dot) return;

        var progress = 0;
        if (scrollY >= sec.end) {
          progress = 1; /* done */
        } else if (scrollY >= sec.start) {
          progress = (scrollY - sec.start) / (sec.end - sec.start);
        }

        if (seg) {
          var fill = seg.querySelector('.btoc-seg-fill');
          if (progress >= 1) {
            seg.classList.add('is-done');
            seg.classList.remove('is-active');
            if (fill) fill.style.transform = 'scaleX(1)';
          } else if (progress > 0) {
            seg.classList.remove('is-done');
            seg.classList.add('is-active');
            if (fill) fill.style.transform = 'scaleX(' + progress.toFixed(3) + ')';
          } else {
            seg.classList.remove('is-done', 'is-active');
            if (fill) fill.style.transform = 'scaleX(0)';
          }
        }

        if (dot) {
          if (progress >= 1) {
            dot.classList.add('done');
            dot.classList.remove('active');
          } else if (progress > 0) {
            dot.classList.remove('done');
            dot.classList.add('active');
          } else {
            dot.classList.remove('done', 'active');
          }
        }
      });
    }

    window.addEventListener('scroll', updateSegments, { passive: true });
    updateSegments();
  })();

})();
