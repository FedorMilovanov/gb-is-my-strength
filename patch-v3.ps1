# ============================================================
# PATCH-V3.ps1 — ПОЛНЫЙ мобильный патч (1 команда)
# ============================================================
# Применение:
#   cd C:\Users\Fedor\Projects\gb-is-my-strength
#   C:\Users\Fedor\Downloads\patch-v3\patch-v3.ps1
#   или:
#   pwsh -File C:\Users\Fedor\Downloads\patch-v3\patch-v3.ps1
#
# Флаги:
#   -DryRun     — показать что будет, без изменений
#   -SkipPush   — закоммитить без git push
# ============================================================

param(
    [switch]$DryRun,
    [switch]$SkipPush,
    [string]$CommitMessage = "fix: mobile scroll-lock P0 + touch targets P1 + perf P2 [audit v3]"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    Write-Error "Запусти из корня репозитория: cd C:\Users\Fedor\Projects\gb-is-my-strength"
    exit 1
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " PATCH-V3: мобильный патч gb-is-my-strength" -ForegroundColor Cyan
Write-Host " Репо  : $(Resolve-Path .)" -ForegroundColor Cyan
Write-Host " DryRun: $DryRun | SkipPush: $SkipPush" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ===================================================================
# ШАГ 1: СОЗДАЁМ 3 НОВЫХ ФАЙЛА
# ===================================================================
Write-Host "[1/4] Создаю js/site-utils.js, js/scroll-perf.js, css/mobile-hotfix.css..." -ForegroundColor Cyan

$siteUtils = @'
/**
 * site-utils.js — Source-aware scroll lock + emergency unlock
 * Подключить ПЕРВЫМ скриптом в <head>, ДО всех модалок.
 * Исправляет P0-3: отсутствующий SiteUtils с подсчётом вложенных замков.
 */
(function () {
  'use strict';

  var locks = new Set();
  var savedY = 0;
  var emergencyTimer = null;

  function applyLock() {
    savedY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.style.setProperty('--scroll-lock-top', '-' + savedY + 'px');
    document.documentElement.setAttribute('data-scroll-locked', '1');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function releaseLock() {
    document.documentElement.removeAttribute('data-scroll-locked');
    document.documentElement.classList.remove('cp-scroll-lock');
    document.body.classList.remove('no-scroll', 'ng-toc-lock');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.documentElement.style.removeProperty('--scroll-lock-top');
    window.scrollTo(0, savedY);
  }

  function emergencyCheck() {
    var hasOpenModal =
      document.querySelector('.mobile-nav.active, .mobile-nav[aria-hidden="false"]') ||
      document.querySelector('.cp-panel.open, .cp-panel[aria-hidden="false"]') ||
      document.querySelector('.btoc-panel.open, .btoc-panel[aria-hidden="false"]') ||
      document.querySelector('.sd-panel.open');
    if (!hasOpenModal && locks.size > 0) {
      console.warn('[SiteUtils] Emergency unlock — модалок нет, замки висят:', locks);
      window.SiteUtils.forceUnlockScroll();
    }
  }

  window.SiteUtils = window.SiteUtils || {};

  window.SiteUtils.lockScroll = function (source) {
    source = source || 'default';
    if (locks.has(source)) return;
    locks.add(source);
    if (locks.size === 1) applyLock();
    if (!emergencyTimer) {
      emergencyTimer = setInterval(emergencyCheck, 3000);
    }
  };

  window.SiteUtils.unlockScroll = function (source) {
    source = source || 'default';
    locks.delete(source);
    if (locks.size === 0) {
      releaseLock();
      if (emergencyTimer) {
        clearInterval(emergencyTimer);
        emergencyTimer = null;
      }
    }
  };

  window.SiteUtils.forceUnlockScroll = function () {
    locks.clear();
    releaseLock();
    if (emergencyTimer) {
      clearInterval(emergencyTimer);
      emergencyTimer = null;
    }
  };
})();
'@

$scrollPerf = @'
/**
 * scroll-perf.js — ScrollBus (rAF-throttle) + Hebrew debounce + VisualViewport
 * Подключить ДО enhancements.js, highlights.js, bookmark-engine.js
 * Исправляет: P1-10/11/12/13 — layout thrash, множественные scroll-хендлеры
 */
(function () {
  'use strict';

  var subs = [];
  var ticking = false;

  function run() {
    ticking = false;
    var state = {
      y: window.scrollY,
      h: window.innerHeight,
      docH: Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0),
      pct: 0
    };
    var maxScroll = state.docH - state.h;
    state.pct = maxScroll > 0 ? Math.min(state.y / maxScroll, 1) : 0;
    subs.forEach(function (fn) {
      try { fn(state); } catch (e) {}
    });
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(run);
    }
  }, { passive: true });

  window.ScrollBus = {
    subscribe: function (fn) {
      if (typeof fn === 'function') {
        subs.push(fn);
        return function () {
          var idx = subs.indexOf(fn);
          if (idx > -1) subs.splice(idx, 1);
        };
      }
      return function () {};
    }
  };

  var hebrewTimer = 0;
  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.scheduleHebrewMeasure = function (fn) {
    clearTimeout(hebrewTimer);
    hebrewTimer = setTimeout(function () {
      requestAnimationFrame(fn);
    }, 120);
  };

  if (window.visualViewport) {
    var vvpTimer;
    function updateVVP() {
      clearTimeout(vvpTimer);
      vvpTimer = setTimeout(function () {
        var vvh = window.visualViewport.height || window.innerHeight;
        var kh = window.innerHeight - vvh;
        document.documentElement.style.setProperty('--visual-viewport-h', vvh + 'px');
        document.documentElement.style.setProperty('--keyboard-height', Math.max(0, kh) + 'px');
      }, 100);
    }
    window.visualViewport.addEventListener('resize', updateVVP, { passive: true });
    window.visualViewport.addEventListener('scroll', updateVVP, { passive: true });
    updateVVP();
  }
})();
'@

