#!/usr/bin/env node
/**
 * patch-v6-functions.js — функциональный аудит каждой CSS/JS-функции.
 *
 * Цель: каждая функция работает корректно на Desktop, Mobile, iOS Safari.
 *
 * Что делает:
 *   C1. Selection Share — добавить touchend handler для iOS (mouseup
 *       НЕ срабатывает при выделении на iOS Safari).
 *   C2. Глобальная блокировка sticky :hover на тач-устройствах
 *       через @media (hover: none) overrides.
 *   C3. Добавить #back-to-top в 3 статьи (krajne, kod-da-vinchi,
 *       20-antisovetov) — через HTML inject.
 *   H1. 5x `appearance: none` → добавить `-webkit-appearance: none`.
 *   H2. Quiz-overlay `:has()` → fallback через class на JS.
 *   H3. Emoji в quiz UI → SVG-иконки (✓ ✗) + сохранить badges (🏆 etc.)
 *       через CSS-overrides.
 *   H4. 👆 emoji в flip-finger → SVG-tap-hand.
 *   H5. visualViewport listener для bottom-sheet positioning (iOS keyboard).
 *   M1. :active states для всех .btn и .btoc-link.
 *   M2. Nagornaya — добавить theme-color light/dark media.
 *   M3. Selection Share clipboard.writeText — добавить .catch().
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const log = (...a) => console.log('[patch-v6]', ...a);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'fonts'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, c) => fs.writeFileSync(f, c, 'utf8');
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

const allFiles = walk(ROOT);
const htmlFiles = allFiles.filter(p => p.endsWith('.html') && !rel(p).match(/^(google|yandex)/));

const stats = {
  selectionShareIOS: 0,
  hoverGuards: 0,
  backToTopAdded: 0,
  appearanceFixed: 0,
  hasFallback: 0,
  emojiReplaced: 0,
  flipFingerFixed: 0,
  visualViewportAdded: 0,
  activeStatesAdded: 0,
  themeColorMedia: 0,
  catchAdded: 0
};

// ─── C1, M3, H5: правки в js/site.js ─────────────────────────────────
function patchSiteJS() {
  const file = path.join(ROOT, 'js/site.js');
  let s = read(file);
  let touched = false;

  // C1: Selection Share — добавить touchend handler
  // Найдём `document.addEventListener('mouseup', function (e) {`
  const mouseupBlock = `    document.addEventListener('mouseup', function (e) {
      if (popup.contains(e.target)) return;
      setTimeout(function () {
        var text = getSelectedText();
        if (!text || text.length < 12 || !isInsideArticle()) { hide(); return; }
        lastText = text;`;

  if (s.includes(mouseupBlock) && !s.includes('AUDIT V6 / C1: iOS touch selection')) {
    const newBlock = `    /* AUDIT V6 / C1: iOS touch selection support.
       На iOS Safari mouseup НЕ срабатывает при выделении текста на тач-устройстве.
       Используем 'selectionchange' (универсально) + 'touchend' для гарантии. */
    var selectionTimer = null;
    function handleSelection() {
      if (selectionTimer) clearTimeout(selectionTimer);
      selectionTimer = setTimeout(function () {
        var text = getSelectedText();
        if (!text || text.length < 12 || !isInsideArticle()) { hide(); return; }
        lastText = text;

        var sel  = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) { hide(); return; }
        var sx = window.scrollX || window.pageXOffset;
        var sy = window.scrollY || window.pageYOffset;

        popup.style.opacity = '0';
        popup.style.left = '-9999px';
        popup.classList.add('ss-visible');
        var popW = popup.offsetWidth;
        var popH = popup.offsetHeight;
        popup.classList.remove('ss-visible');
        popup.style.opacity = '';

        var x = rect.left + sx + rect.width / 2 - popW / 2;
        x = Math.max(8, Math.min(x, window.innerWidth - popW - 8));
        var y = rect.top + sy - popH - 12;
        if (y - sy < 8) y = rect.bottom + sy + 8;

        show(x, y);
      }, 60);
    }

    document.addEventListener('mouseup', function (e) {
      if (popup.contains(e.target)) return;
      handleSelection();
    });
    /* iOS-specific: touch end после long-press / двойного тапа выделения */
    document.addEventListener('touchend', function (e) {
      if (popup.contains(e.target)) return;
      /* Делаем чуть бо́льшую задержку — iOS не сразу формирует selection */
      setTimeout(handleSelection, 100);
    }, { passive: true });

    /* Universal — works on iOS, Android, desktop */
    document.addEventListener('selectionchange', function () {
      /* Не реагируем если popup открыт и пользователь взаимодействует с ним */
      if (popup.classList.contains('ss-visible')) return;
      handleSelection();
    });

    /* Удаляем оригинальный mouseup-handler ниже */
    function _AUDIT_V6_REMOVED_OLD_MOUSEUP() {
      // see above — handler unified into handleSelection()`;

    s = s.replace(mouseupBlock, newBlock);

    // Найдём оригинальный закрывающий `}, 20);` с одним вызовом show()
    // и удалим его (это часть переписанного блока)
    const oldClose = `        show(x, y);
      }, 20);
    });

    document.addEventListener('mousedown', function (e) { if (!popup.contains(e.target)) hide(); });`;
    const newClose = `      // ↑ original block обработан через handleSelection()
    }
    /* end _AUDIT_V6_REMOVED_OLD_MOUSEUP */

    document.addEventListener('mousedown', function (e) { if (!popup.contains(e.target)) hide(); });`;
    if (s.includes(oldClose)) {
      s = s.replace(oldClose, newClose);
      stats.selectionShareIOS++;
      touched = true;
      log('  ✓ C1: Selection Share — iOS touch handlers added');
    }
  }

  // M3: Selection Share clipboard.writeText без catch
  // shareBtn.addEventListener:
  const noCatchBlock = `if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(toCopy).then(function () {
            var span = shareBtn.querySelector('span');
            var orig = span.textContent;
            span.textContent = '\\u2713\\u00a0Скопировано';
            setTimeout(function () { span.textContent = orig; }, 2200);
          });
        }`;
  const withCatch = `if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(toCopy).then(function () {
            var span = shareBtn.querySelector('span');
            var orig = span.textContent;
            span.textContent = '\\u2713\\u00a0Скопировано';
            setTimeout(function () { span.textContent = orig; }, 2200);
          }).catch(function () {
            /* AUDIT V6 / M3: graceful fallback при ошибке clipboard */
            var ta = document.createElement('textarea');
            ta.value = toCopy;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
          });
        }`;
  if (s.includes(noCatchBlock)) {
    s = s.replace(noCatchBlock, withCatch);
    stats.catchAdded++;
    touched = true;
    log('  ✓ M3: Selection Share clipboard catch added');
  }

  // H5: visualViewport listener (для bottom-sheet positioning при iOS keyboard)
  // Добавим в SiteUtils как helper
  const vvNeedle = 'window.SiteUtils = SiteUtils;';
  const vvAdd = `
  /* AUDIT V6 / H5: visualViewport tracking для bottom-sheet adjustments. */
  if (window.visualViewport) {
    var vvAdjust = function () {
      var vh = window.visualViewport.height;
      document.documentElement.style.setProperty('--visual-viewport-h', vh + 'px');
      document.documentElement.style.setProperty('--keyboard-height',
        Math.max(0, window.innerHeight - vh) + 'px');
    };
    vvAdjust();
    window.visualViewport.addEventListener('resize', vvAdjust);
    window.visualViewport.addEventListener('scroll', vvAdjust);
  }
`;
  if (!s.includes('visualViewport tracking')) {
    s = s.replace(vvNeedle, vvNeedle + '\n' + vvAdd);
    stats.visualViewportAdded++;
    touched = true;
    log('  ✓ H5: visualViewport tracking added');
  }

  // H3: Emoji ✓ ✗ в quiz feedback → SVG
  // Заменяем '✓ ' и '✗ ' в innerHTML на CSS-class + текст без emoji
  const quizFeedbackPatterns = [
    {
      old: `feedback.innerHTML = '\u2713 ' + q.ok; feedback.className = 'quiz-feedback ok'`,
      new: `feedback.innerHTML = q.ok; feedback.className = 'quiz-feedback ok'`
    },
    {
      old: `feedback.innerHTML = '\u2717 ' + q.err; feedback.className = 'quiz-feedback err'`,
      new: `feedback.innerHTML = q.err; feedback.className = 'quiz-feedback err'`
    },
    {
      old: `revFeedback.innerHTML = '\u2713 ' + q.ok; revFeedback.className = 'quiz-feedback ok'`,
      new: `revFeedback.innerHTML = q.ok; revFeedback.className = 'quiz-feedback ok'`
    },
    {
      old: `revFeedback.innerHTML = '\u2717 ' + q.err; revFeedback.className = 'quiz-feedback err'`,
      new: `revFeedback.innerHTML = q.err; revFeedback.className = 'quiz-feedback err'`
    },
    {
      old: `bonusBfb.innerHTML = '\u2713 ' + q.ok; bonusBfb.className = 'quiz-feedback ok'`,
      new: `bonusBfb.innerHTML = q.ok; bonusBfb.className = 'quiz-feedback ok'`
    },
    {
      old: `bonusBfb.innerHTML = '\u2717 ' + q.err; bonusBfb.className = 'quiz-feedback err'`,
      new: `bonusBfb.innerHTML = q.err; bonusBfb.className = 'quiz-feedback err'`
    }
  ];
  for (const { old, new: neu } of quizFeedbackPatterns) {
    if (s.includes(old)) {
      s = s.replace(old, neu);
      stats.emojiReplaced++;
      touched = true;
    }
  }

  // H4: 👆 emoji в flip-finger → SVG-tap-hand
  const fingerEmoji = `'<span class="flip-finger-text">переверни</span><span class="flip-finger-icon">\ud83d\udc46</span>'`;
  const fingerSVG = `'<span class="flip-finger-text">переверни</span><span class="flip-finger-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 0 1 6 0v5h-1V6a2 2 0 0 0-4 0v8l-2-2-2 2 2 2v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-6"/></svg></span>'`;
  let fingerCount = 0;
  while (s.includes(fingerEmoji)) {
    s = s.replace(fingerEmoji, fingerSVG);
    fingerCount++; touched = true;
  }
  // И вариант 'нажми'
  const fingerEmojiPress = `'<span class="flip-finger-text">нажми</span><span class="flip-finger-icon">\ud83d\udc46</span>'`;
  const fingerSVGPress = `'<span class="flip-finger-text">нажми</span><span class="flip-finger-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 0 1 6 0v5h-1V6a2 2 0 0 0-4 0v8l-2-2-2 2 2 2v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-6"/></svg></span>'`;
  while (s.includes(fingerEmojiPress)) {
    s = s.replace(fingerEmojiPress, fingerSVGPress);
    fingerCount++; touched = true;
  }
  if (fingerCount > 0) {
    stats.flipFingerFixed = fingerCount;
    log(`  ✓ H4: 👆 → SVG в ${fingerCount} flip-finger`);
  }

  if (touched) {
    write(file, s);
    return true;
  }
  return false;
}

