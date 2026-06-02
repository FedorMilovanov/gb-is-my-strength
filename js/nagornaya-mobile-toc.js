/* ============================================================
   nagornaya-mobile-toc.js
   Mobile bottom TOC for independent /nagornaya/ Tailwind pages.
   Builds TOC from h2[id] inside [data-pagefind-body].

   FIXES APPLIED (v2):
   - SVG in btocTimeLeft now uses innerHTML (was textContent causing raw HTML output)
   - Added TOC banner image (og-nagornaya-propoved)
   - Unified scroll lock via data-scroll-locked on <html> (matches site.css)
   - Added -webkit-overflow-scrolling: touch class injection for iOS momentum scroll
   - Added aria-live for progress updates
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escText(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function slugify(s, i) {
    var base = String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72);
    return base || ('section-' + (i + 1));
  }

  function ensureId(el, i) {
    if (el.id) return el.id;
    var id = slugify(el.textContent, i);
    var base = id;
    var n = 2;
    while (document.getElementById(id)) {
      id = base + '-' + n;
      n++;
    }
    el.id = id;
    return id;
  }

  ready(function () {
    if (document.getElementById('bottomBar') || document.getElementById('btocOverlay')) return;

    var content = qs('[data-pagefind-body]') || qs('main');
    if (!content) return;

    var headings = qsa('h2', content).filter(function (h) {
      return escText(h.textContent).length > 0;
    });

    headings.forEach(function (h, i) { ensureId(h, i); });

    if (!headings.length) return;

    var cfg = window.SITE_CONFIG || {};
    var pageCfg = cfg.page || {};
    var readingTime = Number(pageCfg.readingTime || 0) || Math.max(1, Math.round(escText(content.textContent).split(/\s+/).length / 200));

    injectMarkup(headings.length, readingTime);

    var bottomBar = qs('#bottomBar');
    var overlay = qs('#btocOverlay');
    var panel = qs('#btocPanel');
    var sectionBtn = qs('#barSectionBtn');
    var sectionName = qs('#barSectionName');
    var closeBtn = qs('#btocClose');
    var nav = qs('#btocNav');
    var upBtn = qs('#barUpBtn');
    var themeBtn = qs('#barThemeBtn');
    var shareBtn = qs('#barShareBtn');
    var btocShareBtn = qs('#btocShareBtn');
    var progressFill = qs('#barProgressFill');
    var progressText = qs('#barProgressText');
    var btocPct = qs('#btocProgressPct');
    var btocTimeLeft = qs('#btocTimeLeft');

    var circumference = 97.4;
    var items = headings.map(function (h, i) {
      var a = document.createElement('a');
      a.className = 'btoc-link';
      var hash = '#' + encodeURIComponent(h.id);
      a.setAttribute('href', hash);
      a.innerHTML = '<span class="btoc-link-num">' + String(i + 1).padStart(2, '0') + '</span>' +
                    '<span class="btoc-link-text"></span>';
      a.querySelector('.btoc-link-text').textContent = escText(h.textContent);
      a.addEventListener('click', function (e) {
        e.preventDefault();
        closeOverlay();
        h.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        try { history.replaceState(null, '', hash); } catch (_) {}
      });
      nav.appendChild(a);
      return { el: h, link: a, label: escText(h.textContent) };
    });

    document.body.classList.add('has-bottom-bar');
    requestAnimationFrame(function () { bottomBar.classList.add('visible'); });

    function prefersReducedMotion() {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function getScrollMetrics() {
      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.scrollY || window.pageYOffset || doc.scrollTop || 0;
      var total = Math.max(body.scrollHeight, doc.scrollHeight) - window.innerHeight;
      var pct = total > 0 ? Math.max(0, Math.min(100, Math.round(scrollTop / total * 100))) : 0;
      return { scrollTop: scrollTop, total: total, pct: pct };
    }

    function getActiveItem() {
      var marker = (window.scrollY || window.pageYOffset || 0) + Math.min(window.innerHeight * 0.38, 280);
      var active = items[0];
      items.forEach(function (item) {
        if (item.el.getBoundingClientRect().top + window.scrollY <= marker) active = item;
      });
      return active;
    }

    function update() {
      var m = getScrollMetrics();
      var active = getActiveItem();
      var pct = m.pct;
      if (progressFill) progressFill.style.strokeDashoffset = String(circumference - (pct / 100 * circumference));
      if (progressText) progressText.textContent = pct + '%';
      var _btocFill = qs('#btocProgressFill');
      if (_btocFill) _btocFill.style.width = pct + '%';
      if (btocPct) btocPct.textContent = pct + '%';
      if (sectionName && active) sectionName.textContent = active.label;
      items.forEach(function (item) { item.link.classList.toggle('active', item === active); });

      if (btocTimeLeft) {
        var left = Math.max(1, Math.ceil(readingTime * (100 - pct) / 100));
        btocTimeLeft.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> <span style="margin-left:4px">Осталось: ~' + left + ' мин</span>';
      }
    }

    var _usedFallbackLock = false;
    function openOverlay() {
      if (overlay.classList.contains('open')) return;
      overlay.classList.add('open');
      overlay.removeAttribute('aria-hidden');
      // FIX: use shared scroll-lock helper when available to avoid stuck locks
      if (window.SiteUtils && window.SiteUtils.lockScroll) {
        window.SiteUtils.lockScroll('nagornaya-btoc');
        _usedFallbackLock = false;
      } else {
        document.documentElement.setAttribute('data-scroll-locked', '1');
        _usedFallbackLock = true;
      }
      update();
      var active = nav.querySelector('.btoc-link.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
      if (panel) panel.focus && panel.focus();
    }

    function closeOverlay() {
      if (!overlay.classList.contains('open')) return;
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      if (_usedFallbackLock) {
        document.documentElement.removeAttribute('data-scroll-locked');
      } else {
        if (window.SiteUtils && window.SiteUtils.unlockScroll) {
          window.SiteUtils.unlockScroll('nagornaya-btoc');
        } else {
          document.documentElement.removeAttribute('data-scroll-locked');
        }
      }
    }

    function toggleTheme() {
      var html = document.documentElement;
      var isDark = html.classList.toggle('dark');
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
    }

    function sharePage(btnLabelEl) {
      var title = document.title || pageCfg.title || 'Господь Бог — Сила Моя';
      var url = location.href;
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () {});
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          if (btnLabelEl) {
            var old = btnLabelEl.textContent;
            btnLabelEl.textContent = 'Ссылка скопирована';
            setTimeout(function () { btnLabelEl.textContent = old; }, 1400);
          }
        }).catch(function () {});
      }
    }

    sectionBtn && sectionBtn.addEventListener('click', openOverlay);
    closeBtn && closeBtn.addEventListener('click', closeOverlay);
    overlay && overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    upBtn && upBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); });
    themeBtn && themeBtn.addEventListener('click', toggleTheme);
    shareBtn && shareBtn.addEventListener('click', function () { sharePage(null); });
    btocShareBtn && btocShareBtn.addEventListener('click', function () { sharePage(qs('#btocShareLabel')); });

    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && overlay.classList.contains('open')) closeOverlay();
    });

    var updateQueued = false;
    function queueUpdate() {
      if (updateQueued) return;
      updateQueued = true;
      requestAnimationFrame(function () {
        updateQueued = false;
        update();
      });
    }

    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate, { passive: true });
    update();
  });

  function injectMarkup(sectionCount, readingTime) {
    var homeHref = location.pathname.split('/').filter(Boolean).length > 1 ? '../../' : '../';
    // FIX: added banner block with series OG image for visual premium feel
    var bannerHtml = '<div class="btoc-banner" aria-hidden="true" style="background-image:url(\'' + homeHref + 'images/og-nagornaya-propoved.webp\')"></div><div class="btoc-banner-grad" aria-hidden="true"></div><div class="btoc-banner-title">Нагорная проповедь</div>';

    var html = '' +
      '<div class="bottom-bar" id="bottomBar">' +
        '<div class="bottom-bar-inner">' +
          '<div class="bar-progress" id="barProgress" aria-hidden="true">' +
            '<svg viewBox="0 0 36 36">' +
              '<circle class="bar-progress-track" cx="18" cy="18" r="15.5"></circle>' +
              '<circle class="bar-progress-fill" cx="18" cy="18" id="barProgressFill" r="15.5" stroke-dasharray="97.4" stroke-dashoffset="97.4"></circle>' +
            '</svg>' +
            '<span class="bar-progress-text" id="barProgressText">0%</span>' +
          '</div>' +
          '<button aria-label="Открыть оглавление" class="bar-section-btn" id="barSectionBtn" type="button">' +
            '<span class="bar-section-label">Сейчас читаете</span>' +
            '<span class="bar-section-name" id="barSectionName">Оглавление</span>' +
          '</button>' +
          '<span class="bar-divider" aria-hidden="true"></span>' +
          '<button aria-label="Наверх" class="bar-icon-btn" id="barUpBtn" title="Наверх" type="button">' +
            '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>' +
          '</button>' +
          '<button aria-label="Тема" class="bar-icon-btn" id="barThemeBtn" title="Переключить тему" type="button">' +
            '<svg class="bar-icon-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"></path></svg>' +
            '<svg class="bar-icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" x2="12" y1="1" y2="4"></line><line x1="12" x2="12" y1="20" y2="23"></line><line x1="1" x2="4" y1="12" y2="12"></line><line x1="20" x2="23" y1="12" y2="12"></line><line x1="4.2" x2="6.3" y1="4.2" y2="6.3"></line><line x1="17.7" x2="19.8" y1="17.7" y2="19.8"></line><line x1="4.2" x2="6.3" y1="19.8" y2="17.7"></line><line x1="17.7" x2="19.8" y1="6.3" y2="4.2"></line></svg>' +
          '</button>' +
          '<a aria-label="На главную" class="bar-icon-btn" href="' + homeHref + '" title="На главную">' +
            '<svg viewBox="0 0 24 24"><path d="M3 12L12 4l9 8"></path><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"></path></svg>' +
          '</a>' +
          '<button aria-label="Поделиться" class="bar-icon-btn" id="barShareBtn" title="Поделиться" type="button">' +
            '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="btoc-overlay" id="btocOverlay" aria-hidden="true">' +
        '<div class="btoc-panel" id="btocPanel" role="dialog" aria-modal="true" aria-labelledby="btocTitle" tabindex="-1">' +
          '<div class="btoc-handle"></div>' +
          bannerHtml +
          '<div class="btoc-header">' +
            '<div class="btoc-header-left">' +
              '<div class="btoc-title" id="btocTitle">Содержание</div>' +
              '<div class="btoc-subtitle" id="btocSubtitle">' + sectionCount + ' ' + (function (n) {
                /* BUGFIX 2026-05-30: правильное склонение для 1–4. */
                if (window.SiteUtils && typeof window.SiteUtils.pluralRu === 'function') {
                  return window.SiteUtils.pluralRu(n, 'раздел', 'раздела', 'разделов');
                }
                var abs = Math.abs(n) % 100, tens = abs % 10;
                if (abs > 10 && abs < 20) return 'разделов';
                if (tens > 1 && tens < 5) return 'раздела';
                if (tens === 1) return 'раздел';
                return 'разделов';
              })(sectionCount) + '</div>' +
            '</div>' +
            '<button aria-label="Закрыть" class="btoc-close" id="btocClose" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>' +
          '<div class="btoc-progress-row">' +
            '<div class="btoc-progress-bar-wrap"><div class="btoc-progress-bar-fill" id="btocProgressFill" style="width:0%"></div></div>' +
            '<span class="btoc-progress-pct" id="btocProgressPct">0%</span>' +
          '</div>' +
          '<div class="btoc-reading-time"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ~' + readingTime + ' мин чтения</span><span id="btocTimeLeft"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> Осталось: ~' + readingTime + ' мин</span></div>' +
          '<nav class="btoc-nav" id="btocNav" aria-label="Оглавление"></nav>' +
          '<div class="btoc-footer">' +
            '<button aria-label="Поделиться страницей" class="btoc-share-btn" id="btocShareBtn" type="button">' +
              '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>' +
              '<span id="btocShareLabel">Поделиться</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }


  /* ============================================================
     B. Nagornaya Mobile Menu (menuBtn / mobileMenu)
     Перенесено из inline <script> в chast-1..5 — AGENTS-r38.
     Активируется только если есть #menuBtn на странице.
     ============================================================ */
  ready(function () {
    var btn  = document.getElementById('menuBtn');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;

    var bars     = btn.querySelectorAll('.bar');
    var lastFocus = null;
    var isOpen   = false;

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      menu.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Закрыть меню');
      if (bars[0]) bars[0].style.transform = 'rotate(45deg) translate(0,6px)';
      if (bars[1]) bars[1].style.opacity   = '0';
      if (bars[2]) bars[2].style.transform = 'rotate(-45deg) translate(0,-6px)';
      if (window.SiteUtils && window.SiteUtils.lockScroll)
        window.SiteUtils.lockScroll('nagornaya-menu');
      else document.body.classList.add('no-scroll');
      lastFocus = document.activeElement;
      var first = menu.querySelector('a, button');
      if (first) first.focus();
    }

    function closeMenu() {
      if (!isOpen) return;
      isOpen = false;
      menu.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Открыть меню');
      if (bars[0]) bars[0].style.transform = '';
      if (bars[1]) bars[1].style.opacity   = '1';
      if (bars[2]) bars[2].style.transform = '';
      if (window.SiteUtils && window.SiteUtils.unlockScroll)
        window.SiteUtils.unlockScroll('nagornaya-menu');
      else document.body.classList.remove('no-scroll');
      if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(e) {}
    }

    btn.addEventListener('click', function () { isOpen ? closeMenu() : openMenu(); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a') || e.target === menu) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (isOpen && (e.key === 'Escape' || e.key === 'Esc')) {
        e.preventDefault(); closeMenu();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024 && isOpen) closeMenu();
    });
  });

  /* ============================================================
     C. Nagornaya Read Progress Bar (#read-progress)
     Перенесено из inline <script> — AGENTS-r38.
     ============================================================ */
  ready(function () {
    var bar = document.getElementById('read-progress');
    if (!bar) return;
    function updateProgress() {
      var body = document.body;
      var html = document.documentElement;
      var total = Math.max(body.scrollHeight, html.scrollHeight) - html.clientHeight;
      if (total <= 0) return;
      var pct = Math.min(100, Math.round((window.scrollY || html.scrollTop) / total * 100));
      bar.style.width = pct + '%';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  });

  /* ============================================================
     D. Nagornaya Font Size Control
     Перенесено из inline <script> — AGENTS-r38.
     Синхронизировано с btoc-fontsize из site.js (единый key).
     ============================================================ */
  ready(function () {
    var SIZES = [14, 15, 16, 17, 18, 19, 20];
    var KEY   = 'nag-fontsize';
    var saved = parseInt(localStorage.getItem(KEY), 10);
    var cur   = SIZES.indexOf(saved);
    if (cur < 0) cur = 2; /* default 16px */

    var content = document.querySelector('[data-pagefind-body]') || document.querySelector('main');
    if (!content) return;

    function applySize() {
      content.style.fontSize = SIZES[cur] + 'px';
      localStorage.setItem(KEY, SIZES[cur]);
      /* Синхронизируем btoc-fontsize-dot если он есть */
      var dots = document.querySelectorAll('.btoc-fontsize-dot');
      dots.forEach(function (d, i) {
        d.classList.toggle('btoc-fontsize-dot--active', i <= cur);
      });
    }

    var btnDown = document.querySelector('[data-fontsize="down"], .nag-fontsize-down');
    var btnUp   = document.querySelector('[data-fontsize="up"],   .nag-fontsize-up');

    if (btnDown) btnDown.addEventListener('click', function () {
      if (cur > 0) { cur--; applySize(); }
    });
    if (btnUp) btnUp.addEventListener('click', function () {
      if (cur < SIZES.length - 1) { cur++; applySize(); }
    });

    applySize();
  });

  /* ============================================================
     E. Nagornaya Footnote Tooltip System
     Перенесено из inline <script> × 5 — AGENTS-r38.
     Строит карту [N] → текст из блока «Источники» и показывает
     нативный tooltip-popup при hover/click на <sup>[N]</sup>.
     ============================================================ */
  ready(function () {
    /* 1. Строим карту сносок из блока Источники */
    var fnMap = {};
    var sourcesBlock = null;
    document.querySelectorAll('.bg-stone-100.rounded-2xl, .bg-stone-100.border-stone-300').forEach(function (el) {
      if (el.textContent.includes('Источники') || el.textContent.includes('библиограф')) {
        sourcesBlock = el;
      }
    });
    if (sourcesBlock) {
      sourcesBlock.querySelectorAll('.flex.items-start').forEach(function (row) {
        var supEl  = row.querySelector('sup');
        var textEl = row.querySelector('span.flex-1, span:last-child');
        if (supEl && textEl) {
          var key = supEl.textContent.trim();
          if (/^\[\d+\]$/.test(key)) fnMap[key] = textEl.textContent.trim();
        }
      });
    }
    if (!Object.keys(fnMap).length) return;

    /* 2. Создаём shared tooltip — стилизован через CSS переменные сайта */
    var popup = document.createElement('div');
    popup.id = 'nag-fn-popup';
    /* Используем CSS переменные (dark mode safe) */
    popup.style.cssText = [
      'display:none',
      'position:fixed',
      'z-index:var(--z-modal-low,9999)',
      'max-width:min(340px,calc(100vw - 20px))',
      'min-width:min(200px,calc(100vw - 20px))',
      'padding:10px 14px',
      'background:var(--color-surface,#fff)',
      'color:var(--color-text,#1a1a1a)',
      'font-size:12px',
      'line-height:1.65',
      'border-radius:10px',
      'box-shadow:0 6px 28px rgba(0,0,0,0.22)',
      'border:1px solid var(--color-border,#e5e2dc)',
      'font-family:var(--font-sans,"Source Sans 3",system-ui,sans-serif)',
      'pointer-events:none',
      'word-break:break-word',
      'transition:opacity .15s ease',
    ].join(';');
    document.body.appendChild(popup);

    function posPopup(rect) {
      popup.style.visibility = 'hidden';
      popup.style.display = 'block';
      var pw = popup.offsetWidth, ph = popup.offsetHeight;
      popup.style.visibility = '';
      var vw = window.innerWidth, vh = window.innerHeight;
      var left = rect.left + rect.width / 2 - pw / 2;
      left = Math.max(10, Math.min(left, vw - pw - 10));
      var top = rect.top - ph - 10;
      if (top < 10) top = rect.bottom + 10;
      if (top + ph > vh - 10) top = Math.max(10, vh - ph - 10);
      popup.style.left = left + 'px';
      popup.style.top  = top + 'px';
    }

    var cur = null;

    /* 3. Вешаем обработчики на <sup>[N]</sup> в тексте */
    document.querySelectorAll('main sup, .space-y-6 sup').forEach(function (sup) {
      if (sourcesBlock && sourcesBlock.contains(sup)) return;
      var key = sup.textContent.trim();
      if (!fnMap[key]) return;

      sup.style.cursor = 'pointer';
      sup.setAttribute('role', 'button');
      sup.setAttribute('aria-label', 'Сноска ' + key);
      sup.style.textDecoration = 'underline dotted';
      sup.style.textUnderlineOffset = '2px';

      sup.addEventListener('mouseenter', function () {
        popup.textContent = key + ' ' + fnMap[key];
        cur = sup;
        posPopup(sup.getBoundingClientRect());
      });
      sup.addEventListener('mouseleave', function () {
        popup.style.display = 'none'; cur = null;
      });
      sup.addEventListener('click', function (e) {
        e.stopPropagation();
        if (cur === sup && popup.style.display !== 'none') {
          popup.style.display = 'none'; cur = null; return;
        }
        popup.textContent = key + ' ' + fnMap[key];
        cur = sup;
        posPopup(sup.getBoundingClientRect());
      });
      sup.addEventListener('touchend', function (e) {
        e.preventDefault(); sup.click();
      }, { passive: false });
    });

    document.addEventListener('click', function () { popup.style.display = 'none'; cur = null; });
    window.addEventListener('scroll', function () { popup.style.display = 'none'; cur = null; }, { passive: true });
    window.addEventListener('resize', function () { popup.style.display = 'none'; cur = null; }, { passive: true });
  });

})(); /* end nagornaya-mobile-toc.js IIFE */
