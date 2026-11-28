#!/usr/bin/env node
'use strict';

// The actual reader UI + canonical SiteUtils lock owner must preserve every
// substantive PDF page when printing from a mobile overlay. Same contract
// also verifies that afterprint restores the pre-existing user-visible state.
const assert = require('node:assert/strict');
const {chromium, webkit} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const DIST = path.resolve(__dirname, '../dist');
const localDist = process.argv.includes('--dist');
const coldOnly = process.argv.includes('--cold-only');
const printExecutable = process.env.GB_PRINT_CHROMIUM_EXECUTABLE;
assert(!coldOnly || localDist, 'cold-only requires built dist');
assert(!printExecutable || localDist, 'alternate Chromium requires built dist');
const OUT = process.env.GB_MOBILE_PRINT_ARTIFACT_DIR;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml',
 '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
async function serveDist() {
 assert(!process.env.GB_PRINT_LOCAL_SITE_UTILS, 'built-dist mode must not replace runtime assets');
 assert(fs.existsSync(path.join(DIST,'baptisty-rossii/index.html')), 'build production-like dist first');
 const server=http.createServer((req,res)=>{
  try {
   let file=path.resolve(DIST,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
   if(!file.startsWith(DIST+path.sep)&&file!==DIST)throw Error('outside dist');
   if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   if(!fs.statSync(file).isFile())throw Error('not a file');
   res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
   fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('not found')}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 return server;
}
function pdfText(buffer) {
 return execFileSync('pdftotext',['-enc','UTF-8','-layout','-','-'],{input:buffer,maxBuffer:16*1024*1024});
}
const ROOTS = [
  {path:'/baptisty-rossii/',open:'#gbs2Bbar',owner:'gbs2-sheet',label:'baptists-book'},
  {path:'/nagornaya/chast-1/',open:'#barSectionBtn',owner:'nagornaya-btoc',label:'nagornaya-toc'},
  {path:'/nagornaya/chast-1/',open:'#menuBtn',owner:'nagornaya-menu',label:'nagornaya-menu'},
  {path:'/articles/dzhon-gill-istoricheskiy-kontekst/',open:'#mobPartTocBtn',owner:'gill-part-toc',label:'gill'},
  {path:'/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',open:'#hmSectionBtn',owner:'hermenevtika-toc',label:'hermenevtika'},
  {path:'/baptisty-rossii/noch-na-kure/',open:'#mobPartTocBtn',owner:'gill-part-toc',label:'baptists'},
];
function pages(buffer){return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;}
// Cold print must preserve the actual last paper sheet, not merely the DOM.
async function verifyColdPrint(browser,base,mode) {
 const label='cold-print-'+mode;
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
   reducedMotion:'reduce',colorScheme:'light',serviceWorkers:'block'});
 const requested=[];
 const markers=['SOLI DEO GLORIA','Telegram','Email','\u041d\u0430\u0448\u043b\u0438 \u043d\u0435\u0442\u043e\u0447\u043d\u043e\u0441\u0442\u044c'];
 const normalize=text=>text.normalize('NFKC').toLowerCase().replace(/[\s\u00ad\u200b-\u200d]/g,'');
 try{
  await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  page.on('request',r=>{if(/\/fonts\/.*\.woff2(?:\?|$)/.test(r.url()))requested.push(r.url())});
  if(mode==='menu')await page.addInitScript(()=>{window.__coldPrintCalls=0;window.print=()=>window.__coldPrintCalls++});
  const response=await page.goto(base+'/articles/anatomiya-padeniya-pyat-stadiy/?reader-pilot=0',{waitUntil:'load'});
  assert.equal(response?.status(),200,label+' HTTP');
  await page.waitForFunction(()=>window.GBPrintEngine?.version===2.1&&typeof window.GBPrintPagination?.prepare==='function');
  const breadcrumb=page.locator('.breadcrumb__current');
  assert.equal(await breadcrumb.evaluate(e=>getComputedStyle(e).fontWeight),'500',label+' screen emphasis');
  const visibleSource=normalize(await page.locator('body').innerText());
  assert(markers.every(m=>visibleSource.includes(normalize(m))),label+' source contains end blocks');
  const texts=[],counts=[];
  for(let i=0;i<2;i++){
   if(mode==='menu'){
    await page.locator('[data-reader-pdf]:visible').click();
    await page.locator('[data-reader-export-command=print]:visible').click();
    await page.waitForFunction(n=>window.__coldPrintCalls===n,i+1,{timeout:5000});
    const report=await page.evaluate(()=>window.GBPrintEngine.getReport());
    assert.equal(report?.source,'export-menu',label+' canonical menu owner');
    assert.equal(report?.prepared,true,label+' prepared before native print');
   }
   const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
   const text=pdfText(pdf);
   texts.push(text);counts.push(pages(pdf));
   const sheets=text.toString('utf8').split('\f');
   if(!sheets.at(-1).trim())sheets.pop();
   assert.equal(sheets.length,counts[i],label+' extracted physical page count');
   const last=normalize(sheets.slice(-2).join(''));
   assert(markers.every(m=>last.includes(normalize(m))),label+' missing final content on copy '+(i+1));
  }
  assert.equal(counts[0],counts[1],label+' first/repeat page count');
  assert(counts[0]>1&&texts[0].equals(texts[1]),label+' exact first/repeat text/layout parity');
  assert(!requested.some(u=>u.includes('sourcesans3-cyrillic-500.woff2')),label+' no new print-only breadcrumb font');
  await page.emulateMedia({media:'print'});
  assert.equal(await breadcrumb.evaluate(e=>getComputedStyle(e).fontWeight),'400',label+' stable print face');
  await page.emulateMedia({media:'screen'});
  assert.equal(await breadcrumb.evaluate(e=>getComputedStyle(e).fontWeight),'500',label+' screen style restored');
  console.log('PASS chromium/'+label+' '+counts.join('/')+' pages; all final markers');
  return {browser:'chromium',version:browser.version(),route:label,pass:true,cleanPages:counts[0],lockedPages:counts[1]};
 }finally{await page.close()}
}
async function assertState(page,owner,locked,context) {
 const actual=await page.evaluate(()=>({
  overlay:window.OverlayRuntime?.snapshot().map(s=>s.ownerId)||[],
  lock:document.documentElement.getAttribute('data-scroll-locked'),
  sources:Object.keys(window.SiteUtils?._scrollLockSources||{}).sort(),
  body:getComputedStyle(document.body).position,
  rootHeight:document.documentElement.scrollHeight,
  bodyHeight:document.body.scrollHeight
 }));
 assert.equal(actual.lock,locked?'1':null,context+' scroll lock');
 if(locked){
  assert(actual.overlay.includes(owner),context+' overlay remains open');
  assert.deepEqual(actual.sources,['overlay:'+owner],context+' exactly one canonical lock owner');
  assert.equal(actual.body,'fixed',context+' position');
 }else assert.equal(actual.body,'static',context+' unlocked position');
 return actual;
}
(async()=>{
 const results=[];
 const server=localDist?await serveDist():null;
 const URL=server?'http://127.0.0.1:'+server.address().port:
  String(process.env.AUDIT_BASE || 'https://gospod-bog.ru').replace(/\/$/,'');
 if(OUT)fs.mkdirSync(OUT,{recursive:true});
 try {
 for(const [engineName,engine] of (coldOnly?[['chromium',chromium]]:[['chromium',chromium],['webkit',webkit]])) {
  const browser=await engine.launch({headless:true,...(engineName==='chromium'&&printExecutable?{executablePath:printExecutable,args:['--disable-gpu']}: {})});
  try{
   if(localDist&&engineName==='chromium')for(const mode of ['direct','menu']){
    try{results.push(await verifyColdPrint(browser,URL,mode))}
    catch(e){results.push({browser:engineName,route:'cold-print-'+mode,pass:false,reason:String(e.message).slice(0,600)});console.error('FAIL chromium/cold-print-'+mode+': '+e.message)}
   }
   for(const item of (coldOnly?[]:ROOTS)){
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'light',serviceWorkers:'block'});
    if(localDist)await page.route('**/*',r=>r.request().url().startsWith(URL+'/')?r.continue():r.abort());
    if(process.env.GB_PRINT_LOCAL_SITE_UTILS === '1') {
      const local = fs.readFileSync(path.resolve(__dirname,'../js/site-utils.js'),'utf8');
      await page.route(/\/js\/site-utils\.js(?:\?|$)/, route=>route.fulfill({status:200,contentType:'application/javascript',body:local}));
    }
    try {
     const response=await page.goto(URL+item.path,{waitUntil:'domcontentloaded',timeout:30000});
     assert.equal(response?.status(),200,item.label+' HTTP');
     await page.waitForFunction(()=>window.OverlayRuntime && window.GBReaderActions && window.SiteUtils?.suspendScrollForPrint,undefined,{timeout:16000});
     const clean=await assertState(page,item.owner,false,item.label+' clean');
     await page.evaluate(async()=>{await document.fonts.ready});
     let cleanPages=0,cleanText=null;
     if(engineName==='chromium'){
      const pdf=await page.pdf({format:'A4',printBackground:true});
      cleanPages=pages(pdf);
      cleanText=pdfText(pdf);
      assert(cleanText.length>1000,item.label+' substantive PDF text');
      if(OUT)fs.writeFileSync(path.join(OUT,item.label+'-closed.pdf'),pdf);
      assert(cleanPages>1,item.label+' clean route must be multi-page');
     }
     await page.locator(item.open+':visible').click();
     await page.waitForFunction(owner=>window.OverlayRuntime?.isOpen(owner)&&document.documentElement.getAttribute('data-scroll-locked')==='1',item.owner,{timeout:10000});
     const before=await assertState(page,item.owner,true,item.label+' before printing');
     let lockedPages=0;
     if(engineName==='chromium'){
      const pdf=await page.pdf({format:'A4',printBackground:true});
      lockedPages=pages(pdf);
      if(OUT)fs.writeFileSync(path.join(OUT,item.label+'-open.pdf'),pdf);
      assert(pdfText(pdf).equals(cleanText),item.label+' exact PDF text/layout parity');
      assert.equal(lockedPages,cleanPages,item.label+' PDF page count with overlay open');
     }else{
      await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
      const during=await page.evaluate(()=>({rootHeight:document.documentElement.scrollHeight,locked:document.documentElement.getAttribute('data-scroll-locked')}));
      assert.equal(during.locked,null,item.label+' WebKit beforeprint release');
      assert(during.rootHeight>1200,item.label+' WebKit print flow');
      await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
     }
     const after=await assertState(page,item.owner,true,item.label+' after printing');
     assert.equal(after.sources.length,before.sources.length,item.label+' owner source count restored');
     assert.deepEqual(after.overlay,before.overlay,item.label+' overlay identity intact');
     await page.keyboard.press('Escape');
     await page.waitForFunction(owner=>!window.OverlayRuntime.isOpen(owner)&&!document.documentElement.hasAttribute('data-scroll-locked'),item.owner);
     await assertState(page,item.owner,false,item.label+' after Escape');
     let repeatFocus=0;
     if(item.owner==='nagornaya-btoc'||item.owner==='nagornaya-menu'){
      const panel=item.owner==='nagornaya-btoc'?'#btocPanel':'#mobileMenu';
      const opener=page.locator(item.open);
      await page.evaluate(()=>scrollTo({top:640,behavior:'instant'}));
      await page.waitForFunction(()=>scrollY>=639);
      const position=await page.evaluate(()=>scrollY);
      for(let round=0;round<3;round++){
       // Use actual pointer activation; WebKit does not implicitly focus a
       // clicked button. Blur the old opener so stale registration cannot pass.
       await page.evaluate(()=>document.activeElement?.blur());
       await opener.click();
       await page.waitForFunction(({owner,panel})=>window.OverlayRuntime.isOpen(owner)&&document.querySelector(panel)?.contains(document.activeElement),{owner:item.owner,panel});
       await assertState(page,item.owner,true,item.label+' repeat open '+round);
       await page.keyboard.press('Escape');
       await page.waitForFunction(({owner,open,position})=>!window.OverlayRuntime.isOpen(owner)&&!document.documentElement.hasAttribute('data-scroll-locked')&&document.activeElement===document.querySelector(open)&&Math.abs(scrollY-position)<=1,{owner:item.owner,open:item.open,position});
       const state=await assertState(page,item.owner,false,item.label+' repeat close '+round);
       assert.deepEqual(state.sources,[],item.label+' no stale lock');
       assert.deepEqual(state.overlay,[],item.label+' no stale overlay');
       assert.equal(await opener.getAttribute('aria-expanded'),'false',item.label+' closed ARIA');
       repeatFocus++;
      }
     }
     results.push({browser:engineName,route:item.label,pass:true,cleanPages,lockedPages,repeatFocus});
     console.log('PASS '+engineName+'/'+item.label+' PDF '+(lockedPages?lockedPages+'/'+cleanPages:'WebKit owner lifecycle'));
    }catch(e){
     results.push({browser:engineName,route:item.label,pass:false,reason:String(e.message).slice(0,600)});
     console.error('FAIL '+engineName+'/'+item.label+': '+String(e.message).slice(0,900));
    }finally{await page.close()}
   }
  }finally{await browser.close()}
 }
 }finally{if(server)await new Promise(r=>server.close(r))}
 if(OUT)fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({localDist,results},null,2));
 const pass=results.filter(r=>r.pass).length;
 console.log('Mobile print scroll owner contract '+pass+'/'+results.length+' PASS');
 if(pass!==results.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
