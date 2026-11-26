/* Unified reader library: GBFavoriteStore remains the owner of favorites. */
(function () {
  'use strict';
  if (window.GBHighlights && window.GBHighlights.libraryVersion === 2) return;

  const QUOTES_KEY = 'gb-highlights-v1';
  const NOTES_KEY = 'gb-reader-notes-v1';
  const FAVORITES_KEY = 'gb-favorites';
  const LIMIT_QUOTES = 200;
  const LIMIT_NOTES = 500;
  const BATCH_SIZE = 30;
  const bookSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2.5-2-5.5-2.5-9-1.5v14c3.5-1 6.5-.5 9 1.5 2.5-2 5.5-2.5 9-1.5v-14c-3.5-1-6.5-.5-9 1.5Z"/><path d="M12 6v14"/></svg>';
  const penSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/></svg>';
  function normalizeText(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  let rangeRuntime, rangeLoad, GBReaderAnchors;
  // Explicit asynchronous readiness; all range operations remain synchronous
  // once this single owner is published. No range payload on a clean reading page.
  function ensureRanges() {
    if (rangeRuntime) return Promise.resolve(rangeRuntime);
    return rangeLoad ||= import('/js/reader-library-ranges.js?v=9d01527f')
      .then(m=>{
        const runtime=m.createRangeRuntime({normalizeText,quotes,gbHighlightPath,gbHighlightKey,MARK_COLORS,cancelScheduledPaint,rememberShareText});
        GBReaderAnchors=runtime.GBReaderAnchors;
        rangeRuntime=runtime;
        window.GBReaderAnchors=GBReaderAnchors;
        return runtime;
      }).catch(error=>{rangeLoad=null;throw error});
  }

  function gbHighlightPath(item) {
    const raw = String(item && item.url || '');
    try { return new URL(raw, location.origin).pathname.replace(/\/+$/, '') || '/'; }
    catch { return raw.split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '') || '/'; }
  }
  function gbHighlightText(item) { return normalizeText(item && item.text).toLocaleLowerCase(); }
  function gbContextKey(x) {
    const before = normalizeText(x && x.before).toLocaleLowerCase();
    const after = normalizeText(x && x.after).toLocaleLowerCase();
    return (!before && !after) ? '' : before + '\u0001' + after;
  }
  function gbHighlightKey(x) {
    const t=gbHighlightText(x), a=x?.annotation?.version===1&&x.annotation.anchor;
    if (!t) return '';
    if (a && Number.isInteger(a.start) && Number.isInteger(a.end) && typeof a.exact === 'string') {
      return gbHighlightPath(x)+'\nrange-v1:'+JSON.stringify([a.blockId||'',a.blockIndex??-1,a.start,a.end,a.exact]);
    }
    /* Цветные пометы различаются ещё и местом: одна и та же фраза может быть
       выделена в двух разных абзацах, и раньше вторая запись терялась как
       «дубль» — в тексте оставалась только одна подсветка. Для цитат,
       заметок и закладок семантика прежняя: страница + текст. */
    const positional = (x && (x.kind === 'marker' || x.color)) ? gbContextKey(x) : '';
    return gbHighlightPath(x)+'\n'+t+(positional?'\nctx:'+positional:'');
  }
  function gbDedupeHighlights(items) {
    const seen=new Set();
    return (Array.isArray(items)?items:[]).filter((item,index)=>{
      const key=gbHighlightKey(item)||'__invalid__:'+(item?.id||index);
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  function gbAddHighlight(items,item) {
    const unique=items,key=gbHighlightKey(item);
    return key&&unique.length<LIMIT_QUOTES&&!unique.some(x=>gbHighlightKey(x)===key)
      ?[item,...unique]:unique;
  }
  const MARK_COLORS = ['amber', 'sage', 'blue', 'lime', 'rose'];

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(value)) return value;
      if (key === FAVORITES_KEY && Array.isArray(value && value.items)) return value.items;
    } catch {}
    return [];
  }
  function libraryFailure(reason, current = []) {
    return {ok:false,conflict:reason==='conflict',reason,current};
  }
  // Capture intent before either lazy module starts loading. The storage
  // owner independently protects the period spent waiting for its lock.
  let clearIntent = 0;
  const receiptIntents = new WeakMap(), restoringReceipts = new WeakSet();

  async function storageCall(method,...args) {
    const intent = clearIntent;
    try {
      if(window.GBLibraryStorage?.version!==1)
        await import('/js/reader-library-storage.js?v=c6707892');
      if (intent !== clearIntent) return libraryFailure('storage-changed');
      const owner=window.GBLibraryStorage;
      if(owner?.version!==1||typeof owner[method]!=='function')return libraryFailure('lock-unavailable');
      const result = await owner[method](...args);
      if (result.ok && intent !== clearIntent) return libraryFailure('storage-changed');
      if (result.ok && result.receipt && typeof result.receipt === 'object') receiptIntents.set(result.receipt,intent);
      return result;
    } catch { return libraryFailure('lock-unavailable'); }
  }
  function mutateLibrary(keys,prepare) {return storageCall('mutateLibrary',keys,prepare);}
  function snapshotRaw() {return storageCall('snapshotRaw');}
  function restoreRaw(raw,shouldContinue) {return storageCall('restoreRaw',raw,shouldContinue);}
  // Restore only the deleted version and relationships that are still valid.
  // A conflict never rewinds a newer quote or note; detached copy is explicit.
  let recordTransactions, recordTransactionsLoad;
  async function transactionCall(method,...args) {
    const intent = clearIntent;
    const receipt = method === 'restoreDeleted' ? args[0] : null;
    if (method === 'restoreDeleted') {
      if (receiptIntents.get(receipt) !== intent) return libraryFailure('storage-changed');
      if (restoringReceipts.has(receipt)) return libraryFailure('restore-pending');
      restoringReceipts.add(receipt);
    }
    try {
      if(!recordTransactions) {
        recordTransactionsLoad ||= import('/js/reader-library-record-transactions.js?v=ecb28bb6')
          .then(m=>m.createRecordTransactions({mutateLibrary,libraryFailure,gbHighlightKey,NOTES_KEY,QUOTES_KEY,LIMIT_NOTES,LIMIT_QUOTES}))
          .catch(error=>{recordTransactionsLoad=null;throw error});
        recordTransactions=await recordTransactionsLoad;
      }
      if (intent !== clearIntent) return libraryFailure('storage-changed');
      const result = await recordTransactions[method](...args);
      if (receipt && result.ok) receiptIntents.delete(receipt);
      return result.ok && intent !== clearIntent ? libraryFailure('storage-changed') : result;
    } catch { return libraryFailure('lock-unavailable'); }
    finally { if (receipt) restoringReceipts.delete(receipt); }
  }
  function restoreDeleted(receipt, copyId = null) {
    return transactionCall('restoreDeleted',receipt,copyId);
  }
  // Invalid historical rows remain recoverable in the exact backup, but
  // cannot be rendered or offered for identity-based edits in the library.
  function visibleRecord(row) {
    return row && typeof row==='object' && !Array.isArray(row) &&
      typeof row.text==='string' &&
      ((typeof row.id==='string' && row.id.length>0) || Number.isSafeInteger(row.id));
  }
  function quotes() {
    return read(QUOTES_KEY).filter(visibleRecord);
  }
  function notes() { return read(NOTES_KEY).filter(visibleRecord); }
  function favorites() {
    const store = window.GBFavoriteStore;
    return store && typeof store.list === 'function' ? store.list({ persistMigration: false }) :
      read(FAVORITES_KEY).filter(x=>x && typeof x==='object' && !Array.isArray(x) &&
        typeof (x.path||x.url)==='string' && Boolean(x.path||x.url) && Boolean(localUrl(x.path||x.url)));
  }
  function localUrl(value) {
    try {
      const url = new URL(value || '', location.origin);
      if (url.origin === location.origin && /^https?:$/.test(url.protocol)) return url.pathname + url.search + url.hash;
    } catch {}
    return '';
  }
  function all() {
    const q = quotes().map((x) => ({
      id: String(x.id),
      type: 'quote', recordSnapshot: JSON.stringify(x),
      /* kind/color доносим до списка: иначе помета выглядит как цитата
         и цвет в библиотеке не виден (P2). */
      kind: (x.kind === 'marker' || x.annotation?.kind === 'marker') ? 'marker' : 'quote',
      color: MARK_COLORS.includes(String(x.color || x.annotation?.color || '')) ? String(x.color || x.annotation?.color) : '',
      text: String(x.text || ''), before: String(x.before || ''), after: String(x.after || ''),
      title: String(x.articleTitle || 'Статья'), url: localUrl(x.url), savedAt: Number(x.savedAt) || 0,
    }));
    const n = notes().map((x) => ({ id: String(x.id), type: 'note', recordSnapshot: JSON.stringify(x), text: String(x.text || ''), quoteText: String(x.quoteText || ''), title: String(x.articleTitle || 'Статья'), url: localUrl(x.url), savedAt: Number(x.savedAt) || 0 }));
    const f = favorites().map((x) => ({ id: String(x.path || x.url || ''), type: 'favorite', text: String(x.description || ''), title: String(x.title || 'Статья'), url: localUrl(x.path || x.url), savedAt: Number(x.addedAt || x.savedAt) || 0 }));
    return q.concat(n, f).sort((a, b) => b.savedAt - a.savedAt);
  }
  function rememberShareText() {
    const selection=window.getSelection?.();
    if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
    const text=normalizeText(selection.toString());
    if(text.length<8)return null;
    window.__ssLastText__=text;
    window.__ssLastTextUrl__=location.href;
    return {selection,text};
  }
  function rememberSelection() {
    if (rangeRuntime) rangeRuntime.rememberSelection();
    else rememberShareText();
  }

  let overlay, fab, view, opener = null, editorController = null;
  let presenter = null, presenterPromise = null;
  function loadPresenter() {
    if (presenter) return Promise.resolve(presenter);
    if (!presenterPromise) {
      presenterPromise = Promise.all([
        import('/js/reader-library-presenter.js?v=df7edaea'),
        import('/js/reader-library-v3.js?v=54f97aa3'),
        ensureRanges(),
      ]).then(([module,researchModule,{currentTitle,uid}]) => {
          if (!view) {
            view = module.createLibraryView({penSvg,uid,currentTitle,transactionCall,restoreDeleted,NOTES_KEY,all,quotes,GBReaderAnchors,statusMessage,close,hideToast,hide,sync,normalizeText,BATCH_SIZE,createResearch:researchModule.createLibraryResearch,isOpen});
            ({overlay,editorController}=view);
            fab.setAttribute('aria-controls','gb-hl-panel');
          }
          presenter = module;
          return module;
        })
        .catch((error) => { presenterPromise = null; throw error; });
    }
    return presenterPromise;
  }
  const stylesheet = document.createElement('link');
  stylesheet.id = 'gbHlRuntimeCss';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/css/highlights-runtime.css?v=634b5ba8';
  if (!document.getElementById(stylesheet.id)) document.head.appendChild(stylesheet);

  function element(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = value;
    return node;
  }
  function isOpen() { return Boolean(overlay && overlay.classList.contains('is-open')); }
  /* P5/P3: подтверждение и отмена там, где панель библиотеки закрыта.
     Статус в панели остаётся, тост — для жестов из текста (помета, цитата,
     заметка), где иначе пользователь не видит ни результата, ни отката. */
  function hideToast() {
    const el = document.getElementById('gb-hl-toast');
    if (el) el.dataset.open = 'false';
  }
  function toast(message, action) {
    if (!document.body) return;
    let el = document.getElementById('gb-hl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gb-hl-toast';
      el.dataset.open = 'false';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.replaceChildren(element('span', 'gb-hl-toast-text', message));
    if (action && action.label && typeof action.run === 'function') {
      const b = element('button', 'gb-hl-toast-action', action.label);
      b.type = 'button';
      b.addEventListener('click', () => { hideToast(); action.run(); });
      el.appendChild(b);
    }
    el.dataset.open = 'true';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(hideToast, 6000);
  }
  function statusMessage(message,error) {
    if (editorController && isOpen()) return editorController.statusMessage(message,error);
    if (error) toast(message,null);
  }
  function create() {
    if (!document.body || fab || document.getElementById('gb-hl-fab')) return;
    fab = document.createElement('button');
    fab.id = 'gb-hl-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Моя библиотека');
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = bookSvg + '<span id="gb-hl-fab-count" aria-hidden="true"></span>';
    document.body.append(fab);
    fab.classList.add('visible');
    fab.addEventListener('click', () => open(fab));
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', pendingFocusChanged);
    document.addEventListener('pointerdown', pendingPointerChanged, true);
    window.addEventListener('gb:favorites-changed', sync);
    window.addEventListener('gb:favorite-store-ready', sync);
    document.addEventListener('astro:page-load', () => { dock(); warmReading(); sync(); attachSelection(); schedulePaint(); });
    document.addEventListener('gb:mobile-fallback-ready', dock);
    window.addEventListener('resize', dock, { passive: true });
    attachSelection();
    dock();
    sync();
  }
  function keydown(e) {
    if (!isOpen()) {
      if (opening && e.key === 'Escape') {
        if (!ownsPendingFocus()) cancelPending(false);
        else { e.preventDefault(); close(); }
      }
      return;
    }
    view.keydown(e);
  }
  let opening = null, openGeneration = 0, pendingTrigger = null;
  let pendingReturn = null, focusReturn = null, pendingInitialFocus = null;
  function ownsPendingFocus() {
    const active = document.activeElement;
    return !active || active === document.body || active === pendingInitialFocus ||
      active === pendingTrigger || pendingTrigger?.contains?.(active) || active === pendingReturn ||
      !active.isConnected || !active.getClientRects?.().length ||
      !!active.closest?.('[hidden],[inert],[aria-hidden="true"]');
  }
  function cancelPending(restore) {
    if (!opening) return;
    const target = pendingReturn;
    ++openGeneration;
    opening = null;
    clearOpenBusy();
    if (restore) restoreReadingFocus(target);
  }
  function pendingFocusChanged() {
    if (opening && !isOpen() && !ownsPendingFocus()) cancelPending(false);
  }
  function pendingPointerChanged(event) {
    // WebKit may dispatch a real click without moving focus to its button.
    if (!opening || isOpen()) return;
    if (pendingTrigger !== document.body && pendingTrigger !== document.documentElement &&
        pendingTrigger?.contains?.(event.target)) return;
    cancelPending(false);
  }
  function restoreReadingFocus(preferred) {
    const candidates = [preferred, fab, document.getElementById('npULibraryButton'), document.querySelector('article.article-body h1, article h1, main h1')];
    for (const target of candidates) {
      if (!target?.isConnected || target.disabled || !target.focus || !target.getClientRects().length ||
          target.closest('[hidden],[inert],[aria-hidden="true"]') || getComputedStyle(target).visibility !== 'visible') continue;
      const temporary = target.tabIndex < 0 && !target.hasAttribute('tabindex');
      if (temporary) target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
      if (document.activeElement === target) {
        if (temporary) target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once:true});
        return;
      }
      if (temporary) target.removeAttribute('tabindex');
    }
  }
  function clearOpenBusy() {
    fab?.removeAttribute('aria-busy');
    pendingTrigger?.removeAttribute?.('aria-busy');
    pendingTrigger = null;
    pendingReturn = null;
    pendingInitialFocus = null;
  }
  function open(trigger, returnTarget = null) {
    if (!fab) create();
    if (!fab) return Promise.resolve(false);
    if (isOpen()) return Promise.resolve(true);
    if (opening) cancelPending(false);
    const generation = ++openGeneration;
    const activeTrigger = trigger || document.activeElement;
    const activeReturn = returnTarget || activeTrigger;
    pendingTrigger = activeTrigger;
    pendingReturn = activeReturn;
    pendingInitialFocus = document.activeElement;
    fab.setAttribute('aria-busy','true');
    if (activeTrigger !== fab) activeTrigger?.setAttribute?.('aria-busy','true');
    const task = loadPresenter().then(() => {
      if (generation !== openGeneration) return false;
      if (!ownsPendingFocus()) { cancelPending(false); return false; }
      opener = activeTrigger;
      focusReturn = activeReturn;
      view.activate(fab,opener);
      return true;
    }).catch(() => {
      if (generation === openGeneration) {
        if (isOpen()) close();
        else if (ownsPendingFocus()) restoreReadingFocus(activeReturn);
        else { cancelPending(false); return false; }
        toast('Не удалось открыть библиотеку. Проверьте подключение и попробуйте ещё раз.', null);
      }
      return false;
    }).finally(() => {
      if (opening === task) { opening = null; clearOpenBusy(); }
    });
    opening = task;
    return task;
  }
  function close() {
    if (opening) cancelPending(!isOpen() && ownsPendingFocus());
    if (!isOpen()) return;
    view.deactivate(fab,opener);
    restoreReadingFocus(focusReturn);
    opener = null;
    focusReturn = null;
  }
  function sync() { if (fab) { const count=quotes().length+notes().length+favorites().length; fab.classList.add('visible'); fab.querySelector('#gb-hl-fab-count').hidden = count === 0; fab.setAttribute('aria-label', 'Моя библиотека — сохранено ' + count); } if (isOpen()) render(); }
  let dockImpl, dockLoad, shouldWarmReading, warmReadingPromise;
  function warmReading() {
    if (warmReadingPromise || !shouldWarmReading?.()) return;
    warmReadingPromise = import('/js/reader-library-research-core.js?v=4f56696b')
      .then(research=>research.warmReadingProgress({isOpen,exitForResume:resume=>{close();requestAnimationFrame(()=>requestAnimationFrame(resume));}}))
      .catch(()=>{warmReadingPromise=null;});
  }
  function dock() {
    if (!fab) return;
    if (dockImpl) return dockImpl(fab);
    dockLoad ||= import('/js/reader-library-dock.js?v=f730766c')
      .then(m => { dockImpl = m.dockLibraryFab; dockImpl(fab); shouldWarmReading=m.shouldWarmReading; warmReading(); })
      .catch(() => { dockLoad = null; });
  }
  function render() { view?.render(); }
  function showEditor(...args) { return editorController?.showEditor(...args); }

  function textIndex(scope) { return rangeRuntime?.textIndex(scope); }
  function locate(index,item) { return rangeRuntime?.locate(index,item)||null; }
  function paintMarks() {
    cancelScheduledPaint();
    if (rangeRuntime) return rangeRuntime.paintMarks();
    const supported=Boolean(window.CSS&&CSS.highlights);
    if (supported) {
      const here=gbHighlightPath({url:location.href});
      const needed=quotes().some(item=>gbHighlightPath(item)===here&&MARK_COLORS.includes(String(item.color||item.annotation?.color||'')));
      if (needed) {
        ensureRanges().then(schedulePaint).catch(()=>{});
        return {supported,painted:0,placed:new Set(),pending:true};
      }
      for(const color of MARK_COLORS) CSS.highlights.delete('gb-hl-'+color);
    }
    return {supported,painted:0,placed:new Set()};
  }

  // One deferred repaint per frame; an immediate API repaint consumes it.
  let paintFrame = null;
  function cancelScheduledPaint() {
    if (paintFrame !== null) cancelAnimationFrame(paintFrame);
    paintFrame = null;
  }
  function schedulePaint() {
    if (paintFrame !== null) return;
    paintFrame = requestAnimationFrame(() => {
      paintFrame = null;
      paintMarks();
    });
  }
  window.addEventListener('gb:library-committed', e => {
    if (!e?.detail || e.detail.key === QUOTES_KEY) schedulePaint();
  });
  function onLibraryStorage(e) {
    if (e.storageArea !== localStorage) return;
    const cleared = e.key === null;
    if (cleared) {
      clearIntent++;
      // Revoke obsolete Undo UI, retaining the open draft.
      editorController?.clearUndo();
      clearTimeout(toast.timer);
      hideToast();
      document.getElementById('gb-hl-toast')?.replaceChildren();
    }
    if (e.key === 'gb-library-reading-v1') warmReading();
    if (cleared || e.key === QUOTES_KEY) schedulePaint();
    if (cleared || [QUOTES_KEY, NOTES_KEY, FAVORITES_KEY].includes(e.key)) sync();
  }
  window.addEventListener('storage', onLibraryStorage);
  window.addEventListener('resize', schedulePaint, {passive:true});
  document.addEventListener('toggle', e => {
    if (e.target instanceof HTMLDetailsElement && e.target.matches('details.mq-translation-flip')) schedulePaint();
  }, true);

  // Mount native selection actions only on a live selection. ARGON owns its
  // own toolbar; the lazy controller arbitrates native/fallback surfaces.
  let selectionController, selectionLoad;
  function hide() { selectionController?.hide(); }
  function hasSelection() {
    const sel = window.getSelection?.();
    return !!(sel && !sel.isCollapsed && sel.rangeCount && normalizeText(sel.toString()).length >= 8);
  }
  function attachSelection() {
    if (selectionController) { selectionController.attachSelection(); return; }
    if (!hasSelection()) return;
    Promise.all([loadSelectionController(),ensureRanges()]).then(([module,{selection,currentTitle,uid}]) => {
      if (!module || selectionController || !hasSelection()) return;
      rememberSelection();
      const controller = module.createSelectionController({MARK_COLORS,penSvg,rememberSelection,selection,open,showEditor,hideToast,element,uid,currentTitle,normalizeText,transactionCall,gbHighlightKey,gbAddHighlight,gbHighlightPath,gbHighlightText,gbContextKey,GBReaderAnchors,locate,textIndex,paintMarks,sync,statusMessage,toast,quotes});
      controller.attachSelection();
      selectionController = controller;
      controller.placeSelectionBar();
    }).catch(() => { /* failed mount is retried on the next selection */ });
  }
  function loadSelectionController() {
    return selectionLoad ||= import('/js/reader-library-selection.js?v=b301d44f')
      .catch(() => { selectionLoad = null; return null; });
  }
  // Prewarm long-press on touch/pen; a normal mouse click needs no module.
  // Keyboard and drag selection load on selectionchange; end events retry.
  document.addEventListener('pointerdown', e => {
    if (['touch','pen'].includes(e.pointerType) && e.target.closest?.('article, main [data-pagefind-body], .article-body')) loadSelectionController();
  }, {passive:true});
  const captureSelection = () => { rememberSelection(); attachSelection(); };
  document.addEventListener('mouseup', () => setTimeout(captureSelection, 25));
  document.addEventListener('touchend', () => setTimeout(captureSelection, 60), { passive: true });
  document.addEventListener('selectionchange', captureSelection);
  document.addEventListener('click', (e) => {
    if (e.target.closest('#selection-share-popup')) attachSelection();
  });

  const api = Object.freeze({
    libraryVersion: 2, open, close, getAll: quotes, mutateLibrary, restoreDeleted, snapshotRaw, restoreRaw,
    getNotes: notes, getLibrary: all,
    highlightPath: gbHighlightPath, highlightText: gbHighlightText,
    highlightKey: gbHighlightKey, dedupe: gbDedupeHighlights, addHighlight: gbAddHighlight,
    /* Диагностика и тесты: перерисовать пометы и получить, что реально легло
       в текст. Публично ничего не меняет. */
    ensureRanges, paintMarks,
    resolveRange: (item, scope) => {
      if (!rangeRuntime) return null;
      const article=scope || document.querySelector('article.article-body') || document.querySelector('article');
      if(!article)return null;
      return item?.annotation?.version===1
        ? GBReaderAnchors.resolve(article,item.annotation.anchor)
        : locate(textIndex(article),item);
    },
  });
  window.GBHighlights = api;
  window.GBReaderLibrary = api;

  function init() {
    create();
    setTimeout(attachSelection, 500);
    setTimeout(dock, 1200);
    setTimeout(schedulePaint, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
