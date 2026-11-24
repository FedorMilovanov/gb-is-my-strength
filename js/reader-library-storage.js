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
        // Preparation is synchronous but may mutate the decoded working copy.
        // Capture the pre-prepare count, not a reference to a mutable array/map.
        const count = (value,spec) => spec.array ? value.length : Object.keys(value).length;
        const initialCounts = Object.fromEntries(keys.map(key => [key,count(state[key].items,state[key].spec)]));
        outcome = prepare(Object.fromEntries(keys.map(key => [key, state[key].items])));
        if (!outcome || outcome.reason) return libraryFailure(outcome?.reason || 'conflict', outcome?.current);
        if (!outcome.changes || Object.keys(outcome.changes).some(key => !Object.hasOwn(state,key)))
          return libraryFailure('invalid-mutation');
        staged = [];
        for (const key of keys) {
          if (!Object.hasOwn(outcome.changes, key)) continue;
          const items = outcome.changes[key];
          const { spec, encode } = state[key];
          if (!validLibraryShape(items,spec)) return libraryFailure('invalid-mutation');
          const nextCount = count(items,spec);
          if (nextCount > spec.limit && nextCount > initialCounts[key]) {
            // Report the original snapshot, never the rejected working copy.
            const prior = state[key].raw === null ? (spec.array ? [] : {}) : JSON.parse(state[key].raw);
            return libraryFailure('capacity', spec.envelope && !Array.isArray(prior) ? prior.items : prior);
          }
          const raw = encode(items);
          if (raw !== state[key].raw) staged.push({ key, raw, before: state[key].raw });
        }
      } catch {
        return libraryFailure('storage-read-or-prepare');
      }
      return applyStaged(Object.fromEntries(keys.map(key=>[key,state[key].raw])),staged,outcome.result);
    });
  }
  function applyStaged(before, staged, result) {
    const completed = [];
    const notify = key => {
      try { window.dispatchEvent(new CustomEvent('gb:library-committed', { detail: { key } })); }
      catch { /* notification cannot turn a successful write into a failed save */ }
    };
    try {
      for (const key of Object.keys(before)) {
        if (localStorage.getItem(key) !== before[key]) return libraryFailure('storage-changed');
      }
      for (const change of staged) {
        if (localStorage.getItem(change.key) !== change.before) throw new Error('Library changed');
        localStorage.setItem(change.key, change.raw);
        completed.push(change);
        if (localStorage.getItem(change.key) !== change.raw)
          throw new Error('Library bytes changed during write');
      }
      // Detect a non-cooperating writer that changed an earlier write or
      // a read-only dependency while later keys were being committed.
      const expected = new Map(staged.map(change => [change.key, change.raw]));
      for (const key of Object.keys(before)) {
        if (localStorage.getItem(key) !== (expected.has(key) ? expected.get(key) : before[key]))
          throw new Error('Library changed before commit verification');
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
    return { ok: true, conflict: false, ...result };

  }
  const recoveryKeys=()=>[QUOTES_KEY,NOTES_KEY,'gb-favorites','gb-library-tags-v1','gb-library-reading-v1','gb-library-revisit-v1'];
  function rawRecoveryShape(raw) {
    const keys=recoveryKeys();
    return raw!==null&&typeof raw==='object'&&!Array.isArray(raw)&&
      Object.keys(raw).length===keys.length&&keys.every(key=>Object.hasOwn(raw,key)&&
        (raw[key]===null||typeof raw[key]==='string'));
  }
  // Archival export can preserve even unparseable legacy data. No normalization.
  function snapshotRaw() {
    return withLibraryLock(()=>{
      const keys=recoveryKeys(),raw=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
      if(keys.some(key=>localStorage.getItem(key)!==raw[key])) return libraryFailure('storage-changed');
      return {ok:true,raw};
    });
  }
  // Exact recovery is intentionally NOT a merge or a replacement. Only absent
  // keys may be filled; any different existing key refuses the entire operation.
  // Corrupt JSON can be archived, but must not be injected by automatic restore.
  function restoreRaw(raw, shouldContinue=()=>true) {
    if(!rawRecoveryShape(raw))return Promise.resolve(libraryFailure('invalid-recovery'));
    const requested={...raw};
    return withLibraryLock(()=>{
      if(!shouldContinue())return libraryFailure('cancelled');
      const keys=recoveryKeys(), before=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
      const staged=[];
      for(const key of keys) {
        const value=requested[key],current=before[key];
        if(current!==null&&current!==value)return libraryFailure('conflict');
        if(value===null||value===current)continue;
        let parsed;
        try{parsed=JSON.parse(value);}catch{return libraryFailure('invalid-recovery');}
        const spec=libraryStoreSpec(key);
        const items=spec.envelope&&parsed&&!Array.isArray(parsed)&&Array.isArray(parsed.items)?parsed.items:parsed;
        if(!validLibraryShape(items,spec))return libraryFailure('invalid-recovery');
        staged.push({key,raw:value,before:current});
      }
      return applyStaged(before,staged,{restored:staged.length});
    });
  }
  window.GBLibraryStorage = Object.freeze({version:1,mutateLibrary,snapshotRaw,restoreRaw});
})();
