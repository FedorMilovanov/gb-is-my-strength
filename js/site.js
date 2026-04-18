/* ============================================================
   site.js — Господь Бог — Сила Моя
   Единый общий JS для всего сайта
   Версия 1.1 (patch: date display, B shortcut, print btn, anchor toast)

   Структура:
   01. SiteUtils — helpers / config access
   02. Theme Toggle
   03. Share
   04. Reading Progress Bar (герменевтика style)
   05. Back To Top Button
   06. Section Label
   07. TOC Mobile (герменевтика slide panel style)
   08. TOC Desktop (scrollspy sidebar)
   09. Bottom App Bar + TOC Overlay (код да винчи style)
   10. Timeline Animation (Intersection Observer)
   11. Animate Boxes on Scroll
   12. Footnote Tooltips (fn-ref style — код да винчи)
   13. Flip Cards — toggle + keyboard
   14. Flip Card Fingers
   15. Flip Card Height Sync
   16. Quiz Engine
   17. Heading Anchor Copy
   18. Homepage Resume Reading Block (delegates to bookmark-engine)
   19. Footnote Markers (fn-marker / tooltip style)
   20. Typography — неразрывные пробелы вокруг тире (—, –)
   22. Keyboard Shortcuts   — T (TOC), D (тема), B (наверх)
   23. Selection Share      — выделил → поделиться
   24. Homepage Progress    — полоски прогресса на главной
   25. Keyboard Hint Toast  — тост при нажатии шорткатов
   26. Article Date Display — дата публикации/обновления из meta
   27. Article End Block    — кнопки «Поделиться» + «Распечатать/PDF» + SDG + крест
   28. Anchor Toast         — тост «Ссылка скопирована»

   Каждый модуль проверяет наличие нужных DOM-элементов
   и просто ничего не делает, если их нет.
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     01. SiteUtils — helpers / config access
     ============================================================ */
  var SiteUtils = {
    getConfig: function (path, fallback) {
      try {
        var cfg = window.SITE_CONFIG;
        if (!cfg) return fallback;
        var parts = path.split('.');
        var cur = cfg;
        for (var i = 0; i < parts.length; i++) {
          if (cur == null || typeof cur !== 'object') return fallback;
          cur = cur[parts[i]];
        }
        return cur !== undefined ? cur : fallback;
      } catch (e) {
        return fallback;
      }
    },

    clamp: function (val, min, max) {
      return Math.min(Math.max(val, min), max);
    },

    debounce: function (fn, delay) {
      var timer;
      return function () {
        clearTimeout(timer);
        var args = arguments;
        var ctx = this;
        timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
      };
    },

    throttle: function (fn, limit) {
      var last = 0;
      return function () {
        var now = Date.now();
        if (now - last >= limit) {
          last = now;
          fn.apply(this, arguments);
        }
      };
    }
  };

  window.SiteUtils = SiteUtils;


  /* ============================================================
     02. Theme Toggle
     Работает с #themeToggle и #barThemeBtn (если есть)
     ============================================================ */
  (function () {
    var toggle = document.getElementById('themeToggle');
    var html = document.documentElement;
    if (!toggle) return;

    function safeThemeGet() {
      try { return localStorage.getItem('theme'); } catch (e) { return null; }
    }
    function safeThemeSet(val) {
      try { localStorage.setItem('theme', val); } catch (e) {}
    }

    var saved = safeThemeGet();
    if (saved === 'dark') {
      /* user explicitly chose dark — respect it */
      html.classList.add('dark');
    } else {
      /* default: light (no saved pref or saved === 'light') */
    }

    function syncIcons() {
      var isDark = html.classList.contains('dark');
      var moon = toggle.querySelector('.icon-moon');
      var sun = toggle.querySelector('.icon-sun');
      if (moon) moon.style.opacity = isDark ? '0' : '1';
      if (sun) { sun.style.opacity = isDark ? '1' : '0'; sun.style.color = isDark ? '#f5c542' : ''; }
      toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      var barBtn = document.getElementById('barThemeBtn');
      if (barBtn) {
        var barMoon = barBtn.querySelector('.bar-icon-moon');
        var barSun  = barBtn.querySelector('.bar-icon-sun');
        if (barMoon) barMoon.style.display = isDark ? 'none' : 'block';
        if (barSun)  barSun.style.display  = isDark ? 'block' : 'none';
        barBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      }
    }

    function syncThemeColor(isDark) {
      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', isDark ? '#0e1116' : '#fdfcf9');
    }

    toggle.addEventListener('click', function () {
      var isDark = html.classList.toggle('dark');
      safeThemeSet(isDark ? 'dark' : 'light');
      syncIcons();
      syncThemeColor(isDark);
    });

    var barBtn = document.getElementById('barThemeBtn');
    if (barBtn) {
      barBtn.addEventListener('click', function () {
        var isDark = html.classList.toggle('dark');
        safeThemeSet(isDark ? 'dark' : 'light');
        syncIcons();
        syncThemeColor(isDark);
      });
    }

    /* Синхронизация темы между вкладками */
    window.addEventListener('storage', function (e) {
      if (e.key !== 'theme') return;
      var isDark = e.newValue !== 'light';
      html.classList.toggle('dark', isDark);
      syncIcons();
      syncThemeColor(isDark);
    });

    syncIcons();
  })();


  /* ============================================================
     03. Share Dialog
     Единый диалог для всех кнопок: #articleEndShareBtn, #barShareBtn,
     .btoc-share-btn, #btocShareBtn.
     Платформы: Telegram, VK, WhatsApp, Copy URL.
     Доступность: role=dialog, aria-modal, focus-trap, Esc.
     ============================================================ */
  (function () {
    var cfg = SiteUtils.getConfig('features.share', {});
    if (cfg.enabled === false) return;

    var shareTitle = cfg.title || document.title;
    var shareUrl   = window.location.href;
    var encoded      = encodeURIComponent(shareUrl);
    var encodedTitle = encodeURIComponent(shareTitle);

    /* ── Dialog HTML ── */
    var overlay = document.createElement('div');
    overlay.id = 'share-dialog-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    /*
      Сервисы для российской аудитории:
      1. Telegram  — tg://msg_url (откроет приложение)  / t.me/share (web fallback)
      2. ВКонтакте — vk.com/share.php
      3. Одноклассники — connect.ok.ru/dk?st.cmd=WidgetSharePreview
      4. WhatsApp  — wa.me / api.whatsapp.com
      5. Скопировать ссылку
    */
    overlay.innerHTML =
      '<div id="share-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-title" tabindex="-1">' +
        '<div class="sd-handle" aria-hidden="true"></div>' +
        '<div class="sd-header">' +
          '<span class="sd-title" id="sd-title">Поделиться</span>' +
          '<button class="sd-close" id="sd-close" aria-label="Закрыть">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="sd-grid">' +

          /* Telegram */
          '<button class="sd-btn sd-btn--tg" id="sd-tg" aria-label="Поделиться в Telegram">' +
            '<span class="sd-icon">' +
              '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20.665 3.717L2.931 10.702c-1.208.486-1.202 1.161-.222 1.462l4.541 1.418 10.524-6.641c.497-.3.951-.137.578.192L9.129 15.007l-.39 4.613c.567 0 .817-.26 1.132-.562l2.719-2.641 5.65 4.168c1.041.576 1.793.28 2.05-.966l3.717-17.501c.378-1.517-.58-2.203-1.342-1.401z"/></svg>' +
            '</span>' +
            '<span class="sd-label">Telegram</span>' +
          '</button>' +

          /* ВКонтакте */
          '<button class="sd-btn sd-btn--vk" id="sd-vk" aria-label="Поделиться ВКонтакте">' +
            '<span class="sd-icon">' +
              '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21.547 7h-3.29a.743.743 0 00-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.126 14 11.11V7.603A1.104 1.104 0 0012.896 6.5h-2.474a1.982 1.982 0 00-1.75.813s1.255-.204 1.255 1.49c0 .42.022 1.626.04 2.64L8.93 10.9a24.783 24.783 0 01-2.535-3.865A1.054 1.054 0 005.432 6.5H2.866a.62.62 0 00-.657.74s2.222 5.198 4.738 7.817c2.31 2.405 4.938 2.243 4.938 2.243h1.19a1.005 1.005 0 001.063-1.065v-.79s.04-3.138 1.446-3.6c1.386-.455 3.167 3.035 5.051 4.372a1.469 1.469 0 001.02.39l3.222-.045s1.688-.104.888-1.432c-.066-.108-.463-.977-2.382-2.767-2.005-1.87-1.736-1.568.679-4.81.147-.198 1.25-1.766.962-2.048A1.21 1.21 0 0021.547 7z"/></svg>' +
            '</span>' +
            '<span class="sd-label">ВКонтакте</span>' +
          '</button>' +

          /* Одноклассники */
          '<button class="sd-btn sd-btn--ok" id="sd-ok" aria-label="Поделиться в Одноклассниках">' +
            '<span class="sd-icon">' +
              /* ОК логотип — силуэт человечка */
              '<svg width="22" height="26" viewBox="0 0 22 26" fill="currentColor"><circle cx="11" cy="5.5" r="5.5"/><path d="M11 13c-5.523 0-10 2.686-10 6v1h3v-1c0-1.657 3.134-3 7-3s7 1.343 7 3v1h3v-1c0-3.314-4.477-6-10-6z"/></svg>' +
            '</span>' +
            '<span class="sd-label">ОК</span>' +
          '</button>' +

          /* WhatsApp */
          '<button class="sd-btn sd-btn--wa" id="sd-wa" aria-label="Поделиться в WhatsApp">' +
            '<span class="sd-icon">' +
              '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
            '</span>' +
            '<span class="sd-label">WhatsApp</span>' +
          '</button>' +

          /* Скопировать */
          '<button class="sd-btn sd-btn--copy" id="sd-copy" aria-label="Скопировать ссылку">' +
            '<span class="sd-icon">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
            '</span>' +
            '<span class="sd-label sd-copy-label">Скопировать</span>' +
          '</button>' +

        '</div>' +
        /* URL strip — без text-decoration, только span */
        '<div class="sd-url-row">' +
          '<span class="sd-url-text" id="sd-url-text"></span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    /* populate url text as text node (no underline artifacts) */
    var urlText = document.getElementById('sd-url-text');
    if (urlText) urlText.appendChild(document.createTextNode(shareUrl));

    var dialog   = document.getElementById('share-dialog');
    var closeBtn = document.getElementById('sd-close');
    var copyBtn  = document.getElementById('sd-copy');
    var triggerEl = null;

    /* ── Focus trap ── */
    var FOCUSABLE = 'a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])';
    function getFocusable() { return Array.from(dialog.querySelectorAll(FOCUSABLE)); }
    function trapTab(e) {
      if (e.key !== 'Tab') return;
      var els = getFocusable();
      if (!els.length) return;
      var first = els[0], last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }

    /* ── Open / Close ── */
    function openDialog(trigger) {
      triggerEl = trigger || null;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
      requestAnimationFrame(function () { dialog.focus(); });
      document.addEventListener('keydown', onKey);
    }
    function closeDialog() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', onKey);
      if (triggerEl && triggerEl.focus) triggerEl.focus();
      triggerEl = null;
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
      trapTab(e);
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDialog(); });
    closeBtn.addEventListener('click', closeDialog);

    /* ── Service links ── */
    /* Telegram: пытается открыть приложение через tg:// — если не установлено, fallback на web */
    document.getElementById('sd-tg').addEventListener('click', function () {
      var tgApp = 'tg://msg_url?url=' + encoded + '&text=' + encodedTitle;
      var tgWeb = 'https://t.me/share/url?url=' + encoded + '&text=' + encodedTitle;
      var opened = window.open(tgApp);
      /* если браузер не смог открыть схему — открываем web через 400ms */
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.open(tgWeb, '_blank', 'noopener');
      } else {
        setTimeout(function () {
          try { if (!opened.closed) window.open(tgWeb, '_blank', 'noopener'); } catch(e) {}
        }, 1500);
      }
    });
    document.getElementById('sd-vk').addEventListener('click', function () {
      window.open('https://vk.com/share.php?url=' + encoded + '&title=' + encodedTitle, '_blank', 'noopener');
    });
    document.getElementById('sd-ok').addEventListener('click', function () {
      window.open('https://connect.ok.ru/dk?st.cmd=WidgetSharePreview&st.shareUrl=' + encoded + '&title=' + encodedTitle, '_blank', 'noopener');
    });
    document.getElementById('sd-wa').addEventListener('click', function () {
      /* на мобильных открывает приложение, на десктопе — web.whatsapp.com */
      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      var waUrl = isMobile
        ? 'whatsapp://send?text=' + encodedTitle + '%20' + encoded
        : 'https://web.whatsapp.com/send?text=' + encodedTitle + '%20' + encoded;
      window.open(waUrl, '_blank', 'noopener');
    });

    /* ── Copy ── */
    function doCopy() {
      var label = copyBtn.querySelector('.sd-copy-label');
      var iconEl = copyBtn.querySelector('.sd-icon');
      ;(navigator.clipboard ? navigator.clipboard.writeText(shareUrl) : Promise.reject())
        .then(function () {
          if (label) label.textContent = 'Скопировано!';
          copyBtn.classList.add('copied');
          if (iconEl) iconEl.innerHTML =
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(function () {
            copyBtn.classList.remove('copied');
            if (label) label.textContent = 'Скопировать';
            if (iconEl) iconEl.innerHTML =
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
          }, 2500);
        })
        .catch(function () {
          var ta = document.createElement('textarea');
          ta.value = shareUrl;
          ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch(e) {}
          document.body.removeChild(ta);
          if (label) { label.textContent = 'Скопировано!'; setTimeout(function () { label.textContent = 'Скопировать'; }, 2500); }
        });
    }
    copyBtn.addEventListener('click', doCopy);

    /* ── Wire triggers ── */
    function wire(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () { openDialog(el); });
    }
    wire('barShareBtn');
    wire('btocShareBtn');
    document.querySelectorAll('.btoc-share-btn').forEach(function (el) {
      if (!el.id) el.addEventListener('click', function () { openDialog(el); });
    });

    window.SiteShare = { open: openDialog, close: closeDialog };
  })();


  /* ============================================================
     04. Reading Progress Bar (герменевтика style)
     #reading-progress  — тонкая полоса сверху
     ============================================================ */
  (function () {
    var bar = document.getElementById('reading-progress');
    if (!bar) return;

    var cfg = SiteUtils.getConfig('features.readingProgress', {});
    if (cfg.enabled === false) return;

    function update() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? SiteUtils.clamp((scrollTop / docH) * 100, 0, 100) : 0;
      bar.style.width = pct + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  })();


  /* ============================================================
     05. Back To Top Button
     #back-to-top
     ============================================================ */
  (function () {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;

    var cfg = SiteUtils.getConfig('features.backToTop', {});
    if (cfg.enabled === false) return;
    var showAfter = cfg.showAfter || 400;

    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > showAfter);
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();


  /* ============================================================
     06. Section Label
     ============================================================ */
  (function () {
    var label = document.getElementById('section-label');
    if (!label) return;

    var h2s = document.querySelectorAll('article h2');
    if (!h2s.length) return;

    function update() {
      var current = null;
      h2s.forEach(function (h) {
        if (h.getBoundingClientRect().top <= 80) current = h;
      });
      if (current && window.scrollY > 300) {
        label.textContent = current.textContent.replace(/\s*#\s*$/, '').trim();
        label.classList.add('visible');
      } else {
        label.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  })();


  /* ============================================================
     07. TOC Mobile — slide panel (герменевтика style)
     ============================================================ */
  (function () {
    var panel   = document.getElementById('toc-panel');
    var overlay = document.getElementById('toc-overlay');
    var toggle  = document.getElementById('toc-toggle');
    var closeBtn = document.getElementById('toc-close');
    var list    = document.getElementById('toc-list');
    if (!panel || !list || !toggle) return;

    var cfg = SiteUtils.getConfig('features.toc', {});
    if (cfg.enabled === false) return;

    var headings = document.querySelectorAll('article h2, article h3');
    if (!headings.length) return;

    headings.forEach(function (h) {
      if (!h.id) return;
      var li = document.createElement('li');
      var a  = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/\s*#\s*$/, '').trim();
      if (h.tagName === 'H3') a.classList.add('toc-h3');
      a.addEventListener('click', function () { closeToc(); });
      li.appendChild(a);
      list.appendChild(li);
    });

    window.addEventListener('scroll', function () {
      toggle.classList.toggle('visible', window.scrollY > 200);
    }, { passive: true });

    var _prevFocus = null;
    var _trapHandler = null;

    function openToc() {
      _prevFocus = document.activeElement;
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      if (overlay) { overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); }
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () {
        var focusable = panel.querySelectorAll('a, button, [tabindex="0"]');
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];
        if (first) first.focus();
        if (_trapHandler) panel.removeEventListener('keydown', _trapHandler);
        _trapHandler = function (e) {
          if (e.key !== 'Tab') return;
          if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); if (last) last.focus(); }
          } else {
            if (document.activeElement === last)  { e.preventDefault(); if (first) first.focus(); }
          }
        };
        panel.addEventListener('keydown', _trapHandler);
      });
    }
    function closeToc() {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
      document.body.style.overflow = '';
      if (_trapHandler) { panel.removeEventListener('keydown', _trapHandler); _trapHandler = null; }
      if (_prevFocus && _prevFocus.focus) { _prevFocus.focus(); _prevFocus = null; }
    }

    toggle.addEventListener('click', openToc);
    if (closeBtn) closeBtn.addEventListener('click', closeToc);
    if (overlay) overlay.addEventListener('click', closeToc);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeToc(); });

    var tocLinks = list.querySelectorAll('a');
    function updateActive() {
      var current = null;
      headings.forEach(function (h) {
        if (h.getBoundingClientRect().top <= 120) current = h;
      });
      tocLinks.forEach(function (a) {
        var isActive = !!(current && a.getAttribute('href') === '#' + current.id);
        a.classList.toggle('toc-active', isActive);
        if (isActive) { a.setAttribute('aria-current', 'location'); }
        else { a.removeAttribute('aria-current'); }
      });
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  })();


  /* ============================================================
     08. TOC Desktop — scrollspy sidebar
     ============================================================ */
  (function () {
    var sidebar = document.getElementById('tocSidebar');
    if (!sidebar) return;

    var cfg = SiteUtils.getConfig('features.toc', {});
    if (cfg.enabled === false || cfg.desktop === false) return;

    var nav = sidebar.querySelector('nav');
    if (!nav) return;

    var tocItems = SiteUtils.getConfig('toc.items', null);
    var links = [];

    if (tocItems && tocItems.length) {
      tocItems.forEach(function (item) {
        var el = document.getElementById(item.id);
        if (!el) return;
        var a = document.createElement('a');
        a.className = 'toc-link';
        a.href = '#' + item.id;
        a.textContent = item.label;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        nav.appendChild(a);
        links.push({ el: el, a: a });
      });
    } else {
      var selectors = SiteUtils.getConfig('selectors.headings', 'article h2[id]');
      document.querySelectorAll(selectors).forEach(function (el) {
        var a = document.createElement('a');
        a.className = 'toc-link';
        a.href = '#' + el.id;
        a.textContent = el.textContent.replace(/\s*#\s*$/, '').trim();
        a.addEventListener('click', function (e) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        nav.appendChild(a);
        links.push({ el: el, a: a });
      });
    }

    if (!links.length) return;

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var scrollMid = window.scrollY + window.innerHeight * 0.3;
        var active = links[0];
        links.forEach(function (item) {
          if (item.el.offsetTop <= scrollMid) active = item;
        });
        links.forEach(function (item) {
          var isActive = item === active;
          item.a.classList.toggle('active', isActive);
          if (isActive) { item.a.setAttribute('aria-current', 'location'); }
          else { item.a.removeAttribute('aria-current'); }
        });
        ticking = false;
      });
    }, { passive: true });
  })();


  /* ============================================================
     09. Bottom App Bar + TOC Overlay (код да винчи style)
     ============================================================ */
  (function () {
    var bar     = document.getElementById('bottomBar');
    var overlay = document.getElementById('btocOverlay');
    var panel   = document.getElementById('btocPanel');
    if (!bar || !overlay) return;

    var cfg = SiteUtils.getConfig('features.toc', {});
    if (cfg.enabled === false || cfg.mobile === false) return;

    var fillCircle   = document.getElementById('barProgressFill');
    var pctText      = document.getElementById('barProgressText');
    var sectionName  = document.getElementById('barSectionName');
    var sectionBtn   = document.getElementById('barSectionBtn');
    var upBtn        = document.getElementById('barUpBtn');
    var closeBtn     = document.getElementById('btocClose');
    var btocNav      = document.getElementById('btocNav');
    var btocFill     = document.getElementById('btocProgressFill');
    var btocPct      = document.getElementById('btocProgressPct');
    var btocSubtitle = document.getElementById('btocSubtitle');
    var btocTimeLeft = document.getElementById('btocTimeLeft');

    var CIRCUMFERENCE = 2 * Math.PI * 15.5;
    var totalReadingMin = SiteUtils.getConfig('page.readingTime', 10);

    var rawSections = SiteUtils.getConfig('toc.items', null);
    var tocItems = [];

    var selectors = SiteUtils.getConfig('selectors.headings', 'article h2[id]');

    if (rawSections && rawSections.length) {
      rawSections.forEach(function (s, i) {
        var el = document.getElementById(s.id);
        if (!el) return;
        var a = document.createElement('a');
        a.className = 'btoc-link';
        a.href = '#' + s.id;
        var num = document.createElement('span'); num.className = 'btoc-link-num'; num.textContent = String(i + 1).padStart(2, '0');
        var txt = document.createElement('span'); txt.className = 'btoc-link-text'; txt.textContent = s.label;
        a.appendChild(num); a.appendChild(txt);
        a.addEventListener('click', function (e) {
          e.preventDefault(); closeToc();
          setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        });
        if (btocNav) btocNav.appendChild(a);
        tocItems.push({ el: el, a: a, label: s.label });
      });
    } else {
      document.querySelectorAll(selectors).forEach(function (el, i) {
        var label = el.textContent.replace(/\s*#\s*$/, '').trim();
        var a = document.createElement('a');
        a.className = 'btoc-link';
        a.href = '#' + el.id;
        var num = document.createElement('span'); num.className = 'btoc-link-num'; num.textContent = String(i + 1).padStart(2, '0');
        var txt = document.createElement('span'); txt.className = 'btoc-link-text'; txt.textContent = label;
        a.appendChild(num); a.appendChild(txt);
        a.addEventListener('click', function (e) {
          e.preventDefault(); closeToc();
          setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        });
        if (btocNav) btocNav.appendChild(a);
        tocItems.push({ el: el, a: a, label: label });
      });
    }

    if (btocSubtitle && tocItems.length) btocSubtitle.textContent = tocItems.length + ' разделов';

    document.body.classList.add('has-bottom-bar');

    var barVisible = false;
    function updateBar() {
      var scrollY = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? SiteUtils.clamp(Math.round((scrollY / docH) * 100), 0, 100) : 0;

      if (scrollY > 200 && !barVisible) { bar.classList.add('visible'); barVisible = true; }
      else if (scrollY <= 200 && barVisible) { bar.classList.remove('visible'); barVisible = false; }

      var offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
      if (fillCircle) fillCircle.style.strokeDashoffset = offset;
      if (pctText) pctText.textContent = pct + '%';
      if (btocFill) btocFill.style.width = pct + '%';
      if (btocPct) btocPct.textContent = pct + '%';

      var minLeft = Math.max(1, Math.round(totalReadingMin * (1 - pct / 100)));
      if (btocTimeLeft) btocTimeLeft.textContent = pct >= 98 ? '✅ Прочитано!' : '📖 Осталось: ~' + minLeft + ' мин';

      var scrollMid = scrollY + window.innerHeight * 0.35;
      var active = tocItems[0];
      tocItems.forEach(function (item) { if (item.el.offsetTop <= scrollMid) active = item; });
      if (sectionName && active) sectionName.textContent = active.label;
      tocItems.forEach(function (item) { item.a.classList.toggle('active', item === active); });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { updateBar(); ticking = false; }); }
    }, { passive: true });
    updateBar();

    var _bPrevFocus = null;
    var _bTrapHandler = null;

    function openToc() {
      _bPrevFocus = document.activeElement;
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      var activeLink = btocNav && btocNav.querySelector('.btoc-link.active');
      if (activeLink) setTimeout(function () { activeLink.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
      requestAnimationFrame(function () {
        var focusable = panel ? panel.querySelectorAll('a, button, [tabindex="0"]') : [];
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];
        if (first) first.focus();
        if (panel) {
          if (_bTrapHandler) panel.removeEventListener('keydown', _bTrapHandler);
          _bTrapHandler = function (e) {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
              if (document.activeElement === first) { e.preventDefault(); if (last) last.focus(); }
            } else {
              if (document.activeElement === last)  { e.preventDefault(); if (first) first.focus(); }
            }
          };
          panel.addEventListener('keydown', _bTrapHandler);
        }
      });
    }
    function closeToc() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      if (panel && _bTrapHandler) { panel.removeEventListener('keydown', _bTrapHandler); _bTrapHandler = null; }
      if (_bPrevFocus && _bPrevFocus.focus) { _bPrevFocus.focus(); _bPrevFocus = null; }
    }

    if (sectionBtn) sectionBtn.addEventListener('click', openToc);
    if (closeBtn) closeBtn.addEventListener('click', closeToc);
    overlay.addEventListener('click', function (e) { if (!panel || !panel.contains(e.target)) closeToc(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeToc(); });

    if (upBtn) upBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    var touchStartY = 0;
    if (panel) {
      panel.addEventListener('touchstart', function (e) { touchStartY = e.touches[0].clientY; }, { passive: true });
      panel.addEventListener('touchmove', function (e) { if (e.touches[0].clientY - touchStartY > 80) closeToc(); }, { passive: true });
    }
  })();


  /* ============================================================
     10. Timeline Animation
     ============================================================ */
  (function () {
    var items = document.querySelectorAll('.timeline-anim li');
    if (!items.length) return;

    var cfg = SiteUtils.getConfig('features.timeline', {});
    if (cfg.enabled === false) return;

    var threshold = cfg.threshold || 0.15;

    if (!window.IntersectionObserver) {
      items.forEach(function (el) { el.classList.add('tl-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('tl-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: threshold });

    items.forEach(function (item, i) {
      item.style.transitionDelay = (i * 60) + 'ms';
      observer.observe(item);
    });
  })();


  /* ============================================================
     11. Animate Boxes on Scroll
     ============================================================ */
  (function () {
    var els = document.querySelectorAll('.quote-box, .warn-box, .info-box, .ehrman-block, .opusdei-note');
    if (!els.length) return;

    if (!window.IntersectionObserver) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    els.forEach(function (el) { observer.observe(el); });
  })();


  /* ============================================================
     12. Footnote Tooltips (fn-ref style — код да винчи)
     ============================================================ */
  (function () {
    var cfg = SiteUtils.getConfig('features.footnotes', {});
    if (cfg.enabled === false) return;

    var sources = {};
    document.querySelectorAll('.sources-list li').forEach(function (li) {
      var num = li.getAttribute('data-num');
      if (num) sources[num] = li.textContent.trim();
    });

    var activeTooltip = null;

    function positionTooltip(tip, anchor) {
      tip.style.display = 'block';
      var aRect = anchor.getBoundingClientRect();
      var tipW = tip.offsetWidth;
      var tipH = tip.offsetHeight;
      var margin = 8;
      var vp = { w: window.innerWidth, h: window.innerHeight };

      var left = aRect.left + aRect.width / 2 - tipW / 2;
      left = Math.max(margin, Math.min(left, vp.w - tipW - margin));

      var top = aRect.top - tipH - margin;
      if (top < margin) top = aRect.bottom + margin;

      tip.style.left = left + 'px';
      tip.style.top  = top  + 'px';
    }

    function hideActive() {
      if (activeTooltip) {
        activeTooltip.style.display = 'none';
        activeTooltip = null;
      }
    }

    document.querySelectorAll('sup a[href^="#src"]').forEach(function (a) {
      var id = a.getAttribute('href').replace('#src', '');
      var text = sources[id];
      if (!text) return;

      var wrapper = document.createElement('span');
      wrapper.className = 'fn-ref';
      wrapper.setAttribute('tabindex', '0');

      var tip = document.createElement('span');
      tip.className = 'fn-tooltip';
      tip.textContent = text;
      document.body.appendChild(tip);

      a.parentNode.insertBefore(wrapper, a);
      wrapper.appendChild(a);

      wrapper.addEventListener('mouseenter', function () {
        hideActive();
        positionTooltip(tip, wrapper);
        activeTooltip = tip;
      });
      wrapper.addEventListener('mouseleave', hideActive);

      wrapper.addEventListener('click', function (e) {
        if (tip.style.display === 'block') {
          hideActive();
        } else {
          e.stopPropagation();
          hideActive();
          positionTooltip(tip, wrapper);
          activeTooltip = tip;
        }
      });

      wrapper.addEventListener('focus', function () { positionTooltip(tip, wrapper); activeTooltip = tip; });
      wrapper.addEventListener('blur', hideActive);
    });

    document.addEventListener('click', hideActive);
  })();


  /* ============================================================
     13. Flip Cards — toggle + keyboard
     ============================================================ */
  (function () {
    var cfg = SiteUtils.getConfig('features.flipCards', {});
    if (cfg.enabled === false) return;

    document.querySelectorAll('.flip-card, .error-flip-card, .heart-flip-card').forEach(function (card) {
      card.addEventListener('click', function () { this.classList.toggle('flipped'); });

      if (cfg.keyboard !== false) {
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.classList.toggle('flipped');
          }
        });
      }
    });
  })();


  /* ============================================================
     14. Flip Card Fingers
     ============================================================ */
  (function () {
    var cfg = SiteUtils.getConfig('features.flipCards', {});
    if (cfg.enabled === false || cfg.fingers === false) return;

    document.querySelectorAll('.flip-card-front').forEach(function (front) {
      var oldHint = front.querySelector('.flip-hint');
      if (oldHint) oldHint.remove();
      var finger = document.createElement('div');
      finger.className = 'flip-finger';
      finger.innerHTML = '<span class="flip-finger-text">переверни</span><span class="flip-finger-icon">👆</span>';
      front.appendChild(finger);
    });

    document.querySelectorAll('.error-flip-front').forEach(function (front) {
      var oldHint = front.querySelector('.error-flip-hint');
      if (oldHint) oldHint.remove();
      var finger = document.createElement('div');
      finger.className = 'flip-finger';
      finger.innerHTML = '<span class="flip-finger-text">нажми</span><span class="flip-finger-icon">👆</span>';
      front.appendChild(finger);
    });

    /* Б6: heart flip cards */
    document.querySelectorAll('.heart-flip-front').forEach(function (front) {
      var oldHint = front.querySelector('.flip-hint');
      if (oldHint) oldHint.remove();
      var finger = document.createElement('div');
      finger.className = 'flip-finger';
      finger.innerHTML = '<span class="flip-finger-text">переверни</span><span class="flip-finger-icon">👆</span>';
      front.appendChild(finger);
    });

    document.querySelectorAll('.flip-card-back .flip-hint').forEach(function (h) { h.remove(); });
    document.querySelectorAll('.error-flip-back .error-flip-hint').forEach(function (h) { h.remove(); });
  })();


  /* ============================================================
     15. Flip Card Height Sync
     ============================================================ */
  (function () {
    function syncCardHeight(cardSel, innerSel, frontSel, backSel) {
      document.querySelectorAll(cardSel).forEach(function (card) {
        var inner = card.querySelector(innerSel);
        var front = card.querySelector(frontSel);
        var back  = card.querySelector(backSel);
        if (!inner || !front || !back) return;

        var prevCardMin = card.style.minHeight;
        var prevInnerMin = inner.style.minHeight;
        card.style.minHeight = '0px';
        inner.style.minHeight = '0px';

        var pF = { pos: front.style.position, inset: front.style.inset, h: front.style.height, v: front.style.visibility };
        var pB = { pos: back.style.position, inset: back.style.inset, h: back.style.height, v: back.style.visibility };

        front.style.position = 'relative'; front.style.inset = 'auto'; front.style.height = 'auto'; front.style.visibility = 'hidden';
        back.style.position = 'relative'; back.style.inset = 'auto'; back.style.height = 'auto'; back.style.visibility = 'hidden';

        var maxH = Math.max(front.offsetHeight, back.offsetHeight);

        front.style.position = pF.pos; front.style.inset = pF.inset; front.style.height = pF.h; front.style.visibility = pF.v;
        back.style.position = pB.pos; back.style.inset = pB.inset; back.style.height = pB.h; back.style.visibility = pB.v;

        if (maxH > 0) {
          card.style.minHeight = maxH + 'px';
          inner.style.minHeight = maxH + 'px';
        } else {
          card.style.minHeight = prevCardMin;
          inner.style.minHeight = prevInnerMin;
        }
      });
    }

    function syncAll() {
      syncCardHeight('.flip-card', '.flip-card-inner', '.flip-card-front', '.flip-card-back');
      syncCardHeight('.error-flip-card', '.error-flip-inner', '.error-flip-front', '.error-flip-back');
      /* Б5: heart flip cards too */
      syncCardHeight('.heart-flip-card', '.heart-flip-inner', '.heart-flip-front', '.heart-flip-back');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncAll);
    } else {
      syncAll();
    }
    window.addEventListener('load', syncAll);
    window.addEventListener('resize', syncAll);
  })();


  /* ============================================================
     16. Quiz Engine  [v2: fixes + keyboard + streak + count-up + scroll + timer]
     ============================================================ */
  (function () {
    var cfg = SiteUtils.getConfig('features.quiz', {});
    if (cfg.enabled === false) return;

    var wrapper = document.getElementById('quizWrapper');
    if (!wrapper) return;

    var questions      = SiteUtils.getConfig('quiz.questions', null);
    var bonusQuestions = SiteUtils.getConfig('quiz.bonusQuestions', null);
    var scores         = SiteUtils.getConfig('quiz.scores', null);
    var bonusScores    = SiteUtils.getConfig('quiz.bonusScores', null);

    if (!questions || !questions.length) return;

    /* ---- RNG helpers ---- */
    function hashString(str) {
      var hash = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) { hash ^= str.charCodeAt(i); hash = (hash * 0x01000193) >>> 0; }
      return hash >>> 0;
    }
    function mulberry32(seed) {
      var t = seed >>> 0;
      return function () {
        t += 0x6d2b79f5;
        var r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }
    function shuffleSeeded(arr, seed) {
      var a = arr.slice(), rng = mulberry32(seed);
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
      return a;
    }
    function getSessionSeed() {
      try { var buf = new Uint32Array(1); crypto.getRandomValues(buf); return buf[0]; } catch (e) { return Date.now() >>> 0; }
    }
    function prepareDeck(qs, attemptSeed, deckName) {
      var qOrder = shuffleSeeded(qs, hashString(deckName + ':' + attemptSeed));
      return qOrder.map(function (q) {
        var optSeed = hashString(q.q.slice(0, 20) + ':' + deckName + ':' + attemptSeed);
        var origOptions = q.options.slice();
        var shuffled = shuffleSeeded(origOptions, optSeed);
        var correctText = origOptions[q.answer];
        var newAnswer = shuffled.indexOf(correctText);
        return { q: q.q, options: shuffled, answer: newAnswer, ok: q.ok, err: q.err, focus: q.focus || null };
      });
    }

    var sessionSeed = getSessionSeed();
    var coreDeck  = prepareDeck(questions, sessionSeed, 'core');
    /* FIX4: bonusDeck always from bonusQuestions source, not stale deck */
    var bonusDeck = bonusQuestions ? prepareDeck(bonusQuestions, sessionSeed + 41, 'bonus') : null;

    /* ---- DOM refs ---- */
    var counter  = document.getElementById('quizCounter');
    var qText    = document.getElementById('quizQuestion');
    var qFocus   = document.getElementById('quizFocus');
    var opts     = document.getElementById('quizOptions');
    var feedback = document.getElementById('quizFeedback');
    var nextBtn  = document.getElementById('quizNext');
    var fill     = document.getElementById('quizFill');
    var body     = document.getElementById('quizBody');
    var scoreEl  = document.getElementById('quizScore');
    var restart  = document.getElementById('quizRestart');
    var share    = document.getElementById('quizShare');
    var bonusSection = document.getElementById('quizBonusSection');
    var bonusBtn     = document.getElementById('quizBonusStart');
    var bonusBody    = document.getElementById('quizBonusBody');
    var bonusScore   = document.getElementById('quizBonusScore');
    var quizOverlay  = document.getElementById('quizOverlay');
    var quizMain     = document.getElementById('quizMain');
    var quizLaunch   = document.getElementById('quizLaunch');

    if (!counter || !qText || !opts) return;

    var current = 0, score = 0, answered = false;
    var inBonus = false, bonusCurrent = 0, bonusScoreVal = 0, bonusAnswered = false;
    var activeDeck = coreDeck;
    /* v2: streak tracking */
    var streak = 0;

    var LETTERS = ['А', 'Б', 'В', 'Г'];
    /* v2: keyboard map: digits 1-4 and Cyrillic А Б В Г */
    var KEY_MAP = { '1': 0, '2': 1, '3': 2, '4': 3, 'а': 0, 'б': 1, 'в': 2, 'г': 3 };

    /* v2: optional timer */
    var timeLimit = SiteUtils.getConfig('features.quiz.timeLimit', 0); /* seconds, 0 = off */
    var timerInterval = null;
    var timerEl = null; /* injected below if needed */

    function clearTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

    function startTimer(onExpire) {
      clearTimer();
      if (!timeLimit || !timerEl) return;
      var left = timeLimit;
      timerEl.style.width = '100%';
      timerEl.style.transition = 'none';
      timerInterval = setInterval(function () {
        left--;
        var pct = Math.max(0, left / timeLimit * 100);
        timerEl.style.transition = 'width 1s linear';
        timerEl.style.width = pct + '%';
        if (left <= 0) { clearTimer(); onExpire(); }
      }, 1000);
    }

    /* v2: inject timer bar element if timeLimit configured */
    if (timeLimit > 0) {
      timerEl = document.createElement('div');
      timerEl.className = 'quiz-timer-bar';
      var timerTrack = document.createElement('div');
      timerTrack.className = 'quiz-timer-track';
      timerTrack.appendChild(timerEl);
      if (body) body.insertBefore(timerTrack, body.firstChild);
    }

    /* v2: streak badge element (injected once) */
    var streakBadge = document.createElement('div');
    streakBadge.className = 'quiz-streak-badge';
    streakBadge.style.display = 'none';
    if (body) body.appendChild(streakBadge);

    function updateStreakBadge() {
      if (streak >= 3) {
        streakBadge.textContent = '🔥 ' + streak + ' подряд!';
        streakBadge.style.display = 'block';
      } else {
        streakBadge.style.display = 'none';
      }
    }

    /* v2: count-up animation for score display (numeric only) */
    function animateCountNum(el, target, duration) {
      if (!el) return;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        el.textContent = Math.floor(progress * target);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    /* legacy count-up with label text (for quizScoreBadge) */
    function animateCount(el, target, total, duration) {
      if (!el) return;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        el.textContent = 'Результат: ' + Math.floor(progress * target) + ' из ' + total;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function render() {
      answered = false;
      clearTimer();
      var q = activeDeck[current];
      var total = activeDeck.length;
      counter.textContent = 'Вопрос ' + (current + 1) + ' из ' + total;
      /* FIX3: progress shows current+1 so bar fills as you answer */
      if (fill) fill.style.width = ((current + 1) / total * 100) + '%';
      qText.innerHTML = q.q;

      if (qFocus) {
        /* Б4: hide focus hint until wrong answer — don't spoil the clue */
        qFocus.style.display = 'none';
      }

      if (feedback) { feedback.textContent = ''; feedback.className = 'quiz-feedback'; }
      if (nextBtn) nextBtn.style.display = 'none';
      opts.innerHTML = '';
      opts.setAttribute('role', 'radiogroup');
      opts.setAttribute('aria-labelledby', 'quizQuestion');

      q.options.forEach(function (opt, i) {
        var btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.setAttribute('data-idx', i);
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', 'false');
        btn.innerHTML = '<span class="quiz-option-letter">' + (LETTERS[i] || (i + 1)) + '.</span> ' + opt;
        btn.addEventListener('click', function () { handleAnswer(i); });
        opts.appendChild(btn);
      });

      if (timeLimit > 0) {
        startTimer(function () {
          /* time expired — mark wrong, reveal answer */
          if (!answered) handleAnswer(-1);
        });
      }
    }

    function handleAnswer(idx) {
      if (answered) return;
      answered = true;
      clearTimer();
      var q = activeDeck[current];
      var allBtns = opts.querySelectorAll('.quiz-option');
      allBtns.forEach(function (b) { b.disabled = true; b.setAttribute('aria-checked', 'false'); });
      if (idx >= 0 && allBtns[idx]) allBtns[idx].setAttribute('aria-checked', 'true');

      if (idx === q.answer) {
        if (allBtns[idx]) allBtns[idx].classList.add('correct');
        if (feedback) { feedback.innerHTML = '✓ ' + q.ok; feedback.className = 'quiz-feedback ok'; }
        score++;
        streak++;
      } else {
        if (idx >= 0 && allBtns[idx]) {
          allBtns[idx].classList.add('wrong');
          allBtns[idx].classList.add('shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        if (feedback) { feedback.innerHTML = '✗ ' + q.err; feedback.className = 'quiz-feedback err'; }
        /* Б4 / УЛ3: show focus link only on wrong answer */
        if (qFocus && q.focus) {
          qFocus.innerHTML = '<a href="#' + q.focus + '" class="quiz-focus-link">↑ Перечитать этот раздел</a>';
          qFocus.style.display = 'block';
        }
        streak = 0;
      }

      updateStreakBadge();

      if (nextBtn) {
        nextBtn.textContent = current < activeDeck.length - 1 ? 'Следующий вопрос →' : 'Узнать результат →';
        nextBtn.style.display = 'inline-block';
      }

      /* v2: auto-scroll to feedback on mobile */
      if (feedback && window.innerWidth < 768) {
        setTimeout(function () { feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
      }
    }

    /* ---- keyboard: Enter/Space advance + 1-4/А-Г select ---- */
    document.addEventListener('keydown', function (e) {
      if (!wrapper || wrapper.style.display === 'none') return;
      var isAnswered = inBonus ? bonusAnswered : answered;

      /* advance */
      if ((e.key === 'Enter' || e.key === ' ') && isAnswered) {
        e.preventDefault();
        /* v2: route to correct next button */
        if (inBonus) {
          var bn = document.getElementById('quizBonusNext');
          if (bn && bn.style.display !== 'none') { bn.click(); return; }
        }
        if (nextBtn && nextBtn.style.display !== 'none') { nextBtn.click(); }
        return;
      }

      /* v2: select option by key */
      if (!isAnswered) {
        var key = e.key.toLowerCase();
        if (KEY_MAP.hasOwnProperty(key)) {
          e.preventDefault();
          var optBtns = inBonus
            ? (document.getElementById('quizBonusOptions') || { querySelectorAll: function () { return []; } }).querySelectorAll('.quiz-option')
            : opts.querySelectorAll('.quiz-option');
          var targetIdx = KEY_MAP[key];
          if (optBtns[targetIdx]) {
            if (inBonus) { handleBonusAnswer(targetIdx); }
            else { handleAnswer(targetIdx); }
          }
        }
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', function () {
      if (inBonus) {
        bonusCurrent++;
        if (bonusCurrent < bonusDeck.length) { renderBonus(); } else { showBonusScore(); }
      } else {
        current++;
        if (current < activeDeck.length) { render(); } else { showScore(); }
      }
    });

    /* Б11: scores[] MUST be sorted descending by .min (e.g. 9,7,5,3,0) */
    function getScoreBucket(sc, total, scoresArr) {
      if (!scoresArr) {
        var pct = sc / total;
        return pct >= 0.9 ? 0 : pct >= 0.7 ? 1 : pct >= 0.5 ? 2 : pct >= 0.3 ? 3 : 4;
      }
      for (var i = 0; i < scoresArr.length; i++) { if (sc >= (scoresArr[i].min || 0)) return i; }
      return scoresArr.length - 1;
    }

    function showScore() {
      if (fill) fill.style.width = '100%';
      if (body) body.style.display = 'none';
      streakBadge.style.display = 'none';

      var idx = getScoreBucket(score, questions.length, scores);
      var s = scores ? scores[idx] : null;

      /* ── New result screen ── */
      var resultEl = document.getElementById('quizResult');
      if (resultEl) {
        resultEl.style.display = 'block';
        var rscore = document.getElementById('quizResultScore');
        var rtotal = document.getElementById('quizResultTotal');
        var rlabel = document.getElementById('quizResultLabel');
        var rbar   = document.getElementById('quizResultBar');
        var rdesc  = document.getElementById('quizScoreDesc');
        if (rtotal) rtotal.textContent = questions.length;
      /* count-up animation (numeric only — "7" not "Результат: 7 из 10") */
      animateCountNum(rscore, score, 700);
        /* label */
        var pct = score / questions.length;
        var label = pct >= .9 ? '🏆 Отлично!' : pct >= .7 ? '👍 Хорошо' : pct >= .5 ? '📖 Неплохо' : '🔁 Попробуйте снова';
        if (rlabel) rlabel.textContent = (s && s.title) ? (s.badge || '') + ' ' + s.title : label;
        /* animated bar */
        if (rbar) setTimeout(function () { rbar.style.width = Math.round(pct * 100) + '%'; }, 80);
        if (rdesc && s) rdesc.innerHTML = s.desc || '';
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /* ── Legacy score el (bonus round uses quizScoreBadge) ── */
      if (scoreEl) scoreEl.style.display = 'block';
      var titleEl = document.getElementById('quizScoreTitle');
      var badgeEl = document.getElementById('quizScoreBadge');
      if (titleEl) titleEl.textContent = '';
      animateCount(badgeEl, score, questions.length, 800);

      var bonusEnabled = SiteUtils.getConfig('features.quiz.bonusEnabled', false);
      if (bonusEnabled && bonusDeck && bonusSection) {
        var lockEl = document.getElementById('quizBonusLock');
        if (score === questions.length) {
          bonusSection.style.display = 'block';
          bonusSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          if (lockEl) lockEl.style.display = 'none';
        } else {
          if (lockEl) {
            lockEl.textContent = 'Ответьте правильно на все ' + questions.length + ' вопросов, чтобы разблокировать бонусный раунд.';
            lockEl.style.display = 'block';
          }
        }
      }

      var pctFinal = score / questions.length;
      if (pctFinal >= 0.9) { launchConfetti('gold'); }
      else if (pctFinal >= 0.7) { launchConfetti('blue'); }
      else if (pctFinal >= 0.5) { launchConfetti('light'); }

      /* УЛ #2: best score persistence */
      try {
        var slug = SiteUtils.getConfig('page.id', 'default');
        var BEST_KEY = 'quiz-best-' + slug;
        var prevBest = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
        if (score > prevBest) {
          localStorage.setItem(BEST_KEY, String(score));
        } else if (prevBest > 0 && rdesc) {
          var hint = document.createElement('div');
          hint.className = 'quiz-best-hint';
          hint.style.cssText = 'margin-top:14px;font-size:14px;color:var(--muted);font-style:italic';
          hint.textContent = 'Ваш лучший результат: ' + prevBest + ' из ' + questions.length;
          rdesc.appendChild(hint);
        }
      } catch (e) {}
    }

    if (bonusBtn && bonusDeck) {
      bonusBtn.addEventListener('click', function () {
        bonusBtn.style.display = 'none';
        var lockEl = document.getElementById('quizBonusUnlock');
        if (lockEl) lockEl.style.display = 'none';
        if (bonusBody) bonusBody.style.display = 'block';
        startBonusRound();
      });
    }

    function startBonusRound() {
      bonusCurrent = 0; bonusScoreVal = 0; bonusAnswered = false;
      activeDeck = bonusDeck;
      inBonus = true;
      renderBonus();
    }

    function renderBonus() {
      bonusAnswered = false;
      var q = bonusDeck[bonusCurrent];
      var total = bonusDeck.length;

      var bc   = document.getElementById('quizBonusCounter');
      var bq   = document.getElementById('quizBonusQuestion');
      var bf   = document.getElementById('quizBonusFocus');
      var bo   = document.getElementById('quizBonusOptions');
      var bfb  = document.getElementById('quizBonusFeedback');
      var bn   = document.getElementById('quizBonusNext');
      var bfill= document.getElementById('quizBonusFill');

      if (bc) bc.textContent = 'Вопрос ' + (bonusCurrent + 1) + ' из ' + total;
      /* FIX3 bonus: progress bar reflects current+1 */
      if (bfill) bfill.style.width = ((bonusCurrent + 1) / total * 100) + '%';
      if (bq) bq.innerHTML = q.q;
      if (bf) {
        /* Б9: hide bonus focus hint until wrong answer */
        bf.style.display = 'none';
      }
      if (bfb) { bfb.textContent = ''; bfb.className = 'quiz-feedback'; }
      /* FIX1: hide ONLY quizBonusNext, never touch main nextBtn */
      if (bn) bn.style.display = 'none';
      if (bo) {
        bo.innerHTML = '';
        bo.setAttribute('role', 'radiogroup');
        bo.setAttribute('aria-labelledby', 'quizBonusQuestion');
        q.options.forEach(function (opt, i) {
          var btn = document.createElement('button');
          btn.className = 'quiz-option';
          btn.setAttribute('data-idx', i);
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', 'false');
          btn.innerHTML = '<span class="quiz-option-letter">' + (LETTERS[i] || (i + 1)) + '.</span> ' + opt;
          btn.addEventListener('click', (function (idx) { return function () { handleBonusAnswer(idx); }; })(i));
          bo.appendChild(btn);
        });
      }
    }

    function handleBonusAnswer(idx) {
      if (bonusAnswered) return;
      bonusAnswered = true;
      var q    = bonusDeck[bonusCurrent];
      var bo   = document.getElementById('quizBonusOptions');
      var bfb  = document.getElementById('quizBonusFeedback');
      /* FIX1: use quizBonusNext — never touch main nextBtn */
      var bn   = document.getElementById('quizBonusNext');
      if (!bo) return;
      var allBtns = bo.querySelectorAll('.quiz-option');
      allBtns.forEach(function (b) { b.disabled = true; b.setAttribute('aria-checked', 'false'); });
      if (idx >= 0 && allBtns[idx]) allBtns[idx].setAttribute('aria-checked', 'true');

      if (idx === q.answer) {
        if (allBtns[idx]) allBtns[idx].classList.add('correct');
        if (bfb) { bfb.innerHTML = '✓ ' + q.ok; bfb.className = 'quiz-feedback ok'; }
        bonusScoreVal++;
      } else {
        if (idx >= 0 && allBtns[idx]) {
          allBtns[idx].classList.add('wrong');
          allBtns[idx].classList.add('shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        if (bfb) { bfb.innerHTML = '✗ ' + q.err; bfb.className = 'quiz-feedback err'; }
        /* Б9 / УЛ3: show bonus focus link only on wrong answer */
        var bf2 = document.getElementById('quizBonusFocus');
        if (bf2 && q.focus) {
          bf2.innerHTML = '<a href="#' + q.focus + '" class="quiz-focus-link">↑ Перечитать этот раздел</a>';
          bf2.style.display = 'block';
        }
      }

      /* FIX1: show quizBonusNext; main nextBtn untouched */
      if (bn) {
        bn.textContent = bonusCurrent < bonusDeck.length - 1 ? 'Следующий вопрос →' : 'Финальный результат →';
        bn.style.display = 'inline-block';
      }

      /* v2: auto-scroll on mobile */
      if (bfb && window.innerWidth < 768) {
        setTimeout(function () { bfb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
      }
    }

    /* wire up quizBonusNext */
    (function () {
      var bn = document.getElementById('quizBonusNext');
      if (!bn) return;
      bn.addEventListener('click', function () {
        bonusCurrent++;
        if (bonusCurrent < bonusDeck.length) { renderBonus(); } else { showBonusScore(); }
      });
  /* ============================================================
     Auto Drop Cap — first <p> in every article gets .drop-cap
     (universal rule, matches КДВ etalon)
     ============================================================ */
  (function () {
    var pageType = SiteUtils.getConfig('page.type', '');
    if (pageType !== 'article') return;

    var article = document.querySelector('article');
    if (!article) return;

    /* Already has a drop-cap? Skip. */
    if (article.querySelector('.drop-cap')) return;

    /* Find first <p> that is a direct child or inside .article-body */
    var body = article.querySelector('.article-body') || article;
    var firstP = body.querySelector('p');
    if (firstP && firstP.textContent.trim().length > 40) {
      firstP.classList.add('drop-cap');
    }
  })();


})();

    function showBonusScore() {
      if (bonusBody) bonusBody.style.display = 'none';
      if (bonusScore) bonusScore.style.display = 'block';

      var bfill = document.getElementById('quizBonusFill');
      if (bfill) bfill.style.width = '100%';

      var idx = getScoreBucket(bonusScoreVal, bonusDeck.length, bonusScores);
      var s = bonusScores ? bonusScores[idx] : { title: bonusScoreVal + '/' + bonusDeck.length, badge: '👑', desc: '' };

      var tEl = document.getElementById('quizBonusScoreTitle');
      var bEl = document.getElementById('quizBonusScoreBadge');
      var dEl = document.getElementById('quizBonusScoreDesc');
      if (tEl) tEl.textContent = (s.badge || '') + ' ' + (s.title || '');
      if (dEl) dEl.innerHTML = s.desc || '';
      /* v2: count-up on bonus score (label text) */
      if (bEl) {
        var bTarget = bonusScoreVal;
        var bTotal  = bonusDeck.length;
        var bStart  = null;
        requestAnimationFrame(function step(ts) {
          if (!bStart) bStart = ts;
          var p = Math.min((ts - bStart) / 800, 1);
          bEl.textContent = Math.floor(p * bTarget) + ' из ' + bTotal;
          if (p < 1) requestAnimationFrame(step);
        });
      }

      if (bonusScoreVal === bonusDeck.length) { launchConfetti('gold'); }
      else if (bonusScoreVal >= bonusDeck.length - 1) { launchConfetti('blue'); }
    }

    function launchConfetti(mode) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
      document.body.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      var palettes = {
        gold:  ['#FFD700','#FFA500','#FF6B35','#FFE44D','#FFFFFF'],
        blue:  ['#4A90E2','#7B61FF','#50C8FF','#B8E0FF','#FFFFFF'],
        light: ['#A8D8A8','#C8E6C9','#81C784','#E8F5E9','#FFFFFF']
      };
      var colors = palettes[mode] || palettes.light;
      var particles = [];
      var count = mode === 'gold' ? 180 : mode === 'blue' ? 130 : 80;
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width, y: -10 - Math.random() * 200,
          w: 6 + Math.random() * 10, h: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 5,
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.2, alpha: 1
        });
      }
      var start = null;
      var duration = mode === 'gold' ? 4000 : mode === 'blue' ? 3500 : 2500;
      function frame(ts) {
        if (!start) start = ts;
        var elapsed = ts - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(function (p) {
          p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.08;
          if (elapsed > duration * 0.6) p.alpha = Math.max(0, p.alpha - 0.02);
          ctx.save(); ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (elapsed < duration) { requestAnimationFrame(frame); }
        else { canvas.parentNode && canvas.parentNode.removeChild(canvas); }
      }
      requestAnimationFrame(frame);
    }

    if (restart) restart.addEventListener('click', function () {
      current = 0; score = 0; streak = 0; answered = false;
      inBonus = false;
      clearTimer();
      sessionSeed = getSessionSeed();
      coreDeck  = prepareDeck(questions, sessionSeed, 'core');
      /* FIX4: always re-prepare bonusDeck from bonusQuestions source */
      bonusDeck = bonusQuestions ? prepareDeck(bonusQuestions, sessionSeed + 41, 'bonus') : null;
      activeDeck = coreDeck;
      if (bonusSection) bonusSection.style.display = 'none';
      if (bonusBody) bonusBody.style.display = 'none';
      if (bonusScore) bonusScore.style.display = 'none';
      if (body) body.style.display = 'block';
      if (scoreEl) scoreEl.style.display = 'none';
      var resultEl = document.getElementById('quizResult');
      if (resultEl) resultEl.style.display = 'none';
      streakBadge.style.display = 'none';
      render();
    });

    if (share && SiteUtils.getConfig('features.quiz.shareResults', true)) {
      share.addEventListener('click', function () {
        /* Б7: share quiz score, not just the page */
        var scoreText = score + ' из ' + questions.length;
        var idx = getScoreBucket(score, questions.length, scores);
        var s = scores ? scores[idx] : null;
        var title = (s && s.title) ? s.title : scoreText;
        var shareMsg = 'Мой результат: ' + scoreText + ' — «' + title + '»';
        if (window.SiteShare) {
          /* Temporarily patch share title/URL text */
          var sdTitle = document.getElementById('sd-title');
          var origTitle = sdTitle ? sdTitle.textContent : '';
          if (sdTitle) sdTitle.textContent = shareMsg;
          window.SiteShare.open(share);
          /* Restore after a tick so dialog shows updated title */
          if (sdTitle) setTimeout(function () { sdTitle.textContent = origTitle; }, 100);
        }
      });
    }

    function startQuiz() {
      render();
      if (quizMain) quizMain.classList.remove('quiz-main--hidden');
      if (quizOverlay) {
        quizOverlay.classList.add('fade-out');
        quizOverlay.addEventListener('animationend', function () { quizOverlay.style.display = 'none'; }, { once: true });
      }
    }

    if (quizLaunch) { quizLaunch.addEventListener('click', startQuiz); } else { startQuiz(); }
  })();


  /* ============================================================
     17. Heading Anchor Copy
     .heading-anchor — улучшенный тост «Ссылка скопирована»
     (module 28 merged here)
     ============================================================ */
  (function () {
    var cfg = SiteUtils.getConfig('features.headingAnchors', {});
    if (cfg.enabled === false) return;

    var anchorSVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M13.5 6.5L7 13a3.536 3.536 0 0 1-5-5l7-7a2.121 2.121 0 0 1 3 3L5.5 10.5a.707.707 0 0 1-1-1L11 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    /* Автогенерация якорей для всех h2[id], если их нет в HTML */
    document.querySelectorAll('h2[id], h3[id], h4[id]').forEach(function (h) {
      if (h.querySelector('.heading-anchor')) return;
      var id = h.getAttribute('id');
      if (!id) return;
      var a = document.createElement('a');
      a.className = 'heading-anchor';
      a.setAttribute('href', '#' + id);
      a.setAttribute('aria-label', 'Скопировать ссылку на раздел');
      a.textContent = '#';
      h.appendChild(a);
    });

    /* Инициализируем иконку во всех якорных ссылках */
    document.querySelectorAll('.heading-anchor').forEach(function (a) {
      a.innerHTML = anchorSVG;
      a.setAttribute('aria-label', 'Скопировать ссылку на раздел');
    });

    /* Создаём один переиспользуемый тост */
    var toast = document.createElement('div');
    toast.id = 'anchor-copy-toast';
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.style.cssText = [
      'position:fixed',
      'bottom:32px',
      'left:50%',
      'transform:translateX(-50%) translateY(12px)',
      'background:var(--tooltip-bg,#2a2a2a)',
      'color:var(--tooltip-text,#fff)',
      'font-family:"Source Sans 3",system-ui,sans-serif',
      'font-size:13px',
      'font-weight:600',
      'padding:8px 18px',
      'border-radius:20px',
      'white-space:nowrap',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity .2s ease,transform .2s ease',
      'z-index:19999',
      'display:flex',
      'align-items:center',
      'gap:6px'
    ].join(';');
    toast.innerHTML = '<span>🔗</span><span>Ссылка на раздел скопирована</span>';
    document.body.appendChild(toast);

    var toastTimer = null;
    function showAnchorToast() {
      clearTimeout(toastTimer);
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
      toastTimer = setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(12px)';
      }, 2000);
    }

    document.querySelectorAll('.heading-anchor').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var id = a.getAttribute('href').slice(1);
        var url = location.origin + location.pathname + '#' + id;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            a.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            a.classList.add('copied');
            showAnchorToast();
            setTimeout(function () { a.innerHTML = anchorSVG; a.classList.remove('copied'); }, 1800);
          }).catch(function () {
            /* fallback без скролла: просто обновляем хэш без прыжка */
            history.replaceState(null, '', '#' + id);
          });
        } else {
          history.replaceState(null, '', '#' + id);
        }
      });
    });
  })();


  /* ============================================================
     18. Hover bridge for tooltip (desktop)
     ============================================================ */
  (function () {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var style = document.createElement('style');
    style.textContent =
      '.fn-marker .tooltip{ padding-top: 20px; margin-top: -12px; }' +
      '.fn-marker .tooltip:hover{ opacity: 1 !important; pointer-events: auto !important; }';
    document.head.appendChild(style);
  })();


  /* ============================================================
     19. Bible Reference Tooltips (bref / btip — герменевтика)
     ============================================================ */
  (function () {
    var dataEl = document.getElementById('bibleRefs');
    if (!dataEl) return;

    var refs = {};
    try {
      refs = JSON.parse(dataEl.textContent.trim() || '{}');
    } catch (e) {
      console.error('Bible JSON error:', e);
      refs = {};
    }

    var links = document.querySelectorAll('.bref[data-ref]');
    var openBible = null;
    var justOpenedBible = false;

    function closeBible() {
      if (justOpenedBible) return;
      if (openBible) {
        var tip = openBible.querySelector('.btip');
        openBible.classList.remove('is-open');
        openBible = null;
        if (tip) {
          setTimeout(function () {
            tip.style.maxHeight = '';
            tip.style.overflowY = '';
            tip.style.visibility = '';
            tip.style.top = '-9999px';
            tip.style.left = '-9999px';
          }, 200);
        }
      }
    }

    function openBibleTip(a) {
      closeBible();
      a.classList.add('is-open');
      openBible = a;
      positionTip(a);
      justOpenedBible = true;
      setTimeout(function () { justOpenedBible = false; }, 350);
    }

    function positionTip(a) {
      var tip = a.querySelector('.btip');
      if (!tip) return;

      tip.style.visibility = 'hidden';
      tip.style.left = '0px';
      tip.style.top = '0px';

      var aRect = a.getBoundingClientRect();
      var tipW = tip.offsetWidth;
      var tipH = tip.offsetHeight;
      var margin = 16;
      var vw = window.innerWidth;
      var vh = window.innerHeight;

      var left = aRect.left + aRect.width / 2 - tipW / 2;
      if (left + tipW > vw - margin) left = vw - margin - tipW;
      if (left < margin) left = margin;

      var top = aRect.top - tipH - 8;
      if (top >= margin) {
        tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.style.visibility = ''; return;
      }
      top = aRect.bottom + 8;
      if (top + tipH <= vh - margin) {
        tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.style.visibility = ''; return;
      }
      var availTop = aRect.top - margin - 8;
      var availBottom = vh - margin - aRect.bottom - 8;
      if (availTop >= availBottom) {
        tip.style.maxHeight = availTop + 'px'; tip.style.overflowY = 'auto';
        tip.style.left = left + 'px'; tip.style.top = margin + 'px';
      } else {
        tip.style.maxHeight = availBottom + 'px'; tip.style.overflowY = 'auto';
        tip.style.left = left + 'px'; tip.style.top = (aRect.bottom + 8) + 'px';
      }
      tip.style.visibility = '';
    }

    links.forEach(function (a) {
      var key = a.getAttribute('data-ref');
      var text = refs[key];
      if (!text) return;

      if (!a.querySelector('.btip')) {
        var tip = document.createElement('span');
        tip.className = 'btip';
        tip.innerHTML = '<div>' + text + '</div>';
        a.appendChild(tip);
      }

      a.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          positionTip(a); a.classList.add('is-open'); openBible = a;
        }
      });
      a.addEventListener('mouseleave', function () {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        var tip = a.querySelector('.btip');
        if (tip && tip.matches(':hover')) return;
        if (tip && tip.style.overflowY === 'auto') return;
        closeBible();
      });

      var touchMoved = false;
      a.addEventListener('touchstart', function () { touchMoved = false; }, { passive: true });
      a.addEventListener('touchmove', function () { touchMoved = true; }, { passive: true });
      a.addEventListener('touchend', function (e) {
        if (touchMoved) return;
        e.preventDefault();
        if (openBible === a) { justOpenedBible = false; closeBible(); }
        else { openBibleTip(a); }
      }, { passive: false });

      a.addEventListener('click', function (e) {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) { e.preventDefault(); return; }
        e.preventDefault(); e.stopPropagation();
        if (openBible === a) { closeBible(); return; }
        openBibleTip(a);
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.bref') && !e.target.closest('.btip')) closeBible();
    });

    window.addEventListener('scroll', function () { closeBible(); }, { passive: true });
    window.addEventListener('wheel', function (e) { if (!e.target.closest('.btip')) closeBible(); }, { passive: true });
    window.addEventListener('resize', closeBible, { passive: true });
    window.addEventListener('orientationchange', closeBible, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBible(); });
    /* Закрывать tooltip при скролле внутри scrollable-контейнеров (TOC overlay) */
    document.querySelectorAll('.btoc-nav, .btoc-panel, #toc-panel').forEach(function (el) {
      el.addEventListener('scroll', closeBible, { passive: true });
    });
  })();


  /* ============================================================
     20. Academic Footnotes (fn-marker / tooltip — герменевтика)
     ============================================================ */
  (function () {
    var markers = document.querySelectorAll('.fn-marker');
    if (!markers.length) return;

    var activeMarker = null;
    var justOpenedFn = false;

    markers.forEach(function (m) {
      var prev = m.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        prev.textContent = prev.textContent.replace(/\s+$/, '');
      }
    });

    function closeFootnotes() {
      if (justOpenedFn) return;
      if (activeMarker) {
        var tooltip = activeMarker.querySelector('.tooltip');
        activeMarker.classList.remove('is-open');
        activeMarker = null;
        if (tooltip) {
          setTimeout(function () {
            tooltip.style.maxHeight = '';
            tooltip.style.overflowY = '';
            tooltip.style.visibility = '';
            tooltip.style.top = '-9999px';
            tooltip.style.left = '-9999px';
          }, 200);
        }
      }
    }

    function openFootnoteTip(marker) {
      closeFootnotes();
      marker.classList.add('is-open');
      activeMarker = marker;
      positionTooltip(marker);
      justOpenedFn = true;
      setTimeout(function () { justOpenedFn = false; }, 350);
    }

    function positionTooltip(marker) {
      var tt = marker.querySelector('.tooltip');
      if (!tt) return;

      tt.style.visibility = 'hidden';
      tt.style.left = '0px';
      tt.style.top = '0px';

      var mRect = marker.getBoundingClientRect();
      var ttW = tt.offsetWidth;
      var ttH = tt.offsetHeight;
      var margin = 16;
      var vw = window.innerWidth;
      var vh = window.innerHeight;

      var left = mRect.left + mRect.width / 2 - ttW / 2;
      if (left + ttW > vw - margin) left = vw - margin - ttW;
      if (left < margin) left = margin;

      var top = mRect.top - ttH - 8;
      if (top >= margin) {
        tt.style.left = left + 'px'; tt.style.top = top + 'px'; tt.style.visibility = ''; return;
      }
      top = mRect.bottom + 8;
      if (top + ttH <= vh - margin) {
        tt.style.left = left + 'px'; tt.style.top = top + 'px'; tt.style.visibility = ''; return;
      }
      var availTop = mRect.top - margin - 8;
      var availBottom = vh - margin - mRect.bottom - 8;
      if (availTop >= availBottom) {
        tt.style.maxHeight = availTop + 'px'; tt.style.overflowY = 'auto';
        tt.style.left = left + 'px'; tt.style.top = margin + 'px';
      } else {
        tt.style.maxHeight = availBottom + 'px'; tt.style.overflowY = 'auto';
        tt.style.left = left + 'px'; tt.style.top = (mRect.bottom + 8) + 'px';
      }
      tt.style.visibility = '';
    }

    markers.forEach(function (marker) {
      var fnTouchMoved = false;
      marker.addEventListener('touchstart', function () { fnTouchMoved = false; }, { passive: true });
      marker.addEventListener('touchmove', function () { fnTouchMoved = true; }, { passive: true });
      marker.addEventListener('touchend', function (e) {
        if (fnTouchMoved) return;
        e.preventDefault();
        if (activeMarker === marker) { justOpenedFn = false; closeFootnotes(); }
        else { openFootnoteTip(marker); }
      }, { passive: false });

      marker.addEventListener('click', function (e) {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) { e.preventDefault(); return; }
        e.preventDefault(); e.stopPropagation();
        if (activeMarker === marker) { closeFootnotes(); return; }
        openFootnoteTip(marker);
      });

      marker.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          positionTooltip(marker); marker.classList.add('is-open'); activeMarker = marker;
        }
      });
      marker.addEventListener('mouseleave', function () {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        var tt = marker.querySelector('.tooltip');
        if (tt && tt.matches(':hover')) return;
        if (tt && tt.style.overflowY === 'auto') return;
        closeFootnotes();
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.fn-marker') && !e.target.closest('.tooltip')) closeFootnotes();
    });

    window.addEventListener('scroll', function () { closeFootnotes(); }, { passive: true });
    window.addEventListener('wheel', function (e) { if (!e.target.closest('.tooltip')) closeFootnotes(); }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!e.target.closest('.tooltip')) closeFootnotes();
    }, { passive: true });
    window.addEventListener('resize', closeFootnotes, { passive: true });
    window.addEventListener('orientationchange', closeFootnotes, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeFootnotes(); });
  })();


  /* ============================================================
     21. Typography — неразрывные пробелы вокруг тире
     ============================================================ */
  (function () {
    var SELECTORS   = '.article-body, article';
    var EM_RE       = / (—) /g;
    var EN_RE       = / (–) /g;
    var NARROW_NBSP = '\u202F';
    var NBSP        = '\u00A0';
    var SKIP_TAGS   = { CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1 };

    function fixNode(node) {
      var p = node.parentElement;
      if (!p || SKIP_TAGS[p.tagName]) return;
      var t = node.nodeValue;
      if (!t || (t.indexOf('—') === -1 && t.indexOf('–') === -1)) return;
      node.nodeValue = t
        .replace(EM_RE, NARROW_NBSP + '$1' + NBSP)
        .replace(EN_RE, NARROW_NBSP + '$1' + NBSP);
    }

    function walkTree(root) {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      var n;
      while ((n = w.nextNode())) fixNode(n);
    }

    function init() {
      document.querySelectorAll(SELECTORS).forEach(walkTree);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();


  /* ============================================================
     22. Keyboard Shortcuts
     T → TOC, D → тема, B → наверх
     ============================================================ */
  (function () {
    var kbdToast = null;
    var kbdTimer = null;

    function showKbdHint(key, label) {
      if (!kbdToast) {
        kbdToast = document.createElement('div');
        kbdToast.className = 'kbd-hint-toast';
        document.body.appendChild(kbdToast);
      }
      kbdToast.innerHTML = '<kbd>' + key + '</kbd>\u00a0' + label;
      kbdToast.classList.add('visible');
      clearTimeout(kbdTimer);
      kbdTimer = setTimeout(function () {
        kbdToast.classList.remove('visible');
      }, 1400);
    }

    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement || {}).tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((document.activeElement || {}).isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      var key = e.key.toLowerCase();

      /* T — открыть/закрыть TOC */
      if (key === 't') {
        e.preventDefault();
        showKbdHint('T', 'Оглавление');

        var overlay = document.getElementById('btocOverlay');
        if (overlay) {
          if (overlay.classList.contains('open')) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
          } else {
            var sBtn = document.getElementById('barSectionBtn');
            if (sBtn) { sBtn.click(); }
            else { overlay.classList.add('open'); }
          }
          return;
        }
        var panel = document.getElementById('toc-panel');
        if (panel) {
          if (panel.classList.contains('open')) {
            var closeBtn = document.getElementById('toc-close');
            if (closeBtn) closeBtn.click();
          } else {
            var tocToggle = document.getElementById('toc-toggle');
            if (tocToggle) tocToggle.click();
          }
        }
        return;
      }

      /* D — переключить тему */
      if (key === 'd') {
        e.preventDefault();
        showKbdHint('D', 'Тема');
        var toggle  = document.getElementById('themeToggle');
        var barTheme = document.getElementById('barThemeBtn');
        if (toggle) { toggle.click(); }
        else if (barTheme) { barTheme.click(); }
        return;
      }

      /* B — прокрутить наверх */
      if (key === 'b') {
        e.preventDefault();
        showKbdHint('B', 'Наверх');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    });
  })();


  /* ============================================================
     23. Selection Share
     Выделил → попап «Копировать / Поделиться»
     ============================================================ */
  (function () {
    if (!document.querySelector('article')) return;

    var popup = document.createElement('div');
    popup.id = 'selection-share-popup';
    popup.setAttribute('aria-hidden', 'true');
    popup.innerHTML =
      '<button id="ss-copy" aria-label="Скопировать цитату">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
          '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
        '</svg>' +
        '<span>Копировать</span>' +
      '</button>' +
      '<div class="ss-sep"></div>' +
      '<button id="ss-share" aria-label="Поделиться цитатой">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
          '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
          '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
        '</svg>' +
        '<span>Поделиться</span>' +
      '</button>';
    document.body.appendChild(popup);

    var copyBtn  = document.getElementById('ss-copy');
    var shareBtn = document.getElementById('ss-share');
    var hideTimer = null;
    var lastText  = '';

    function hide() {
      clearTimeout(hideTimer);
      popup.classList.remove('ss-visible');
      popup.setAttribute('aria-hidden', 'true');
    }

    function show(x, y) {
      clearTimeout(hideTimer);
      popup.style.left = x + 'px';
      popup.style.top  = y + 'px';
      popup.classList.add('ss-visible');
      popup.setAttribute('aria-hidden', 'false');
      hideTimer = setTimeout(hide, 7000);
    }

    function getSelectedText() {
      var sel = window.getSelection ? window.getSelection() : null;
      return (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
    }

    function isInsideArticle() {
      var sel = window.getSelection ? window.getSelection() : null;
      if (!sel || sel.rangeCount === 0) return false;
      var node = sel.getRangeAt(0).commonAncestorContainer;
      var el = (node.nodeType === 1) ? node : node.parentElement;
      return !!(el && el.closest('article, .article-body'));
    }

    document.addEventListener('mouseup', function (e) {
      if (popup.contains(e.target)) return;
      setTimeout(function () {
        var text = getSelectedText();
        if (!text || text.length < 12 || !isInsideArticle()) { hide(); return; }
        lastText = text;

        var sel  = window.getSelection();
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
      }, 20);
    });

    document.addEventListener('mousedown', function (e) { if (!popup.contains(e.target)) hide(); });
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });

    copyBtn.addEventListener('click', function () {
      if (!lastText) return;
      var text = '\u00ab' + lastText + '\u00bb \u2014 ' + window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          var span = copyBtn.querySelector('span');
          var orig = span.textContent;
          span.textContent = '\u2713\u00a0Скопировано';
          setTimeout(function () { span.textContent = orig; }, 2200);
        });
      }
      hide();
      window.getSelection && window.getSelection().removeAllRanges();
    });

    shareBtn.addEventListener('click', function () {
      if (!lastText) return;
      var data = { title: document.title, text: '\u00ab' + lastText + '\u00bb', url: window.location.href };
      if (navigator.share) {
        navigator.share(data).catch(function () {});
      } else {
        var toCopy = data.text + ' \u2014 ' + data.url;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(toCopy).then(function () {
            var span = shareBtn.querySelector('span');
            var orig = span.textContent;
            span.textContent = '\u2713\u00a0Скопировано';
            setTimeout(function () { span.textContent = orig; }, 2200);
          });
        }
      }
      hide();
    });
  })();


  /* ============================================================
     24. Homepage Article Reading Progress
     ============================================================ */
  (function () {
    var list = document.querySelector('.article-list');
    if (!list) return;

    function normPath(p) {
      var s = (p || '/')
        .replace(/index\.html$/, '')
        .replace(/\/$/, '');
      if (s && s.charAt(0) !== '/') s = '/' + s;
      return s || '/';
    }

    function render() {
      if (!window.BookmarkEngine || typeof window.BookmarkEngine.getAllForSite !== 'function') return;

      var all = window.BookmarkEngine.getAllForSite();
      if (!all.length) return;

      var idx = {};
      all.forEach(function (b) {
        var k = normPath(b.path);
        if (!idx[k] || b.savedAt > idx[k].savedAt) idx[k] = b;
      });

      list.querySelectorAll('.article-item').forEach(function (item) {
        if (item.querySelector('.article-reading-progress')) return;

        var link = item.querySelector('.article-title, a[href]');
        if (!link) return;

        var href = link.getAttribute('href') || '';
        var path = normPath(href.replace(/^\.\.\//, '/').replace(/^\.\//, '/'));

        var data = idx[path];
        if (!data) {
          Object.keys(idx).forEach(function (k) {
            if (!data) {
              if (k.indexOf(path) !== -1 || path.indexOf(k) !== -1) data = idx[k];
            }
          });
        }
        if (!data) return;

        var pct = Math.max(0, Math.min(100, data.progress || 0));
        if (pct < 3) return;

        var wrap  = document.createElement('div');
        wrap.className = 'article-reading-progress';
        wrap.title = data.completed
          ? 'Прочитано полностью'
          : 'Прочитано ' + pct + '% \u2014 последний раздел: \u00ab' + (data.sectionTitle || '\u2014') + '\u00bb';

        var track = document.createElement('div');
        track.className = 'article-reading-progress-track';

        var fill = document.createElement('div');
        fill.className = 'article-reading-progress-fill' + (data.completed ? ' completed' : '');
        fill.style.width = pct + '%';

        var label = document.createElement('span');
        label.className = 'article-reading-progress-label' + (data.completed ? ' completed-label' : '');
        label.textContent = data.completed ? '\u2713\u00a0Прочитано' : pct + '%';

        track.appendChild(fill);
        wrap.appendChild(track);
        wrap.appendChild(label);

        var abstract = item.querySelector('.article-abstract');
        if (abstract) {
          abstract.parentNode.insertBefore(wrap, abstract.nextSibling);
        } else {
          item.appendChild(wrap);
        }
      });
    }

    if (window.BookmarkEngine) {
      render();
    } else {
      window.addEventListener('load', render);
    }
  })();


  /* ============================================================
     26. Article Date Display — #6 из списка
     Берёт дату из <meta property="article:modified_time">
     или <meta property="article:published_time">
     и вставляет видимый элемент в header статьи.
     Только на страницах статей (page.type === 'article').
     ============================================================ */
  (function () {
    var pageType = SiteUtils.getConfig('page.type', '');
    if (pageType !== 'article') return;

    /* Не показываем на главной и там, где дата уже есть */
    if (document.querySelector('.article-date-display')) return;
    if (document.querySelector('.article-byline time')) return;

    /* Берём дату */
    function getMeta(prop) {
      var el = document.querySelector('meta[property="' + prop + '"]') ||
               document.querySelector('meta[name="' + prop + '"]');
      return el ? el.getAttribute('content') : null;
    }

    var modified  = getMeta('article:modified_time');
    var published = getMeta('article:published_time');
    var dateStr   = modified || published;
    if (!dateStr) return;

    var date;
    try { date = new Date(dateStr); } catch (e) { return; }
    if (isNaN(date.getTime())) return;

    /* Форматируем по-русски */
    var months = [
      'января','февраля','марта','апреля','мая','июня',
      'июля','августа','сентября','октября','ноября','декабря'
    ];
    var day   = date.getDate();
    var month = months[date.getMonth()];
    var year  = date.getFullYear();

    var label = modified && published && modified !== published
      ? 'Обновлено ' + day + '\u00a0' + month + '\u00a0' + year
      : 'Опубликовано ' + day + '\u00a0' + month + '\u00a0' + year;

    /* Создаём элемент */
    var el = document.createElement('div');
    el.className = 'article-date-display';
    el.textContent = label;

    /* Вставляем: после .meta в header, или после h1, или в начало article */
    var header = document.querySelector('.article-header');
    var metaEl = header && header.querySelector('.meta, .article-desc, .reading-meta, .reading-time');
    var h1     = document.querySelector('article h1, .article-header h1');

    if (metaEl) {
      metaEl.parentNode.insertBefore(el, metaEl.nextSibling);
    } else if (h1) {
      h1.parentNode.insertBefore(el, h1.nextSibling);
    } else if (header) {
      header.appendChild(el);
    }
  })();


  /* ============================================================
     27. Article End Block — кнопки + SDG + крест
     Инжектирует единый завершающий блок во все статьи:
       [Поделиться статьёй]  [Распечатать / PDF]
               Soli Deo Gloria
                     ✝
     Блок вставляется перед .sources-block / .reading-list /
     .translation-note — т.е. перед источниками.
     Удаляет старые отдельные .share-block и SDG-блоки.
     ============================================================ */
  (function () {
    var pageType = SiteUtils.getConfig('page.type', '');
    if (pageType !== 'article') return;

    var article = document.querySelector('article');
    if (!article) return;

    /* Не дублируем */
    if (document.querySelector('.article-end-block')) return;

    /* Проверяем, разрешён ли шаринг */
    var shareCfg = SiteUtils.getConfig('features.share', {});
    var showShare = shareCfg.enabled !== false;

    /* ── Строим HTML кнопок ── */
    var actionsHTML = '';
    if (showShare) {
      actionsHTML +=
        '<button type="button" class="article-end-btn" id="articleEndShareBtn" aria-label="Поделиться статьёй">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
            '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
            '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
          '</svg>' +
          'Поделиться статьёй' +
        '</button>';
    }

    actionsHTML +=
      '<button type="button" class="article-end-btn" id="articleEndPrintBtn" aria-label="Распечатать статью или сохранить как PDF">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="6 9 6 2 18 2 18 9"/>' +
          '<path d="M6 18H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>' +
          '<rect x="6" y="14" width="12" height="8"/>' +
        '</svg>' +
        'Распечатать / PDF' +
      '</button>';

    /* ── Собираем блок ── */
    var block = document.createElement('div');
    block.className = 'article-end-block';
    block.innerHTML =
      '<div class="article-end-actions">' + actionsHTML + '</div>' +
      '<div class="article-end-sdg">' +
        '<span class="sdg">Soli Deo Gloria</span>' +
        '<svg width="52" height="70" viewBox="0 0 52 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<line x1="26" y1="3" x2="26" y2="67" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
          '<line x1="6" y1="19" x2="46" y2="19" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
        '</svg>' +
      '</div>';

    /* ── Подключаем обработчики ── */
    var shareBtn = block.querySelector('#articleEndShareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (window.SiteShare) { window.SiteShare.open(shareBtn); }
      });
    }

    block.querySelector('#articleEndPrintBtn')
      .addEventListener('click', function () { window.print(); });

    /* ── Место вставки: перед первым из этих элементов ── */
    /* Порядок важен: .article-footer раньше .reading-list,
       чтобы блок шёл перед источниками, а не между источниками
       и рекомендуемой литературой (случай krajne-li). */
    var anchorSelectors = [
      '.sources-block',
      '.article-footer',
      '.reading-list',
      '.translation-note'
    ];
    var target = null;
    for (var i = 0; i < anchorSelectors.length; i++) {
      target = article.querySelector(anchorSelectors[i]);
      if (target) break;
    }

    if (target) {
      article.insertBefore(block, target);
    } else {
      article.appendChild(block);
    }

    /* ── Удаляем старые отдельные блоки ── */
    article.querySelectorAll('.share-block').forEach(function (el) { el.remove(); });
    article.querySelectorAll('.print-btn-wrap').forEach(function (el) { el.remove(); });

    /* Старый инлайн-SDG (div с .sdg + svg-крестом прямо в article) */
    article.querySelectorAll('div > .sdg').forEach(function (sdgEl) {
      var parent = sdgEl.closest('div');
      if (!parent) return;
      if (parent.classList.contains('article-end-sdg') ||
          parent.classList.contains('article-end-block')) return;
      /* Ищем обёртку — div с инлайн-стилями flex */
      var wrapper = parent.closest('div:not(.article-end-block):not(.article-end-sdg)');
      if (wrapper && wrapper !== article && wrapper.contains(sdgEl)) {
        wrapper.remove();
      }
    });
  })();

  /* ============================================================
     Article — image viewer (breathe badge + click to zoom)
     ============================================================ */
  (function () {
    var pageType = SiteUtils.getConfig('page.type', '');
    if (pageType !== 'article') return;

    var imgs = document.querySelectorAll('.article-figure img');
    if (!imgs.length) return;

    var viewer = document.createElement('div');
    viewer.className = 'img-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Просмотр изображения');
    viewer.innerHTML =
      '<div class="img-viewer__panel" role="document">' +
        '<div class="img-viewer__top">' +
          '<button type="button" class="img-viewer__close" aria-label="Закрыть">\u2715</button>' +
        '</div>' +
        '<div class="img-viewer__body">' +
          '<img class="img-viewer__img" alt="">' +
          '<div class="img-viewer__cap"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(viewer);

    var closeBtn = viewer.querySelector('.img-viewer__close');
    var imgEl = viewer.querySelector('.img-viewer__img');
    var capEl = viewer.querySelector('.img-viewer__cap');

    var lastActive = null;

    function open(src, alt, captionText) {
      lastActive = document.activeElement;
      imgEl.src = src;
      imgEl.alt = alt || '';
      capEl.textContent = captionText || '';
      viewer.classList.add('is-open');
      closeBtn && closeBtn.focus();
      document.documentElement.style.overflow = 'hidden';
    }

    function close() {
      viewer.classList.remove('is-open');
      imgEl.removeAttribute('src');
      capEl.textContent = '';
      document.documentElement.style.overflow = '';
      if (lastActive && lastActive.focus) lastActive.focus();
      lastActive = null;
    }

    imgs.forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.addEventListener('click', function () {
        var fig = img.closest('.article-figure');
        var cap = fig && fig.querySelector('figcaption');
        open(img.currentSrc || img.src, img.alt, cap ? cap.textContent.trim() : '');
      });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          img.click();
        }
      });
    });

    viewer.addEventListener('click', function (e) {
      if (e.target === viewer) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (!viewer.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
    });
  })();

  /* ============================================================
     Article — lazy loading images below the fold (safe default)
     - applies only if author didn't set loading explicitly
     - skips hero / fetchpriority="high"
     ============================================================ */
  (function () {
    var pageType = SiteUtils.getConfig('page.type', '');
    if (pageType !== 'article') return;

    var scope = document.querySelector('article') || document;
    var imgs = scope.querySelectorAll('img');
    if (!imgs.length) return;

    imgs.forEach(function (img, idx) {
      if (!img || !img.getAttribute) return;
      if (img.hasAttribute('loading')) return;
      if (img.getAttribute('fetchpriority') === 'high') return;
      if (img.closest && img.closest('.article-hero')) return;
      if (img.getAttribute('data-no-lazy') === 'true') return;

      img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  })();

  /* ============================================================
     Homepage — clickable cards (Lift & Glow)
     Делает всю карточку кликабельной, сохраняя ссылки внутри.
     ============================================================ */
  (function () {
    var pageType = SiteUtils.getConfig('page.type', '');
    if (pageType !== 'home') return;

    var cards = document.querySelectorAll('.article-item.card');
    if (!cards.length) return;

    cards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.defaultPrevented) return;
        if (e.target && e.target.closest && e.target.closest('a')) return;
        var link = card.querySelector('a.article-title[href]');
        if (link && link.getAttribute('href')) window.location.href = link.getAttribute('href');
      });
    });
  })();


})();
