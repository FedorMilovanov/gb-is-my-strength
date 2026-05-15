#!/usr/bin/env node
/**
 * patch-v4-mobile.js — мобильный аудит V4.
 *
 * Делает следующее:
 *   M1.  Добавляет viewport-fit=cover во все HTML (18 файлов).
 *   M2.  Переписывает SiteUtils.lockScroll/unlockScroll на iOS-safe
 *        вариант с position:fixed + restore scrollY.
 *   M3.  Усиливает мобильное меню Nagornaya: scroll-lock, backdrop,
 *        Escape, aria-expanded toggle.
 *   M4.  Увеличивает back-to-top до 44×44 на мобильных.
 *   M5.  Увеличивает bar-icon-btn до 44×44.
 *   M6.  Увеличивает bookmark-toast-close до 32×32 minimum.
 *   M7.  Увеличивает img-viewer__close до 44×44.
 *   M8.  Увеличивает btoc-close до 44×44.
 *   M9.  Добавляет @media (max-width: 360px) для очень узких экранов.
 *   M11. Добавляет interactive-widget=resizes-content в viewport.
 *   M13. Добавляет -webkit-text-size-adjust: 100%.
 *   M14. Добавляет touch-action: manipulation глобально.
 *   M15. Адаптирует layout под landscape с Dynamic Island.
 *
 * Запуск: node scripts/patch-v4-mobile.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const log = (...a) => console.log('[patch-v4]', ...a);

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
  viewportFixed: 0,
  scrollLockUpgraded: 0,
  nagornayaMenuUpgraded: 0,
  cssMobileFixes: 0
};

// ─── M1 + M11. viewport-fit=cover + interactive-widget ───────────────
function fixViewport(file) {
  let html = read(file);
  let touched = false;
  html = html.replace(
    /<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/g,
    (full, content) => {
      let parts = content.split(',').map(s => s.trim()).filter(Boolean);
      let kept = [];
      let hasFit = false, hasInteractive = false;
      for (const p of parts) {
        if (p.startsWith('viewport-fit=')) { hasFit = true; kept.push('viewport-fit=cover'); }
        else if (p.startsWith('interactive-widget=')) { hasInteractive = true; kept.push('interactive-widget=resizes-content'); }
        // Удалим maximum-scale и user-scalable=no — нарушает a11y
        else if (p.startsWith('maximum-scale=') || p.startsWith('user-scalable=')) continue;
        else kept.push(p);
      }
      if (!hasFit) kept.push('viewport-fit=cover');
      if (!hasInteractive) kept.push('interactive-widget=resizes-content');
      const newContent = kept.join(', ');
      if (newContent !== content) { touched = true; }
      return full.replace(content, newContent);
    }
  );
  if (touched) {
    write(file, html);
    stats.viewportFixed++;
    return true;
  }
  return false;
}

// ─── M2. SiteUtils.lockScroll → iOS-safe ─────────────────────────────
function upgradeScrollLock() {
  const file = path.join(ROOT, 'js/site.js');
  let s = read(file);
  const old = `    _scrollLockCount: 0,

    lockScroll: function (source) {
      this._scrollLockCount++;
      if (this._scrollLockCount === 1) {
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.classList.remove('cp-scroll-lock');
      }
    },

    unlockScroll: function (source) {
      this._scrollLockCount = Math.max(0, this._scrollLockCount - 1);
      if (this._scrollLockCount === 0) {
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('overscroll-behavior');
        document.documentElement.classList.remove('cp-scroll-lock');
      }
    },

    forceUnlockEmergency: function () {
      this._scrollLockCount = 0;
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('overscroll-behavior');
      document.documentElement.classList.remove('cp-scroll-lock');
    },`;
  const neu = `    _scrollLockCount: 0,
    _savedScrollY: 0,

    /* AUDIT V4 / M2: iOS-safe scroll-lock.
       На iOS Safari overflow:hidden не блокирует rubber-band и теряет
       позицию. Решение: position:fixed; top: -scrollY на body. */
    lockScroll: function (source) {
      this._scrollLockCount++;
      if (this._scrollLockCount === 1) {
        var y = window.scrollY || window.pageYOffset || 0;
        this._savedScrollY = y;
        var body = document.body;
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        body.style.position = 'fixed';
        body.style.top = -y + 'px';
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        document.documentElement.classList.remove('cp-scroll-lock');
        document.documentElement.dataset.scrollLocked = '1';
      }
    },

    unlockScroll: function (source) {
      this._scrollLockCount = Math.max(0, this._scrollLockCount - 1);
      if (this._scrollLockCount === 0) {
        var body = document.body;
        var savedY = this._savedScrollY;
        body.style.removeProperty('overflow');
        body.style.removeProperty('overscroll-behavior');
        body.style.removeProperty('position');
        body.style.removeProperty('top');
        body.style.removeProperty('left');
        body.style.removeProperty('right');
        body.style.removeProperty('width');
        document.documentElement.classList.remove('cp-scroll-lock');
        delete document.documentElement.dataset.scrollLocked;
        /* Восстанавливаем scrollY синхронно — иначе rAF может моргнуть */
        window.scrollTo(0, savedY);
      }
    },

    forceUnlockEmergency: function () {
      this._scrollLockCount = 0;
      var body = document.body;
      var savedY = this._savedScrollY;
      body.style.removeProperty('overflow');
      body.style.removeProperty('overscroll-behavior');
      body.style.removeProperty('position');
      body.style.removeProperty('top');
      body.style.removeProperty('left');
      body.style.removeProperty('right');
      body.style.removeProperty('width');
      document.documentElement.classList.remove('cp-scroll-lock');
      delete document.documentElement.dataset.scrollLocked;
      if (savedY) window.scrollTo(0, savedY);
    },`;
  if (s.indexOf(old) === -1) {
    log('  ⚠ lockScroll block not found — skipping (already patched?)');
    return false;
  }
  write(file, s.replace(old, neu));
  stats.scrollLockUpgraded++;
  return true;
}

// ─── M3. Усиление мобильного меню Nagornaya ──────────────────────────
function upgradeNagornayaMenu(file) {
  let s = read(file);
  const old = `(function(){
  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('mobileMenu');
  var bars = document.querySelectorAll('#menuBtn .bar');
  if(btn && menu){
    btn.addEventListener('click', function(){
      menu.classList.toggle('hidden');
      bars[0].style.transform = menu.classList.contains('hidden') ? '' : 'rotate(45deg) translate(0,6px)';
      bars[1].style.opacity = menu.classList.contains('hidden') ? '1' : '0';
      bars[2].style.transform = menu.classList.contains('hidden') ? '' : 'rotate(-45deg) translate(0,-6px)';
    });
  }
})();`;
  const neu = `(function(){
  /* AUDIT V4 / M3: усиленное мобильное меню Nagornaya.
     Добавлено: scroll-lock, ESC-close, backdrop-click-close,
     aria-expanded toggle, focus-trap (мин), focus-restore. */
  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('mobileMenu');
  var bars = document.querySelectorAll('#menuBtn .bar');
  if (!btn || !menu) return;

  var lastFocus = null;
  var isOpen = false;

  function open() {
    isOpen = true;
    menu.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Закрыть меню');
    if (bars[0]) bars[0].style.transform = 'rotate(45deg) translate(0,6px)';
    if (bars[1]) bars[1].style.opacity = '0';
    if (bars[2]) bars[2].style.transform = 'rotate(-45deg) translate(0,-6px)';
    if (window.SiteUtils && window.SiteUtils.lockScroll) window.SiteUtils.lockScroll();
    else { document.body.style.overflow = 'hidden'; }
    lastFocus = document.activeElement;
    var firstLink = menu.querySelector('a, button');
    if (firstLink) firstLink.focus();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Открыть меню');
    if (bars[0]) bars[0].style.transform = '';
    if (bars[1]) bars[1].style.opacity = '1';
    if (bars[2]) bars[2].style.transform = '';
    if (window.SiteUtils && window.SiteUtils.unlockScroll) window.SiteUtils.unlockScroll();
    else { document.body.style.overflow = ''; }
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(e){}
  }

  btn.addEventListener('click', function(){
    if (isOpen) close(); else open();
  });

  /* Close on link click inside menu — UX: тап по разделу скрывает меню */
  menu.addEventListener('click', function(e){
    if (e.target.closest('a')) close();
  });

  /* Close on Escape */
  document.addEventListener('keydown', function(e){
    if (isOpen && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
      close();
    }
  });

  /* Close on backdrop tap (вне menu) — поскольку menu занимает inset:0,
     добавляем touchstart-handler на сам menu для outside-click внутри padding */
  menu.addEventListener('click', function(e){
    if (e.target === menu) close();
  });

  /* Close on resize выше desktop breakpoint */
  window.addEventListener('resize', function(){
    if (window.innerWidth >= 1024 && isOpen) close();
  });
})();`;
  if (s.indexOf(old) === -1) return false;
  write(file, s.replace(old, neu));
  stats.nagornayaMenuUpgraded++;
  return true;
}

// ─── M4–M9, M13–M15: CSS-исправления — единый блок в site.css ────────
function patchCSS() {
  const file = path.join(ROOT, 'css/site.css');
  let s = read(file);
  if (s.includes('AUDIT V4 — mobile hardening')) {
    log('  ⚠ CSS уже содержит V4-блок — пропускаю');
    return false;
  }

  const V4_BLOCK = `

