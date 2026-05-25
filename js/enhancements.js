/* ============================================================
   enhancements.js — Segmented Progress Bar + FAQPage JSON-LD
   Господь Бог — Сила Моя · v1.1

   Изменения v1.1:
   · FAQPage JSON-LD: поддержка @graph — если на странице уже
     есть Article/NewsArticle JSON-LD, FAQPage добавляется
     в существующий @graph (вместо отдельного тега), что
     соответствует рекомендациям Google для Rich Results
   · FAQPage: sanitize ответа — удаляем <script> и <style>
     из innerHTML перед записью в JSON-LD
   · Segmented bar: throttle обновления scroll (rAF) для
     предотвращения layout-thrashing при быстром скролле
   · ResizeObserver для пересчёта offsets (вместо только resize)
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     A. FAQPage JSON-LD Auto-Generation
     Сканирует .faq-accordion на странице и инжектирует
     FAQPage JSON-LD если его ещё нет
     v1.1: @graph merging + innerHTML sanitization
     ============================================================ */
  (function () {
    /* Проверяем — уже есть FAQPage в разметке? */
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var hasFaq = false;
    var graphScriptEl = null; /* тег, содержащий @graph */
    var graphData = null;

    scripts.forEach(function(s) {
      try {
        var data = JSON.parse(s.textContent);
        /* Прямой FAQPage */
        if (data['@type'] === 'FAQPage') { hasFaq = true; }
        if (Array.isArray(data) && data.some(function(d){ return d['@type'] === 'FAQPage'; })) { hasFaq = true; }
        /* @graph */
        if (data['@graph']) {
          if (data['@graph'].some(function(d){ return d['@type'] === 'FAQPage'; })) {
            hasFaq = true;
          } else if (!graphScriptEl) {
            /* Запоминаем первый @graph без FAQPage для возможного мержа */
            graphScriptEl = s;
            graphData = data;
          }
        }
      } catch(e) {}
    });

    if (hasFaq) return;

    var accordions = document.querySelectorAll('.faq-accordion');
    if (!accordions.length) return;

    /* ── sanitizeHtml: безопасный HTML для JSON-LD FAQ answer ── */
    function sanitizeHtml(html) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;

      var dangerous = tmp.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button, svg, math');
      dangerous.forEach(function(el){ el.parentNode.removeChild(el); });

      tmp.querySelectorAll('*').forEach(function(el) {
        Array.prototype.slice.call(el.attributes).forEach(function(attr) {
          var name = attr.name.toLowerCase();
          var value = (attr.value || '').trim().toLowerCase();
          if (name.indexOf('on') === 0 ||
              ((name === 'href' || name === 'src' || name === 'xlink:href') && /^javascript:/i.test(value))) {
            el.removeAttribute(attr.name);
          }
        });
      });

      return tmp.innerHTML.replace(/<\/script/gi, '<\\/script');
    }

    var entities = [];
    accordions.forEach(function(acc) {
      var items = acc.querySelectorAll('.faq-accordion__item');
      items.forEach(function(item) {
        var qEl = item.querySelector('.faq-accordion__q');
        var aEl = item.querySelector('.faq-accordion__body-inner');
        if (!qEl || !aEl) return;

        /* Клонируем qEl и удаляем .faq-accordion__icon */
        var qClone = qEl.cloneNode(true);
        var icon = qClone.querySelector('.faq-accordion__icon');
        if (icon) icon.parentNode.removeChild(icon);
        var q = (qClone.textContent || '').trim().replace(/\s+/g, ' ');

        /* v1.1: sanitize innerHTML ответа */
        var a = sanitizeHtml((aEl.innerHTML || '').replace(/\s+/g, ' ').trim());

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

    /* v1.1: если на странице есть @graph — добавляем FAQPage туда */
    if (graphScriptEl && graphData) {
      try {
        graphData['@graph'].push({
          '@type': 'FAQPage',
          'mainEntity': entities
        });
        graphScriptEl.textContent = JSON.stringify(graphData);
        return;
      } catch(e) {
        /* Если мерж не удался — создаём отдельный тег */
      }
    }

    /* Иначе — создаём отдельный тег */
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
     v1.1: rAF throttle для scroll, ResizeObserver для offsets
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

      /* Progress bar in bottom bar */
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

    var btocProgressWrap = document.querySelector('.btoc-progress-bar-wrap');
    var bottomBar = document.getElementById('bottomBar');
    if (!btocProgressWrap && !bottomBar) return;

    var headings = Array.prototype.slice.call(
      document.querySelectorAll('article h2[id], .article-body h2[id], [data-pagefind-body] h2[id]')
    );
    if (headings.length < 2) return;

    var segEls = [];
    var dotEls = [];
    var pctEl = null;
    var oldFill = document.getElementById('btocProgressFill');
    var oldPct = document.getElementById('btocProgressPct');

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
    var _offsetTimer = null;
    function refreshOffsets() { offsets = getOffsets(); }
    refreshOffsets();

    /* v1.1: ResizeObserver для пересчёта offsets при изменении размера */
    if (window.ResizeObserver) {
      new ResizeObserver(function() {
        /* debounce: пересчитываем через 100ms после последнего события */
        clearTimeout(_offsetTimer);
        _offsetTimer = setTimeout(refreshOffsets, 100);
      }).observe(document.body);
    } else {
      window.addEventListener('resize', refreshOffsets, { passive: true });
    }

    window.addEventListener('load', refreshOffsets, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refreshOffsets).catch(function(){});
    }

    /* ── In btoc overlay: replace single bar with segmented ── */
    if (btocProgressWrap) {
      var segBar = document.createElement('div');
      segBar.className = 'btoc-seg-bar';
      headings.forEach(function() {
        var seg = document.createElement('div');
        seg.className = 'btoc-seg';
        var fill = document.createElement('div');
        fill.className = 'btoc-seg-fill';
        seg.appendChild(fill);
        segBar.appendChild(seg);
        segEls.push(seg);
      });
      btocProgressWrap.innerHTML = '';
      btocProgressWrap.appendChild(segBar);
    }

    /* ── In bottom bar: mini segment dots ── */
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
        dotEls = [];
        headings.forEach(function() {
          var dot = document.createElement('div');
          dot.className = 'seg-dot';
          miniDots.appendChild(dot);
          dotEls.push(dot);
        });
        miniWrap.appendChild(pctSpan);
        miniWrap.appendChild(miniDots);
        barInner.insertBefore(miniWrap, barInner.firstChild);
        pctEl = pctSpan;
        _miniWrapInjected = true;
      }

      function removeMiniDots() {
        if (!_miniWrapInjected) return;
        var existing = bottomBar.querySelector('.bottom-bar-seg');
        if (existing) existing.parentNode.removeChild(existing);
        dotEls = [];
        pctEl = null;
        _miniWrapInjected = false;
      }

      function handleResize() {
        if (bottomBar.offsetWidth <= 600) {
          injectMiniDots();
        } else {
          removeMiniDots();
        }
      }

      if (window.ResizeObserver) {
        new ResizeObserver(function () { handleResize(); }).observe(bottomBar);
      } else {
        window.addEventListener('resize', function () { handleResize(); }, { passive: true });
      }
      handleResize();
    }

    /* ── Scroll update — v1.1: rAF throttle ── */
    var _rafPending = false;

    function updateSegments() {
      var scrollY = window.scrollY;
      var winH = window.innerHeight;
      var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      var maxScroll = docH - winH;
      var pct = maxScroll > 0 ? Math.round(Math.min(scrollY / maxScroll * 100, 100)) : 0;

      if (pctEl) pctEl.textContent = pct + '%';

      if (oldFill) oldFill.style.width = pct + '%';
      if (oldPct) oldPct.textContent = pct + '%';

      offsets.forEach(function(sec, i) {
        var seg = segEls[i];
        var dot = dotEls[i];
        if (!seg && !dot) return;

        var progress = 0;
        if (scrollY >= sec.end) {
          progress = 1;
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

      _rafPending = false;
    }

    window.addEventListener('scroll', function() {
      if (_rafPending) return;
      _rafPending = true;
      requestAnimationFrame(updateSegments);
    }, { passive: true });

    updateSegments();
  })();

})();

/* === MERGED: quiz-interactive (AUDIT v5) === */
/* ============================================================
   quiz-interactive.js — обработчик для .interactive-quiz/.quiz-btn
   Используется на страницах с Tailwind-разметкой (nagornaya/chast-*).
   Поддерживает множественные quiz-блоки на одной странице.
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function initQuiz(quizEl) {
    if (quizEl.dataset.quizInit === '1') return;
    quizEl.dataset.quizInit = '1';

    var correct = parseInt(quizEl.dataset.correct || '0', 10);
    var btns = Array.prototype.slice.call(quizEl.querySelectorAll('.quiz-btn'));
    var expl = quizEl.querySelector('.quiz-explanation');
    if (!btns.length) return;

    btns.forEach(function (btn, idx) {
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-pressed', 'false');
      var letter = btn.querySelector('.quiz-letter');
      // Клик
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        handleAnswer(idx);
      });
      // Enter / Space
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAnswer(idx);
        }
      });
    });

    function handleAnswer(picked) {
      // Заблокировать все кнопки
      btns.forEach(function (b, i) {
        b.classList.add('quiz-btn--answered');
        b.setAttribute('aria-pressed', i === picked ? 'true' : 'false');
        b.style.pointerEvents = 'none';
        if (i === correct) {
          b.classList.add('quiz-btn--correct');
        } else if (i === picked) {
          b.classList.add('quiz-btn--wrong');
        } else {
          b.classList.add('quiz-btn--dim');
        }
      });
      // Показать объяснение
      if (expl) {
        expl.classList.remove('hidden');
        expl.style.display = 'block';
        // Плавный показ
        expl.style.opacity = '0';
        expl.style.transform = 'translateY(6px)';
        requestAnimationFrame(function () {
          expl.style.transition = 'opacity .3s ease, transform .3s ease';
          expl.style.opacity = '1';
          expl.style.transform = 'translateY(0)';
        });
        // Скролл к объяснению (мягко)
        setTimeout(function () {
          var rect = expl.getBoundingClientRect();
          if (rect.top < 50 || rect.bottom > window.innerHeight - 50) {
            expl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 150);
      }
      // Эмитим событие для аналитики
      try {
        if (window.ym) {
          window.ym(108353327, 'reachGoal', 'quiz_answer', {
            quiz_id: quizEl.id || quizEl.dataset.quizId || 'inline',
            correct: picked === correct,
            picked: picked
          });
        }
      } catch (_) {}
    }
  }

  ready(function () {
    document.querySelectorAll('.interactive-quiz').forEach(initQuiz);
  });
})();
