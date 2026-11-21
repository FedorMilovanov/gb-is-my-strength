import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const root='/tmp/mobile-e4d110e2',sha='e4d110e2b0e829e045bed67dd2f4debb83f5a9be',out=process.env.QA_OUT||'reports/reader-w64-independent';
const port=19151,origin=`http://127.0.0.1:${port}`,route='/articles/dzhon-gill-chast-2-uchenyi/',other='/articles/dzhon-gill-chast-4-ekzeget/',target='sec-trinity';
await mkdir(out,{recursive:true});const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const open=p=>p.locator('#gb-hl-fab').tap();
const load=async(p,path)=>{assert.equal((await p.goto(origin+path)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary);};
const state=p=>p.evaluate(({route,target})=>({path:location.pathname,scroll:scrollY,anchor:JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}')[route.slice(0,-1)]||null,
 active:document.activeElement?.id,overlay:document.querySelector('#gb-hl-backdrop')?.classList.contains('is-open'),locked:document.documentElement.hasAttribute('data-scroll-locked'),
 headingY:document.getElementById(target)?.getBoundingClientRect().top??null}),{route,target});
async function record(p){
 await open(p);await p.locator('[data-research-action=start-current]').tap();await p.locator('#gb-hl-close').tap();
 await p.locator('#'+target).evaluate(e=>scrollBy({top:e.getBoundingClientRect().top-95,behavior:'instant'}));
 await p.waitForFunction(({route,target})=>JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}')[route.slice(0,-1)]?.anchor===target,{route,target});
}
async function resume(p){
 const loc=p.locator(`[data-research-action=resume][data-value="${route.slice(0,-1)}"]`);
 await loc.tap();await p.waitForFunction(target=>document.activeElement?.id===target&&document.getElementById(target)?.getBoundingClientRect().top<200,target);
 return state(p);
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const width of [320,390]){
  const c=await b.newContext({viewport:{width,height:width===320?568:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  const s={width,errors:[]};report.scenes.push(s);
  try{
   await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   const page=async path=>{const p=await c.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>s.errors.push(String(e)));await load(p,path);return p;};
   const p=await page(route);await record(p);s.saved=await state(p);
   await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await open(p);s.beforeSame=await state(p);
   assert.equal(s.beforeSame.anchor.anchor,target);assert.equal(s.beforeSame.scroll,0);s.same=await resume(p);assert.equal(s.same.overlay,false);
   const side=await page(other);await open(side);s.beforeAcross=await state(side);s.across=await resume(side);assert.equal(s.across.path,route);
   await p.bringToFront();await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(350);
   await p.locator('#mobPartTocBtn').tap();const toc=p.locator('#gbs2PartToc');await toc.waitFor();await p.evaluate(()=>document.fonts.ready);
   s.toc=await toc.evaluate(e=>({nums:[...e.querySelectorAll('.gbat-hd>.gbat-num:not(.gbat-num--label)')].map(x=>[x.textContent.trim(),getComputedStyle(x).fontSize,getComputedStyle(x).fontFamily]),titles:[...e.querySelectorAll('.gbat-t')].map(x=>[x.textContent,x.scrollWidth>x.clientWidth+1]),overflow:e.scrollWidth-e.clientWidth}));
   await toc.evaluate(e=>e.querySelector('.gbat-part:last-child .gbat-hd').scrollIntoView({block:'nearest',behavior:'instant'}));
   await p.screenshot({path:`${out}/product-toc-${width}.png`});
   await p.locator('#gbrMarginaliaTab').tap();await p.locator('#gbrMarginalia:not([hidden])').waitFor();
   s.analytics=await p.locator('.gbr-marginalia-lead h3').evaluate(e=>({weight:getComputedStyle(e).fontWeight,family:getComputedStyle(e).fontFamily}));
   s.groups=await p.locator('.gbr-marginalia-group-head strong').evaluateAll(els=>els.map(e=>[e.textContent.trim(),getComputedStyle(e).fontWeight]));
   assert.deepEqual(s.errors,[]);
  }catch(e){s.probeError=String(e);console.error(width,e);process.exitCode=1;}finally{await c.close();}
 }
}finally{await writeFile(`${out}/resume-and-toc.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
