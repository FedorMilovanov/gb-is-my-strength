/**
 * BookmarkEngine — persistence/resume adapter for GBReaderState.
 *
 * Measurement belongs exclusively to js/reader-state.js. This adapter keeps
 * the established BookmarkEngine API and resume toast without a second scroll,
 * resize, rAF or whole-document progress owner.
 */
(function () {
  'use strict';

  if (window.BookmarkEngine && window.BookmarkEngine._initialized) return;

  var siteConfig = window.SITE_CONFIG || {};
  var featureConfig = (siteConfig.features && siteConfig.features.bookmarks) || {};
  if (featureConfig.enabled === false) return;

  var config = {
    siteId: (siteConfig.site && siteConfig.site.id) || siteConfig.siteId || 'default-site',
    articleSelector: featureConfig.articleSelector || 'article',
    headingSelector: featureConfig.headingSelector || 'h2[id]',
    minProgressToSave: typeof featureConfig.minProgressToSave === 'number' ? featureConfig.minProgressToSave : 6,
    maxProgressToSave: typeof featureConfig.maxProgressToSave === 'number' ? featureConfig.maxProgressToSave : 96,
    maxAgeDays: typeof featureConfig.maxAgeDays === 'number' ? featureConfig.maxAgeDays : 14,
    cleanupAgeDays: typeof featureConfig.cleanupAgeDays === 'number' ? featureConfig.cleanupAgeDays : 45,
    cleanupIntervalHours: typeof featureConfig.cleanupIntervalHours === 'number' ? featureConfig.cleanupIntervalHours : 24,
    promptDelay: typeof featureConfig.promptDelay === 'number' ? featureConfig.promptDelay : 900,
    promptAutoHide: typeof featureConfig.promptAutoHide === 'number' ? featureConfig.promptAutoHide : 12000,
    showPrompt: featureConfig.showPrompt !== false,
    dismissForSession: featureConfig.dismissForSession !== false,
    respectHashNavigation: featureConfig.respectHashNavigation !== false,
    debug: !!featureConfig.debug
  };

  function normalizePath(value) {
    var path = String(value || '/').split('?')[0].split('#')[0].replace(/index\.html$/i, '');
    if (path !== '/') path = path.replace(/\/+$/, '');
    return path || '/';
  }

  var routePath = normalizePath(window.location && window.location.pathname);
  var legacyPrefix = 'bookmark:' + config.siteId + ':';
  var legacyKey = legacyPrefix + routePath;
  var canonicalPrefix = 'gb:reader-state:v1:' + config.siteId + ':';
  var canonicalKey = canonicalPrefix + routePath;
  var dismissKey = 'bookmark-dismissed:' + config.siteId + ':' + routePath;
  var cleanupKey = 'bookmark-cleanup:' + config.siteId;
  var reader = window.GBReaderState || window.ReaderState || null;
  var autoHideTimer = 0;
  var promptHovered = false;

  function getStorage(key) {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key); } catch (_) { return null; }
  }

  function setStorage(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (_) {
      try { sessionStorage.setItem(key, value); return true; } catch (_) { return false; }
    }
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  function parse(value) {
    try { return value ? JSON.parse(value) : null; } catch (_) { return null; }
  }

  function getCurrent() {
    if (reader && typeof reader.getSaved === 'function') {
      var saved = reader.getSaved();
      if (saved) return saved;
    }
    return parse(getStorage(canonicalKey)) || parse(getStorage(legacyKey));
  }

  function saveNow(force) {
    if (reader && typeof reader.saveSnapshot === 'function') return reader.saveSnapshot(force !== false);
    return null;
  }

  function clearCurrent() {
    removeStorage(canonicalKey);
    removeStorage(legacyKey);
  }

  function scanPrefix(prefix) {
    var rows = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        var value = parse(localStorage.getItem(key));
        if (!value || typeof value !== 'object') continue;
        var path = normalizePath(value.routePath || value.path || key.slice(prefix.length));
        var progress = Number(value.progress != null ? value.progress : value.pc);
        var savedAt = Number(value.savedAt || value.t);
        if (!path || !Number.isFinite(progress) || !Number.isFinite(savedAt)) continue;
        rows.push(Object.assign({}, value, {
          path: path,
          routePath: path,
          progress: progress,
          savedAt: savedAt,
          completed: !!value.completed
        }));
      }
    } catch (_) {}
    return rows;
  }

  function getAllForSite() {
    var byPath = new Map();
    scanPrefix(legacyPrefix).concat(scanPrefix(canonicalPrefix)).forEach(function (row) {
      var previous = byPath.get(row.path);
      if (!previous || Number(row.savedAt) > Number(previous.savedAt)) byPath.set(row.path, row);
    });
    return Array.from(byPath.values()).sort(function (a, b) { return Number(b.savedAt || 0) - Number(a.savedAt || 0); });
  }

  function cleanupOld() {
    var previous = Number(getStorage(cleanupKey));
    if (previous && Date.now() - previous < config.cleanupIntervalHours * 3600000) return;
    var cutoff = Date.now() - config.cleanupAgeDays * 86400000;
    [legacyPrefix, canonicalPrefix].forEach(function (prefix) {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(prefix) === 0) keys.push(key);
        }
        keys.forEach(function (key) {
          var value = parse(localStorage.getItem(key));
          var savedAt = value && Number(value.savedAt || value.t);
          if (!savedAt || savedAt < cutoff) localStorage.removeItem(key);
        });
      } catch (_) {}
    });
    setStorage(cleanupKey, String(Date.now()));
  }

  function relativeTime(savedAt) {
    var age = Date.now() - Number(savedAt || 0);
    var hour = 3600000;
    var day = 24 * hour;
    if (age < hour) return Math.max(1, Math.round(age / 60000)) + ' мин назад';
    if (age < day) return Math.round(age / hour) + ' ч назад';
    if (age < 2 * day) return 'вчера';
    return Math.round(age / day) + ' дн назад';
  }

  function promptEligible(saved) {
    if (!saved || !saved.savedAt || saved.completed) return false;
    if (Date.now() - saved.savedAt > config.maxAgeDays * 86400000) return false;
    if (saved.progress < config.minProgressToSave || saved.progress > config.maxProgressToSave) return false;
    if (config.respectHashNavigation && window.location.hash) return false;
    if (reader && typeof reader.getProgress === 'function' && reader.getProgress() > 4) return false;
    if (config.dismissForSession) {
      try { if (sessionStorage.getItem(dismissKey) === '1') return false; } catch (_) {}
    }
    if (reader && typeof reader.isResumeAcknowledged === 'function' && reader.isResumeAcknowledged()) return false;
    if (saved.dismissedAt && Date.now() - saved.dismissedAt < 86400000) return false;
    return true;
  }

  function promptElements() {
    var toast = document.getElementById('bookmarkToast');
    var title = document.getElementById('bookmarkToastTitle');
    var meta = document.getElementById('bookmarkToastMeta');
    var progress = document.getElementById('bookmarkToastProgress');
    var close = document.getElementById('bookmarkToastClose');
    var resume = document.getElementById('bookmarkToastResume');
    var restart = document.getElementById('bookmarkToastRestart');
    if (!toast || !title || !meta || !progress || !close || !resume || !restart) return null;
    return { toast: toast, title: title, meta: meta, progress: progress, close: close, resume: resume, restart: restart };
  }

  function clearAutoHide() {
    if (autoHideTimer) clearTimeout(autoHideTimer);
    autoHideTimer = 0;
  }

  function hidePrompt(elements) {
    if (!elements || elements.toast.hidden) return;
    clearAutoHide();
    elements.toast.classList.remove('show');
    setTimeout(function () { elements.toast.hidden = true; }, 400);
  }

  function scheduleAutoHide(elements) {
    clearAutoHide();
    if (config.promptAutoHide <= 0 || promptHovered) return;
    autoHideTimer = setTimeout(function () { hidePrompt(elements); }, config.promptAutoHide);
  }

  function acknowledgeResume() {
    if (config.dismissForSession) {
      try { sessionStorage.setItem(dismissKey, '1'); } catch (_) {}
    }
    if (reader && typeof reader.markResumeAcknowledged === 'function') reader.markResumeAcknowledged();
  }

  function showPrompt(saved) {
    var elements = promptElements();
    if (!elements || !promptEligible(saved)) return;

    elements.title.textContent = saved.sectionTitle || 'Последнее место чтения';
    elements.meta.textContent = 'Остановились примерно на ' + Math.round(saved.progress) + '% · ' + relativeTime(saved.savedAt);
    elements.progress.style.width = Math.max(0, Math.min(100, saved.progress || 0)) + '%';
    elements.toast.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { elements.toast.classList.add('show'); }); });

    elements.close.onclick = function () {
      acknowledgeResume();
      if (reader && typeof reader.dismissResumeForDay === 'function') reader.dismissResumeForDay();
      hidePrompt(elements);
    };
    elements.restart.onclick = function () {
      acknowledgeResume();
      clearCurrent();
      hidePrompt(elements);
    };
    elements.resume.onclick = function () {
      acknowledgeResume();
      hidePrompt(elements);
      if (reader && typeof reader.restoreSnapshot === 'function') reader.restoreSnapshot(saved);
    };

    elements.toast.addEventListener('mouseenter', function () { promptHovered = true; clearAutoHide(); });
    elements.toast.addEventListener('mouseleave', function () { promptHovered = false; scheduleAutoHide(elements); });
    elements.toast.addEventListener('focusin', function () { promptHovered = true; clearAutoHide(); });
    elements.toast.addEventListener('focusout', function () { promptHovered = false; scheduleAutoHide(elements); });
    scheduleAutoHide(elements);
  }

  function init() {
    var article = document.querySelector(config.articleSelector);
    if (!article || !reader) return;
    reader.configure({
      siteId: config.siteId,
      headingSelector: config.headingSelector,
      minProgressToSave: config.minProgressToSave,
      maxProgressToSave: config.maxProgressToSave,
      debug: config.debug
    }).init();
    cleanupOld();
    if (config.showPrompt) {
      setTimeout(function () {
        var saved = getCurrent();
        if (promptEligible(saved)) showPrompt(saved);
      }, config.promptDelay);
    }
  }

  var api = window.BookmarkEngine || {};
  api._initialized = true;
  api.saveNow = saveNow;
  api.clearCurrent = clearCurrent;
  api.getCurrent = getCurrent;
  api.getAllForSite = getAllForSite;
  api.getInProgressArticles = function () { return getAllForSite().filter(function (row) { return !row.completed; }); };
  api.getCompletedArticles = function () { return getAllForSite().filter(function (row) { return !!row.completed; }); };
  api.getResumeCandidate = function () { return api.getInProgressArticles()[0] || null; };
  api.markCompleted = function () {
    var saved = saveNow(true) || getCurrent();
    if (!saved) return;
    saved.completed = true;
    saved.completedAt = Date.now();
    saved.savedAt = Date.now();
    setStorage(canonicalKey, JSON.stringify(saved));
  };
  api.clearAllForSite = function () {
    [legacyPrefix, canonicalPrefix].forEach(function (prefix) {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(prefix) === 0) keys.push(key);
        }
        keys.forEach(function (key) { localStorage.removeItem(key); });
      } catch (_) {}
    });
  };
  api.destroy = function () { clearAutoHide(); };
  window.BookmarkEngine = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
