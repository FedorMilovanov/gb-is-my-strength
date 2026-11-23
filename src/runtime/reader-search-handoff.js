/* W121/W123: source-word handoff for the canonical Pagefind command palette.
   The search UI remains owned by js/search.js; this adapter only focuses the
   clicked occurrence within the published Reader prose. No new modal/index. */
const KEY='gb-reader-pagefind-hit-v1';
const norm=value=>String(value||'').toLocaleLowerCase('ru').replaceAll('ё','е');
function targetArticle(){
 return document.querySelector('article.article-body')||document.querySelector('article[data-pagefind-body]');
}
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
function consume(){
 let entry;try{entry=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){}
 if(!entry)return;
 const valid=typeof entry.query==='string'&&Date.now()-entry.timestamp<20000;
 if(!valid){sessionStorage.removeItem(KEY);return;}
 // Results from W57 must not silently revert to the old desktop Reader.
 // Pagefind's canonical result URLs omit this local opt-in, so restore it
 // once on the destination before focusing the exact source paragraph.
 if(entry.pilot && new URLSearchParams(location.search).get('reader-pilot')!=='1' &&
    /^(?:\/articles\/|\/baptisty-rossii\/|\/biografii\/)/.test(location.pathname)){
   const url=new URL(location.href);
   url.searchParams.set('reader-pilot','1');
   if(entry.paper==='space'||entry.paper==='book')url.searchParams.set('paper',entry.paper);
   if(entry.panel==='open'||entry.panel==='closed')url.searchParams.set('panel',entry.panel);
   location.replace(url.href);return;
 }
 if(locate(entry.query)){
  sessionStorage.removeItem(KEY);
  document.dispatchEvent(new CustomEvent('gb:search-source-focused',{detail:{query:entry.query,path:location.pathname}}));
 }
}
function init(){
 function captureResult(){
  const query=document.querySelector('.cp-backdrop.is-open .cp-input')?.value?.trim();
  if(!query||query.length<2||query.length>120)return;
  const params=new URLSearchParams(location.search);
  try{sessionStorage.setItem(KEY,JSON.stringify({
    query,timestamp:Date.now(),pilot:params.get('reader-pilot')==='1',
    paper:params.get('paper'),panel:params.get('panel')
  }))}catch(_){}
  // The result owner navigates; consume only on the destination.
 }
 document.addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  if(!event.target.closest?.('.cp-backdrop.is-open #cp-listbox .cp-item'))return;
  captureResult();
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