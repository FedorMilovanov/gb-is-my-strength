/* One on-demand visible-prose, anchor and native-paint owner. */
export function createRangeRuntime({normalizeText,quotes,gbHighlightPath,gbHighlightKey,MARK_COLORS,cancelScheduledPaint}) {
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
  function visibleProjection(block, legacy = false){
    const segments=[],cached=new WeakMap(),faces=new WeakMap();
    const bilingual=block.matches('.manuscript-quote--bilingual')?block:null;
    function originalOpen(host){
      if(!faces.has(host))faces.set(host,!!host.querySelector('details.mq-translation-flip[open]'));
      return faces.get(host);
    }
    const ignored=el=>{
      if(!el)return false;
      if(cached.has(el))return cached.get(el);
      // A bilingual quote is one authored block with two mutually exclusive
      // reading faces. Never capture the toggle label or the hidden language
      // as positional prose, even when UA details styles report display:block.
      const host=bilingual||el.closest('.manuscript-quote--bilingual');
      const inactiveFace=host&&(
        !!el.closest('.mq-translation-toggle') ||
        !!el.closest(originalOpen(host)?'.mq-translation-russian':'.mq-translation-original')
      );
      let excluded=inactiveFace || el.matches('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"],[role="tooltip"]') ||
        (legacy&&el.matches('script,style,textarea,input,#gb-hl-panel,#gb-hl-selbar'));
      const parent=el.parentElement;
      // The root and its ancestors must also be visible. Closed native
      // details hide all direct children except their first summary even
      // where computedStyle still reports normal display/visibility.
      if(!excluded&&parent?.matches('details:not([open])'))
        excluded=el!==parent.querySelector(':scope > summary');
      if(!excluded){
        const style=getComputedStyle(el);
        excluded=style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||ignored(parent);
      }
      cached.set(el,excluded);return excluded;
    };
    if(ignored(block))return{text:'',segments};
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    let text='',node;
    while((node=walker.nextNode())){
      if(!node.nodeValue||(legacy&&!node.nodeValue.trim())||ignored(node.parentElement))continue;
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
    try {
      const r=document.createRange();
      r.setStart(from.node,start-from.start);
      r.setEnd(to.node,end-to.start);
      return r;
    } catch { return null; }
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
    return Object.freeze({blocks,visibleProjection,makeRange,capture,resolve,resolution,sameRange,selectionContext});
  })();

  /* Цветные пометы: одно хранилище (gb-highlights-v1), один владелец.
     Запись — обычная цитата плюс kind:'marker' и color. Рисуем через
     CSS Custom Highlight API: текст статьи не оборачивается в <mark>, разметка
     не мутируется, поэтому аннотации не ломают якоря, озвучку и поиск.
     Если браузер не поддерживает ::highlight() — помета всё равно сохраняется
     и видна в библиотеке, просто не подсвечивается в тексте. */
  // Legacy records use the same visible prose as positional anchors, but
  // retain their original whitespace-only-node exclusion and text search.
  function textIndex(scope) {
    return GBReaderAnchors.visibleProjection(scope,true);
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
      const prefix=tolerantPattern(before),suffix=tolerantPattern(after);
      const expression = new RegExp('(' + (prefix?prefix+'\\s*':'') + ')(' + pattern + ')' + (suffix?'\\s*'+suffix:''), 'ig');
      match = expression.exec(index.text);
      if (match) {
        // Non-overlapping RegExp iteration misses a second occurrence that
        // begins inside the first match. Such a legacy anchor is ambiguous.
        expression.lastIndex=match.index+1;
        if(expression.exec(index.text))return null;
      }
    }
    catch { return null; }
    if (!match) return null;
    const start=match.index+match[1].length;
    return GBReaderAnchors.makeRange(index,start,start+match[2].length);
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


  return Object.freeze({GBReaderAnchors, textIndex, locate, paintMarks});
}
