/* ============================================================
   site.js — Господь Бог — Сила Моя
   Единый общий JS для всего сайта
   Версия 1.3

   Структура:
   01. SiteUtils — helpers / config access
   02. Theme Toggle
   03. Share Dialog
   04. Reading Progress Bar
   05. Back To Top Button
   06. Section Label
   07. TOC Mobile (slide panel)
   08. TOC Desktop (scrollspy sidebar)
   09. Bottom App Bar + TOC Overlay
   10. Timeline Animation (Intersection Observer)
   11. Animate Boxes on Scroll
   12. Footnote Tooltips (fn-ref / inline sup)
   13. Flip Cards — toggle + keyboard
   14. Flip Card Fingers
   15. Flip Card Height Sync
   16. Quiz Engine v3 (основной тест + разбор ошибок + бонусный раунд)
   17. Heading Anchor Copy + Anchor Toast
   18. Hover bridge for fn-marker tooltip (desktop only)
   19. Bible Reference Tooltips (bref / btip)
   20. Academic Footnotes (fn-marker / tooltip)
   21. Typography — неразрывные пробелы вокруг тире (—, –)
   22. Keyboard Shortcuts + Hint Toast — T (TOC), D (тема), B (наверх)
   23. Selection Share — выделил → поделиться
   24. Homepage Article Reading Progress (delegates to bookmark-engine)
   25. (зарезервировано)
   26. Article Date Display — дата публикации/обновления из meta
   26a. Auto Drop Cap — первый <p> (не применяется к Типу C)
   27. Article End Block — кнопки «Поделиться» + «Распечатать/PDF» + SDG + крест

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
      html.classList.add('dark');
    } else if (!saved) {
      /* First visit — respect OS preference */
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark');
      }
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
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        m.setAttribute('content', isDark ? '#0e1116' : '#fdfcf9');
        m.removeAttribute('media');
      });
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
    /* Fix: синхронизируем theme-color браузера при загрузке страницы,
       а не только после первого клика на кнопку переключения темы. */
    syncThemeColor(html.classList.contains('dark'));
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

    /* ── UTM helper ── */
    function utmUrl(url, source) {
      try {
        var u = new URL(url);
        u.searchParams.set('utm_source',   source);
        u.searchParams.set('utm_medium',   'share');
        u.searchParams.set('utm_campaign', 'article');
        return u.toString();
      } catch (e) { return url; }
    }

    var encoded      = encodeURIComponent(shareUrl);
    var encodedTitle = encodeURIComponent(shareTitle);

    /* ── Dialog HTML ── */
    var overlay = document.createElement('div');
    overlay.id = 'share-dialog-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    /*
      Сервисы для российской аудитории:
      1. Telegram  — t.me/share (web URL, совместим с мобильным и десктопом)
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
    function showOverlay() {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
      requestAnimationFrame(function () { dialog.focus(); });
      document.addEventListener('keydown', onKey);
    }

    function openDialog(trigger) {
      triggerEl = trigger || null;

      /* Mobile-first: нативный share-sheet (iOS/Android) */
      var isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobileDevice && navigator.share) {
        /* Читаем актуальный заголовок из DOM (может быть патчнут квизом) */
        var sdTitleEl  = document.getElementById('sd-title');
        var nativeTitle = (sdTitleEl && sdTitleEl.textContent) ? sdTitleEl.textContent : shareTitle;
        navigator.share({
          title: nativeTitle,
          url:   utmUrl(shareUrl, 'native')
        }).catch(function (err) {
          /* Пользователь отменил или share не поддерживается — показываем диалог */
          if (err && err.name !== 'AbortError') { showOverlay(); }
        });
        return;
      }

      showOverlay();
    }
    function closeDialog() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', onKey);
      if (triggerEl && triggerEl.focus) triggerEl.focus();
      triggerEl = null;
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        /* stopImmediatePropagation: исключаем одновременное срабатывание
           других ESC-обработчиков (btoc, footnotes, bible) пока диалог открыт */
        e.stopImmediatePropagation();
        closeDialog();
        return;
      }
      trapTab(e);
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDialog(); });
    closeBtn.addEventListener('click', closeDialog);

    /* ── Service links ── */
    /* Telegram: открываем web-версию (работает везде; мобильный браузер автоматически
       предложит открыть приложение, если оно установлено) */
    document.getElementById('sd-tg').addEventListener('click', function () {
      var tgWeb = 'https://t.me/share/url?url=' + encodeURIComponent(utmUrl(shareUrl,'telegram')) + '&text=' + encodedTitle;
      window.open(tgWeb, '_blank', 'noopener');
    });
    document.getElementById('sd-vk').addEventListener('click', function () {
      window.open('https://vk.com/share.php?url=' + encodeURIComponent(utmUrl(shareUrl,'vk')) + '&title=' + encodedTitle, '_blank', 'noopener');
    });
    document.getElementById('sd-ok').addEventListener('click', function () {
      window.open('https://connect.ok.ru/offer?url=' + encodeURIComponent(utmUrl(shareUrl,'ok')) + '&title=' + encodedTitle, '_blank', 'noopener');
    });
    document.getElementById('sd-wa').addEventListener('click', function () {
      /* на мобильных открывает приложение, на десктопе — web.whatsapp.com */
      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      var waUrl = isMobile
        ? 'whatsapp://send?text=' + encodedTitle + '%20' + encodeURIComponent(utmUrl(shareUrl,'whatsapp'))
        : 'https://web.whatsapp.com/send?text=' + encodedTitle + '%20' + encodeURIComponent(utmUrl(shareUrl,'whatsapp'));
      window.open(waUrl, '_blank', 'noopener');
    });

    /* ── Copy ── */
    function doCopy() {
      var label = copyBtn.querySelector('.sd-copy-label');
      var iconEl = copyBtn.querySelector('.sd-icon');
      ;(navigator.clipboard ? navigator.clipboard.writeText(shareUrl) : Promise.reject())
        .then(function () {
          if (navigator.vibrate) navigator.vibrate(30); /* Fix #12: haptic */
          if (label) label.textContent = 'Скопировано!';
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
     04. Reading Progress Bar
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
     07. TOC Mobile — slide panel
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
      document.body.style.overscrollBehavior = 'none'; /* iOS Safari: prevent background scroll under panel */
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
      document.body.style.overscrollBehavior = ''; /* iOS Safari: restore */
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
     09. Bottom App Bar + TOC Overlay
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

    /* Feature #15: og:image preview banner — вставляем один раз, если есть мета-картинка */
    (function () {
      var ogImg = document.querySelector('meta[property="og:image"]');
      if (!ogImg || !ogImg.content || !panel) return;
      /* Берём первую часть заголовка (до |, — или :) как короткое название */
      var rawTitle = document.title || '';
      var shortTitle = rawTitle.split(/[|—:]/)[0].trim();

      /* Вычисляем URL пригодный и в production и при локальном открытии файлов.
         og:image абсолютный (https://...), при file:// не работает.
         Используем og:url (канонический URL страницы) чтобы надёжно вычислить
         относительный путь от текущей страницы до картинки — без зависимости
         от реального пути в файловой системе. */
      var absUrl = ogImg.content;
      var relUrl = absUrl;
      try {
        var uImg  = new URL(absUrl);
        var ogUrlMeta = document.querySelector('meta[property="og:url"]');
        var uPage = ogUrlMeta ? new URL(ogUrlMeta.content) : null;
        if (uPage) {
          /* Считаем глубину страницы по og:url (надёжнее чем location.pathname) */
          var segments = uPage.pathname.replace(/\/$/, '').split('/').filter(Boolean);
          /* segments.length = кол-во директорий от корня; каждая — один уровень ../  */
          var prefix = Array(segments.length).fill('..').join('/');
          relUrl = (prefix ? prefix + '/' : '') + uImg.pathname.replace(/^\//, '');
        }
      } catch (e) {}

      var banner = document.createElement('div');
      banner.className = 'btoc-banner';
      var grad = document.createElement('div');
      grad.className = 'btoc-banner-grad';
      var titleEl = document.createElement('div');
      titleEl.className = 'btoc-banner-title';
      titleEl.textContent = shortTitle;
      banner.appendChild(grad);
      banner.appendChild(titleEl);

      /* Пробуем загрузить абсолютный URL; при ошибке — используем relative */
      function applyBg(src) { banner.style.backgroundImage = 'url(' + src + ')'; }
      var probe = new Image();
      probe.onload  = function () { applyBg(absUrl); };
      probe.onerror = function () { applyBg(relUrl); };
      probe.src = absUrl;

      /* Баннер идёт ПОСЛЕ .btoc-handle (drag-pill должен быть виден поверх баннера),
         но ПЕРЕД .btoc-header. Ищем handle и вставляем после него. */
      var handle = panel.querySelector('.btoc-handle');
      if (handle && handle.nextSibling) {
        panel.insertBefore(banner, handle.nextSibling);
      } else {
        panel.insertBefore(banner, panel.firstChild);
      }
    })();

    document.body.classList.add('has-bottom-bar');

    /* --- Умная видимость bar (scroll-direction aware) ---
       Паттерн: скрываем при скролле ВНИЗ (читатель читает, не мешаем),
       показываем при скролле ВВЕРХ (навигационное намерение).
       Такой же паттерн у Medium, Substack, Guardian, NYT. */
    var barVisible    = false;
    var _lastScrollY  = window.scrollY;
    var _accumulated  = 0;    /* накопленный сдвиг: + вниз, − вверх      */
    var SHOW_AFTER    = 300;  /* px от верха — bar скрыт в шапке          */
    var HIDE_DOWN     =  10;  /* накопленный downscroll → скрыть (быстро) */
    var SHOW_UP       = -80;  /* накопленный upscroll → показать          */

    function setBarVisible(show) {
      if (show === barVisible) return;
      barVisible = show;
      bar.classList.toggle('visible', show);
    }

    function updateBar() {
      var scrollY = window.scrollY;
      var delta   = scrollY - _lastScrollY;
      _lastScrollY = scrollY;

      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct  = docH > 0 ? SiteUtils.clamp(Math.round((scrollY / docH) * 100), 0, 100) : 0;

      /* --- Логика видимости --- */
      if (scrollY < SHOW_AFTER) {
        /* 1. До порога — всегда скрыт (пользователь ещё в шапке) */
        _accumulated = 0;
        setBarVisible(false);
      } else if (pct >= 90) {
        /* 2. Финальные 10% — всегда виден (читатель у конца статьи) */
        setBarVisible(true);
      } else {
        /* 3. Стандарт: вниз — прячем, вверх — показываем */
        _accumulated += delta;
        _accumulated  = Math.max(SHOW_UP - 20, Math.min(HIDE_DOWN + 20, _accumulated));

        if      (_accumulated >= HIDE_DOWN) { setBarVisible(false); _accumulated = HIDE_DOWN; }
        else if (_accumulated <= SHOW_UP)   { setBarVisible(true);  _accumulated = 0;         }
        /* иначе — держим текущее состояние до накопления порога */
      }

      /* --- Прогресс-кольцо и счётчики --- */
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

    /* --- Скрывать bar при фокусе на полях ввода (мобильная клавиатура) --- */
    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]')) {
        setBarVisible(false);
      }
    });
    document.addEventListener('focusout', function (e) {
      if (e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]')) {
        /* Небольшая задержка — клавиатура успевает закрыться, viewport стабилизируется */
        setTimeout(function () {
          if (window.scrollY >= SHOW_AFTER && !overlay.classList.contains('open')) {
            setBarVisible(true); _accumulated = 0;
          }
        }, 400);
      }
    });

    var _bPrevFocus = null;
    var _bTrapHandler = null;

    function openToc() {
      _bPrevFocus = document.activeElement;
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none'; /* Fix #10: страница не скроллится под открытой панелью */
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
      document.body.style.overscrollBehavior = ''; /* Fix #10 */
      if (panel && _bTrapHandler) { panel.removeEventListener('keydown', _bTrapHandler); _bTrapHandler = null; }
      if (_bPrevFocus && _bPrevFocus.focus) { _bPrevFocus.focus(); _bPrevFocus = null; }
      /* После навигации по TOC — показываем бар, если мы ниже порога.
         Небольшая задержка: дать браузеру завершить scroll к якорю. */
      setTimeout(function () {
        if (window.scrollY >= SHOW_AFTER) { setBarVisible(true); _accumulated = 0; }
      }, 150);
    }

    if (sectionBtn) sectionBtn.addEventListener('click', openToc);
    if (closeBtn) closeBtn.addEventListener('click', closeToc);
    overlay.addEventListener('click', function (e) { if (!panel || !panel.contains(e.target)) closeToc(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeToc(); });

    /* Экспортируем API для внешних модулей (клавиатурные шорткаты, etc.) */
    window.SiteBTOC = { open: openToc, close: closeToc };

    if (upBtn) upBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    var touchStartY = 0;
    var touchStartX = 0;
    if (panel) {
      panel.addEventListener('touchstart', function (e) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      panel.addEventListener('touchmove', function (e) {
        var dy = e.touches[0].clientY - touchStartY;
        var dx = Math.abs(e.touches[0].clientX - touchStartX);
        /* Закрываем только если это явный вертикальный свайп вниз, а не горизонтальный скролл */
        if (dy > 80 && dx < dy * 0.5) closeToc();
      }, { passive: true });
    }

    /* Fix #2: свайп снизу вверх открывает TOC (замена недоступной клавиши / на мобильном).
       Срабатывает только если: старт в нижних 25% экрана, движение вверх ≥ 70px,
       панель закрыта и bottom bar виден. */
    (function () {
      var swipeStartY = 0;
      var swipeStartTime = 0;
      var SWIPE_THRESHOLD = 70;   /* минимум пикселей вверх */
      var SWIPE_ZONE = 0.25;      /* нижние 25% экрана */
      var MAX_TIME = 400;         /* мс — быстрый свайп */

      document.addEventListener('touchstart', function (e) {
        var touch = e.touches[0];
        swipeStartY = touch.clientY;
        swipeStartTime = Date.now();
      }, { passive: true });

      document.addEventListener('touchend', function (e) {
        if (overlay.classList.contains('open')) return;
        /* Свайп работает при scrollY >= SHOW_AFTER — не зависит от видимости бара.
           Бар может быть скрыт из-за upscroll, но TOC должен оставаться доступным. */
        if (window.scrollY < SHOW_AFTER) return;
        var touch = e.changedTouches[0];
        var dy = swipeStartY - touch.clientY; /* положительное = вверх */
        var dt = Date.now() - swipeStartTime;
        var inZone = swipeStartY > window.innerHeight * (1 - SWIPE_ZONE);
        if (inZone && dy >= SWIPE_THRESHOLD && dt <= MAX_TIME) {
          openToc();
        }
      }, { passive: true });
    })();
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
     12. Footnote Tooltips (fn-ref / inline sup)
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
     16. Quiz Engine  [v3: review mode + wrong-answer tracking]
     ============================================================ */
  (function () {

    /* ---- 1. Feature gate ---- */
    var cfg = SiteUtils.getConfig('features.quiz', {});
    if (cfg.enabled === false) return;

    var wrapper  = document.getElementById('quizWrapper');
    var quizMain = document.getElementById('quizMain');
    if (!wrapper) return;

    var questions      = SiteUtils.getConfig('quiz.questions', null);
    var bonusQuestions = SiteUtils.getConfig('quiz.bonusQuestions', null);
    var scores         = SiteUtils.getConfig('quiz.scores', null);
    var bonusScores    = SiteUtils.getConfig('quiz.bonusScores', null);
    if (!questions || !questions.length) return;

    /* ---- 2. RNG + deck preparation ---- */
    function hashString(str) {
      var h = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
      return h >>> 0;
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
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    }
    function getSessionSeed() {
      try { var buf = new Uint32Array(1); crypto.getRandomValues(buf); return buf[0]; }
      catch (e) { return Date.now() >>> 0; }
    }
    function prepareDeck(qs, attemptSeed, deckName) {
      return shuffleSeeded(qs, hashString(deckName + ':' + attemptSeed)).map(function (q) {
        var optSeed     = hashString(q.q.slice(0, 20) + ':' + deckName + ':' + attemptSeed);
        var orig        = q.options.slice();
        var shuffled    = shuffleSeeded(orig, optSeed);
        var correctText = orig[q.answer];
        return { q: q.q, options: shuffled, answer: shuffled.indexOf(correctText), ok: q.ok, err: q.err, focus: q.focus || null };
      });
    }

    var sessionSeed = getSessionSeed();
    var coreDeck    = prepareDeck(questions, sessionSeed, 'core');
    var bonusDeck   = bonusQuestions ? prepareDeck(bonusQuestions, sessionSeed + 41, 'bonus') : null;

    /* ---- 3. Main DOM refs ---- */
    var counter      = document.getElementById('quizCounter');
    var qText        = document.getElementById('quizQuestion');
    var qFocus       = document.getElementById('quizFocus');   /* legacy — kept for HTML compat */
    var opts         = document.getElementById('quizOptions');
    var feedback     = document.getElementById('quizFeedback');
    var nextBtn      = document.getElementById('quizNext');
    var fill         = document.getElementById('quizFill');
    var body         = document.getElementById('quizBody');
    var resultEl     = document.getElementById('quizResult');
    var resultScore  = document.getElementById('quizResultScore');
    var resultTotal  = document.getElementById('quizResultTotal');
    var resultLabel  = document.getElementById('quizResultLabel');
    var resultBar    = document.getElementById('quizResultBar');
    var resultDesc   = document.getElementById('quizScoreDesc');
    var scoreEl      = document.getElementById('quizScore');
    var scoreBadge   = document.getElementById('quizScoreBadge');
    var scoreTitle   = document.getElementById('quizScoreTitle');
    var restart      = document.getElementById('quizRestart');
    var share        = document.getElementById('quizShare');
    var quizOverlay  = document.getElementById('quizOverlay');
    var quizLaunch   = document.getElementById('quizLaunch');

    if (!counter || !qText || !opts) return;

    /* ---- 4. Bonus DOM refs (present only in articles with bonus round) ---- */
    var bonusSection = document.getElementById('quizBonusSection');
    var bonusBtn     = document.getElementById('quizBonusStart');
    var bonusBody    = document.getElementById('quizBonusBody');
    var bonusScore   = document.getElementById('quizBonusScore');
    var bonusBc      = document.getElementById('quizBonusCounter');
    var bonusBq      = document.getElementById('quizBonusQuestion');
    var bonusBf      = document.getElementById('quizBonusFocus');
    var bonusBo      = document.getElementById('quizBonusOptions');
    var bonusBfb     = document.getElementById('quizBonusFeedback');
    var bonusBn      = document.getElementById('quizBonusNext');
    var bonusBfill   = document.getElementById('quizBonusFill');
    var bonusLock    = document.getElementById('quizBonusLock');
    var bonusUnlock  = document.getElementById('quizBonusUnlock');
    var bonusSTitle  = document.getElementById('quizBonusScoreTitle');
    var bonusSBadge  = document.getElementById('quizBonusScoreBadge');
    var bonusSDesc   = document.getElementById('quizBonusScoreDesc');

    /* ---- 5. Review UI injection ---- *
     * Dynamically injects the review section and done screen into quizMain,
     * and a "Разобрать ошибки" button into the existing result actions row.
     * All refs cached immediately after injection.                          */
    var revStartBtn  = null; /* "Разобрать ошибки (N)" button in result      */
    var revSection   = null; /* review question UI                            */
    var revFill      = null;
    var revCounter   = null;
    var revQuestion  = null;
    var revPrev      = null;
    var revOpts      = null;
    var revFeedback  = null;
    var revFocus     = null;
    var revNextBtn   = null;
    var revDone      = null; /* review completion screen                      */
    var revDoneIcon  = null;
    var revDoneTitle = null;
    var revDoneDesc  = null;
    var revRestartBtn = null;
    var revBonusTeaser = null;

    if (quizMain) {
      /* "Разобрать ошибки" button — prepended into existing result actions */
      var resultActions = quizMain.querySelector('.quiz-result__actions');
      if (resultActions) {
        revStartBtn = document.createElement('button');
        revStartBtn.id        = 'quizStartReview';
        revStartBtn.className = 'quiz-review-start-btn';
        revStartBtn.style.display = 'none';
        resultActions.insertBefore(revStartBtn, resultActions.firstChild);
      }

      /* Review question section */
      revSection = document.createElement('div');
      revSection.id        = 'quizReviewSection';
      revSection.className = 'quiz-review-section';
      revSection.style.display = 'none';
      revSection.innerHTML =
        '<div class="quiz-review-header">' +
          '<span class="quiz-review-label">Разбор ошибок</span>' +
          '<span class="quiz-counter" id="_rvc"></span>' +
        '</div>' +
        '<div class="quiz-progress-wrap" style="margin-bottom:20px">' +
          '<div class="quiz-progress-fill" id="_rvf" style="width:0%"></div>' +
        '</div>' +
        '<p class="quiz-question-text" id="_rvq"></p>' +
        '<div class="quiz-review-prev" id="_rvp" style="display:none"></div>' +
        '<div class="quiz-options" id="_rvo" role="radiogroup"></div>' +
        '<div class="quiz-feedback" id="_rvfb" aria-live="polite" aria-atomic="true"></div>' +
        '<div class="quiz-review-focus" id="_rvfc" style="display:none"></div>' +
        '<button class="quiz-next-btn" id="_rvn" style="display:none">Следующий →</button>';
      quizMain.appendChild(revSection);

      /* Cache child refs immediately — no further getElementById needed */
      revCounter  = document.getElementById('_rvc');
      revFill     = document.getElementById('_rvf');
      revQuestion = document.getElementById('_rvq');
      revPrev     = document.getElementById('_rvp');
      revOpts     = document.getElementById('_rvo');
      revFeedback = document.getElementById('_rvfb');
      revFocus    = document.getElementById('_rvfc');
      revNextBtn  = document.getElementById('_rvn');

      /* Review done screen */
      revDone = document.createElement('div');
      revDone.id        = 'quizReviewDone';
      revDone.className = 'quiz-review-done';
      revDone.style.display = 'none';
      revDone.innerHTML =
        '<div class="quiz-review-done__icon" id="_rdi"></div>' +
        '<div class="quiz-review-done__title" id="_rdt"></div>' +
        '<div class="quiz-review-done__desc" id="_rdd"></div>' +
        '<div class="quiz-result__actions" style="justify-content:center;margin-top:20px">' +
          '<button class="quiz-restart-btn" id="_rdr">Пройти тест заново</button>' +
        '</div>' +
        '<div class="quiz-bonus-teaser" id="_rdb" style="display:none"></div>';
      quizMain.appendChild(revDone);

      revDoneIcon    = document.getElementById('_rdi');
      revDoneTitle   = document.getElementById('_rdt');
      revDoneDesc    = document.getElementById('_rdd');
      revRestartBtn  = document.getElementById('_rdr');
      revBonusTeaser = document.getElementById('_rdb');
    }

    /* ---- 6. State ---- */
    var current  = 0, score  = 0, answered  = false;
    var inBonus  = false, bonusCurrent = 0, bonusScoreVal = 0, bonusAnswered = false;
    var inReview = false, reviewDeck  = [], reviewCurrent = 0, reviewAnswered = false, reviewScore = 0;
    var wrongAnswers = [];  /* collects { q, options, answer, chosenIdx, ok, err, focus } */
    var activeDeck = coreDeck;
    var streak = 0;

    var LETTERS = ['А', 'Б', 'В', 'Г'];
    var KEY_MAP  = { '1': 0, '2': 1, '3': 2, '4': 3, 'а': 0, 'б': 1, 'в': 2, 'г': 3 };

    /* ---- 7. Utilities ---- */
    function getScoreBucket(sc, total, arr) {
      if (!arr) {
        var p = sc / total;
        return p >= 0.9 ? 0 : p >= 0.7 ? 1 : p >= 0.5 ? 2 : p >= 0.3 ? 3 : 4;
      }
      for (var i = 0; i < arr.length; i++) { if (sc >= (arr[i].min || 0)) return i; }
      return arr.length - 1;
    }

    function animateCountNum(el, target, duration) {
      if (!el) return;
      var t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / duration, 1);
        el.textContent = Math.floor(p * target);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function animateCount(el, target, total, duration) {
      if (!el) return;
      var t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / duration, 1);
        el.textContent = 'Результат: ' + Math.floor(p * target) + ' из ' + total;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    /* Russian plural for "вопрос" (0=вопросов, 1=вопрос, 2–4=вопроса, 5+=вопросов) */
    function pluralQ(n) {
      if (n % 10 === 1 && n % 100 !== 11) return '';          /* 1 вопрос  */
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'а'; /* 2–4 вопроса */
      return 'ов';                                              /* 5 вопросов */
    }

    /* Build an option button (shared by main / review / bonus) */
    function makeOptionBtn(opt, i, handler) {
      var btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.setAttribute('data-idx', i);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = '<span class="quiz-option-letter">' + (LETTERS[i] || (i + 1)) + '.</span> ' + opt;
      btn.addEventListener('click', (function (idx) { return function () { handler(idx); }; })(i));
      return btn;
    }

    /* ---- 8. Timer (optional — feature.quiz.timeLimit in seconds, 0 = off) ---- */
    var timeLimit = SiteUtils.getConfig('features.quiz.timeLimit', 0);
    var timerInterval = null;
    var timerEl = null;

    function clearTimer() {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
    function startTimer(onExpire) {
      clearTimer();
      if (!timeLimit || !timerEl) return;
      var left = timeLimit;
      timerEl.style.cssText = 'width:100%;transition:none';
      timerInterval = setInterval(function () {
        left--;
        var pct = Math.max(0, left / timeLimit * 100);
        timerEl.style.transition = 'width 1s linear';
        timerEl.style.width = pct + '%';
        if (left <= 0) { clearTimer(); onExpire(); }
      }, 1000);
    }

    if (timeLimit > 0 && body) {
      timerEl = document.createElement('div');
      timerEl.className = 'quiz-timer-bar';
      var timerTrack = document.createElement('div');
      timerTrack.className = 'quiz-timer-track';
      timerTrack.appendChild(timerEl);
      body.insertBefore(timerTrack, body.firstChild);
    }

    /* ---- 9. Streak badge ---- */
    var streakBadge = document.createElement('div');
    streakBadge.className = 'quiz-streak-badge';
    streakBadge.style.display = 'none';
    if (body) body.appendChild(streakBadge);

    function updateStreakBadge() {
      if (streak >= 3) {
        streakBadge.textContent  = '🔥 ' + streak + ' подряд!';
        streakBadge.style.display = 'block';
      } else {
        streakBadge.style.display = 'none';
      }
    }

    /* ---- 10. Main quiz ---- */
    function render() {
      answered = false;
      clearTimer();
      var q     = activeDeck[current];
      var total = activeDeck.length;
      counter.textContent = 'Вопрос ' + (current + 1) + ' из ' + total;
      if (fill) fill.style.width = ((current + 1) / total * 100) + '%';
      qText.innerHTML = q.q;
      if (qFocus)   qFocus.style.display = 'none';
      if (feedback) { feedback.textContent = ''; feedback.className = 'quiz-feedback'; }
      if (nextBtn)  nextBtn.style.display = 'none';
      opts.innerHTML = '';
      opts.setAttribute('role', 'radiogroup');
      opts.setAttribute('aria-labelledby', 'quizQuestion');
      q.options.forEach(function (opt, i) { opts.appendChild(makeOptionBtn(opt, i, handleAnswer)); });
      if (timeLimit > 0) startTimer(function () { if (!answered) handleAnswer(-1); });
    }

    function handleAnswer(idx) {
      if (answered) return;
      answered = true;
      clearTimer();
      var q       = activeDeck[current];
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
          allBtns[idx].classList.add('wrong', 'shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        if (feedback) { feedback.innerHTML = '✗ ' + q.err; feedback.className = 'quiz-feedback err'; }
        wrongAnswers.push({ q: q.q, options: q.options.slice(), answer: q.answer, chosenIdx: idx, ok: q.ok, err: q.err, focus: q.focus });
        streak = 0;
      }

      updateStreakBadge();
      if (nextBtn) {
        nextBtn.textContent    = current < activeDeck.length - 1 ? 'Следующий вопрос →' : 'Узнать результат →';
        nextBtn.style.display = 'inline-block';
      }
      if (feedback && window.innerWidth < 768) {
        setTimeout(function () { feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
      }
    }

    /* ---- 11. Keyboard: Enter/Space advance + 1–4/А–Г select ---- */
    document.addEventListener('keydown', function (e) {
      if (!wrapper || wrapper.style.display === 'none') return;

      var isAnswered = inReview ? reviewAnswered : (inBonus ? bonusAnswered : answered);

      if (e.key === 'Enter' || e.key === ' ') {
        if (!isAnswered) return;
        e.preventDefault();
        if      (inReview && revNextBtn && revNextBtn.style.display !== 'none') revNextBtn.click();
        else if (inBonus  && bonusBn   && bonusBn.style.display   !== 'none')  bonusBn.click();
        else if (nextBtn  && nextBtn.style.display !== 'none')                  nextBtn.click();
        return;
      }

      if (isAnswered) return;
      var key = e.key.toLowerCase();
      if (!KEY_MAP.hasOwnProperty(key)) return;
      e.preventDefault();
      var i = KEY_MAP[key];
      if (inReview) {
        var rBtns = revOpts ? revOpts.querySelectorAll('.quiz-option') : [];
        if (rBtns[i]) handleReviewAnswer(i);
      } else if (inBonus) {
        var bBtns = bonusBo ? bonusBo.querySelectorAll('.quiz-option') : [];
        if (bBtns[i]) handleBonusAnswer(i);
      } else {
        var mBtns = opts.querySelectorAll('.quiz-option');
        if (mBtns[i]) handleAnswer(i);
      }
    });

    /* ---- 12. Next button (main quiz only) ---- */
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (inReview || inBonus) return;   /* safety guard — button should be hidden in these modes */
        current++;
        if (current < activeDeck.length) render(); else showScore();
      });
    }

    function showScore() {
      if (fill)  fill.style.width = '100%';
      if (body)  body.style.display = 'none';
      streakBadge.style.display = 'none';

      var idx = getScoreBucket(score, questions.length, scores);
      var s   = scores ? scores[idx] : null;
      var pct = score / questions.length;

      if (resultEl) {
        resultEl.style.display = 'block';
        animateCountNum(resultScore, score, 700);
        if (resultTotal) resultTotal.textContent = questions.length;
        if (resultLabel) resultLabel.textContent = (s && s.title) ? (s.badge || '') + '\u00a0' + s.title
                                                  : (pct >= .9 ? '🏆\u00a0Отлично!' : pct >= .7 ? '👍\u00a0Хорошо' : pct >= .5 ? '📖\u00a0Неплохо' : '🔁\u00a0Попробуйте снова');
        if (resultBar)  setTimeout(function () { resultBar.style.width = Math.round(pct * 100) + '%'; }, 80);
        if (resultDesc && s) resultDesc.innerHTML = s.desc || '';
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /* "Разобрать ошибки" button — visible only when there are wrong answers */
      if (revStartBtn && wrongAnswers.length > 0) {
        revStartBtn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style="vertical-align:-1px;margin-right:5px">' +
          '<path d="M13 8A5 5 0 1 1 3.5 4.5M3 2v3h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          'Разобрать\u00a0ошибки\u00a0(' + wrongAnswers.length + ')';
        revStartBtn.style.display = 'inline-flex';
      }

      /* Legacy score badge (used by bonus round heading) */
      if (scoreEl)    scoreEl.style.display = 'block';
      if (scoreTitle) scoreTitle.textContent = '';
      animateCount(scoreBadge, score, questions.length, 800);

      /* Bonus section */
      var bonusEnabled = SiteUtils.getConfig('features.quiz.bonusEnabled', false);
      if (bonusEnabled && bonusDeck && bonusSection) {
        if (score === questions.length) {
          bonusSection.style.display = 'block';
          bonusSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          if (bonusLock) bonusLock.style.display = 'none';
        } else {
          if (bonusLock) {
            bonusLock.textContent    = 'Ответьте правильно на все\u00a0' + questions.length + '\u00a0вопросов, чтобы разблокировать бонусный раунд.';
            bonusLock.style.display = 'block';
          }
        }
      }

      /* Confetti */
      if (pct >= 0.9) launchConfetti('gold');
      else if (pct >= 0.7) launchConfetti('blue');
      else if (pct >= 0.5) launchConfetti('light');

      /* Best score persistence */
      try {
        var slug     = SiteUtils.getConfig('page.id', 'default');
        var KEY      = 'quiz-best-' + slug;
        var prevBest = parseInt(localStorage.getItem(KEY) || '0', 10);
        if (score > prevBest) {
          localStorage.setItem(KEY, String(score));
        } else if (prevBest > 0 && resultDesc) {
          var hint = document.createElement('div');
          hint.className   = 'quiz-best-hint';
          hint.style.cssText = 'margin-top:14px;font-size:14px;color:var(--muted);font-style:italic';
          hint.textContent = 'Ваш лучший результат:\u00a0' + prevBest + '\u00a0из\u00a0' + questions.length;
          resultDesc.appendChild(hint);
        }
      } catch (e) {}
    }

    /* ---- 14. Review mode ---- */
    function startReview() {
      if (resultEl) resultEl.style.display = 'none';
      if (scoreEl)  scoreEl.style.display  = 'none';

      inReview      = true;
      reviewDeck    = wrongAnswers.slice();
      reviewCurrent = 0;
      reviewScore   = 0;
      reviewAnswered = false;

      if (revSection) {
        revSection.style.display = 'block';
        revSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      renderReview();
    }

    function renderReview() {
      reviewAnswered = false;
      var q     = reviewDeck[reviewCurrent];
      var total = reviewDeck.length;

      if (revCounter)  revCounter.textContent = (reviewCurrent + 1) + '\u00a0/\u00a0' + total;
      if (revFill)     revFill.style.width    = ((reviewCurrent + 1) / total * 100) + '%';
      if (revQuestion) revQuestion.innerHTML  = q.q;

      if (revPrev) {
        if (q.chosenIdx >= 0 && q.options[q.chosenIdx]) {
          revPrev.innerHTML    = '<span class="quiz-review-prev__label">Вы ответили:</span>\u00a0' + q.options[q.chosenIdx];
          revPrev.style.display = 'block';
        } else {
          revPrev.style.display = 'none';
        }
      }

      if (revFeedback) { revFeedback.textContent = ''; revFeedback.className = 'quiz-feedback'; }
      if (revFocus)    revFocus.style.display = 'none';
      if (revNextBtn)  revNextBtn.style.display = 'none';

      if (revOpts) {
        revOpts.innerHTML = '';
        revOpts.setAttribute('aria-labelledby', '_rvq');
        q.options.forEach(function (opt, i) { revOpts.appendChild(makeOptionBtn(opt, i, handleReviewAnswer)); });
      }
    }

    function handleReviewAnswer(idx) {
      if (reviewAnswered) return;
      reviewAnswered = true;
      var q       = reviewDeck[reviewCurrent];
      var allBtns = revOpts ? revOpts.querySelectorAll('.quiz-option') : [];
      allBtns.forEach(function (b) { b.disabled = true; b.setAttribute('aria-checked', 'false'); });
      if (idx >= 0 && allBtns[idx]) allBtns[idx].setAttribute('aria-checked', 'true');

      if (idx === q.answer) {
        if (allBtns[idx]) allBtns[idx].classList.add('correct');
        if (revFeedback) { revFeedback.innerHTML = '✓ ' + q.ok; revFeedback.className = 'quiz-feedback ok'; }
        reviewScore++;
      } else {
        if (idx >= 0 && allBtns[idx]) {
          allBtns[idx].classList.add('wrong', 'shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        if (revFeedback) { revFeedback.innerHTML = '✗ ' + q.err; revFeedback.className = 'quiz-feedback err'; }
        if (revFocus && q.focus) {
          revFocus.innerHTML    = '<a href="#' + q.focus + '" class="quiz-focus-link">↑ Перечитать этот раздел</a>';
          revFocus.style.display = 'block';
        }
      }

      if (revNextBtn) {
        revNextBtn.textContent    = reviewCurrent < reviewDeck.length - 1 ? 'Следующий →' : 'Завершить разбор →';
        revNextBtn.style.display = 'inline-block';
      }
      if (revFeedback && window.innerWidth < 768) {
        setTimeout(function () { revFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
      }
    }

    function showReviewDone() {
      if (revSection) revSection.style.display = 'none';
      inReview = false;

      if (!revDone) return;
      revDone.style.display = 'block';

      var total    = reviewDeck.length;
      var allRight = reviewScore === total;

      if (revDoneIcon)  revDoneIcon.textContent  = allRight ? '🎯' : '📖';
      if (revDoneTitle) revDoneTitle.textContent  = allRight ? 'Отличная работа!' : 'Разбор завершён';
      if (revDoneDesc) {
        revDoneDesc.innerHTML = allRight
          ? 'Вы правильно ответили на все\u00a0' + total + '\u00a0вопрос' + pluralQ(total) + '. Материал усвоен хорошо.'
          : 'Правильно со второй попытки: <strong>' + reviewScore + '\u00a0из\u00a0' + total + '</strong>. Отметьте разделы, которые стоит перечитать.';
      }

      /* Bonus teaser — shown when bonus exists but not yet unlocked */
      var bonusEnabled = SiteUtils.getConfig('features.quiz.bonusEnabled', false);
      if (revBonusTeaser && bonusEnabled && bonusDeck && score < questions.length) {
        revBonusTeaser.innerHTML =
          '<div class="quiz-bonus-teaser__icon">🔒</div>' +
          '<div class="quiz-bonus-teaser__text"><strong>Бонусный раунд</strong>\u00a0— ответьте правильно на все\u00a0' + questions.length +
          '\u00a0вопросов основного теста, чтобы разблокировать серию повышенной сложности.</div>';
        revBonusTeaser.style.display = 'flex';
      }

      if (allRight) launchConfetti('blue');
      revDone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* Wire review button listeners (direct, no global delegation) */
    if (revStartBtn)  revStartBtn.addEventListener('click',  startReview);
    if (revNextBtn) {
      revNextBtn.addEventListener('click', function () {
        reviewCurrent++;
        if (reviewCurrent < reviewDeck.length) renderReview(); else showReviewDone();
      });
    }
    if (revRestartBtn) revRestartBtn.addEventListener('click', fullRestart);

    /* ---- 15. Bonus round ---- */
    if (bonusBtn && bonusDeck) {
      bonusBtn.addEventListener('click', function () {
        bonusBtn.style.display = 'none';
        if (bonusUnlock) bonusUnlock.style.display = 'none';
        if (bonusBody)   bonusBody.style.display   = 'block';
        startBonusRound();
      });
    }

    function startBonusRound() {
      bonusCurrent = 0; bonusScoreVal = 0; bonusAnswered = false;
      activeDeck = bonusDeck;
      inBonus    = true;
      renderBonus();
    }

    function renderBonus() {
      bonusAnswered = false;
      var q     = bonusDeck[bonusCurrent];
      var total = bonusDeck.length;

      if (bonusBc)    bonusBc.textContent = 'Вопрос ' + (bonusCurrent + 1) + ' из ' + total;
      if (bonusBfill) bonusBfill.style.width = ((bonusCurrent + 1) / total * 100) + '%';
      if (bonusBq)    bonusBq.innerHTML = q.q;
      if (bonusBf)    bonusBf.style.display = 'none';
      if (bonusBfb) { bonusBfb.textContent = ''; bonusBfb.className = 'quiz-feedback'; }
      if (bonusBn)    bonusBn.style.display = 'none';
      if (bonusBo) {
        bonusBo.innerHTML = '';
        bonusBo.setAttribute('role', 'radiogroup');
        bonusBo.setAttribute('aria-labelledby', 'quizBonusQuestion');
        q.options.forEach(function (opt, i) { bonusBo.appendChild(makeOptionBtn(opt, i, handleBonusAnswer)); });
      }
    }

    function handleBonusAnswer(idx) {
      if (bonusAnswered) return;
      bonusAnswered = true;
      var q       = bonusDeck[bonusCurrent];
      if (!bonusBo) return;
      var allBtns = bonusBo.querySelectorAll('.quiz-option');
      allBtns.forEach(function (b) { b.disabled = true; b.setAttribute('aria-checked', 'false'); });
      if (idx >= 0 && allBtns[idx]) allBtns[idx].setAttribute('aria-checked', 'true');

      if (idx === q.answer) {
        if (allBtns[idx]) allBtns[idx].classList.add('correct');
        if (bonusBfb) { bonusBfb.innerHTML = '✓ ' + q.ok; bonusBfb.className = 'quiz-feedback ok'; }
        bonusScoreVal++;
      } else {
        if (idx >= 0 && allBtns[idx]) {
          allBtns[idx].classList.add('wrong', 'shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        if (bonusBfb) { bonusBfb.innerHTML = '✗ ' + q.err; bonusBfb.className = 'quiz-feedback err'; }
        if (bonusBf && q.focus) {
          bonusBf.innerHTML    = '<a href="#' + q.focus + '" class="quiz-focus-link">↑ Перечитать этот раздел</a>';
          bonusBf.style.display = 'block';
        }
      }

      if (bonusBn) {
        bonusBn.textContent    = bonusCurrent < bonusDeck.length - 1 ? 'Следующий вопрос →' : 'Финальный результат →';
        bonusBn.style.display = 'inline-block';
      }
      if (bonusBfb && window.innerWidth < 768) {
        setTimeout(function () { bonusBfb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
      }
    }

    if (bonusBn) {
      bonusBn.addEventListener('click', function () {
        bonusCurrent++;
        if (bonusCurrent < bonusDeck.length) renderBonus(); else showBonusScore();
      });
    }

    function showBonusScore() {
      if (bonusBody)  bonusBody.style.display  = 'none';
      if (bonusScore) bonusScore.style.display = 'block';
      if (bonusBfill) bonusBfill.style.width   = '100%';

      var idx = getScoreBucket(bonusScoreVal, bonusDeck.length, bonusScores);
      var s   = bonusScores ? bonusScores[idx] : { title: bonusScoreVal + '/' + bonusDeck.length, badge: '👑', desc: '' };

      if (bonusSTitle) bonusSTitle.textContent = (s.badge || '') + '\u00a0' + (s.title || '');
      if (bonusSDesc)  bonusSDesc.innerHTML    = s.desc || '';
      if (bonusSBadge) animateCount(bonusSBadge, bonusScoreVal, bonusDeck.length, 800);

      if (bonusScoreVal === bonusDeck.length)         launchConfetti('gold');
      else if (bonusScoreVal >= bonusDeck.length - 1) launchConfetti('blue');
    }

    /* ---- 16. Confetti ---- */
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
      var colors   = palettes[mode] || palettes.light;
      var count    = mode === 'gold' ? 180 : mode === 'blue' ? 130 : 80;
      var duration = mode === 'gold' ? 4000 : mode === 'blue' ? 3500 : 2500;
      var particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,  y: -10 - Math.random() * 200,
          w: 6 + Math.random() * 10,        h: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 4,   vy: 2 + Math.random() * 5,
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.2,
          alpha: 1
        });
      }
      var start = null;
      function frame(ts) {
        if (!start) start = ts;
        var elapsed = ts - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(function (p) {
          p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.08;
          if (elapsed > duration * 0.6) p.alpha = Math.max(0, p.alpha - 0.02);
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (elapsed < duration) requestAnimationFrame(frame);
        else if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
      requestAnimationFrame(frame);
    }

    /* ---- 17. Full restart ---- */
    function fullRestart() {
      current = 0; score = 0; streak = 0; answered = false;
      wrongAnswers   = [];
      inReview       = false; reviewDeck = []; reviewCurrent = 0; reviewAnswered = false; reviewScore = 0;
      inBonus        = false;
      clearTimer();

      sessionSeed = getSessionSeed();
      coreDeck    = prepareDeck(questions, sessionSeed, 'core');
      bonusDeck   = bonusQuestions ? prepareDeck(bonusQuestions, sessionSeed + 41, 'bonus') : null;
      activeDeck  = coreDeck;

      /* Hide all result/review/bonus screens */
      if (resultEl)    resultEl.style.display    = 'none';
      if (revStartBtn) revStartBtn.style.display = 'none';
      if (revSection)  revSection.style.display  = 'none';
      if (revDone)     revDone.style.display      = 'none';
      if (scoreEl)     scoreEl.style.display      = 'none';
      if (bonusSection) bonusSection.style.display = 'none';
      if (bonusBody)    bonusBody.style.display    = 'none';
      if (bonusScore)   bonusScore.style.display   = 'none';
      streakBadge.style.display = 'none';

      if (body) body.style.display = 'block';
      render();
    }

    if (restart) restart.addEventListener('click', fullRestart);

    /* ---- 18. Share ---- */
    if (share && SiteUtils.getConfig('features.quiz.shareResults', true)) {
      share.addEventListener('click', function () {
        var scoreText = score + ' из ' + questions.length;
        var idx       = getScoreBucket(score, questions.length, scores);
        var s         = scores ? scores[idx] : null;
        var shareMsg  = 'Мой результат: ' + scoreText + (s && s.title ? ' — «' + s.title + '»' : '');
        if (window.SiteShare) {
          var sdTitle   = document.getElementById('sd-title');
          var origTitle = sdTitle ? sdTitle.textContent : '';
          if (sdTitle) sdTitle.textContent = shareMsg;
          window.SiteShare.open(share);
          if (sdTitle) setTimeout(function () { sdTitle.textContent = origTitle; }, 100);
        }
      });
    }

    /* ---- 19. Start ---- */
    function startQuiz() {
      render();
      if (quizMain) quizMain.classList.remove('quiz-main--hidden');
      if (quizOverlay) {
        quizOverlay.classList.add('fade-out');
        quizOverlay.addEventListener('animationend', function () { quizOverlay.style.display = 'none'; }, { once: true });
      }
    }

    if (quizLaunch) quizLaunch.addEventListener('click', startQuiz); else startQuiz();

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
            if (navigator.vibrate) navigator.vibrate(30); /* Fix #12: haptic */
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
     19. Bible Reference Tooltips (bref / btip)
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
     20. Academic Footnotes (fn-marker / tooltip)
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
    /* Fix #4: на тачскрине click может не срабатывать на нетипируемых элементах —
       touchstart надёжнее закрывает тултип при тапе вне маркера */
    document.addEventListener('touchstart', function (e) {
      if (!e.target.closest('.fn-marker') && !e.target.closest('.tooltip')) closeFootnotes();
    }, { passive: true });

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
     20b. Glossary Terms (gterm / gtip)
     ============================================================ */
  (function () {
    var gterms = document.querySelectorAll('.gterm');
    if (!gterms.length) return;

    var activeGterm = null;
    var justOpened = false;

    function closeGlossary() {
      if (justOpened) return;
      if (activeGterm) {
        var tip = activeGterm.querySelector('.gtip');
        activeGterm.classList.remove('is-open');
        activeGterm = null;
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

    function positionGtip(gt) {
      var tip = gt.querySelector('.gtip');
      if (!tip) return;
      tip.style.visibility = 'hidden';
      tip.style.left = '0px';
      tip.style.top = '0px';
      var r = gt.getBoundingClientRect();
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var mg = 16, vw = window.innerWidth, vh = window.innerHeight;
      var left = r.left + r.width / 2 - tw / 2;
      if (left + tw > vw - mg) left = vw - mg - tw;
      if (left < mg) left = mg;
      var top = r.top - th - 8;
      if (top >= mg) { tip.style.left = left+'px'; tip.style.top = top+'px'; tip.style.visibility=''; return; }
      top = r.bottom + 8;
      if (top + th <= vh - mg) { tip.style.left = left+'px'; tip.style.top = top+'px'; tip.style.visibility=''; return; }
      var avT = r.top - mg - 8, avB = vh - mg - r.bottom - 8;
      if (avT >= avB) {
        tip.style.maxHeight = avT+'px'; tip.style.overflowY='auto';
        tip.style.left = left+'px'; tip.style.top = mg+'px';
      } else {
        tip.style.maxHeight = avB+'px'; tip.style.overflowY='auto';
        tip.style.left = left+'px'; tip.style.top = (r.bottom+8)+'px';
      }
      tip.style.visibility = '';
    }

    function openGtip(gt) {
      closeGlossary();
      gt.classList.add('is-open');
      activeGterm = gt;
      positionGtip(gt);
      justOpened = true;
      setTimeout(function () { justOpened = false; }, 350);
    }

    gterms.forEach(function (gt) {
      var moved = false;
      gt.addEventListener('touchstart', function () { moved = false; }, { passive: true });
      gt.addEventListener('touchmove', function () { moved = true; }, { passive: true });
      gt.addEventListener('touchend', function (e) {
        if (moved) return;
        e.preventDefault();
        if (activeGterm === gt) { justOpened = false; closeGlossary(); }
        else { openGtip(gt); }
      }, { passive: false });
      gt.addEventListener('click', function (e) {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) { e.preventDefault(); return; }
        e.preventDefault(); e.stopPropagation();
        if (activeGterm === gt) { closeGlossary(); return; }
        openGtip(gt);
      });
      gt.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          positionGtip(gt); gt.classList.add('is-open'); activeGterm = gt;
        }
      });
      gt.addEventListener('mouseleave', function () {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        var tip = gt.querySelector('.gtip');
        if (tip && tip.matches(':hover')) return;
        closeGlossary();
      });
      gt.addEventListener('focus', function () { openGtip(gt); });
      gt.addEventListener('blur', function () { closeGlossary(); });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.gterm') && !e.target.closest('.gtip')) closeGlossary();
    });
    document.addEventListener('touchstart', function (e) {
      if (!e.target.closest('.gterm') && !e.target.closest('.gtip')) closeGlossary();
    }, { passive: true });
    window.addEventListener('resize', closeGlossary, { passive: true });
    window.addEventListener('orientationchange', closeGlossary, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeGlossary(); });
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

      /* Не перехватываем шорткаты пока открыт любой модальный оверлей */
      if (document.querySelector('#share-dialog-overlay.is-open')) return;

      var key = e.key.toLowerCase();

      /* T — открыть/закрыть TOC */
      if (key === 't') {
        e.preventDefault();
        showKbdHint('T', 'Оглавление');

        var overlay = document.getElementById('btocOverlay');
        if (overlay) {
          if (overlay.classList.contains('open')) {
            /* Используем SiteBTOC.close — он полностью сбрасывает состояние:
               overscrollBehavior, focus trap, фокус, видимость бара */
            if (window.SiteBTOC) { window.SiteBTOC.close(); }
            else { overlay.classList.remove('open'); document.body.style.overflow = ''; }
          } else {
            if (window.SiteBTOC) { window.SiteBTOC.open(); }
            else {
              var sBtn = document.getElementById('barSectionBtn');
              if (sBtn) { sBtn.click(); } else { overlay.classList.add('open'); }
            }
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
        /* Guard: пустой rect возникает при выделении через fn-marker — прячем попап */
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
     26a. Auto Drop Cap — первый <p> статьи получает .drop-cap
     Вынесен из Quiz IIFE (bug fix): ранее не срабатывал на
     страницах без квиза из-за двух ранних return в module 16.
     ============================================================ */
  (function () {
    if (SiteUtils.getConfig('page.type', '') !== 'article') return;
    /* Тип C (Переводы) — drop-cap не применяется: академический текст,
       первый абзац содержит inline-сноски и форматирование переводчика */
    if (SiteUtils.getConfig('page.section', '') === 'Переводы') return;

    var article = document.querySelector('article');
    if (!article) return;

    /* Уже есть — пропускаем */
    if (article.querySelector('.drop-cap')) return;

    var body = article.querySelector('.article-body') || article;
    var firstP = body.querySelector('p');
    if (firstP && firstP.textContent.trim().length > 40) {
      firstP.classList.add('drop-cap');
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

    var _closeTimer = null;

    function open(src, alt, captionText) {
      /* Отменяем отложенную очистку, если viewer переоткрыли до её срабатывания */
      if (_closeTimer !== null) { clearTimeout(_closeTimer); _closeTimer = null; }
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
      document.documentElement.style.overflow = '';
      if (lastActive && lastActive.focus) lastActive.focus();
      lastActive = null;
      /* Откладываем очистку src/cap до окончания fade-out (.2s);
         токен _closeTimer позволяет отменить очистку при быстром повторном открытии. */
      _closeTimer = setTimeout(function () {
        _closeTimer = null;
        imgEl.removeAttribute('src');
        capEl.textContent = '';
      }, 220);
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


  /* ============================================================
     28. Font Size Control — a / A
     Сохраняет выбор в localStorage, применяет через CSS-переменную.
     Инжектируется в два места:
       — .btoc-footer        (мобильный оверлей-панель)
       — #tocSidebar         (десктопная боковая панель)
     Исправления v7:
       [1] desktop: инжект в #tocSidebar
       [2] disabled-атрибут на крайних значениях
       [3] dot-track индикатор текущего уровня
       [4] убрана мёртвая .btoc-fontsize-hint «размер»
       [5] симметричные кнопки a / A (одинаковый font-size через CSS)
       [6] padding убран с .btoc-fontsize — наследуется от родителя
     ============================================================ */
  (function () {
    var SIZES = [14, 16, 17, 19, 21];
    var LS_KEY = 'gb-font-size-idx';
    var idx = 2; /* 17px — дефолт */
    try {
      var saved = parseInt(localStorage.getItem(LS_KEY), 10);
      if (!isNaN(saved) && saved >= 0 && saved < SIZES.length) idx = saved;
    } catch (e) {}

    /* Все отрендеренные контролы — обновляем синхронно */
    var allControls = [];

    function syncControls() {
      allControls.forEach(function (ctrl) {
        ctrl.btnDown.disabled = (idx === 0);
        ctrl.btnUp.disabled   = (idx === SIZES.length - 1);
        ctrl.dots.forEach(function (dot, i) {
          dot.classList.toggle('btoc-fontsize-dot--active', i <= idx);
        });
      });
    }

    function apply() {
      document.documentElement.style.setProperty('--article-font-size', SIZES[idx] + 'px');
      document.body.setAttribute('data-font-idx', idx);
      syncControls();
    }
    function save() {
      try { localStorage.setItem(LS_KEY, String(idx)); } catch (e) {}
      apply();
    }
    function up()   { if (idx < SIZES.length - 1) { idx++; save(); } }
    function down() { if (idx > 0)                { idx--; save(); } }

    apply(); /* применяем сразу при загрузке */

    /* Строим DOM контрола и регистрируем его */
    function buildControl(variant) {
      /* variant: 'footer' | 'sidebar' */
      var row = document.createElement('div');
      row.className = 'btoc-fontsize btoc-fontsize--' + variant;

      var icon = document.createElement('span');
      icon.className = 'btoc-fontsize-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'Аа';

      var btnDown = document.createElement('button');
      btnDown.className = 'btoc-fontsize-btn';
      btnDown.setAttribute('aria-label', 'Уменьшить шрифт');
      btnDown.textContent = 'a';

      /* dot-track: 5 точек = 5 уровней */
      var track = document.createElement('div');
      track.className = 'btoc-fontsize-track';
      var dots = [];
      for (var i = 0; i < SIZES.length; i++) {
        var dot = document.createElement('span');
        dot.className = 'btoc-fontsize-dot';
        track.appendChild(dot);
        dots.push(dot);
      }

      var btnUp = document.createElement('button');
      btnUp.className = 'btoc-fontsize-btn';
      btnUp.setAttribute('aria-label', 'Увеличить шрифт');
      btnUp.textContent = 'A';

      row.appendChild(icon);
      row.appendChild(btnDown);
      row.appendChild(track);
      row.appendChild(btnUp);

      btnDown.addEventListener('click', down);
      btnUp.addEventListener('click', up);

      var ctrl = { row: row, btnDown: btnDown, btnUp: btnUp, dots: dots };
      allControls.push(ctrl);
      return ctrl;
    }

    /* Инжектируем в .btoc-footer (мобильный оверлей) */
    function injectFooter() {
      var footer = document.querySelector('.btoc-footer');
      if (!footer || footer.querySelector('.btoc-fontsize')) return;
      var ctrl = buildControl('footer');
      footer.insertBefore(ctrl.row, footer.firstChild);
      syncControls();
    }

    /* Инжектируем в #tocSidebar (десктоп) */
    function injectSidebar() {
      var sidebar = document.getElementById('tocSidebar');
      if (!sidebar || sidebar.querySelector('.btoc-fontsize')) return;
      var ctrl = buildControl('sidebar');
      sidebar.appendChild(ctrl.row);
      syncControls();
    }

    function injectAll() {
      injectFooter();
      injectSidebar();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectAll);
    } else {
      injectAll();
    }

    window.SiteFontSize = { up: up, down: down };
  })();


  /* ============================================================
     29. Article Read Completion — Feature #13
     При progress >= 98% помечает btoc прочитанным:
     прогресс-бар становится зелёным, добавляется класс .completed
     на панель. Визуально ненавязчиво — без модалок и попапов.
     ============================================================ */
  (function () {
    var panel = document.getElementById('btocPanel');
    var fill  = document.getElementById('btocProgressFill');
    if (!panel || !fill) return;

    var marked = false;
    window.addEventListener('scroll', function () {
      if (marked) return;
      var scrollY = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? Math.round((scrollY / docH) * 100) : 0;
      if (pct < 98) return;
      marked = true;
      panel.classList.add('btoc-completed');
      fill.classList.add('btoc-progress-fill-done');
      /* Сохраняем в BookmarkEngine если он есть */
      try {
        if (window.BookmarkEngine && typeof window.BookmarkEngine.markCompleted === 'function') {
          window.BookmarkEngine.markCompleted();
        }
      } catch (e) {}
    }, { passive: true });
  })();

  /* ============================================================
     INTERACTIVE TITLE — при hover на «Сила Моя» буквы
     появляются с лёгкой волной (staggered fade-in по слогам).
     ============================================================ */
  (function () {
    var hi = document.querySelector('.sti-highlight');
    if (!hi) return;

    // Разбиваем текст на символы с span-обёртками
    var text = hi.textContent;
    hi.textContent = '';
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.textContent = text[i];
      s.style.cssText = 'display:inline-block;transition:transform .3s ease,opacity .3s ease;transition-delay:' + (i * 22) + 'ms';
      hi.appendChild(s);
    }

    var chars = hi.querySelectorAll('span');
    var title = document.querySelector('.site-title-interactive');
    if (!title) return;

    title.addEventListener('mouseenter', function () {
      chars.forEach(function (c) {
        c.style.transform = 'translateY(-2px)';
        c.style.opacity   = '1';
      });
    });
    title.addEventListener('mouseleave', function () {
      chars.forEach(function (c) {
        c.style.transform = '';
        c.style.opacity   = '';
      });
    });
  })();

  /* ============================================================
     FAQ ACCORDION — стандарт 2025: button + aria-expanded + grid-animation.
     Разметка (эталон, см. AGENTS.md § FAQ-компонент):
       <div class="faq-accordion__item">
         <button class="faq-accordion__q" aria-expanded="false">
           Текст вопроса
           <span class="faq-accordion__icon" aria-hidden="true"></span>
         </button>
         <div class="faq-accordion__body">
           <div class="faq-accordion__body-inner">Текст ответа</div>
         </div>
       </div>
     ============================================================ */
  (function () {
    document.querySelectorAll('.faq-accordion__q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq-accordion__item');
        if (!item) return;
        var isOpen = item.classList.contains('open');
        item.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  })();

  /* ============================================================
     IMAGE SHIMMER — добавляем .img-loaded после загрузки изображения,
     снимая CSS shimmer-анимацию и включая плавное появление.
     ============================================================ */
  (function () {
    var sel = '.article-figure img, .related-articles__img, .card-cover, .article-hero img';
    document.querySelectorAll(sel).forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('img-loaded');
      } else {
        img.addEventListener('load',  function () { img.classList.add('img-loaded'); });
        img.addEventListener('error', function () { img.classList.add('img-loaded'); });
      }
    });
  })();


})();
