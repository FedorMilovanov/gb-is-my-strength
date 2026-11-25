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
  /* W57/Product share one positional identity and one exact DOM resolver.
     Reusing the published visible text avoids blind string-index guesses. */
  const GBReaderAnchors = (() => {
    const normalize = normalizeText;
    const pathname = () => location.pathname.replace(/\/+$/, '') || '/';
    const hash = s => { let h=2166136261; for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };
  const blocks=(article)=>[...article.querySelectorAll('p,li,blockquote,.manuscript-quote--bilingual')]
    .filter(e=>!e.closest('.np-u-central-overview,.np-u-central-contents,.gill-card,figcaption,.np-u-series-disclosure')&&
      normalize(e.textContent).length>=6);
  function chooseBlock(node,article){
    const el=node?.nodeType===1?node:node?.parentElement;
    const parent=el?.closest('p,li,blockquote,.manuscript-quote--bilingual');
    return parent&&article.contains(parent)?parent:null;
  }
  // Source coordinates refer only to VISIBLE authored prose, not inline
  // glossary popovers hidden inside the published article's DOM.
  function visibleProjection(block){
    const segments=[],cached=new WeakMap();
    const bilingual=block.matches('.manuscript-quote--bilingual');
    const originalOpen=bilingual&&!!block.querySelector('details.mq-translation-flip[open]');
    const ignored=el=>{
      if(!el||el===block)return false;
      if(cached.has(el))return cached.get(el);
      // A bilingual quote is one authored block with two mutually exclusive
      // reading faces. Never capture the toggle label or the hidden language
      // as positional prose, even when UA details styles report display:block.
      const inactiveFace=bilingual&&(
        !!el.closest('.mq-translation-toggle') ||
        (!originalOpen&&!!el.closest('.mq-translation-original')) ||
        (originalOpen&&!!el.closest('.mq-translation-russian'))
      );
      let excluded=inactiveFace || el.matches('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"],[role="tooltip"]');
      if(!excluded){const style=getComputedStyle(el);excluded=style.display==='none'||style.visibility==='hidden'||ignored(el.parentElement);}
      cached.set(el,excluded);return excluded;
    };
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    let text='',node;
    while((node=walker.nextNode())){
      if(!node.nodeValue||ignored(node.parentElement))continue;
      const start=text.length;text+=node.nodeValue;
      segments.push({node,start,end:text.length});
    }
    return{text,segments};
  }
  function projectedOffset(p,container,offset){
    const at=document.createRange();
    try{at.setStart(container,offset);at.collapse(true)}catch(_){return null}
    for(const segment of p.segments){
      if(container===segment.node)return segment.start+offset;
      if(at.comparePoint(segment.node,segment.node.nodeValue.length)<0)continue;
      return segment.start;
    }
    return p.text.length;
  }
  function makeRange(p,start,end){
    if(!Number.isInteger(start)||!Number.isInteger(end)||
       start<0||end<=start||end>p.text.length)return null;
    const from=p.segments.find(s=>s.start<=start&&start<s.end);
    const to=p.segments.find(s=>s.start<end&&end<=s.end);
    if(!from||!to)return null;
    const r=document.createRange();
    r.setStart(from.node,start-from.start);
    r.setEnd(to.node,end-to.start);
    return r;
  }
  function contextBlock(range){
    const origin=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
    const block=origin?.closest('p,li,blockquote');
    return block?.contains(range.endContainer)?block:null;
  }
  function contextAt(p,start,end,text){
    if(start===null||end===null||start<0||end<=start||end>p.text.length||
       normalize(p.text.slice(start,end))!==normalize(text))return {before:'',after:''};
    return {
      before:p.text.slice(Math.max(0,start-240),start).replace(/\s+/g,' '),
      after:p.text.slice(end,end+240).replace(/\s+/g,' ')
    };
  }
  function selectionContext(selection,text){
    try{
      if(!selection?.rangeCount||selection.isCollapsed)return {before:'',after:''};
      const r=selection.getRangeAt(0),block=contextBlock(r);
      if(block){
        const p=visibleProjection(block);
        return contextAt(p,projectedOffset(p,r.startContainer,r.startOffset),projectedOffset(p,r.endContainer,r.endOffset),text);
      }
    }catch{}
    return {before:'',after:''};
  }
  function capture(article,selectedText){
    const sel=window.getSelection?.();
    if(!sel||sel.isCollapsed||!sel.rangeCount)return null;
    const r=sel.getRangeAt(0).cloneRange(),block=chooseBlock(r.startContainer,article);
    if(!block||chooseBlock(r.endContainer,article)!==block)return null;
    const visual=r.getBoundingClientRect();
    if(visual.width<2||visual.height<2||visual.bottom<0||visual.top>innerHeight||
       !block.getClientRects().length||block.closest('[hidden],[inert],[aria-hidden="true"]'))
      return null;
    const p=visibleProjection(block),start=projectedOffset(p,r.startContainer,r.startOffset),
      end=projectedOffset(p,r.endContainer,r.endOffset);
    if(start===null||end===null||end<=start)return null;
    const text=p.text.slice(start,end);
    if(normalize(text).length<6||text.length>3000)return null;
    const list=blocks(article),index=list.indexOf(block);
    if(index<0)return null;
    const anchor={
      projection:'reader-visible-v1',blockId:block.id||'',blockIndex:index,start,end,
      exact:text,prefix:p.text.slice(Math.max(0,start-64),start),
      suffix:p.text.slice(end,end+64),
      blockHash:hash(normalize(p.text)),
      fingerprint:hash(pathname()+'|'+index+'|'+start+':'+end+'|'+text)
    };
    const context=selectedText!==undefined&&contextBlock(r)===block?contextAt(p,start,end,selectedText):undefined;
    return{text,anchor,range:r,rect:visual,...(context?{context}:{})};
  }
  function resolution(article){
    let list;
    const projected=new WeakMap();
    const projection=block=>{let p=projected.get(block);if(!p){p=visibleProjection(block);projected.set(block,p)}return p};
    return function resolveAnchor(anchor){
    if(!anchor||typeof anchor.exact!=='string'||!anchor.exact)return null;
    list ||= blocks(article);
    // Legacy annotations are preserved exactly. If old coordinates included
    // hidden glossary prose, do NOT guess a new author or passage.
    const surroundingMatches=(raw,start,end)=>{
      const prefix=String(anchor.prefix||'').slice(-24),suffix=String(anchor.suffix||'').slice(0,24);
      if(!prefix&&!suffix)return false;
      if(prefix&&!raw.slice(Math.max(0,start-prefix.length),start).endsWith(prefix))return false;
      if(suffix&&!raw.slice(end,end+suffix.length).startsWith(suffix))return false;
      return true;
    };
    const probe=(block,start=anchor.start,end=anchor.end)=>{
      if(!block)return null;
      const p=projection(block),raw=p.text;
      if(raw.slice(start,end)!==anchor.exact)return null;
      const sameBlock=anchor.blockHash&&hash(normalize(raw))===anchor.blockHash;
      if(!sameBlock&&!surroundingMatches(raw,start,end))return null;
      return makeRange(p,start,end);
    };
    const preferred=anchor.blockId?
      article.querySelector('#'+CSS.escape(anchor.blockId)):list[anchor.blockIndex];
    const stablePreferred=!!anchor.blockId&&preferred&&list.includes(preferred);
    if(stablePreferred){
      const found=probe(preferred);if(found)return found;
    }
    // If the source block still has its authored ID, never let a matching
    // phrase in some other block steal its annotation. Search only inside that
    // identified block (for a safe in-block relocation); a failed result stays
    // orphaned instead of jumping to a coincidental paragraph.
    const searchBlocks=stablePreferred?[preferred]:list;
    const candidates=[];
    for(const block of searchBlocks){
      const p=projection(block),raw=p.text;
      const sameBlock=anchor.blockHash&&hash(normalize(raw))===anchor.blockHash;
      // Without a stable block ID, cross-block relocation is safe only when
      // the complete original block fingerprint and local context both agree.
      if(!stablePreferred&&!sameBlock)continue;
      let at=0;
      while((at=raw.indexOf(anchor.exact,at))!==-1){
        if(surroundingMatches(raw,at,at+anchor.exact.length)){
          const range=makeRange(p,at,at+anchor.exact.length);
          if(range)candidates.push(range);
        }
        at++;
      }
    }
    return candidates.length===1?candidates[0]:null;
    };
  }
  function resolve(article,anchor){return resolution(article)(anchor)}
    function sameRange(a,b) {
      if(!a||!b)return false;
      try { return a.compareBoundaryPoints(Range.START_TO_START,b)===0
        && a.compareBoundaryPoints(Range.END_TO_END,b)===0; }
      catch(_) {return false;}
    }
    return Object.freeze({blocks,visibleProjection,capture,resolve,resolution,sameRange,selectionContext});
  })();
  window.GBReaderAnchors = GBReaderAnchors;

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
        await import('/js/reader-library-storage.js?v=74af6e6a');
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
  function currentTitle() { return normalizeText(document.title.replace(/\s*[·—|].*$/, '')) || 'Статья'; }
  let lastSelection = { text: '', anchor: '', url: '' };
  function rememberSelection() {
    const selection = window.getSelection && window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = normalizeText(selection.toString());
    if (text.length < 8) return;
    let anchor = '';
    try {
      const root = document.querySelector('article,main,[data-pagefind-body]') || document.body;
      for (let e = selection.getRangeAt(0).commonAncestorContainer; e && e !== root.parentElement; e = e.parentElement) {
        if (e.nodeType === 1 && e.id) { anchor = e.id; break; }
      }
    } catch {}
    const article = document.querySelector('article.article-body') || document.querySelector('article');
    const positional = article && GBReaderAnchors.capture(article,text);
    const {before,after}=positional?.context || GBReaderAnchors.selectionContext(selection,text);
    lastSelection = { text, anchor, url: location.href, before, after,
      positionalAnchor: positional && normalizeText(positional.text) === text ? positional.anchor : null };
    window.__ssLastText__ = text;
    window.__ssLastTextUrl__ = location.href;
  }
  function selection() {
    rememberSelection();
    return lastSelection.url === location.href ? lastSelection : { text: '', anchor: '', url: '' };
  }
  function uid(prefix) { return prefix + Date.now() + Math.random().toString(36).slice(2, 7); }


  let overlay, fab, view, opener = null, editorController = null;
  let presenter = null, presenterPromise = null;
  function loadPresenter() {
    if (presenter) return Promise.resolve(presenter);
    if (!presenterPromise) {
      presenterPromise = Promise.all([
        import('/js/reader-library-presenter.js?v=35ef9be2'),
        import('/js/reader-library-v3.js?v=39300423'),
      ]).then(([module,researchModule]) => {
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
  stylesheet.href = '/css/highlights-runtime.css?v=7d6f17ca';
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
    window.addEventListener('gb:favorites-changed', sync);
    window.addEventListener('gb:favorite-store-ready', sync);
    document.addEventListener('astro:page-load', () => { dock(); sync(); attachSelection(); schedulePaint(); });
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
  let dockImpl, dockLoad;
  function dock() {
    if (!fab) return;
    if (dockImpl) return dockImpl(fab);
    dockLoad ||= import('/js/reader-library-dock.js?v=adffc6aa')
      .then(m => { dockImpl = m.dockLibraryFab; dockImpl(fab); if (m.shouldWarmReading()) loadPresenter().catch(() => {}); })
      .catch(() => { dockLoad = null; });
  }
  function render() { view?.render(); }
  function showEditor(...args) { return editorController?.showEditor(...args); }

  /* Цветные пометы: одно хранилище (gb-highlights-v1), один владелец.
     Запись — обычная цитата плюс kind:'marker' и color. Рисуем через
     CSS Custom Highlight API: текст статьи не оборачивается в <mark>, разметка
     не мутируется, поэтому аннотации не ломают якоря, озвучку и поиск.
     Если браузер не поддерживает ::highlight() — помета всё равно сохраняется
     и видна в библиотеке, просто не подсвечивается в тексте. */
  /* Индекс текста статьи: список текстовых узлов и их смещений в склейке.
     Поиск ведётся регуляркой по «терпимому к пробелам» шаблону прямо по
     склейке — это важно по трём причинам:
       1) Selection.toString() вставляет пробелы на границах блоков, а
          textContent — нет, поэтому выделение через границу абзаца иначе
          не находится;
       2) text-transform меняет регистр в отрисованном выделении («ЧАСТЬ II»),
          поэтому сравнение регистронезависимое;
       3) посимвольное построение нормализованной карты стоило ~200 мс на
          статье в 82 000 символов на каждом перерисовывании — регулярка
          по склейке укладывается в единицы миллисекунд. */
  function textIndex(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const host = n.parentElement;
        if (!host || host.closest('script, style, textarea, input, #gb-hl-panel, #gb-hl-selbar')) return NodeFilter.FILTER_REJECT;
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    const parts = [];
    let length = 0;
    let n;
    while ((n = walker.nextNode())) {
      nodes.push({ node: n, start: length });
      parts.push(n.textContent);
      length += n.textContent.length;
    }
    return { nodes, raw: parts.join('') };
  }

  const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;
  function tolerantPattern(value) {
    const chunks = normalizeText(value).split(' ').filter(Boolean).map((chunk) => chunk.replace(REGEXP_SPECIAL, '\\$&'));
    return chunks.length ? chunks.join('\\s*') : '';
  }

  function locateIn(index, text, before = '', after = '') {
    const pattern = tolerantPattern(text);
    if (!pattern) return null;
    let match = null;
    try {
      const expression = new RegExp('(' + tolerantPattern(before) + '\\s*)(' + pattern + ')\\s*' + tolerantPattern(after), 'ig');
      match = expression.exec(index.raw);
      if (match && expression.exec(index.raw)) return null;
    }
    catch { return null; }
    if (!match) return null;
    const pointAt = (offset) => {
      for (let i = index.nodes.length - 1; i >= 0; i--) {
        const rec = index.nodes[i];
        if (offset >= rec.start) return { node: rec.node, offset: Math.min(rec.node.textContent.length, offset - rec.start) };
      }
      return null;
    };
    const a = pointAt(match.index + match[1].length);
    const b = pointAt(match.index + match[1].length + match[2].length);
    if (!a || !b) return null;
    try {
      const range = document.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      if (!range.toString().trim()) return null;
      return range;
    } catch { return null; }
  }

  function locate(index, item) {
    const needle = normalizeText(item && item.text);
    if (!needle || needle.length < 3) return null;
    const before = normalizeText(item.before);
    const after = normalizeText(item.after);
    /* Сначала пробуем привязку по контексту — так одна и та же фраза,
       выделенная в двух разных абзацах, попадает каждая на своё место. */
    return locateIn(index, needle, before, after);
  }

  function paintMarks() {
    cancelScheduledPaint();
    if (!window.CSS || !CSS.highlights) return { supported: false, painted: 0, placed: new Set() };
    const scope = document.querySelector('article.article-body') || document.querySelector('article') || document.querySelector('main');
    if (!scope) {
      for (const color of MARK_COLORS) CSS.highlights.delete('gb-hl-' + color);
      return { supported: true, painted: 0, placed: new Set() };
    }
    let index = null, resolve;
    const groups = new Map();
    const placed = new Set();
    const desktopW57 = document.body?.classList.contains('np-w57-ready')
      && !!document.querySelector('#npUResearch .np-u-right-scroll')
      && matchMedia('(min-width:1121px)').matches;
    let painted = 0;
    const here = gbHighlightPath({url: location.href});
    for (const item of quotes()) {
      if (gbHighlightPath(item) !== here) continue;
      const annotated = item?.annotation?.version === 1;
      if (annotated && desktopW57) continue;
      const color = String(item && (item.color || item.annotation?.color) || '');
      if (!MARK_COLORS.includes(color)) continue;
      const range = annotated
        ? (resolve ||= GBReaderAnchors.resolution(scope))(item.annotation.anchor) : locate(index ||= textIndex(scope), item);
      if (!range) continue;
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color).push(range);
      placed.add(gbHighlightKey(item));
      painted++;
    }
    for (const color of MARK_COLORS) {
      const name = 'gb-hl-' + color;
      if (groups.has(color)) CSS.highlights.set(name, new Highlight(...groups.get(color)));
      else CSS.highlights.delete(name);
    }
    return { supported: true, painted, placed };
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
    if (cleared || e.key === QUOTES_KEY) schedulePaint();
    if (cleared || [QUOTES_KEY, NOTES_KEY, FAVORITES_KEY].includes(e.key)) sync();
  }
  window.addEventListener('storage', onLibraryStorage);
  window.addEventListener('resize', schedulePaint, {passive:true});
  document.addEventListener('toggle', e => {
    if (e.target instanceof HTMLDetailsElement && e.target.matches('details.mq-translation-flip')) schedulePaint();
  }, true);

  /* Мобильный вход в пометы. На страницах серий js/site.js не подключается,
     поэтому #selection-share-popup не существует: выделенный текст некуда
     сохранить, хотя сама библиотека предлагает «Выделите цитату…». Показываем
     собственный мини-тулбар только там, где нет W57-тулбара пилота (он живёт
     от 1121px и при выделении создаёт #npW57SelectionToolbar) — один владелец,
     одно хранилище, те же функции сохранения, что и у десктопного попапа. */
  let selectionController, selectionLoad;
  function hide() { selectionController?.hide(); }
  function hasSelection() {
    const sel = window.getSelection?.();
    return !!(sel && !sel.isCollapsed && sel.rangeCount && normalizeText(sel.toString()).length >= 8);
  }
  function attachSelection() {
    if (selectionController) { selectionController.attachSelection(); return; }
    if (!hasSelection()) return;
    loadSelectionController().then(module => {
      if (!module || selectionController || !hasSelection()) return;
      const controller = module.createSelectionController({MARK_COLORS,penSvg,rememberSelection,selection,open,showEditor,hideToast,element,uid,currentTitle,normalizeText,transactionCall,gbHighlightKey,gbAddHighlight,gbHighlightPath,gbHighlightText,gbContextKey,GBReaderAnchors,locate,textIndex,paintMarks,sync,statusMessage,toast,quotes});
      controller.attachSelection();
      selectionController = controller;
      controller.placeSelectionBar();
    }).catch(() => { /* failed mount is retried on the next selection */ });
  }
  function loadSelectionController() {
    return selectionLoad ||= import('/js/reader-library-selection.js?v=1778ffcd')
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
    paintMarks,
    resolveRange: (item, scope) => {
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
