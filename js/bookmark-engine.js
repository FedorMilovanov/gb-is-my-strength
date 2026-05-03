/* ==========================================================
   BOOKMARK / RESUME READING — UNIVERSAL ENGINE v4
   Final reviewed version for large article sites
   ========================================================== */

(function () {
  var globalConfig = window.SITE_CONFIG || {};
  var featureConfig = (globalConfig.features && globalConfig.features.bookmarks) || {};

  if (featureConfig.enabled === false) return;

  var config = {
    siteId: (globalConfig.site && globalConfig.site.id) || globalConfig.siteId || 'default-site',
    articleSelector: featureConfig.articleSelector || 'article',
    headingSelector: featureConfig.headingSelector || 'h2[id]',
    minScrollToSave: typeof featureConfig.minScrollToSave === 'number' ? featureConfig.minScrollToSave : 320,
    minProgressToSave: typeof featureConfig.minProgressToSave === 'number' ? featureConfig.minProgressToSave : 6,
    maxProgressToSave: typeof featureConfig.maxProgressToSave === 'number' ? featureConfig.maxProgressToSave : 96,
    completedAtProgress: typeof featureConfig.completedAtProgress === 'number' ? featureConfig.completedAtProgress : 97,
    minTimeOnPage: typeof featureConfig.minTimeOnPage === 'number' ? featureConfig.minTimeOnPage : 10000,
    scrollThrottle: typeof featureConfig.scrollThrottle === 'number' ? featureConfig.scrollThrottle : 600,
    periodicSaveInterval: typeof featureConfig.periodicSaveInterval === 'number' ? featureConfig.periodicSaveInterval : 15000,
    maxAgeDays: typeof featureConfig.maxAgeDays === 'number' ? featureConfig.maxAgeDays : 14,
    cleanupAgeDays: typeof featureConfig.cleanupAgeDays === 'number' ? featureConfig.cleanupAgeDays : 45,
    cleanupIntervalHours: typeof featureConfig.cleanupIntervalHours === 'number' ? featureConfig.cleanupIntervalHours : 24,
    promptDelay: typeof featureConfig.promptDelay === 'number' ? featureConfig.promptDelay : 900,
    promptAutoHide: typeof featureConfig.promptAutoHide === 'number' ? featureConfig.promptAutoHide : 12000,
    showPrompt: featureConfig.showPrompt !== false,
    dismissForSession: featureConfig.dismissForSession !== false,
    respectHashNavigation: featureConfig.respectHashNavigation !== false,
    minDocumentHeightRatio: typeof featureConfig.minDocumentHeightRatio === 'number' ? featureConfig.minDocumentHeightRatio : 2.0,
    debug: !!featureConfig.debug
  };

  var article = document.querySelector(config.articleSelector);
  if (!article) return;

  var headings = Array.prototype.slice.call(
    article.querySelectorAll(config.headingSelector)
  ).filter(function (el) {
    return !!el.id;
  });

  if (!headings.length) return;

  if ((document.documentElement.scrollHeight / Math.max(window.innerHeight, 1)) < config.minDocumentHeightRatio) {
    return;
  }

  function normalizePath(path) {
    if (!path) return '/';
    var out = path.replace(/index\.html$/, '');
    if (out !== '/' && /\/$/.test(out)) out = out.slice(0, -1);
    return out || '/';
  }

  var normalizedPath = normalizePath(window.location.pathname);
  var pageKey = 'bookmark:' + config.siteId + ':' + normalizedPath;
  var dismissKey = 'bookmark-dismissed:' + config.siteId + ':' + normalizedPath;
  var cleanupKey = 'bookmark-cleanup:' + config.siteId;

  var startedAt = Date.now();
  var currentSection = null;
  var lastSavedSnapshot = '';
  var scrollTimer = null;
  var periodicTimer = null;
  var promptHideTimer = null;
  var promptInteracted = false;

  var toast = document.getElementById('bookmarkToast');
  var toastTitle = document.getElementById('bookmarkToastTitle');
  var toastMeta = document.getElementById('bookmarkToastMeta');
  var toastProgress = document.getElementById('bookmarkToastProgress');
  var toastClose = document.getElementById('bookmarkToastClose');
  var toastResume = document.getElementById('bookmarkToastResume');
  var toastRestart = document.getElementById('bookmarkToastRestart');

  var toastReady = !!(
    toast && toastTitle && toastMeta && toastProgress &&
    toastClose && toastResume && toastRestart
  );

  function log() {
    if (!config.debug) return;
    try { console.log.apply(console, ['[bookmark]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function safeLocalStorageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeLocalStorageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
  function safeLocalStorageRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function safeSessionStorageGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function safeSessionStorageSet(key, value) { try { sessionStorage.setItem(key, value); } catch (e) {} }

  function getMaxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function getDocProgress() {
    var maxScroll = getMaxScroll();
    if (maxScroll <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((window.scrollY / maxScroll) * 100)));
  }

  function normalizeText(str) {
    return (str || '').replace(/\s+/g, ' ').replace(/[«»"']/g, '')
      .replace(/[—–-]/g, '-').trim().toLowerCase();
  }

  function detectCurrentSection() {
    var probeY = window.scrollY + window.innerHeight * 0.35;
    var found = headings[0];
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].offsetTop <= probeY) { found = headings[i]; } else { break; }
    }
    currentSection = found;
    return found;
  }

  function buildPayload() {
    var section = detectCurrentSection();
    if (!section) return null;
    var progress = getDocProgress();
    return {
      version: 4,
      siteId: config.siteId,
      path: normalizedPath,
      title: document.title || '',
      sectionId: section.id || '',
      sectionTitle: (section.textContent || '').trim(),
      progress: progress,
      scrollY: Math.round(window.scrollY),
      completed: progress >= config.completedAtProgress,
      savedAt: Date.now()
    };
  }

  function shouldSave(payload) {
    if (!payload) return false;
    var timeOnPage = Date.now() - startedAt;
    if (timeOnPage < config.minTimeOnPage) return false;
    if (window.scrollY < config.minScrollToSave) return false;
    if (payload.progress < config.minProgressToSave) return false;
    if (payload.progress > config.maxProgressToSave) return false;
    return true;
  }

  function saveBookmark(force) {
    var payload = buildPayload();
    if (!payload) return;
    if (!force && !shouldSave(payload)) return;
    var snapshot = JSON.stringify([payload.sectionId, payload.sectionTitle, payload.progress, payload.scrollY, payload.completed]);
    if (!force && snapshot === lastSavedSnapshot) return;
    var ok = safeLocalStorageSet(pageKey, JSON.stringify(payload));
    if (ok) { lastSavedSnapshot = snapshot; log('saved', payload); }
  }

  function getSavedBookmark() {
    var raw = safeLocalStorageGet(pageKey);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      if (!data.path || !data.savedAt) return null;
      return data;
    } catch (e) { return null; }
  }

  function isBookmarkFresh(data) {
    if (!data || !data.savedAt) return false;
    return (Date.now() - data.savedAt) <= (config.maxAgeDays * 24 * 60 * 60 * 1000);
  }

  function findTargetElement(data) {
    if (!data) return null;
    if (data.sectionId) {
      var byId = document.getElementById(data.sectionId);
      if (byId) return byId;
    }
    if (data.sectionTitle) {
      var savedTitle = normalizeText(data.sectionTitle);
      var partialMatch = null;
      for (var i = 0; i < headings.length; i++) {
        var currentTitle = normalizeText(headings[i].textContent);
        if (currentTitle === savedTitle) return headings[i];
        if (currentTitle.indexOf(savedTitle) !== -1 || savedTitle.indexOf(currentTitle) !== -1) {
          partialMatch = partialMatch || headings[i];
        }
      }
      if (partialMatch) return partialMatch;
    }
    return null;
  }

  function formatRelativeTime(savedAt) {
    var diff = Date.now() - savedAt;
    var minute = 60 * 1000, hour = 60 * minute, day = 24 * hour;
    if (diff < hour) return Math.max(1, Math.round(diff / minute)) + '\u00a0мин назад';
    if (diff < day) return Math.round(diff / hour) + '\u00a0ч назад';
    if (diff < 2 * day) return 'вчера';
    return Math.round(diff / day) + '\u00a0дн назад';
  }

  function getResumeMetaText(data) {
    var progress = typeof data.progress === 'number' ? data.progress : 0;
    var rel = data.savedAt ? formatRelativeTime(data.savedAt) : '';
    if (progress > 0 && rel) return 'Остановились примерно на\u00a0' + progress + '% · ' + rel;
    if (progress > 0) return 'Вы остановились примерно на\u00a0' + progress + '%';
    return 'Продолжить с места, где остановились';
  }

  function clearPromptHideTimer() {
    if (promptHideTimer) { clearTimeout(promptHideTimer); promptHideTimer = null; }
  }

  function hideToast() {
    if (!toastReady || toast.hidden) return;
    clearPromptHideTimer();
    toast.classList.remove('show');
    setTimeout(function () { toast.hidden = true; }, 400);
  }

  function scheduleToastHide() {
    clearPromptHideTimer();
    if (config.promptAutoHide <= 0 || promptInteracted) return;
    promptHideTimer = setTimeout(function () { hideToast(); }, config.promptAutoHide);
  }

  function showToast(data) {
    if (!toastReady || !config.showPrompt) return;
    promptInteracted = false;
    toastTitle.textContent = data.sectionTitle || 'Последнее место чтения';
    toastMeta.textContent = getResumeMetaText(data);
    toastProgress.style.width = Math.max(0, Math.min(100, data.progress || 0)) + '%';
    toast.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { toast.classList.add('show'); });
    });
    scheduleToastHide();
  }

  function markDismissedForSession() {
    if (config.dismissForSession) safeSessionStorageSet(dismissKey, '1');
  }

  function wasDismissedForSession() {
    if (!config.dismissForSession) return false;
    return safeSessionStorageGet(dismissKey) === '1';
  }

  function restoreBookmark(data) {
    var target = findTargetElement(data);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { saveBookmark(true); }, 1200);
      return true;
    }
    if (typeof data.scrollY === 'number' && data.scrollY > 0) {
      var targetY = Math.max(0, Math.min(data.scrollY, getMaxScroll()));
      window.scrollTo({ top: targetY, behavior: 'smooth' });
      setTimeout(function () { saveBookmark(true); }, 1200);
      return true;
    }
    return false;
  }

  function shouldOfferResume(data) {
    if (!data) return false;
    if (!isBookmarkFresh(data)) return false;
    if (wasDismissedForSession()) return false;
    if (config.respectHashNavigation && window.location.hash) return false;
    if (getDocProgress() > 4) return false;
    if ((data.progress || 0) < config.minProgressToSave) return false;
    if ((data.progress || 0) > config.maxProgressToSave) return false;
    if (data.completed) return false;
    return true;
  }

  function bindToastActions(data) {
    if (!toastReady) return;
    toastClose.onclick = function () { markDismissedForSession(); hideToast(); };
    toastRestart.onclick = function () { markDismissedForSession(); safeLocalStorageRemove(pageKey); hideToast(); };
    toastResume.onclick = function () { markDismissedForSession(); hideToast(); restoreBookmark(data); };
  }

  function bindToastHoverPause() {
    if (!toastReady) return;
    toast.addEventListener('mouseenter', function () { promptInteracted = true; clearPromptHideTimer(); });
    toast.addEventListener('mouseleave', function () { promptInteracted = false; scheduleToastHide(); });
    toast.addEventListener('focusin', function () { promptInteracted = true; clearPromptHideTimer(); });
    toast.addEventListener('focusout', function () { promptInteracted = false; scheduleToastHide(); });
  }

  function scheduleResumePrompt() {
    if (!config.showPrompt || !toastReady) return;
    var saved = getSavedBookmark();
    if (!saved || !shouldOfferResume(saved)) return;
    setTimeout(function () {
      var latest = getSavedBookmark();
      if (!latest || !shouldOfferResume(latest)) return;
      bindToastActions(latest);
      showToast(latest);
    }, config.promptDelay);
  }

  function scheduleScrollSave() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () { scrollTimer = null; saveBookmark(false); }, config.scrollThrottle);
  }

  function shouldRunCleanup() {
    var raw = safeLocalStorageGet(cleanupKey);
    if (!raw) return true;
    var last = parseInt(raw, 10);
    if (!last) return true;
    return (Date.now() - last) > (config.cleanupIntervalHours * 60 * 60 * 1000);
  }

  function markCleanupRan() { safeLocalStorageSet(cleanupKey, String(Date.now())); }

  function cleanupOldBookmarks() {
    if (!shouldRunCleanup()) return;
    var prefix = 'bookmark:' + config.siteId + ':';
    var maxAge = config.cleanupAgeDays * 24 * 60 * 60 * 1000;
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        try {
          var data = JSON.parse(localStorage.getItem(key));
          if (!data || !data.savedAt || !data.path || (Date.now() - data.savedAt) > maxAge) {
            localStorage.removeItem(key);
          }
        } catch (e) { localStorage.removeItem(key); }
      }
    } catch (e) {}
    markCleanupRan();
  }

  // Init
  cleanupOldBookmarks();
  detectCurrentSection();

  if (config.showPrompt && toastReady) {
    bindToastHoverPause();
    scheduleResumePrompt();
  }

  window.addEventListener('scroll', function () {
    detectCurrentSection();
    scheduleScrollSave();
  }, { passive: true });

  periodicTimer = setInterval(function () { saveBookmark(false); }, config.periodicSaveInterval);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveBookmark(true);
  });

  window.addEventListener('beforeunload', function () { saveBookmark(true); });

  // Public API
  window.BookmarkEngine = window.BookmarkEngine || {};

  window.BookmarkEngine.saveNow = function () { saveBookmark(true); };
  window.BookmarkEngine.clearCurrent = function () { safeLocalStorageRemove(pageKey); };
  window.BookmarkEngine.getCurrent = function () { return getSavedBookmark(); };

  window.BookmarkEngine.getAllForSite = function () {
    var prefix = 'bookmark:' + config.siteId + ':';
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        try {
          var data = JSON.parse(localStorage.getItem(key));
          if (data && data.path && data.savedAt && typeof data.progress === 'number') out.push(data);
        } catch (e) {}
      }
    } catch (e) {}
    return out.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
  };

  window.BookmarkEngine.getInProgressArticles = function () {
    return window.BookmarkEngine.getAllForSite().filter(function (item) { return !item.completed; });
  };

  window.BookmarkEngine.getCompletedArticles = function () {
    return window.BookmarkEngine.getAllForSite().filter(function (item) { return !!item.completed; });
  };

  window.BookmarkEngine.getResumeCandidate = function () {
    var list = window.BookmarkEngine.getInProgressArticles();
    return list.length ? list[0] : null;
  };

  /* Mark current article as completed in localStorage.
     Called by site.js module 29 when read-progress reaches 98%. */
  window.BookmarkEngine.markCompleted = function () {
    try {
      var saved = getSavedBookmark();
      if (!saved) return;
      saved.completed = true;
      saved.completedAt = Date.now();
      localStorage.setItem(pageKey, JSON.stringify(saved));
    } catch (e) {}
  };

  window.BookmarkEngine.clearAllForSite = function () {
    var prefix = 'bookmark:' + config.siteId + ':';
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) keys.push(key);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  };

  window.BookmarkEngine.destroy = function () {
    clearPromptHideTimer();
    if (scrollTimer) clearTimeout(scrollTimer);
    if (periodicTimer) clearInterval(periodicTimer);
  };
})();


