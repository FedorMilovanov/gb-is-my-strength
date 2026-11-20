#!/usr/bin/env node
// Browser QA of exact W57 opt-in pilot. No live site writes.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,webkit} from 'playwright';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=resolve(ROOT,'reports/reader-w57-visual');
const BASE='http://127.0.0.1:19061';
const TESTED_SHA=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const REPORT={sha:TESTED_SHA,environmentSha:process.env.GITHUB_SHA||null,scenes:[],failures:[]};
let server,chrome,safari;
await mkdir(OUT,{recursive:true});
async function snap(page,name){
 const buf=await page.screenshot({path:resolve(OUT,name+'.jpg'),type:'jpeg',quality:48,animations:'disabled'});
 console.log('W57_IMAGE_BEGIN::'+name+'::'+buf.toString('base64')+'::W57_IMAGE_END');
}
async function scene(browser,name,path,width,height){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
  hasTouch:width<600,isMobile:width<600,locale:'ru-RU',reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e).slice(0,350)));
 const response=await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForTimeout(700);
 const state=await page.evaluate(()=>({
  ready:document.body.classList.contains('np-w57-ready'),
  annotated:!!window.__NP_W57_ANNOTATIONS__?.ready,
  width:document.documentElement.scrollWidth,viewport:innerWidth,
  folded:document.body.classList.contains('np-u-hide-right'),
  noteCards:document.querySelectorAll('#npW57NotesDetails').length,
  researchCards:document.querySelectorAll('#npUResearch details').length,
  title:document.querySelector('main h1')?.textContent?.trim().slice(0,100)||''
 }));
 const item={name,path,width,height,response:response?.status(),state,errors};REPORT.scenes.push(item);
 if(response?.status()!==200||!state.ready||!state.annotated||state.noteCards!==1)
   REPORT.failures.push({name,reason:'W57 pilot not mounted exactly once',item});
 return{context,page,item};
}
async function safe(name,fn){try{return await fn()}catch(e){REPORT.failures.push({name,error:String(e).slice(0,1000)})}}
async function selectText(page){
 // A real reader scrolls in the article, not in the adjacent research rail.
 // Select only visible prose, never an offscreen paragraph or hidden card.
 const eligible=async()=>await page.evaluate(()=>{
  const article=document.querySelector('main.np-u-reader-main article.article-body');
  if(!article)return false;
  return [...article.querySelectorAll('p')].some(p=>{
   const r=p.getBoundingClientRect();
   return (p.textContent||'').trim().length>70&&r.width>100&&
    r.top>75&&r.bottom<innerHeight-70&&
    !p.closest('.np-u-central-overview,.np-u-central-contents,.gill-card,figcaption,.np-u-series-disclosure,[hidden],[inert]');
  });
 });
 let found=await eligible();
 for(let n=0;!found&&n<10;n++){
  await page.mouse.move(675,500);
  await page.mouse.wheel(0,360);
  await page.waitForTimeout(180);
  found=await eligible();
 }
 if(!found){
  const state=await page.evaluate(()=>({scrollY,screen:innerHeight,
   bodyOverflow:getComputedStyle(document.body).overflow,
   rootOverflow:getComputedStyle(document.documentElement).overflow}));
  throw new Error('No visible eligible Reader source paragraph after user scroll: '+JSON.stringify(state));
 }
 return await page.evaluate(()=>{
  const article=document.querySelector('main.np-u-reader-main article.article-body');
  const p=[...article.querySelectorAll('p')].find(x=>{
   const r=x.getBoundingClientRect();
   return x.textContent.trim().length>70&&r.width>100&&
    r.top>75&&r.bottom<innerHeight-70&&
    !x.closest('.np-u-central-overview,.np-u-central-contents,.gill-card,figcaption,.np-u-series-disclosure,[hidden],[inert]');
  });
  if(!p)return null;
  const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())&&n.nodeValue.trim().length<26){}
  if(!n)return null;
  const r=document.createRange();r.setStart(n,2);r.setEnd(n,Math.min(42,n.length));
  const s=window.getSelection();s.removeAllRanges();s.addRange(r);
  document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  const rect=r.getBoundingClientRect();
  return r.toString();
 });
}
try{
 server=spawn('python3',['-u','research/reader-w57-pilot/preview.py'],{
  cwd:ROOT,env:{...process.env,READER_W57_PORT:'19061',READER_W57_DIST:resolve(ROOT,'dist')},
  stdio:['ignore','pipe','pipe']});
 server.stderr.on('data',x=>console.error('PY_W57 '+String(x).slice(0,500)));
 let started=false;
 for(let i=0;i<80;i++){try{let r=await fetch(BASE+'/articles/');if(r.ok){started=true;break}}catch{}await delay(250)}
 assert.ok(started,'W57 preview.py failed to listen');
 for(const path of ['/nagornaya/seriya/','/updates/','/journal/dossiers/g3/']){
  const response=await fetch(BASE+path+'?reader-pilot=1');
  assert.ok(!(await response.text()).includes('/__reader_w57__/reader_w57.js'),
   'Excluded independent reader must not load pilot: '+path);
 }
 chrome=await chromium.launch({headless:true});
 const d=await scene(chrome,'gill-desktop','/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',1440,900);
 await snap(d.page,'desktop-folded');
 await safe('desktop-research',async()=>{
  await d.page.locator('#npUEdgeToggle').click();
  await d.page.locator('#npW57NotesDetails summary').click();
  d.item.panel=await d.page.evaluate(()=>({
   open:!document.body.classList.contains('np-u-hide-right'),
   noteOpen:document.querySelector('#npW57NotesDetails').open,
   bounds:document.querySelector('#npUResearch').getBoundingClientRect().toJSON()
  }));
  assert.ok(d.item.panel.open&&d.item.panel.noteOpen);
  await snap(d.page,'desktop-annotations');
 });
 await safe('desktop-select-marker-note-edit',async()=>{
  await d.page.locator('#npW57Palette [data-color="sage"]').click();
  assert.equal(await d.page.locator('#npW57Palette [data-color="sage"]').getAttribute('aria-pressed'),'true');
  const selected=await selectText(d.page);await d.page.waitForTimeout(500);
  d.item.selected=selected;assert.ok(selected?.length>=6,'selection failed');
  await d.page.waitForTimeout(250);
  if(!(await d.page.locator('#npW57SelectionToolbar').isVisible())){
   // An artificial selectionchange is not equivalent to a real mouse
   // gesture. Try the actual pointer path before blaming the UI.
   const coords=await d.page.evaluate(()=>{
    const s=window.getSelection(),r=s?.rangeCount?s.getRangeAt(0):null;
    if(!r||r.collapsed)return null;
    const a=r.cloneRange(),z=r.cloneRange();
    a.setEnd(r.startContainer,r.startOffset+1);
    z.setStart(r.endContainer,r.endOffset-1);
    const p=a.getBoundingClientRect(),q=z.getBoundingClientRect();
    return{start:{x:p.left+1,y:p.top+p.height/2},end:{x:q.right-1,y:q.top+q.height/2}};
   });
   if(coords){
    await d.page.mouse.move(coords.start.x,coords.start.y);
    await d.page.mouse.down();
    await d.page.mouse.move(coords.end.x,coords.end.y,{steps:15});
    await d.page.mouse.up();
    await d.page.waitForTimeout(350);
   }
  }
  d.item.selectionDiag=await d.page.evaluate(()=>{
   const s=window.getSelection(),r=s?.rangeCount?s.getRangeAt(0):null;
   const el=r?.startContainer?.parentElement;
   const article=document.querySelector('main.np-u-reader-main article.article-body');
   const popup=document.querySelector('#selection-share-popup');
   return{selected:s?.toString().slice(0,110),collapsed:s?.isCollapsed,
    sourceBlock:el?.closest('p,li,blockquote')?.tagName||null,
    sourceInsideArticle:!!(article&&el&&article.contains(el)),
    hiddenAncestor:!!el?.closest('[hidden],[inert],[aria-hidden="true"]'),
    bounds:r?.getBoundingClientRect().toJSON()||null,
    toolbarHidden:document.querySelector('#npW57SelectionToolbar')?.hidden,
    nativePopupVisible:!!popup&&popup.getClientRects().length>0&&getComputedStyle(popup).visibility!=='hidden'};
  });
  console.log('W57_SELECTION_DIAG '+JSON.stringify(d.item.selectionDiag));
  assert.ok(await d.page.locator('#npW57SelectionToolbar').isVisible(),'W57 toolbar hidden after native drag');
  d.item.duplicate=await d.page.evaluate(()=>{
   const s=document.querySelector('#selection-share-popup');
   return s?{exists:true,visible:s.getClientRects().length>0&&getComputedStyle(s).visibility!=='hidden'}:{exists:false};
  });
  await snap(d.page,'desktop-selection');
  await d.page.locator('#npW57SelectionToolbar [data-w57-action="marker"]').click();
  const first=await d.page.evaluate(()=>JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').filter(x=>x.annotation?.version===1));
  assert.equal(first.length,1,'highlight save missing');
  d.item.marker={kind:first[0].annotation.kind,color:first[0].annotation.color,anchor:first[0].annotation.anchor};
  assert.equal(d.item.marker.color,'sage','highlight palette selection was not preserved');
  d.item.highlightCss=await d.page.evaluate(()=>({
   supported:typeof CSS!=='undefined'&&!!CSS.highlights&&typeof Highlight!=='undefined',
   rendered:typeof CSS!=='undefined'&&!!CSS.highlights?.has('np-w57-marker-sage'),
   rangeCount:CSS?.highlights?.get('np-w57-marker-sage')?.size||0
  }));
  if(d.item.highlightCss.supported)assert.equal(d.item.highlightCss.rendered,true,'marker not attached to CSS Custom Highlight registry');
  await snap(d.page,'desktop-sage-highlight');
  const again=await selectText(d.page);assert.ok(again);
  await d.page.waitForTimeout(350);
  await d.page.locator('#npW57SelectionToolbar [data-w57-action="note"]').click();
  await d.page.locator('#npW57NoteText').fill('Первоначальная заметка W57');
  await d.page.locator('#npW57SaveNote').click();
  const prev=await d.page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]'));
  assert.equal(prev.length,1);
  await d.page.locator('#npW57NotesList li[data-id] [data-action="edit"]').first().click();
  await d.page.locator('#npW57NoteText').fill('Исправленная заметка W57');
  await d.page.locator('#npW57SaveNote').click();
  const next=await d.page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]'));
  assert.equal(next.length,1);assert.equal(next[0].id,prev[0].id);assert.equal(next[0].text,'Исправленная заметка W57');
  d.item.note={count:next.length,idPreserved:true};
  const notePreview=d.page.locator('#npW57NotesList li[data-id] .np-w57-note-preview-text').first();
  assert.equal(await notePreview.textContent(),'Исправленная заметка W57',
   'edited linked note must be visibly rendered in the panel');
  assert.equal(await d.page.locator('#npW57NotesList li[data-id] [data-action="edit"]').first().textContent(),
   'Изменить заметку','edit action must be self-explanatory');
  await snap(d.page,'desktop-saved-note');
  await d.page.locator('#npW57NotesList li[data-id] [data-action="recolor"]').first().click();
  await d.page.keyboard.press('Escape');
  const cancelledColor=await d.page.evaluate(()=>
   JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').find(x=>x.annotation?.version===1)?.annotation?.color);
  assert.equal(cancelledColor,'sage','Escape must not mutate the highlight color');
  await d.page.locator('#npW57NotesList li[data-id] [data-action="recolor"]').first().click();
  await d.page.locator('#npW57Palette [data-color="lime"]').click();
  const recolored=await d.page.evaluate(()=>{
    const q=JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]');
    return q.find(x=>x.annotation?.version===1)?.annotation?.color;
  });
  d.item.recolor=recolored;
  assert.equal(recolored,'lime','explicit palette selection must recolor only the saved highlight');
  await snap(d.page,'desktop-lime-highlight');
  await d.page.locator('#npW57NotesList li[data-id] [data-action="delete"]').first().click();
  await d.page.locator('#npW57NotesStatus button').click();
  assert.equal(await d.page.evaluate(()=>JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').filter(x=>x.annotation?.version===1).length),1);
 });
 await safe('desktop-dark',async()=>{
  await d.page.evaluate(()=>window.GBReaderPreferences?.setTheme?.('dark',{source:'w57-qa'}));
  await d.page.waitForTimeout(250);
  await snap(d.page,'desktop-dark');
 });
 await d.context.close();
 const m=await scene(chrome,'gill-mobile','/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',390,844);
 await snap(m.page,'mobile-folded');
 await safe('mobile-panels',async()=>{
  await m.page.locator('#npUOpenResearch').click();
  await m.page.locator('#npW57NotesDetails summary').click();
  m.item.modal=await m.page.evaluate(()=>({right:document.querySelector('#npUniversalDemo').classList.contains('np-u-show-right'),
   ariaModal:document.querySelector('#npUResearch').getAttribute('aria-modal')}));
  await snap(m.page,'mobile-annotations');
  await m.page.locator('#npUCloseRight').click();
  await m.page.locator('#npUOpenToc').click();
  await m.page.getByRole('button',{name:'Настройки книжного шрифта'}).first().click();
  m.item.settings=await m.page.evaluate(()=>({
   dialogRole:document.querySelector('#npUFontPanel')?.getAttribute('role'),
   dialogAria:document.querySelector('#npUFontPanel')?.getAttribute('aria-modal'),
   scrimVisible:!document.querySelector('#npUFontScrim')?.hidden,
   nativeToolsInert:document.querySelector('#npUNativeTools')?.inert,
   ghostProbe:document.elementsFromPoint(356,660).slice(0,8).map(el=>({
    tag:el.tagName,id:el.id,class:String(el.className||'').slice(0,90),
    label:el.getAttribute('aria-label')||el.getAttribute('title')||''
   })),
   floatingButtons:[...document.querySelectorAll('#gb-hl-fab,#gbFloatingControls,.mobile-top-save,[data-fc-root]')]
    .filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0})
    .map(el=>({id:el.id,class:String(el.className||'').slice(0,65),
     rect:el.getBoundingClientRect().toJSON()})).slice(0,12),
   visible:!document.querySelector('#npUFontPanel').hidden,
   insideAriaModal:document.querySelector('#npUOutline').contains(document.querySelector('#npUFontPanel')),
   focusInside:document.querySelector('#npUFontPanel').contains(document.activeElement),
   bounds:document.querySelector('#npUFontPanel').getBoundingClientRect().toJSON()
  }));
  assert.equal(m.item.settings.insideAriaModal,true,'mobile font settings outside active aria modal');
  assert.equal(m.item.settings.dialogRole,'dialog','mobile font settings must expose dialog role');
  assert.equal(m.item.settings.dialogAria,'true','mobile font dialog must be accessible');
  assert.equal(m.item.settings.scrimVisible,true,'background native tools must be visually covered');
  assert.equal(m.item.settings.nativeToolsInert,true,'native TOC controls must be inert behind dialog');
  assert.equal(m.item.settings.focusInside,true,'mobile font popup focus lost');
  await snap(m.page,'mobile-settings');
  await m.page.locator('#npUFontPanel [data-np-u-type-font="cormorant"]').click();
  m.item.fontAfterClick=await m.page.evaluate(()=>{
   const pref=window.GBReaderPreferences?.get(),
    p=document.getElementById('gill-search-p-012');
   const examples=[...document.querySelectorAll('article.article-body p')].slice(0,7)
     .map(el=>({id:el.id,container:el.parentElement?.className||'',font:getComputedStyle(el).fontFamily,
       text:el.textContent.trim().slice(0,50)}));
   return {font:pref?.fontFamily,stored:JSON.parse(localStorage.getItem('gb:reader-preferences:v1')||'{}').fontFamily,
    root:document.documentElement.dataset.readerFontFamily,
    body:document.body.dataset.npUFont,computed:p?getComputedStyle(p).fontFamily:null,examples,
    selected:document.querySelector('#npUFontPanel [data-np-u-type-font="cormorant"]')?.getAttribute('aria-pressed')};
  });
  assert.equal(m.item.fontAfterClick.font,'cormorant','canonical fontFamily did not update');
  assert.equal(m.item.fontAfterClick.stored,'cormorant','fontFamily not persisted');
  assert.equal(m.item.fontAfterClick.root,'cormorant','first paint root not updated');
  assert.equal(m.item.fontAfterClick.body,'cormorant','W57 adapter did not receive preference');
  assert.equal(m.item.fontAfterClick.selected,'true','font control not selected');
  assert.match(m.item.fontAfterClick.computed||'',/Cormorant/i,'article CSS did not adopt the selected font');
  await snap(m.page,'mobile-settings-cormorant');
  await m.page.keyboard.press('Escape');
  await m.page.reload({waitUntil:'domcontentloaded'});
  await m.page.waitForFunction(()=>document.body.classList.contains('np-w57-ready'));
  m.item.fontAfterReload=await m.page.evaluate(()=>({
   font:window.GBReaderPreferences?.get()?.fontFamily,
   root:document.documentElement.dataset.readerFontFamily,
   body:document.body.dataset.npUFont,
   computed:getComputedStyle(document.getElementById('gill-search-p-012')).fontFamily
  }));
  assert.equal(m.item.fontAfterReload.font,'cormorant','font preference lost after reload');
  assert.equal(m.item.fontAfterReload.root,'cormorant','first paint font did not hydrate correctly');
  assert.match(m.item.fontAfterReload.computed||'',/Cormorant/i,'font not applied after reload');
  await snap(m.page,'mobile-cormorant-reload');
  await m.page.goto(BASE+'/articles/kod-da-vinchi/?reader-pilot=1&paper=space',{waitUntil:'domcontentloaded'});
  await m.page.waitForFunction(()=>document.body.classList.contains('np-w57-ready'));
  m.item.crossArticleFont=await m.page.evaluate(()=>({
   font:window.GBReaderPreferences?.get()?.fontFamily,body:document.body.dataset.npUFont,
   computed:(()=>{
    const p=[...document.querySelectorAll('article.article-body p')]
      .find(el=>el.textContent.trim().length>90&&
        !el.closest('.notice,.gtip,.btip,.summary-card,.np-u-central-overview,.np-u-central-contents,figcaption'));
    return p?getComputedStyle(p).fontFamily:null;
   })()
  }));
  assert.equal(m.item.crossArticleFont.font,'cormorant','site-wide preference did not cross articles');
  assert.match(m.item.crossArticleFont.computed||'',/Cormorant/i,'other article ignored shared typography');
 });
 await m.context.close();
 // Review layout at the actual user-facing breakpoints, not one 1440px image.
 for(const [width,height,name] of [[320,700,'mobile-320'],[768,900,'tablet-768'],
  [1280,800,'desktop-1280'],[1920,1000,'desktop-1920']]){
  const extra=await scene(chrome,name,
   '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',width,height);
  extra.item.geometry=await extra.page.evaluate(()=>{
   const main=document.querySelector('main.np-u-reader-main'),rect=main?.getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,
    center:rect?Math.round(rect.left+rect.width/2):null,viewportCenter:innerWidth/2,
    mainWidth:rect?.width||0,visibleResearch:!!document.querySelector('#npUResearch')?.getClientRects().length};
  });
  if(extra.item.geometry.overflow)REPORT.failures.push({name,reason:'horizontal overflow',geometry:extra.item.geometry});
  await snap(extra.page,name);await extra.context.close();
 }
 const alt=await scene(chrome,'independent-article','/articles/kod-da-vinchi/?reader-pilot=1&paper=space',1440,900);
 await snap(alt.page,'other-article');await alt.context.close();
 safari=await webkit.launch({headless:true});
 const w=await scene(safari,'webkit-mobile','/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',390,844);
 await snap(w.page,'webkit-mobile');await w.context.close();
}catch(e){REPORT.failures.push({name:'bootstrap',error:String(e).slice(0,1400)})}
finally{
 await writeFile(resolve(OUT,'report.json'),JSON.stringify(REPORT,null,2));
 console.log('W57_AUDIT_REPORT '+JSON.stringify(REPORT));
 await Promise.allSettled([chrome?.close(),safari?.close()]);
 server?.kill('SIGTERM');
}
if(REPORT.failures.length){console.error('W57_BROWSING_FAILED '+REPORT.failures.length);process.exitCode=1}
else console.log('W57_BROWSING_ALL_PASS');
