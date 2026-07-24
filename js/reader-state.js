/**
 * GB ReaderState v1
 *
 * One geometry, progress, active-section and persistence owner for article,
 * flat-series and book reading surfaces. UI components subscribe to the
 * gb:reader-state-change event instead of installing independent scroll loops.
 */
(function () {
  'use strict';

  if (window.GBReaderState && window.GBReaderState.version === 1) return;

  var VERSION = 1;
  var EVENT_NAME = 'gb:reader-state-change';
  var STORAGE_PREFIX = 'gb:reader-state:v1:';
  var DEFAULT_HEADING_SELECTOR = 'h2[id], h3[id]';
  var COMPLETE_AT = 97;
  var listeners = [];
  var config = {};
  var root = null;
  var headings = [];
  var state = null;
  var range = { start: 0, end: 1, height: 1 };
  var rootBounds = { top: 0, bottom: 1 };
  var sectionPositions = [];
  var totalReadingMinutes = 1;
  var rafId = 0;
  var saveTimer = 0;
  var resizeObserver = null;
  var initialized = false;
  var destroyed = false;
  var userInteracted = false;
  var imageListeners = [];

  function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = min;
    return Math.max(min, Math.min(max, value));
  }

  function normalizePath(value) {
    var path = String(value || '/').split('?')[0].split('#')[0].replace(/index\.html$/i, '');
    if (path !== '/') path = path.replace(/\/+$/, '');
    return path || '/';
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function safeJsonParse(value) {
    if (!value) return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  }

  function storageGet(storage, key) {
    try { return storage && storage.getItem ? storage.getItem(key) : null; } catch (_) { return null; }
  }

  function storageSet(storage, key, value) {
    try {
      if (!storage || !storage.setItem) return false;
      storage.setItem(key, value);
      return true;
    } catch (_) { return false; }
  }

  function storageRemove(storage, key) {
    try { if (storage && storage.removeItem) storage.removeItem(key); } catch (_) {}
  }

  function getSiteId() {
    var siteConfig = window.SITE_CONFIG || {};
    return String(
      config.siteId ||
      (siteConfig.site && siteConfig.site.id) ||
      siteConfig.siteId ||
      'default-site'
    );
  }

  function getRoutePath() {
    return normalizePath(config.routePath || (window.location && window.location.pathname) || '/');
  }

  function getCanonicalKey() {
    return STORAGE_PREFIX + getSiteId() + ':' + getRoutePath();
  }

  function detectSeriesMeta() {
    var gill = document.querySelector('[data-gill-v16]');
    var body = document.body;
    var routeSegments = getRoutePath().split('/').filter(Boolean);
    var pageId = config.pageId ||
      (root && root.getAttribute && root.getAttribute('data-reader-page')) ||
      (gill && gill.getAttribute('data-gill-v16')) ||
      routeSegments[routeSegments.length - 1] || '';
    var seriesId = config.seriesId ||
      (root && root.getAttribute && root.getAttribute('data-reader-series')) ||
      (body && body.getAttribute && body.getAttribute('data-gbs2-series')) ||
      (gill ? 'gill-series' : '');
    var surface = config.surface ||
      (root && root.getAttribute && root.getAttribute('data-reader-surface')) ||
      (seriesId || gill ? 'series' : 'article');
    return { surface: surface, seriesId: String(seriesId || ''), pageId: String(pageId || '') };
  }

  function resolveRoot() {
    var selectors = [];
    if (config.rootSelector) selectors.push(config.rootSelector);
    selectors.push(
      '[data-reader-range]',
      '[data-reader-root] article.article-body',
      '[data-gill-v16] article.article-body',
      'article.article-body[data-pagefind-body]',
      'article.article-body',
      'article[data-pagefind-body]',
      '[data-reader-root]',
      '#main-content article',
      'main article',
      'article'
    );
    for (var i = 0; i < selectors.length; i++) {
      try {
        var candidate = document.querySelector(selectors[i]);
        if (candidate) return candidate;
      } catch (_) {}
    }
    return null;
  }

  function resolveHeadings() {
    if (!root || !root.querySelectorAll) return [];
    var selector = config.headingSelector || root.getAttribute('data-reader-heading-selector') || DEFAULT_HEADING_SELECTOR;
    return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (heading) {
      return !!heading.id && !heading.hasAttribute('hidden') && heading.getAttribute('aria-hidden') !== 'true';
    });
  }

  function readCssNumber(element, property) {
    if (!element || !window.getComputedStyle) return 0;
    try {
      var value = parseFloat(window.getComputedStyle(element).getPropertyValue(property));
      return Number.isFinite(value) ? value : 0;
    } catch (_) { return 0; }
  }

  function getStickyOffset() {
    if (Number.isFinite(Number(config.stickyOffset))) return Math.max(0, Number(config.stickyOffset));
    var htmlOffset = readCssNumber(document.documentElement, 'scroll-padding-top');
    var rootOffset = root ? readCssNumber(root, 'scroll-margin-top') : 0;
    return Math.max(0, htmlOffset, rootOffset);
  }

  function computeRangeFromBox(box, scrollY, viewportHeight, stickyOffset, bottomInset) {
    var top = Number(box && box.top) || 0;
    var height = Math.max(0, Number(box && box.height) || 0);
    var absoluteTop = top + (Number(scrollY) || 0);
    var absoluteBottom = absoluteTop + height;
    var start = Math.max(0, absoluteTop - Math.max(0, Number(stickyOffset) || 0));
    var end = Math.max(start + 1, absoluteBottom - Math.max(1, Number(viewportHeight) || 1) + Math.max(0, Number(bottomInset) || 0));
    return { start: start, end: end, height: Math.max(1, end - start) };
  }

  function computeProgress(scrollY, computedRange) {
    var r = computedRange || range;
    var ratio = clamp(((Number(scrollY) || 0) - r.start) / Math.max(1, r.end - r.start), 0, 1);
    return { ratio: ratio, percent: Math.round(ratio * 100) };
  }

  function chooseActiveSection(sectionPositions, readingAbsoluteY, rootBottom, phase) {
    if (!sectionPositions || !sectionPositions.length) {
      return phase === 'after-content'
        ? { id: '', title: 'Завершено', index: 0, count: 0 }
        : { id: '', title: 'Введение', index: -1, count: 0 };
    }
    if (phase === 'before-content') return { id: '', title: 'Введение', index: -1, count: sectionPositions.length };
    if (phase === 'after-content' || readingAbsoluteY >= rootBottom) {
      return { id: '', title: 'Завершено', index: sectionPositions.length, count: sectionPositions.length };
    }
    var activeIndex = -1;
    for (var i = 0; i < sectionPositions.length; i++) {
      if (sectionPositions[i].top <= readingAbsoluteY) activeIndex = i;
      else break;
    }
    if (activeIndex < 0) return { id: '', title: 'Введение', index: -1, count: sectionPositions.length };
    var active = sectionPositions[activeIndex];
    return {
      id: active.id || '',
      title: active.title || '',
      index: activeIndex,
      count: sectionPositions.length
    };
  }

  function calculateReadingMinutes() {
    var explicit = Number(config.readingMinutes);
    if (!Number.isFinite(explicit) && root && root.getAttribute) explicit = Number(root.getAttribute('data-reading-minutes'));
    if (!Number.isFinite(explicit)) {
      var minuteNode = document.querySelector('[data-reading-minutes]');
      if (minuteNode) explicit = Number(minuteNode.getAttribute('data-reading-minutes'));
    }
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
    var words = normalizeText(root && root.textContent).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function measureGeometry() {
    if (!root) return range;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var box = root.getBoundingClientRect();
    range = computeRangeFromBox(
      box,
      scrollY,
      window.innerHeight || document.documentElement.clientHeight || 1,
      getStickyOffset(),
      Number(config.bottomInset) || 0
    );
    rootBounds = {
      top: box.top + scrollY,
      bottom: box.top + scrollY + Math.max(0, box.height || root.offsetHeight || 0)
    };
    sectionPositions = headings.map(function (heading) {
      var rect = heading.getBoundingClientRect();
      return {
        id: heading.id || '',
        title: normalizeText(heading.textContent),
        top: rect.top + scrollY,
        element: heading
      };
    }).sort(function (a, b) { return a.top - b.top; });
    totalReadingMinutes = calculateReadingMinutes();
    return range;
  }

  function getReadingLine() {
    var sticky = getStickyOffset();
    var viewport = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    return sticky + Math.min(viewport * 0.3, 390);
  }

  function sameState(a, b) {
    if (!a || !b) return false;
    var keys = ['progress', 'scrollY', 'phase', 'sectionId', 'sectionTitle', 'sectionIndex', 'rangeStart', 'rangeEnd', 'completed', 'remainingMinutes'];
    for (var i = 0; i < keys.length; i++) if (a[keys[i]] !== b[keys[i]]) return false;
    return true;
  }

  function publishCssContract(next) {
    var ratio = clamp(next && next.progressRatio, 0, 1);
    var active = next && Number(next.progress) > 2 ? '1' : '0';
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty('--gb-read-pct', String(ratio));
        document.documentElement.style.setProperty('--gb-read-active', active);
      }
      if (document.body && document.body.style) {
        document.body.style.setProperty('--gb-read-pct', String(ratio));
      }
    } catch (_) {}
  }

  function createState() {
    if (!root) return null;
    var scrollY = Math.round(window.scrollY || window.pageYOffset || 0);
    var rootBottom = rootBounds.bottom;
    var p = computeProgress(scrollY, range);
    var phase = scrollY < range.start ? 'before-content' : (scrollY >= range.end ? 'after-content' : 'active-section');
    var readingLine = getReadingLine();
    var section = chooseActiveSection(sectionPositions, scrollY + readingLine, rootBottom, phase);
    var meta = detectSeriesMeta();
    var totalMinutes = totalReadingMinutes;
    var remaining = Math.max(0, Math.round(totalMinutes * (1 - p.ratio)));
    return {
      version: VERSION,
      routePath: getRoutePath(),
      surface: meta.surface,
      seriesId: meta.seriesId,
      pageId: meta.pageId,
      rangeStart: Math.round(range.start),
      rangeEnd: Math.round(range.end),
      readingLine: Math.round(readingLine),
      scrollY: scrollY,
      progress: p.percent,
      progressRatio: p.ratio,
      phase: phase,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionIndex: section.index,
      sectionCount: section.count,
      completed: p.percent >= COMPLETE_AT,
      totalMinutes: totalMinutes,
      remainingMinutes: remaining,
      updatedAt: Date.now()
    };
  }

  function emit(next, force) {
    if (!next) return;
    var previous = state;
    state = next;
    publishCssContract(next);
    if (!force && sameState(previous, next)) return;
    var snapshot = Object.assign({}, next);
    try { window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: snapshot })); } catch (_) {}
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snapshot, previous ? Object.assign({}, previous) : null); } catch (error) {
        if (config.debug && window.console) console.warn('[ReaderState] subscriber failed', error);
      }
    }
    scheduleSave();
  }

  function measure(forceGeometry) {
    if (destroyed || !root) return null;
    if (forceGeometry || !sectionPositions.length) measureGeometry();
    var next = createState();
    emit(next, !!forceGeometry);
    return state ? Object.assign({}, state) : null;
  }

  function scheduleMeasure(forceGeometry) {
    if (destroyed) return;
    if (forceGeometry && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      measure(!!forceGeometry);
    });
  }

  function legacyBookmarkKey() {
    return 'bookmark:' + getSiteId() + ':' + getRoutePath();
  }

  function legacySeriesKey() {
    var meta = detectSeriesMeta();
    var segments = getRoutePath().split('/').filter(Boolean);
    var legacyPageId = segments[segments.length - 1] || meta.pageId;
    return meta.seriesId && legacyPageId ? 'gb-series-pos:' + meta.seriesId + ':' + legacyPageId : '';
  }

  function canonicalizeSaved(input, source) {
    if (!input || typeof input !== 'object') return null;
    var progress = Number(input.progress != null ? input.progress : input.pc);
    var scrollY = Number(input.scrollY != null ? input.scrollY : input.y);
    if (!Number.isFinite(progress) && !Number.isFinite(scrollY)) return null;
    var meta = detectSeriesMeta();
    return {
      version: VERSION,
      routePath: getRoutePath(),
      surface: meta.surface,
      seriesId: meta.seriesId,
      pageId: meta.pageId,
      title: normalizeText(input.title || document.title),
      sectionId: String(input.sectionId || ''),
      sectionTitle: normalizeText(input.sectionTitle || ''),
      progress: clamp(progress, 0, 100),
      scrollY: Math.max(0, Math.round(Number.isFinite(scrollY) ? scrollY : 0)),
      completed: !!input.completed || progress >= COMPLETE_AT,
      savedAt: Number(input.savedAt || input.t || Date.now()),
      dismissedAt: Number(input.dismissedAt || 0) || 0,
      source: source || input.source || 'canonical'
    };
  }

  function migrateLegacyValues(bookmarkValue, seriesValue) {
    var bookmark = canonicalizeSaved(bookmarkValue, 'bookmark-v4');
    var series = canonicalizeSaved(seriesValue, 'series-position');
    if (!bookmark) return series;
    if (!series) return bookmark;
    return Number(series.savedAt || 0) > Number(bookmark.savedAt || 0) ? series : bookmark;
  }

  function loadSaved() {
    var canonical = canonicalizeSaved(safeJsonParse(storageGet(window.localStorage, getCanonicalKey())), 'canonical');
    if (canonical) return canonical;
    var bookmark = safeJsonParse(storageGet(window.localStorage, legacyBookmarkKey()));
    var seriesKey = legacySeriesKey();
    var series = seriesKey ? safeJsonParse(storageGet(window.localStorage, seriesKey)) : null;
    var migrated = migrateLegacyValues(bookmark, series);
    if (migrated) storageSet(window.localStorage, getCanonicalKey(), JSON.stringify(migrated));
    return migrated;
  }

  function makeSnapshot() {
    if (!state) return null;
    return {
      version: VERSION,
      siteId: getSiteId(),
      routePath: state.routePath,
      surface: state.surface,
      seriesId: state.seriesId,
      pageId: state.pageId,
      title: normalizeText(document.title),
      sectionId: state.sectionId,
      sectionTitle: state.sectionTitle,
      progress: state.progress,
      scrollY: state.scrollY,
      completed: state.completed,
      savedAt: Date.now(),
      dismissedAt: Number((loadSaved() || {}).dismissedAt || 0) || 0,
      source: 'reader-state-v1'
    };
  }

  function shouldPersist(snapshot, options) {
    if (!snapshot) return false;
    options = options || {};
    if (!userInteracted && !options.allowPassive && !options.force) return false;
    if (snapshot.progress < Number(config.minProgressToSave || 4) && !snapshot.completed) return false;
    if (snapshot.progress > Number(config.maxProgressToSave || 99) && !snapshot.completed) return false;
    return true;
  }

  function saveSnapshot(options) {
    if (typeof options === 'boolean') options = { force: options };
    options = options || {};
    var snapshot = makeSnapshot();
    if (!shouldPersist(snapshot, options)) return snapshot;
    storageSet(window.localStorage, getCanonicalKey(), JSON.stringify(snapshot));
    return snapshot;
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      saveTimer = 0;
      saveSnapshot(false);
    }, Number(config.saveDelay || 900));
  }

  function findSection(saved) {
    if (!saved) return null;
    if (saved.sectionId) {
      var exact = document.getElementById(saved.sectionId);
      if (exact && root.contains(exact)) return exact;
    }
    var wanted = normalizeText(saved.sectionTitle).toLowerCase();
    if (!wanted) return null;
    for (var i = 0; i < headings.length; i++) {
      var title = normalizeText(headings[i].textContent).toLowerCase();
      if (title === wanted || title.indexOf(wanted) >= 0 || wanted.indexOf(title) >= 0) return headings[i];
    }
    return null;
  }

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
  }

  function restoreSnapshot(saved, options) {
    options = options || {};
    saved = canonicalizeSaved(saved || loadSaved(), 'restore');
    if (!saved || !root) return false;
    if (!options.ignoreHash && window.location && window.location.hash) return false;
    measureGeometry();
    var target = findSection(saved);
    var behavior = options.behavior || (reducedMotion() ? 'auto' : 'smooth');
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: behavior, block: 'start' });
      return true;
    }
    var top = range.start + clamp(saved.progress, 0, 100) / 100 * (range.end - range.start);
    if (Number.isFinite(saved.scrollY) && saved.scrollY > 0 && !saved.progress) top = saved.scrollY;
    window.scrollTo({ top: clamp(top, 0, Math.max(range.end, top)), behavior: behavior });
    return true;
  }

  function resumeSessionKey() {
    return 'gb:reader-resume-offered:v1:' + getSiteId() + ':' + getRoutePath();
  }

  function isResumeAcknowledged() {
    return storageGet(window.sessionStorage, resumeSessionKey()) === '1';
  }

  function markResumeAcknowledged() {
    storageSet(window.sessionStorage, resumeSessionKey(), '1');
  }

  function dismissResumeForDay() {
    var saved = loadSaved();
    if (!saved) return;
    saved.dismissedAt = Date.now();
    storageSet(window.localStorage, getCanonicalKey(), JSON.stringify(saved));
  }

  function configure(next) {
    config = Object.assign({}, config, next || {});
    if (initialized) {
      root = resolveRoot();
      headings = resolveHeadings();
      reconnectObservers();
      scheduleMeasure(true);
    }
    return api;
  }

  function subscribe(listener, options) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    if ((!options || options.immediate !== false) && state) listener(Object.assign({}, state), null);
    return function () {
      listeners = listeners.filter(function (item) { return item !== listener; });
    };
  }

  function disconnectObservers() {
    if (resizeObserver) {
      try { resizeObserver.disconnect(); } catch (_) {}
      resizeObserver = null;
    }
    imageListeners.forEach(function (entry) {
      try { entry.el.removeEventListener('load', entry.fn); } catch (_) {}
    });
    imageListeners = [];
  }

  function reconnectObservers() {
    disconnectObservers();
    if (!root) return;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () { scheduleMeasure(true); });
      resizeObserver.observe(root);
    }
    Array.prototype.slice.call(root.querySelectorAll('img')).forEach(function (image) {
      if (image.complete) return;
      var fn = function () { scheduleMeasure(true); };
      image.addEventListener('load', fn, { once: true });
      imageListeners.push({ el: image, fn: fn });
    });
  }

  function onUserInput() { userInteracted = true; }
  function onScroll() { scheduleMeasure(false); }
  function onResize() { scheduleMeasure(true); }
  function onVisibility() { if (document.visibilityState === 'hidden') saveSnapshot(true); }
  function onPageHide() { saveSnapshot(true); }
  function onHashChange() { window.setTimeout(function () { scheduleMeasure(true); }, 0); }

  function init() {
    if (initialized || destroyed) return api;
    root = resolveRoot();
    if (!root) return api;
    initialized = true;
    headings = resolveHeadings();
    reconnectObservers();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (eventName) {
      window.addEventListener(eventName, onUserInput, { passive: true });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { scheduleMeasure(true); }).catch(function () {});
    measure(true);
    return api;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (saveTimer) clearTimeout(saveTimer);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
    ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (eventName) {
      window.removeEventListener(eventName, onUserInput);
    });
    disconnectObservers();
    listeners = [];
  }

  var api = {
    version: VERSION,
    eventName: EVENT_NAME,
    configure: configure,
    init: init,
    measure: function () { return measure(true); },
    getRange: function () { return Object.assign({}, range); },
    getReadingLine: getReadingLine,
    getProgress: function () { return state ? state.progress : 0; },
    getActiveSection: function () {
      return state ? { id: state.sectionId, title: state.sectionTitle, index: state.sectionIndex, count: state.sectionCount, phase: state.phase } : null;
    },
    getRemainingEstimate: function () { return state ? state.remainingMinutes : null; },
    getSnapshot: function () { return state ? Object.assign({}, state) : null; },
    getSaved: loadSaved,
    subscribe: subscribe,
    saveSnapshot: saveSnapshot,
    restoreSnapshot: restoreSnapshot,
    isResumeAcknowledged: isResumeAcknowledged,
    markResumeAcknowledged: markResumeAcknowledged,
    dismissResumeForDay: dismissResumeForDay,
    destroy: destroy,
    __test: {
      clamp: clamp,
      normalizePath: normalizePath,
      computeRangeFromBox: computeRangeFromBox,
      computeProgress: computeProgress,
      chooseActiveSection: chooseActiveSection,
      canonicalizeSaved: canonicalizeSaved,
      migrateLegacyValues: migrateLegacyValues
    }
  };

  window.GBReaderState = api;
  window.ReaderState = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
