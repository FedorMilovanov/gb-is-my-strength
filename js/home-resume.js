/**
 * Homepage resume adapter for canonical GB ReaderState v1 records.
 *
 * ReaderState remains the only progress producer. This module is a bounded
 * read-model over its canonical localStorage records plus dismissedAt writes.
 */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'gb:reader-state:v1:';
  var COMPLETE_AT = 97;
  var DEFAULT_MIN_PROGRESS = 4;
  var DEFAULT_DISMISS_MS = 24 * 60 * 60 * 1000;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeRoute(value) {
    if (typeof value !== 'string') return '';
    if (!value.startsWith('/') || value.startsWith('//')) return '';
    if (value.indexOf('\\') !== -1 || value.indexOf('?') !== -1 || value.indexOf('#') !== -1) return '';
    if (/[\u0000-\u001F\u007F]/.test(value)) return '';
    var route = value.replace(/index\.html$/i, '');
    if (route !== '/') route = route.replace(/\/+$/, '');
    if (!route || route === '/' || route.startsWith('//')) return '';
    return route;
  }

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function safeJsonParse(value) {
    if (!value) return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  }

  function getSiteId() {
    var siteConfig = window.SITE_CONFIG || {};
    return String((siteConfig.site && siteConfig.site.id) || siteConfig.siteId || 'default-site');
  }

  function getPrefix() {
    return STORAGE_PREFIX + getSiteId() + ':';
  }

  function readRecord(storage, key, route) {
    var raw;
    try { raw = storage.getItem(key); } catch (_) { return null; }
    var input = safeJsonParse(raw);
    if (!input || typeof input !== 'object') return null;
    var progress = Math.max(0, Math.min(100, finiteNumber(input.progress, 0)));
    return {
      version: 1,
      siteId: getSiteId(),
      routePath: route,
      title: normalizeText(input.title),
      sectionId: normalizeText(input.sectionId),
      sectionTitle: normalizeText(input.sectionTitle),
      progress: progress,
      completed: input.completed === true || progress >= COMPLETE_AT,
      savedAt: Math.max(0, finiteNumber(input.savedAt, 0)),
      dismissedAt: Math.max(0, finiteNumber(input.dismissedAt, 0)),
      source: normalizeText(input.source || 'reader-state-v1')
    };
  }

  function listSaved(options) {
    options = options || {};
    var storage = window.localStorage;
    if (!storage) return [];
    var prefix = getPrefix();
    var minProgress = Math.max(0, Math.min(COMPLETE_AT - 1, finiteNumber(options.minProgress, DEFAULT_MIN_PROGRESS)));
    var dismissedWithinMs = Math.max(0, finiteNumber(options.dismissedWithinMs, DEFAULT_DISMISS_MS));
    var maxItems = Math.max(1, Math.min(50, Math.floor(finiteNumber(options.maxItems, 5))));
    var now = Date.now();
    var records = [];
    var length = 0;
    try { length = storage.length; } catch (_) { return []; }

    for (var i = 0; i < length; i++) {
      var key;
      try { key = storage.key(i); } catch (_) { continue; }
      if (typeof key !== 'string' || key.indexOf(prefix) !== 0) continue;
      var route = normalizeRoute(key.slice(prefix.length));
      if (!route) continue;
      var record = readRecord(storage, key, route);
      if (!record || record.completed || record.progress < minProgress) continue;
      if (record.dismissedAt && now - record.dismissedAt < dismissedWithinMs) continue;
      records.push(record);
    }

    records.sort(function (a, b) {
      return b.savedAt - a.savedAt || a.routePath.localeCompare(b.routePath);
    });
    return records.slice(0, maxItems).map(function (item) { return Object.assign({}, item); });
  }

  function dismissSaved(routePath) {
    var route = normalizeRoute(routePath);
    if (!route || !window.localStorage) return false;
    var key = getPrefix() + route;
    var input;
    try { input = safeJsonParse(window.localStorage.getItem(key)); } catch (_) { return false; }
    if (!input || typeof input !== 'object') return false;
    input.dismissedAt = Date.now();
    try {
      window.localStorage.setItem(key, JSON.stringify(input));
      return true;
    } catch (_) { return false; }
  }

  function featureConfig() {
    var siteConfig = window.SITE_CONFIG || {};
    var features = siteConfig.features || {};
    var resume = features.homepageResume || {};
    return {
      enabled: resume.enabled !== false,
      maxItems: Math.max(1, Math.min(50, Math.floor(finiteNumber(resume.maxItems, 5))))
    };
  }

  function makeHref(record) {
    var route = normalizeRoute(record && record.routePath);
    if (!route) return '';
    var sectionId = normalizeText(record.sectionId);
    return sectionId ? route + '#' + encodeURIComponent(sectionId) : route;
  }

  function setText(node, value) {
    if (node) node.textContent = normalizeText(value);
  }

  function createListLink(record) {
    var href = makeHref(record);
    if (!href) return null;
    var link = document.createElement('a');
    link.className = 'resume-list-item';
    link.href = href;
    var title = document.createElement('span');
    title.className = 'resume-list-title';
    title.textContent = record.title || record.sectionTitle || 'Продолжить чтение';
    var meta = document.createElement('span');
    meta.className = 'resume-list-meta';
    meta.textContent = Math.round(record.progress) + '%';
    link.appendChild(title);
    link.appendChild(meta);
    return link;
  }

  function render() {
    var config = featureConfig();
    var block = document.getElementById('resumeReadingBlock');
    var listBlock = document.getElementById('resumeListBlock');
    if (!block || !listBlock) return;
    if (!config.enabled) {
      block.hidden = true;
      listBlock.hidden = true;
      return;
    }

    var records = listSaved({ maxItems: config.maxItems });
    if (!records.length) {
      block.hidden = true;
      listBlock.hidden = true;
      return;
    }

    var primary = records[0];
    var href = makeHref(primary);
    if (!href) {
      block.hidden = true;
      listBlock.hidden = true;
      return;
    }

    setText(document.getElementById('resumeReadingTitle'), primary.title || 'Продолжить чтение');
    var progress = Math.round(primary.progress);
    var metaText = primary.sectionTitle ? primary.sectionTitle + ' · ' + progress + '%' : progress + '% прочитано';
    setText(document.getElementById('resumeReadingMeta'), metaText);
    var track = document.getElementById('resumeReadingProgressTrack');
    if (track) track.setAttribute('aria-valuenow', String(progress));
    var fill = document.getElementById('resumeReadingProgress');
    if (fill) fill.style.width = progress + '%';
    var action = document.getElementById('resumeReadingLink');
    if (action) action.href = href;
    var dismiss = document.getElementById('resumeReadingDismiss');
    if (dismiss) dismiss.dataset.routePath = primary.routePath;
    block.hidden = false;

    var list = document.getElementById('resumeList');
    if (list) {
      list.replaceChildren();
      records.slice(1).forEach(function (record) {
        var link = createListLink(record);
        if (link) list.appendChild(link);
      });
      listBlock.hidden = list.childElementCount === 0;
    } else {
      listBlock.hidden = true;
    }
  }

  function init() {
    if (!window.GBReaderState || window.GBReaderState.version !== 1) return;
    window.GBReaderState.listSaved = listSaved;
    window.GBReaderState.dismissSaved = dismissSaved;
    window.GBReaderState.__homeResumeTest = {
      normalizeRoute: normalizeRoute,
      getPrefix: getPrefix,
      makeHref: makeHref
    };
    var dismiss = document.getElementById('resumeReadingDismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        var route = dismiss.dataset.routePath || '';
        if (dismissSaved(route)) render();
      });
    }
    render();
  }

  window.GBHomeResume = { listSaved: listSaved, dismissSaved: dismissSaved, render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
