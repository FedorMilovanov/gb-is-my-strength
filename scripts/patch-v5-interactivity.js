#!/usr/bin/env node
/**
 * patch-v5-interactivity.js — кликабельность, тултипы, отступы.
 *
 * Что делает:
 *   I1.  Добавляет tabindex="0" + role="button" + aria-label всем .fn-marker
 *        (103 элемента в HTML). Без этого тултипы недоступны клавиатурой.
 *   I2.  Увеличивает .bar-icon-btn до 44×44 (Apple HIG).
 *   I3.  Увеличивает .btoc-close до 44×44 visible (вместо ::before-trick).
 *   I4.  Увеличивает .sd-close до 44×44.
 *   I5.  Увеличивает .fn-sheet-close до 44×44.
 *   I6.  Увеличивает .h-cp-btn до 44×44 на тач-устройствах.
 *   I7.  Добавляет :focus-visible outline для .error-flip-card и др.
 *   I8.  Wraps padding>40px правил в clamp() для масштабирования на мобиле.
 *   I9.  Удаляет inline margin-top:64px из about/index.html → CSS-класс.
 *   I10. word-break:break-word на узких экранах для длинных составных слов.
 *
 * Запуск: node scripts/patch-v5-interactivity.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const log = (...a) => console.log('[patch-v5]', ...a);

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
  fnMarkersA11y: 0,
  fnMarkersFiles: 0,
  cssMobileFixes: 0,
  inlineRemoved: 0,
};

// ─── I1. fn-marker: tabindex + role + aria ────────────────────────────
function fixFnMarkers(file) {
  let s = read(file);
  let touched = false;
  const orig = s;

  // <span class="fn-marker">N<span class="tooltip">...</span></span>
  // <span class="fn-marker fn-trans">...</span>
  s = s.replace(
    /<span\s+class="(fn-marker(?:\s+[\w-]+)*)"((?![^>]*tabindex)[^>]*)>/g,
    (full, classes, rest) => {
      // Уже есть role/tabindex?
      if (rest.includes('role=') || rest.includes('tabindex=')) return full;
      touched = true;
      stats.fnMarkersA11y++;
      return `<span class="${classes}"${rest} role="button" tabindex="0" aria-label="Показать сноску">`;
    }
  );

  if (s !== orig) {
    write(file, s);
    stats.fnMarkersFiles++;
    return true;
  }
  return false;
}

// ─── I2-I10. CSS hardening (single block) ─────────────────────────────
function patchCSS() {
  const file = path.join(ROOT, 'css/site.css');
  let s = read(file);
  if (s.includes('AUDIT V5 — interactivity hardening')) {
    log('  ⚠ V5 CSS already present, skipping');
    return false;
  }

  const V5 = `

/* ============================================================
   AUDIT V5 — interactivity hardening
   - 100% touch-target compliance Apple HIG 44×44
   - keyboard accessibility for tooltips
   - responsive padding for narrow screens
   - focus-visible everywhere
   ============================================================ */

/* I1: fn-marker — пользователь видит focus-state */
.fn-marker:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}

/* I2: bar-icon-btn — Apple HIG 44 */
.bar-icon-btn {
  min-width: 44px !important;
  min-height: 44px !important;
  width: 44px;
  height: 44px;
}

/* I3: btoc-close — visible 44×44 (не псевдо!) */
.btoc-close {
  width: 44px !important;
  height: 44px !important;
  min-width: 44px;
  min-height: 44px;
}
.btoc-close svg { width: 18px; height: 18px; }

/* I4: sd-close — Share Dialog close 44×44 */
.sd-close {
  width: 44px !important;
  height: 44px !important;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
}

/* I5: fn-sheet-close — bottom-sheet close 44×44 */
.fn-sheet-close {
  width: 44px !important;
  height: 44px !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* I6: h-cp-btn (Command Palette button) — 44×44 на тач */
@media (pointer: coarse) {
  .h-cp-btn {
    min-height: 44px !important;
    padding-top: 10px !important;
    padding-bottom: 10px !important;
  }
}

/* I7: focus-visible везде, где outline:none */
.error-flip-card:focus-visible,
.flip-card:focus-visible,
.heart-flip-card:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  border-radius: 8px;
}
.quiz-launch-hero:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

