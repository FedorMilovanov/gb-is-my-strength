#!/usr/bin/env node
// Browser QA of exact W57 opt-in pilot. No live site writes.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,webkit} from 'playwright';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const OUT=resolve(ROOT,'reports/reader-w57-visual');
const BASE='http://127.0.0.1:19061';
const TESTED_SHA=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const REPORT={sha:TESTED_SHA,environmentSha:process.env.GITHUB_SHA||null,scenes:[],findings:[],failures:[]};
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
  title:document.querySelector('main h1')?.textContent?.trim().slice(0,100)||'',
  w57RuntimeScripts:[...document.scripts].filter(s=>/\/__reader_w57__\/(?:reader_w57|reader_universal_preview)\.js/.test(s.src)).length,
  nativeToc:!!document.querySelector('#mobPartTocBtn')?.getClientRects().length,
  nativeSettings:!!document.querySelector('#mobSettingsBtn')?.getClientRects().length,
  nativePlay:!!document.querySelector('.reader-mobile-play')?.getClientRects().length,
  nativeSpeed:!!document.querySelector('#mobSpdBadge')?.getClientRects().length
 }));
 const item={name,path,width,height,response:response?.status(),state,errors};REPORT.scenes.push(item);
 const pilotExpected=width>=1121;
 if(response?.status()!==200||
    (pilotExpected&&(!state.ready||!state.annotated||state.noteCards!==1||state.w57RuntimeScripts<2))||
    (!pilotExpected&&(state.ready||state.annotated||state.noteCards!==0||
       state.w57RuntimeScripts!==0||!state.nativeToc||!state.nativeSettings||
       !state.nativePlay||!state.nativeSpeed)))
   REPORT.failures.push({name,reason:pilotExpected?'desktop W57 missing or incomplete':'native Reader boundary violated',item});
 return{context,page,item};
}
// Canonical ReaderState drives the W57 visual section in both real engines.
// Probe the leading edge of actual interior article sections, then reverse
// direction; at the old 30% viewport threshold these assertions were red.
async function sectionFollowChecks(browser,name){
 const s=await scene(browser,name,'/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open',1440,900);
 const {page,item}=s;
 try{
  await page.waitForFunction(()=>window.ReaderState?.getSnapshot()&&window.__NP_UNIVERSAL_PREVIEW__?.ready);
  const candidates=await page.evaluate(()=>window.__NP_UNIVERSAL_PREVIEW__.groups.slice(1,-1).map(g=>g.id));
  assert.ok(candidates.length>=2,'expected multiple interior visual groups');
  const [first,last]=[candidates[0],candidates.at(-1)];
  const scrollToSection=async id=>{
   const y=await page.evaluate(id=>{
    const el=document.getElementById(id);
    if(!el)throw Error('missing section '+id);
    const y=el.getBoundingClientRect().top+scrollY-window.ReaderState.getReadingLine()+15;
    window.scrollTo({top:y,behavior:'instant'});
    return y;
   },id);
   await page.waitForFunction(({id,y})=>{
    const state=window.ReaderState.getSnapshot();
    return state?.sectionId===id&&Math.abs(scrollY-y)<3;
   },{id,y},{timeout:10000});
  };
  const active=()=>page.locator('#npUOutline .np-u-major-link[aria-current="location"]').getAttribute('data-np-u-goto');
  const follows=async id=>{
   await scrollToSection(id);
   await page.waitForFunction(id=>document.querySelector('#npUOutline .np-u-major-link[aria-current="location"]')?.dataset.npUGoto===id,id,{timeout:5000});
   assert.equal(await active(),id);
  };
  await follows(first);await follows(last);await follows(first);
  await page.locator('#npUFollowToggle').click();
  await scrollToSection(last);
  assert.equal(await active(),first,'manual research pin must survive canonical scroll');
  await page.locator('#npUFollowToggle').click();
  await page.waitForFunction(id=>document.querySelector('#npUOutline .np-u-major-link[aria-current="location"]')?.dataset.npUGoto===id,last);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.waitForFunction(()=>window.ReaderState.getSnapshot()?.phase==='before-content');
  await page.waitForFunction(()=>document.querySelector('#npUOutline .np-u-major-link[aria-current="location"]')?.dataset.npUGoto===window.__NP_UNIVERSAL_PREVIEW__.groups[0].id);
  assert.deepEqual(item.errors,[]);
  item.sectionFollow={forward:true,reverse:true,pin:true,resume:true,returnToIntro:true};
 }finally{await s.context.close()}
}
async function safe(name,fn){try{return await fn()}catch(e){REPORT.failures.push({name,error:String(e).slice(0,1000)})}}
// Mobile and the 1120px boundary use the actual native Reader, never W57 DOM.
async function nativeChecks(sample) {
 const {page,item}=sample;
 const state=await page.evaluate(()=>{
  const bar=document.querySelector('.mobile-top-bar');
  const play=document.querySelector('.reader-mobile-play');
  const r=bar?.getBoundingClientRect(),p=play?.getBoundingClientRect();
  return {barHeight:r?.height,playWidth:p?.width,playHeight:p?.height,
   overflow:document.documentElement.scrollWidth-innerWidth,
   pilot:document.body.classList.contains('np-w57-ready'),
   w57Scripts:[...document.scripts].some(s=>/\/__reader_w57__\/reader_w57\.js/.test(s.src))};
 });
 assert.equal(state.pilot,false,'W57 mounted on native mobile/tablet');
 assert.equal(state.w57Scripts,false,'W57 JavaScript leaked below 1121px');
 if(item.width<=768) assert.ok(state.barHeight>=58&&state.barHeight<=60,'native mobile reading bar geometry drift');
 else assert.ok(state.barHeight>=44&&state.barHeight<=46,'native tablet header geometry drift');
 assert.ok(state.playWidth>=38&&state.playHeight>=38,'native Play touch geometry shrank');
 assert.ok(state.overflow<=1,'native mobile horizontal overflow');
 item.native=state;
 await page.locator('#mobPartTocBtn').click();
 await page.locator('#partTocOverlay[aria-hidden="false"]').waitFor({state:'visible',timeout:5000});
 assert.ok(await page.locator('#gbrTocTab').isVisible(),'native TOC tab hidden');
 await page.keyboard.press('Escape');
 await page.locator('#mobSettingsBtn').click();
 await page.locator('#gillSettingsOverlay[aria-hidden="false"]').waitFor({state:'visible',timeout:5000});
 assert.ok(await page.locator('#gillSettingsOverlay .type-choice').count()>=2,'native font controls missing');
 const value=page.locator('#gillFontScaleValue');
 assert.equal(await value.innerText(),Math.round(await page.evaluate(()=>GBReaderPreferences.get().fontScale)*100)+'%');
 const reset=page.locator('#gillSettingsReset');
 assert.equal(await reset.evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
 assert.ok((await reset.boundingBox()).height>=44,'native reset tap target shrank');

 await page.keyboard.press('Escape');
 // Test an actual exposed portion of the clickable rate badge, not its
 // aria-hidden child span whose centre can sit beneath the painted Play disc.
 const badgePoint=await page.locator('#mobSpdBadge').evaluate(el=>{
  const r=el.getBoundingClientRect();
  for(let iy=1;iy<=4;iy++)for(let ix=1;ix<=4;ix++){
   const x=r.left+r.width*ix/5,y=r.top+r.height*iy/5;
   if(el.contains(document.elementFromPoint(x,y)))return{x,y};
  }
  return null;
 });
 assert.ok(badgePoint,'speed badge has no independently hittable visible point');
 item.native.badgePoint=badgePoint;
 await page.mouse.click(badgePoint.x,badgePoint.y);
 await page.locator('#mobSpdBadge[aria-expanded="true"]').waitFor({state:'visible',timeout:4000});
 await page.keyboard.press('Escape');
 const playHit=await page.locator('.reader-mobile-play').evaluate(el=>{
  const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  return el.contains(document.elementFromPoint(x,y));
 });
 assert.equal(playHit,true,'visible Play triangle no longer owns its centre');
 assert.ok(await page.locator('.reader-mobile-play').isVisible(),'Play disappeared after native checks');
}
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
 // The route registry owns reading eligibility. Test actual HTTP responses,
 // not a string for a script which is only inserted by the bootstrap.
 const desktopContract=require('./lib/reader-desktop-contract').buildDesktopReaderContract();
 const eligible=desktopContract.routes.map(route=>({route}));
 const hardPaths=desktopContract.routes.filter(route=>route.startsWith('/hard-texts/'));
 assert.equal(hardPaths.length,7,'hard-texts reading coverage drift');
 const manifest={files:[...desktopContract.styles,...desktopContract.scripts]};
 const prefix='/__reader_w57__/';
 let bootstrapUrl;
 for(const {route} of eligible){
  const response=await fetch(BASE+route);
  assert.equal(response.status,200,route);
  const html=await response.text();
  for(const file of manifest.files.filter(f=>f.name.endsWith('.css'))){
   assert.ok(html.includes(prefix+file.name+'?v='+file.sha256),route+' missing revised '+file.name);
  }
  const found=html.match(/\/__reader_w57__\/preview-bootstrap\.js\?v=[a-f0-9]{64}/)?.[0];
  assert.ok(found,route+' missing revisioned bootstrap');
  if(bootstrapUrl)assert.equal(found,bootstrapUrl);else bootstrapUrl=found;
  const native=await fetch(BASE+route+'?reader-pilot=0');
  assert.equal(native.status,200,route+' native comparison');
  assert.ok(!(await native.text()).includes(prefix),route+' opt-out must be native');
 }
 for(const path of ['/hard-texts/','/hard-texts/genesis-6/','/articles/','/baptisty-rossii/','/nagornaya/seriya/','/nagornaya/chast-1/','/updates/','/journal/dossiers/g3/']){
  const response=await fetch(BASE+path+'?reader-pilot=1');
  assert.equal(response.status,200,path);
  assert.ok(!(await response.text()).includes(prefix),'Excluded route must not load pilot: '+path);
 }
 const bootstrapResponse=await fetch(BASE+bootstrapUrl);
 assert.equal(bootstrapResponse.status,200);
 const bootstrap=await bootstrapResponse.text();
 assert.equal(createHash('sha256').update(bootstrap).digest('hex'),new URL(BASE+bootstrapUrl).searchParams.get('v'));
 for(const file of manifest.files){
  const url=prefix+file.name+'?v='+file.sha256;
  if(file.name.endsWith('.js'))assert.ok(bootstrap.includes(url),'Missing revised '+file.name);
  const response=await fetch(BASE+url);
  assert.equal(response.status,200,url);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),file.sha256,url);
 }
 REPORT.routeEligibility={eligible:eligible.length,hard:hardPaths.length,manifestAssets:manifest.files.length};
 chrome=await chromium.launch({headless:true});
 const d=await scene(chrome,'gill-desktop','/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',1440,900);
 await snap(d.page,'desktop-folded');
 const readingGeometry=()=>({
  viewport:innerWidth,
  boxes:Object.fromEntries([
   ['main',document.querySelector('main.np-u-reader-main')],
   ['article',document.querySelector('article.article-body')],
   ['hero',[...document.querySelectorAll('article.article-body img')].find(x=>x.getBoundingClientRect().width>300)],
   ['prose',document.getElementById('gill-search-p-013')],
  ].map(([key,el])=>{
   const r=el?.getBoundingClientRect();
   return[key,r?{left:+r.left.toFixed(1),right:+r.right.toFixed(1),
    width:+r.width.toFixed(1),center:+(r.left+r.width/2).toFixed(1)}:null];
  }))
 });
 d.item.geometryFolded=await d.page.evaluate(readingGeometry);
 await safe('desktop-research',async()=>{
  await d.page.locator('#npUEdgeToggle').click();
  await d.page.locator('#npW57NotesDetails summary').click();
  d.item.panel=await d.page.evaluate(()=>({
   open:!document.body.classList.contains('np-u-hide-right'),
   noteOpen:document.querySelector('#npW57NotesDetails').open,
   bounds:document.querySelector('#npUResearch').getBoundingClientRect().toJSON()
  }));
  assert.ok(d.item.panel.open&&d.item.panel.noteOpen);
  d.item.geometryOpen=await d.page.evaluate(readingGeometry);
  const folded=d.item.geometryFolded.boxes.hero,opened=d.item.geometryOpen.boxes.hero;
  d.item.heroCenterShift=folded&&opened?+(opened.center-folded.center).toFixed(1):null;
  if(d.item.heroCenterShift!==null&&Math.abs(d.item.heroCenterShift)>24)
   REPORT.findings.push({severity:'visual-review',problem:'hero moves between folded and open research',
    deltaPx:d.item.heroCenterShift,folded:d.item.geometryFolded,opened:d.item.geometryOpen});
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
 const library='#gb-hl-panel';
 const openLibrary=async p=>{
  await p.bringToFront();
  if(!await p.locator(library).isVisible()){
   const inline=p.locator('#npULibraryButton');
   await (await inline.isVisible()?inline:p.locator('#gb-hl-fab')).click({timeout:5000});
  }
  await p.locator(`${library} [data-library-tab=note]`).click();
 };
 const editNote=async(p,id,text)=>{
  await p.locator(`${library} .gb-hl-item[data-id="${id}"] [data-library-action=edit-note]`).click();
  await p.locator('#gb-hl-note-text').fill(text);
 };
 const submitNote=p=>p.locator('#gb-hl-editor [type=submit]').click();
 const notes=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]'));
 await safe('desktop-library-same-and-cross-tab',async()=>{
  const p=d.page,other=await d.context.newPage();
  try{
   await other.goto(p.url(),{waitUntil:'domcontentloaded'});
   await other.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);
   await openLibrary(p);
   const [record]=await notes(p),text='Исправлено через общую библиотеку';
   await editNote(p,record.id,text);
   await submitNote(p);
   for(const page of [p,other])await page.waitForFunction(t=>
    document.querySelector('#npW57NotesList .np-w57-note-preview-text')?.textContent===t,text,{timeout:4000});
   await p.locator(`${library} [data-library-tab=quote]`).click();
   await p.locator(`${library} .gb-hl-item[data-type=quote] [data-library-action=delete]`).click();
   const expectCount=async count=>{
    for(const page of [p,other])await page.waitForFunction(n=>{
     const cards=document.querySelectorAll('#npW57NotesList li[data-id]').length;
     const counter=document.querySelector('#npW57NotesCount').textContent;
     const ranges=[...CSS.highlights].filter(([k])=>k.startsWith('np-w57-')).reduce((sum,[,h])=>sum+h.size,0);
     return cards===n&&counter===String(n)&&ranges===n;
    },count,{timeout:4000});
   };
   await expectCount(0);
   await p.locator('#gb-hl-status [data-library-action=undo]').click();
   await expectCount(1);
  }finally{
   await other.close();
   if(await p.locator(library).isVisible())await p.locator('#gb-hl-close').click();
  }
 });
 for(const mode of ['edit','delete','different-note','ordinary'])await safe('library-conflict-'+mode,async()=>{
  const context=await chrome.newContext({viewport:{width:1440,height:900}});
  try{
   const p=await context.newPage(),other=await context.newPage();
   await p.goto(d.page.url());
   await p.evaluate(()=>localStorage.setItem('gb-reader-notes-v1',JSON.stringify(['alpha','beta'].map(id=>
    ({id,text:`Original ${id}`,url:location.origin+location.pathname,savedAt:Date.now()})))));
   await Promise.all([p.reload(),other.goto(d.page.url())]);
   await openLibrary(p);
   await editNote(p,'alpha','Draft A');
   if(mode!=='ordinary'){
    await openLibrary(other);
    if(mode==='delete')await other.locator(`${library} .gb-hl-item[data-id=alpha] [data-library-action=delete]`).click();
    else{await editNote(other,mode==='edit'?'alpha':'beta','Commit B');await submitNote(other);}
   }
   await p.bringToFront();
   await submitNote(p);
   const read=async page=>Object.fromEntries((await notes(page)).map(n=>[n.id,n.text]));
   const saved=await read(p);
   const conflict=mode==='edit'||mode==='delete';
   assert.equal(await p.locator('#gb-hl-editor').isVisible(),conflict);
   if(conflict){
    assert.equal(await p.locator('#gb-hl-note-text').inputValue(),'Draft A');
    assert.match(await p.locator('#gb-hl-status').textContent(),/Черновик не сохранён/);
   }
   assert.equal(saved.alpha,mode==='edit'?'Commit B':mode==='delete'?undefined:'Draft A');
   assert.equal(saved.beta,mode==='different-note'?'Commit B':'Original beta');
   await other.reload();
   assert.deepEqual(await read(other),saved);
  }finally{await context.close();}
 });
 await safe('desktop-glossary-source-integrity',async()=>{
  // The tested source contains a visible gterm and a large hidden gtip.
  // Range.toString() includes the hidden tooltip, so the saved quote MUST
  // instead use the author-visible textual projection.
  const fixture=await d.page.evaluate(()=>{
   const block=document.getElementById('gill-search-p-013');
   if(!block)return{error:'Gill source paragraph gill-search-p-013 missing'};
   const terms=[...block.querySelectorAll('.gterm')];
   const term=terms.find(x=>x.querySelector('.gtip'));
   if(!term)return{error:'Gill glossary gterm/gtip absent'};
   block.scrollIntoView({block:'center',behavior:'instant'});
   const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),nodes=[];let n;
   while((n=walker.nextNode()))nodes.push(n);
   const start=nodes.find(x=>term.contains(x)&&!x.parentElement.closest('.gtip,.tooltip'));
   const i=nodes.indexOf(start);
   const end=nodes.slice(i+1).find(x=>x.nodeValue.trim().length>12&&
    !x.parentElement.closest('.gtip,.btip,.tooltip')&&!term.contains(x));
   if(!start||!end)return{error:'Visible text nodes around glossary missing'};
   const range=document.createRange();
   range.setStart(start,0);
   range.setEnd(end,Math.min(50,end.nodeValue.length));
   let expected='';
   for(const leaf of nodes){
    if(leaf.parentElement.closest('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"]'))continue;
    if(!range.intersectsNode(leaf))continue;
    const from=leaf===start?0:0;
    const to=leaf===end?Math.min(50,leaf.nodeValue.length):leaf.nodeValue.length;
    expected+=leaf.nodeValue.slice(from,to);
   }
   const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
   document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
   return{expected,raw:range.toString(),bounds:range.getBoundingClientRect().toJSON(),
    glossary:term.querySelector('.gtip')?.textContent?.slice(0,65)||''};
  });
  d.item.glossaryFixture={...fixture,raw:fixture.raw?.slice(0,250)};
  assert.ok(!fixture.error,fixture.error);
  assert.ok(fixture.raw.length>fixture.expected.length+20,
   'fixture must demonstrably include hidden glossary in native Range.toString');
  assert.ok(fixture.expected.length>=6,'visible authored passage too short');
  await d.page.waitForTimeout(420);
  assert.equal(await d.page.locator('#npW57SelectionToolbar').isVisible(),true,
   'contextual actions should appear on genuine visible glossary-adjacent selection');
  const before=await d.page.evaluate(()=>JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]'));
  await d.page.locator('#npW57SelectionToolbar [data-w57-action="marker"]').click();
  const after=await d.page.evaluate(()=>JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]'));
  const record=after.find(x=>!before.some(y=>y.id===x.id)&&x.annotation?.version===1);
  assert.ok(record,'glossary-adjacent selection must save an independent annotation');
  assert.equal(record.text,fixture.expected,
   'saved quote must contain only visible authored text, never glossary tooltip contents');
  assert.equal(record.annotation.anchor.exact,fixture.expected,'anchor exact must match visible quote');
  assert.equal(record.annotation.anchor.projection,'reader-visible-v1',
   'quote must declare visible coordinate mapping');
  assert.ok(!record.text.includes(fixture.glossary.slice(0,20)),
   'hidden glossary text leaked into saved quote');
  d.item.glossary={visibleLength:fixture.expected.length,nativeRangeLength:fixture.raw.length,
   storedLength:record.text.length,restorableId:record.id};
  await snap(d.page,'desktop-glossary-visible');
  await d.page.reload({waitUntil:'domcontentloaded'});
  await d.page.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready===true);
  const restored=await d.page.evaluate(id=>({
   saved:JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').some(x=>x.id===id),
   unresolved:window.__NP_W57_ANNOTATIONS__?.orphanCount?.(),
   painted:CSS.highlights&&[...CSS.highlights.values()].some(h=>h.size>0)
  }),record.id);
  assert.equal(restored.saved,true,'reloading must not discard valid visible quotation');
  assert.equal(restored.unresolved,0,'visible source range must restore after reload');
  assert.equal(restored.painted,true,'glossary quote highlight must repaint after reload');
  d.item.glossary.restored=restored;
 });
 await safe('desktop-glossary-first-pointer-click',async()=>{
  const p=d.page;
  const paragraph=p.locator('#gill-search-p-013');
  await paragraph.scrollIntoViewIfNeeded();
  await p.mouse.move(5,5);
  const points=await paragraph.evaluate(el=>{
   const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   const nodes=[];
   while(walker.nextNode())if(!walker.currentNode.parentElement.closest('.gtip,.btip'))nodes.push(walker.currentNode);
   return [['Солтерс-Холле',false],['обсуждали',true]].map(([text,end])=>{
    const n=nodes.find(leaf=>leaf.nodeValue.includes(text));
    const i=n.nodeValue.indexOf(text)+(end?text.length-1:0);
    const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);
    const box=r.getBoundingClientRect();
    return [end?box.right-.1:box.left+.1,box.y+box.height/2];
   });
  });
  await p.mouse.move(...points[0]);await p.mouse.down();
  await p.mouse.move(...points[1],{steps:26});await p.mouse.up();
  const marker=p.locator('#npW57SelectionToolbar [data-w57-action=marker]');
  await marker.waitFor();
  const point=await marker.evaluate(el=>{
   const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   return {x,y,hit:el.contains(document.elementFromPoint(x,y)),text:getSelection().toString()};
  });
  assert.match(point.text,/Диссентеры/);
  assert.equal(point.hit,true,'tooltip must not cover the marker action after real drag');
  await p.mouse.click(point.x,point.y);
  const saved=await p.evaluate(text=>JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]')
   .some(q=>q.text===text&&q.annotation?.kind==='marker'),point.text);
  assert.equal(saved,true,'first direct click must save the actual selection');
 });
 await safe('desktop-dark',async()=>{
  await d.page.evaluate(()=>window.GBReaderPreferences?.setTheme?.('dark',{source:'w57-qa'}));
  await d.page.waitForTimeout(250);
  await snap(d.page,'desktop-dark');
 });
 await d.context.close();
 const m=await scene(chrome,'gill-mobile','/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',390,844);
 await nativeChecks(m);
 await snap(m.page,'mobile-native-controls');
 await m.context.close();
 // Review layout at the actual user-facing breakpoints, not one 1440px image.
 for(const [width,height,name] of [[320,700,'mobile-320'],[768,900,'tablet-768'],
  [1120,800,'native-1120'],[1121,800,'pilot-1121'],[1280,800,'desktop-1280'],[1366,768,'desktop-1366'],[1440,900,'desktop-1440'],[1920,1080,'desktop-1920']]){
  const extra=await scene(chrome,name,
   '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',width,height);
  extra.item.geometry=await extra.page.evaluate(()=>{
   const main=document.querySelector('main.np-u-reader-main'),rect=main?.getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,
    center:rect?Math.round(rect.left+rect.width/2):null,viewportCenter:innerWidth/2,
    mainWidth:rect?.width||0,visibleResearch:!!document.querySelector('#npUResearch')?.getClientRects().length};
  });
  if(extra.item.geometry.overflow)REPORT.failures.push({name,reason:'horizontal overflow',geometry:extra.item.geometry});
  await snap(extra.page,name);
  if(width>=1280){
   await safe(name+'-settings',async()=>{
    const p=extra.page;
    const native=p.locator('#railSettingsBtn');
    const trigger=await native.isVisible()?native:p.locator('#npUOutline .np-u-type-open');
    await trigger.click();
    const panel=p.locator('#npUFontPanel');
    assert.equal(await panel.isVisible(),true);
    assert.equal(await p.locator('#gillSettingsOverlay').getAttribute('aria-hidden'),'true');
    assert.equal(await trigger.getAttribute('aria-controls'),'npUFontPanel');
    assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    const [r,h]=await Promise.all([panel.boundingBox(),p.locator('main h1').first().boundingBox()]);
    assert.ok(r.x+r.width<=h.x||r.y+r.height<=h.y||h.y+h.height<=r.y,'settings overlap H1');
    const range=panel.locator('[data-np-u-scale-range]');
    const scaleValue=panel.locator('[data-np-u-scale-value]');
    await range.focus();
    await range.press('Home');
    for(let percent=85;percent<=125;percent+=5){
     assert.equal(await scaleValue.innerText(),percent+'%');
     assert.equal(Math.round(await p.evaluate(()=>GBReaderPreferences.get().fontScale)*100),percent);
     if(percent<125)await range.press('ArrowRight');
    }
    assert.equal(await panel.locator('[data-np-u-scale-step="1"]').getAttribute('aria-disabled'),'true');
    await panel.locator('[data-np-u-scale-step="-1"]').click();
    assert.equal(await scaleValue.innerText(),'120%');
    await panel.locator('.np-w57-sample summary').click();
    assert.equal(await panel.locator('.np-w57-sample').evaluate(el=>el.open),true);
    await panel.locator('.np-w57-sample summary').click();
    const reset=panel.locator('[data-np-u-type-reset]');
    assert.equal(await reset.evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
    await reset.click();
    assert.equal(await scaleValue.innerText(),'100%');
    await panel.locator('[data-np-u-type-theme=sepia]').click();
    assert.equal(await p.evaluate(()=>window.GBReaderPreferences.get().theme),'sepia');
    await panel.locator('[data-np-u-type-font=cormorant]').click();
    assert.match(await p.locator('#gill-search-p-013').evaluate(e=>getComputedStyle(e).fontFamily),/Cormorant/);
    await snap(p,name+'-settings');
    await p.keyboard.press('Escape');
    assert.equal(await panel.isHidden(),true);
    assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
   });
  }
  if(width<1121) await nativeChecks(extra);
  await extra.context.close();
 }
 const alt=await scene(chrome,'independent-article','/articles/kod-da-vinchi/?reader-pilot=1&paper=space',1440,900);
 await snap(alt.page,'other-article');await alt.context.close();
 safari=await webkit.launch({headless:true});
 for(const [engine,browser] of [['chromium',chrome],['webkit',safari]]){
  for(const path of hardPaths){
   await safe(engine+'-hard-texts-'+path,async()=>{
    const s=await scene(browser,engine+'-hard-texts-'+path,path,1440,900);
    try{
     assert.equal(s.item.state.ready,true);
     assert.equal(await s.page.locator('#npUResearch').count(),1);
     assert.ok(s.item.state.width<=s.item.state.viewport+1,'horizontal overflow');
     const folded=await s.page.evaluate(()=>document.body.classList.contains('np-u-hide-right'));
     await s.page.locator('#npUEdgeToggle').click();
     await s.page.waitForFunction(f=>document.body.classList.contains('np-u-hide-right')!==f,folded);
     await s.page.locator('#npUEdgeToggle').click();
     await s.page.waitForFunction(f=>document.body.classList.contains('np-u-hide-right')===f,folded);
     assert.deepEqual(s.item.errors,[]);
    }finally{await s.context.close()}
   });
  }
 }
 await safe('chromium-section-follow',()=>sectionFollowChecks(chrome,'chromium-section-follow'));
 await safe('webkit-section-follow',()=>sectionFollowChecks(safari,'webkit-section-follow'));
 const w=await scene(safari,'webkit-mobile','/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space',390,844);
 await nativeChecks(w);
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
