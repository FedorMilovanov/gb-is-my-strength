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
 return await page.evaluate(()=>{
  const article=document.querySelector('main.np-u-reader-main article.article-body');
  if(!article)return null;
  const p=[...article.querySelectorAll('p')].find(x=>x.textContent.trim().length>65&&x.getBoundingClientRect().width>100);
  if(!p)return null;
  p.scrollIntoView({block:'center',behavior:'instant'});
  const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())&&n.nodeValue.trim().length<26){}
  if(!n)return null;
  const range=document.createRange();range.setStart(n,2);range.setEnd(n,Math.min(42,n.length));
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return range.toString();
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
  assert.equal(first.length,1,'highlight save missing');d.item.marker={kind:first[0].annotation.kind,anchor:first[0].annotation.anchor};
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
  await snap(d.page,'desktop-saved-note');
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
   visible:!document.querySelector('#npUFontPanel').hidden,
   insideAriaModal:document.querySelector('#npUOutline').contains(document.querySelector('#npUFontPanel')),
   focusInside:document.querySelector('#npUFontPanel').contains(document.activeElement),
   bounds:document.querySelector('#npUFontPanel').getBoundingClientRect().toJSON()
  }));
  assert.equal(m.item.settings.insideAriaModal,true,'mobile font settings outside active aria modal');
  assert.equal(m.item.settings.focusInside,true,'mobile font popup focus lost');
  await snap(m.page,'mobile-settings');
  await m.page.keyboard.press('Escape');
 });
 await m.context.close();
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
