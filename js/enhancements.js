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
    /* BUGFIX 2026-05-30: кэшировать узел нельзя — ниже btocProgressWrap.innerHTML=''
       делает его detached. Получаем актуальную ссылку каждый раз внутри обновлений. */
    // var oldPct = document.getElementById('btocProgressPct'); // Moved inside updateSegments to prevent null cache (Bug #09)

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

      var oldFill = document.getElementById('btocProgressFill');
      if (oldFill) oldFill.style.width = pct + '%';
      var oldPct = document.getElementById('btocProgressPct');
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

/* ============================================================
   HOME: Hebrew Word Tap-Toggle
   Перенесено из inline <script> index.html — AGENTS-r43.
   :active reverts on finger-lift, so data-toggled keeps translation
   visible until user taps again or elsewhere.
   Активируется только если есть .hb-w на странице (главная).
============================================================ */
(function () {
  if (!document.querySelector('.hb-w, .h-tetra')) return;
  /* ── Hebrew word tap-toggle: persistent reveal on touch devices ──
     :active reverts the moment the finger lifts, so we use data-toggled
     to keep the translation visible until the user taps again or elsewhere. */
  var hebrewWords = document.querySelectorAll('.hb-w, .h-tetra');
  var hebrewInlineWords = document.querySelectorAll('.hb-w');

  function measureHebrewInlineWords() {
    hebrewInlineWords.forEach(function (el) {
      var front = el.querySelector('.hb-front');
      var back = el.querySelector('.hb-back');
      if (!front || !back) return;
      var frontW = Math.ceil(front.getBoundingClientRect().width) + 2;
      var backW = Math.ceil(back.getBoundingClientRect().width) + 6;
      el.style.setProperty('--hb-front-w', frontW + 'px');
      el.style.setProperty('--hb-open-w', Math.max(frontW, backW) + 'px');
    });
  }

  measureHebrewInlineWords();
  window.addEventListener('resize', measureHebrewInlineWords, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measureHebrewInlineWords).catch(function () {});
  }

  hebrewWords.forEach(function (el) {
    el.addEventListener('click', function (e) {
      var wasToggled = el.hasAttribute('data-toggled');
      /* Close all others */
      hebrewWords.forEach(function (w) { w.removeAttribute('data-toggled'); });
      /* Toggle this one open (or leave closed if it was already open) */
      if (!wasToggled) el.setAttribute('data-toggled', '');
      e.stopPropagation();
    });
  });
  /* Tap anywhere else collapses all */
  document.addEventListener('click', function () {
    hebrewWords.forEach(function (w) { w.removeAttribute('data-toggled'); });
  });

  /* Mobile theme button visibility is handled by CSS media queries */

  /* ── Intersection Observer: reveal sections ── */
  var reveals = document.querySelectorAll('.h-reveal');

  function revealOnScroll() {
    reveals.forEach(function (el) {
      if (el.classList.contains('h-in')) return;
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 60) {
        el.classList.add('h-in');
      }
    });
  }
  revealOnScroll(); // run on load

  /* Use IntersectionObserver if available */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('h-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    reveals.forEach(function (el) { observer.observe(el); });
  }
})();