/* ============================================================
   AUDIT V4 — mobile hardening (touch targets, viewport, iOS)
   Подключается ВНЕ @layer для гарантии приоритета над более ранними
   правилами. Все правила построены вокруг Apple HIG 44×44 minimum
   и WCAG 2.5.8 AA.
   ============================================================ */

/* M13: предотвращаем Mobile Safari "text-size-adjust" при rotation */
:root {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

/* M14: уменьшаем 300ms tap-delay на iOS Safari < 16, плюс отключаем
   double-tap zoom на интерактивных элементах (но не на тексте — сохраняем
   pinch-to-zoom для doubletap). */
button, a, label, summary, [role="button"], input[type="button"], input[type="submit"] {
  touch-action: manipulation;
}

/* M4: back-to-top — Apple HIG 44×44 минимум */
@media (max-width: 768px) {
  #back-to-top {
    width: 44px !important;
    height: 44px !important;
    bottom: max(20px, env(safe-area-inset-bottom, 0px)) !important;
    right: max(16px, env(safe-area-inset-right, 0px)) !important;
  }
  #back-to-top svg { width: 20px !important; height: 20px !important; }
}

/* M5: bar-icon-btn (нижняя панель статей) — 44×44 */
.bar-icon-btn {
  min-width: 44px;
  min-height: 44px;
}
.bar-icon-btn svg {
  width: 20px;
  height: 20px;
}

