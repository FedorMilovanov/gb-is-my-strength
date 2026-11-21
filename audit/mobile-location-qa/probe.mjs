import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha='62be8caa145fbe18aa099dff89cffa20cd626451',root=process.env.MOBILE_ROOT||'/tmp/mobile-62be8caa';
const origin='http://127.0.0.1:19098',out='reports/mobile-location-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server','19098','--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:b.version(),scenes:[]};
const main='/articles/dzhon-gill-chast-2-uchenyi/',bapt='/baptisty-rossii/goneniya-i-sovest/';
const state=p=>p.evaluate(()=>{
 const toc=document.getElementById('gbs2PartToc'); const box=toc.getBoundingClientRect();const trim=x=>x.textContent.replace(/\s+/g,' ').trim();
 const info=n=>{const a=n.getAttribute('href');const r=n.getBoundingClientRect();return {href:a,text:trim(n),current:n.getAttribute('aria-current'),visible:r.top>=box.top&&r.bottom<=box.bottom&&r.height>0};};
 const saved=window.GBReaderState.getSaved();const a=document.activeElement;
 return{scrollY,hash:location.hash,progress:document.getElementById('gbs2MobPct')?.textContent,section:document.getElementById('gbs2MobSec')?.textContent,
  locked:document.documentElement.getAttribute('data-scroll-locked'),active:window.GBReaderState.getActiveSection(), saved:saved&&{id:saved.sectionId,y:saved.scrollY,progress:saved.progress},owner:window.OverlayRuntime.topLayer()?.ownerId||null,focus:a.id||a.tagName,
  tocScroll:toc.scrollTop,activeRows:[...toc.querySelectorAll('a[href^="#"].active,a[href^="#"][aria-current]')].map(info), links:[...toc.querySelectorAll('.gbat-part.cur a[href^="#"]')].map(info),
  resume:[...document.querySelectorAll('.gbs2-resume.gbs2-on,#bookmarkToast.visible')].map(n=>trim(n))};
});
async function run(name,width,fn){
 const s={name,width,pageErrors:[]};report.scenes.push(s);
 const c=await b.newContext({viewport:{width,height:width===320?568:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const open=async path=>{const p=await c.newPage();p.setDefaultTimeout(4500);p.on('pageerror',e=>s.pageErrors.push(String(e)));assert.equal((await p.goto(origin+path)).status(),200);await p.waitForFunction(()=>window.GBReaderState&&window.OverlayRuntime);await p.evaluate(()=>document.fonts.ready);return p;};
  await fn(open,s);
 }catch(e){s.probeError=String(e);console.error(name,width,e);process.exitCode=1;}finally{await c.close();}
}
const bottom=async p=>{await p.locator('#mobPartTocBtn').tap();await p.locator('#partTocOverlay.is-open').waitFor();await p.waitForTimeout(440);};
const select=p=>p.locator(`#gbs2PartToc .gbat-part.cur a[href="#sec-systematics"]`);
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const width of [320,390])await run('toc-after-trusted-jump',width,async(open,s)=>{
  const p=await open(main);await bottom(p);s.atStart=await state(p);
  await select(p).tap();await p.waitForTimeout(900);s.afterJump=await state(p);assert.equal(s.afterJump.hash,'#sec-systematics');
  await bottom(p);s.reopened=await state(p);await p.screenshot({path:`${out}/toc-${width}.png`});
  await p.keyboard.press('Escape');await p.waitForTimeout(510);s.escape=await state(p);
 });
 await run('bapt-deep-link',390,async(open,s)=>{
  const p=await open(bapt);await bottom(p);s.atStart=await state(p);
  const chosen=s.atStart.links[2];assert.ok(chosen?.href);s.chosen=chosen;
  await p.locator(`#gbs2PartToc .gbat-part.cur a[href="${chosen.href}"]`).tap();await p.waitForTimeout(850);s.afterJump=await state(p);
  await bottom(p);s.reopened=await state(p);
 });
 for(const hash of ['', '#main-content','#sec-pneumatology','#missing-section'])await run('return-to-reading',390,async(open,s)=>{
  s.inputHash=hash;
  const reader=await open(main);
  await reader.mouse.move(180,435);await reader.mouse.wheel(0,16000);
  await reader.waitForFunction(()=>window.GBReaderState.getSaved()?.progress>15);s.seed=await state(reader);
  const p=await open(main+hash);await p.waitForTimeout(1250);s.landing=await state(p);
  if(await p.locator('.gbs2-resume.gbs2-on .gbs2-resume-go').isVisible()){
    if(hash==='#sec-pneumatology')await p.screenshot({path:`${out}/resume-with-anchor.png`});
    await p.locator('.gbs2-resume-go').tap();await p.waitForTimeout(720);s.afterResume=await state(p);
  }
 });
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