/* ============================================================
   HOME: Ambient Scripture Background (.h-phrase animation)
   Перенесено из inline <script> index.html — AGENTS-r43.
   Управляет случайной расстановкой ambient текстовых фраз.
   Активируется только если есть .h-phrase--ambient (главная).
============================================================ */
(function () {
  if (!document.querySelector('.h-phrase--ambient')) return;
  /* ── Ambient Scripture Background ── */
  var phrases = [
    /* Greek */
    { lang:'greek', text:'ἐν ἀρχῇ ἦν ὁ λόγος', top:'6%',  side:'left',  offset:'2%', size:1.7, opacity:0.07 },
    { lang:'greek', text:'καὶ ὁ λόγος ἦν πρὸς τὸν θεόν', top:'14%', side:'right', offset:'3%', size:1.5, opacity:0.065 },
    { lang:'greek', text:'ἅγιος ἅγιος ἅγιος', top:'22%', side:'left', offset:'2%', size:2.0, opacity:0.08 },
    { lang:'greek', text:'τὸ ἄλφα καὶ τὸ ὦ', top:'31%', side:'right', offset:'4%', size:1.8, opacity:0.07 },
    { lang:'greek', text:'ὁ ὢν καὶ ὁ ἦν καὶ ὁ ἐρχόμενος', top:'40%', side:'left', offset:'1.5%', size:1.5, opacity:0.065 },
    { lang:'greek', text:'κύριος παντοκράτωρ', top:'50%', side:'right', offset:'3%', size:2.0, opacity:0.075 },
    { lang:'greek', text:'δόξα ἐν ὑψίστοις θεῷ', top:'60%', side:'left', offset:'2.5%', size:1.7, opacity:0.07 },
    { lang:'greek', text:'μόνῳ σοφῷ θεῷ', top:'70%', side:'right', offset:'5%', size:1.6, opacity:0.065 },
    { lang:'greek', text:'ἐν ἀρχῇ ἐποίησεν ὁ θεός', top:'81%', side:'left', offset:'2%', size:1.5, opacity:0.07 },
    { lang:'greek', text:'τὸ πνεῦμα κυρίου', top:'90%', side:'right', offset:'4%', size:1.8, opacity:0.065 },

    /* Latin */
    { lang:'latin', text:'In principio erat Verbum', top:'10%', side:'right', offset:'2%', size:1.5, opacity:0.065 },
    { lang:'latin', text:'Soli Deo Gloria', top:'19%', side:'left', offset:'3%', size:1.6, opacity:0.075 },
    { lang:'latin', text:'Verbum Domini manet', top:'27%', side:'right', offset:'5%', size:1.4, opacity:0.065 },
    { lang:'latin', text:'Coram Deo', top:'36%', side:'left', offset:'4%', size:1.5, opacity:0.075 },
    { lang:'latin', text:'Sanctus Sanctus Sanctus', top:'45%', side:'right', offset:'2.5%', size:1.6, opacity:0.07 },
    { lang:'latin', text:'Gloria in excelsis Deo', top:'55%', side:'left', offset:'2%', size:1.5, opacity:0.07 },
    { lang:'latin', text:'Magnificat anima mea Dominum', top:'65%', side:'right', offset:'3%', size:1.4, opacity:0.06 },
    { lang:'latin', text:'Ego sum via veritas et vita', top:'74%', side:'left', offset:'3%', size:1.5, opacity:0.065 },
    { lang:'latin', text:'Dominus illuminatio mea', top:'85%', side:'right', offset:'2%', size:1.6, opacity:0.07 },
    { lang:'latin', text:'Solus Christus', top:'94%', side:'left', offset:'4%', size:1.7, opacity:0.07 },

    /* Hebrew (Scripture phrases, NO names of God) */
    { lang:'hebrew', text:'בְּרֵאשִׁית בָּרָא', top:'4%',  side:'right', offset:'2%', size:2.4, opacity:0.075, rotate:-1 },
    { lang:'hebrew', text:'שְׁמַע יִשְׂרָאֵל', top:'17%', side:'left',  offset:'2%', size:2.8, opacity:0.075 },
    { lang:'hebrew', text:'תּוֹרַת אֱמֶת', top:'25%', side:'right', offset:'4%', size:2.2, opacity:0.07, rotate:1 },
    { lang:'hebrew', text:'מִזְמוֹר לְדָוִד', top:'33%', side:'left',  offset:'2%', size:2.5, opacity:0.07 },
    { lang:'hebrew', text:'הַשָּׁמַיִם מְסַפְּרִים כְּבוֹד', top:'43%', side:'right', offset:'1.5%', size:2.0, opacity:0.065 },
    { lang:'hebrew', text:'חַסְדּוֹ לְעוֹלָם', top:'52%', side:'left',  offset:'3%', size:2.3, opacity:0.07, rotate:-1 },
    { lang:'hebrew', text:'כִּי לְעוֹלָם חַסְדּוֹ', top:'62%', side:'right', offset:'2%', size:2.2, opacity:0.07 },
    { lang:'hebrew', text:'אוֹר לְרַגְלִי דְבָרֶךָ', top:'72%', side:'left',  offset:'2%', size:2.0, opacity:0.065 },
    { lang:'hebrew', text:'אֶת הַשָּׁמַיִם וְאֵת הָאָרֶץ', top:'79%', side:'right', offset:'3%', size:1.9, opacity:0.065 },
    { lang:'hebrew', text:'קָרוֹב לְכָל קֹרְאָיו', top:'88%', side:'left',  offset:'2.5%', size:2.1, opacity:0.07 },
    { lang:'hebrew', text:'חֲסִידֵי כׇּל עַם', top:'96%', side:'right', offset:'4%', size:2.0, opacity:0.065 },

    /* Ambient — огромные фоновые имена по центру (как в эталонном дизайне) */
    { lang:'hebrew', text:'יהוה',    top:'5%',  side:'center', size:11,  opacity:0.025 },
    { lang:'hebrew', text:'אֲדֹנָי', top:'37%', side:'center', size:9.5, opacity:0.022 },
    { lang:'hebrew', text:'אֱלֹהִים',top:'67%', side:'center', size:10,  opacity:0.022 },
    { lang:'hebrew', text:'יהוה',    top:'92%', side:'center', size:10.5,opacity:0.022 },
  ];

  var bg = document.getElementById('hScriptureBg');
  if (bg) {
    phrases.forEach(function (p) {
      var el = document.createElement('div');
      var isAmbient = p.side === 'center';
      el.className = 'h-phrase h-phrase--' + p.lang + (isAmbient ? ' h-phrase--ambient' : '');
      el.textContent = p.text;
      var style = 'top:' + p.top + ';font-size:' + p.size + 'rem;opacity:' + p.opacity + ';--phrase-opacity:' + p.opacity + ';';
      if (p.side === 'center') {
        style += 'left:50%;transform:translateX(-50%);';
      } else if (p.side === 'left') {
        style += 'left:' + p.offset + ';';
      } else {
        style += 'right:' + p.offset + ';';
      }
      if (p.rotate && p.side !== 'center') style += 'transform:rotate(' + p.rotate + 'deg);';
      el.setAttribute('style', style);
      el.setAttribute('aria-hidden', 'true'); if (p.lang === 'greek') el.setAttribute('lang', 'grc'); if (p.lang === 'hebrew') el.setAttribute('lang', 'he');
      bg.appendChild(el);
    });
  }
})();
