/* ============================================================
   site.js — Господь Бог — Сила Моя
   Единый общий JS для всего сайта
   Версия 1.6.0 (sync: package.json)

   Структура (модули внутри основного IIFE, lines 40..~4582):
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
   26. Article Date Display — дата публикации/обновления из meta
   26a. Auto Drop Cap — первый <p> (не применяется к Типу C)
   27. Article End Block — кнопки «Поделиться» + «Распечатать/PDF» + SDG + крест
   28. Font Size Control — a / A (.btoc-footer + #tocSidebar)

   Модули после основного IIFE (отдельные IIFE):
   29. Floating Controls (UNIFIED) — единый sticky-блок «тема + поиск»
       (AGENTS-r17, заменяет legacy .theme-float-btn / #themeFloat /
        #gbSearchFloat / .nag-sidebar-theme-btn — все удалены в PLAN-04 P5)
   30. Glossary cross-ref clicks внутри тултипов (AGENTS-r17)

   Каждый модуль проверяет наличие нужных DOM-элементов
   и просто ничего не делает, если их нет.
   ============================================================ */

(function () {
  'use strict';


  /* SVG dedup: общие префиксы для нескольких иконок этого модуля.
     Объявлены ДО первого использования (исправлено в r58). */
  var SVG_ICON_114 = '<svg viewBox="0 0 24 24" width="16" height="16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var SVG_ICON_148 = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

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

    /* ── Shared tooltip positioning ──────────────────────────────────────
       Positions `tip` (fixed/absolute element) relative to `anchor`.
       Prefers above; falls back to below; constrains to viewport.
       If neither fits, uses the larger side with overflow-y scroll.    */
    positionTip: function (tip, anchor) {
      if (!tip || !anchor) return;
      tip.style.display    = 'block';
      tip.style.visibility = 'hidden';
      tip.style.left       = '0px';
      tip.style.top        = '0px';
      tip.style.maxHeight  = '';
      tip.style.overflowY  = '';

      var r   = anchor.getBoundingClientRect();
      var tw  = tip.offsetWidth;
      var th  = tip.offsetHeight;
      var mg  = 16;
      var vw  = window.innerWidth;
      var vh  = window.innerHeight;

      var left = r.left + r.width / 2 - tw / 2;
      if (left + tw > vw - mg) left = vw - mg - tw;
      if (left < mg)           left = mg;
      if (tw > 0) {
        var arrowX = this.clamp(r.left + r.width / 2 - left, 18, Math.max(18, tw - 18));
        tip.style.setProperty('--gb-tip-arrow-x', arrowX + 'px');
      }

      var top = r.top - th - 8;
      if (top >= mg) {
        tip.style.left = left + 'px'; tip.style.top = top + 'px';
        tip.dataset.placement = 'top';
        tip.style.visibility = ''; return;
      }
      top = r.bottom + 8;
      if (top + th <= vh - mg) {
        tip.style.left = left + 'px'; tip.style.top = top + 'px';
        tip.dataset.placement = 'bottom';
        tip.style.visibility = ''; return;
      }
      /* Neither fits cleanly — use whichever side has more room */
      var avT = r.top - mg - 8;
      var avB = vh - mg - r.bottom - 8;
      if (avT >= avB) {
        tip.style.maxHeight = avT + 'px'; tip.style.overflowY = 'auto';
        tip.style.left = left + 'px'; tip.style.top = mg + 'px';
        tip.dataset.placement = 'top';
      } else {
        tip.style.maxHeight = avB + 'px'; tip.style.overflowY = 'auto';
        tip.style.left = left + 'px'; tip.style.top = (r.bottom + 8) + 'px';
        tip.dataset.placement = 'bottom';
      }
      tip.style.visibility = '';
    },

    /* ── Tooltip Controller Factory ────────────────────────────────────
       O-02: единая реализация hover/touch/click логики для всех трёх
       систем подсказок (Bible refs, Footnotes, Glossary).

       Параметры:
         anchorSel  — CSS-селектор якорных элементов (.bref, .fn-marker, .gterm)
         tipSel     — CSS-селектор самого тултипа внутри якоря (.btip, .tooltip, .gtip)
         opts       — опциональные настройки:
           useFocusBlur {bool}   — вешать focus/blur (для glossary, умолчание false)
           extraCloseSelectors {string[]} — дополнительные контейнеры, scroll → close
           touchStartExtra {function(el)} — extra logic before document touchstart check
                                                                                      */
    pluralRu: function (n, one, few, many) {
      var abs = Math.abs(n) % 100;
      var tens = abs % 10;
      if (abs > 10 && abs < 20) return many;
      if (tens > 1 && tens < 5) return few;
      if (tens === 1) return one;
      return many;
    },
        makeTooltipController: function (anchorSel, tipSel, opts) {
      /* AUDIT V2 / ARCH-1 + BUGFIX 2026-05-28:
         Контроллер по-прежнему delegated, но глобальные listeners теперь
         ставятся один раз на все типы подсказок. Раньше три вызова
         makeTooltipController(.bref/.fn-marker/.gterm) дублировали один и тот
         же набор document/window handlers; теперь вызов только регистрирует
         конфиг в общем диспетчере. */
      var utils = this;
      opts = opts || {};

      if (!utils._tooltipControllers) utils._tooltipControllers = [];

      function closestFrom(target, selector) {
        if (!target) return null;
        if (target.closest) return target.closest(selector);
        if (target.parentElement && target.parentElement.closest) return target.parentElement.closest(selector);
        return null;
      }

      function makeController() {
        var GUARD_DELAY = 350;
        var controller = {
          anchorSel: anchorSel,
          tipSel: tipSel,
          opts: opts,
          activeEl: null,
          justOpened: false,
          isDesktop: function () {
            return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
          },
          isMobileSheet: function () {
            var bp = Number(controller.opts.mobileSheetBreakpoint || 768);
            return !!controller.opts.mobileSheet && window.matchMedia('(max-width: ' + bp + 'px)').matches;
          },
          scrollLockSource: 'tooltip-mobile-sheet',
          scrollLocked: false,
          activeTip: null,
          tipPlaceholder: null,
          mountTip: function (tip) {
            if (!tip) return;
            if (tip.parentNode !== document.body) {
              controller.tipPlaceholder = document.createComment('gb-tooltip-placeholder');
              tip.parentNode.insertBefore(controller.tipPlaceholder, tip);
              document.body.appendChild(tip);
            }
            tip.classList.add('gb-floating-tip', 'is-open');
            controller.activeTip = tip;
          },
          restoreTip: function (tip) {
            if (!tip) return;
            tip.classList.remove('is-open');
            if (controller.tipPlaceholder && controller.tipPlaceholder.parentNode) {
              controller.tipPlaceholder.parentNode.insertBefore(tip, controller.tipPlaceholder);
              controller.tipPlaceholder.parentNode.removeChild(controller.tipPlaceholder);
            }
            tip.classList.remove('gb-floating-tip');
            controller.tipPlaceholder = null;
            if (controller.activeTip === tip) controller.activeTip = null;
          },
          resetTipStyles: function (tip) {
            if (!tip) return;
            setTimeout(function () {
              if (controller.activeTip === tip) return;
              tip.style.maxHeight  = '';
              tip.style.overflowY  = '';
              tip.style.visibility = '';
              tip.style.top        = '-9999px';
              tip.style.left       = '-9999px';
              tip.style.removeProperty('--gb-tip-arrow-x');
            }, 200);
          },
          close: function (force) {
            if (!force && controller.justOpened) return;
            if (controller.activeEl) {
              var tip = controller.activeTip || controller.activeEl.querySelector(controller.tipSel);
              controller.activeEl.classList.remove('is-open');
              controller.activeEl.setAttribute('aria-expanded', 'false');
              controller.restoreTip(tip);
              controller.resetTipStyles(tip);
              controller.activeEl = null;
            }
            if (!(utils._tooltipControllers || []).some(function (c) { return c.activeEl; })) {
              document.documentElement.classList.remove('gb-tooltip-open');
            }
            if (controller.scrollLocked) {
              utils.unlockScroll(controller.scrollLockSource);
              controller.scrollLocked = false;
            }
          },
          open: function (el) {
            if (!el) return;
            var tip = el.querySelector(controller.tipSel);
            if (!tip) return;
            utils._tooltipControllers.forEach(function (c) {
              if (c !== controller) c.close(true);
            });
            controller.close(true);
            utils._tooltipSuppressScrollUntil = Date.now() + 160;
            document.documentElement.classList.add('gb-tooltip-open');
            el.classList.add('is-open');
            el.setAttribute('aria-expanded', 'true');
            controller.activeEl = el;
            controller.mountTip(tip);
            utils.positionTip(tip, el);
            if (controller.isMobileSheet() && !controller.scrollLocked) {
              utils.lockScroll(controller.scrollLockSource);
              controller.scrollLocked = true;
            }
            controller.justOpened = true;
            setTimeout(function () { controller.justOpened = false; }, GUARD_DELAY);
          }
        };
        return controller;
      }

      var controller = makeController();
      utils._tooltipControllers.push(controller);

      function findHit(e, predicate) {
        var list = utils._tooltipControllers || [];
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (predicate && !predicate(c)) continue;
          var anchor = closestFrom(e.target, c.anchorSel);
          if (anchor && (anchor.querySelector(c.tipSel) || c.activeEl === anchor)) {
            return { controller: c, anchor: anchor };
          }
        }
        return null;
      }

      function isInsideAnyTip(e) {
        return (utils._tooltipControllers || []).some(function (c) {
          return !!closestFrom(e.target, c.tipSel);
        });
      }

      function closeAll(force) {
        (utils._tooltipControllers || []).forEach(function (c) { c.close(!!force); });
      }

      function closeAllExceptTipTarget(e) {
        (utils._tooltipControllers || []).forEach(function (c) {
          if (!closestFrom(e.target, c.tipSel)) c.close();
        });
      }

      if (!utils._tooltipDispatcherInstalled) {
        utils._tooltipDispatcherInstalled = true;
        utils._tooltipTouchMoved = false;

        document.addEventListener('touchstart', function () {
          utils._tooltipTouchMoved = false;
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
          utils._tooltipTouchMoved = true;
          closeAllExceptTipTarget(e);
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
          if (isInsideAnyTip(e)) return;
          var hit = findHit(e);
          if (hit) {
            if (utils._tooltipTouchMoved) return;
            e.preventDefault();
            if (hit.controller.activeEl === hit.anchor) {
              hit.controller.justOpened = false;
              hit.controller.close(true);
            } else {
              hit.controller.open(hit.anchor);
            }
            return;
          }
          if (!isInsideAnyTip(e)) closeAll();
        }, { passive: false });

        document.addEventListener('click', function (e) {
          if (closestFrom(e.target, '[data-tooltip-close]')) {
            e.preventDefault();
            e.stopPropagation();
            closeAll(true);
            return;
          }
          if (isInsideAnyTip(e)) return;
          var hit = findHit(e);
          if (hit) {
            if (!hit.controller.isDesktop()) { e.preventDefault(); return; }
            e.preventDefault();
            e.stopPropagation();
            if (hit.controller.activeEl === hit.anchor) return;
            hit.controller.open(hit.anchor);
            return;
          }
          if (!isInsideAnyTip(e)) closeAll();
        });

        document.addEventListener('pointerover', function (e) {
          var hit = findHit(e, function (c) { return c.isDesktop(); });
          if (!hit) return;
          var c = hit.controller;
          var anchor = hit.anchor;
          if (c.activeEl === anchor) {
            utils.positionTip(c.activeTip || anchor.querySelector(c.tipSel), anchor);
            return;
          }
          c.open(anchor);
        });

        document.addEventListener('pointerout', function (e) {
          var hit = findHit(e, function (c) { return c.isDesktop(); });
          if (!hit) return;
          var c = hit.controller;
          var anchor = hit.anchor;
          var related = e.relatedTarget;
          if (related && related.closest && (related.closest(c.anchorSel) === anchor || related.closest(c.tipSel))) return;
          var tip = anchor.querySelector(c.tipSel);
          if (tip && tip.matches && tip.matches(':hover')) return;
          if (tip && tip.style.overflowY === 'auto') return;
          if (c.activeEl === anchor) c.close();
        });

        document.addEventListener('focusin', function (e) {
          var hit = findHit(e, function (c) { return !!c.opts.useFocusBlur; });
          if (hit) hit.controller.open(hit.anchor);
        });

        document.addEventListener('focusout', function (e) {
          var hit = findHit(e, function (c) { return !!c.opts.useFocusBlur; });
          if (!hit) return;
          var next = e.relatedTarget;
          if (next && (hit.anchor.contains(next) || closestFrom(next, hit.controller.tipSel))) return;
          hit.controller.close();
        });

        document.addEventListener('keydown', function (e) {
          if (SiteUtils.isEscape(e)) closeAll(true);
        });

        window.addEventListener('scroll', function () {
          if (Date.now() < (utils._tooltipSuppressScrollUntil || 0)) return;
          closeAll();
        }, { passive: true });
        window.addEventListener('resize', function () { SiteUtils._cachedDocH = 0; closeAll(); }, { passive: true });
        window.addEventListener('orientationchange', closeAll, { passive: true });
        window.addEventListener('wheel', closeAllExceptTipTarget, { passive: true });
      }

      if (opts.extraCloseSelectors) {
        opts.extraCloseSelectors.forEach(function (sel) {
          document.querySelectorAll(sel).forEach(function (el) {
            el.addEventListener('scroll', function () { controller.close(); }, { passive: true });
          });
        });
      }

      return { open: controller.open, close: controller.close };
    },

    /* ── Scroll-lock counter ─────────────────────────────────────────────
       Prevents race condition when multiple panels use overflow:hidden.
       Each lockScroll() increments; unlockScroll() decrements and only
       removes overflow once the counter reaches zero.                   */
    _scrollLockCount: 0,
    _savedScrollY: 0,
    _scrollLockSources: {},

    _normalizeScrollLockSource: function (source) {
      return (typeof source === 'string' && source.trim()) ? source.trim() : '__anonymous__';
    },

    _refreshScrollLockCount: function () {
      this._scrollLockCount = Object.keys(this._scrollLockSources).length;
      return this._scrollLockCount;
    },

    prefersReducedMotion: function () {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    scrollToTop: function () {
      window.scrollTo({ top: 0, behavior: this.prefersReducedMotion() ? 'auto' : 'smooth' });
    },

    /* AUDIT V4 / M2: iOS-safe scroll-lock.
       На iOS Safari overflow:hidden не блокирует rubber-band и теряет
       позицию. Решение: position:fixed; top: -scrollY на body.

       BUGFIX 2026-05-23:
       lock/unlock теперь source-aware.
     * ════════════════════════════════════════════════════════
     * SCROLL-LOCK API — универсальный механизм.
     * Sources: toc-mobile, btoc, image-viewer, cp-menu.
     * lockScroll(src)  → increment, freeze body at scrollY.
     * unlockScroll(src) → decrement, restore when all freed.
     * Source-aware: повторный lock того же src — no-op.
     * pagehide cleanup → bfcache hygiene (iOS Safari).
     * ════════════════════════════════════════════════════════
 Повторный open() одного и того же
       оверлея больше не увеличивает счётчик и не оставляет страницу
       навсегда scroll-locked после одного close(). */
    lockScroll: function (source) {
      var key = this._normalizeScrollLockSource(source);
      if (this._scrollLockSources[key]) return;
      this._scrollLockSources[key] = true;
      if (window.SiteUtils && typeof window.SiteUtils._startEmergencyTimer === 'function') {
        window.SiteUtils._startEmergencyTimer();
      }
      if (this._refreshScrollLockCount() === 1) {
        var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
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
        body.style.paddingRight = scrollbarWidth + 'px';
        document.documentElement.classList.remove('cp-scroll-lock');
        document.documentElement.dataset.scrollLocked = '1';
      }
    },

    unlockScroll: function (source) {
      var key = this._normalizeScrollLockSource(source);
      if (!this._scrollLockSources[key]) return;
      delete this._scrollLockSources[key];
      if (this._refreshScrollLockCount() === 0) {
        if (window.SiteUtils && typeof window.SiteUtils._stopEmergencyTimer === 'function') {
          window.SiteUtils._stopEmergencyTimer();
        }
        var body = document.body;
        var savedY = this._savedScrollY;
        body.style.removeProperty('overflow');
        body.style.removeProperty('overscroll-behavior');
        body.style.removeProperty('position');
        body.style.removeProperty('top');
        body.style.removeProperty('left');
        body.style.removeProperty('right');
        body.style.removeProperty('width');
        body.style.removeProperty('padding-right');
        document.documentElement.classList.remove('cp-scroll-lock');
        delete document.documentElement.dataset.scrollLocked;
        /* Восстанавливаем scrollY синхронно — иначе rAF может моргнуть */
        window.scrollTo(0, savedY);
      }
    },

    forceUnlockEmergency: function () {
      this._scrollLockSources = {};
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
      body.style.removeProperty('padding-right');
      document.documentElement.classList.remove('cp-scroll-lock');
      delete document.documentElement.dataset.scrollLocked;
      if (savedY) window.scrollTo(0, savedY);
    },

    articleEl: function () {
      if (!SiteUtils._articleEl) {
        SiteUtils._articleEl = document.querySelector('article') || null;
      }
      return SiteUtils._articleEl;
    },

    h1El: function () {
      if (!SiteUtils._h1El) {
        SiteUtils._h1El = document.querySelector('article h1, .article-header h1, h1') || null;
      }
      return SiteUtils._h1El;
    },

    scrollRaf: function (callback, opts) {
      /* rAF-throttled scroll listener. Returns remove function. */
      var ticking = false;
      opts = opts || {};
      var el = opts.el || window;
      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          callback();
          ticking = false;
        });
      }
      el.addEventListener('scroll', onScroll, { passive: true });
      return function () { el.removeEventListener('scroll', onScroll); };
    },

    pageType: function () {
      /* Cached: page type from SITE_CONFIG (article, home, catalog, etc.) */
      if (!SiteUtils._pageType) {
        SiteUtils._pageType = SiteUtils.getConfig('page.type', '');
      }
      return SiteUtils._pageType;
    },

    themeKey: 'theme', /* localStorage key — единое место */



    isEscape: function (e) {
      return e.key === 'Escape' || e.key === 'Esc';
    },
    isArticle: function () {
      return SiteUtils.pageType() === 'article';
    },
    isHome: function () {
      return SiteUtils.pageType() === 'home';
    },
    docH: function () {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight || 0
      ) - window.innerHeight;
    },

    featureToc: function (def) {
      return SiteUtils.getConfig('features.toc', def !== undefined ? def : true);
    },
    featureShare: function (def) {
      return SiteUtils.getConfig('features.share', def !== undefined ? def : true);
    },

    barThemeBtn: function () {
      /* Кнопка темы в bottom-bar (мобильная). Кэшируется после первого вызова. */
      if (SiteUtils._barThemeBtn === undefined) {
        SiteUtils._barThemeBtn = document.getElementById('barThemeBtn') || null;
      }
      return SiteUtils._barThemeBtn;
    },

    ready: function (fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        fn();
      }
    },

    copyText: function (text, onSuccess, onError) {
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        if (ok && onSuccess) onSuccess();
        else if (!ok && onError) onError();
        return ok ? Promise.resolve() : Promise.reject();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () {
          if (onSuccess) onSuccess();
        }).catch(function () {
          return fallback();
        });
      }
      return fallback();
    }
  };

  /* BUGFIX 2026-05-30: merge вместо полной замены, чтобы не уничтожить методы,
     добавленные site-utils.js (lockScroll/unlockScroll/forceUnlockScroll)
     и scroll-perf.js (scheduleHebrewMeasure), которые загружаются раньше site.js. */
  if (window.SiteUtils) {
    for (var __k in SiteUtils) {
      if (Object.prototype.hasOwnProperty.call(SiteUtils, __k)) window.SiteUtils[__k] = SiteUtils[__k];
    }
  } else {
    window.SiteUtils = SiteUtils;
  }

  /* ============================================================
     01b. SITE_CONFIG Contract Guard
     ============================================================ */
  (function validateSiteConfigContract() {
    var cfg = window.SITE_CONFIG;
    var errors = [];
    function has(path, type) {
      var cur = cfg;
      var parts = path.split('.');
      for (var i = 0; i < parts.length; i++) {
        if (cur == null || typeof cur !== 'object' || !(parts[i] in cur)) {
          errors.push(path + ' отсутствует');
          return;
        }
        cur = cur[parts[i]];
      }
      if (type && typeof cur !== type) errors.push(path + ' должен быть ' + type);
    }

    if (!cfg || typeof cfg !== 'object') {
      errors.push('window.SITE_CONFIG отсутствует или не объект');
    } else {
      has('site.name', 'string');
      has('site.baseUrl', 'string');
      has('site.locale', 'string');
      has('page.type', 'string');
      has('page.id', 'string');
      has('page.title', 'string');
      if (cfg.features && typeof cfg.features !== 'object') errors.push('features должен быть объектом');
      if (cfg.page && cfg.page.type === 'article') {
        if (!cfg.page.id || !/^[a-z0-9-]+$/.test(cfg.page.id)) errors.push('page.id статьи должен быть slug-like');
        if (cfg.features && cfg.features.quiz && cfg.features.quiz.enabled && (!cfg.quiz || !Array.isArray(cfg.quiz.questions))) {
          errors.push('features.quiz.enabled=true требует quiz.questions[]');
        }
      }
    }

    if (errors.length) {
      document.documentElement.dataset.siteConfigInvalid = '1';
      if (window.console && console.error) console.error('[SITE_CONFIG contract]', errors);
    }
  })();

  /* ════════════════════════════════════════════════════════════════════
     AUDIT V9 / #130: visualViewport tracker — premium implementation
     ════════════════════════════════════════════════════════════════════
     Cмысл: на мобильном виртуальная клавиатура отъедает до ~280px высоты.
     Без этого хелпера Command Palette (.cp-box max-height: 75vh) уходит
     нижними результатами под клавиатуру — пользователь не видит хвост.

     Решение: при каждом изменении visualViewport обновляем CSS-переменную
     --cp-max-h на <html>. CSS использует её через
       max-height: var(--cp-max-h, fallback);

     Премиум-оптимизации:
       1. rAF batching — обновляем не чаще одного раза за кадр, даже если
          событие resize пришло пачкой (iOS Safari делает 3-5 событий
          подряд при появлении клавиатуры).
       2. Idempotent — повторный init() no-op, не дублирует listeners.
       3. Delta threshold — не обновляем при изменении <2px (шум от scroll).
       4. Passive listeners (хотя resize и так non-cancelable).
       5. Auto-cleanup на pagehide (важно для bfcache).
       6. Fallback graceful — если visualViewport отсутствует
          (Firefox <91, IE), CSS остаётся со старым fallback значением.
       7. Учёт safe-area-inset-* и небольшого отступа (16px) для воздуха
          между CP и краями viewport.
       8. Subscriber API — другие модули могут слушать изменения через
          SiteUtils.onViewportChange(callback) без дублирования listeners.
  ──────────────────────────────────────────────────────────────────────── */
  (function () {
    if (!window.visualViewport) return; // graceful fallback

    var DELTA_THRESHOLD = 2;      // px — игнорируем шум
    var SAFE_PADDING    = 16;     // px — воздух по краям CP
    var lastHeight      = -1;
    var rafId           = 0;
    var subscribers     = [];
    var docEl           = document.documentElement;

    function computeMaxH() {
      var vv = window.visualViewport;
      if (!vv) return null;
      // Высота, доступная для модала: viewport минус safe-area минус воздух
      // visualViewport.height уже учитывает URL-бар и клавиатуру.
      return Math.max(0, Math.floor(vv.height - SAFE_PADDING * 2));
    }

    function applyUpdate() {
      rafId = 0;
      var h = computeMaxH();
      if (h === null) return;
      if (Math.abs(h - lastHeight) < DELTA_THRESHOLD) return;
      lastHeight = h;
      docEl.style.setProperty('--cp-max-h', h + 'px');
      // Уведомляем подписчиков (например, share-dialog, btoc)
      for (var i = 0; i < subscribers.length; i++) {
        try { subscribers[i](h); } catch (e) { /* swallow */ }
      }
    }

    function scheduleUpdate() {
      if (rafId) return; // уже запланировано
      rafId = requestAnimationFrame(applyUpdate);
    }

    var vv = window.visualViewport;
    vv.addEventListener('resize', scheduleUpdate, { passive: true });
    vv.addEventListener('scroll', scheduleUpdate, { passive: true });
    // Также при orientationchange — visualViewport не всегда успевает
    window.addEventListener('orientationchange', scheduleUpdate);

    // Cleanup для bfcache (Safari bfcache + iOS)
    window.addEventListener('pagehide', function () {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      vv.removeEventListener('resize', scheduleUpdate);
      vv.removeEventListener('scroll', scheduleUpdate);
    }, { once: true });

    // Public API
    SiteUtils.onViewportChange = function (cb) {
      if (typeof cb === 'function' && subscribers.indexOf(cb) === -1) {
        subscribers.push(cb);
      }
      return function unsubscribe() {
        var idx = subscribers.indexOf(cb);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    };
    SiteUtils.getViewportMaxH = function () { return lastHeight; };

    // Первичный sync — синхронно, чтобы CP сразу при первом open() имел значение
    applyUpdate();
  })();

  /* AUDIT V6 / H2: :has() fallback для quiz-overlay (iOS < 16.4).
     CSS правило .quiz-overlay:has(.quiz-launch-hero:hover) недоступно — 
     дублируем через JS-class. */
  (function () {
    var overlays = document.querySelectorAll('.quiz-overlay');
    if (!overlays.length || CSS.supports('selector(:has(*))')) return;
    overlays.forEach(function (overlay) {
      var hero = overlay.querySelector('.quiz-launch-hero');
      if (!hero) return;
      hero.addEventListener('mouseenter', function () { overlay.classList.add('is-hovered'); });
      hero.addEventListener('mouseleave', function () { overlay.classList.remove('is-hovered'); });
      hero.addEventListener('focus', function () { overlay.classList.add('is-hovered'); });
      hero.addEventListener('blur', function () { overlay.classList.remove('is-hovered'); });
    });
  })();


  /* AUDIT V6 / H5: удалён 2026-05-30.
     scroll-perf.js (window.SiteUtils-сайд) уже пишет --visual-viewport-h
     и --keyboard-height с throttle 100ms. Дублирующий listener без throttle
     создавал двойную нагрузку и race-conditions при resize клавиатуры. */


  /* ──────────────────────────────────────────────────────────────────
     AUDIT V2 / UI-3.1: единый набор SVG-иконок (stroke-width 1.5).
     ────────────────────────────────────────────────────────────────── */
  window.SiteIcons = {
    close:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12"/></svg>',
    share:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/></svg>',
    copy:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    book:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  /* ──────────────────────────────────────────────────────────────────
     AUDIT V2 / ARCH-2: scroll-lock reset on history navigation.
     ────────────────────────────────────────────────────────────────── */
  window.addEventListener('popstate', function () {
    if (window.SiteUtils && window.SiteUtils.forceUnlockEmergency) {
      window.SiteUtils.forceUnlockEmergency();
    }
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && window.SiteUtils && window.SiteUtils.forceUnlockEmergency) {
      window.SiteUtils.forceUnlockEmergency();
    }
  });

  /* ──────────────────────────────────────────────────────────────────
     AUDIT V2 / UX-3: делегированный handler для data-action="open-search".
     Заменяет inline onclick на index.html / articles/index.html.
     ────────────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action="open-search"]');
    if (t) {
      e.preventDefault();
      if (window.GBSearch && window.GBSearch.open) window.GBSearch.open();
      else window.dispatchEvent(new CustomEvent('gb:openSearch'));
    }
  });

  /* ──────────────────────────────────────────────────────────────────
     AUDIT_10_OF_10 / ARC-5.1: SITE_CONFIG validation (non-blocking).
     ────────────────────────────────────────────────────────────────── */
  (function () {
    var cfg = window.SITE_CONFIG;
    if (!cfg) return;
    var errors = [];
    var allowedTypes = ['home', 'article', 'catalog', 'about', 'series'];
    var pageType = (cfg.page && cfg.page.type) || '';
    if (pageType && allowedTypes.indexOf(pageType) === -1) {
      errors.push('page.type: недопустимое значение "' + pageType + '"');
    }
    if (cfg.quiz && cfg.quiz.questions && !Array.isArray(cfg.quiz.questions)) {
      errors.push('quiz.questions должен быть массивом');
    }
    if (errors.length) {
      /* V2-FIX: only log validation errors in debug mode */
      if (window.SITE_CONFIG && window.SITE_CONFIG.debug) {
        console.group('[SITE_CONFIG validation]');
        errors.forEach(function (e) { console.warn(e); });
        console.groupEnd();
      }
    }
  })();



  /* ============================================================
     02. Theme Toggle
     Работает с #themeToggle и #barThemeBtn (если есть)
     ============================================================ */
  (function () {
    var toggle = document.getElementById('themeToggle') || document.getElementById('hThemeBtn');
    var html = document.documentElement;
    if (!toggle) return;

    function safeThemeGet() {
      try { return localStorage.getItem(SiteUtils.themeKey); } catch (e) { return null; }
    }
    function safeThemeSet(val) {
      try { localStorage.setItem(SiteUtils.themeKey, val); } catch (e) {}
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
      /* Icon visibility is handled entirely by CSS via html.dark.
         Here we only sync aria-pressed for accessibility. */
      var isDark = html.classList.contains('dark');
      toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      var barBtn = SiteUtils.barThemeBtn();
      if (barBtn) barBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }

    /* Bug #28: getComputedStyle may return '' before CSS is fully applied.
       Use requestAnimationFrame to defer to after first paint when possible. */
    function syncThemeColor(isDark) {
      var color;
      try {
        var cs = getComputedStyle(document.documentElement);
        color = (cs.getPropertyValue('--h-bg') || cs.getPropertyValue('--bg') || '').trim();
      } catch (e) {}
      if (!color) color = isDark ? '#171411' : '#f8f5f0';

      var metas = document.querySelectorAll('meta[name="theme-color"]');
      if (metas.length > 1) {
        /* Первый вызов: удаляем дублирующие media-query теги и оставляем один,
           которым управляет JS. Это предотвращает конфликт между OS-prefers и
           JS-состоянием после того, как пользователь явно переключил тему. */
        metas.forEach(function (m, i) { if (i > 0) m.parentNode.removeChild(m); });
      }
      if (!metas.length) {
        var m = document.createElement('meta');
        m.name = 'theme-color';
        m.content = color;
        document.head.appendChild(m);
        return;
      }
      metas[0].removeAttribute('media');
      metas[0].setAttribute('content', color);
    }

    toggle.addEventListener('click', function () {
      var isDark = html.classList.toggle('dark');
      safeThemeSet(isDark ? 'dark' : 'light');
      syncIcons();
      syncThemeColor(isDark);
    });

    var barBtn = SiteUtils.barThemeBtn();
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
      if (e.key !== SiteUtils.themeKey) return;
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
     Единый диалог для кнопок: #barShareBtn, #btocShareBtn,
     .btoc-share-btn.
     Примечание: #articleEndShareBtn подключается в модуле 27
     (Article End Block) — не здесь.
     Платформы: Telegram, VK, WhatsApp, Copy URL.
     Доступность: role=dialog, aria-modal, focus-trap, Esc.
     ============================================================ */
  (function () {
    var cfg = SiteUtils.featureShare({});
    if (cfg.enabled === false) return;

    function metaContent(selector) {
      var el = document.querySelector(selector);
      return el ? (el.getAttribute('content') || '').trim() : '';
    }

    /* SEO-02/Share: социальный диалог должен делиться тем же каноническим URL,
       который видят OG/VK/Twitter парсеры, а не текущим техническим origin
       (например, github.io mirror или URL с query-параметрами). */
    var shareTitle = cfg.title || metaContent('meta[property="og:title"]') || document.title;
    var shareUrl   = metaContent('meta[property="og:url"]') ||
                     (document.querySelector('link[rel="canonical"]') || {}).href ||
                     window.location.href;
    var shareImage = metaContent('meta[property="og:image"]') || metaContent('meta[name="twitter:image"]');
    var activeShareTitle = shareTitle;
    var activeShareUrl   = shareUrl;
    var activeShareText  = '';

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

    function setActiveSharePayload(payload) {
      activeShareTitle = shareTitle;
      activeShareUrl   = shareUrl;
      activeShareText  = '';

      if (payload && typeof payload === 'object') {
        activeShareTitle = payload.title || shareTitle;
        activeShareUrl   = payload.url   || shareUrl;
        activeShareText  = payload.text  || '';
      } else if (typeof payload === 'string' && payload) {
        activeShareTitle = payload;
      }

      var textEl = document.getElementById('sd-url-text');
      if (textEl) textEl.textContent = activeShareUrl;
    }

    function activeEncodedTitle() { return encodeURIComponent(activeShareTitle); }
    function activeTextOrTitle()  { return activeShareText || activeShareTitle; }

    /* ── Dialog HTML ── */
    var overlay = document.createElement('div');
    overlay.id = 'share-dialog-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    /*
      Сервисы для российской аудитории:
      1. Telegram  — t.me/share (web URL, совместим с мобильным и десктопом)
      2. ВКонтакте — vk.com/share.php
      3. МАКС (MAX) — share.max.ru
      4. WhatsApp  — wa.me / api.whatsapp.com
      5. Скопировать ссылку
    */
    overlay.innerHTML =
      '<div id="share-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-title" tabindex="-1">' +
        '<div class="sd-handle" aria-hidden="true"></div>' +
        '<div class="sd-header">' +
          '<span class="sd-title" id="sd-title">Поделиться</span>' +
          '<button class="sd-close" id="sd-close" aria-label="Закрыть">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="sd-grid">' +

          /* AUDIT V2 / SHR-9.2: порядок по Mediascope dec-2025 (MAU):
             Telegram → WhatsApp → ВКонтакте → МАКС → Одноклассники → Скопировать.
             Все иконки — монохром, stroke-width 1.5, currentColor. */

          /* Telegram */
          '<button class="sd-btn sd-btn--tg" id="sd-tg" aria-label="Поделиться в Telegram">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5L2.5 11.5l5 2 1.5 6 4-4 5 4z"/></svg>' +
            '</span>' +
            '<span class="sd-label">Telegram</span>' +
          '</button>' +

          /* WhatsApp */
          '<button class="sd-btn sd-btn--wa" id="sd-wa" aria-label="Поделиться в WhatsApp">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-3.4-7l3.4-1-1 3.4A9 9 0 0121 12z"/><path d="M8.5 9.5c.7 2.5 2.5 4.3 5 5l1.3-1.3 2.5 1-1 2.2c-3.5.5-7-2.5-7.5-6l2.2-1z"/></svg>' +
            '</span>' +
            '<span class="sd-label">WhatsApp</span>' +
          '</button>' +

          /* ВКонтакте */
          '<button class="sd-btn sd-btn--vk" id="sd-vk" aria-label="Поделиться ВКонтакте">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7c1 5 4 9 8 10v-4c2 0 3 1 4 4 1 0 3 0 5-1-2-2-3-4-3-5l3-4h-3l-3 4c-1 0-2-1-2-3V7H6"/></svg>' +
            '</span>' +
            '<span class="sd-label">ВКонтакте</span>' +
          '</button>' +

          /* Facebook */
          '<button class="sd-btn sd-btn--fb" id="sd-fb" aria-label="Поделиться в Facebook">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' +
            '</span>' +
            '<span class="sd-label">Facebook</span>' +
          '</button>' +

          /* МАКС (MAX) */
          '<button class="sd-btn sd-btn--max" id="sd-max" aria-label="Поделиться в МАКС">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18V6l8 8 8-8v12"/></svg>' +
            '</span>' +
            '<span class="sd-label">МАКС</span>' +
          '</button>' +

          /* Одноклассники */
          '<button class="sd-btn sd-btn--ok" id="sd-ok" aria-label="Поделиться в Одноклассниках">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M6 16c2 1 4 1.5 6 1.5s4-.5 6-1.5M9 14l-3 6M15 14l3 6"/></svg>' +
            '</span>' +
            '<span class="sd-label">Одноклассники</span>' +
          '</button>' +

          /* Скопировать */
          '<button class="sd-btn sd-btn--copy" id="sd-copy" aria-label="Скопировать ссылку">' +
            '<span class="sd-icon">' +
              '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
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
    if (urlText) urlText.appendChild(document.createTextNode(activeShareUrl));

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
    function showOverlay(payload) {
      if (overlay.classList.contains('is-open')) return;
      setActiveSharePayload(payload);
      var sdTitleEl = document.getElementById('sd-title');
      var dialogTitle = payload && typeof payload === 'object'
        ? (payload.dialogTitle || payload.title || 'Поделиться')
        : (typeof payload === 'string' && payload ? payload : 'Поделиться');
      if (sdTitleEl) sdTitleEl.textContent = dialogTitle;

      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
      SiteUtils.lockScroll('share-dialog');
      requestAnimationFrame(function () {
        try { dialog.focus({ preventScroll: true }); }
        catch (e) { dialog.focus(); }
      });
      document.addEventListener('keydown', onKey);
    }

    function openDialog(trigger, payload) {
      triggerEl = trigger || null;
      setActiveSharePayload(payload);

      /* Mobile-first: нативный share-sheet (iOS/Android) */
      var isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobileDevice && navigator.share) {
        navigator.share({
          title: activeShareTitle,
          text:  activeShareText || undefined,
          url:   utmUrl(activeShareUrl, 'native')
        }).catch(function (err) {
          /* Пользователь отменил или share не поддерживается — показываем диалог */
          if (err && err.name !== 'AbortError') { showOverlay(payload); }
        });
        return;
      }

      showOverlay(payload);
    }
    function closeDialog() {
      if (!overlay.classList.contains('is-open')) return;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      SiteUtils.unlockScroll('share-dialog');
      document.removeEventListener('keydown', onKey);
      /* B-10: сигнализируем о закрытии, чтобы восстановить overrideTitle */
      overlay.dispatchEvent(new CustomEvent('gb:closed'));
      if (triggerEl && triggerEl.focus) {
        try { triggerEl.focus({ preventScroll: true }); }
        catch (e) { triggerEl.focus(); }
      }
      triggerEl = null;
    }
    function onKey(e) {
      if (SiteUtils.isEscape(e)) {
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
      var tgWeb = 'https://t.me/share/url?url=' + encodeURIComponent(utmUrl(activeShareUrl,'telegram')) + '&text=' + encodeURIComponent(activeTextOrTitle());
      window.open(tgWeb, '_blank', 'noopener');
    });
    document.getElementById('sd-vk').addEventListener('click', function () {
      var vkUrl = 'https://vk.com/share.php?url=' + encodeURIComponent(utmUrl(activeShareUrl,'vk')) + '&title=' + activeEncodedTitle();
      if (shareImage) vkUrl += '&image=' + encodeURIComponent(shareImage);
      window.open(vkUrl, '_blank', 'noopener');
    });
    document.getElementById('sd-fb').addEventListener('click', function () {
      var fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(utmUrl(activeShareUrl, 'facebook'));
      if (activeShareTitle) fbUrl += '&quote=' + activeEncodedTitle();
      window.open(fbUrl, '_blank', 'noopener');
    });
    document.getElementById('sd-max').addEventListener('click', function () {
      window.open('https://share.max.ru/share?url=' + encodeURIComponent(utmUrl(activeShareUrl, 'max')) + '&title=' + activeEncodedTitle(), '_blank', 'noopener');
    });
    document.getElementById('sd-ok').addEventListener('click', function () {
      var okUrl = 'https://connect.ok.ru/offer?url=' + encodeURIComponent(utmUrl(activeShareUrl, 'ok')) +
                  '&title=' + activeEncodedTitle();
      window.open(okUrl, '_blank', 'noopener');
    });
    document.getElementById('sd-wa').addEventListener('click', function () {
      /* B-12: wa.me работает на мобильном (открывает приложение) и на десктопе
         (новая Web-версия WhatsApp без требования авторизованного приложения).
         web.whatsapp.com/send требует запущенного и авторизованного приложения. */
      var waUrl = 'https://wa.me/?text=' + encodeURIComponent(activeTextOrTitle() + ' ' + utmUrl(activeShareUrl,'whatsapp'));
      window.open(waUrl, '_blank', 'noopener');
    });

    /* ── Copy ── */
    function doCopy() {
      var label = copyBtn.querySelector('.sd-copy-label');
      var iconEl = copyBtn.querySelector('.sd-icon');
      var toCopy = activeShareText ? (activeShareText + ' · ' + activeShareUrl) : activeShareUrl;
      SiteUtils.copyText(toCopy, function () {
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
        }, function () {
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
      var docH = SiteUtils.docH();
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
      SiteUtils.scrollToTop();
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

    SiteUtils.scrollRaf(update);
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

    var cfg = SiteUtils.featureToc({});
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
      if (panel.classList.contains('open')) return;
      _prevFocus = document.activeElement;
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      if (overlay) { overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); }
      SiteUtils.lockScroll('toc-mobile');
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
      if (!panel.classList.contains('open')) return;
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
      SiteUtils.unlockScroll('toc-mobile');
      if (_trapHandler) { panel.removeEventListener('keydown', _trapHandler); _trapHandler = null; }
      if (_prevFocus && _prevFocus.focus) { _prevFocus.focus(); _prevFocus = null; }
    }

    toggle.addEventListener('click', openToc);
    if (closeBtn) closeBtn.addEventListener('click', closeToc);
    if (overlay) overlay.addEventListener('click', closeToc);
    document.addEventListener('keydown', function (e) { if (SiteUtils.isEscape(e) && panel.classList.contains('open')) closeToc(); });

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

    var cfg = SiteUtils.featureToc({});
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
        if (el.tagName === 'H3') a.classList.add('toc-h3');
        a.style.display = 'block'; // Ensure block rendering for nested sub-items
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

    SiteUtils.scrollRaf(function () {
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
    });
  })();


  /* ============================================================
     09. Bottom App Bar + TOC Overlay
     ============================================================ */
  (function () {
    var bar     = document.getElementById('bottomBar');
    var overlay = document.getElementById('btocOverlay');
    var panel   = document.getElementById('btocPanel');
    if (!bar || !overlay) return;

    var cfg = SiteUtils.featureToc({});
    if (cfg.enabled === false || cfg.mobile === false) return;

    var fillCircle   = document.getElementById('barProgressFill');
    var pctText      = document.getElementById('barProgressText');
    var sectionName  = document.getElementById('barSectionName');
    var sectionBtn   = document.getElementById('barSectionBtn');
    var upBtn        = document.getElementById('barUpBtn');
    var closeBtn     = document.getElementById('btocClose');
    var btocNav      = document.getElementById('btocNav');
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

    if (btocSubtitle && tocItems.length) btocSubtitle.textContent = tocItems.length + ' ' + SiteUtils.pluralRu(tocItems.length, 'раздел', 'раздела', 'разделов');

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
      probe.onload  = function () { applyBg(absUrl); probe.onload = probe.onerror = null; };
      probe.onerror = function () { applyBg(relUrl); probe.onload = probe.onerror = null; };
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
    var HIDE_DOWN     =  60;  /* накопленный downscroll → скрыть           */
    var SHOW_UP       = -60;  /* накопленный upscroll → показать           */

    function setBarVisible(show) {
      if (show === barVisible) return;
      barVisible = show;
      bar.classList.toggle('visible', show);
    }

    function updateBar() {
      var scrollY = window.scrollY;
      var delta   = scrollY - _lastScrollY;
      _lastScrollY = scrollY;

      var docH = SiteUtils.docH();
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
      var _btocFill = document.getElementById('btocProgressFill');
      if (_btocFill) _btocFill.style.width = pct + '%';
      if (btocPct) btocPct.textContent = pct + '%';

      var minLeftRaw = Math.round(totalReadingMin * (1 - pct / 100));
      var timeText;
      if (pct >= 98) {
        timeText = 'Прочитано!';
      } else if (minLeftRaw < 1) {
        timeText = 'Осталось: ~1 мин';
      } else {
        timeText = 'Осталось: ~' + minLeftRaw + ' мин';
      }
      if (btocTimeLeft) btocTimeLeft.textContent = timeText;

      var scrollMid = scrollY + window.innerHeight * 0.35;
      var active = tocItems[0];
      tocItems.forEach(function (item) { if (item.el.offsetTop <= scrollMid) active = item; });
      if (sectionName && active) sectionName.textContent = active.label;
      tocItems.forEach(function (item) { item.a.classList.toggle('active', item === active); });
    }

    SiteUtils.scrollRaf(updateBar);
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
    /* Bug #17: debounce open/close to prevent opening during close transition */
    var _btocTransitioning = false;

    function openToc() {
      if (overlay.classList.contains('open') || _btocTransitioning) return;
      _btocTransitioning = true;
      setTimeout(function () { _btocTransitioning = false; }, 320);
      _bPrevFocus = document.activeElement;
      overlay.classList.add('open');
      SiteUtils.lockScroll('btoc');
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
      if (!overlay.classList.contains('open') || _btocTransitioning) return;
      _btocTransitioning = true;
      setTimeout(function () { _btocTransitioning = false; }, 320);
      overlay.classList.remove('open');
      SiteUtils.unlockScroll('btoc');
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
    document.addEventListener('keydown', function (e) { if (SiteUtils.isEscape(e) && overlay.classList.contains('open')) closeToc(); });

    /* Экспортируем API для внешних модулей (клавиатурные шорткаты, etc.) */
    window.SiteBTOC = { open: openToc, close: closeToc };

    if (upBtn) upBtn.addEventListener('click', function () { SiteUtils.scrollToTop(); });

    var touchStartY = 0;
    var touchStartX = 0;
    if (panel) {
      var handle = panel.querySelector('.btoc-handle');
      var swipeTarget = handle || panel;
      swipeTarget.addEventListener('touchstart', function (e) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      swipeTarget.addEventListener('touchmove', function (e) {
        var dy = e.touches[0].clientY - touchStartY;
        var dx = Math.abs(e.touches[0].clientX - touchStartX);
        /* Закрываем только явный вертикальный свайп вниз по handle-пилюле */
        if (dy > 60 && dx < dy * 0.4) closeToc();
 
      }, { passive: true });
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
     Progressive: CSS scroll-driven animations (Chrome 115+, FF 110+, Safari 16.4+)
     handle .reveal elements natively. JS IntersectionObserver is kept as
     fallback for .quote-box/.warn-box/.info-box which use JS-added .visible class
     for opacity/transform (CSS fallback reveal-fallback @keyframes at 3s also exists).
     ============================================================ */
  (function () {
    var els = document.querySelectorAll('.quote-box, .warn-box, .info-box, .ehrman-block, .opusdei-note');
    if (!els.length) return;

    /* If CSS scroll-driven animations are supported, the @keyframes reveal-fallback
       at 3s delay already handles these as a CSS-only fallback, but we still use
       IntersectionObserver for immediate, zero-delay triggering. */
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
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { observer.observe(el); });
  })();


  /* ============================================================
     11a. Generic Article Reveal Observer
     Safe fallback for .reveal elements on article pages.
     Replaces duplicated inline reveal scripts in long-form articles.
     ============================================================ */
  (function () {
    var reveals = document.querySelectorAll('.reveal:not(.revealed)');
    if (!reveals.length) return;

    if (!window.IntersectionObserver) {
      reveals.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });
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
        SiteUtils.positionTip(tip, wrapper);
        activeTooltip = tip;
      });
      wrapper.addEventListener('mouseleave', hideActive);

      wrapper.addEventListener('click', function (e) {
        if (tip.style.display === 'block') {
          hideActive();
        } else {
          e.stopPropagation();
          hideActive();
          SiteUtils.positionTip(tip, wrapper);
          activeTooltip = tip;
        }
      });

      wrapper.addEventListener('focus', function () { SiteUtils.positionTip(tip, wrapper); activeTooltip = tip; });
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
      /* AUDIT V2 / UX-2: единая ARIA-разметка для всех flip-карточек. */
      if (!card.hasAttribute('role'))     card.setAttribute('role', 'button');
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      if (!card.hasAttribute('aria-pressed'))  card.setAttribute('aria-pressed', 'false');
      if (!card.hasAttribute('aria-expanded')) card.setAttribute('aria-expanded', 'false');
      if (!card.hasAttribute('aria-label')) {
        var label = card.querySelector('.flip-card-front h3, .heart-flip-front h3, .error-flip-front h3, .flip-card-front, .heart-flip-front');
        if (label) {
          var txt = (label.textContent || '').trim().slice(0, 80);
          if (txt) card.setAttribute('aria-label', 'Перевернуть карточку: ' + txt);
        }
      }
      function syncARIA() {
        var flipped = card.classList.contains('flipped');
        card.setAttribute('aria-pressed',  flipped ? 'true' : 'false');
        card.setAttribute('aria-expanded', flipped ? 'true' : 'false');
        var back  = card.querySelector('.flip-card-back, .heart-flip-back, .error-flip-back');
        var front = card.querySelector('.flip-card-front, .heart-flip-front, .error-flip-front');
        if (back)  back.setAttribute('aria-hidden',  flipped ? 'false' : 'true');
        if (front) front.setAttribute('aria-hidden', flipped ? 'true' : 'false');
      }
      syncARIA();
      card.addEventListener('click', function () {
        this.classList.toggle('flipped');
        syncARIA();
      });
      if (cfg.keyboard !== false) {
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.classList.toggle('flipped');
            syncARIA();
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
      finger.innerHTML = '<span class="flip-finger-text">переверни</span><span class="flip-finger-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 0 1 6 0v5h-1V6a2 2 0 0 0-4 0v8l-2-2-2 2 2 2v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-6"/></svg></span>';
      front.appendChild(finger);
    });

    document.querySelectorAll('.error-flip-front').forEach(function (front) {
      var oldHint = front.querySelector('.error-flip-hint');
      if (oldHint) oldHint.remove();
      var finger = document.createElement('div');
      finger.className = 'flip-finger';
      finger.innerHTML = '<span class="flip-finger-text">нажми</span><span class="flip-finger-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 0 1 6 0v5h-1V6a2 2 0 0 0-4 0v8l-2-2-2 2 2 2v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-6"/></svg></span>';
      front.appendChild(finger);
    });

    /* Б6: heart flip cards */
    document.querySelectorAll('.heart-flip-front').forEach(function (front) {
      var oldHint = front.querySelector('.flip-hint');
      if (oldHint) oldHint.remove();
      var finger = document.createElement('div');
      finger.className = 'flip-finger';
      finger.innerHTML = '<span class="flip-finger-text">переверни</span><span class="flip-finger-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 0 1 6 0v5h-1V6a2 2 0 0 0-4 0v8l-2-2-2 2 2 2v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-6"/></svg></span>';
      front.appendChild(finger);
    });

    document.querySelectorAll('.flip-card-back .flip-hint').forEach(function (h) { h.remove(); });
    document.querySelectorAll('.error-flip-back .error-flip-hint').forEach(function (h) { h.remove(); });
  })();


  /* ============================================================
     15. Flip Card Height Sync
     ============================================================ */
  (function () {
    /* Bug #15: two-pass read/write to avoid layout thrashing.
       Pass 1 (write): reset all heights to allow natural sizing.
       Pass 2 (read):  measure all offsetHeights in one batch.
       Pass 3 (write): apply computed minHeights in one batch. */
    function syncCardHeight(cardSel, innerSel, frontSel, backSel) {
      var cards = document.querySelectorAll(cardSel);
      if (!cards.length) return;

      var items = [];
      /* Pass 1: write — prepare all cards for measurement */
      cards.forEach(function (card) {
        var inner = card.querySelector(innerSel);
        var front = card.querySelector(frontSel);
        var back  = card.querySelector(backSel);
        if (!inner || !front || !back) return;

        var entry = { card: card, inner: inner, front: front, back: back,
          prevCardMin: card.style.minHeight, prevInnerMin: inner.style.minHeight,
          pF: { pos: front.style.position, inset: front.style.inset, h: front.style.height, v: front.style.visibility },
          pB: { pos: back.style.position, inset: back.style.inset, h: back.style.height, v: back.style.visibility }
        };
        card.style.minHeight = '0px';
        inner.style.minHeight = '0px';
        front.style.position = 'relative'; front.style.inset = 'auto'; front.style.height = 'auto'; front.style.visibility = 'hidden';
        back.style.position = 'relative'; back.style.inset = 'auto'; back.style.height = 'auto'; back.style.visibility = 'hidden';
        items.push(entry);
      });

      /* Pass 2: read — single forced reflow for all cards */
      items.forEach(function (e) {
        e.maxH = Math.max(e.front.offsetHeight, e.back.offsetHeight);
      });

      /* Pass 3: write — restore and apply */
      items.forEach(function (e) {
        e.front.style.position = e.pF.pos; e.front.style.inset = e.pF.inset; e.front.style.height = e.pF.h; e.front.style.visibility = e.pF.v;
        e.back.style.position = e.pB.pos; e.back.style.inset = e.pB.inset; e.back.style.height = e.pB.h; e.back.style.visibility = e.pB.v;
        if (e.maxH > 0) {
          e.card.style.minHeight = e.maxH + 'px';
          e.inner.style.minHeight = e.maxH + 'px';
        } else {
          e.card.style.minHeight = e.prevCardMin;
          e.inner.style.minHeight = e.prevInnerMin;
        }
      });
    }

    function syncAll() {
      requestAnimationFrame(function () {
        syncCardHeight('.flip-card', '.flip-card-inner', '.flip-card-front', '.flip-card-back');
        syncCardHeight('.error-flip-card', '.error-flip-inner', '.error-flip-front', '.error-flip-back');
        /* Б5: heart flip cards too */
        syncCardHeight('.heart-flip-card', '.heart-flip-inner', '.heart-flip-front', '.heart-flip-back');
      });
    }

    SiteUtils.ready(syncAll);
    window.addEventListener('load', syncAll);
    window.addEventListener('resize', SiteUtils.debounce(syncAll, 150), { passive: true });
  })();


  /* ============================================================
     15a. Heart-Flip Mobile Back-Height — устанавливает --back-height
     CSS var перед переворотом карточки, чтобы CSS мог плавно
     расширить высоту до реального размера оборотной стороны.
     Работает только на мобильных (≤680px), где карточка имеет
     фиксированную высоту. На десктопе aspect-ratio:3/2 достаточен.
     Перенесено из inline <script> в articles/krajne-li-isporcheno-serdce/.
  ============================================================ */
  (function () {
    function initHeartFlipMobile() {
      document.querySelectorAll('.heart-flip-card').forEach(function (card) {
        if (card.dataset.backHeightInit) return; /* idempotent */
        card.dataset.backHeightInit = '1';

        var back = card.querySelector('.heart-flip-back');
        if (!back) return;

        function isMobile() { return window.innerWidth <= 680; }

        function measureBackHeight() {
          var prev = back.style.cssText;
          back.style.cssText += ';position:fixed;visibility:hidden;height:auto;transform:none;backface-visibility:visible;display:flex;';
          var h = back.scrollHeight;
          back.style.cssText = prev;
          return h;
        }

        function setBackHeight() {
          if (!isMobile()) return;
          var h = measureBackHeight();
          card.style.setProperty('--back-height', h + 'px');
        }

        card.addEventListener('click', function () {
          if (!isMobile()) return;
          var willFlip = !card.classList.contains('flipped');
          if (willFlip) {
            setBackHeight();
          } else {
            card.style.setProperty('--back-height', '220px');
          }
        });

        window.addEventListener('resize', function () {
          if (isMobile() && card.classList.contains('flipped')) {
            setBackHeight();
          }
        }, { passive: true });
      });
    }

    SiteUtils.ready(initHeartFlipMobile);
  })();


  
  /* ============================================================
     15b. Flip Card Animation Pause (off-viewport)
     Pauses infinite CSS animations on flip-cards that are not
     visible, saving CPU/GPU. Uses IntersectionObserver.
     ============================================================ */
  (function () {
    var cards = document.querySelectorAll('.flip-card, .error-flip-card, .heart-flip-card');
    if (!cards.length || !window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) {
          el.style.animationPlayState = '';
        } else {
          el.style.animationPlayState = 'paused';
        }
      });
    }, { rootMargin: '200px' });

    cards.forEach(function (card) { observer.observe(card); });
  })();


  /* ============================================================
     16. Quiz Engine v3.5 — Топовый уровень (2026-06)

     ЕДИНЫЙ СТАНДАРТ ВОПРОСОВ (обязателен для всех статей):

     Обязательные поля:
       - type: "single" | "multiple" | "order"
       - category: "exegesis" | "theology" | "context" | "text" | "apologetics"
       - difficulty: "easy" | "medium" | "hard"
       - explanation: { short: string, full: string, anchor?: string }

     Правила качества:
       - explanation.short — 1-2 предложения, чёткий вывод
       - explanation.full — 4-8 предложений, богословская/экзегетическая глубина
       - Минимум 30% вопросов должны быть multiple или order
       - Каждый вопрос должен проверять понимание, а не только память

     ============================================================ */
  (function () {

    /* ---- 1. Feature gate ---- */
    var cfg = SiteUtils.getConfig('features.quiz', {});
    if (cfg.enabled === false) return;

    /* ---- 0. Auto-inject DOM scaffold if placeholder exists ---- */
    var quizAnchor = document.getElementById('quizPlaceholder');
    if (!document.getElementById('quizWrapper') && quizAnchor) {
      quizAnchor.innerHTML = '<div class="quiz-wrapper" id="quizWrapper">' +
        '<div class="quiz-overlay" id="quizOverlay">' +
          '<button aria-label="Пройти тест" class="quiz-launch-hero" id="quizLaunch">' +
            '<span class="quiz-launch-icon">' +
              '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>' +
            '</span>' +
            '<span class="quiz-launch-label">Пройти тест</span>' +
            '<span class="quiz-launch-hint" id="quizHintLabel">проверь себя</span>' +
          '</button>' +
        '</div>' +
        '<div class="quiz-main quiz-main--hidden" id="quizMain">' +
          '<div id="quizBody">' +
            '<div class="quiz-counter-row">' +
              '<div class="quiz-counter" id="quizCounter"></div>' +
              '<div class="quiz-progress-wrap"><div class="quiz-progress-fill" id="quizFill" style="width:0%"></div></div>' +
            '</div>' +
            '<p class="quiz-question-text" id="quizQuestion"></p>' +
            '<p class="quiz-focus" id="quizFocus" style="display:none"></p>' +
            '<div class="quiz-options" id="quizOptions" role="radiogroup" aria-labelledby="quizQuestion"></div>' +
            '<div class="quiz-feedback" id="quizFeedback" aria-live="polite" aria-atomic="true"></div>' +
            '<button class="quiz-next-btn" id="quizNext" style="display:none">Следующий вопрос →</button>' +
          '</div>' +
          '<div class="quiz-result" id="quizResult" style="display:none">' +
            '<div class="quiz-result__fraction"><span id="quizResultScore">0</span><span>/<span id="quizResultTotal">10</span></span></div>' +
            '<div class="quiz-result__label" id="quizResultLabel"></div>' +
            '<div class="quiz-result__bar-wrap"><div class="quiz-result__bar" id="quizResultBar" style="width:0%"></div></div>' +
            '<div class="quiz-result__desc" id="quizScoreDesc"></div>' +
            '<div class="quiz-result__actions">' +
              '<span id="quizScore"></span>' +
              '<span id="quizScoreBadge"></span>' +
              '<span id="quizScoreTitle"></span>' +
              '<button class="quiz-restart-btn" id="quizRestart">Пройти заново</button>' +
              '<button class="quiz-share-btn" id="quizShare">Поделиться</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="quizBonusSection" style="display:none">' +
          '<div class="quiz-bonus-header">' +
            '<div class="quiz-bonus-lock" id="quizBonusLock">Ответьте правильно на все вопросы, чтобы разблокировать бонусный раунд.</div>' +
            '<div class="quiz-bonus-unlock" id="quizBonusUnlock" style="display:none">' +
              '<div class="quiz-bonus-badge">Бонусный раунд</div>' +
              '<p>Вы прошли основной тест без единой ошибки! Проверьте глубину понимания.</p>' +
              '<button class="quiz-bonus-start-btn" id="quizBonusStart">Начать бонусный раунд →</button>' +
            '</div>' +
          '</div>' +
          '<div id="quizBonusBody" style="display:none">' +
            '<div class="quiz-counter-row">' +
              '<div class="quiz-counter" id="quizBonusCounter"></div>' +
              '<div class="quiz-progress-wrap"><div class="quiz-progress-fill" id="quizBonusFill" style="width:0%"></div></div>' +
            '</div>' +
            '<p class="quiz-question-text" id="quizBonusQuestion"></p>' +
            '<p class="quiz-focus" id="quizBonusFocus" style="display:none"></p>' +
            '<div class="quiz-options" id="quizBonusOptions" role="radiogroup"></div>' +
            '<div class="quiz-feedback" id="quizBonusFeedback" aria-live="polite"></div>' +
            '<button class="quiz-next-btn" id="quizBonusNext" style="display:none">Следующий →</button>' +
          '</div>' +
          '<div class="quiz-bonus-result" id="quizBonusResult" style="display:none">' +
            '<div id="quizBonusScore"></div>' +
            '<div id="quizBonusScoreTitle"></div>' +
            '<div id="quizBonusScoreBadge"></div>' +
            '<div id="quizBonusScoreDesc"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
      // Update hint label with correct count
      /* BUGFIX 2026-05-30: ранее было два независимых `var qs = ...` в одном
         function-scope (var-redeclare сбивает статические анализаторы и
         выглядит как copy-paste-ошибка). Объявляем один раз и переиспользуем. */
      var qs = SiteUtils.getConfig('quiz.questions', []);
      var qHint = document.getElementById('quizHintLabel');
      if (qHint && qs.length) {
        qHint.textContent = 'проверь себя — ' + qs.length + ' ' + SiteUtils.pluralRu(qs.length, 'вопрос', 'вопроса', 'вопросов');
      }
      // Update result total
      var qTotal = document.getElementById('quizResultTotal');
      if (qTotal && qs.length) qTotal.textContent = qs.length;
    }
    
    var wrapper  = document.getElementById('quizWrapper');
    var quizMain = document.getElementById('quizMain');
    if (!wrapper) return;

    var questions      = SiteUtils.getConfig('quiz.questions', null);
    var bonusQuestions = SiteUtils.getConfig('quiz.bonusQuestions', null);
    var scores         = SiteUtils.getConfig('quiz.scores', null);
    var bonusScores    = SiteUtils.getConfig('quiz.bonusScores', null);
    if (!questions || !questions.length) return;

    /* ---- 1b. Backwards compatibility + heading/source resolution ---- */
    var headingRefs = Array.prototype.map.call(document.querySelectorAll('article h2[id], article h3[id]'), function (el) {
      return {
        id: el.id,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        norm: normalizeLookupValue(el.textContent || '')
      };
    });

    function stripMarkup(str) {
      return String(str == null ? '' : str)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function normalizeLookupValue(str) {
      return stripMarkup(str)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[«»"'()!?.,:;—–-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function cleanFeedbackLead(str) {
      return String(str == null ? '' : str)
        .replace(/^\s*(Верно|Точно|Именно так|Неверно|Не совсем|Осторожно)(?:\s*[!?.…]+)?(?:\s*[—-])?\s*/i, '')
        .trim();
    }

    function findHeadingRef(value) {
      if (!value) return null;
      var raw = String(value).trim();
      if (!raw) return null;
      if (raw.charAt(0) === '#') raw = raw.slice(1);
      var byId = document.getElementById(raw);
      if (byId) {
        var byIdText = (byId.textContent || '').replace(/\s+/g, ' ').trim() || 'Перечитать раздел';
        return { id: raw, text: byIdText, norm: normalizeLookupValue(byIdText) };
      }

      var norm = normalizeLookupValue(raw);
      if (!norm) return null;

      for (var i = 0; i < headingRefs.length; i++) {
        if (headingRefs[i].norm === norm) return headingRefs[i];
      }
      for (var j = 0; j < headingRefs.length; j++) {
        if (headingRefs[j].norm.indexOf(norm) !== -1 || norm.indexOf(headingRefs[j].norm) !== -1) return headingRefs[j];
      }
      return null;
    }

    function resolveHeadingId(value) {
      var ref = findHeadingRef(value);
      return ref ? ref.id : null;
    }

    function buildSourceRef(q) {
      if (q.sourceRef) return q.sourceRef;
      var anchor = q && q.explanation && q.explanation.anchor ? q.explanation.anchor : null;
      var focusValue = anchor || q.focus || null;
      var heading = findHeadingRef(focusValue);
      if (heading) return { label: heading.text || 'Перечитать раздел', href: '#' + heading.id };
      if (typeof q.focus === 'string' && q.focus.trim()) return { label: q.focus.trim() };
      return null;
    }

    function normalizeQuestion(q, i) {
      var type = q.type || 'single';
      var text = q.q || q.question || '';
      var answer = typeof q.answer === 'number' ? q.answer : null;
      var correct = Array.isArray(q.correct) ? q.correct.slice() : q.correct;

      if (type === 'single' && answer == null && typeof correct === 'number') answer = correct;
      if (type !== 'single' && correct == null && Array.isArray(q.answer)) correct = q.answer.slice();

      var okLead = cleanFeedbackLead(q.ok || '');
      var errLead = cleanFeedbackLead(q.err || '');
      var combinedLead = [okLead, errLead].filter(function (part, idx, arr) {
        return part && arr.indexOf(part) === idx;
      }).join(' ');

      var explanation = q.explanation && typeof q.explanation === 'object'
        ? {
            short: q.explanation.short || okLead || errLead,
            full: q.explanation.full || combinedLead || okLead || errLead,
            anchor: resolveHeadingId(q.explanation.anchor || q.focus || '') || null
          }
        : {
            short: okLead || errLead,
            full: combinedLead || okLead || errLead,
            anchor: resolveHeadingId(q.focus || '') || null
          };

      if (!explanation.full) explanation.full = explanation.short;

      var sourceRef = buildSourceRef({
        sourceRef: q.sourceRef,
        explanation: explanation,
        focus: q.focus
      });

      var focusId = explanation.anchor || resolveHeadingId(q.focus || '') || null;
      var okText = q.ok || explanation.short || 'Верно.';
      var errText = q.err || explanation.full || explanation.short || 'Проверьте ответ и перечитайте раздел статьи.';

      return {
        id: q.id || ('q' + (i + 1)),
        type: type,
        category: q.category || 'theology',
        difficulty: q.difficulty || 'medium',
        q: text,
        question: text,
        options: Array.isArray(q.options) ? q.options.slice() : [],
        answer: answer,
        correct: Array.isArray(correct) ? correct.slice() : correct,
        ok: okText,
        err: errText,
        focus: focusId,
        sourceRef: sourceRef,
        explanation: explanation
      };
    }

    function normalizeQuestionSet(list) {
      if (!Array.isArray(list)) return null;
      return list.map(normalizeQuestion);
    }

    questions = normalizeQuestionSet(questions);
    bonusQuestions = normalizeQuestionSet(bonusQuestions);

    // ===== СТАНДАРТ КАЧЕСТВА (валидация) =====
    // ===== ЖЁСТКАЯ ВАЛИДАЦИЯ СТАНДАРТА v3.5 =====
    questions.forEach(function(q, i) {
      var hasExplanation = q.explanation && q.explanation.short && q.explanation.full;
      if (!hasExplanation) {
        console.warn('[Quiz v3.5] Вопрос '+(i+1)+' — отсутствует explanation (short + full)');
      }
      if (!q.category) {
        console.warn('[Quiz v3.5] Вопрос '+(i+1)+' — отсутствует category');
      }
      if (!['single','multiple','order'].includes(q.type || 'single')) {
        console.warn('[Quiz v3.5] Вопрос '+(i+1)+' — неизвестный type');
      }
      if (!q.q || !Array.isArray(q.options) || !q.options.length) {
        console.warn('[Quiz v3.5] Вопрос '+(i+1)+' — пустой текст или options');
      }
    });

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
        var questionSeed = stripMarkup(q.q || q.question || '').slice(0, 40) || ('question-' + deckName);
        var optSeed = hashString(questionSeed + ':' + deckName + ':' + attemptSeed);
        var originalOptions = Array.isArray(q.options) ? q.options.slice() : [];
        var shuffledOptions = q.type === 'order' ? originalOptions.slice() : shuffleSeeded(originalOptions, optSeed);
        var answer = q.answer;
        var correct = Array.isArray(q.correct) ? q.correct.slice() : q.correct;

        if (q.type === 'single') {
          var correctText = originalOptions[answer];
          answer = shuffledOptions.indexOf(correctText);
        } else if (q.type === 'multiple' && Array.isArray(correct)) {
          correct = correct.map(function (idx) { return shuffledOptions.indexOf(originalOptions[idx]); });
        }

        return {
          id: q.id,
          type: q.type,
          category: q.category,
          difficulty: q.difficulty,
          q: q.q,
          question: q.question,
          options: shuffledOptions,
          answer: answer,
          correct: correct,
          ok: q.ok,
          err: q.err,
          focus: q.focus || null,
          sourceRef: q.sourceRef || null,
          explanation: q.explanation || null
        };
      });
    }

    var sessionSeed = getSessionSeed();
    var coreDeck    = prepareDeck(questions, sessionSeed, 'core');
    var bonusDeck   = bonusQuestions ? prepareDeck(bonusQuestions, sessionSeed + 41, 'bonus') : null;

    /* ---- 3. Main DOM refs ---- */
    var counter      = document.getElementById('quizCounter');
    var qText        = document.getElementById('quizQuestion');
    var qFocus       = document.getElementById('quizFocus');   /* placeholder ref; в main quiz-flow всегда display:none (используется только в review-режиме через revFocus) */
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
        revStartBtn.type = 'button';
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
    var wrongAnswers = [];  /* collects { q, options, answer, chosenIdx, ok, err, focus, sourceRef } */
    var activeDeck = coreDeck;
    var streak = 0;
    var quizStorageKey = 'quiz-result-v2:' + SiteUtils.getConfig('page.id', location.pathname || 'default');

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

    var scoreAnimFrame = null;
    var resultAnimFrame = null;

    function animateCountNum(el, target, duration) {
      if (!el) return;
      var t0 = null;
      if (resultAnimFrame) cancelAnimationFrame(resultAnimFrame);
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / duration, 1);
        el.textContent = Math.floor(p * target);
        if (p < 1) resultAnimFrame = requestAnimationFrame(step);
        else resultAnimFrame = null;
      }
      resultAnimFrame = requestAnimationFrame(step);
    }

    function animateCount(el, target, total, duration) {
      if (!el) return;
      var t0 = null;
      if (scoreAnimFrame) cancelAnimationFrame(scoreAnimFrame);
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / duration, 1);
        el.textContent = 'Результат: ' + Math.floor(p * target) + ' из ' + total;
        if (p < 1) scoreAnimFrame = requestAnimationFrame(step);
        else scoreAnimFrame = null;
      }
      scoreAnimFrame = requestAnimationFrame(step);
    }

    /* Russian plural for "вопрос" (0=вопросов, 1=вопрос, 2–4=вопроса, 5+=вопросов) */
    function pluralQ(n) {
      if (n % 10 === 1 && n % 100 !== 11) return '';          /* 1 вопрос  */
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'а'; /* 2–4 вопроса */
      return 'ов';                                              /* 5 вопросов */
    }

    function readQuizMemory() {
      try { return JSON.parse(localStorage.getItem(quizStorageKey) || 'null'); }
      catch (e) { return null; }
    }

    function writeQuizMemory(data) {
      try { localStorage.setItem(quizStorageKey, JSON.stringify(data)); }
      catch (e) { /* storage quota/private mode — enhancement only */ }
    }

    function renderPreviousQuizResult() {
      if (!quizOverlay || quizOverlay.querySelector('.quiz-memory-note')) return;
      var data = readQuizMemory();
      if (!data || !data.total) return;
      var note = document.createElement('div');
      note.className = 'quiz-memory-note';
      note.setAttribute('role', 'status');
      note.innerHTML = '<strong>Ваш прошлый результат:</strong> ' +
        escapeHTML(data.lastScore) + ' из ' + escapeHTML(data.total) +
        (data.bestScore != null ? ' · лучший: ' + escapeHTML(data.bestScore) + ' из ' + escapeHTML(data.total) : '') +
        (data.gradeTitle ? '<br><span>' + escapeHTML(data.gradeTitle) + '</span>' : '');
      quizOverlay.appendChild(note);
    }

    /* Build an option button (shared by main / review / bonus) */
    function makeOptionBtn(opt, i, handler) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      btn.setAttribute('data-idx', i);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = '<span class="quiz-option-letter">' + (LETTERS[i] || (i + 1)) + '.</span> ' + opt;
      btn.addEventListener('click', (function (idx) { return function () { handler(idx); }; })(i));
      return btn;
    }

    function escapeHTML(str) {
      return String(str == null ? '' : str).replace(/[&<>"]/g, function (ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
      });
    }

    function renderSourceRefs(q) {
      var refs = q && q.sourceRef;
      if (!refs && q && q.focus) refs = { label: 'Перечитать раздел', href: '#' + q.focus };
      if (!refs) return '';
      if (!Array.isArray(refs)) refs = [refs];
      var links = refs.map(function (ref) {
        if (typeof ref === 'string') return '<span class="quiz-source-ref__item">' + escapeHTML(ref) + '</span>';
        var label = escapeHTML(ref.label || ref.text || ref.href || 'Источник');
        var href = ref.href || ref.url || '';
        if (!href) return '<span class="quiz-source-ref__item">' + label + '</span>';
        if (href.charAt(0) === '#') return '<a class="quiz-source-ref__item" href="' + escapeHTML(href) + '">' + label + '</a>';
        return '<a class="quiz-source-ref__item" href="' + escapeHTML(href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      }).join('');
      return '<div class="quiz-source-ref" aria-label="Источник для проверки ответа">' +
        '<span class="quiz-source-ref__label">Источник:</span>' + links + '</div>';
    }

    function emitQuizRender(root) {
      if (!root) return;
      try {
        document.dispatchEvent(new CustomEvent('gb:quiz-rendered', { detail: { root: root } }));
      } catch (e) {}
      if (window.SiteUtils && typeof window.SiteUtils.hydrateGlossaryTerms === 'function') {
        window.SiteUtils.hydrateGlossaryTerms(root);
      } else if (window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function') {
        window.SiteUtils.initGlossaryTooltips(root);
      }
    }

    function setFeedback(el, html, cls, q) {
      if (!el) return;

      var explanationHTML = '';
      if (q && q.explanation) {
        if (q.explanation.short) {
          explanationHTML += '<div class="quiz-explanation-short">' + q.explanation.short + '</div>';
        }
        if (q.explanation.full && stripMarkup(q.explanation.full) !== stripMarkup(q.explanation.short || '')) {
          explanationHTML += '<div class="quiz-explanation-full">' + q.explanation.full + '</div>';
        }
      }

      var content = explanationHTML || (html || '');
      el.innerHTML = content + renderSourceRefs(q);
      el.className = cls || 'quiz-feedback';
      emitQuizRender(el);
    }

    /* ===== НОВАЯ ЛОГИКА ТИПОВ ВОПРОСОВ (multiple + order) ===== */

    function validateAnswer(q, userAnswer) {
      if (!q) return false;
      var type = q.type || 'single';

      switch (type) {
        case 'single':
          return userAnswer === q.answer;
        case 'multiple':
          if (!Array.isArray(userAnswer) || !Array.isArray(q.correct)) return false;
          var a = userAnswer.slice().sort();
          var b = q.correct.slice().sort();
          return a.length === b.length && a.every(function(v,i){return v===b[i];});
        case 'order':
          if (!Array.isArray(userAnswer) || !Array.isArray(q.correct)) return false;
          return userAnswer.length === q.correct.length &&
                 userAnswer.every(function(v,i){return v===q.correct[i];});
        default:
          return userAnswer === q.answer;
      }
    }

    function renderMultipleChoice(q, container, handler) {
      container.innerHTML = '';
      container.setAttribute('role', 'group');
      q.options.forEach(function(opt, i) {
        var btn = makeOptionBtn(opt, i, function(){ btn.classList.toggle('selected'); });
        btn.dataset.multi = 'true';
        container.appendChild(btn);
      });

      var confirm = document.createElement('button');
      confirm.className = 'quiz-next-btn quiz-multi-confirm';
      confirm.textContent = 'Подтвердить ответ';
      confirm.style.marginTop = '16px';
      confirm.addEventListener('click', function() {
        var selected = [];
        container.querySelectorAll('.quiz-option.selected').forEach(function(b){
          selected.push(parseInt(b.dataset.idx));
        });
        handler(selected);
      });
      container.appendChild(confirm);
    }

    function renderOrderQuestion(q, container, handler) {
      container.innerHTML = '';
      q.options.forEach(function(opt, i) {
        var el = document.createElement('div');
        el.className = 'quiz-order-item';
        el.dataset.idx = i;
        el.innerHTML = '<span class="quiz-order-number">' + (i+1) + '</span> ' + escapeHTML(opt);
        el.draggable = true;
        el.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', i); el.classList.add('dragging'); });
        el.addEventListener('dragend', function(){ el.classList.remove('dragging'); });
        el.addEventListener('dragover', function(e){ e.preventDefault(); });
        el.addEventListener('drop', function(e){
          e.preventDefault();
          var from = parseInt(e.dataTransfer.getData('text/plain'));
          var to = i;
          if (from === to) return;
          var arr = Array.from(container.children);
          container.insertBefore(arr[from], to > from ? arr[to].nextSibling : arr[to]);
          handler(Array.from(container.children).map(function(c){ return parseInt(c.dataset.idx); }));
        });
        container.appendChild(el);
      });
    }

    renderPreviousQuizResult();

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
        streakBadge.innerHTML  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4 0 7-3 7-7 0-3-1.5-5.2-4.2-7.6-.5 2.3-1.8 3.6-3.8 4.6.6-3.2-.8-6-3.4-8C7.2 7.8 5 10.4 5 15c0 4 3 7 7 7Z"/></svg><span>' + streak + ' подряд!</span>';
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
      var type  = q.type || 'single';

      counter.textContent = 'Вопрос ' + (current + 1) + ' из ' + total;
      if (fill) fill.style.width = ((current + 1) / total * 100) + '%';
      qText.innerHTML = q.q;
      emitQuizRender(qText);
      if (qFocus) qFocus.style.display = 'none';
      if (feedback) { feedback.textContent = ''; feedback.className = 'quiz-feedback'; }
      if (nextBtn) nextBtn.style.display = 'none';
      opts.innerHTML = '';

      if (type === 'multiple') {
        renderMultipleChoice(q, opts, handleAnswer);
      } else if (type === 'order') {
        renderOrderQuestion(q, opts, handleAnswer);
      } else {
        q.options.forEach(function(opt, i) {
          opts.appendChild(makeOptionBtn(opt, i, handleAnswer));
        });
      }
      emitQuizRender(opts);

      if (timeLimit > 0) startTimer(function () { if (!answered) handleAnswer(-1); });
    }

    function handleAnswer(userAnswer) {
      if (answered) return;
      answered = true;
      clearTimer();

      var q = activeDeck[current];
      var type = q.type || 'single';
      var isCorrect = validateAnswer(q, userAnswer);

      var allBtns = opts.querySelectorAll('.quiz-option');
      allBtns.forEach(function(b){ b.disabled = true; b.setAttribute('aria-checked','false'); });

      if (type === 'multiple') {
        var selectedBtns = opts.querySelectorAll('.quiz-option.selected');
        selectedBtns.forEach(function(b){ b.setAttribute('aria-checked','true'); });

        if (isCorrect) {
          selectedBtns.forEach(function(b){ b.classList.add('correct'); });
          setFeedback(feedback, q.ok, 'quiz-feedback ok', q);
          score++; streak++;
        } else {
          selectedBtns.forEach(function(b){ b.classList.add('wrong'); });
          setFeedback(feedback, q.err, 'quiz-feedback err', q);
          wrongAnswers.push({ q: q.q, options: q.options.slice(), answer: q.answer, correct: q.correct, chosenIdx: userAnswer, ok: q.ok, err: q.err, focus: q.focus, sourceRef: q.sourceRef, explanation: q.explanation, type: q.type });
          streak = 0;
        }
      } else if (type === 'order') {
        if (isCorrect) {
          allBtns.forEach(function(b){ b.classList.add('correct'); });
          setFeedback(feedback, q.ok, 'quiz-feedback ok', q);
          score++; streak++;
        } else {
          allBtns.forEach(function(b){ b.classList.add('wrong'); });
          setFeedback(feedback, q.err, 'quiz-feedback err', q);
          wrongAnswers.push({ q: q.q, options: q.options.slice(), answer: q.answer, correct: q.correct, chosenIdx: userAnswer, ok: q.ok, err: q.err, focus: q.focus, sourceRef: q.sourceRef, explanation: q.explanation, type: q.type });
          streak = 0;
        }
      } else {
        // single
        if (userAnswer >= 0 && allBtns[userAnswer]) allBtns[userAnswer].setAttribute('aria-checked','true');
        if (isCorrect) {
          if (allBtns[userAnswer]) allBtns[userAnswer].classList.add('correct');
          setFeedback(feedback, q.ok, 'quiz-feedback ok', q);
          score++; streak++;
        } else {
          if (userAnswer >= 0 && allBtns[userAnswer]) allBtns[userAnswer].classList.add('wrong','shake');
          if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
          setFeedback(feedback, q.err, 'quiz-feedback err', q);
          wrongAnswers.push({ q: q.q, options: q.options.slice(), answer: q.answer, correct: q.correct, chosenIdx: userAnswer, ok: q.ok, err: q.err, focus: q.focus, sourceRef: q.sourceRef, explanation: q.explanation, type: q.type });
          streak = 0;
        }
      }

      updateStreakBadge();
      if (nextBtn) {
        nextBtn.textContent = current < activeDeck.length-1 ? 'Следующий вопрос →' : 'Узнать результат →';
        nextBtn.style.display = 'inline-block';
      }
    }

    /* ---- 11. Keyboard: Enter/Space advance + 1–4/А–Г select ---- */
    document.addEventListener('keydown', function (e) {
      if (!wrapper || wrapper.style.display === 'none') return;

      /* Не перехватываем, если фокус в текстовом поле */
      var _tag = (document.activeElement || {}).tagName || '';
      if (_tag === 'INPUT' || _tag === 'TEXTAREA' || _tag === 'SELECT') return;
      if ((document.activeElement || {}).isContentEditable) return;

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
        if (resultLabel) resultLabel.innerHTML = (s && s.title) ? (s.badge || '') + '\u00a0' + s.title
                                                  : (pct >= .9 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>\u00a0Отлично!' : pct >= .7 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.77a2 2 0 0 1 1.66-.9l1.06-1.71A2 2 0 0 0 9 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.88"/></svg>\u00a0Хорошо' : pct >= .5 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>\u00a0Неплохо' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>\u00a0Попробуйте снова');
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

      /* Result persistence — best + last attempt */
      try {
        var slug     = SiteUtils.getConfig('page.id', 'default');
        var KEY      = 'quiz-best-' + slug; /* legacy key: keep for backwards compatibility */
        var prevData = readQuizMemory() || {};
        var prevBest = Math.max(parseInt(localStorage.getItem(KEY) || '0', 10), parseInt(prevData.bestScore || '0', 10));
        var nextBest = Math.max(prevBest, score);
        localStorage.setItem(KEY, String(nextBest));
        writeQuizMemory({
          lastScore: score,
          bestScore: nextBest,
          total: questions.length,
          gradeTitle: s && s.title ? s.title : '',
          completedAt: new Date().toISOString()
        });
        if (prevBest > 0 && resultDesc) {
          var hint = document.createElement('div');
          hint.className = 'quiz-best-hint';
          hint.textContent = score > prevBest
            ? 'Новый лучший результат: ' + score + ' из ' + questions.length
            : 'Ваш лучший результат: ' + prevBest + ' из ' + questions.length;
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
      if (revQuestion) {
        revQuestion.innerHTML  = q.q;
        emitQuizRender(revQuestion);
      }

      if (revPrev) {
        if (q.chosenIdx >= 0 && q.options[q.chosenIdx]) {
          revPrev.innerHTML    = '<span class="quiz-review-prev__label">Вы ответили:</span>\u00a0' + q.options[q.chosenIdx];
          revPrev.style.display = 'block';
          emitQuizRender(revPrev);
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
        emitQuizRender(revOpts);
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
        setFeedback(revFeedback, q.ok, 'quiz-feedback ok', q);
        reviewScore++;
      } else {
        if (idx >= 0 && allBtns[idx]) {
          allBtns[idx].classList.add('wrong', 'shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        setFeedback(revFeedback, q.err, 'quiz-feedback err', q);
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

      if (revDoneIcon)  revDoneIcon.innerHTML  = allRight ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-top:-2px"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>';
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
          '<div class="quiz-bonus-teaser__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>' +
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
      if (bonusBq) {
        bonusBq.innerHTML = q.q;
        emitQuizRender(bonusBq);
      }
      if (bonusBf)    bonusBf.style.display = 'none';
      if (bonusBfb) { bonusBfb.textContent = ''; bonusBfb.className = 'quiz-feedback'; }
      if (bonusBn)    bonusBn.style.display = 'none';
      if (bonusBo) {
        bonusBo.innerHTML = '';
        bonusBo.setAttribute('role', 'radiogroup');
        bonusBo.setAttribute('aria-labelledby', 'quizBonusQuestion');
        q.options.forEach(function (opt, i) { bonusBo.appendChild(makeOptionBtn(opt, i, handleBonusAnswer)); });
        emitQuizRender(bonusBo);
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
        setFeedback(bonusBfb, q.ok, 'quiz-feedback ok', q);
        bonusScoreVal++;
      } else {
        if (idx >= 0 && allBtns[idx]) {
          allBtns[idx].classList.add('wrong', 'shake');
          allBtns[idx].addEventListener('animationend', function () { allBtns[idx].classList.remove('shake'); }, { once: true });
        }
        if (allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        setFeedback(bonusBfb, q.err, 'quiz-feedback err', q);
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
      /* BUGFIX 2026-05-30: родительский контейнер #quizBonusResult создан с
         style="display:none" и нигде не показывался — бонусный экран был невидим. */
      var __bonusResult = document.getElementById('quizBonusResult');
      if (__bonusResult) __bonusResult.style.display = 'block';
      if (bonusScore) bonusScore.style.display = 'block';
      if (bonusBfill) bonusBfill.style.width   = '100%';

      var idx = getScoreBucket(bonusScoreVal, bonusDeck.length, bonusScores);
      var s   = bonusScores ? bonusScores[idx] : { title: bonusScoreVal + '/' + bonusDeck.length, badge: '', desc: '' };

      if (bonusSTitle) bonusSTitle.innerHTML = (s.badge || '') + (s.badge ? '\u00a0' : '') + escapeHTML(s.title || '');
      if (bonusSDesc)  bonusSDesc.innerHTML    = s.desc || '';
      if (bonusSBadge) animateCount(bonusSBadge, bonusScoreVal, bonusDeck.length, 800);

      if (bonusScoreVal === bonusDeck.length)         launchConfetti('gold');
      else if (bonusScoreVal >= bonusDeck.length - 1) launchConfetti('blue');
    }

    /* ---- 16. Confetti ---- */
    function launchConfetti(mode) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index: var(--z-modal-low)';
      document.body.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;

      /* B-07: пересчитываем размеры при ресайзе (особенно заметно на планшетах при повороте) */
      function onCanvasResize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      window.addEventListener('resize', onCanvasResize, { passive: true });

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
        else {
          window.removeEventListener('resize', onCanvasResize);
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        }
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
      if (scoreAnimFrame) { cancelAnimationFrame(scoreAnimFrame); scoreAnimFrame = null; }
      if (resultAnimFrame) { cancelAnimationFrame(resultAnimFrame); resultAnimFrame = null; }
      if (bonusLock) bonusLock.style.display = 'block';
      if (bonusUnlock) bonusUnlock.style.display = 'none';

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
        var gradeLead = score === questions.length ? 'Прошёл тест без ошибок' : (score >= Math.ceil(questions.length * 0.7) ? 'Хороший результат в тесте' : 'Прошёл тест и вижу, что стоит перечитать материал');
        var shareMsg  = gradeLead + ': ' + scoreText + (s && s.title ? ' — «' + s.title + '»' : '');
        /* B-10: передаём title напрямую в openDialog — без DOM-патча и без setTimeout.
           На мобильном это же значение идёт в navigator.share({title: ...}).           */
        if (window.SiteShare) {
          window.SiteShare.open(share, shareMsg);
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
      'z-index: var(--z-popover)',
      'display:flex',
      'align-items:center',
      'gap:6px'
    ].join(';');
    toast.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93"/><path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07"/></svg><span>Ссылка на раздел скопирована</span>';
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

        SiteUtils.copyText(url, function () {
            if (navigator.vibrate) navigator.vibrate(30); /* Fix #12: haptic */
            a.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            a.classList.add('copied');
            showAnchorToast();
            setTimeout(function () { a.innerHTML = anchorSVG; a.classList.remove('copied'); }, 1800);
          }, function () {
            history.replaceState(null, '', '#' + id);
          });
      });
    });
  })();


  /* ============================================================
     18. Hover bridge for fn-marker tooltip (desktop)
     CSS rules are in site.css — no runtime injection needed.
     ============================================================ */


  /* ============================================================
     19. Bible Reference Tooltips (bref / btip)
     O-02: логика hover/touch/click вынесена в SiteUtils.makeTooltipController
     ============================================================ */
  (function () {
    var dataEl = document.getElementById('bibleRefs');
    var refs = {};
    if (dataEl) {
      try {
        refs = JSON.parse(dataEl.textContent.trim() || '{}');
      } catch (e) {
        console.error('Bible JSON error:', e);
        refs = {};
      }
    }

    /* Инжектируем .btip в DOM до регистрации контроллера.
       Если на странице забыли #bibleRefs, кнопка не должна быть мёртвой:
       показываем аккуратный fallback с самой ссылкой. */
    document.querySelectorAll('.bref[data-ref]').forEach(function (a) {
      var ref = a.getAttribute('data-ref') || a.textContent.trim();
      var text = refs[ref] || a.getAttribute('data-tip') || a.getAttribute('title') || ('Библейская ссылка: <strong>' + ref + '</strong>');
      if (a.querySelector('.btip')) return;
      var tip = document.createElement('span');
      tip.className = 'btip';
      tip.innerHTML = '<div>' + text + '</div>';
      a.appendChild(tip);
    });

    if (!document.querySelector('.bref[data-ref] .btip')) return;

    SiteUtils.makeTooltipController('.bref[data-ref]', '.btip', {
      extraCloseSelectors: ['.btoc-nav', '.btoc-panel', '#toc-panel']
    });
  })();


  /* ============================================================
     20. Academic Footnotes (fn-marker / tooltip)
     O-02: логика hover/touch/click вынесена в SiteUtils.makeTooltipController
     ============================================================ */
  (function () {
    var markers = document.querySelectorAll('.fn-marker');
    if (!markers.length) return;

    /* Убираем лишний пробел перед маркером + aria-атрибуты для a11y */
    markers.forEach(function (m) {
      var prev = m.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        prev.textContent = prev.textContent.replace(/\s+$/, '');
      }
      /* Aria: role=button + label "Источник N — нажмите, чтобы открыть" */
      if (!m.getAttribute('aria-label')) {
        var num = (m.childNodes[0] ? m.childNodes[0].textContent : '').trim();
        m.setAttribute('aria-label', 'Источник' + (num ? ' ' + num : '') + ' — нажмите, чтобы открыть');
        m.setAttribute('role', 'button');
        if (!m.getAttribute('tabindex')) m.setAttribute('tabindex', '0');
      }
    });

    SiteUtils.makeTooltipController('.fn-marker', '.tooltip', {
      mobileSheet: true,
      mobileSheetBreakpoint: 768
    });
  })();


  
  /* ============================================================
     20b. Glossary Terms (gterm / gtip)
     O-02: логика hover/touch/click вынесена в SiteUtils.makeTooltipController
     ============================================================ */
  (function () {
    var glossaryControllerReady = false;

    function ownTextWithoutTip(el, tip) {
      var out = '';
      Array.prototype.forEach.call(el.childNodes, function (node) {
        if (node === tip) return;
        out += node.textContent || '';
      });
      return out.replace(/\s+/g, ' ').trim();
    }

    function normalizeGlossaryKey(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function glossaryCategoryFor(el, title) {
      var key = normalizeGlossaryKey(el.getAttribute('data-term') || title);
      var text = normalizeGlossaryKey(title);
      var hay = key + ' ' + text;

      var rules = [
        { slug: 'heresy', label: 'Ереси и споры', rx: /(ариан|гност|валентиниан|докет|демиург|монтан)/ },
        { slug: 'doctrine', label: 'Богословие', rx: /(хамартиолог|пелагиан|полупелагиан|арминиан|тотальн.*испорт|остаточн.*грех|остаточн.*порч|mortificatur|simul iustus)/ },
        { slug: 'confession', label: 'Исповедания', rx: /(вестминстер|гейдельберг|regula fidei|правило веры)/ },
        { slug: 'canon', label: 'Канон и тексты', rx: /(канон|canon muratori|муратор|апокриф|псевдоэпиграф|apostolicity|апостолич)/ },
        { slug: 'history', label: 'История', rx: /(меровинг|приорат|sol invictus|corpus hermeticum|провенанс|кархемиш|никей|коптск|коптский|коптском|коптские)/ },
        { slug: 'hermeneutics', label: 'Герменевтика', rx: /(герменевтик|экзегез|эйзегез|типолог|грамматико-истор|перикоп|criterion of embarrassment|критерий затруднения)/ },
        { slug: 'language', label: 'Языки оригинала', rx: /(птохой|шамир|heilsgeschichte|sola scriptura)/ }
      ];

      for (var i = 0; i < rules.length; i++) {
        if (rules[i].rx.test(hay)) return rules[i];
      }
      return { slug: 'glossary', label: 'Глоссарий' };
    }

    function enhanceGlossaryTip(el, idx) {
      var tip = el.querySelector('.gtip');
      if (!tip || tip.dataset.luxury === 'true') return;

      var termTitle = el.getAttribute('data-term-title') || ownTextWithoutTip(el, tip) || el.getAttribute('data-term') || 'Термин';
      var inferredCategory = glossaryCategoryFor(el, termTitle);
      var category  = el.getAttribute('data-category') || tip.getAttribute('data-category') || inferredCategory.label;
      var categorySlug = normalizeGlossaryKey(el.getAttribute('data-category-slug') || tip.getAttribute('data-category-slug') || inferredCategory.slug);
      var tipId     = tip.id || ('gtip-luxury-' + idx);

      tip.id = tipId;
      tip.dataset.luxury = 'true';
      tip.dataset.category = categorySlug;
      tip.setAttribute('role', 'tooltip');
      el.setAttribute('aria-describedby', tipId);
      el.setAttribute('aria-expanded', 'false');

      var raw = document.createElement('span');
      while (tip.firstChild) raw.appendChild(tip.firstChild);
      raw.className = 'gtip-luxury__definition';

      var shell = document.createElement('span');
      shell.className = 'gtip-luxury';

      var handle = document.createElement('span');
      handle.className = 'gtip-luxury__handle';
      handle.setAttribute('aria-hidden', 'true');
      shell.appendChild(handle);

      var header = document.createElement('span');
      header.className = 'gtip-luxury__header';

      var cat = document.createElement('span');
      cat.className = 'gtip-luxury__category';
      cat.dataset.category = categorySlug;
      cat.textContent = category;
      header.appendChild(cat);

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'gtip-luxury__close';
      closeBtn.setAttribute('aria-label', 'Закрыть подсказку');
      closeBtn.setAttribute('data-tooltip-close', '');
      closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
      header.appendChild(closeBtn);
      shell.appendChild(header);

      var title = document.createElement('strong');
      title.className = 'gtip-luxury__title';
      title.textContent = termTitle;
      shell.appendChild(title);

      var body = document.createElement('span');
      body.className = 'gtip-luxury__body';
      body.appendChild(raw);

      var divider = document.createElement('span');
      divider.className = 'gtip-luxury__divider';
      divider.setAttribute('aria-hidden', 'true');
      body.appendChild(divider);
      shell.appendChild(body);

      tip.appendChild(shell);
    }

    function initGlossaryTooltips(root) {
      var scope = root && root.querySelectorAll ? root : document;
      scope.querySelectorAll('.gterm').forEach(enhanceGlossaryTip);

      if (!glossaryControllerReady) {
        glossaryControllerReady = true;
        SiteUtils.makeTooltipController('.gterm', '.gtip', {
          useFocusBlur: true,
          mobileSheet: true,
          mobileSheetBreakpoint: 768
        });
      }
    }

    SiteUtils.initGlossaryTooltips = initGlossaryTooltips;
    if (window.SiteUtils && window.SiteUtils !== SiteUtils) {
      window.SiteUtils.initGlossaryTooltips = initGlossaryTooltips;
    }
    initGlossaryTooltips(document);
  })();


  /* ============================================================
     20c. AI Disclosure — REMOVED 2026-06-02
     Module deleted at editor's request. The /about/ page already
     describes editorial process; per-article disclosure was redundant.
     ============================================================ */


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
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = w.nextNode())) fixNode(n);
    }

    function init() {
      document.querySelectorAll(SELECTORS).forEach(walkTree);
    }

    SiteUtils.ready(init);
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
      if (document.querySelector('#share-dialog-overlay.is-open,.cp-backdrop.is-open,#gb-hl-backdrop.is-open')) return;

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
            else { overlay.classList.remove('open'); SiteUtils.unlockScroll('btoc'); }
          } else {
            if (window.SiteBTOC) { window.SiteBTOC.open(); }
            else {
              var sBtn = document.getElementById('barSectionBtn');
              if (sBtn) { sBtn.click(); }
              else { overlay.classList.add('open'); SiteUtils.lockScroll('btoc'); }
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
        var toggle = document.getElementById('themeToggle') || document.getElementById('hThemeBtn');
        var barTheme = SiteUtils.barThemeBtn();
        /* Module 29 (gb-fc-active pages): no #themeToggle, use .gb-fc-theme instead */
        var fcTheme = document.querySelector('.gb-fc-theme');
        if (toggle) { toggle.click(); }
        else if (barTheme) { barTheme.click(); }
        else if (fcTheme) { fcTheme.click(); }
        return;
      }

      /* B — прокрутить наверх */
      if (key === 'b') {
        e.preventDefault();
        showKbdHint('B', 'Наверх');
        SiteUtils.scrollToTop();
        return;
      }
    });
  })();


  /* ============================================================
     23. Selection Share
     Выделил → попап «Копировать / Поделиться»
     ============================================================ */
  (function () {
    if (!SiteUtils.articleEl()) return;

    var popup = document.createElement('div');
    popup.id = 'selection-share-popup';
    popup.setAttribute('aria-hidden', 'true');
    popup.innerHTML =
      '<button id="ss-copy" aria-label="Скопировать цитату">' +
        SVG_ICON_148 +
          '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
          '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
        '</svg>' +
        '<span>Копировать</span>' +
      '</button>' +
      '<div class="ss-sep"></div>' +
      '<button id="ss-share" aria-label="Поделиться цитатой">' +
        SVG_ICON_148 +
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

    /* AUDIT V6 / C1: iOS touch selection support.
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
      if (document.querySelector('.cp-backdrop.is-open')) return;
      handleSelection();
    });


    document.addEventListener('mousedown', function (e) { if (!popup.contains(e.target)) hide(); });
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('keydown', function (e) { if (SiteUtils.isEscape(e)) hide(); });

    /* AUDIT_10_OF_10 / SHR-9.1: правильная атрибуция, scroll-to-text, NBSP. */
    function findNearestH2() {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      var node = sel.getRangeAt(0).commonAncestorContainer;
      var el = node.nodeType === 1 ? node : node.parentElement;
      while (el && el.tagName !== 'H2') {
        el = el.previousElementSibling || (el.parentElement);
        if (!el || el === document.body) return null;
      }
      return (el && el.id) ? el : null;
    }
    function buildScrollToText(quote) {
      if (!quote) return '';
      var words = quote.replace(/[\u00ab\u00bb"\s]+/g, ' ').trim().split(/\s+/).slice(0, 6).join(' ');
      return words ? '#:~:text=' + encodeURIComponent(words) : '';
    }
    function buildQuoteUrl(quote) {
      var textFragment = buildScrollToText(quote);
      if (textFragment) return location.origin + location.pathname + textFragment;
      var h2 = findNearestH2();
      return location.origin + location.pathname + (h2 ? '#' + h2.id : '');
    }
    function buildQuoteShareText(quote) {
      var clean = (quote || '').replace(/[\u201C\u201D\u201E"]/g, '').replace(/\s*\u2014\s*/g, '\u00a0\u2014 ').trim();
      var title = (SiteUtils.h1El() ? SiteUtils.h1El().textContent : document.title).trim();
      var h2 = findNearestH2();
      var section = h2 ? ' · ' + h2.textContent.trim() : '';
      var url = buildQuoteUrl(quote);
      return '\u00ab' + clean + '\u00bb\u00a0\u2014 ' + title + section + ' \u00b7 ' + url;
    }

    function setSelectionCopiedState(btn) {
      var label = btn && btn.querySelector('span');
      var icon  = btn && btn.querySelector('svg');
      if (!label) return;
      var oldLabel = label.textContent;
      var oldIcon  = icon ? icon.innerHTML : '';
      btn.classList.add('is-copied');
      label.textContent = 'Скопировано';
      if (icon) icon.innerHTML = '<path d="M20 6 9 17l-5-5"/>';
      setTimeout(function () {
        btn.classList.remove('is-copied');
        label.textContent = oldLabel;
        if (icon) icon.innerHTML = oldIcon;
      }, 2200);
    }

    copyBtn.addEventListener('click', function () {
      if (!lastText) return;
      var text = buildQuoteShareText(lastText);
      function done() {
        if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {}
        setSelectionCopiedState(copyBtn);
      }
      SiteUtils.copyText(text, done);
      hide();
      window.getSelection && window.getSelection().removeAllRanges();
    });

    shareBtn.addEventListener('click', function () {
      if (!lastText) return;
      var quote = lastText.replace(/\s*\u2014\s*/g, '\u00a0\u2014 ').trim();
      var title = (SiteUtils.h1El() ? SiteUtils.h1El().textContent : document.title).trim();
      var h2 = findNearestH2();
      var section = h2 ? ' · ' + h2.textContent.trim() : '';
      var url = buildQuoteUrl(quote);
      var data = {
        title: title,
        text:  '\u00ab' + quote + '\u00bb\u00a0\u2014 ' + title + section,
        url:   url
      };
      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        navigator.share(data).catch(function () {});
      } else if (window.SiteShare && window.SiteShare.open) {
        window.SiteShare.open(shareBtn, { dialogTitle: 'Поделиться цитатой', title: title, text: data.text, url: data.url });
      } else {
        var toCopy = data.text + ' \u00b7 ' + data.url;
        SiteUtils.copyText(toCopy, function () {
            setSelectionCopiedState(shareBtn);
          });
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
              if (k === path || k === path + "/" || path === k + "/") data = idx[k];
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
        label.textContent = data.completed ? 'Прочитано' : pct + '%';

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
     26. Article Date Display
     Берёт дату из <meta property="article:modified_time">
     или <meta property="article:published_time">
     и вставляет видимый элемент в header статьи.
     Только на страницах статей (page.type === 'article').
     ============================================================ */
  (function () {
    if (!SiteUtils.isArticle()) return;

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
    var day, month, year;
    try {
      var parts = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric'
      }).formatToParts(date);
      day = (parts.find(function (p) { return p.type === 'day'; }) || {}).value;
      month = (parts.find(function (p) { return p.type === 'month'; }) || {}).value;
      year = (parts.find(function (p) { return p.type === 'year'; }) || {}).value;
    } catch (e) {
      var isoDay = (dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/) || []);
      year = isoDay[1] || date.getUTCFullYear();
      month = months[(Number(isoDay[2]) || (date.getUTCMonth() + 1)) - 1];
      day = String(Number(isoDay[3]) || date.getUTCDate());
    }

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
    var h1     = SiteUtils.h1El();

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
    if (SiteUtils.pageType() !== 'article') return;
    /* Тип C (Переводы) — drop-cap не применяется: академический текст,
       первый абзац содержит inline-сноски и форматирование переводчика */
    if (SiteUtils.getConfig('page.section', '') === 'Переводы') return;

    var article = SiteUtils.articleEl();
    if (!article) return;

    /* Уже есть — пропускаем */
    if (article.querySelector('.drop-cap')) return;

    var body = article.querySelector('.article-body') || article;
    /* AUDIT v6 fix: skip summary-card / quiz / sidebar paragraphs */
    var allP = body.querySelectorAll('p');
    var firstP = null;
    for (var i = 0; i < allP.length; i++) {
      var p = allP[i];
      if (p.closest('.summary-card, .quiz-wrapper, .quiz-overlay, .info-box, .warn-box, .ehrman-block, .note-box, .quote-box, aside, .author-card, .toc, blockquote')) continue;
      firstP = p;
      break;
    }
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
    var pageType = SiteUtils.pageType();
    var isArticlePage = pageType === 'article';
    var allowEndBlock = isArticlePage || pageType === 'about' || pageType === 'series';
    if (!allowEndBlock) return;

    var article = SiteUtils.articleEl() || document.querySelector('main');
    if (!article) return;

    /* Не дублируем */
    if (document.querySelector('.article-end-block')) return;

    /* Проверяем, разрешён ли шаринг */
    var shareCfg = SiteUtils.featureShare({});
    var showActions = isArticlePage;
    var showShare = showActions && shareCfg.enabled !== false;

    /* ── Строим HTML кнопок ── */
    var actionsHTML = '';
    if (showShare) {
      actionsHTML +=
        '<button type="button" class="article-end-btn" id="articleEndShareBtn" aria-label="Поделиться статьёй">' +
          SVG_ICON_114 +
            '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
            '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
            '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
          '</svg>' +
          'Поделиться статьёй' +
        '</button>';
    }

    if (showActions) {
      actionsHTML +=
        '<button type="button" class="article-end-btn" id="articleEndPrintBtn" aria-label="Распечатать статью или сохранить как PDF">' +
          SVG_ICON_114 +
            '<polyline points="6 9 6 2 18 2 18 9"/>' +
            '<path d="M6 18H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>' +
            '<rect x="6" y="14" width="12" height="8"/>' +
          '</svg>' +
          'Распечатать / PDF' +
        '</button>';
    }

    /* ── Собираем блок ── */
    var block = document.createElement('div');
    block.className = 'article-end-block';
    block.innerHTML =
      (actionsHTML ? '<div class="article-end-actions">' + actionsHTML + '</div>' : '') +
      '<div class="article-end-sdg" itemscope itemtype="https://schema.org/CreativeWork">' +
        '<meta itemprop="about" content="Soli Deo Gloria">' +
        '<span class="sdg" itemprop="name">Soli Deo Gloria</span>' +
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

    var printBtn = block.querySelector('#articleEndPrintBtn');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

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
      /* FIX r58.3: target может быть вложенным элементом (внутри <span>
         с забытым </span> и т.д.). insertBefore требует прямого child.
         Поднимаемся по DOM до прямого ребёнка <article>. */
      var directChild = target;
      while (directChild && directChild.parentNode && directChild.parentNode !== article) {
        directChild = directChild.parentNode;
      }
      if (directChild && directChild.parentNode === article) {
        article.insertBefore(block, directChild);
      } else {
        article.appendChild(block);
      }
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
        /* Безопасное удаление: только если wrapper содержит ТОЛЬКО sdgEl */
        if (wrapper.children.length === 1) {
          wrapper.remove();
        } else {
          /* Заменить wrapper на его содержимое */
          var frag = document.createDocumentFragment();
          while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
          if (wrapper.parentNode) wrapper.parentNode.replaceChild(frag, wrapper);
        }
      }
    });
  })();

  /* ============================================================
     Article — image viewer (breathe badge + click to zoom)
     ============================================================ */
  (function () {
    if (!SiteUtils.isArticle()) return;

    var imgs = document.querySelectorAll('.article-figure img, .article-img img, .nagornaya-hero-img');
    if (!imgs.length) return;

    var viewer = document.createElement('div');
    viewer.className = 'img-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Просмотр изображения');
    viewer.innerHTML =
      '<div class="img-viewer__panel" role="document">' +
        '<div class="img-viewer__top">' +
          '<button type="button" class="img-viewer__close" aria-label="Закрыть просмотр изображения">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="img-viewer__body">' +
          '<img class="img-viewer__img" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="" loading="eager">' +
          '<div class="img-viewer__cap"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(viewer);

    var closeBtn = viewer.querySelector('.img-viewer__close');
    var imgEl = viewer.querySelector('.img-viewer__img');
    var capEl = viewer.querySelector('.img-viewer__cap');

    var lastActive = null;
    var _closeTimer = null;

    /* ── Focus trap ── */
    var VIEWER_FOCUSABLE = 'button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function getViewerFocusable() {
      return Array.prototype.slice.call(viewer.querySelectorAll(VIEWER_FOCUSABLE));
    }
    function trapViewerTab(e) {
      if (e.key !== 'Tab') return;
      var els = getViewerFocusable();
      if (!els.length) return;
      var first = els[0], last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    var openedByKeyboard = false;

    function open(src, alt, captionText, byKeyboard) {
      if (viewer.classList.contains('is-open')) return;
      /* Отменяем отложенную очистку, если viewer переоткрыли до её срабатывания */
      if (_closeTimer !== null) { clearTimeout(_closeTimer); _closeTimer = null; }
      lastActive = document.activeElement;
      openedByKeyboard = !!byKeyboard;
      imgEl.src = src;
      imgEl.alt = alt || '';
      capEl.textContent = captionText || '';
      viewer.classList.add('is-open');
      
      /* Fix scroll jump bug: block scroll of documentElement instead of fixed body position */
      document.documentElement.style.overflow = 'hidden';
      
      /* B-02: фокус на кнопку закрытия + trap.
         Снимаем перед добавлением — защита от двойного open() без close().  */
      viewer.removeEventListener('keydown', trapViewerTab);
      viewer.addEventListener('keydown', trapViewerTab);
      if (closeBtn) {
        try { closeBtn.focus({ preventScroll: true }); }
        catch (e) { closeBtn.focus(); }
      }
    }

    function close() {
      if (!viewer.classList.contains('is-open')) return;
      viewer.classList.remove('is-open');
      viewer.removeEventListener('keydown', trapViewerTab);
      
      /* Delay scroll release and focus restoration until the fade-out (280ms) is complete! */
      _closeTimer = setTimeout(function () {
        _closeTimer = null;
        document.documentElement.style.overflow = '';
        if (openedByKeyboard && lastActive && lastActive.focus) {
          try { lastActive.focus({ preventScroll: true }); }
          catch (e) { lastActive.focus(); }
        }
        lastActive = null;
        openedByKeyboard = false;
        imgEl.removeAttribute('src');
        capEl.textContent = '';
      }, 290);
    }

    imgs.forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        var fig = img.closest('.article-figure, .article-img');
        var cap = fig && fig.querySelector('figcaption');
        open(img.currentSrc || img.src, img.alt, cap ? cap.textContent.trim() : '', false);
      });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var fig = img.closest('.article-figure, .article-img');
          var cap = fig && fig.querySelector('figcaption');
          open(img.currentSrc || img.src, img.alt, cap ? cap.textContent.trim() : '', true);
        }
      });
    });

    viewer.addEventListener('click', function (e) {
      if (e.target === viewer) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (!viewer.classList.contains('is-open')) return;
      if (SiteUtils.isEscape(e)) { e.stopImmediatePropagation(); close(); }
    });
  })();

  /* ============================================================
     Article — lazy loading images below the fold (safe default)
     - applies only if author didn't set loading explicitly
     - skips hero / fetchpriority="high"
     ============================================================ */
  (function () {
    if (!SiteUtils.isArticle()) return;

    var scope = SiteUtils.articleEl() || document;
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
    if (!SiteUtils.isHome()) return;

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

      var btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.className = 'btoc-fontsize-btn btoc-fontsize-btn--down';
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
      btnUp.type = 'button';
      btnUp.className = 'btoc-fontsize-btn btoc-fontsize-btn--up';
      btnUp.setAttribute('aria-label', 'Увеличить шрифт');
      btnUp.textContent = 'A';

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

    SiteUtils.ready(injectAll);

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
    if (!panel) return;

    var marked = false;
    var startedAt = Date.now();
    if (window.ScrollBus) {
      window.ScrollBus.subscribe(function(state) {
        if (marked) return;
        var timeOnPage = Date.now() - startedAt;
        var minTimeOnPage = SiteUtils.getConfig('features.bookmarks.minTimeOnPage', 10000);
        if (timeOnPage < minTimeOnPage) return;

        var pct = Math.round(state.pct * 100);
        if (pct < 98) return;

        marked = true;
        panel.classList.add('btoc-completed');
        
        var fillNow = document.getElementById('btocProgressFill') || document.querySelector('.btoc-progress-bar-wrap .btoc-seg-fill');
        if (fillNow) fillNow.classList.add('btoc-progress-fill-done');
        
        try {
          if (window.BookmarkEngine && typeof window.BookmarkEngine.markCompleted === 'function') {
            window.BookmarkEngine.markCompleted();
          }
        } catch (e) {}
      });
    }
  })();

  /* ============================================================
     INTERACTIVE TITLE — резиновая волна по буквам «Сила Моя»
     при mouseenter на заголовке. Каждая буква получает CSS-класс
     .is-bouncing с keyframe sti-rubber и stagger-задержкой.
     ============================================================ */
  (function () {
    var hi = document.querySelector('.sti-highlight');
    if (!hi) return;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Разбиваем текст на буквы */
    var text = hi.textContent;
    hi.textContent = '';
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.textContent = text[i];
      hi.appendChild(s);
    }

    var chars = Array.prototype.slice.call(hi.querySelectorAll('span'));
    var title = document.querySelector('.site-title-interactive');
    if (!title) return;

    var running = false;

    function bounce() {
      if (reduceMotion || running) return;
      running = true;
      var STAGGER = 55; /* мс между буквами */
      var DUR = 550;    /* мс длительность одной анимации */
      chars.forEach(function (c, i) {
        setTimeout(function () {
          c.classList.remove('is-bouncing');
          /* reflow чтобы анимация стартовала заново */
          void c.offsetWidth;
          c.style.animationDelay = '0ms';
          c.classList.add('is-bouncing');
        }, i * STAGGER);
      });
      /* Сбрасываем флаг после завершения всей волны */
      var totalDur = (chars.length - 1) * STAGGER + DUR;
      setTimeout(function () {
        running = false;
        chars.forEach(function (c) { c.classList.remove('is-bouncing'); });
      }, totalDur);
    }

    title.addEventListener('mouseenter', bounce);
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
        var acc = btn.closest('.faq-accordion');
        if (acc && acc.getAttribute('data-gb-faq-enhanced')) return;
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




  /* ──────────────────────────────────────────────────────────────────
     AUDIT_10_OF_10 / NAV-11.2: автоподстановка subject/body для mailto
     в .gb-accuracy-block.
     ────────────────────────────────────────────────────────────────── */
  document.querySelectorAll('.gb-accuracy-btn--email[href^="mailto:"]').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var to = href.replace(/^mailto:/, '').split('?')[0] || 'viktorcoy2012@gmail.com';
    var pageTitle = (SiteUtils.h1El() ? SiteUtils.h1El().textContent : document.title).trim();
    var pageUrl = location.href.split('#')[0];
    var subj = encodeURIComponent('Неточность в материале: ' + pageTitle);
    var body = encodeURIComponent(
      'Здравствуйте,\n\nЯ обнаружил неточность в материале:\n' +
      pageTitle + '\n' + pageUrl + '\n\n' +
      'Что именно требует проверки:\n[опишите неточность]\n\n' +
      'Если возможно, приложите источник или скриншот.\n\n' +
      '— Спасибо!'
    );
    a.setAttribute('href', 'mailto:' + to + '?subject=' + subj + '&body=' + body);
  });

  /* ──────────────────────────────────────────────────────────────────
     AUDIT_10_OF_10 / NAV-11.1: автоинъекция /js/series-cards.js,
     /js/glossary.js (lazy, только если нужно).
     ────────────────────────────────────────────────────────────────── */
  (function lazyExtras() {
    function scriptAlreadyPresent(src) {
      return Array.prototype.some.call(document.scripts, function (sc) {
        if (sc.dataset && sc.dataset.extra === src) return true;
        try { return new URL(sc.getAttribute('src') || sc.src || '', location.href).pathname === src; }
        catch (e) { return false; }
      });
    }
    function add(src) {
      if (scriptAlreadyPresent(src)) return;
      var sc = document.createElement('script');
      var version = window.SiteUtils && window.SiteUtils.getConfig('version', '');
      sc.src = src + (version ? '?v=' + encodeURIComponent(version) : '');
      sc.defer = true;
      sc.dataset.extra = src;
      document.head.appendChild(sc);
    }
    if (document.querySelector('[data-series-cards]')) add('/js/series-cards.js');
    /* Глоссарий загружается на ВСЕХ страницах с <article>,
       не только на article-type — это даёт единый сайт-уровневый глоссарий. */
    if (SiteUtils.articleEl()) add('/js/glossary.js');
  })();
})();


