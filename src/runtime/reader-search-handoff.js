/* W121/W123: source-word handoff for the canonical Pagefind command palette.
   Search remains owned by js/search.js. Exact literal hits focus their prose;
   unresolved morphology gets an honest, validated article-level fallback.
   No second modal, parser or index. */
const KEY='gb-reader-pagefind-hit-v1';
const norm=value=>String(value||'').toLocaleLowerCase('ru').replaceAll('ё','е');
function targetArticle(){
 return document.querySelector('article.article-body')||document.querySelector('article[data-pagefind-body]');
}
function selectedDestinationPath(palette,clickedItem){
 const selected=palette?.querySelector('#cp-listbox .cp-item[aria-selected="true"]');
 if(!selected||(clickedItem&&selected.dataset.idx!==clickedItem.dataset.idx))return '';
 const link=palette.querySelector('#cp-read-btn');
 const href=link?.getAttribute('href')||link?.href;
 if(!href||href==='#')return '';
 try{
  const target=new URL(href,location.href);
  return target.origin===location.origin?target.pathname:'';
 }catch(_){return '';}
}
function clearHandoff(){try{sessionStorage.removeItem(KEY)}catch(_){}}
function locate(query){
 const article=targetArticle();if(!article)return false;
 const needle=norm(query.trim());if(needle.length<2||needle.length>120)return false;
 for(const block of article.querySelectorAll('p,li,blockquote')){
  if(block.closest('nav,aside,footer,.related-articles,.faq-accordion,#gbAnalyticsStudy'))continue;
  if(!block.getClientRects().length)continue;
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
  const segments=[];let value='',node;
  while((node=walker.nextNode())){
   const parent=node.parentElement;
   if(!parent||parent.closest('.gtip,.btip,.tooltip,script,style,[hidden],[inert],[aria-hidden="true"],[data-reader-exclude]'))continue;
   if(getComputedStyle(parent).display==='none'||getComputedStyle(parent).visibility==='hidden')continue;
   const text=node.nodeValue||'';if(!text)continue;
   const start=value.length;value+=text;
   segments.push({node,start,end:value.length});
  }
  const at=norm(value).indexOf(needle);if(at<0)continue;
  const from=segments.find(s=>s.start<=at&&at<s.end);
  const to=segments.find(s=>s.start<at+needle.length&&at+needle.length<=s.end);
  if(!from||!to)continue;
  const range=document.createRange();range.setStart(from.node,at-from.start);range.setEnd(to.node,at+needle.length-to.start);
  block.scrollIntoView({block:'center',behavior:'auto'});
  if(!block.hasAttribute('tabindex')){
   block.setAttribute('tabindex','-1');
   block.addEventListener('blur',()=>block.removeAttribute('tabindex'),{once:true});
  }
  block.focus({preventScroll:true});
  const selection=window.getSelection();
  if(selection){selection.removeAllRanges();selection.addRange(range);}
  return true;
 }
 return false;
}
function focusArticleFallback(article){
 const root=article?.closest('main')||article;
 const heading=article?.querySelector('h1')||root?.querySelector('h1');
 if(!(heading instanceof HTMLElement)||!root?.contains(heading)||!heading.getClientRects().length)return false;
 if(!heading.hasAttribute('tabindex')){
  heading.setAttribute('tabindex','-1');
  heading.addEventListener('blur',()=>heading.removeAttribute('tabindex'),{once:true});
 }
 heading.scrollIntoView({block:'start',behavior:'auto'});
 window.getSelection()?.removeAllRanges();
 heading.focus({preventScroll:true});
 return document.activeElement===heading;
}
function fallback(entry,reason,article){
 clearHandoff();
 let fallbackFocused=false;
 if(reason==='literal-occurrence-not-found'){
  // Pagefind may attach a heading fragment to an excerpt. Morphology is not
  // evidence for that exact location, so keep the article route but clear it.
  try{
   if(location.hash&&typeof history!=='undefined'&&typeof history.replaceState==='function'){
    const unanchored=new URL(location.href);
    unanchored.hash='';
    history.replaceState(history.state,'',unanchored.href);
   }
  }catch(_){}
  try{fallbackFocused=focusArticleFallback(article)}catch(_){}
 }
 document.dispatchEvent(new CustomEvent('gb:search-source-fallback',{detail:{
  query:entry.query,path:location.pathname,targetPath:entry.path,reason,fallbackFocused
 }}));
}
function consume(){
 let entry;try{entry=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){}
 if(!entry)return;
 const age=Date.now()-Number(entry.timestamp);
 const valid=typeof entry.query==='string'&&entry.query.trim().length>=2&&entry.query.trim().length<=120&&
  Number.isFinite(Number(entry.timestamp))&&age>=0&&age<20000&&typeof entry.path==='string'&&
  entry.path.startsWith('/')&&!entry.path.startsWith('//')&&entry.path.length<=2048;
 if(!valid){clearHandoff();return;}
 let targetPath='';
 try{
  const target=new URL(entry.path,location.href);
  if(target.origin===location.origin)targetPath=target.pathname;
 }catch(_){}
 // A stale or mismatched one-shot must never be replayed on another page.
 if(!targetPath||targetPath!==location.pathname){clearHandoff();return;}
 const article=targetArticle();
 if(!article){fallback(entry,'article-root-not-found',null);return;}
 // Results from W57 must not silently revert to the old desktop Reader.
 // Pagefind's canonical result URLs omit this local opt-in, so restore it
 // once on the validated destination before exact or article-level focus.
 if(entry.pilot && new URLSearchParams(location.search).get('reader-pilot')!=='1' &&
    /^(?:\/articles\/|\/baptisty-rossii\/|\/biografii\/)/.test(location.pathname)){
   const url=new URL(location.href);
   url.searchParams.set('reader-pilot','1');
   if(entry.paper==='space'||entry.paper==='book')url.searchParams.set('paper',entry.paper);
   if(entry.panel==='open'||entry.panel==='closed')url.searchParams.set('panel',entry.panel);
   location.replace(url.href);return;
 }
 let focused=false;
 try{focused=locate(entry.query)}catch(_){}
 if(focused){
  clearHandoff();
  document.dispatchEvent(new CustomEvent('gb:search-source-focused',{detail:{query:entry.query,path:location.pathname}}));
 }else{
  fallback(entry,'literal-occurrence-not-found',article);
 }
}
function init(){
 function captureResult(clickedItem){
  const palette=document.querySelector('.cp-backdrop.is-open');
  const query=palette?.querySelector('.cp-input')?.value?.trim();
  clearHandoff();
  if(!query||query.length<2||query.length>120)return;
  const path=selectedDestinationPath(palette,clickedItem);
  if(!path)return;
  const params=new URLSearchParams(location.search);
  try{sessionStorage.setItem(KEY,JSON.stringify({
    query,path,timestamp:Date.now(),pilot:params.get('reader-pilot')==='1',
    paper:params.get('paper'),panel:params.get('panel')
  }))}catch(_){}
  // The result owner navigates; consume only on the validated destination.
 }
 document.addEventListener('click',event=>{
  const result=event.target.closest?.('.cp-backdrop.is-open #cp-listbox .cp-item');
  if(!result)return;
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey){clearHandoff();return;}
  captureResult(result);
 },true);
 // The canonical palette activates results with Enter directly from its input,
 // not by firing a click on the selected result. Keep keyboard parity.
 document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  if(!document.activeElement?.matches?.('.cp-backdrop.is-open .cp-input,.cp-backdrop.is-open #cp-listbox .cp-item'))return;
  if(!document.querySelector('.cp-backdrop.is-open #cp-listbox .cp-item[aria-selected="true"]'))return;
  captureResult();
 },true);
 consume();
 window.addEventListener('pageshow',consume);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();