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
  const quoteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4V4z"/></svg>';
  const bookSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2.5-2-5.5-2.5-9-1.5v14c3.5-1 6.5-.5 9 1.5 2.5-2 5.5-2.5 9-1.5v-14c-3.5-1-6.5-.5-9 1.5Z"/><path d="M12 6v14"/></svg>';
  const penSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/></svg>';
  const closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>';
  const searchSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';

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
      const excluded=inactiveFace ||
        el.matches('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"],[role="tooltip"]') ||
        getComputedStyle(el).display==='none' ||
        getComputedStyle(el).visibility==='hidden' || ignored(el.parentElement);
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
  function makeRange(block,start,end){
    const p=visibleProjection(block);
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
  function capture(article){
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
    return{text,anchor,range:r,rect:visual};
  }
  function resolve(article,anchor){
    if(!anchor||typeof anchor.exact!=='string'||!anchor.exact)return null;
    const list=blocks(article);
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
      const raw=visibleProjection(block).text;
      if(raw.slice(start,end)!==anchor.exact)return null;
      const sameBlock=anchor.blockHash&&hash(normalize(raw))===anchor.blockHash;
      if(!sameBlock&&!surroundingMatches(raw,start,end))return null;
      return makeRange(block,start,end);
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
      const raw=visibleProjection(block).text;
      const sameBlock=anchor.blockHash&&hash(normalize(raw))===anchor.blockHash;
      // Without a stable block ID, cross-block relocation is safe only when
      // the complete original block fingerprint and local context both agree.
      if(!stablePreferred&&!sameBlock)continue;
      let at=0;
      while((at=raw.indexOf(anchor.exact,at))!==-1){
        if(surroundingMatches(raw,at,at+anchor.exact.length)){
          const range=makeRange(block,at,at+anchor.exact.length);
          if(range)candidates.push(range);
        }
        at++;
      }
    }
    return candidates.length===1?candidates[0]:null;
  }
    function sameRange(a,b) {
      if(!a||!b)return false;
      try { return a.compareBoundaryPoints(Range.START_TO_START,b)===0
        && a.compareBoundaryPoints(Range.END_TO_END,b)===0; }
      catch(_) {return false;}
    }
    return Object.freeze({blocks,visibleProjection,capture,resolve,sameRange});
  })();
  window.GBReaderAnchors = GBReaderAnchors;

  function gbHighlightPath(item) {
    const raw = String(item && item.url || '');
    try { return new URL(raw, location.origin).pathname.replace(/\/+$/, '') || '/'; }
    catch { return raw.split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '') || '/'; }
  }
  function gbHighlightText(item) { return normalizeText(item && item.text).toLocaleLowerCase(); }
  /* Ключ фрагмента — страница + текст без контекста. По нему ищем запись,
     когда пользователь перекрашивает уже сохранённую цитату. */
  function gbFragmentKey(x) {
    const t = gbHighlightText(x);
    return !t ? '' : gbHighlightPath(x) + '\n' + t;
  }
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
  const MARK_COLOR_NAMES = { amber: 'янтарный', sage: 'шалфейный', blue: 'голубой', lime: 'лаймовый', rose: 'розовый' };

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
  async function storageCall(method,...args) {
    try {
      if(window.GBLibraryStorage?.version!==1)
        await import('/js/reader-library-storage.js?v=74af6e6a');
      const owner=window.GBLibraryStorage;
      if(owner?.version!==1||typeof owner[method]!=='function')return libraryFailure('lock-unavailable');
      return await owner[method](...args);
    } catch { return libraryFailure('lock-unavailable'); }
  }
  function mutateLibrary(keys,prepare) {return storageCall('mutateLibrary',keys,prepare);}
  function snapshotRaw() {return storageCall('snapshotRaw');}
  function restoreRaw(raw,shouldContinue) {return storageCall('restoreRaw',raw,shouldContinue);}
  function commit(key, guard, mutate) {
    return mutateLibrary([key], stores => {
      const current = stores[key], outcome = mutate(current, guard);
      if (!outcome || outcome.conflict) return { reason: 'conflict', current };
      if (outcome.reason) return { reason: outcome.reason, current };
      return { changes: { [key]: outcome.items }, result: { items: outcome.items } };
    });
  }
  // Restore only the deleted version and relationships that are still valid.
  // A conflict never rewinds a newer quote or note; detached copy is explicit.
  let recordTransactions, recordTransactionsLoad;
  async function transactionCall(method,...args) {
    try {
      if(!recordTransactions) {
        recordTransactionsLoad ||= import('/js/reader-library-record-transactions.js?v=1ba18bb9')
          .then(m=>m.createRecordTransactions({mutateLibrary,libraryFailure,gbHighlightKey,NOTES_KEY,QUOTES_KEY,LIMIT_NOTES,LIMIT_QUOTES}))
          .catch(error=>{recordTransactionsLoad=null;throw error});
        recordTransactions=await recordTransactionsLoad;
      }
      return await recordTransactions[method](...args);
    } catch { return libraryFailure('lock-unavailable'); }
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
  function fragment(text) {
    const words = normalizeText(text).split(/\s+/);
    return words.length <= 14 ? 'text=' + encodeURIComponent(text)
      : 'text=' + encodeURIComponent(words.slice(0, 6).join(' ')) + ',' + encodeURIComponent(words.slice(-6).join(' '));
  }
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
    const { before, after } = contextFromSelection(selection, text);
    const article = document.querySelector('article.article-body') || document.querySelector('article');
    const positional = article && GBReaderAnchors.capture(article);
    lastSelection = { text, anchor, url: location.href, before, after,
      positionalAnchor: positional && normalizeText(positional.text) === text ? positional.anchor : null };
    window.__ssLastText__ = text;
    window.__ssLastTextUrl__ = location.href;
  }
  function selection() {
    rememberSelection();
    return lastSelection.url === location.href ? lastSelection : { text: '', anchor: '', url: '' };
  }
  function sourceUrl(selected) {
    return location.origin + location.pathname + '#' +
      (selected.anchor ? encodeURIComponent(selected.anchor) : '') + ':~:' + fragment(selected.text);
  }
  // Both touch selection-bar notes and the native selection popup share
  // exactly one positional quote association. Text-only equivalence is never
  // sufficient: repeated words and old legacy links are ambiguous.
  function noteContextForSelection(selected) {
    if (!selected || selected.text.length < 8) return null;
    const context = { quoteText: selected.text, url: sourceUrl(selected), title: currentTitle() };
    if (!selected.positionalAnchor) return context;
    const article = document.querySelector('article.article-body') || document.querySelector('article');
    if (!article) return context;
    const exact = GBReaderAnchors.resolve(article, selected.positionalAnchor);
    if (!exact) return context;
    const here = gbHighlightPath({url:location.href});
    const matches = quotes().filter(item => {
      if (item.annotation?.version !== 1 || gbHighlightPath(item) !== here) return false;
      const stored = GBReaderAnchors.resolve(article, item.annotation.anchor);
      return stored && GBReaderAnchors.sameRange(exact, stored);
    });
    // Keep a useful unlinked note if this occurrence is new, legacy, or
    // ambiguous. Never assign a quoteId from a coincidental text match.
    if (matches.length === 1) {
      context.quoteId = matches[0].id;
      context.quoteSnapshot = JSON.stringify(matches[0]);
    }
    return context;
  }
  function uid(prefix) { return prefix + Date.now() + Math.random().toString(36).slice(2, 7); }


  let overlay, panel, list, fab, titleCount, search, sourceSelect, status, editor, textArea;
  let tab = 'all', filter = 'all', searchTerm = '', shown = BATCH_SIZE, opener = null;
  let expanded = new Set(), draft = null, pendingUndo = null;
  let presenter = null, presenterPromise = null, research = null;
  function loadPresenter() {
    if (presenter) return Promise.resolve(presenter);
    if (!presenterPromise) {
      presenterPromise = import('/js/reader-library-presenter.js?v=3acedc88')
        .then(async (module) => {
          const researchModule = await import('/js/reader-library-v3.js?v=d6fdb5cb');
          if (!research) research = researchModule.createLibraryResearch({
            overlay, getItems: all, notify: statusMessage, refresh: render, isOpen,
            renderItem: module.renderItem,
            exitForResume: (scrollToSavedPosition) => {
              close();
              // Wait until SiteUtils has lifted its original scroll lock and
              // restored the underlying page; do not create a second overlay.
              requestAnimationFrame(() => requestAnimationFrame(scrollToSavedPosition));
            },
          });
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
  stylesheet.href = '/css/highlights-runtime.css?v=571b8df5';
  if (!document.getElementById(stylesheet.id)) document.head.appendChild(stylesheet);

  function button(action, label, text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.libraryAction = action;
    b.setAttribute('aria-label', label);
    b.textContent = text;
    return b;
  }
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
  function undoQuotes(written, previous, message) {
    return async () => {
      const result = await mutateLibrary([QUOTES_KEY, NOTES_KEY], stores => {
        const current = stores[QUOTES_KEY];
        const matches = current.filter(item => item && String(item.id) === String(written.id));
        if (matches.length !== 1 || JSON.stringify(matches[0]) !== JSON.stringify(written))
          return { reason: 'conflict' };
        if (!previous && (written.annotation?.noteId != null || stores[NOTES_KEY].some(n => n?.quoteId != null && String(n.quoteId) === String(written.id))))
          return { reason: 'link-conflict' };
        return { changes: { [QUOTES_KEY]: previous
          ? current.map(x => x === matches[0] ? previous : x)
          : current.filter(x => x !== matches[0]) } };
      });
      if (!result.ok) {
        toast('Запись уже изменилась или недоступна. Отмена не выполнена.', { label: 'Повторить', run: undoQuotes(written, previous, message) });
        return;
      }
      paintMarks(); sync(); toast(message, null);
    };
  }

  function statusMessage(message, error) {
    if (!status) return;
    status.replaceChildren(element('span', '', message));
    status.classList.add('is-visible');
    status.classList.toggle('is-error', Boolean(error));
    clearTimeout(statusMessage.timer);
    statusMessage.timer = setTimeout(() => { if (!pendingUndo) status.classList.remove('is-visible'); }, 5000);
  }
  function create() {
    if (!document.body || document.getElementById('gb-hl-backdrop')) return;
    overlay = document.createElement('div');
    overlay.id = 'gb-hl-backdrop';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    overlay.innerHTML = [
      '<section id="gb-hl-panel" role="dialog" aria-modal="true" aria-labelledby="gb-hl-title" tabindex="-1">',
      '<div id="gb-hl-handle" aria-hidden="true"></div>',
      '<header id="gb-hl-header"><div class="gb-hl-heading"><span class="gb-hl-eyebrow">ЛИЧНОЕ СОБРАНИЕ <span id="gb-hl-count"></span></span>',
      '<h2 id="gb-hl-title">Моя библиотека</h2></div>',
      '<button type="button" id="gb-hl-export" aria-label="Скачать материалы библиотеки" title="Цитаты, заметки и ссылки в текстовом файле (.md)">↓ Скачать</button>',
      '<button type="button" id="gb-hl-close" aria-label="Закрыть библиотеку">' + closeSvg + '</button></header>',
      '<nav id="gb-hl-tabs" aria-label="Тип сохранений">',
      '<button type="button" data-library-tab="all" aria-pressed="true">Все</button>',
      '<button type="button" data-library-tab="source" aria-pressed="false">Источники</button>',
      '<button type="button" data-library-tab="quote" aria-pressed="false">Цитаты</button>',
      '<button type="button" data-library-tab="note" aria-pressed="false">Заметки</button>',
      '<button type="button" data-library-tab="favorite" aria-pressed="false">Статьи</button></nav>',
      '<div id="gb-hl-tools"><label id="gb-hl-searchwrap">' + searchSvg,
      '<input id="gb-hl-search" type="search" placeholder="Найти в сохранениях…" aria-label="Поиск по сохранениям" autocomplete="off"></label>',
      '<select id="gb-hl-source" aria-label="Фильтр по исходной статье"><option value="all">Все статьи</option></select></div>',
      '<div id="gb-hl-list" tabindex="0" aria-label="Сохранённые материалы"></div>',
      '<div id="gb-hl-status" role="status" aria-live="polite"></div>',
      '<form id="gb-hl-editor" hidden><label for="gb-hl-note-text">Личная заметка</label>',
      '<div id="gb-hl-note-context"></div><textarea id="gb-hl-note-text" rows="4" maxlength="16000" placeholder="Что вы хотите запомнить?"></textarea>',
      '<div class="gb-hl-editor-actions"><button type="button" id="gb-hl-note-cancel">Отмена</button>',
      '<button type="submit">Сохранить заметку</button></div></form>',
      '<footer id="gb-hl-foot"><button type="button" id="gb-hl-new-note">' + penSvg + ' Новая заметка</button></footer>',
      '</section>',
    ].join('');
    document.body.append(overlay);
    panel = overlay.querySelector('#gb-hl-panel');
    list = overlay.querySelector('#gb-hl-list');
    titleCount = overlay.querySelector('#gb-hl-count');
    search = overlay.querySelector('#gb-hl-search');
    sourceSelect = overlay.querySelector('#gb-hl-source');
    status = overlay.querySelector('#gb-hl-status');
    editor = overlay.querySelector('#gb-hl-editor');
    textArea = overlay.querySelector('#gb-hl-note-text');
    fab = document.createElement('button');
    fab.id = 'gb-hl-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Моя библиотека');
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-controls', 'gb-hl-panel');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = bookSvg + '<span id="gb-hl-fab-count" aria-hidden="true"></span>';
    document.body.append(fab);
    fab.classList.add('visible');
    fab.addEventListener('click', () => open(fab));
    overlay.querySelector('#gb-hl-close').addEventListener('click', close);
    overlay.querySelector('#gb-hl-export').addEventListener('click', async () => { try { (await loadPresenter()).exportMarkdown(all(), statusMessage); } catch { statusMessage('Не удалось подготовить экспорт. Повторите попытку.', true); } });
    overlay.querySelector('#gb-hl-new-note').addEventListener('click', () => showEditor());
    overlay.querySelector('#gb-hl-note-cancel').addEventListener('click', hideEditor);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#gb-hl-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-library-tab]');
      if (!b) return;
      tab = b.dataset.libraryTab; shown = BATCH_SIZE; render();
    });
    search.addEventListener('input', () => { searchTerm = normalizeText(search.value).toLocaleLowerCase(); shown = BATCH_SIZE; render(); });
    sourceSelect.addEventListener('change', () => { filter = sourceSelect.value; shown = BATCH_SIZE; render(); });
    list.addEventListener('click', listClick);
    editor.addEventListener('submit', saveNote);
    document.addEventListener('keydown', keydown);
    window.addEventListener('gb:favorites-changed', sync);
    window.addEventListener('gb:favorite-store-ready', sync);
    window.addEventListener('storage', (e) => { if ([QUOTES_KEY, NOTES_KEY, FAVORITES_KEY].includes(e.key)) sync(); });
    document.addEventListener('astro:page-load', () => { dock(); sync(); attachSelection(); });
    document.addEventListener('gb:mobile-fallback-ready', dock);
    window.addEventListener('resize', dock, { passive: true });
    attachSelection();
    dock();
    sync();
  }
  function keydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!editor.hidden) hideEditor();
      else if (!research?.handleEscape()) close();
    }
    else if (e.key === 'Tab' && presenter) presenter.trapTab(e, overlay);
  }
  function open(trigger) {
    if (!overlay) create();
    if (!overlay) return Promise.resolve(false);
    if (isOpen()) return Promise.resolve(true);
    opener = trigger || document.activeElement;
    tab = 'all'; filter = 'all'; searchTerm = ''; shown = BATCH_SIZE;
    search.value = '';
    list.replaceChildren(element('div', 'gb-hl-empty', 'Открываем библиотеку…'));
    overlay.removeAttribute('inert');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');
    if (window.SiteUtils && window.SiteUtils.lockScroll) window.SiteUtils.lockScroll('highlights');
    else document.body.classList.add('no-scroll');
    overlay.querySelector('#gb-hl-close').focus({ preventScroll: true });
    return loadPresenter().then(() => {
      if (isOpen()) render();
      return isOpen();
    }).catch(() => {
      if (isOpen()) list.replaceChildren(element('div', 'gb-hl-empty',
        'Не удалось открыть библиотеку. Проверьте подключение и попробуйте ещё раз.'));
      return false;
    });
  }
  function close() {
    if (!isOpen()) return;
    hideEditor(false);
    clearUndo();
    research?.resetMenu();
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    fab.setAttribute('aria-expanded', 'false');
    if (window.SiteUtils && window.SiteUtils.unlockScroll) window.SiteUtils.unlockScroll('highlights');
    else document.body.classList.remove('no-scroll');
    if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
  }
  function sync() { if (fab) { fab.classList.add('visible'); fab.querySelector('#gb-hl-fab-count').hidden = all().length === 0; fab.setAttribute('aria-label', 'Моя библиотека — сохранено ' + all().length); } if (isOpen()) render(); }
  let dockImpl, dockLoad, contextFromSelection = () => ({ before: '', after: '' });
  function dock() {
    if (!fab) return;
    if (dockImpl) return dockImpl(fab);
    dockLoad ||= import('/js/reader-library-dock.js?v=706a54b0')
      .then(m => { dockImpl = m.dockLibraryFab; contextFromSelection = m.contextFromSelection; dockImpl(fab); if (m.shouldWarmReading()) loadPresenter(); })
      .catch(() => { dockLoad = null; });
  }
  function render() {
    if (!list || !presenter) return;
    const items = all();
    research?.reconcileTopic?.(items);
    filter = presenter.renderList({
      list, items, titleCount, sourceSelect, overlay, tab, filter, searchTerm, shown, expanded, research,
    });
  }
  function listClick(e) {
    if (!presenter) return;
    presenter.handleLibraryClick(e, {
      quotes,GBReaderAnchors,statusMessage,close,hideToast,hide,all,expanded,deleteItem,clearUndo,showEditor,
      more: () => { shown += BATCH_SIZE; render(); },
      clearFilters: () => { searchTerm = ''; search.value = ''; filter = 'all'; research?.resetFilters(); shown = BATCH_SIZE; render(); },
    });
  }
  function showEditor(context = null, editing = null) {
    // The opened record itself is the version this editor may overwrite.
    draft = { context, editing, saving:false };
    textArea.readOnly = false;
    editor.hidden = false;
    panel.classList.add('is-editing');
    textArea.value = editing ? editing.text : '';
    overlay.querySelector('#gb-hl-note-context').textContent = context && context.quoteText
      ? 'К цитате: «' + context.quoteText.slice(0, 180) + '»'
      : editing && editing.quoteText ? 'К цитате: «' + editing.quoteText.slice(0, 180) + '»'
      : 'Мысли во время чтения';
    textArea.focus({ preventScroll: true });
  }
  function hideEditor(focus = true) {
    if (!editor) return;
    editor.hidden = true; draft = null; textArea.readOnly = false;
    panel.classList.remove('is-editing');
    if (focus) overlay.querySelector('#gb-hl-new-note').focus({ preventScroll: true });
  }
  async function saveNote(e) {
    e.preventDefault();
    const activeDraft=draft;
    if(!activeDraft||activeDraft.saving)return;
    const text = textArea.value.trim();
    if (!text) { statusMessage('Сначала напишите заметку.', true); return; }
    activeDraft.saving=true;
    textArea.readOnly=true;
    const context=activeDraft.context, editing=activeDraft.editing;
    const created = {
      id: uid('note'), text, ...(context?.quoteId != null ? {quoteId: context.quoteId} : {}), quoteText: context && context.quoteText || '',
      articleTitle: context && context.title || currentTitle(),
      url: context && context.url || location.origin + location.pathname,
      savedAt: Date.now(),
    };
    let result;
    try { result = await transactionCall('saveNoteRecord',{context,editing,created,text}); } catch { result={ok:false}; }
    finally {
      activeDraft.saving=false;
      if(draft===activeDraft)textArea.readOnly=false;
    }
    // A late save must never close or replace a newer editor.
    if(draft!==activeDraft)return;
    if (result.conflict && editing) {
      const live = result.current.find(x => x && String(x.id) === String(editing.id));
      statusMessage(live
        ? 'Заметка изменена в другом редакторе. Черновик не сохранён; скопируйте его перед повторным открытием заметки.'
        : 'Заметка удалена в другом редакторе. Черновик не сохранён; скопируйте его перед закрытием редактора.', true);
      return;
    }
    if (!result.ok) {
      const message = result.reason === 'capacity'
        ? 'Достигнут лимит заметок. Экспортируйте библиотеку перед удалением старых записей.'
        : result.reason === 'link-conflict'
          ? 'Цитата или её связь изменилась. Откройте её заново; черновик остаётся в редакторе.'
          : 'Не удалось безопасно сохранить заметку. Черновик остаётся в редакторе; повторите попытку.';
      statusMessage(message, true); return;
    }
    // Only the editor that initiated this completed save may be closed.
    applySavedNote(editing);
  }
  function applySavedNote(editing) {
    hideEditor(false);
    tab = 'note'; filter = 'all'; shown = BATCH_SIZE;
    render(); sync();
    statusMessage(editing ? 'Заметка обновлена.' : 'Заметка сохранена.');
  }
  function clearUndo() {
    if (pendingUndo) clearTimeout(pendingUndo.timer);
    pendingUndo = null;
    if (status) { status.replaceChildren(); status.classList.remove('is-visible'); }
  }
  async function deleteItem(item) {
    const deleted = await transactionCall('deleteRecord',item);
    if (!deleted.ok) {
      statusMessage(deleted.reason === 'duplicate'
        ? 'Найдено несколько версий этой записи. Сначала сохраните резервную копию библиотеки; удаление отменено.'
        : deleted.reason === 'partial-write'
          ? 'Ошибка удаления и восстановления связи. Экспортируйте текущие данные и проверьте библиотеку.'
          : 'Не удалось безопасно удалить запись. Обновите библиотеку и повторите.', true);
      return;
    }
    clearUndo();
    pendingUndo = deleted.receipt;
    render(); sync();
    const u = pendingUndo;
    let restoring = false;
    function showUndo(message, allowCopy = false) {
      if (pendingUndo !== u) return;
      const undoButton = button('undo', 'Отменить удаление', 'Отменить');
      const controls = [element('span', '', message), undoButton];
      undoButton.addEventListener('click', () => restore(false));
      if (allowCopy) {
        const copyButton = button('undo-copy', 'Сохранить удалённую версию с отдельным ID', 'Сохранить копию');
        copyButton.addEventListener('click', () => restore(true));
        controls.push(copyButton);
      }
      status.replaceChildren(...controls);
      status.classList.add('is-visible');
      status.classList.remove('is-error');
    }
    async function restore(copy) {
      if (pendingUndo !== u || restoring) return;
      restoring = true;
      clearTimeout(u.timer);
      const result = await restoreDeleted(u, copy ? uid(u.key === NOTES_KEY ? 'note' : 'quote') : null);
      restoring = false;
      if (pendingUndo !== u) { if (result.ok) { render(); sync(); } return; }
      if (result.ok) {
        clearUndo(); render(); sync();
        statusMessage(copy ? 'Версия сохранена отдельной копией без прежней связи.' : 'Запись восстановлена.');
        return;
      }
      const collision = ['id-collision','link-conflict'].includes(result.reason);
      const message = result.reason === 'capacity'
        ? 'Лимит библиотеки достигнут. Освободите место или сохраните экспорт.'
        : result.reason === 'partial-write'
          ? 'Ошибка восстановления. Сохраните экспорт и проверьте библиотеку.'
          : collision
            ? 'Запись или её связь уже изменилась. Можно сохранить отдельную копию без прежней связи.'
            : 'Восстановление не удалось. Повторите попытку.';
      showUndo(message, collision);
      u.timer = setTimeout(clearUndo, 30000);
    }
    showUndo('Запись удалена');
    pendingUndo.timer = setTimeout(clearUndo, 6000);
  }
  async function saveSelectedQuote() {
    const selected = selection();
    if (selected.text.length < 8) { statusMessage('Сначала выделите текст.', true); return false; }
    const record = {
      id: uid('quote'), text: selected.text, articleTitle: currentTitle(),
      url: sourceUrl(selected), before: selected.before, after: selected.after, savedAt: Date.now(),
    };
    // A quote is an occurrence, not merely its string. The same words may
    // appear twice in one paragraph; keep both positional sources. Do not
    // assign an annotation to a legacy record whose position is unknown.
    if (selected.positionalAnchor) {
      record.annotation = { version: 1, kind: 'quote',
        anchor: selected.positionalAnchor, noteId: null };
    }
    const result = await mutateLibrary([QUOTES_KEY, NOTES_KEY], stores => {
      const old = stores[QUOTES_KEY], key = gbHighlightKey(record);
      if (!key) return { reason: 'conflict' };
      const matches = old.filter(x => gbHighlightKey(x) === key);
      if (matches.length > 1) return { reason: 'duplicate' };
      if (matches.length === 1) return { changes: {}, result: { already: true } };
      if (old.length >= LIMIT_QUOTES) return { reason: 'capacity' };
      if (old.some(x => x && String(x.id) === String(record.id)) ||
          stores[NOTES_KEY].some(n => n?.quoteId != null && String(n.quoteId) === String(record.id)))
        return { reason: 'id-collision' };
      const next = gbAddHighlight(old, record);
      if (next === old) return { reason: 'conflict' };
      return { changes: { [QUOTES_KEY]: next } };
    });
    if (!result.ok) {
      statusMessage(result.reason === 'capacity'
        ? 'Сохранено 200 цитат — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.'
        : 'Не удалось безопасно сохранить цитату. Повторите попытку.', true);
      return false;
    }
    if (result.already) { statusMessage('Такая цитата уже сохранена.'); return true; }
    sync(); statusMessage('Цитата сохранена вместе с источником.');
    toast('Цитата сохранена', { label: 'Вернуть', run: undoQuotes(record, null, 'Цитата убрана') });
    return true;
  }
  function bindSelectionButton(id, label, icon, handler, popup) {
    if (popup.querySelector('#' + id)) return;
    const b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = icon + '<span>' + (id === 'ss-save' ? 'Сохранить' : 'Заметка') + '</span>';
    popup.append(b);
    b.addEventListener('click', handler);
  }
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
    if (!window.CSS || !CSS.highlights) return { supported: false, painted: 0, placed: new Set() };
    const scope = document.querySelector('article.article-body') || document.querySelector('article') || document.querySelector('main');
    if (!scope) return { supported: true, painted: 0, placed: new Set() };
    const index = textIndex(scope);
    const groups = new Map();
    const placed = new Set();
    const desktopW57 = document.body?.classList.contains('np-w57-ready')
      && !!document.querySelector('#npUResearch .np-u-right-scroll')
      && matchMedia('(min-width:1121px)').matches;
    let painted = 0;
    for (const item of quotes()) {
      if (gbHighlightPath(item) !== gbHighlightPath({url: location.href})) continue;
      const annotated = item?.annotation?.version === 1;
      if (annotated && desktopW57) continue;
      const color = String(item && (item.color || item.annotation?.color) || '');
      if (!MARK_COLORS.includes(color)) continue;
      const range = annotated
        ? GBReaderAnchors.resolve(scope, item.annotation.anchor) : locate(index, item);
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

  async function saveMarker(color) {
    const selected = selection();
    if (selected.text.length < 3) { statusMessage('Сначала выделите текст.', true); return false; }
    const nextColor = MARK_COLORS.includes(color) ? color : 'amber';
    const record = {
      id: uid('mark'), kind: 'marker', color: nextColor,
      text: selected.text, articleTitle: currentTitle(),
      url: sourceUrl(selected), before: selected.before, after: selected.after, savedAt: Date.now(),
    };
    if (selected.positionalAnchor) {
      record.annotation = { version:1,kind:'marker',color:nextColor,
        anchor:selected.positionalAnchor,noteId:null };
    }
    /* Одна запись на (страница + текст): иначе gbAddHighlight молча отбрасывал
       вторую запись, а пользователь видел «Помета сохранена». Здесь тот же
       текст перекрашивается, а одинаковый цвет честно сообщается как уже
       применённый — без ложного успеха. */
    const key = gbHighlightKey(record);
    const mutation = await mutateLibrary([QUOTES_KEY, NOTES_KEY], stores => {
      const old = stores[QUOTES_KEY];
      const fragment = gbFragmentKey(record);
      const context = gbContextKey(record);
      const article = document.querySelector('article.article-body') || document.querySelector('article');
      const exact = article && record.annotation
        ? GBReaderAnchors.resolve(article, record.annotation.anchor) : null;
      let legacyIndex = null;
      let existingIndex = -1;
      if (exact && article) {
        // A saved quote and its colored mark are ONE positional record. Reuse
        // its ID/anchor/noteId instead of losing the mark to duplicate-key
        // rejection. If legacy data already contains both, prefer the colored
        // record to avoid creating a second painter on the same DOM Range.
        const candidates = [];
        old.forEach((x, i) => {
          if (gbHighlightPath(x) !== gbHighlightPath(record)) return;
          const found = x.annotation?.version === 1
            ? GBReaderAnchors.resolve(article,x.annotation.anchor)
            : locate(legacyIndex ||= textIndex(article),x);
          if (GBReaderAnchors.sameRange(found, exact)) candidates.push(i);
        });
        existingIndex = candidates.find(i => Boolean(old[i].color || old[i].annotation?.color))
          ?? candidates[0] ?? -1;
      } else if (!record.annotation) {
        existingIndex = fragment ? old.findIndex((x) =>
          gbFragmentKey(x) === fragment && gbContextKey(x) === context) : -1;
      }

      if (existingIndex >= 0) {
        const existing = old[existingIndex];
        if (old.filter(x => x && String(x.id) === String(existing.id)).length !== 1)
          return { reason: 'duplicate' };
        if (String(existing.color || existing.annotation?.color || '') === nextColor)
          return { changes: {}, result: { already: true } };
        const updated = { ...existing, kind:'marker', color:nextColor,
          ...(existing.annotation?.version===1
            ? {annotation:{...existing.annotation,kind:'marker',color:nextColor}}
            : record.annotation ? {annotation:record.annotation} : {}) };
        return { changes: { [QUOTES_KEY]: old.map((x,i)=>i===existingIndex?updated:x) },
          result: { previous: existing, written: updated } };
      }
      if (old.length >= LIMIT_QUOTES) return { reason: 'capacity' };
      if (old.some(x => x && String(x.id) === String(record.id)) ||
          stores[NOTES_KEY].some(n => n?.quoteId != null && String(n.quoteId) === String(record.id)))
        return { reason: 'id-collision' };
      const next = gbAddHighlight(old, record);
      if (next === old) return { reason: 'conflict' };
      return { changes: { [QUOTES_KEY]: next }, result: { written: record } };
    });
    if (!mutation.ok) {
      statusMessage(mutation.reason === 'capacity'
        ? 'Сохранено 200 помет — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.'
        : 'Не удалось безопасно сохранить помету. Повторите попытку.', true);
      return false;
    }
    if (mutation.already) {
      statusMessage('Этот текст уже выделен этим цветом.');
      toast('Этот текст уже выделен этим цветом', null);
      return true;
    }
    if (mutation.previous) {
      const painted = paintMarks();
      sync();
      const wasMarker = mutation.previous.kind === 'marker';
      const storedKey = gbHighlightKey(mutation.written);
      const anchored = painted.supported && painted.placed && painted.placed.has(storedKey);
      const base = wasMarker ? 'Цвет пометы изменён' : 'Цитата выделена цветом';
      const message = !painted.supported
        ? (wasMarker ? 'Цвет пометы сохранён, подсветка недоступна' : 'Цвет сохранён, подсветка недоступна')
        : anchored ? base
          : (wasMarker ? 'Цвет пометы сохранён, но подсветить не удалось' : 'Цвет сохранён, но подсветить не удалось');
      statusMessage(message + '.');
      toast(message, { label: 'Вернуть', run: undoQuotes(mutation.written, mutation.previous, 'Цвет возвращён') });
      return true;
    }
    const result = paintMarks();
    sync();
    /* Честность сообщения: «подсвечена» говорим только если запись реально
       получила диапазон в тексте. Иначе пользователь видит успех при пустом
       экране (так было при выделении через границу абзацев). */
    const anchored = result.supported && result.placed && result.placed.has(key);
    const message = !result.supported
      ? 'Помета сохранена. Подсветка недоступна в этом браузере'
      : anchored
        ? 'Помета сохранена и подсвечена'
        : 'Помета сохранена, но этот фрагмент не удалось подсветить';
    statusMessage(message + (result.supported && !anchored ? '. Он останется в библиотеке.' : '.'));
    toast(message, { label: 'Вернуть', run: undoQuotes(record, null, 'Помета убрана') });
    return true;
  }

  /* mutateLibrary() публикует событие на window, поэтому слушаем именно window:
     удаление пометы через библиотеку обязано снять подсветку в тексте. */
  window.addEventListener('gb:library-committed', (e) => {
    if (!e || !e.detail || e.detail.key === QUOTES_KEY) setTimeout(paintMarks, 0);
  });
  window.addEventListener('storage', (e) => { if (e && e.key === QUOTES_KEY) paintMarks(); });
  window.addEventListener('resize', () => requestAnimationFrame(paintMarks), { passive:true });
  // Restore the correct face's annotations when a Gill bilingual original
  // opens/closes, including after a fresh reload with the original closed.
  document.addEventListener('toggle', (event) => {
    if (event.target instanceof HTMLDetailsElement &&
        event.target.matches('details.mq-translation-flip')) {
      requestAnimationFrame(paintMarks);
    }
  }, true);

  /* Мобильный вход в пометы. На страницах серий js/site.js не подключается,
     поэтому #selection-share-popup не существует: выделенный текст некуда
     сохранить, хотя сама библиотека предлагает «Выделите цитату…». Показываем
     собственный мини-тулбар только там, где нет W57-тулбара пилота (он живёт
     от 1121px и при выделении создаёт #npW57SelectionToolbar) — один владелец,
     одно хранилище, те же функции сохранения, что и у десктопного попапа. */
  function mobileSelectionBar() {
    let bar = document.getElementById('gb-hl-selbar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'gb-hl-selbar';
    bar.className = 'gb-hl-selbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Действия с выделенным текстом');
    bar.setAttribute('aria-hidden', 'true');
    const colors = document.createElement('div');
    colors.className = 'gb-hl-selbar-colors';
    colors.setAttribute('role', 'group');
    colors.setAttribute('aria-label', 'Цвет пометы');
    for (const color of MARK_COLORS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'gb-hl-selbar-swatch';
      swatch.dataset.hlColor = color;
      const colorName = MARK_COLOR_NAMES[color] || color;
      swatch.setAttribute('aria-label', 'Выделить цветом: ' + colorName);
      swatch.title = 'Выделить цветом: ' + colorName;
      colors.appendChild(swatch);
    }
    const quote = document.createElement('button');
    quote.type = 'button';
    quote.id = 'gb-hl-selbar-quote';
    quote.setAttribute('aria-label', 'Сохранить выделенный текст как цитату');
    quote.textContent = 'Цитата';
    const note = document.createElement('button');
    note.type = 'button';
    note.id = 'gb-hl-selbar-note';
    note.setAttribute('aria-label', 'Добавить заметку к выделенному тексту');
    note.textContent = 'Заметка';
    bar.append(colors, quote, note);
    colors.addEventListener('click', async (e) => {
      const swatch = e.target.closest('[data-hl-color]');
      if (!swatch) return;
      if (await saveMarker(swatch.dataset.hlColor)) dismissSelectionBar();
    });
    document.body.appendChild(bar);
    /* Pointerdown snapshots the selection without cancelling the native gesture.
       preventDefault on touchstart suppresses Chrome's compatibility click, so
       mobile swatch, Quote and Note taps must keep their default behavior.
       Cancelling mousedown preserves the text selection for mouse users. */
    for (const b of [quote, note, ...colors.querySelectorAll('button')]) {
      b.addEventListener('pointerdown', rememberSelection);
      b.addEventListener('mousedown', (event) => event.preventDefault(), { passive: false });
    }
    quote.addEventListener('click', async () => {
      if (await saveSelectedQuote()) {
        quote.textContent = 'Сохранено';
        clearTimeout(selBarHideTimer);
        selBarHideTimer = setTimeout(() => { quote.textContent = 'Цитата'; dismissSelectionBar(); }, 700);
      }
    });
    note.addEventListener('click', () => {
      const s = selection();
      const context = noteContextForSelection(s);
      hide();
      open(null).then((opened) => { if (opened) showEditor(context); });
    });
    return bar;
  }
  function hide() {
    const bar = document.getElementById('gb-hl-selbar');
    if (!bar) return;
    bar.dataset.open = 'false';
    bar.setAttribute('aria-hidden', 'true');
  }
  /* После действия выделение снимаем: если оставить его, следующий тап по тому
     же тексту Chrome трактует как перетаскивание уже выделенного фрагмента —
     mouseup не доходит, и тулбар для этого текста больше не открывается. */
  function collapseSelection() {
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
    } catch {}
  }
  function dismissSelectionBar() { hide(); collapseSelection(); }
  let selBarHideTimer = 0;
  function placeSelectionBar() {
    if (document.getElementById('npW57SelectionToolbar')) { hide(); return; }
    // A touchend can re-schedule this bar after the TOC trigger's pointerdown
    // hid it. Never project selection actions over an open reading sheet.
    if (document.querySelector('#partTocOverlay.is-open')) { hide(); return; }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hide(); return; }
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 8) { hide(); return; }
    const range = sel.getRangeAt(0);
    const host = range.commonAncestorContainer;
    const node = host.nodeType === 1 ? host : host.parentElement;
    if (!node || node.closest('#gb-hl-panel, #gb-hl-selbar, input, textarea, [contenteditable="true"]')) { hide(); return; }
    if (!node.closest('article, main, .article-body')) { hide(); return; }
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) { hide(); return; }
    const bar = mobileSelectionBar();
    /* Сброс «отложенного» скрытия: таймер от предыдущего действия не должен
       гасить тулбар, который только что открылся для нового выделения. */
    clearTimeout(selBarHideTimer);
    bar.dataset.open = 'true';
    bar.setAttribute('aria-hidden', 'false');
    const bw = bar.offsetWidth || 180;
    const bh = bar.offsetHeight || 56;
    const clampX = Math.min(Math.max(8, rect.left + rect.width / 2 - bw / 2), window.innerWidth - bw - 8);
    /* Нижняя панель читалки фиксирована и выше тулбара по z-index, поэтому
       при размещении под выделением её высоту нужно вычитать — иначе тулбар
       уезжает под панель и до кнопок не достать. */
    const bottomBar = document.querySelector('.mobile-bottom-bar, .gbs2-bbar');
    const bottomInset = bottomBar
      ? Math.max(0, Math.round(window.innerHeight - bottomBar.getBoundingClientRect().top)) : 0;
    const maxBottom = window.innerHeight - bottomInset - 8;
    let top = rect.top - bh - 10;
    if (top < 68) {
      top = rect.bottom + 10;
      if (top + bh > maxBottom) top = Math.max(68, rect.top - bh - 10);
      top = Math.min(top, maxBottom - bh);
    }
    bar.style.left = Math.round(clampX) + 'px';
    bar.style.top = Math.round(Math.max(8, top)) + 'px';
  }
  function attachSelection() {
    const popup = document.getElementById('selection-share-popup');
    if (!popup) {
      let pending = 0;
      const schedule = () => { clearTimeout(pending); pending = setTimeout(placeSelectionBar, 40); };
      document.addEventListener('selectionchange', schedule, { passive: true });
      document.addEventListener('mouseup', schedule, { passive: true });
      document.addEventListener('touchend', schedule, { passive: true });
      window.addEventListener('scroll', hide, { passive: true, capture: true });
      window.addEventListener('resize', hide, { passive: true });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
      document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('#gb-hl-selbar')) hide();
      }, { passive: true });
      // Sheet navigation supersedes the short-lived save confirmation. Keep
      // Undo in storage; only dismiss its transient toast and selection bar.
      document.addEventListener('click', (e) => {
        if (e.target.closest('#mobPartTocBtn, [data-gill-marginalia-open]')) { hide(); hideToast(); }
      }, true);
      return;
    }
    if (popup.querySelector('#ss-save')) return;
    popup.append(element('span', 'ss-sep'));
    bindSelectionButton('ss-save', 'Сохранить выделенный текст как цитату', quoteSvg, async () => {
      if (await saveSelectedQuote()) {
        const label = popup.querySelector('#ss-save span');
        if (label) label.textContent = 'Сохранено';
        popup.classList.add('gb-hl-selection-saved');
        setTimeout(() => {
          if (label && label.isConnected) label.textContent = 'Сохранить';
          popup.classList.remove('gb-hl-selection-saved', 'ss-visible');
          popup.setAttribute('aria-hidden', 'true');
        }, 660);
      }
    }, popup);
    bindSelectionButton('ss-note', 'Добавить заметку к выделенному тексту', penSvg, () => {
      const s = selection();
      const context = noteContextForSelection(s);
      popup.classList.remove('ss-visible');
      popup.setAttribute('aria-hidden', 'true');
      open(document.getElementById('ss-note')).then((opened) => { if (opened) showEditor(context); });
    }, popup);
  }
  document.addEventListener('mouseup', () => setTimeout(rememberSelection, 25));
  document.addEventListener('touchend', () => setTimeout(rememberSelection, 60), { passive: true });
  document.addEventListener('selectionchange', rememberSelection);
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
    setTimeout(paintMarks, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
