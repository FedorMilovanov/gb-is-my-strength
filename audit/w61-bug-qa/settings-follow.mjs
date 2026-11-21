import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const builds=[['W60','e567400e7381be3786907396e1ecd6e69a4547c2',process.env.W60_PR_ROOT||'/tmp/w60-bug-e567400',19088],['W61',process.env.W61_SHA||'d1234989ffb7f8c27da3b9bbce1eca0355597c2a',process.env.W61_ROOT||'/tmp/w61-bug-d123498',19089]];
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out=process.env.W61_OUT||'reports/w61-bug-qa';await mkdir(out,{recursive:true});
const report={browser:browser.version(),scenes:[]};
const route='/articles/dzhon-gill-chast-2-uchenyi/';
async function scene(origin,width,motion='reduce'){
 const context=await browser.newContext({viewport:{width,height:width===320?700:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:motion});
 await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 await context.addInitScript(()=>{
  const speech=new EventTarget();window.__utterances=[];window.__scrolls=[];window.__userWheel=[];
  addEventListener('wheel',e=>window.__userWheel.push({time:performance.now(),trusted:e.isTrusted,dy:e.deltaY}),{passive:true});
  const scroll=Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView=function(...args){window.__scrolls.push({t:performance.now(),id:this.id,tag:this.tagName,body:this.closest('article')?.className,y:scrollY,args,stack:new Error().stack.split('\n').slice(2,5)});return scroll.apply(this,args);};
  Object.assign(speech,{getVoices:()=>[],speak(u){window.__utterances.push(u);setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});
  Object.defineProperty(window,'speechSynthesis',{value:speech,configurable:true});
  Object.defineProperty(window,'VoskTTSEngine',{value:{isSupported:()=>false,isReady:()=>false},writable:true,configurable:true});
 });
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 assert.equal((await p.goto(origin+route,{waitUntil:'domcontentloaded'})).status(),200);
 await p.waitForFunction(()=>window.OverlayRuntime&&window.GBReaderTTS&&document.querySelector('.mobile-top-bar')?.dataset.readerSpeedBound==='1');
 await p.evaluate(()=>document.fonts.ready);
 return{p,context,errors};
}
const state=p=>p.evaluate(()=>{
 const bar=document.querySelector('.mobile-top-bar'), gear=document.getElementById('mobSettingsBtn'), r=gear.getBoundingClientRect();
 const g=getComputedStyle(bar), a=document.activeElement;
 return {y:scrollY,barOpacity:g.opacity,barTransform:g.transform,hidden:!!bar.closest('.gbs2-tbhidden'),gearParent:gear.closest('.mobile-top-bar,.mobile-bottom-bar')?.className,gearTop:r.top,gearBottom:r.bottom,gearHit:gear.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),gearExpanded:gear.getAttribute('aria-expanded'),active:a.id||a.tagName,activeLabel:a.getAttribute('aria-label'),layer:window.OverlayRuntime.topLayer()?.ownerId||null,locked:document.documentElement.hasAttribute('data-scroll-locked'),play:document.querySelector('.mobile-top-bar .gb-ember')?.dataset.state,calls:window.__utterances.length};
});
try{
for(const [version,sha,root,port] of builds){
 const origin='http://127.0.0.1:'+port;
 const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
 try{
  await Promise.race([new Promise((res,rej)=>{server.stdout.once('data',res);server.once('exit',code=>rej(Error('Server exit '+code)));}),new Promise((_,rej)=>setTimeout(()=>rej(Error('server start timeout')),3000))]);
  for(const width of [320,390]){
   const {p,context,errors}=await scene(origin,width);const s={version,sha,width,name:'settings-tabs',errors};report.scenes.push(s);
   try{
    const gear=p.locator('#mobSettingsBtn');
    // No control is focused; trusted wheel hides the top bar like a real scroll down.
    await p.mouse.move(width/2,350);await p.mouse.wheel(0,1400);await p.waitForFunction(()=>document.querySelector('.gbs2-tbhidden'));await p.waitForTimeout(375);
    s.scrolled=await state(p);
    // Start at the visible bottom TOC and move through the adjacent DOM controls.
    await p.locator('#mobPartTocBtn').focus({preventScroll:true});
    s.keyBefore=await state(p);
    if(version==='W61'){
     s.focusPath=[];
     for(let i=0;i<8;i++){
      await p.keyboard.press('Shift+Tab');s.focusPath.push(await state(p));
      if(await gear.evaluate(e=>document.activeElement===e))break;
     }
    }else await p.keyboard.press('Tab');
    s.keyFocus=await state(p);assert.equal(s.keyFocus.active,'mobSettingsBtn');
    if(version==='W61'&&width===390)await p.screenshot({path:out+'/01-invisible-settings-focus.png'});
    await p.keyboard.press('Enter');await p.locator('#gillSettingsOverlay.is-open').waitFor();await p.waitForTimeout(250);s.open=await state(p);
    await p.keyboard.press('Escape');await p.waitForTimeout(610);s.escape=await state(p);
    await p.keyboard.press('Enter');await p.locator('#gillSettingsOverlay.is-open').waitFor();
    const learning=p.locator('#gillSettingsOverlay [data-gill-learning-open]');
    if(await learning.count()){
     for(let i=0;i<30;i++){await p.keyboard.press('Tab');if(await learning.evaluate(e=>document.activeElement===e))break;}
     assert.equal(await learning.evaluate(e=>document.activeElement===e),true);
     await p.keyboard.press('Enter');await p.locator('#gillLearningOverlay.is-open').waitFor();await p.keyboard.press('Escape');await p.waitForTimeout(580);s.learningEscape=await state(p);
    }
   }finally{await context.close();}
  }
  {
   const {p,context,errors}=await scene(origin,390,'no-preference');const s={version,sha,width:390,name:'manual-scroll-follow',errors};report.scenes.push(s);
   try{
    await p.locator('.mobile-top-bar button.gb-ember').tap();await p.waitForFunction(()=>window.__utterances.length===1);await p.waitForTimeout(800);
    s.play=await state(p);
    await p.keyboard.press('Escape'); // dismiss offered speed rail; transport still playing
    await p.mouse.move(210,405);await p.mouse.wheel(0,1800);await p.waitForTimeout(300);
    s.user=await p.evaluate(()=>({y:scrollY,wheel:window.__userWheel.at(-1),t:performance.now(),chars:window.__utterances[0].text.length}));
    assert.equal(s.user.wheel.trusted,true);
    // Simulate completion of the current speech chunk at the Web Speech boundary only.
    // Production code still owns advance(), follow, and scroll.
    await p.evaluate(()=>{window.__scrolls=[];window.__utterances.at(-1).onend?.({});});
    await p.waitForFunction(()=>window.__utterances.length===2);await p.waitForTimeout(760);
    s.after=await state(p);s.trace=await p.evaluate(()=>window.__scrolls);assert.equal(s.after.play,'playing');
    if(version==='W61'){
     const gear=p.locator('#mobSettingsBtn');
     await gear.tap();await p.locator('#gillSettingsOverlay.is-open').waitFor();s.activeSettings=await state(p);
     await p.locator('#gillSettingsOverlay [data-gill-theme-btn][data-theme="dark"]').tap();s.theme=await p.evaluate(()=>document.documentElement.dataset.readerTheme);
     await p.keyboard.press('Escape');await p.waitForTimeout(600);s.activeEscape=await state(p);
     await p.locator('.mobile-top-bar button.gb-ember').tap();await p.waitForFunction(()=>document.querySelector('.mobile-top-bar .gb-ember').dataset.state==='paused');
     await gear.tap();await p.locator('#gillSettingsOverlay.is-open').waitFor();s.pausedSettings=await state(p);
     await p.keyboard.press('Escape');await p.waitForTimeout(600);s.pausedEscape=await state(p);
    }
   }finally{await context.close();}
  }
 }finally{server.kill();await writeFile(out+'/evidence.json',JSON.stringify(report,null,2));}
}
}finally{await browser.close();}
