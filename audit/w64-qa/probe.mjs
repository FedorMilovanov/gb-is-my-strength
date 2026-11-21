import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha='249bb866213fc1b86fb8b3e73af146d2417a0087';
const root=process.env.W64_ROOT||'/tmp/w64-bug-249bb866';
const port=19092, origin=`http://127.0.0.1:${port}`;
const out=process.env.W64_OUT||'reports/w64-qa';await mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:browser.version(),scenes:[]};
const main='/articles/dzhon-gill-chast-2-uchenyi/';
const play='.mobile-top-bar .reader-mobile-play', gear='#mobSettingsBtn', badge='#mobSpdBadge';
const center=r=>[r.x+r.width/2,r.y+r.height/2];
const tap=async(p,selector)=>p.touchscreen.tap(...center(await p.locator(selector).boundingBox()));
const phase=async(p)=>p.locator(play).getAttribute('data-state');
const speed=async(p)=>p.locator(badge).getAttribute('aria-expanded');
const geom=(p)=>p.evaluate(()=>{
 const get=s=>document.querySelector('.mobile-top-bar '+s);
 const selectors={play:'.reader-mobile-play',badge:'#mobSpdBadge',chip:'.reader-mobile-speed-chip',gear:'#mobSettingsBtn',bookmark:'.mobile-top-save'};
 const els=Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,get(s)]));
 const rect=e=>{const {x,y,width,height}=e.getBoundingClientRect();return{x,y,width,height};};
 const r=Object.fromEntries(Object.entries(els).map(([k,e])=>[k,rect(e)]));
 for(const k of ['play','badge','gear','bookmark']){
  const e=els[k], counts={};
  for(let dy=.5;dy<r[k].height;dy++)for(let dx=.5;dx<r[k].width;dx++){
   const h=document.elementFromPoint(r[k].x+dx,r[k].y+dy);const n=Object.keys(els).filter(k=>k!=='chip').find(k=>els[k]?.contains(h))||'other';counts[n]=(counts[n]||0)+1;
  }r[k].counts=counts;
 }
 const st=getComputedStyle(els.badge,'::before');r.pseudo={pointer:st.pointerEvents,background:st.backgroundColor,border:st.borderTopWidth};
 return r;
});
async function run(name,width,height,fn,{route=main,motion='no-preference',mode='light'}={}){
 const scene={name,width,height,motion,mode,route,errors:[]};report.scenes.push(scene);
 const c=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:motion,colorScheme:mode});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{
   window.events=[];window.calls=[];window.trace=[];
   ['pointerdown','pointerup','pointercancel','click','touchstart','touchmove','touchend'].forEach(t=>addEventListener(t,e=>window.events.push([t,e.isTrusted,e.target.closest('button')?.id||e.target.closest('button')?.className||e.target.tagName]),{capture:true,passive:true}));
   const f=Element.prototype.scrollIntoView;
   Element.prototype.scrollIntoView=function(...args){window.trace.push({id:this.id,y:scrollY,args});return f.apply(this,args);};
   const ss=new EventTarget();Object.assign(ss,{getVoices:()=>[],speak(u){window.calls.push(u);setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});
   Object.defineProperty(window,'speechSynthesis',{value:ss});
   Object.defineProperty(window,'VoskTTSEngine',{value:{isReady:()=>false,isSupported:()=>false},configurable:true,writable:true});
  });
  const p=await c.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>scene.errors.push(String(e)));
  assert.equal((await p.goto(origin+route,{waitUntil:'domcontentloaded'})).status(),200);
  await p.waitForFunction(()=>window.GBReaderTTS&&window.OverlayRuntime&&document.querySelector('.mobile-top-bar')?.dataset.readerSpeedBound==='1');
  await p.evaluate(()=>document.fonts.ready);await fn(p,scene,c);
 }catch(e){scene.error=String(e);console.error(name,width,e);process.exitCode=1;}finally{await c.close();}
}
async function drag(c,p,x,y,endY,hold=0){
 const cdp=await c.newCDPSession(p);
 const send=(type,yy)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:yy}]});
 await send('touchStart',y);
 if(hold)await p.waitForTimeout(hold);
 else for(let i=1;i<=9;i++){await send('touchMove',y+(endY-y)*i/9);await p.waitForTimeout(20);}
 await send('touchEnd',endY);await p.waitForTimeout(430);await cdp.detach();
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',v=>j(Error('server '+v)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 if(!process.env.W64_MOTION_ONLY)for(const w of [320,361,390,430,431,768,960,961,1120])await run('hit',w,844,async(p,s,c)=>{
  s.poses=await geom(p);if(![320,390,431,961].includes(w))return;
  const r=s.poses.play;
  const hit=async(x,y)=>{await p.touchscreen.tap(x,y);await p.waitForTimeout(300);return{at:[x,y],phase:await phase(p),speed:await speed(p),calls:await p.evaluate(()=>window.calls.length),event:await p.evaluate(()=>window.events.filter(e=>e[0]==='click').at(-1))};};
  s.chip=await hit(...center(s.poses.chip));assert.equal(s.chip.speed,'true');assert.equal(s.chip.calls,0);
  await p.keyboard.press('Escape');
  s.oldEdge=await hit(r.x+27,r.y+32);assert.equal(s.oldEdge.phase,'playing');
  await p.keyboard.press('Escape');
  s.sameEdgePause=await hit(r.x+27,r.y+32);assert.equal(s.sameEdgePause.phase,'paused');
  s.center=await hit(...center(r));assert.equal(s.center.phase,'playing');
  if(await speed(p)==='true')await p.keyboard.press('Escape');
  if(w===390){
   await p.evaluate(()=>{window.events=[];});
   const [x,y]=center(r);
   await drag(c,p,x,y,y,800);
   s.longPress={phase:await phase(p),speed:await speed(p),calls:await p.evaluate(()=>window.calls.length),events:await p.evaluate(()=>window.events)};
  }
  await tap(p,gear);await p.locator('#gillSettingsOverlay.is-open').waitFor({timeout:2000});
  s.settings={phase:await phase(p),speed:await speed(p),layers:await p.evaluate(()=>Array.from(document.querySelectorAll('.toc-overlay.is-open')).map(n=>n.id))};
  await p.keyboard.press('Escape');await p.waitForTimeout(550);
  s.escaped=await p.evaluate(()=>({speed:document.getElementById('mobSpdBadge').getAttribute('aria-expanded'),active:document.activeElement?.id}));
 });
 if(!process.env.W64_MOTION_ONLY)for(const [w,h] of [[320,568],[700,320]])await run('short-settings-and-marginalia',w,h,async(p,s,c)=>{
  await tap(p,gear);await p.locator('#gillSettingsOverlay.is-open').waitFor();await p.waitForTimeout(360);
  const info=()=>p.evaluate(()=>{
   const body=document.querySelector('#gillSettingsOverlay .toc-sheet__body'),bar=document.querySelector('.mobile-bottom-bar');
   return{scrollTop:body.scrollTop,scrollHeight:body.scrollHeight,client:body.clientHeight,dock:bar?.getBoundingClientRect().top,body:JSON.parse(JSON.stringify(body.getBoundingClientRect())),buttons:Array.from(document.querySelectorAll('.gill-settings-footer button')).map(n=>{const r=n.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{text:n.textContent,top:r.top,bottom:r.bottom,hit:n.contains(hit),owner:hit?.closest('[role=dialog],.mobile-bottom-bar')?.className};})};
  });
  s.before=await info();
  for(let i=0;i<6;i++){const {body}=await info();await drag(c,p,Math.round(body.x+body.width*.7),Math.floor(Math.min(h-18,body.bottom-14)),Math.ceil(body.top+18));}
  s.after=await info();
  await p.screenshot({path:`${out}/settings-${w}x${h}.png`});
  await tap(p,'.gill-settings-done');await p.waitForTimeout(370);
  s.doneClosed=await p.locator('#gillSettingsOverlay.is-open').count()===0;
  if(!s.doneClosed)await p.keyboard.press('Escape');
  const trigger='.mobile-top-bar [data-gill-marginalia-open]';
  await tap(p,trigger);await p.waitForTimeout(450);
  s.marginalia=await p.evaluate(()=>{const d=window.OverlayRuntime.topLayer();const e=document.querySelector('.gill-marginalia-overlay.is-open');return {layer:d?.ownerId,dialogs:[...document.querySelectorAll('[role=dialog]')].filter(n=>n.getBoundingClientRect().width&&n.closest('.is-open')).map(n=>({title:document.getElementById(n.getAttribute('aria-labelledby'))?.textContent||n.getAttribute('aria-label'),bounds:JSON.parse(JSON.stringify(n.getBoundingClientRect()))})),main:e?.textContent?.trim().replace(/\s+/g,' ').slice(0,130)};});
  await p.keyboard.press('Escape');await p.waitForTimeout(470);
  s.marginaliaEscaped=await p.evaluate(()=>({onTrigger:document.activeElement?.hasAttribute('data-gill-marginalia-open'),layer:window.OverlayRuntime.topLayer()?.ownerId||null}));
 });
 if(!process.env.W64_MOTION_ONLY)await run('keyboard-speed-settings',390,844,async(p,s)=>{
  await p.locator(badge).focus();await p.keyboard.press('Enter');
  assert.equal(await speed(p),'true');s.path=[];
  for(let i=0;i<10;i++){
   await p.keyboard.press('Tab');s.path.push(await p.evaluate(()=>document.activeElement.id||document.activeElement.textContent.trim().slice(0,35)));
   if(s.path.at(-1)==='mobSettingsBtn')break;
  }
  assert.equal(s.path.at(-1),'mobSettingsBtn');await p.keyboard.press('Enter');
  await p.locator('#gillSettingsOverlay.is-open').waitFor();s.open={speed:await speed(p),phase:await phase(p)};
  await p.keyboard.press('Escape');await p.waitForTimeout(550);
  s.escaped=await p.evaluate(()=>({speed:document.getElementById('mobSpdBadge').getAttribute('aria-expanded'),active:document.activeElement?.id,inert:document.querySelector('.mobile-top-bar [data-gill-marginalia-open]').inert,layer:window.OverlayRuntime.topLayer()?.ownerId||null}));
 });
 for(const [motion,pref] of [['no-preference','system'],['no-preference','reduced'],['reduce','reduced']])await run('motion-follow',390,844,async(p,s)=>{
  s.preference=pref;
  await tap(p,gear);await p.locator('#gillSettingsOverlay.is-open').waitFor();
  const mode=p.locator(`#gillSettingsOverlay [data-motion=${pref}]`);await mode.tap();
  s.selected=await mode.getAttribute('aria-pressed');assert.equal(s.selected,'true');await p.locator('.gill-settings-done').tap();await p.locator('#gillSettingsOverlay.is-open').waitFor({state:'hidden'});await p.waitForTimeout(440);
  await p.locator(play).tap();await p.waitForFunction(()=>window.calls.length===1);await p.waitForTimeout(700);
  const ring=()=>p.evaluate(()=>{const play=document.querySelector('.mobile-top-bar .reader-mobile-play'),r=play.querySelector('.gb-ember__ring-progress');return{offset:getComputedStyle(r).strokeDashoffset,duration:getComputedStyle(r).transitionDuration,p:play.style.getPropertyValue('--p'),mode:document.documentElement.dataset.readerMotion,calls:window.calls.length};});
  s.ringBefore=await ring();
  await p.evaluate(()=>{const u=window.calls[0];u.onboundary?.({charIndex:Math.floor(u.text.length*.85)});});
  await p.waitForTimeout(620);s.ringAfter=await ring();
  await p.keyboard.press('Escape');await p.mouse.move(180,380);await p.mouse.wheel(0,1700);await p.waitForTimeout(310);
  s.scrolled=await p.evaluate(()=>scrollY);
  await p.evaluate(()=>{window.trace=[];window.calls[0].onend?.({});});
  await p.waitForFunction(()=>window.calls.length===2);await p.waitForTimeout(830);
  s.follow=await p.evaluate(()=>({trace:window.trace,y:scrollY}));
 },{motion});
}finally{await writeFile(out+'/evidence.json',JSON.stringify(report,null,2));server.kill();await browser.close();}
