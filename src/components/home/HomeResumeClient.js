/**
 * Homepage adapter for canonical ReaderState saved progress.
 *
 * ReaderState remains the only progress producer. This Astro-bundled module
 * exposes a bounded same-site view over its canonical records and binds the
 * homepage shell. It never computes reading progress or creates a second store.
 */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'gb:reader-state:v1:';
  var COMPLETE_AT = 97;
  var DAY_MS = 24 * 60 * 60 * 1000;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function safeJsonParse(value) {
    if (!value) return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  }

  function getSiteId() {
    var siteConfig = window.SITE_CONFIG || {};
    return String(
      (siteConfig.site && siteConfig.site.id) ||
      siteConfig.siteId ||
      'default-site'
    );
  }

  function storagePrefix() {
    return STORAGE_PREFIX + getSiteId() + ':';
  }

  function safeRoutePath(value) {
    var route = String(value || '');
    if (!route || route === '/' || route.charAt(0) !== '/') return null;
    if (route.indexOf('//') === 0 || route.indexOf('\\') !== -1) return null;
    if (route.indexOf('?') !== -1 || route.indexOf('#') !== -1) return null;
    if (/[\u0000-\u001f\u007f]/.test(route) || /\/{2,}/.test(route)) return null;
    route = route.replace(/\/+$/, '');
    return route && route !== '/' ? route : null;
  }

  function routeFromStorageKey(key) {
    var prefix = storagePrefix();
    key = String(key || '');
    if (key.indexOf(prefix) !== 0) return null;
    return safeRoutePath(key.slice(prefix.length));
  }

  function safeSectionId(value) {
    var sectionId = String(value || '').trim();
    if (!sectionId || /[\u0000-\u001f\u007f]/.test(sectionId)) return '';
    if (sectionId.indexOf('\\') !== -1 || sectionId.indexOf('#') !== -1 || sectionId.indexOf('?') !== -1) return '';
    return sectionId.slice(0, 240);
  }

  function canonicalizeRecord(input, routePath) {
    if (!input || typeof input !== 'object') return null;
    var route = safeRoutePath(routePath);
    if (!route) return null;
    var progress = Number(input.progress);
    if (!Number.isFinite(progress)) return null;
    progress = Math.max(0, Math.min(100, progress));
    var savedAt = Number(input.savedAt);
    if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
    var dismissedAt = Number(input.dismissedAt);
    if (!Number.isFinite(dismissedAt) || dismissedAt < 0) dismissedAt = 0;
    return {
      version: 1,
      routePath: route,
      title: normalizeText(input.title) || route,
      sectionId: safeSectionId(input.sectionId),
      sectionTitle: normalizeText(input.sectionTitle),
      progress: progress,
      completed: !!input.completed || progress >= COMPLETE_AT,
      savedAt: savedAt,
      dismissedAt: dismissedAt,
      surface: normalizeText(input.surface),
      seriesId: normalizeText(input.seriesId),
      pageId: normalizeText(input.pageId)
    };
  }

  function boundedInt(value, fallback, min, max) {
    var parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) parsed = fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function installInventory(api) {
    function listSaved(options) {
      options = options || {};
      var storage = window.localStorage;
      if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') return [];

      var maxItems = boundedInt(options.maxItems, 5, 1, 20);
      var minProgress = Number(options.minProgress);
      if (!Number.isFinite(minProgress)) minProgress = 4;
      minProgress = Math.max(0, Math.min(COMPLETE_AT - 1, minProgress));

      var dismissedWithinMs = Number(options.dismissedWithinMs);
      if (!Number.isFinite(dismissedWithinMs) || dismissedWithinMs < 0) dismissedWithinMs = DAY_MS;
      var now = Number(options.now);
      if (!Number.isFinite(now) || now <= 0) now = Date.now();

      var items = [];
      for (var i = 0; i < storage.length; i++) {
        var key;
        try { key = storage.key(i); } catch (_) { continue; }
        var route = routeFromStorageKey(key);
        if (!route) continue;

        var raw;
        try { raw = storage.getItem(key); } catch (_) { continue; }
        var record = canonicalizeRecord(safeJsonParse(raw), route);
        if (!record || record.completed || record.progress < minProgress) continue;
        if (record.dismissedAt && now >= record.dismissedAt && now - record.dismissedAt < dismissedWithinMs) continue;
        items.push(record);
      }

      items.sort(function (a, b) {
        if (b.savedAt !== a.savedAt) return b.savedAt - a.savedAt;
        return a.routePath.localeCompare(b.routePath);
      });
      return items.slice(0, maxItems).map(function (item) { return Object.assign({}, item); });
    }

    function dismissSaved(routePath) {
      var route = safeRoutePath(routePath);
      if (!route) return false;
      var storage = window.localStorage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return false;
      var key = storagePrefix() + route;
      var raw;
      try { raw = storage.getItem(key); } catch (_) { return false; }
      var source = safeJsonParse(raw);
      if (!canonicalizeRecord(source, route)) return false;
      source.routePath = route;
      source.dismissedAt = Date.now();
      try {
        storage.setItem(key, JSON.stringify(source));
        return true;
      } catch (_) {
        return false;
      }
    }

    api.listSaved = listSaved;
    api.dismissSaved = dismissSaved;
    api.__test = api.__test || {};
    api.__test.savedInventory = {
      safeRoutePath: safeRoutePath,
      routeFromStorageKey: routeFromStorageKey,
      canonicalizeRecord: canonicalizeRecord
    };
  }

  function bindHomepage(api) {
    var config = window.SITE_CONFIG || {};
    var feature = config.features && config.features.homepageResume;
    if (!feature || feature.enabled !== true) return;

    var block = document.getElementById('resumeReadingBlock');
    var title = document.getElementById('resumeReadingTitle');
    var meta = document.getElementById('resumeReadingMeta');
    var progress = document.getElementById('resumeReadingProgress');
    var link = document.getElementById('resumeReadingLink');
    var dismiss = document.getElementById('resumeReadingDismiss');
    var listBlock = document.getElementById('resumeListBlock');
    var list = document.getElementById('resumeList');
    if (!block || !title || !meta || !progress || !link || !dismiss || !listBlock || !list) return;

    var maxItems = Number(feature.maxItems);
    if (!Number.isSafeInteger(maxItems) || maxItems < 1) maxItems = 5;
    maxItems = Math.min(maxItems, 20);

    function resumeHref(item) {
      var href = item.routePath;
      if (item.sectionId) href += '#' + encodeURIComponent(item.sectionId);
      return href;
    }

    function hideAll() {
      block.hidden = true;
      listBlock.hidden = true;
      link.removeAttribute('href');
      delete link.dataset.resumeRoute;
      list.replaceChildren();
    }

    function makeListItem(item) {
      var anchor = document.createElement('a');
      anchor.className = 'h-article-card resume-list-item';
      anchor.href = resumeHref(item);

      var body = document.createElement('span');
      body.className = 'h-article-body';

      var itemTitle = document.createElement('span');
      itemTitle.className = 'h-article-title';
      itemTitle.textContent = item.title;

      var itemMeta = document.createElement('span');
      itemMeta.className = 'h-article-meta';

      var progressText = document.createElement('span');
      progressText.className = 'h-meta-time';
      progressText.textContent = Math.round(item.progress) + '% прочитано';

      itemMeta.append(progressText);
      body.append(itemTitle, itemMeta);
      anchor.append(body);
      return anchor;
    }

    function render() {
      var items = api.listSaved({ maxItems: maxItems });
      if (!items.length) {
        hideAll();
        return;
      }

      var current = items[0];
      title.textContent = current.title;
      meta.textContent = (current.sectionTitle ? current.sectionTitle + ' · ' : '') + Math.round(current.progress) + '% прочитано';
      progress.style.width = Math.max(0, Math.min(100, current.progress)) + '%';
      link.href = resumeHref(current);
      link.dataset.resumeRoute = current.routePath;
      block.hidden = false;

      list.replaceChildren();
      items.slice(1).forEach(function (item) { list.append(makeListItem(item)); });
      listBlock.hidden = items.length < 2;
    }

    dismiss.addEventListener('click', function () {
      var route = link.dataset.resumeRoute || '';
      if (route) api.dismissSaved(route);
      render();
    });

    render();
  }

  function start() {
    var api = window.GBReaderState;
    if (!api || api.version !== 1) return;
    installInventory(api);
    bindHomepage(api);
  }

  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
