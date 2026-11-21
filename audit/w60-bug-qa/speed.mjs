import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const port=Number(process.env.W58_PORT||19083),origin=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',process.env.W58_DIST||'/tmp/w60-bug-e567400/dist'],{stdio:'ignore'});
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out=process.env.W58_OUT||'reports/w60-e567400';await mkdir(out,{recursive:true});const report={sha:process.env.W58_SHA||'e567400e7381be3786907396e1ecd6e69a4547c2',browser:browser.version(),scenes:[]};
try{
 for(const width of [320,390]){
  const c=await browser.newContext({viewport:{width,height:width===320?700:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{const speech=new EventTarget();window.__utterances=[];window.__selected=[];window.addEventListener('gb:tts-rate-change',e=>window.__selected.push(e.detail.rate));Object.assign(speech,{getVoices:()=>[],speak(u){window.__utterances.push(u.rate);setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});Object.defineProperty(window,'speechSynthesis',{value:speech});Object.defineProperty(window,'VoskTTSEngine',{value:{isSupported:()=>false,isReady:()=>false},writable:true,configurable:true});});
  const page=await c.newPage();const scene={width,errors:[]};report.scenes.push(scene);page.on('pageerror',e=>scene.errors.push(e.message));
  const res=await page.goto(origin+'/articles/dzhon-gill-chast-2-uchenyi/',{waitUntil:'domcontentloaded'});
  if(res.status()!==200)throw new Error('HTTP '+res.status());
  await page.waitForFunction(()=>document.querySelector('.mobile-top-bar').dataset.readerSpeedBound==='1'&&window.GBReaderTTS);
  await page.evaluate(()=>document.fonts.ready);
  const rail=page.locator('#mobileSpeedrail'),badge=page.locator('#mobSpdBadge'),play=page.locator('.mobile-top-bar .gb-ember').first();
  const attrs=()=>page.evaluate(()=>{const rail=document.querySelector('#mobileSpeedrail');const hit=(el,r,x=.5,y=.5)=>el.contains(document.elementFromPoint(r.x+x*r.width,r.y+y*r.height));const btn=id=>{const el=document.getElementById(id); if(!el)return null; const r=el.getBoundingClientRect();return {w:r.width,h:r.height,hit:hit(el,r),inert:el.inert};};const a=document.activeElement;return {expanded:document.getElementById('mobSpdBadge').getAttribute('aria-expanded'),play:document.querySelector('.mobile-top-bar .gb-ember').dataset.state,owner:window.OverlayRuntime.topLayer()?.ownerId??null,focus:a.id||a.dataset.speed||a.tagName,focusLabel:a.getAttribute('aria-label'),marginaliaInert:document.querySelector('.mobile-top-bar [data-gill-marginalia-open]').inert,rate:rail.querySelector('[aria-checked="true"]')?.dataset.speed,scroll:rail.scrollLeft,end:rail.scrollWidth-rail.clientWidth,rates:window.__utterances,events:window.__selected,nav:[btn('mobBackBtn'),btn('mobHomeBtn')],top:scrollY};});
  const shot=label=>page.screenshot({path:`${out}/${width}-${label}.png`,animations:'disabled'});
  const swipe=async(leftward=true)=>{const box=await rail.boundingBox();const cdp=await c.newCDPSession(page);const y=box.y+box.height/2,x=leftward?box.x+box.width-8:box.x+8;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=17;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(leftward?-1:1)*i*(box.width-16)/17,y}]});await page.waitForTimeout(16);
   }
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);await cdp.detach();
  };
  const painted=await badge.locator('.reader-mobile-speed-chip').boundingBox();
  const px=painted.x+2,py=painted.y+painted.height/2;
  await page.touchscreen.tap(px,py);await rail.waitFor();await page.waitForTimeout(240);scene.badge=await attrs();
  const first=rail.locator('[data-speed="1"]');await first.focus();await page.keyboard.press('ArrowRight');scene.arrow=await attrs();
  await page.keyboard.press('Escape');await rail.waitFor({state:'hidden'});scene.escape=await attrs();
  await play.tap();await page.waitForFunction(()=>document.querySelector('.mobile-top-bar .gb-ember').dataset.state==='playing');
  if(!(await rail.isVisible()))await badge.tap();
  await rail.waitFor(); await page.waitForTimeout(240);scene.playOpen=await attrs();
  for(let i=0;i<3;i++){const state=await attrs();if(state.end-state.scroll<=1)break;await swipe();}
  scene.afterSwipe=await attrs();
  const last=rail.locator('[data-speed="2"]');
  const hit=await last.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))};});scene.lastHit=hit;
  await shot('swipe-end');
  if(hit.hit){await page.touchscreen.tap(hit.x,hit.y);await page.waitForTimeout(420);}scene.afterChoice=await attrs();
  const top=page.locator('.mobile-top-bar [data-gill-marginalia-open]');
  if(await top.isVisible()&&scene.afterChoice.expanded==='false'){
   await top.tap();await page.locator('#partTocOverlay.is-open #gbrMarginalia').waitFor();scene.research=await attrs();await page.keyboard.press('Escape');await page.waitForTimeout(600);scene.researchEscape=await attrs();
  }
  // Open with keyboard, then activate footer TOC via keyboard while the rail is still open (no pointerdown).
  await badge.focus();await page.keyboard.press('Enter');await rail.waitFor();
  const toc=page.locator('#mobPartTocBtn');
  let reached=false;for(let i=0;i<12;i++){await page.keyboard.press('Tab');if(await toc.evaluate(e=>document.activeElement===e)){reached=true;break;}}
  if(!reached)throw new Error('Tab did not reach the lower TOC');await page.keyboard.press('Enter');await page.locator('#partTocOverlay.is-open').waitFor();scene.keyBoth=await attrs();
  await page.keyboard.press('Escape');await page.waitForTimeout(640);scene.keyBothEscape=await attrs();await page.keyboard.press('Escape');await rail.waitFor({state:'hidden'});scene.keySecondEscape=await attrs();
  if(width===320){
   await badge.tap();await rail.waitFor();await page.waitForTimeout(220);
   await page.setViewportSize({width:700,height:320});await page.waitForTimeout(400);scene.rotated=await attrs();
   for(let i=0;i<4;i++){if((await attrs()).scroll<=1)break;await swipe(false);}
   const low=rail.locator('[data-speed="0.75"]');
   const box=await low.boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
   await page.touchscreen.tap(x,y);await page.waitForTimeout(380);scene.rotatedChoice=await attrs();
  }

  await c.close();
 }
}finally{await writeFile(`${out}/speed.json`,JSON.stringify(report,null,2));await browser.close();server.kill();}
