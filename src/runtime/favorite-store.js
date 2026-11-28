import '../../js/reader-library-storage.js';
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

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, max = 300) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function normalizePath(value) {
    try {
      if(typeof value!=='string'||!value.trim())return '';
      const url = new URL(value, location.origin);
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
      if (url.origin !== location.origin) return '';
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
      image: normalizeImage(value.image || ''),
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

  // Reading is a projection only: no schema rewrite, deletion or truncation
  // of the stored rows. All writes use the same authority as backup import.
  function list(_options = {}) {
    return clone(normalizeList(readRaw()));
  }
  function rawPath(row) {
    return row && typeof row==='object' && !Array.isArray(row)
      ? normalizePath(row.path||row.routePath||row.url) : '';
  }
  const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const match=(items,path)=>items.filter(row=>rawPath(row)===path);
  function snapshot() {
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      const value=raw===null?[]:JSON.parse(raw);
      const rows=Array.isArray(value)?value:value?.items;
      return Array.isArray(rows)?rows:null;
    } catch { return null; }
  }
  // Local Undo receipts are capabilities scoped to the observed clear epoch.
  // A transferred receipt cannot prove an epoch after this tab observes clear.
  let clearGeneration = 0;
  const receiptIntents = new WeakMap(), restoringReceipts = new WeakSet();
  async function transact(prepare) {
    const generation = clearGeneration;
    const owner=window.GBLibraryStorage;
    if(owner?.version!==1)return {ok:false,reason:'lock-unavailable'};
    const result = await owner.mutateLibrary([STORAGE_KEY],stores=>
      generation === clearGeneration ? prepare(stores[STORAGE_KEY]) : {reason:'storage-changed'});
    if (result.ok && generation !== clearGeneration) return {ok:false,reason:'storage-changed'};
    if (result.ok && result.receipt) receiptIntents.set(result.receipt,generation);
    return result;
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

  function publish(action, path, item = null, source = 'api', error = null) {
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
      error,
    });
    subscribers.forEach((subscriber) => {
      try { subscriber(detail); } catch (error) { console.error('[GBFavoriteStore] subscriber failed', error); }
    });
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));
    return detail;
  }

  function finish(result,action,path,source) {
    const error=result.ok?null:result.reason||'storage-write-failed';
    const item=path?get(path):null;
    try { publish(action,path,result.ok?(result.item||item):item,source,error); }
    catch { /* notification failure does not reverse a committed mutation */ }
    return {saved:Boolean(item),item:clone(result.item||item),path,error,receipt:result.receipt||null};
  }
  async function add(input = {}, options = {}) {
    const item=metadataFromPage(input);
    if(!item.path)return {saved:false,item:null,path:'',error:'invalid-path'};
    const result=await transact(rows=>{
      const found=match(rows,item.path);
      if(found.length>1)return {reason:'conflict'};
      if(found.length===1)return {changes:{},result:{item:found[0]}};
      if(rows.length>=MAX_ITEMS)return {reason:'capacity'};
      return {changes:{[STORAGE_KEY]:[item,...rows]},result:{item}};
    });
    return finish(result,options.action||'add',item.path,options.source||'api');
  }
  async function remove(path = location.pathname, options = {}) {
    const normalized=normalizePath(path), initial=snapshot();
    if(!normalized||!initial)return {saved:Boolean(normalized&&has(normalized)),item:normalized?get(normalized):null,path:normalized,error:'invalid-store'};
    const expected=match(initial,normalized);
    const result=await transact(rows=>{
      const found=match(rows,normalized);
      if(expected.length!==1||found.length!==1||!exact(expected[0],found[0]))return {reason:'conflict'};
      const index=rows.indexOf(found[0]),entry=found[0];
      return {changes:{[STORAGE_KEY]:rows.filter((_,i)=>i!==index)},result:{item:entry,receipt:{entry,index,path:normalized}}};
    });
    return finish(result,options.action||'remove',normalized,options.source||'api');
  }
  async function restore(receipt,options={}) {
    const path=receipt?.path, entry=receipt?.entry;
    if(!path||rawPath(entry)!==path||!Number.isInteger(receipt.index))return {saved:false,error:'invalid-receipt'};
    const issued = receiptIntents.get(receipt);
    if (issued !== undefined ? issued !== clearGeneration : clearGeneration !== 0)
      return {saved:false,error:'storage-changed'};
    if (restoringReceipts.has(receipt)) return {saved:false,error:'restore-pending'};
    restoringReceipts.add(receipt);
    let result;
    try {
      result=await transact(rows=>{
      // remove() always writes a collection, even when its last row is removed.
      // Absence therefore cannot be the post-delete state of a valid Undo.
      if (localStorage.getItem(STORAGE_KEY) === null) return {reason:'storage-changed'};
      if(match(rows,path).length)return {reason:'conflict'};
      if(rows.length>=MAX_ITEMS)return {reason:'capacity'};
      const next=rows.slice();next.splice(Math.min(Math.max(0,receipt.index),next.length),0,entry);
      return {changes:{[STORAGE_KEY]:next},result:{item:entry}};
      });
      if (result.ok) receiptIntents.set(receipt,-1);
    } finally { restoringReceipts.delete(receipt); }
    return finish(result,'restore',path,options.source||'api');
  }
  async function toggle(input = {}, options = {}) {
    const path=normalizePath(input.path||location.pathname);
    return has(path)?remove(path,{action:'remove',source:options.source||'toggle'})
      :add({...input,path},{action:'add',source:options.source||'toggle'});
  }
  async function clear(options = {}) {
    const expected=snapshot();
    const result=await transact(rows=>{
      if(!expected||!exact(expected,rows))return {reason:'conflict'};
      // Clear only visible, uniquely identified records; hidden legacy rows
      // remain recoverable rather than being erased by a UI action.
      const visible=rows.filter(rawPath), ids=visible.map(rawPath);
      if(ids.length>MAX_ITEMS||new Set(ids).size!==ids.length)return {reason:'conflict'};
      return {changes:visible.length?{[STORAGE_KEY]:rows.filter(row=>!rawPath(row))}:{}};
    });
    const error=result.ok?null:result.reason||'storage-write-failed';
    try {publish('clear','',null,options.source||'api',error);}catch{}
    return {items:list(),error};
  }
  function subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  async function migrateCurrentLegacyFlag() {
    const meta=metadataFromPage();
    if(!meta.path)return;
    const key=`fc:saved:${meta.path}`;
    let flag;
    try{flag=localStorage.getItem(key);}catch{return;}
    if(!flag)return;
    const result=await add(meta,{action:'legacy-flag-migrate',source:'migration'});
    if(result.saved&&!result.error) {
      try {if(localStorage.getItem(key)===flag)localStorage.removeItem(key);}catch{}
    }
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
    restore,
    notifyImport() { try { publish('import','',null,'library-import'); } catch {} },
    subscribe,
    syncButtons,
  });

  window.GBFavoriteStore = api;

  async function lifecycle(source = 'lifecycle') {
    await migrateCurrentLegacyFlag();
    syncButtons();
    document.documentElement.dataset.gbFavoriteStoreReady = '1';
    window.dispatchEvent(new CustomEvent(READY_EVENT, {
      detail: { version: VERSION, schemaVersion: SCHEMA_VERSION, source },
    }));
  }

  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage || (event.key !== null && event.key !== STORAGE_KEY)) return;
    if (event.key === null || event.newValue === null) clearGeneration++;
    publish('external-sync', '', null, 'storage');
  });
  document.addEventListener('astro:page-load', () => lifecycle('astro:page-load'));
  window.addEventListener('pageshow', () => lifecycle('pageshow'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => lifecycle('dom-ready'), { once: true });
  else lifecycle('immediate');
})();