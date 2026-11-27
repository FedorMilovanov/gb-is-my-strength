/* Shared Reader research metadata and lightweight reading-progress owner. */
'use strict';

const KEYS = Object.freeze({
  quotes: 'gb-highlights-v1',
  notes: 'gb-reader-notes-v1',
  favorites: 'gb-favorites',
  tags: 'gb-library-tags-v1',
  reading: 'gb-library-reading-v1',
  revisit: 'gb-library-revisit-v1',
});
const cap = (v, n) => String(v == null ? '' : v).slice(0, n);
const cleanPath = (value) => {
  if (!value) return '';
  try {
    const u = new URL(value || '', location.origin);
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return '';
    return u.pathname.replace(/\/+$/, '') || '/';
  } catch { return ''; }
};
const parse = (key, fallback) => {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; }
  catch { return fallback; }
};
function objectMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
const exact = (a,b) => JSON.stringify(a) === JSON.stringify(b);

// Metadata edits must use the fresh map inside the same lock as backup import.
function mutateResearch(name, prepare) {
  const owner=window.GBHighlights;
  if(!['tags','reading','revisit'].includes(name) || typeof owner?.mutateLibrary!=='function')
    return Promise.resolve({ok:false,reason:'lock-unavailable'});
  const key=KEYS[name];
  return owner.mutateLibrary([key],stores=>{
    const old=stores[key], outcome=prepare(old);
    if(!outcome || outcome.reason) return {reason:outcome?.reason||'conflict'};
    return {changes:exact(old,outcome.value)?{}:{[key]:outcome.value},result:{value:outcome.value}};
  });
}
function changeReading(map,key,state,title,at) {
  const old=Object.hasOwn(map,key)?map[key]:{};
  if(!old||typeof old!=='object'||Array.isArray(old)) return {reason:'invalid-record'};
  if(old.updatedAt!=null && (!Number.isFinite(Number(old.updatedAt))||Number(old.updatedAt)>at))
    return {reason:'conflict'};
  const record={...old,state,title:cap(title||old.title,240),
    updatedAt:at,anchor:old.anchor||'',ratio:Number(old.ratio)||0};
  return {value:{...map,[key]:record}};
}
function updateProgress(map,key,expected,progress) {
  const live=map[key];
  if(!live||live.state!=='reading'||!exact(live,expected)) return {reason:'conflict'};
  return {value:{...map,[key]:{...live,...progress}}};
}
// Reading progress has one document-lifetime owner, independent of the
// optional library DOM. The first mount (warm route or user open) wins.
let readingProgress;
export function warmReadingProgress({isOpen,exitForResume,earlyReading}) {
  if (readingProgress) return readingProgress;
  const currentPath = () => cleanPath(location.pathname);
  const readReading = () => objectMap(parse(KEYS.reading, {}));
  let reading = readReading(), pending = null, progressTimer = null, writing = null;
  const navigationKey = 'gb-library-progress-navigation-v1';
  let replaying = false;
  function cancelPendingProgress() {
    clearTimeout(progressTimer);
    progressTimer = null;
    pending = null;
  }
  function anchorAtScroll() {
    const headings = [...document.querySelectorAll('article h2[id],article h3[id],main [data-pagefind-body] h2[id],main [data-pagefind-body] h3[id]')];
    const cutoff = Math.max(90, Math.min(window.innerHeight * .35, 250));
    for (let i = headings.length - 1; i >= 0; i--) {
      if (headings[i].getBoundingClientRect().top <= cutoff) return headings[i].id;
    }
    return '';
  }
  function snapshotProgress() {
    const maxScroll = Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    return {anchor:anchorAtScroll(),ratio:Math.min(1,Math.max(0,window.scrollY/maxScroll)),updatedAt:Date.now()};
  }
  function flushPendingProgress() {
    progressTimer = null;
    if (writing) return; // the current write will drain the newer intent
    const intent = pending;
    pending = null;
    if (intent) void rememberProgress(intent);
  }
  async function rememberProgress(intent = null) {
    if ((isOpen() && !intent?.progress) || writing) return;
    const key = intent?.key || currentPath();
    const expected = intent?.expected || readReading()[key];
    if (key !== currentPath() || expected?.state !== 'reading') return;
    const progress = intent?.progress || snapshotProgress();
    // Snapshot the record at scroll time; never attribute an old scroll
    // to a newer reading status or route after a concurrent mutation.
    const operation = {key, expected, progress, next:null};
    writing = operation;
    try {
      await mutateResearch('reading',map=>{
        const outcome=updateProgress(map,key,expected,progress);
        if(outcome.value) operation.next=outcome.value[key];
        return outcome;
      });
    } finally {
      writing = null;
      refreshReading();
      if (pending && progressTimer === null) progressTimer = setTimeout(flushPendingProgress,0);
    }
  }
  function onScroll() {
    const key = currentPath(), expected = reading[key];
    if (isOpen() || expected?.state !== 'reading') return;
    cancelPendingProgress();
    pending = {key,expected};
    progressTimer = setTimeout(flushPendingProgress,800);
  }
  function flushBeforeOpen() {
    if (!pending || isOpen()) return;
    // Capture the reading viewport before the presenter locks scrolling.
    // If a write is already queued, retain this snapshot until it drains.
    pending.progress ||= snapshotProgress();
    clearTimeout(progressTimer);
    flushPendingProgress();
  }
  // A pagehide Web Lock request may never execute before document teardown.
  // Transfer only the latest observed viewport within this browser tab; the
  // next document must still perform the exact record CAS under the owner lock.
  function onPageHide() {
    clearTimeout(progressTimer);
    progressTimer = null;
    const intent = pending || writing;
    if (!intent) return; // a visit without scroll cannot reset progress
    const snapshot = {key:intent.key,expected:intent.expected,progress:intent.progress || snapshotProgress()};
    // An earlier same-document write may finish as the page is leaving.
    // Accept only its exact proposed successor, never an arbitrary live record.
    if (pending && writing?.key===intent.key && exact(intent.expected,writing.expected))
      snapshot.ownProgress = writing.progress;
    try {
      sessionStorage.setItem(navigationKey,JSON.stringify(snapshot));
      pending = null;
    } catch { flushPendingProgress(); }
  }
  async function replayNavigationProgress() {
    if (replaying) return;
    let raw;
    try { raw = sessionStorage.getItem(navigationKey); } catch { return; }
    if (!raw) return;
    replaying = true;
    try {
      const intent = JSON.parse(raw), p = intent?.progress;
      if (typeof intent?.key !== 'string' || !intent.key || cleanPath(intent.key)!==intent.key ||
          intent.expected?.state!=='reading' || typeof p?.anchor!=='string' ||
          !Number.isFinite(p.ratio) || p.ratio<0 || p.ratio>1 || !Number.isFinite(p.updatedAt)) return;
      await mutateResearch('reading',map=>{
        const live=map[intent.key], prior=intent.ownProgress;
        const successor=typeof prior?.anchor==='string' && Number.isFinite(prior.ratio) &&
          prior.ratio>=0 && prior.ratio<=1 && Number.isFinite(prior.updatedAt) && prior.updatedAt<=p.updatedAt
          ? {...intent.expected,anchor:prior.anchor,ratio:prior.ratio,updatedAt:prior.updatedAt} : null;
        const expected=successor && exact(live,successor) ? successor : intent.expected;
        return updateProgress(map,intent.key,expected,{anchor:p.anchor,ratio:p.ratio,updatedAt:p.updatedAt});
      });
    } catch { /* malformed or unavailable handoff must not block reading */ }
    finally {
      replaying = false;
      try { if (sessionStorage.getItem(navigationKey)===raw) sessionStorage.removeItem(navigationKey); } catch {}
      refreshReading();
    }
  }
  function onPageShow(event) {
    if (event.persisted) { refreshReading(); void replayNavigationProgress(); }
  }
  function refreshReading(ownCommit = false) {
    reading = readReading();
    if (pending && !exact(reading[pending.key],pending.expected)) {
      // Only our exact acknowledged successor can advance a queued scroll.
      // An external status change, clear or replacement still cancels it.
      if (ownCommit && writing?.key === pending.key && writing.next &&
          exact(pending.expected,writing.expected) && exact(reading[pending.key],writing.next)) {
        pending.expected = reading[pending.key];
      } else cancelPendingProgress();
    }
  }
  function onStorage(event) {
    if (event.storageArea !== localStorage) return;
    if (event.key === null) cancelPendingProgress();
    if (event.key === null || event.key === KEYS.reading) refreshReading();
  }
  function onCommitted(event) {
    if (!event.detail || event.detail.key === KEYS.reading) refreshReading(true);
  }
  function resume(path, notify = () => {}) {
    const key = cleanPath(path), data = readReading()[key];
    if (!data || data.state !== 'reading') return;
    if (key !== currentPath()) {
      sessionStorage.setItem('gb-library-resume-once', key);
      location.assign(key);
      return;
    }
    const scrollToSavedPosition = () => {
      // Deferred resume must not replay a record cleared or replaced in another tab.
      const live = objectMap(parse(KEYS.reading, {}))[key];
      if (!exact(live,data)) return;
      const target = data.anchor ? document.getElementById(data.anchor) : null;
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        // Heading focus tells keyboard and screen-reader users where reading
        // resumed; never focus a detached or hidden overlay element.
        if (target.isConnected && target.focus) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      } else {
        const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        window.scrollTo({ top: max * Math.min(1, Math.max(0, Number(data.ratio) || 0)), behavior: 'instant' });
      }
    };
    if (isOpen()) {
      // The Product Library owns the only overlay and scroll lock. Scrolling
      // before it closes is silently undone by SiteUtils.unlockScroll.
      if (typeof exitForResume === 'function') exitForResume(scrollToSavedPosition);
      else notify('Закройте библиотеку, затем повторите переход к месту чтения.', true);
      return;
    }
    scrollToSavedPosition();
  }
  function autoResumeOnce() {
    try {
      const key = sessionStorage.getItem('gb-library-resume-once');
      if (key !== currentPath()) return;
      sessionStorage.removeItem('gb-library-resume-once');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (key === currentPath()) resume(key);
      }));
    } catch {}
  }
  const lifetime = new AbortController(), {signal} = lifetime;
  try {
    window.addEventListener('scroll',onScroll,{passive:true,signal});
    window.addEventListener('pagehide',onPageHide,{signal});
    window.addEventListener('pageshow',onPageShow,{signal});
    window.addEventListener('load',autoResumeOnce,{once:true,signal});
    window.addEventListener('storage',onStorage,{signal});
    window.addEventListener('gb:library-committed',onCommitted,{signal});
  } catch (error) {
    lifetime.abort();
    throw error;
  }
  readingProgress = Object.freeze({rememberProgress,resume,flushBeforeOpen});
  // The bootstrap may observe real scrolling before this lazy owner mounts.
  // Adopt only the captured record and the still-current viewport; no extra writer.
  try {
    const key=currentPath(), expected=JSON.parse(earlyReading?.[0] || '{}')?.[key];
    if (!isOpen() && earlyReading?.[1]===scrollY && expected?.state==='reading' && exact(reading[key],expected)) {
      pending={key,expected,progress:snapshotProgress()};
      progressTimer=setTimeout(flushPendingProgress,800);
    }
  } catch {}
  void replayNavigationProgress();
  if (document.readyState === 'complete') autoResumeOnce();
  return readingProgress;
}

export { KEYS, cap, cleanPath, parse, objectMap, exact, mutateResearch, changeReading, updateProgress };