/* ==========================================================
   BOOKMARK READ-ONLY API
   Initialised unconditionally so homepage can read saved
   bookmarks even when the save/track engine is disabled.
   ========================================================== */

(function () {
  var siteId = (window.SITE_CONFIG && window.SITE_CONFIG.site && window.SITE_CONFIG.site.id) || 'gb-strength';
  var prefix = 'bookmark:' + siteId + ':';

  function getAllForSite() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        try {
          var data = JSON.parse(localStorage.getItem(key));
          if (data && data.path && data.savedAt && typeof data.progress === 'number') out.push(data);
        } catch (e) {}
      }
    } catch (e) {}
    return out.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
  }

  // Only set these if BookmarkEngine wasn't already initialised by the main engine
  window.BookmarkEngine = window.BookmarkEngine || {};
  if (!window.BookmarkEngine.getAllForSite) {
    window.BookmarkEngine.getAllForSite = getAllForSite;
    window.BookmarkEngine.getInProgressArticles = function () {
      return getAllForSite().filter(function (item) { return !item.completed; });
    };
    window.BookmarkEngine.getResumeCandidate = function () {
      var list = window.BookmarkEngine.getInProgressArticles();
      return list.length ? list[0] : null;
    };
  }
})();


/* ==========================================================
   HOMEPAGE — RESUME READING BLOCK
   Works only where corresponding HTML exists
   ========================================================== */

