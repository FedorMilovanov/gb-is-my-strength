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
  const blocks=(article)=>[...article.querySelectorAll('p,li,blockquote')]
    .filter(e=>!e.closest('.np-u-central-overview,.np-u-central-contents,.gill-card,figcaption,.np-u-series-disclosure')&&
      normalize(e.textContent).length>=6);
  function chooseBlock(node,article){
    const el=node?.nodeType===1?node:node?.parentElement;
    const parent=el?.closest('p,li,blockquote');
    return parent&&article.contains(parent)?parent:null;
  }
  // Source coordinates refer only to VISIBLE authored prose, not inline
  // glossary popovers hidden inside the published article's DOM.
  function visibleProjection(block){
    const segments=[],cached=new WeakMap();
    const ignored=el=>{
      if(!el||el===block)return false;
      if(cached.has(el))return cached.get(el);
      const excluded=el.matches('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"],[role="tooltip"]') ||
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
    return key&&!unique.some(x=>gbHighlightKey(x)===key)
      ?[item,...unique].slice(0,LIMIT_QUOTES):unique;
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
  function write(key, items) {
    try { localStorage.setItem(key, JSON.stringify(items)); }
    catch { return false; }
    // storage only reaches other documents; same-tab readers need a commit signal.
    window.dispatchEvent(new CustomEvent('gb:library-committed', { detail: { key } }));
    return true;
  }
  function quotes() {
    return read(QUOTES_KEY);
  }
  function notes() { return read(NOTES_KEY).filter((n) => n && typeof n.text === 'string' && n.id); }
  function favorites() {
    const store = window.GBFavoriteStore;
    return store && typeof store.list === 'function' ? store.list({ persistMigration: false }) : read(FAVORITES_KEY);
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
      type: 'quote',
      /* kind/color доносим до списка: иначе помета выглядит как цитата
         и цвет в библиотеке не виден (P2). */
      kind: (x.kind === 'marker' || x.annotation?.kind === 'marker') ? 'marker' : 'quote',
      color: MARK_COLORS.includes(String(x.color || x.annotation?.color || '')) ? String(x.color || x.annotation?.color) : '',
      text: String(x.text || ''), before: String(x.before || ''), after: String(x.after || ''),
      title: String(x.articleTitle || 'Статья'), url: localUrl(x.url), savedAt: Number(x.savedAt) || 0,
    }));
    const n = notes().map((x) => ({ id: String(x.id), type: 'note', text: String(x.text || ''), quoteText: String(x.quoteText || ''), title: String(x.articleTitle || 'Статья'), url: localUrl(x.url), savedAt: Number(x.savedAt) || 0 }));
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
  function uid(prefix) { return prefix + Date.now() + Math.random().toString(36).slice(2, 7); }


  let overlay, panel, list, fab, titleCount, search, sourceSelect, status, editor, textArea;
  let tab = 'all', filter = 'all', searchTerm = '', shown = BATCH_SIZE, opener = null;
  let expanded = new Set(), draft = null, pendingUndo = null;
  let presenter = null, presenterPromise = null, research = null;
  function loadPresenter() {
    if (presenter) return Promise.resolve(presenter);
    if (!presenterPromise) {
      presenterPromise = import('/js/reader-library-presenter.js?v=841cc1c0')
        .then(async (module) => {
          presenter = module;
          const researchModule = await import('/js/reader-library-v3.js?v=071c8c26');
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
          return module;
        })
        .catch((error) => { presenterPromise = null; throw error; });
    }
    return presenterPromise;
  }
  const stylesheet = document.createElement('link');
  stylesheet.id = 'gbHlRuntimeCss';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/css/highlights-runtime.css?v=8b751654';
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
    return () => {
      const current = read(QUOTES_KEY);
      const index = current.findIndex(item => item.id === written.id);
      if (index < 0 || JSON.stringify(current[index]) !== JSON.stringify(written)) {
        toast('Запись уже изменилась. Отмена недоступна.', null);
        return;
      }
      if (previous) current[index] = previous;
      else current.splice(index, 1);
      if (!write(QUOTES_KEY, current)) { toast('Не удалось отменить запись.', null); return; }
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
      '<button type="button" id="gb-hl-export" aria-label="Экспорт библиотеки в Markdown">↓ Markdown</button>',
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
    overlay.querySelector('#gb-hl-export').addEventListener('click', () => presenter.exportMarkdown(all(), statusMessage));
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
    filter = presenter.renderList({
      list, items: all(), titleCount, sourceSelect, overlay, tab, filter, searchTerm, shown, expanded, research,
    });
  }
  function listClick(e) {
    const b = e.target.closest('[data-library-action]');
    if (!b) return;
    const action = b.dataset.libraryAction;
    if (action === 'more') { shown += BATCH_SIZE; render(); return; }
    if (action === 'clear-filters') { searchTerm = ''; search.value = ''; filter = 'all'; research?.resetFilters(); shown = BATCH_SIZE; render(); return; }
    const card = b.closest('.gb-hl-item');
    if (!card) return;
    const item = all().find((x) => x.id === card.dataset.id && x.type === card.dataset.type);
    if (!item) return;
    if (action === 'expand') {
      const key = item.type + ':' + item.id, full = !expanded.has(key);
      if (full) expanded.add(key); else expanded.delete(key);
      card.querySelector('.gb-hl-quote').classList.toggle('is-collapsed', !full);
      b.setAttribute('aria-expanded', String(full));
      b.textContent = full ? 'Свернуть' : 'Читать полностью';
    }
    if (action === 'delete') deleteItem(item);
    if (action === 'remove-favorite') { clearUndo(); presenter.removeFavorite(item, statusMessage); }
    if (action === 'edit-note') showEditor(null, item);
    if (action === 'note-for-quote') showEditor({ quoteId: item.id, quoteText: item.text, title: item.title, url: item.url });
    if (action === 'card') presenter.exportQuoteCard(item, statusMessage);
  }
  function showEditor(context = null, editing = null) {
    draft = { context, editing };
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
    editor.hidden = true; draft = null;
    panel.classList.remove('is-editing');
    if (focus) overlay.querySelector('#gb-hl-new-note').focus({ preventScroll: true });
  }
  function saveNote(e) {
    e.preventDefault();
    const text = textArea.value.trim();
    if (!text) { statusMessage('Сначала напишите заметку.', true); return; }
    const old = notes(), context = draft && draft.context, editing = draft && draft.editing;
    if (editing) {
      const current = old.find((x) => String(x.id) === editing.id);
      if (!current || current.text !== editing.text) {
        statusMessage(current
          ? 'Заметка изменена в другом редакторе. Черновик не сохранён; скопируйте его перед повторным открытием заметки.'
          : 'Заметка удалена в другом редакторе. Черновик не сохранён; скопируйте его перед закрытием редактора.', true);
        return;
      }
    }
    if (!editing && old.length >= LIMIT_NOTES) {
      statusMessage('Достигнут лимит заметок. Экспортируйте библиотеку перед удалением старых записей.', true);
      return;
    }
    const next = editing
      ? old.map((x) => x.id === editing.id ? Object.assign({}, x, { text }) : x)
      : [{
          id: uid('note'), text, ...(context?.quoteId ? {quoteId: context.quoteId} : {}), quoteText: context && context.quoteText || '',
          articleTitle: context && context.title || currentTitle(),
          url: context && context.url || location.origin + location.pathname,
          savedAt: Date.now(),
        }].concat(old);
    if (!write(NOTES_KEY, next)) {
      statusMessage('Не удалось сохранить заметку. Проверьте доступное место в браузере.', true); return;
    }
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
  function deleteItem(item) {
    const key = item.type === 'note' ? NOTES_KEY : QUOTES_KEY;
    const old = item.type === 'note' ? notes() : quotes();
    const matches = old.filter((x) => String(x.id) === item.id);
    // Old/corrupt backups can already contain collisions. Never remove
    // every version of an ID merely because one visible card was clicked.
    if (matches.length > 1) {
      statusMessage('Найдено несколько версий этой записи. Сначала сохраните резервную копию библиотеки; удаление отменено.', true);
      return;
    }
    const index = old.findIndex((x) => String(x.id) === item.id);
    if (index < 0) return;
    if (!write(key, old.filter((x) => String(x.id) !== item.id))) {
      statusMessage('Не удалось удалить запись.', true); return;
    }
    clearUndo();
    pendingUndo = { key, entry: old[index], index };
    render(); sync();
    const undoButton = button('undo', 'Отменить удаление', 'Отменить');
    status.replaceChildren(element('span', '', 'Запись удалена'), undoButton);
    status.classList.add('is-visible');
    undoButton.addEventListener('click', () => {
      if (!pendingUndo) return;
      const u = pendingUndo, items = read(u.key);
      const limit = u.key === NOTES_KEY ? LIMIT_NOTES : LIMIT_QUOTES;
      const taken = items.some((x) => String(x.id) === String(u.entry.id));
      if (taken) {
        // Another tab may import/recreate this ID while Undo is available.
        // Preserve both versions: never splice a duplicate ID or overwrite.
        const copyButton = button('undo-copy', 'Сохранить удалённую версию с отдельным ID', 'Сохранить копию');
        status.replaceChildren(
          element('span', '', 'Запись с таким ID уже есть. Для сохранения обеих версий выберите копию.'),
          copyButton
        );
        status.classList.add('is-visible');
        clearTimeout(u.timer);
        u.timer = setTimeout(clearUndo, 30000);
        copyButton.addEventListener('click', () => {
          if (pendingUndo !== u) return;
          const latest = read(u.key);
          if (latest.length >= limit) {
            statusMessage('Лимит библиотеки достигнут. Экспортируйте данные до восстановления.', true);
            return;
          }
          let newId = uid(u.key === NOTES_KEY ? 'note' : 'quote');
          while (latest.some((x) => String(x.id) === newId)) {
            newId = uid(u.key === NOTES_KEY ? 'note' : 'quote');
          }
          const preserved = { ...u.entry, id: newId, savedAt: Date.now() };
          latest.splice(Math.min(u.index, latest.length), 0, preserved);
          if (!write(u.key, latest)) {
            statusMessage('Не удалось сохранить копию. Данные другой вкладки не изменены.', true);
            return;
          }
          clearUndo(); render(); sync();
          statusMessage('Обе версии сохранены с разными ID. Проверьте связи заметок и цитат.');
        });
        return;
      }
      if (items.length >= limit) {
        statusMessage('Лимит библиотеки достигнут. Экспортируйте данные до восстановления.', true);
        return;
      }
      items.splice(Math.min(u.index, items.length), 0, u.entry);
      if (!write(u.key, items)) {
        statusMessage('Не удалось восстановить запись.', true); return;
      }
      clearUndo(); render(); sync(); statusMessage('Запись восстановлена.');
    });
    pendingUndo.timer = setTimeout(clearUndo, 6000);
  }
  function saveSelectedQuote() {
    const selected = selection();
    if (selected.text.length < 8) { statusMessage('Сначала выделите текст.', true); return false; }
    const old = quotes(), record = {
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
    if (old.length >= LIMIT_QUOTES && !old.some((x) => gbHighlightKey(x) === gbHighlightKey(record))) {
      statusMessage('Сохранено 200 цитат — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.', true);
      return false;
    }
    const next = gbAddHighlight(old, record);
    if (next.length === old.length && next.every((x, i) => x === old[i])) {
      statusMessage('Такая цитата уже сохранена.'); return true;
    }
    if (!write(QUOTES_KEY, next)) {
      statusMessage('Не удалось сохранить цитату. Хранилище недоступно или заполнено.', true);
      return false;
    }
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

  function saveMarker(color) {
    const selected = selection();
    if (selected.text.length < 3) { statusMessage('Сначала выделите текст.', true); return false; }
    const old = quotes();
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
      const existing = old[existingIndex] || {};
      if (String(existing.color || existing.annotation?.color || '') === nextColor) {
        statusMessage('Этот текст уже выделен этим цветом.');
        toast('Этот текст уже выделен этим цветом', null);
        return true;
      }
      const next = old.slice();
      next[existingIndex] = {
        ...existing,kind:'marker',color:nextColor,
        ...(existing.annotation?.version===1
          ? {annotation:{...existing.annotation,kind:'marker',color:nextColor}}
          : record.annotation ? {annotation:record.annotation} : {}),
      };
      if (!write(QUOTES_KEY, next)) {
        statusMessage('Не удалось изменить цвет пометы. Хранилище недоступно.', true);
        return false;
      }
      const painted = paintMarks();
      sync();
      const wasMarker = existing.kind === 'marker';
      const storedKey = gbHighlightKey(next[existingIndex]);
      const anchored = painted.supported && painted.placed && painted.placed.has(storedKey);
      const base = wasMarker ? 'Цвет пометы изменён' : 'Цитата выделена цветом';
      const message = !painted.supported
        ? (wasMarker ? 'Цвет пометы сохранён, подсветка недоступна' : 'Цвет сохранён, подсветка недоступна')
        : anchored
          ? base
          : (wasMarker ? 'Цвет пометы сохранён, но подсветить не удалось' : 'Цвет сохранён, но подсветить не удалось');
      statusMessage(message + '.');
      toast(message, { label: 'Вернуть', run: undoQuotes(next[existingIndex], existing, 'Цвет возвращён') });
      return true;
    }
    if (old.length >= LIMIT_QUOTES && !old.some((x) => gbHighlightKey(x) === gbHighlightKey(record))) {
      statusMessage('Сохранено 200 помет — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.', true);
      return false;
    }
    const next = gbAddHighlight(old, record);
    // A positional collision that cannot be resolved must never be reported
    // as successful storage/painting, or silently rewrite the old record.
    if (next === old) {
      statusMessage('Помета не создана: сохранённая запись имеет тот же якорь, но её позиция не подтверждена.', true);
      return false;
    }
    if (!write(QUOTES_KEY, next)) {
      statusMessage('Не удалось сохранить помету. Хранилище недоступно или заполнено.', true);
      return false;
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

  /* write() публикует событие на window, поэтому слушаем именно window:
     удаление пометы через библиотеку обязано снять подсветку в тексте. */
  window.addEventListener('gb:library-committed', (e) => {
    if (!e || !e.detail || e.detail.key === QUOTES_KEY) setTimeout(paintMarks, 0);
  });
  window.addEventListener('storage', (e) => { if (e && e.key === QUOTES_KEY) paintMarks(); });
  window.addEventListener('resize', () => requestAnimationFrame(paintMarks), { passive:true });

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
    colors.addEventListener('click', (e) => {
      const swatch = e.target.closest('[data-hl-color]');
      if (!swatch) return;
      if (saveMarker(swatch.dataset.hlColor)) dismissSelectionBar();
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
    quote.addEventListener('click', () => {
      if (saveSelectedQuote()) {
        quote.textContent = 'Сохранено';
        clearTimeout(selBarHideTimer);
        selBarHideTimer = setTimeout(() => { quote.textContent = 'Цитата'; dismissSelectionBar(); }, 700);
      }
    });
    note.addEventListener('click', () => {
      const s = selection();
      const context = s.text.length >= 8
        ? { quoteText: s.text, url: sourceUrl(s), title: currentTitle() } : null;
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
    bindSelectionButton('ss-save', 'Сохранить выделенный текст как цитату', quoteSvg, () => {
      if (saveSelectedQuote()) {
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
      const context = s.text.length >= 8
        ? { quoteText: s.text, url: sourceUrl(s), title: currentTitle() } : null;
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
    libraryVersion: 2, open, close, getAll: quotes,
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