/* ============================================================
   29. Floating Controls (UNIFIED) — единый sticky-блок «тема + поиск»
   ────────────────────────────────────────────────────────────
   AGENTS-r17: заменяет три разрозненных артефакта:
     • встроенные <button class="theme-toggle"> в шапках статей (absolute, уезжали при скролле)
     • #themeFloat (theme-toggle-floating.js — bottom-right FAB)
     • #gbSearchFloat (Floating Search Button — top-right, inline-styled)

   Правила (из AGENTS.md §6.1):
     • Активируется ТОЛЬКО на страницах с хлебными крошками (.breadcrumb).
       На главной / каталогах (index, articles/, biografii/, pastor-series/,
       nagornaya/seriya/, about/) переключатель темы уже встроен в верхнюю
       навигацию (.mobile-controls или равноценную) — там этот модуль не работает.
     • Две идентичные круглые кнопки в одном fixed-блоке справа сверху:
       (1) тема — на уровне breadcrumb, (2) поиск — ниже на 52 px.
     • Sticky (position:fixed) — не уезжают при скролле.
     • Канонические SVG-иконки sun/moon инжектятся JS-ом, независимо
       от того что было в HTML (фикс «вместо солнышка кружочек»).
     • Логика темы — общая (html.dark + localStorage 'theme' + событие
       'theme:changed'); поиск — через GBSearch.open() или 'gb:openSearch'.
   ============================================================ */
