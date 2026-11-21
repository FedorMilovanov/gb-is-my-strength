import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const builds=[['62be8ca','62be8caa145fbe18aa099dff89cffa20cd626451',process.env.OLD_ROOT||'/tmp/mobile-62be8caa',19101],['8197727','8197727986ae2b1ddae14f3061bd6905041c8d13',process.env.NEW_ROOT||'/tmp/mobile-8197727',19102]];
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out='reports/mobile-819-qa';await mkdir(out,{recursive:true});const report={browser:b.version(),scenes:[]};
const main='/articles/dzhon-gill-chast-2-uchenyi/';
const layer=p=>p.evaluate(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return{y:scrollY,lock:document.documentElement.hasAttribute('data-scroll-locked'),owner:window.OverlayRuntime.topLayer()?.ownerId||null,focus:a.id||a.tagName,hit:a.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),bar:getComputedStyle(document.querySelector('.mobile-top-bar')).opacity};});
const controls=p=>p.evaluate(()=>{
 const get=s=>document.querySelector(s),p=get('article.article-body > p.reveal');
 const s1=get('[data-gill-font=lora] .font-sample'),s2=get('[data-gill-font=cormorant] .font-sample');
 const font=e=>({size:getComputedStyle(e).fontSize,family:getComputedStyle(e).fontFamily});
 return{prefs:window.GBReaderPreferences.get(),prose:font(p),lora:font(s1),cormorant:font(s2),dots:get('#gillFontDots').childElementCount,lit:get('#gillFontDots').querySelectorAll('.is-on').length};
});
try{for(const [version,sha,root,port] of builds){
 const origin=`http://127.0.0.1:${port}`;
 const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
 try{
  await Promise.race([new Promise((res,rej)=>{server.stdout.once('data',res);server.once('exit',n=>rej(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
  for(const [width,height] of [[320,568],[390,844],[568,320]]){
   const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
   const s={version,sha,width,height,errors:[]};report.scenes.push(s);
   try{
    await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await c.addInitScript(()=>{
     window.speechCalls=[];const synth=new EventTarget();Object.assign(synth,{getVoices:()=>[],speak(u){window.speechCalls.push(u.rate);setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});Object.defineProperty(window,'speechSynthesis',{value:synth});Object.defineProperty(window,'VoskTTSEngine',{value:{isSupported:()=>false,isReady:()=>false},configurable:true,writable:true});
    });
    const p=await c.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+main)).status(),200);
    await p.waitForFunction(()=>window.OverlayRuntime&&window.GBReaderPreferences);await p.evaluate(()=>document.fonts.ready);
    const t=p.locator('.mobile-top-bar [data-gill-marginalia-open]');await t.tap();await p.locator('#partTocOverlay.is-open').waitFor();await p.waitForTimeout(360);
    const summary=p.locator('#gbrMarginalia details summary').first();const pseudo=()=>summary.evaluate(n=>{const a=getComputedStyle(n,'::after');return{content:a.content,transform:a.transform,width:a.borderRightWidth,open:n.parentElement.open};});
    s.chevronClosed=await pseudo();await summary.tap();s.chevronOpen=await pseudo();await summary.tap();
    const handle=p.locator('#partTocOverlay .toc-sheet__handle');s.handle=await handle.evaluate(e=>{const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,w:r.width,h:r.height,hit:e.contains(document.elementFromPoint(x,y))};});
    if(width===390)await p.screenshot({path:`${out}/${version}-analytics-390.png`});
    await p.touchscreen.tap(s.handle.x,s.handle.y);await p.waitForTimeout(490);s.handleTap=await layer(p);if(s.handleTap.owner)await p.keyboard.press('Escape');
    await p.waitForTimeout(430);
    const d=await c.newCDPSession(p);
    const drag=async(x,y,dy)=>{await d.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=9;i++){await d.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+i*dy/9}]});await p.waitForTimeout(20);}await d.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(470);};
    await t.tap();await p.locator('#partTocOverlay.is-open').waitFor();await p.waitForTimeout(320);await drag(s.handle.x,s.handle.y,90);s.handleDrag=await layer(p);if(s.handleDrag.owner)await p.keyboard.press('Escape');await p.waitForTimeout(430);
    const play=p.locator('.mobile-top-bar .reader-mobile-play'),speed=p.locator('#mobSpdBadge');
    s.playBox=await play.boundingBox();s.speedBox=await speed.boundingBox();
    const pr=s.playBox,sr=s.speedBox,x=Math.max(pr.x,sr.x),y=Math.max(pr.y,sr.y);s.overlap=Math.max(0,Math.min(pr.x+pr.width,sr.x+sr.width)-x)*Math.max(0,Math.min(pr.y+pr.height,sr.y+sr.height)-y);
    await p.touchscreen.tap(pr.x+23,pr.y+20);await p.waitForTimeout(420);s.playCenter={state:await play.getAttribute('data-state'),speed:await speed.getAttribute('aria-expanded'),calls:await p.evaluate(()=>window.speechCalls)};
    if(s.playCenter.state==='playing'){await p.touchscreen.tap(pr.x+23,pr.y+20);await p.waitForTimeout(330);s.pause=await play.getAttribute('data-state');}
    await p.keyboard.press('Escape');await p.waitForTimeout(300);
    await p.mouse.move(width*.45,height*.7);await p.mouse.wheel(0,1450);await p.waitForTimeout(470);
    const gear=p.locator('#mobSettingsBtn'),toc=p.locator('#mobPartTocBtn');
    await toc.focus({preventScroll:true});
    for(let i=0;i<7;i++) {await p.keyboard.press('Shift+Tab');if(await gear.evaluate(e=>document.activeElement===e))break;}
    s.gearFocus=await layer(p);assert.equal(s.gearFocus.focus,'mobSettingsBtn');await p.keyboard.press('Enter');await p.locator('#gillSettingsOverlay.is-open').waitFor();
    s.fontStart=await controls(p);
    await p.locator('#gillSettingsOverlay [data-gill-font=cormorant]').tap();
    for(let i=0;i<5;i++)await p.locator('#gillSettingsOverlay [data-fc-action=font-up]').tap();
    await p.waitForTimeout(380);s.fontMax=await controls(p);
    if(width!==568)await p.screenshot({path:`${out}/${version}-font-${width}.png`});
    await p.locator('#gillSettingsOverlay [data-gill-learning-open]').tap();await p.locator('#gillLearningOverlay.is-open').waitFor();await p.waitForTimeout(330);
    await p.keyboard.press('Escape');await p.waitForTimeout(520);s.learningEscape=await layer(p);
   }catch(e){s.probeError=String(e);console.error(version,width,e);process.exitCode=1;}finally{await c.close();}
  }
 }finally{server.kill();await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));}
}}finally{await b.close();}
