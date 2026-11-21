import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const root=process.env.W64_ROOT||'/tmp/w64-bug-249bb866';
const sha='249bb866213fc1b86fb8b3e73af146d2417a0087',port=19094,base=`http://127.0.0.1:${port}`;
const out=process.env.MA_OUT||'reports/mobile-actions-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:browser.version(),scenes:[]};
const main='/articles/dzhon-gill-chast-2-uchenyi/';
const bapt='/baptisty-rossii/goneniya-i-sovest/';
const toc='#mobPartTocBtn',overlay='#partTocOverlay.is-open',listen='#partTocOverlay [data-gbat-listen]',resume='#partTocOverlay [data-gbat-continue]';
const ember='.mobile-top-bar button.gb-ember',save='.mobile-top-bar [data-fc-action=save]';
const phase=p=>p.locator(ember).getAttribute('data-state');
const pstate=p=>p.evaluate(()=>({y:scrollY,lock:document.documentElement.getAttribute('data-scroll-locked'),layers:[...(window.OverlayRuntime?.getStack?.()||[])].map(x=>x.ownerId),top:window.OverlayRuntime?.topLayer()?.ownerId||null,focus:document.activeElement?.id,section:document.getElementById('gbs2MobSec')?.textContent,progress:document.getElementById('gbs2DualProgress')?.getAttribute('aria-label'),saved:window.GBReaderState?.getSaved?.(),phase:document.querySelector('.mobile-top-bar button.gb-ember')?.dataset.state,calls:window.calls.length}));
const close=async p=>{await p.keyboard.press('Escape');await p.waitForTimeout(540);};
const open=async p=>{await p.locator(toc).tap();await p.locator(overlay).waitFor();await p.waitForTimeout(370);};
async function run(name,fn,{width=390,route=main,shareMode='copy',motion='no-preference'}={}){
 const s={name,width,route,shareMode,motion,errors:[]};report.scenes.push(s);
 const c=await browser.newContext({viewport:{width,height:width===320?568:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:motion,serviceWorkers:'block'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await c.addInitScript(({shareMode})=>{
   window.calls=[];window.shared=[];window.copied=[];window.printed=[];window.scrollCalls=[];
   const f=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){window.scrollCalls.push({id:this.id,y:scrollY,options:args[0]});return f.apply(this,args);};
   const speech=new EventTarget();Object.assign(speech,{getVoices:()=>[],speak(u){window.calls.push({rate:u.rate,activation:navigator.userActivation.isActive});setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});
   Object.defineProperty(window,'speechSynthesis',{value:speech});Object.defineProperty(window,'VoskTTSEngine',{value:{isSupported:()=>false,isReady:()=>false},configurable:true,writable:true});
   Object.defineProperty(navigator,'share',{value:shareMode==='copy'?undefined:async payload=>{window.shared.push({payload,activation:navigator.userActivation.isActive});if(shareMode==='abort')throw new DOMException('Cancelled by tester','AbortError');}});
   Object.defineProperty(navigator,'clipboard',{value:{async writeText(text){window.copied.push(text);}}});
   window.print=()=>{window.dispatchEvent(new Event('beforeprint'));window.printed.push({y:scrollY,lock:document.documentElement.getAttribute('data-scroll-locked'),top:window.OverlayRuntime?.topLayer()?.ownerId||null,report:window.GBPrintEngine?.getReport?.()});window.dispatchEvent(new Event('afterprint'));};
  },{shareMode});
  const p=await c.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));
  assert.equal((await p.goto(base+route)).status(),200);
  await p.waitForFunction(()=>window.OverlayRuntime&&window.GBReaderActions&&window.GBReaderState);await p.evaluate(()=>document.fonts.ready);
  await fn(p,s,c);
 }catch(e){s.probeError=String(e);console.error(name,e);process.exitCode=1;}
 finally{await c.close();}
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4500))]);
 if(!process.env.MA_CONTINUE_ONLY)for(const route of [main,bapt])await run('listen-from-contents',async(p,s)=>{
  await open(p);const text=()=>p.locator(listen).evaluate(e=>({visible:e.innerText,accessible:e.getAttribute('aria-label'),disabled:e.disabled}));
  s.idleLabel=await text();await p.locator(listen).tap();await p.waitForFunction(()=>window.calls.length===1);await p.waitForTimeout(690);s.afterFirst=await pstate(p);
  await open(p);s.playingLabel=await text();await p.screenshot({path:`${out}/listen-${s.route===main?'gill':'bapt'}.png`});
  await p.locator(listen).tap();await p.waitForTimeout(480);s.afterSecond=await pstate(p);
  await open(p);s.pausedLabel=await text();await p.locator(listen).tap();await p.waitForTimeout(480);s.afterThird=await pstate(p);s.calls=await p.evaluate(()=>window.calls);
 },{route});
 for(const [motion,input] of [['no-preference','passive'],['reduce','passive'],['no-preference','wheel-saved'],['no-preference','wheel-fast'],['no-preference','wheel-stale']])await run('continue-in-long-section',async(p,s)=>{
  s.input=input;
  if(input==='passive'){
   await p.locator('#gill-search-p-068').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(1400);
  }else{
   const delta=await p.locator('#gill-search-p-068').evaluate(el=>el.getBoundingClientRect().top+scrollY-innerHeight*.42);
   await p.mouse.move(190,490);
   if(input==='wheel-stale'){
    await p.mouse.wheel(0,10500);
    await p.waitForFunction(()=>window.GBReaderState.getSaved()?.scrollY>=10000);
    s.prior=await pstate(p);
   }
   const current=await p.evaluate(()=>scrollY);await p.mouse.wheel(0,delta-current);await p.waitForFunction(()=>scrollY>18000);
   if(input==='wheel-saved')await p.waitForTimeout(1650);
  }
  s.before=await pstate(p);
  if(input==='wheel-stale')await p.screenshot({path:`${out}/continue-before.png`});
  await open(p);await p.evaluate(()=>{window.scrollCalls=[];});await p.locator(resume).tap();await p.waitForTimeout(1050);s.after=await pstate(p);s.calls=await p.evaluate(()=>window.scrollCalls);
  if(input==='wheel-stale')await p.screenshot({path:`${out}/continue-after.png`});
 },{motion});
 if(!process.env.MA_CONTINUE_ONLY)for(const [width,shareMode] of [[320,'copy'],[390,'native'],[390,'abort']])await run('save-library-share-pdf',async(p,s)=>{
  const share='.mobile-bottom-bar [data-action=share]',pdf='.mobile-bottom-bar [data-action=print]';
  await p.locator(share).tap();await p.waitForTimeout(380);
  s.share=await p.evaluate(()=>({shared:window.shared,copied:window.copied,status:document.querySelector('.mobile-bottom-bar [data-action=share]')?.dataset.shareStatus,toast:document.querySelector('.gb-fc-toast.is-open')?.innerText}));
  if(shareMode!=='native'){
   await p.locator(pdf).tap();await p.waitForTimeout(260);
   s.normalPrint=await p.evaluate(()=>window.printed);
   await p.mouse.move(175,340);await p.mouse.wheel(0,1550);await p.waitForTimeout(440);s.beforeTocPrint=await pstate(p);
   await open(p);await p.locator('#partTocOverlay [data-action=print]').tap();await p.waitForTimeout(340);s.sheetPrint={seen:await p.evaluate(()=>window.printed),after:await pstate(p)};
   await close(p);s.afterTocPrint=await pstate(p);
   await p.mouse.wheel(0,-1700);await p.waitForTimeout(470);
  }
  const saveButton=p.locator(save);await saveButton.tap();await p.waitForTimeout(400);s.saved=await saveButton.getAttribute('aria-pressed');
  await p.reload();await p.waitForFunction(()=>window.GBFavoriteStore);await p.waitForTimeout(1250);s.savedAfterReload=await saveButton.getAttribute('aria-pressed');
  const lib=p.locator('#gb-hl-fab');await lib.tap();await p.waitForTimeout(630);s.library={dialogs:await p.locator('[role=dialog]:visible').allTextContents(),state:await pstate(p)};
  await close(p);s.afterLibrary=await pstate(p);
 },{width,shareMode});
}finally{await writeFile(out+'/evidence.json',JSON.stringify(report,null,2));server.kill();await browser.close();}