(function () {
  if (!window.BookmarkEngine) return;

  var block = document.getElementById('resumeReadingBlock');
  var titleEl = document.getElementById('resumeReadingTitle');
  var metaEl = document.getElementById('resumeReadingMeta');
  var progressEl = document.getElementById('resumeReadingProgress');
  var linkEl = document.getElementById('resumeReadingLink');
  var dismissEl = document.getElementById('resumeReadingDismiss');

  var listBlock = document.getElementById('resumeListBlock');
  var listEl = document.getElementById('resumeList');

  function formatRelativeTime(savedAt) {
    var diff = Date.now() - savedAt;
    var minute = 60 * 1000, hour = 60 * minute, day = 24 * hour;
    if (diff < hour) return Math.max(1, Math.round(diff / minute)) + '\u00a0мин назад';
    if (diff < day) return Math.round(diff / hour) + '\u00a0ч назад';
    if (diff < 2 * day) return 'вчера';
    return Math.round(diff / day) + '\u00a0дн назад';
  }

  function buildLink(item) {
    var href = item.path || '/';
    if (item.sectionId) href += '#' + item.sectionId;
    return href;
  }

  var resumeCandidate = window.BookmarkEngine.getResumeCandidate();
  var inProgress = window.BookmarkEngine.getInProgressArticles();

  if (block && resumeCandidate) {
    titleEl.textContent = resumeCandidate.title || 'Продолжить чтение';
    metaEl.textContent =
      'Раздел: ' + (resumeCandidate.sectionTitle || 'последнее место') +
      ' · ' + (resumeCandidate.progress || 0) + '%' +
      ' · ' + formatRelativeTime(resumeCandidate.savedAt);
    progressEl.style.width = Math.max(0, Math.min(100, resumeCandidate.progress || 0)) + '%';
    linkEl.href = buildLink(resumeCandidate);
    dismissEl.addEventListener('click', function () { block.hidden = true; });
    block.hidden = false;
  }

  if (listBlock && listEl && inProgress.length) {
    /* Fix: исключаем из списка статью, уже показанную в resumeReadingBlock,
       чтобы одна и та же статья не появлялась в обоих блоках. */
    var candidatePath = resumeCandidate ? resumeCandidate.path : null;
    var listItems = inProgress.filter(function (item) {
      return item.path !== candidatePath;
    });
    listItems.slice(0, 5).forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'resume-list-item';
      a.href = buildLink(item);

      var title = document.createElement('span');
      title.className = 'resume-list-item-title';
      title.textContent = item.title || item.path || 'Статья';

      var meta = document.createElement('span');
      meta.className = 'resume-list-item-meta';
      meta.textContent =
        (item.sectionTitle || 'Последнее место') +
        ' · ' + (item.progress || 0) + '%' +
        ' · ' + formatRelativeTime(item.savedAt);

      var progress = document.createElement('div');
      progress.className = 'resume-list-item-progress';

      var fill = document.createElement('div');
      fill.className = 'resume-list-item-progress-fill';
      fill.style.width = Math.max(0, Math.min(100, item.progress || 0)) + '%';

      progress.appendChild(fill);
      a.appendChild(title);
      a.appendChild(meta);
      a.appendChild(progress);
      listEl.appendChild(a);
    });
    /* Показываем блок только если после дедупликации остались статьи */
    if (listEl.children.length) listBlock.hidden = false;
  }
})();
