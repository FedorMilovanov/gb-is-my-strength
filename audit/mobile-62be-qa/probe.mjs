import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.MOBILE_SHA||'62be8caa145fbe18aa099dff89cffa20cd626451',root=process.env.MOBILE_ROOT||'/tmp/mobile-62be8caa';
const port=19095,origin=`http://127.0.0.1:${port}`,out=process.env.MOBILE_OUT||'reports/mobile-62be-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:b.version(),scenes:[]};
const route='/articles/dzhon-gill-chast-2-uchenyi/';
const gear='#mobSettingsBtn',settings='#gillSettingsOverlay.is-open',chip='.mobile-top-bar .reader-mobile-speed-chip',book='#gb-hl-fab',newNote='#gb-hl-new-note';
async function run(name,width,height,fn,{boot=null,url=route}={}){
 const s={name,width,height,url,pageErrors:[]};report.scenes.push(s);
 const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  if(boot)await c.addInitScript(boot);
  const p=await c.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>s.pageErrors.push(String(e)));
  assert.equal((await p.goto(origin+url)).status(),200);await p.waitForFunction(()=>window.OverlayRuntime&&window.GBReaderPreferences);
  await p.evaluate(()=>document.fonts.ready);await fn(p,s,c);
 }catch(e){s.probeError=String(e);console.error(name,width,height,e);process.exitCode=1;}
 finally{await c.close();}
}
const hitTap=async(p,selector)=>{const r=await p.locator(selector).boundingBox();await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);};
const state=p=>p.evaluate(()=>({expanded:document.getElementById('mobSpdBadge').getAttribute('aria-expanded'),overlay:window.OverlayRuntime.topLayer()?.ownerId||null,play:document.querySelector('.mobile-top-bar button.gb-ember').dataset.state,focus:document.activeElement?.id, y:scrollY}));
const reach=(p,selector)=>p.evaluate(sel=>{
 const panel=document.getElementById('gb-hl-panel'),e=document.querySelector(sel),r=e.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return{hit:e.contains(t),y:r.y,bottom:r.bottom,viewport:innerHeight,panelEnd:panel.getBoundingClientRect().bottom,overflow:getComputedStyle(panel).overflowY,scrollTop:panel.scrollTop,scrollHeight:panel.scrollHeight,client:panel.clientHeight};
},selector);
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const w of [320,390,431,700,961])await run('compacted-gear-hit',w,844,async(p,s)=>{
  s.map=await p.evaluate(()=>{
   const gear=document.getElementById('mobSettingsBtn'),r=gear.getBoundingClientRect(),icon=gear.querySelector('svg').getBoundingClientRect(),badge=document.getElementById('mobSpdBadge');
   let off=0,paint=0,example=null;for(let dy=.5;dy<r.height;dy++)for(let dx=.5;dx<r.width;dx++){
    let x=r.x+dx,y=r.y+dy;if(!badge.contains(document.elementFromPoint(x,y)))continue;
    off++;if(x>=icon.x&&x<icon.right&&y>=icon.y&&y<icon.bottom)paint++;
    if(Math.abs(y-(r.y+r.height/2))<1&&dx>2&&dx<5)example={x,y,dx};
   }
   const chip=document.querySelector('.mobile-top-bar .reader-mobile-speed-chip').getBoundingClientRect();
   const pp=document.querySelector('.mobile-top-bar .reader-mobile-play').getBoundingClientRect();
   return{off,paint,example,chipCenter:{x:chip.x+chip.width/2,y:chip.y+chip.height/2},gear:[r.x,r.y,r.width,r.height],badgeCenterAction:document.elementFromPoint(badge.getBoundingClientRect().x+22,badge.getBoundingClientRect().y+22)?.closest('button')?.className,oldTap:{x:pp.x+27,y:pp.y+32},previousPlayEdge:document.elementFromPoint(pp.x+27,pp.y+32)?.closest('button')?.className};
  });
  if(s.map.example){await p.touchscreen.tap(s.map.example.x,s.map.example.y);await p.waitForTimeout(310);s.gearEdge=await state(p);await p.keyboard.press('Escape');await p.waitForTimeout(500);}
  await hitTap(p,gear);await p.locator(settings).waitFor();s.gearCenter=await state(p);await p.keyboard.press('Escape');await p.waitForTimeout(500);
  await hitTap(p,chip);await p.waitForTimeout(300);s.chip=await state(p);
  if(w===390)await p.screenshot({path:`${out}/01-overlap-390.png`,clip:{x:0,y:0,width:390,height:275}});
  await p.keyboard.press('Escape');await p.waitForTimeout(370);
  await p.touchscreen.tap(s.map.oldTap.x,s.map.oldTap.y);await p.waitForTimeout(360);s.playEdgeTap=await state(p);
 });
 if(!process.env.MOBILE_HIT_ONLY)await run('font-and-analytics',320,568,async(p,s)=>{
  const pref=()=>p.evaluate(async()=>{
   const h=document.documentElement,p=document.querySelector('[data-gill-v16] .article-body p');
   const chosen=await document.fonts.load('16px "Cormorant Garamond"','Слово и мысль');
   return{family:h.dataset.readerFontFamily,css:getComputedStyle(p).fontFamily,russianLoaded:chosen.map(f=>({status:f.status,unicode:f.unicodeRange})),sheet:[...document.querySelectorAll('[data-gill-font]')].map(el=>[el.dataset.gillFont,el.getAttribute('aria-pressed')])};
  });
  await hitTap(p,gear);await p.locator(settings).waitFor();s.before=await pref();
  await p.locator('[data-gill-font=cormorant]').tap();s.after=await pref();
  await p.screenshot({path:`${out}/02-font-320.png`});
  await p.reload();s.reloaded=await pref();
  await hitTap(p,gear);await p.locator(settings).waitFor();await p.locator('#gillSettingsReset').tap();s.reset=await pref();
  await p.keyboard.press('Escape');await p.waitForTimeout(520);
  const t=p.locator('.mobile-top-bar [data-gill-marginalia-open]');s.triggerName=await t.getAttribute('aria-label');await t.tap();await p.waitForTimeout(450);
  s.analytics=await p.evaluate(()=>({heading:document.querySelector('#partTocOverlay .toc-head-txt h3').textContent.trim(),sheetName:document.querySelector('#partTocOverlay [role=dialog]').getAttribute('aria-label'),tab:document.getElementById('gbrMarginaliaTab').textContent.trim(),role:window.OverlayRuntime.topLayer()?.ownerId}));
  await p.screenshot({path:`${out}/03-analytics-320.png`});await p.keyboard.press('Escape');await p.waitForTimeout(510);
  s.returned=await t.evaluate(e=>document.activeElement===e);
 });
 if(!process.env.MOBILE_HIT_ONLY)for(const [w,h] of [[568,320],[390,450],[320,500],[320,520],[320,521],[320,568]])await run('short-library',w,h,async(p,s)=>{
  await p.locator(book).tap();const foot=p.locator(newNote);await foot.waitFor();await p.waitForTimeout(450);s.initial=await reach(p,newNote);
  try{await foot.tap({timeout:1330});}catch(e){s.tapFailure=String(e).split('\n').slice(0,3).join(' ');}
  s.afterTry=await reach(p,newNote);
  const area=p.locator('#gb-hl-note-text');s.editor=await area.isVisible();
  if(!s.editor){await p.screenshot({path:`${out}/04-library-${w}x${h}.png`});return;}
  await area.fill(`Проверка ${w}×${h}`);
  const submit='#gb-hl-editor [type=submit]';
  if(w===320&&h===500){await p.setViewportSize({width:320,height:350});await p.waitForTimeout(250);}
  s.submit=await reach(p,submit);
  try{await p.locator(submit).tap({timeout:1450});}catch(e){s.submitFailure=String(e).split('\n').slice(0,3).join(' ');}
  s.saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(n=>n.text));
 });
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