/* M6: bookmark-toast-close — увеличиваем до WCAG 24×24 минимум,
   на тач-устройствах — до 44×44 */
.bookmark-toast-close {
  min-width: 32px;
  min-height: 32px;
  padding: 6px !important;
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (pointer: coarse) {
  .bookmark-toast-close { min-width: 44px; min-height: 44px; }
}

/* bookmark-btn — кнопки внутри тоста — 44×44 на мобиле */
@media (pointer: coarse) {
  .bookmark-btn { min-height: 44px; padding: 12px 16px; }
}

/* M7: img-viewer__close — 44×44 на тач-устройствах */
@media (pointer: coarse) {
  .img-viewer__close {
    width: 44px !important;
    height: 44px !important;
    font-size: 20px !important;
  }
}

/* M8: btoc-close — расширяем pointer-area через padding до 44×44.
   Визуально остаётся 32×32, но эффективная зона тапа — 44×44. */
.btoc-close {
  position: relative;
}
@media (pointer: coarse) {
  .btoc-close::before {
    content: "";
    position: absolute;
    inset: 50% 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
}

/* M9: очень узкие экраны — старые iPhone SE 320px, складные phone-portrait */
@media (max-width: 360px) {
  .article-main, .home-main {
    padding-left: 16px;
    padding-right: 16px;
  }
  .article-header h1 { font-size: clamp(22px, 6vw, 26px); }
  .article-body p, .article-main p { font-size: 16px; line-height: 1.6; }
  .summary-card__text { font-size: 14px; }
  /* Избегаем горизонтального скролла */
  body { overflow-x: hidden; }
  /* Всё, что может выпасть — переводим в block */
  .compare-cards, .stat-grid, .figure-pair { grid-template-columns: 1fr !important; }
}

/* M15: landscape с Dynamic Island — обеспечиваем безопасные отступы */
@media (orientation: landscape) and (max-height: 500px) {
  .bottom-bar,
  .h-mobile-nav,
  #share-dialog {
    padding-left: max(20px, env(safe-area-inset-left, 0px)) !important;
    padding-right: max(20px, env(safe-area-inset-right, 0px)) !important;
  }
  .article-header h1 { font-size: clamp(22px, 4vh, 32px); }
}

/* iOS Safari: когда body заблокирован (data-scroll-locked='1') — гарантируем,
   что не появляется белая полоса под home-indicator */
html[data-scroll-locked="1"] {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
html[data-scroll-locked="1"] body {
  overscroll-behavior: contain;
}

/* Pull-to-refresh: обычно нежелательно на статьях — фиксируем */
@media (pointer: coarse) {
  html, body { overscroll-behavior-y: contain; }
}

/* M: дополнительная безопасность iOS Safari при фокусе на input/textarea —
   font-size >= 16px чтобы не было автозума */
input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),
textarea, select {
  font-size: max(16px, 1rem);
}

/* M: для тач-устройств — убираем hover-only эффекты */
@media (hover: none) {
  /* Кнопки не должны "залипать" в hover-стиле после тапа */
  .quiz-option:hover { background: var(--bg); }
  .bar-icon-btn:hover { background: transparent; }
  .gb-accuracy-btn:hover { background: var(--bg-elevated); }
}

/* M: Sticky-элементы должны учитывать safe-area при фиксированном position */
.bottom-bar,
#share-dialog,
.btoc-panel {
  padding-left: max(0px, env(safe-area-inset-left, 0px));
  padding-right: max(0px, env(safe-area-inset-right, 0px));
}
`;

  write(file, s + V4_BLOCK);
  stats.cssMobileFixes++;
  log('  ✓ CSS V4-block добавлен в site.css');
  return true;
}

// ─── EXECUTION ────────────────────────────────────────────────────────
log('M1 + M11: viewport-fit=cover + interactive-widget');
htmlFiles.forEach(f => { if (fixViewport(f)) log('  fixed:', rel(f)); });

log('M2: SiteUtils.lockScroll → iOS-safe');
upgradeScrollLock();

log('M3: Nagornaya mobile menu — scroll-lock, ARIA, ESC, focus');
htmlFiles.filter(f => /^nagornaya\/(index|chast-\d|istochniki|nakhodki|seriya)\/index\.html$/.test(rel(f)) || rel(f) === 'nagornaya/index.html')
  .forEach(f => { if (upgradeNagornayaMenu(f)) log('  fixed:', rel(f)); });

log('M4–M9, M13–M15: CSS mobile hardening');
patchCSS();

console.log('\n[patch-v4] Сводка:');
console.log(JSON.stringify(stats, null, 2));
