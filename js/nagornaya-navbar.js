/* ============================================================
   nagornaya-navbar.js
   Поведение фирменного h-navbar на независимых страницах
   «Нагорной проповеди».

   Основано на существующей логике главной страницы:
   reading progress, smart navbar, theme-toggle, mobile menu.
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var html = document.documentElement;
    var progressBar = document.getElementById('hReadingProgress');
    var navbar = document.getElementById('hNavbar');
    var mobileMenuBtn = document.getElementById('hMobileMenuBtn');
    var mobileNav = document.getElementById('hMobileNav');
    var mobileBackdrop = document.getElementById('hMobileBackdrop');
    var themeToggle = document.getElementById('themeToggle') || document.getElementById('hThemeBtn');
    var lastScroll = 0;
    var mobileOpen = false;

    function safeThemeGet() {
      try { return localStorage.getItem('theme'); } catch (e) { return null; }
    }
    function safeThemeSet(val) {
      try { localStorage.setItem('theme', val); } catch (e) {}
    }

    var saved = safeThemeGet();
    if (saved === 'dark') {
      html.classList.add('dark');
    } else if (saved === 'light') {
      html.classList.remove('dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    }

    function syncThemeButton() {
      if (!themeToggle) return;
      themeToggle.setAttribute('aria-pressed', html.classList.contains('dark') ? 'true' : 'false');
    }

    if (themeToggle) {
      syncThemeButton();
      themeToggle.addEventListener('click', function () {
        var isDark = html.classList.toggle('dark');
        safeThemeSet(isDark ? 'dark' : 'light');
        syncThemeButton();
      });
    }

    function updateProgress() {
      if (!progressBar) return;
      var scrollTop = window.scrollY || window.pageYOffset;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? scrollTop / docH : 0;
      progressBar.style.transform = 'scaleX(' + pct + ')';
    }

    function updateNavbar() {
      if (!navbar) return;
      var s = window.scrollY || window.pageYOffset;
      if (s > 40) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
      if (s > 300 && s > lastScroll + 6) navbar.classList.add('nav-hidden');
      else if (s < lastScroll - 6) navbar.classList.remove('nav-hidden');
      lastScroll = s;
    }

    function openMobileNav() {
      if (!mobileMenuBtn || !mobileNav || !mobileBackdrop) return;
      mobileOpen = true;
      mobileNav.classList.add('open');
      mobileNav.removeAttribute('aria-hidden');
      mobileMenuBtn.setAttribute('aria-expanded', 'true');
      mobileMenuBtn.classList.add('is-open');
      document.body.classList.add('no-scroll');
      mobileBackdrop.classList.add('open');
    }

    function closeMobileNavInternal() {
      if (!mobileMenuBtn || !mobileNav || !mobileBackdrop) return;
      mobileOpen = false;
      mobileNav.classList.remove('open');
      mobileNav.setAttribute('aria-hidden', 'true');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      mobileMenuBtn.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      mobileBackdrop.classList.remove('open');
    }

    if (mobileNav) {
      mobileNav.addEventListener('click', function (e) {
        if (e.target.closest('[data-close-nav]')) closeMobileNavInternal();
      });
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', function () {
        if (mobileOpen) closeMobileNavInternal();
        else openMobileNav();
      });
    }

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', closeMobileNavInternal);
    }

    document.addEventListener('keydown', function (e) {
      if (mobileOpen && (e.key === 'Escape' || e.key === 'Esc')) {
        closeMobileNavInternal();
        if (mobileMenuBtn) mobileMenuBtn.focus();
      }
    });

    window.addEventListener('scroll', function () {
      updateProgress();
      updateNavbar();
    }, { passive: true });

    updateProgress();
    updateNavbar();
  });
})();