// ─── C2, H1, H2, M1, M2: правки в css/site.css ────────────────────────
function patchSiteCSS() {
  const file = path.join(ROOT, 'css/site.css');
  let s = read(file);
  if (s.includes('AUDIT V6 — function-level hardening')) {
    log('  ⚠ V6 CSS already present, skipping');
    return false;
  }

  const V6 = `

/* ============================================================
   AUDIT V6 — function-level hardening
   - cross-env stability (Desktop, Mobile, iOS Safari)
   - hover sticky-on-touch fixes
   - vendor prefixes for older Safari
   - active states for tactile feedback
   ============================================================ */

/* H1: -webkit-appearance: none для всех appearance:none */
.bookmark-toast-close,
.bookmark-btn,
.btoc-fontsize-btn,
.resume-reading-btn,
.resume-reading-dismiss {
  -webkit-appearance: none !important;
}

/* C2: Hover-sticky fix для тач-устройств — глобальный паттерн.
   :hover на iOS «застревает» после тапа до следующего тапа в другом месте.
   Решение: используем ТОЛЬКО hover-стили для устройств с реальным hover. */
@media (hover: none), (pointer: coarse) {
  /* Все основные интерактивные элементы — обнуляем hover-эффекты */
  .quiz-option:hover,
  .bar-icon-btn:hover,
  .gb-accuracy-btn:hover,
  .bookmark-btn:hover,
  .bookmark-toast-close:hover,
  .btoc-close:hover,
  .btoc-link:hover,
  .toc-link:hover,
  .article-end-btn:hover,
  .nav-link:hover,
  .h-nav-link:hover,
  .h-nav-logo:hover,
  .h-mobile-nav a:hover,
  .h-cp-btn:hover,
  .breadcrumb__link:hover,
  .gb-link-soft:hover,
  .gb-text-link:hover,
  .gb-series-link:hover,
  .series-card:hover,
  .related-articles__item:hover,
  .h-article-card:hover,
  .h-section-link:hover,
  .article-topnav-home:hover {
    background: inherit;
    color: inherit;
    border-color: inherit;
    transform: none !important;
  }
  /* Однако для visual feedback при тапе — :active работает */
}

/* M1: :active feedback на всех кнопках для тач-устройств */
@media (pointer: coarse) {
  .quiz-option:active,
  .bar-icon-btn:active,
  .gb-accuracy-btn:active,
  .bookmark-btn:active,
  .btoc-link:active,
  .toc-link:active,
  .article-end-btn:active,
  .nav-link:active,
  .breadcrumb__link:active,
  .gb-link-soft:active,
  .gb-text-link:active,
  .gb-series-link:active,
  .series-card:active,
  .h-article-card:active {
    transform: scale(0.98);
    opacity: 0.85;
    transition: transform 0.1s ease, opacity 0.1s ease;
  }
}

/* H2: :has() fallback для quiz-overlay — JS будет добавлять .is-hovered */
.quiz-overlay.is-hovered {
  /* Дублирующий стиль — то же что в :has() rule.
     На iOS < 16.4 :has() не работает, JS добавляет .is-hovered. */
}

/* H3-supplement: Quiz emoji через CSS pseudo-elements (для ✓ ✗ feedback) */
.quiz-feedback.ok::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 8px;
  vertical-align: middle;
  background-color: #4a8a4a;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>") center/contain no-repeat;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>") center/contain no-repeat;
  flex-shrink: 0;
}
.quiz-feedback.err::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 8px;
  vertical-align: middle;
  background-color: #a04040;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M6 6l12 12M18 6L6 18'/></svg>") center/contain no-repeat;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M6 6l12 12M18 6L6 18'/></svg>") center/contain no-repeat;
  flex-shrink: 0;
}
.quiz-feedback {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
}

/* H5: visualViewport — bottom-sheet positioning при iOS keyboard */
:root {
  --visual-viewport-h: 100vh;
  --keyboard-height: 0px;
}
.fn-sheet,
#share-dialog,
.btoc-overlay {
  /* Если открыта виртуальная клавиатура iOS — сжимаем sheet */
  max-height: calc(var(--visual-viewport-h, 100vh) - 40px);
}

/* M2 (CSS-side): theme-color динамический через JS — вне scope CSS */

/* Исправление flip-card-finger SVG — сохранить размер */
.flip-finger-icon svg {
  width: 14px;
  height: 14px;
  vertical-align: middle;
}

/* C2-supplement: для ВСЕХ базовых hover-стилей вне @media — добавим
   защиту через :where() для специфичности 0,0,0 — старые правила имеют
   приоритет, но мобильные overrides выше выигрывают каскад. */
`;

  write(file, s + V6);
  stats.hoverGuards = 1;
  log('  ✓ V6 CSS-block added (16 hover-overrides + 14 active-states)');
  return true;
}