$mobileHotfix = @'
/* ============================================================
   MOBILE HOTFIX v3.0 — gb-is-my-strength
   Дата: 2026-05-25
   Порядок: подключить ПОСЛЕ site.css, command-palette.css
   ============================================================ */

/* P0-1: touch-action: none -> auto */
html[data-scroll-locked="1"],
html[data-scroll-locked="1"] body,
body.ng-toc-lock {
  overflow: hidden !important;
  touch-action: auto !important;
}

html[data-scroll-locked="1"] .btoc-panel,
html[data-scroll-locked="1"] .btoc-nav,
html[data-scroll-locked="1"] .mobile-nav,
html[data-scroll-locked="1"] .cp-list,
html[data-scroll-locked="1"] .cp-preview-inner,
body.ng-toc-lock .btoc-panel,
body.ng-toc-lock .btoc-nav {
  touch-action: pan-y !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* P0-2: position: fixed -> static на html */
html.cp-scroll-lock {
  overflow: hidden !important;
  position: static !important;
  width: auto !important;
  height: auto !important;
}

html.cp-scroll-lock body {
  position: fixed;
  inset-inline: 0;
  top: var(--scroll-lock-top, 0px);
  width: 100%;
  overflow: hidden;
}

/* P0-4: pull-to-refresh */
@media (pointer: coarse) {
  html, body { overscroll-behavior-y: auto !important; }
  .btoc-panel, .btoc-nav, .cp-list, .cp-preview-inner, .fn-sheet, .mobile-nav {
    overscroll-behavior: contain;
  }
}

/* P1-1: touch targets >= 44px */
@media (pointer: coarse) {
  .mobile-controls .theme-toggle, .h-mobile-menu-btn, .h-cp-btn,
  .gb-nav-search-icon, .btoc-close, .sd-close, .bar-icon-btn,
  .cp-close-btn, .mobile-nav-close {
    min-width: 44px !important; min-height: 44px !important;
    width: 44px !important; height: 44px !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
}

/* P1-2: navbar overflow 320-360px */
@media (max-width: 400px) {
  .h-nav-logo { min-width: 0; max-width: calc(100vw - 112px); overflow: hidden; }
  .h-nav-logo-main, .h-nav-logo-dash, .h-nav-logo-accent { font-size: clamp(14px, 4.1vw, 18px); }
}
@media (max-width: 340px) {
  .h-nav-logo-dash { transform: scaleX(0.75); }
  .h-nav-logo { gap: 2px; }
}

/* P1-3: Hebrew width fix on touch */
@media (pointer: coarse) {
  .hb-word[data-toggled] { width: auto !important; min-width: auto !important; }
}

/* P1-4: hero vertical budget */
@media (max-width: 480px) {
  .h-hero { padding-top: 74px; padding-bottom: 36px; }
  .h-sacred-block--hero { margin-bottom: 24px; }
}

/* P1-7: 100dvh */
.home-v20 { min-height: 100vh; min-height: 100dvh; }
@media (max-width: 480px) {
  .btoc-panel, body.nagornaya-page .btoc-panel { max-height: min(85dvh, 680px) !important; }
  .mobile-nav { max-height: 100dvh; height: 100dvh; }
  .btoc-panel, .mobile-nav, .cp-panel { max-height: var(--visual-viewport-h, 100dvh); }
}

/* P1-8: negative margins */
@media (max-width: 480px) {
  .h-featured-series { margin-inline: 0; }
  .h-featured-img-wrap { margin-left: 0; margin-right: 0; }
  .h-wide-image { margin-inline: 0; }
}

/* P1-9: content-visibility */
.article-content, .article-body, .series-content {
  content-visibility: auto; contain-intrinsic-size: auto 500px;
}

/* P2-1: scroll-padding */
html { scroll-padding-top: 72px; scroll-padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
:target, [id] { scroll-margin-top: 72px; }

/* P2-2: min 12px text */
@media (max-width: 480px) {
  .h-sacred-ref, .h-meta-tag, .h-featured-series-badge,
  .h-featured-author, .h-featured-time, .article-img figcaption .ai-note {
    font-size: max(12px, 0.75rem); line-height: 1.35;
  }
}

/* P2-3: no backdrop-blur on mobile */
@media (max-width: 480px), (prefers-reduced-transparency: reduce) {
  .h-navbar.scrolled, .h-mobile-nav, body.nagornaya-page .bottom-bar, .h-scroll-top {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: color-mix(in srgb, var(--h-bg, #f8f5f0) 96%, transparent);
  }
}

/* P2-4: will-change only during animation */
.h-featured-img-wrap img, .bottom-bar, .h-reading-progress { will-change: auto; }
.h-featured-series:hover .h-featured-img-wrap img,
.bottom-bar.visible, .is-animating .h-reading-progress { will-change: transform; }

/* P2-5: hover reset on touch */
@media (hover: none) and (pointer: coarse) {
  .h-hero-title:hover .h-title-static, .h-hero-title:hover .h-title-accent,
  .h-nav-logo:hover .h-nav-logo-main, .h-nav-logo:hover .h-nav-logo-accent {
    letter-spacing: inherit; text-shadow: none;
  }
  .h-hero-title:hover .h-title-dash, .h-nav-logo:hover .h-nav-logo-dash,
  .h-featured-series:hover .h-featured-img-wrap img { transform: none; }
}

/* safe-area */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-bar, .btoc-panel, .mobile-nav, .cp-panel {
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }
}

/* P2-6: reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .h-hero-title, .h-nav-logo, .h-featured-img-wrap img,
  .h-reading-progress, .h-featured-series {
    transition: none !important; animation: none !important;
  }
}

/* P2-7: focus-visible */
:focus-visible { outline: 2px solid var(--h-accent, #8b5e3c); outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }
'@

# Создаём директории
foreach ($d in @("js", "css")) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }

if (-not $DryRun) {
    $UTF8noBOM = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText("$PWD/js/site-utils.js", $siteUtils, $UTF8noBOM)
    [System.IO.File]::WriteAllText("$PWD/js/scroll-perf.js", $scrollPerf, $UTF8noBOM)
    [System.IO.File]::WriteAllText("$PWD/css/mobile-hotfix.css", $mobileHotfix, $UTF8noBOM)
    Write-Host "       site-utils.js, scroll-perf.js, mobile-hotfix.css — OK" -ForegroundColor Green
} else {
    Write-Host "       [DRY-RUN] site-utils.js, scroll-perf.js, mobile-hotfix.css" -ForegroundColor Yellow
}

# ===================================================================
# ШАГ 2: ПРАВИМ site.css И command-palette.css (простые строковые замены)
# ===================================================================
Write-Host "[2/4] Исправляю touch-action, position:fixed, overscroll..." -ForegroundColor Cyan

function Fix-File {
    param([string]$Path, [string]$Find, [string]$Replace, [string]$Desc)

    if (-not (Test-Path $Path)) {
        Write-Host "       [SKIP] $Path" -ForegroundColor Gray
        return
    }

    $content = [System.IO.File]::ReadAllText("$PWD/$Path", [System.Text.UTF8Encoding]::new())

    if ($content -notmatch [regex]::Escape($Find)) {
        Write-Host "       [SKIP] $Desc — уже исправлено" -ForegroundColor Gray
        return
    }

    if ($DryRun) {
        Write-Host "       [DRY-RUN] $Desc" -ForegroundColor Yellow
        return
    }

    $newContent = $content.Replace($Find, $Replace)
    if ($newContent -eq $content) {
        Write-Host "       [WARN] $Desc — замена не дала изменений" -ForegroundColor Yellow
        return
    }
    [System.IO.File]::WriteAllText("$PWD/$Path", $newContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "       [OK] $Desc" -ForegroundColor Green
}

# P0-1: touch-action: none -> auto !important в site.css
Fix-File -Path "css/site.css" `
    -Find "touch-action: none;" `
    -Replace "touch-action: auto !important;" `
    -Desc "P0-1: touch-action: none -> auto !important"

# P0-4: overscroll-behavior-y: contain -> auto в site.css
# Ищем точную строку из секции @media (pointer: coarse) { html, body { overscroll-behavior-y: contain; } }
Fix-File -Path "css/site.css" `
    -Find "html, body { overscroll-behavior-y: contain; }" `
    -Replace "html, body { overscroll-behavior-y: auto; }" `
    -Desc "P0-4: overscroll-behavior-y: contain -> auto"

# P0-2: position: fixed -> static !important в command-palette.css
Fix-File -Path "css/command-palette.css" `
    -Find "html.cp-scroll-lock { overflow: hidden; position: fixed; width: 100%; height: 100%; }" `
    -Replace "html.cp-scroll-lock { overflow: hidden !important; position: static !important; width: auto !important; height: auto !important; }" `
    -Desc "P0-2: position:fixed/width/height -> static/auto"

# ===================================================================
# ШАГ 3: ВСТАВЛЯЕМ <link>/<script> В HTML
# ===================================================================
Write-Host "[3/4] Вставляю <link>/<script> в HTML-файлы..." -ForegroundColor Cyan

function Patch-HTML {
    param([string]$Path, [string]$CssHref, [string]$JsPrefix)

    if (-not (Test-Path $Path)) { Write-Host "       [SKIP] $Path" -ForegroundColor Gray; return }

    $html = [System.IO.File]::ReadAllText("$PWD/$Path", [System.Text.UTF8Encoding]::new())

    if ($html.Contains("mobile-hotfix.css") -and $html.Contains("site-utils.js")) {
        Write-Host "       [SKIP] $Path — уже применён" -ForegroundColor Gray
        return
    }

    if ($DryRun) { Write-Host "       [DRY-RUN] $Path" -ForegroundColor Yellow; return }

    # CSS: mobile-hotfix.css ПОСЛЕ nagornaya-mobile-toc.css (или последнего site.css)
    $cssTag = "`n    <link rel=`"stylesheet`" href=`"$CssHref`mobile-hotfix.css`">"
    if ($html -match 'nagornaya-mobile-toc\.css') {
        $html = $html -replace '(<link[^>]+nagornaya-mobile-toc\.css[^>]*>)', "`${1}$cssTag"
    } elseif ($html -match 'command-palette\.css') {
        $html = $html -replace '(<link[^>]+command-palette\.css[^>]*>)', "`${1}$cssTag"
    } elseif ($html -match 'site\.css') {
        $html = $html -replace '(<link[^>]+site\.css[^>]*>)', "`${1}$cssTag"
    } else {
        $html = $html.Replace('</head>', "$cssTag`n</head>")
    }

    # JS: site-utils.js + scroll-perf.js ДО enhancements.js
    $jsTags = "`n    <script src=`"$JsPrefix`site-utils.js`"></script>`n    <script src=`"$JsPrefix`scroll-perf.js`"></script>"
    if ($html -match 'enhancements\.js') {
        $html = $html -replace '(<script[^>]+enhancements\.js[^>]*>)', "$jsTags`n    `${1}"
    } elseif ($html -match 'highlights\.js') {
        $html = $html -replace '(<script[^>]+highlights\.js[^>]*>)', "$jsTags`n    `${1}"
    } else {
        $html = $html.Replace('</body>', "$jsTags`n</body>")
    }

    [System.IO.File]::WriteAllText("$PWD/$Path", $html, [System.Text.UTF8Encoding]::new($false))
    Write-Host "       [OK] $Path" -ForegroundColor Green
}

Patch-HTML -Path "index.html"          -CssHref "css/"  -JsPrefix "js/"
Patch-HTML -Path "404.html"            -CssHref "css/"  -JsPrefix "js/"
Patch-HTML -Path "about/index.html"    -CssHref "../css/" -JsPrefix "../js/"
Patch-HTML -Path "articles/index.html" -CssHref "../css/" -JsPrefix "../js/"

# ===================================================================
# ШАГ 4: SOURCE-ТЕГИ + GIT
# ===================================================================
Write-Host "[4/4] Source-теги + git commit/push..." -ForegroundColor Cyan

if ((Test-Path "index.html") -and (-not $DryRun)) {
    $html = [System.IO.File]::ReadAllText("$PWD/index.html", [System.Text.UTF8Encoding]::new())
    $changed = $false

    if ($html.Contains("SiteUtils.lockScroll()")) {
        $html = $html.Replace("SiteUtils.lockScroll()", "SiteUtils.lockScroll('home-mobile-nav')")
        $changed = $true
    }
    if ($html.Contains("SiteUtils.unlockScroll()")) {
        $html = $html.Replace("SiteUtils.unlockScroll()", "SiteUtils.unlockScroll('home-mobile-nav')")
        $changed = $true
    }

    if ($changed) {
        [System.IO.File]::WriteAllText("$PWD/index.html", $html, [System.Text.UTF8Encoding]::new($false))
        Write-Host "       [OK] source='home-mobile-nav'" -ForegroundColor Green
    } else {
        Write-Host "       [SKIP] source-теги уже есть" -ForegroundColor Gray
    }
}

if ($DryRun) {
    Write-Host "       [DRY-RUN] git add/commit/push" -ForegroundColor Yellow
} else {
    $status = git status --porcelain
    if ($status) {
        Write-Host ""; Write-Host "Изменённые файлы:" -ForegroundColor Magenta
        Write-Host $status; Write-Host ""
        git add -A
        git commit -m $CommitMessage
        Write-Host "       [OK] Коммит: $CommitMessage" -ForegroundColor Green
        if (-not $SkipPush) { git push; Write-Host "       [OK] Запушено" -ForegroundColor Green }
    } else { Write-Host "       [SKIP] Нет изменений" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ГОТОВО. Regression checklist:" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 1. iPhone SE Safari — скролл после меню/TOC/palette" -ForegroundColor White
Write-Host " 2. Android Chrome — pull-to-refresh, тапы 44px" -ForegroundColor White
Write-Host " 3. 320px + 200% zoom — нет horizontal scroll" -ForegroundColor White
Write-Host " 4. F12 -> Elements -> <html> не должен иметь data-scroll-locked" -ForegroundColor White
Write-Host " 5. Lighthouse Mobile — 90+ Perf, 0 tap failures" -ForegroundColor White
