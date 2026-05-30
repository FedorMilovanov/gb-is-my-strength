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
    var hasLocks = locks.size > 0 || Object.keys((window.SiteUtils && window.SiteUtils._scrollLockSources) || {}).length > 0;
    if (!hasOpenModal && hasLocks) {
      console.warn('[SiteUtils] Emergency unlock — модалок нет, замки висят:', locks);
      /* BUGFIX 2026-05-30: site.js до правки B1 заменял window.SiteUtils целиком и
         стирал forceUnlockScroll. Сейчас merge сохраняет метод, но добавляем
         fallback на forceUnlockEmergency из site.js — на случай других загрузчиков. */
      var u = window.SiteUtils || {};
      if (typeof u.forceUnlockScroll === 'function') u.forceUnlockScroll();
      else if (typeof u.forceUnlockEmergency === 'function') u.forceUnlockEmergency();
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

  function cleanupEmergencyTimer() {
    if (emergencyTimer) {
      clearInterval(emergencyTimer);
      emergencyTimer = null;
    }
  }

  window.addEventListener('pagehide', cleanupEmergencyTimer);
  window.addEventListener('beforeunload', cleanupEmergencyTimer);

  window.SiteUtils.forceUnlockScroll = function () {
    locks.clear();
    releaseLock();
    cleanupEmergencyTimer();
  };
})();