(function () {
  'use strict';

  /* SVG dedup: общие префиксы для нескольких иконок этого модуля.
     Объявлены ДО первого использования (исправлено в r58). */
  var SVG_SEARCH_LARGE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

  /* Запуск на reading-страницах: article/series-pages с навигационной
     цепочкой (.breadcrumb) и на страницах серии «Нагорная проповедь»
     (body.nagornaya-page) — у них собственный sidebar вместо breadcrumb.
     На главной/каталогах (index, articles/, biografii/, pastor-series/,
     nagornaya/seriya/) переключатель темы живёт в шапке .mobile-controls —
     там этот модуль не нужен. */
  function shouldActivate() {
    if (document.querySelector('.breadcrumb')) return true;
    return false;
  }

  /* Канонические SVG, единые для всего сайта. */
  var SUN_SVG =
    SVG_SEARCH_LARGE +
    '<circle cx="12" cy="12" r="4.5"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>' +
    '</svg>';
  var MOON_SVG =
    SVG_SEARCH_LARGE +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' +
    '</svg>';
  var SEARCH_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>' +
    '</svg>';

  function iconForTheme() {
    return document.documentElement.classList.contains('dark') ? SUN_SVG : MOON_SVG;
  }

  function ready(fn) {
    SiteUtils.ready(fn);
  }

  ready(function () {
    if (!shouldActivate()) return;
    if (document.getElementById('gbFloatingControls')) return;

    /* Маркер на body — позволяет CSS скрыть legacy-кнопки только тут. */
    document.body.classList.add('gb-fc-active');

    /* ── Контейнер ──────────────────────────────────────────────── */
    var wrap = document.createElement('div');
    wrap.id = 'gbFloatingControls';
    wrap.className = 'gb-floating-controls';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Тема и поиск');

    /* ── Кнопка темы ───────────────────────────────────────────── */
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'gb-fc-btn gb-fc-theme';
    themeBtn.setAttribute('aria-label', 'Переключить тему');
    themeBtn.setAttribute('title', 'Светлая / тёмная тема (D)');
    themeBtn.innerHTML = iconForTheme();

    /* ── Кнопка поиска ─────────────────────────────────────────── */
    var searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'gb-fc-btn gb-fc-search';
    searchBtn.setAttribute('aria-label', 'Открыть поиск');
    searchBtn.setAttribute('title', 'Поиск по сайту (/)');
    searchBtn.innerHTML = SEARCH_SVG;

    wrap.appendChild(themeBtn);
    if (!document.body.classList.contains('nagornaya-page')) {
      wrap.appendChild(searchBtn);
    }
    document.body.appendChild(wrap);

    /* ── Логика темы ──────────────────────────────────────────── */
    function setTheme(toDark) {
      document.documentElement.classList.toggle('dark', toDark);
      themeBtn.innerHTML = iconForTheme();
      try { localStorage.setItem(SiteUtils.themeKey, toDark ? 'dark' : 'light'); } catch (_) {}
      document.dispatchEvent(new CustomEvent('theme:changed', { detail: { dark: toDark } }));
      /* a11y: announce theme change to screen readers */
      var announcer = document.getElementById('gb-theme-announcer');
      if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'gb-theme-announcer';
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
        document.body.appendChild(announcer);
      }
      announcer.textContent = toDark ? 'Включена тёмная тема' : 'Включена светлая тема';
    }
    themeBtn.addEventListener('click', function () {
      setTheme(!document.documentElement.classList.contains('dark'));
    });

    /* Если кто-то ещё (bottom-bar, legacy кнопки) переключил html.dark — синхронизируем иконку. */
    var classObs = new MutationObserver(function () {
      var want = iconForTheme();
      if (themeBtn.innerHTML !== want) themeBtn.innerHTML = want;
    });
    classObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    /* ── Логика поиска ────────────────────────────────────────── */
    searchBtn.addEventListener('click', function () {
      if (window.GBSearch && typeof window.GBSearch.open === 'function') {
        window.GBSearch.open();
      } else {
        window.dispatchEvent(new CustomEvent('gb:openSearch'));
      }
    });

    /* ── Канонизация SVG в видимых legacy-кнопках (bottom-bar) ──────
       На некоторых страницах в HTML лежит ущербный SVG (только круг без
       лучей — «кружочек»). Скрытые кнопки (через body.gb-fc-active)
       не трогаем, а вот видимые в bottom-bar / .mobile-controls
       приводим к каноническому виду. */
    function canonizeLegacyIcons() {
      var visible = document.querySelectorAll(
        '.bottom-bar .theme-toggle, .mobile-controls .theme-toggle'
      );
      Array.prototype.forEach.call(visible, function (btn) {
        if (btn.dataset.gbCanonical === '1') return;
        btn.dataset.gbCanonical = '1';
        /* Сохраняем два слоя (sun + moon) — старый CSS использует .icon-sun/.icon-moon
           для cross-fade, поэтому стилизуем оба слоя одинаково. */
        var sunWrap = btn.querySelector('.icon-sun');
        var moonWrap = btn.querySelector('.icon-moon');
        var canon =
          '<span class="icon-sun" aria-hidden="true">' + SUN_SVG + '</span>' +
          '<span class="icon-moon" aria-hidden="true">' + MOON_SVG + '</span>';
        if (sunWrap || moonWrap) {
          btn.innerHTML = canon;
        } else {
          /* Простой одиночный SVG, как в nag-sidebar-theme-btn */
          btn.innerHTML = iconForTheme();
        }
      });
    }
    canonizeLegacyIcons();
  });
})();