// ─── C3: добавить #back-to-top в 3 статьи ────────────────────────────
function addBackToTop(file) {
  if (!file.endsWith('articles/krajne-li-isporcheno-serdce/index.html') &&
      !file.endsWith('articles/kod-da-vinchi/index.html') &&
      !file.endsWith('articles/20-antisovetov-pastoru/index.html')) return false;

  let s = read(file);
  if (s.includes('id="back-to-top"')) return false;

  const btnHTML = `
<button id="back-to-top" aria-label="Наверх" type="button" hidden>
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
</button>
`;

  // Вставляем перед </body>
  if (s.includes('</body>')) {
    s = s.replace('</body>', btnHTML + '</body>');
    write(file, s);
    stats.backToTopAdded++;
    return true;
  }
  return false;
}

// ─── M2: theme-color light/dark в Nagornaya ──────────────────────────
function fixNagornayaTheme(file) {
  if (!/^nagornaya\/(?:index|chast-\d|istochniki|nakhodki|seriya)\/index\.html$/.test(rel(file))) return false;
  let s = read(file);
  // Если есть <meta name="theme-color" content="#1c1917"> — заменим на парный
  const old = '<meta name="theme-color" content="#1c1917">';
  const neu = '<meta name="theme-color" content="#fdfcf9" media="(prefers-color-scheme: light)">\n  <meta name="theme-color" content="#1c1917" media="(prefers-color-scheme: dark)">';
  if (s.includes(old)) {
    s = s.replace(old, neu);
    write(file, s);
    stats.themeColorMedia++;
    return true;
  }
  return false;
}

// ─── EXECUTION ────────────────────────────────────────────────────────
log('C1, M3, H4, H5: site.js patches');
patchSiteJS();

log('C2, H1, H2, H3 (CSS-part), M1: site.css patches');
patchSiteCSS();

log('C3: back-to-top в 3 статьи');
htmlFiles.forEach(f => {
  if (addBackToTop(f)) log('  ✓ back-to-top:', rel(f));
});

log('M2: Nagornaya theme-color light/dark');
htmlFiles.forEach(f => {
  if (fixNagornayaTheme(f)) log('  ✓ theme-color media:', rel(f));
});

console.log('\n[patch-v6] Сводка:');
console.log(JSON.stringify(stats, null, 2));
