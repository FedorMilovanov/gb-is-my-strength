/* Sole cross-tab storage authority for the six Reader Library keys. */
(() => {
  'use strict';
  if (window.GBLibraryStorage?.version === 1) return;
  const NOTES_KEY = 'gb-reader-notes-v1', QUOTES_KEY = 'gb-highlights-v1';
  const LIMIT_NOTES = 500, LIMIT_QUOTES = 200;
  function libraryFailure(reason, current = []) {
    return { ok: false, conflict: reason === 'conflict', reason, current };
  }
  // One cross-tab owner for notes and the quotes they reference. A localStorage
  // lease cannot provide atomic exclusion; unsupported/rejected locks refuse.
  async function withLibraryLock(task) {
    let timer;
    try {
      const locks = navigator.locks;
      if (!locks || typeof locks.request !== 'function') return libraryFailure('lock-unavailable');
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 3000);
      return await locks.request('gb-library:' + NOTES_KEY,
        { mode: 'exclusive', signal: controller.signal }, lock => {
          clearTimeout(timer);
          if (!lock || controller.signal.aborted) return libraryFailure('lock-unavailable');
          return task();
        });
    } catch {
      return libraryFailure('lock-or-task-failed');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  function libraryStoreSpec(key) {
    if (key === QUOTES_KEY) return { array: true, limit: LIMIT_QUOTES };
    if (key === NOTES_KEY) return { array: true, limit: LIMIT_NOTES };
    if (key === 'gb-favorites') return { array: true, limit: 50, envelope: true };
    if (key === 'gb-library-tags-v1') return { array: false, limit: 800 };
    if (key === 'gb-library-reading-v1') return { array: false, limit: 1000 };
    if (key === 'gb-library-revisit-v1') return { array: false, limit: Infinity };
    return null;
  }
  function validLibraryShape(value, spec) {
    return spec.array ? Array.isArray(value) : value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function strictLibraryRead(key) {
    const spec = libraryStoreSpec(key), raw = localStorage.getItem(key);
    const value = raw === null ? (spec.array ? [] : {}) : JSON.parse(raw);
    const envelope = spec.envelope && value && !Array.isArray(value) && Array.isArray(value.items) ? value : null;
    const items = envelope ? envelope.items : value;
    if (!validLibraryShape(items,spec)) throw new Error('Invalid library store');
    return { raw, items, spec, encode: next => JSON.stringify(envelope ? { ...envelope, items: next } : next) };
  }
  // Synchronous preparation under one lock. Cross-key writes are not a
  // database transaction: compensate only our own unchanged bytes on failure,
  // and report partial failure rather than claiming data is unchanged.
  function mutateLibrary(keys, prepare) {
    if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length ||
        keys.some(key => !libraryStoreSpec(key))) {
      return Promise.resolve(libraryFailure('invalid-keys'));
    }
    return withLibraryLock(() => {
      let state, outcome, staged;
      try {
        state = Object.fromEntries(keys.map(key => [key, strictLibraryRead(key)]));
        outcome = prepare(Object.fromEntries(keys.map(key => [key, state[key].items])));
        if (!outcome || outcome.reason) return libraryFailure(outcome?.reason || 'conflict', outcome?.current);
        if (!outcome.changes || Object.keys(outcome.changes).some(key => !state[key]))
          return libraryFailure('invalid-mutation');
        staged = [];
        for (const key of keys) {
          if (!Object.hasOwn(outcome.changes, key)) continue;
          const items = outcome.changes[key];
          const { spec, encode } = state[key];
          if (!validLibraryShape(items,spec)) return libraryFailure('invalid-mutation');
          const count = value => spec.array ? value.length : Object.keys(value).length;
          if (count(items) > spec.limit && count(items) > count(state[key].items))
            return libraryFailure('capacity', state[key].items);
          const raw = encode(items);
          if (raw !== state[key].raw) staged.push({ key, raw, before: state[key].raw });
        }
      } catch {
        return libraryFailure('storage-read-or-prepare');
      }
      const completed = [];
      const notify = key => {
        try { window.dispatchEvent(new CustomEvent('gb:library-committed', { detail: { key } })); }
        catch { /* notification cannot turn a successful write into a failed save */ }
      };
      try {
        for (const key of keys) {
          if (localStorage.getItem(key) !== state[key].raw) return libraryFailure('storage-changed');
        }
        for (const change of staged) {
          if (localStorage.getItem(change.key) !== change.before) throw new Error('Library changed');
          localStorage.setItem(change.key, change.raw);
          completed.push(change);
          if (localStorage.getItem(change.key) !== change.raw)
            throw new Error('Library bytes changed during write');
        }
      } catch {
        let partial = false;
        for (const change of completed.reverse()) {
          try {
            if (localStorage.getItem(change.key) !== change.raw) { partial = true; continue; }
            if (change.before === null) localStorage.removeItem(change.key);
            else localStorage.setItem(change.key, change.before);
            if (localStorage.getItem(change.key) !== change.before) partial = true;
          } catch { partial = true; }
        }
        if (partial) for (const change of completed) notify(change.key);
        return libraryFailure(partial ? 'partial-write' : 'storage-write');
      }
      for (const change of completed) notify(change.key);
      return { ok: true, conflict: false, ...outcome.result };
    });
  }
  window.GBLibraryStorage = Object.freeze({version:1,mutateLibrary});
})();