/* ============================================================
   30. Glossary cross-ref clicks внутри тултипов
   ────────────────────────────────────────────────────────────
   AGENTS-r17: в /data/glossary.json определения могут содержать
   ссылки вида <a class="gterm" href="#" data-term="экзегеза">…</a>.
   Эти ссылки попадают внутрь .gtip / .gtip-luxury__body, но клик
   по ним до сих пор не переключал тултип на другой термин (т.к.
   makeTooltipController обрабатывает только клик по .gterm на странице).

   Делаем делегирование: клик по .gtip a.gterm[data-term] → найти на
   странице первый .gterm[data-term="<...>"] и кликнуть по нему
   (или, если нет — открыть отдельный тултип-overlay со значением).
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('.gtip a.gterm[data-term], .gtip-luxury__body a.gterm[data-term], .gtip-luxury a.gterm[data-term]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();

    var term = (a.getAttribute('data-term') || '').toLowerCase();
    if (!term) return;

    /* Закрываем текущий тултип через зарегистрированные контроллеры, чтобы синхронизировать внутренний стейт */
    if (window.SiteUtils && Array.isArray(window.SiteUtils._tooltipControllers)) {
      window.SiteUtils._tooltipControllers.forEach(function (c) {
        c.close(true);
      });
    } else {
      var openTip = document.querySelector('.gtip.is-open, .gtip-luxury.is-open');
      if (openTip && openTip.classList) openTip.classList.remove('is-open');
      var opened = document.querySelectorAll('.gterm[aria-expanded="true"]');
      Array.prototype.forEach.call(opened, function (el) { el.setAttribute('aria-expanded', 'false'); });
    }

    /* Ищем целевой .gterm на странице (вне любого .gtip) */
    var candidates = document.querySelectorAll('.gterm[data-term]');
    var target = null;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c.closest('.gtip, .gtip-luxury')) continue;
      if ((c.getAttribute('data-term') || '').toLowerCase() === term) { target = c; break; }
    }

    if (target) {
      /* Скроллим к найденному термину и эмулируем клик через короткую задержку */
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}
      setTimeout(function () {
        target.click();
        if (typeof target.focus === 'function') {
          try { target.focus({ preventScroll: true }); } catch (__) { target.focus(); }
        }
      }, 240);
    }
  }, true);




  /* ============================================================
     35. Home/Catalog Page Infrastructure
     hReadingProgress, hNavbar scroll/hide, hScrollTop,
     hMobileMenu, .h-reveal → .h-in reveal.
     Заменяет inline <script> в 4 catalog-страницах — AGENTS-r41.
     Активируется только если есть #hReadingProgress на странице.
     ============================================================ */
  (function () {
    var progressBar   = document.getElementById('hReadingProgress');
    if (!progressBar) return; /* Только на home/catalog страницах */

    var progressCircle = document.getElementById('hProgressCircle');
    var circumference  = 138.23; /* 2πr для circle r=22 */
    var navbar         = document.getElementById('hNavbar');
    var scrollTopBtn   = document.getElementById('hScrollTop');
    var reveals        = document.querySelectorAll('.h-reveal');
    var lastScroll     = window.scrollY || window.pageYOffset || 0;

    /* ── Reading progress ── */
    function updateProgress() {
      var scrollTop = window.scrollY || window.pageYOffset;
      var docH = SiteUtils.docH();
      var pct  = docH > 0 ? scrollTop / docH : 0;
      progressBar.style.width = (pct * 100) + '%';
      if (progressCircle) {
        progressCircle.style.strokeDashoffset =
          (circumference - pct * circumference).toFixed(2);
      }
    }

    /* ── Navbar scroll-hide ── */
    function updateNavbar() {
      if (!navbar) return;
      var s = window.scrollY || window.pageYOffset;
      navbar.classList.toggle('scrolled', s > 40);
      if (s > 300 && s > lastScroll + 6)      navbar.classList.add('nav-hidden');
      else if (s < lastScroll - 6)            navbar.classList.remove('nav-hidden');
      lastScroll = s;
    }

    /* ── Scroll-to-top button ── */
    function updateScrollTop() {
      if (!scrollTopBtn) return;
      scrollTopBtn.classList.toggle('visible',
        (window.scrollY || window.pageYOffset) > 500);
    }
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* ── .h-reveal → .h-in ── */
    function revealOnScroll() {
      reveals.forEach(function (el) {
        if (!el.classList.contains('h-in') &&
            el.getBoundingClientRect().top < window.innerHeight - 60) {
          el.classList.add('h-in');
        }
      });
    }
    if (reveals.length) {
      if (window.IntersectionObserver) {
        var revObs = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              e.target.classList.add('h-in');
              revObs.unobserve(e.target);
            }
          });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach(function (el) { revObs.observe(el); });
      } else {
        revealOnScroll();
      }
    }

    /* ── Mobile menu (hMobileMenuBtn / hMobileNav) ── */
    var mobileMenuBtn  = document.getElementById('hMobileMenuBtn');
    var mobileNav      = document.getElementById('hMobileNav');
    var mobileBackdrop = document.getElementById('hMobileBackdrop');
    var mobileOpen     = false;

    function openMobileNav() {
      if (!mobileNav || !mobileMenuBtn) return;
      mobileOpen = true;
      mobileNav.classList.add('open');
      mobileNav.removeAttribute('aria-hidden');
      mobileMenuBtn.classList.add('is-open');
      mobileMenuBtn.setAttribute('aria-expanded', 'true');
      mobileMenuBtn.setAttribute('aria-label', 'Закрыть меню');
      if (mobileBackdrop) mobileBackdrop.classList.add('open');
      if (window.SiteUtils && window.SiteUtils.lockScroll)
        window.SiteUtils.lockScroll('home-mobile-menu');
      else document.body.style.overflow = 'hidden';
    }
    function closeMobileNavFn() {
      if (!mobileNav || !mobileMenuBtn) return;
      mobileOpen = false;
      mobileNav.classList.remove('open');
      mobileNav.setAttribute('aria-hidden', 'true');
      mobileMenuBtn.classList.remove('is-open');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      mobileMenuBtn.setAttribute('aria-label', 'Открыть меню');
      if (mobileBackdrop) mobileBackdrop.classList.remove('open');
      if (window.SiteUtils && window.SiteUtils.unlockScroll)
        window.SiteUtils.unlockScroll('home-mobile-menu');
      else document.body.style.overflow = '';
    }
    /* Экспортируем для onclick в HTML */
    window.closeMobileNav = closeMobileNavFn;

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', function () {
        if (mobileOpen) closeMobileNavFn(); else openMobileNav();
      });
    }
    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileNavFn);
    document.addEventListener('keydown', function (e) {
      if (mobileOpen && (SiteUtils.isEscape(e))) closeMobileNavFn();
    });

    /* ── Единый scroll-handler (rAF throttled) ── */
    SiteUtils.scrollRaf(function () {
      updateProgress(); updateNavbar(); updateScrollTop();
    });

    /* Инициализация */
    updateProgress(); updateNavbar(); updateScrollTop();
  })();

  /* ============================================================
     34. Article Top Nav — scroll-aware sticky header
     Перенесено из inline <script> в 7 статьях — AGENTS-r38.
     Управляет #articleTopnav: visible после 60px скролла,
     title-visible когда h1 уходит выше viewport.
     ============================================================ */
  (function () {
    var nav = document.getElementById('articleTopnav');
    if (!nav) return;

    document.body.classList.add('topnav-active');
    var h1 = SiteUtils.h1El();
    function onScroll() {
      var s = window.scrollY || window.pageYOffset;
      nav.classList.toggle('visible', s > 60);
      if (h1) {
        nav.classList.toggle('title-visible', h1.getBoundingClientRect().bottom < 0);
      }
    }

    SiteUtils.scrollRaf(onScroll);
    onScroll();
  })();

  /* ============================================================
     33. Tooltip-trigger унификация — nagornaya + общий сайт
     Заменяет inline <script> в nagornaya/chast-1..4.
     Ищет .tooltip-trigger[data-tooltip] и превращает их в
     .gterm + .gtip — подхватываются initGlossaryTooltips.
     ============================================================ */
  (function () {
    'use strict';

    /* Запускаем только если есть .tooltip-trigger на странице */
    function initTooltipTriggers() {
      var triggers = document.querySelectorAll('.tooltip-trigger[data-tooltip]');
      if (!triggers.length) return;

      /* Для каждого .tooltip-trigger:
         1. Добавляем class="gterm" (CSS совместимость)
         2. Создаём дочерний .gtip[data-luxury] с определением
         3. Убираем inline position:relative / borderBottom / cursor
            (CSS .gterm уже стилизует корректно) */
      Array.prototype.forEach.call(triggers, function (el) {
        var text = el.getAttribute('data-tooltip');
        if (!text) return;

        /* Уже обработан? */
        if (el.classList.contains('gterm')) return;

        /* Создаём luxury gtip */
        var tip = document.createElement('span');
        tip.className = 'gtip';
        tip.setAttribute('data-luxury', 'true');

        var inner = document.createElement('span');
        inner.className = 'gtip-luxury';

        /* Handle — только мобильно */
        var handle = document.createElement('span');
        handle.className = 'gtip-luxury__handle';
        inner.appendChild(handle);

        /* Header */
        var header = document.createElement('div');
        header.className = 'gtip-luxury__header';
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'gtip-luxury__close';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        header.appendChild(closeBtn);
        inner.appendChild(header);

        /* Body */
        var body = document.createElement('div');
        body.className = 'gtip-luxury__body';
        var definition = document.createElement('p');
        definition.className = 'gtip-luxury__definition';
        definition.textContent = text;
        body.appendChild(definition);
        inner.appendChild(body);

        tip.appendChild(inner);
        el.appendChild(tip);

        /* Добавляем .gterm — CSS и tooltip controller подхватит */
        el.classList.add('gterm');
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-expanded', 'false');
        el.setAttribute('aria-label', el.textContent.replace(text, '').trim() || 'пояснение');

        /* Убираем старые inline стили (перекрываются CSS .gterm) */
        if (el.style.position === 'relative') el.style.removeProperty('position');
        if (el.style.cursor) el.style.removeProperty('cursor');
        if (el.style.borderBottom) el.style.removeProperty('border-bottom');
      });

      /* Инициализируем через унифицированную систему */
      if (window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function') {
        window.SiteUtils.initGlossaryTooltips(document.body);
      }
    }

    /* Запускаем после загрузки glossary.js (defer) */
    SiteUtils.ready(initTooltipTriggers);
  })();

  /* ============================================================
     32. View Transitions API — page transitions (Progressive Enhancement)
     Chrome 111+, Safari 18+. Базово недоступно — без fallback безопасно.
     При клике на внутренние ссылки: fade transition.
     ============================================================ */
  (function () {
    if (!document.startViewTransition) return;

    /* Только внутренние ссылки на те же origin */
    function isSameOrigin(href) {
      try {
        return new URL(href, location.href).origin === location.origin;
      } catch (e) { return false; }
    }

    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link) return;

      var href = link.getAttribute('href');
      /* Пропускаем: якоря, внешние, target=_blank, модификаторы */
      if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
          href.startsWith('tel:') || href.startsWith('javascript:')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target === '_blank' || link.target === '_new') return;
      if (!isSameOrigin(href)) return;

      e.preventDefault();
      document.startViewTransition(function () {
        window.location.href = href;
      });
    }, { passive: false });
  })();


  /* ============================================================
     Z. Table Scroll Auto-Wrapping
     Ensures all .manuscript-table elements are wrapped in a 
     responsive scrollable .table-scroll container on mobile.
     ============================================================ */
  (function () {
    function wrapTables() {
      var tables = document.querySelectorAll('.manuscript-table');
      tables.forEach(function (table) {
        if (table.parentNode && table.parentNode.classList.contains('table-scroll')) return;
        
        var wrapper = document.createElement('div');
        wrapper.className = 'table-scroll';
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('tabindex', '0');
        var ariaLabel = table.getAttribute('aria-label') || 'Таблица';
        wrapper.setAttribute('aria-label', ariaLabel);
        
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wrapTables);
    } else {
      wrapTables();
    }
  })();
})();