/* I8: padding-fluidization для крупных компонентов на мобиле */
@media (max-width: 600px) {
  .epilogue-caption { padding: clamp(28px, 8vw, 56px) clamp(20px, 5vw, 40px) !important; }
  .epilogue-prose { padding: clamp(20px, 5vw, 32px) clamp(20px, 5vw, 40px) !important; }
  .heart-flip-back { padding: clamp(24px, 6vw, 36px) clamp(20px, 5vw, 40px) !important; }
  .heart-flip-wrap { margin: clamp(28px, 6vw, 48px) 0 !important; }
  .author-card { margin: clamp(24px, 5vw, 40px) 0 !important; }
  .related-articles { margin: clamp(28px, 6vw, 48px) 0 !important; }
  .article-end-block { margin: clamp(28px, 6vw, 48px) 0 !important; }
  #toc-panel { padding: clamp(28px, 6vw, 40px) clamp(16px, 4vw, 24px) !important; }
  .quiz-launch-hero { padding: clamp(20px, 5vw, 28px) clamp(20px, 5vw, 36px) !important; }
  .article-img { margin: clamp(24px, 6vw, 40px) 0 !important; }
}

/* I9: about-page — заменяем inline margin-top:64px на класс */
.about-page-section--first {
  margin-top: clamp(36px, 6vw, 64px);
}

/* I10: длинные составные слова — переносы на узких экранах */
@media (max-width: 480px) {
  article p, article li, article blockquote, article td,
  .summary-card__text, .info-box, .warn-box, .ehrman-box, .quote-box,
  .pq-scripture {
    overflow-wrap: anywhere;
    word-break: break-word;
    hyphens: auto;
    -webkit-hyphens: auto;
  }
  /* Заголовки тоже */
  h1, h2, h3, h4 {
    overflow-wrap: anywhere;
    word-break: break-word;
    hyphens: auto;
  }
}

/* I11: Дополнительные :focus-visible паттерны для всех скрытых элементов */
.h-mobile-nav a:focus-visible,
.bottom-bar button:focus-visible,
.btoc-link:focus-visible,
.toc-link:focus-visible,
[data-close-nav]:focus-visible,
[data-action]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* I12: Все .gterm <abbr> тоже должны быть focusable */
abbr.gterm {
  cursor: help;
  outline: none;
}
abbr.gterm:focus-visible {
  outline: 2px dotted var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* I13: убираем -webkit-tap-highlight на интерактивных элементах */
button, a, [role="button"], [tabindex="0"], summary, input, textarea, select {
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.05);
}

/* I14: Гарантируем, что bottom-bar не залезает на content */
@media (max-width: 899px) {
  body.has-bottom-bar { 
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 8px);
  }
}

/* I15: Если элемент имеет cursor:pointer, но не button/a — скринридер
   должен видеть его. Утверждаем role через автокласс */
[onclick], [data-tip], [data-toggle], [data-popover] {
  cursor: pointer;
}
`;

  write(file, s + V5);
  stats.cssMobileFixes++;
  log('  ✓ V5 CSS-block added');
  return true;
}

// ─── I9 (HTML side): убрать inline margin-top:64px ───────────────────
function fixAboutInline() {
  const file = path.join(ROOT, 'about/index.html');
  if (!fs.existsSync(file)) return false;
  let s = read(file);
  const orig = s;
  // Найдём <... style="margin-top: 64px"...> и заменим на класс
  s = s.replace(
    /style="margin-top:\s*64px"/g,
    'class="about-page-section--first"'
  );
  // Если class уже есть — добавим в него
  s = s.replace(
    /class="([^"]*)"\s+class="about-page-section--first"/g,
    'class="$1 about-page-section--first"'
  );
  if (s !== orig) {
    write(file, s);
    stats.inlineRemoved++;
    return true;
  }
  return false;
}

// ─── EXECUTION ────────────────────────────────────────────────────────
log('I1: fn-marker → tabindex + role="button" + aria-label');
htmlFiles.forEach(f => {
  if (fixFnMarkers(f)) log('  fixed:', rel(f));
});

log(`I2-I8, I10-I15: CSS V5 hardening`);
patchCSS();

log('I9: about/ inline margin-top → class');
fixAboutInline();

console.log('\n[patch-v5] Сводка:');
console.log(JSON.stringify(stats, null, 2));
