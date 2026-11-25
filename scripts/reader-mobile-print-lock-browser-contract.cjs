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
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await engine.launch({headless:true});
  try{
   for(const item of ROOTS){
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
     results.push({browser:engineName,route:item.label,pass:true,cleanPages,lockedPages});
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
