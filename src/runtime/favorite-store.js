(() => {
  'use strict';

  const VERSION = 1;
  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'gb-favorites';
  const MAX_ITEMS = 50;
  const READY_EVENT = 'gb:favorite-store-ready';
  const CHANGE_EVENT = 'gb:favorites-changed';

  if (window.GBFavoriteStore?.version === VERSION) {
    window.GBFavoriteStore.syncButtons?.();
    document.documentElement.dataset.gbFavoriteStoreReady = '1';
    return;
  }

  const subscribers = new Set();
  let lastSerialized = '';

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, max = 300) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function normalizePath(value) {
    try {
      const url = new URL(String(value || location.pathname || '/'), location.origin);
      if (url.origin !== location.origin) return '';
      let path = decodeURIComponent(url.pathname || '/').replace(/index\.html$/i, '');
      path = path.replace(/\/{2,}/g, '/');
      if (path !== '/') path = path.replace(/\/+$/, '');
      return path || '/';
    } catch {
      return '';
    }
  }

  function normalizeImage(value) {
    const raw = cleanText(value, 2048);
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      if (!/^https?:$/.test(url.protocol)) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function inferType(path) {
    if (/^\/articles\//.test(path)) return 'article';
    if (/^\/biografii\//.test(path)) return 'profile';
    if (/^\/karty\//.test(path)) return 'map';
    if (/^\/hard-texts\//.test(path)) return 'reference';
    return 'page';
  }

  function metaContent(selector) {
    return cleanText(document.querySelector(selector)?.getAttribute('content') || '', 2048);
  }

  function metadataFromPage(overrides = {}) {
    const config = window.SITE_CONFIG || {};
    const page = config.page && typeof config.page === 'object' ? config.page : {};
    const path = normalizePath(overrides.path || page.path || page.url || location.pathname);
    const category = cleanText(
      overrides.category
      || page.favoriteCategory
      || page.category
      || page.section
      || page.taxonomy?.primary
      || '',
      120,
    );
    const section = cleanText(overrides.section || page.section || category, 120);
    const title = cleanText(
      overrides.title
      || page.favoriteTitle
      || page.title
      || document.title
      || metaContent('meta[property="og:title"]'),
      240,
    );
    const description = cleanText(
      overrides.description
      || page.favoriteDescription
      || page.description
      || metaContent('meta[property="og:description"]'),
      500,
    );
    const image = normalizeImage(
      overrides.image
      || page.favoriteImage
      || page.image
      || page.ogImage
      || metaContent('meta[property="og:image"]'),
    );
    const type = cleanText(
      overrides.type
      || page.favoriteType
      || page.type
      || inferType(path),
      80,
    ) || inferType(path);

    return {
      schemaVersion: SCHEMA_VERSION,
      path,
      routeId: cleanText(overrides.routeId || page.id || path.replace(/^\//, '').replace(/\//g, '-') || 'home', 180),
      type,
      category,
      section,
      title: title || 'Материал',
      description,
      image,
      addedAt: Number(overrides.addedAt) > 0 ? Number(overrides.addedAt) : Date.now(),
      metadataSource: cleanText(overrides.metadataSource || (Object.keys(page).length ? 'site-config' : 'document-fallback'), 80),
    };
  }

  function normalizeItem(value, currentMeta) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const path = normalizePath(value.path || value.routePath || value.url);
    if (!path) return null;

    const isCurrent = Boolean(currentMeta?.path && path === currentMeta.path);
    const canonical = isCurrent ? currentMeta : null;
    const category = cleanText(canonical?.category || value.category || value.section || '', 120);
    const section = cleanText(canonical?.section || value.section || category, 120);
    const addedAt = Number(value.addedAt || value.savedAt || value.t);

    return {
      schemaVersion: SCHEMA_VERSION,
      path,
      routeId: cleanText(canonical?.routeId || value.routeId || value.id || path.replace(/^\//, '').replace(/\//g, '-'), 180),
      type: cleanText(canonical?.type || value.type || inferType(path), 80) || inferType(path),
      category,
      section,
      title: cleanText(canonical?.title || value.title || 'Материал', 240),
      description: cleanText(canonical?.description || value.description || '', 500),
      image: normalizeImage(canonical?.image || value.image || ''),
      addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : Date.now(),
      metadataSource: cleanText(
        canonical?.metadataSource
        || value.metadataSource
        || (Number(value.schemaVersion) === SCHEMA_VERSION ? 'stored-v1' : 'legacy-migrated'),
        80,
      ),
    };
  }

  function readRaw() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch {}
    return [];
  }

  function normalizeList(values, currentMeta = metadataFromPage()) {
    const byPath = new Map();
    for (const raw of Array.isArray(values) ? values : []) {
      const item = normalizeItem(raw, currentMeta);
      if (!item) continue;
      const previous = byPath.get(item.path);
      if (!previous || item.addedAt >= previous.addedAt) byPath.set(item.path, item);
    }
    return Array.from(byPath.values())
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, MAX_ITEMS);
  }

  function persist(list) {
    const normalized = normalizeList(list);
    const serialized = JSON.stringify(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      lastSerialized = serialized;
      return true;
    } catch {
      return false;
    }
  }

  function list(options = {}) {
    const normalized = normalizeList(readRaw());
    const serialized = JSON.stringify(normalized);
    if (options.persistMigration !== false && serialized !== lastSerialized) {
      try {
        const rawSerialized = localStorage.getItem(STORAGE_KEY) || '[]';
        if (serialized !== rawSerialized) localStorage.setItem(STORAGE_KEY, serialized);
        lastSerialized = serialized;
      } catch {}
    }
    return clone(normalized);
  }

  function get(path = location.pathname) {
    const normalized = normalizePath(path);
    return list().find((item) => item.path === normalized) || null;
  }

  function has(path = location.pathname) {
    return Boolean(get(path));
  }

  function labels(saved) {
    return saved
      ? { aria: 'Убрать из Избранного', state: 'saved' }
      : { aria: 'Добавить в Избранное', state: 'idle' };
  }

  function syncButtons(root = document) {
    if (!root?.querySelectorAll) return 0;
    let count = 0;
    root.querySelectorAll('[data-fc-action="save"], .gb-save').forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const path = normalizePath(button.getAttribute('data-favorite-path') || location.pathname);
      const saved = path ? has(path) : false;
      const label = labels(saved);
      button.classList.toggle('is-saved', saved);
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
      button.setAttribute('aria-label', label.aria);
      button.dataset.favoriteState = label.state;
      count += 1;
    });
    return count;
  }

  function publish(action, path, item = null, source = 'api') {
    const items = list({ persistMigration: false });
    syncButtons();
    const detail = Object.freeze({
      version: VERSION,
      schemaVersion: SCHEMA_VERSION,
      action,
      path: normalizePath(path),
      item: clone(item),
      items,
      source,
    });
    subscribers.forEach((subscriber) => {
      try { subscriber(detail); } catch (error) { console.error('[GBFavoriteStore] subscriber failed', error); }
    });
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));
    return detail;
  }

  function add(input = {}, options = {}) {
    const item = metadataFromPage(input);
    if (!item.path) return { saved: false, item: null, path: '' };
    const items = list().filter((entry) => entry.path !== item.path);
    items.unshift(item);
    persist(items);
    publish(options.action || 'add', item.path, item, options.source || 'api');
    return { saved: true, item: clone(item), path: item.path };
  }

  function remove(path = location.pathname, options = {}) {
    const normalized = normalizePath(path);
    if (!normalized) return { saved: false, item: null, path: '' };
    const existing = get(normalized);
    persist(list().filter((entry) => entry.path !== normalized));
    publish(options.action || 'remove', normalized, existing, options.source || 'api');
    return { saved: false, item: clone(existing), path: normalized };
  }

  function toggle(input = {}, options = {}) {
    const path = normalizePath(input.path || location.pathname);
    return has(path) ? remove(path, { action: 'remove', source: options.source || 'toggle' })
      : add({ ...input, path }, { action: 'add', source: options.source || 'toggle' });
  }

  function clear(options = {}) {
    persist([]);
    publish('clear', '', null, options.source || 'api');
    return [];
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  function migrateCurrentLegacyFlag() {
    const meta = metadataFromPage();
    if (!meta.path || has(meta.path)) return;
    const key = `fc:saved:${meta.path}`;
    let legacySaved = false;
    try { legacySaved = Boolean(localStorage.getItem(key)); } catch {}
    if (!legacySaved) return;
    add(meta, { action: 'legacy-flag-migrate', source: 'migration' });
    try { localStorage.removeItem(key); } catch {}
  }

  const api = Object.freeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    storageKey: STORAGE_KEY,
    normalizePath,
    metadataFromPage,
    list,
    get,
    has,
    add,
    remove,
    toggle,
    clear,
    subscribe,
    syncButtons,
  });

  window.GBFavoriteStore = api;

  function lifecycle(source = 'lifecycle') {
    list();
    migrateCurrentLegacyFlag();
    syncButtons();
    document.documentElement.dataset.gbFavoriteStoreReady = '1';
    window.dispatchEvent(new CustomEvent(READY_EVENT, {
      detail: { version: VERSION, schemaVersion: SCHEMA_VERSION, source },
    }));
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    lastSerialized = '';
    publish('external-sync', '', null, 'storage');
  });
  document.addEventListener('astro:page-load', () => lifecycle('astro:page-load'));
  window.addEventListener('pageshow', () => lifecycle('pageshow'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => lifecycle('dom-ready'), { once: true });
  else lifecycle('immediate');
})();
