import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out=process.env.ANALYTICS_OUT||'reports/analytics-parity-qa';await mkdir(out,{recursive:true});
const builds=[['62be8caa145fbe18aa099dff89cffa20cd626451',process.env.OLD_ROOT||'/tmp/mobile-62be8caa',19103],['8197727986ae2b1ddae14f3061bd6905041c8d13',process.env.NEW_ROOT||'/tmp/mobile-8197727',19104]];
if(process.env.EXTRA_SHA&&process.env.EXTRA_ROOT)builds.push([process.env.EXTRA_SHA,process.env.EXTRA_ROOT,19105]);
const docs=[['gill','/articles/dzhon-gill-chast-2-uchenyi/','sec-systematics'],['bapt','/baptisty-rossii/goneniya-i-sovest/','ogpu-1923']];
const modes=[['mobile',390,844,true,true],['native-desktop',1440,900,false,false],['W57-desktop',1440,900,false,true]];
const report={browser:b.version(),scenes:[],swipes:[]};
const wait=p=>p.waitForTimeout(455);
const open=async(p,entry='toc')=>{if(entry==='toc')await p.locator('#mobPartTocBtn').tap();else await p.locator('.mobile-top-bar [data-gill-marginalia-open]').tap();await p.locator('#partTocOverlay.is-open').waitFor();if(entry==='toc')await p.locator('#gbrMarginaliaTab').tap();await p.locator('#gbrMarginalia:not([hidden])').waitFor();await wait(p);};
const nativeState=p=>p.evaluate(()=>{
 const $=s=>document.querySelector(s);const n=$('#gbrMarginalia'),host=$('#partTocOverlay'),app=$('#npUResearch'),a=document.activeElement;
 const text=el=>el?.textContent?.replace(/\s+/g,' ').trim()||null;
 return {path:location.pathname,hash:location.hash,y:scrollY,lock:document.documentElement.hasAttribute('data-scroll-locked'),owner:window.OverlayRuntime.topLayer()?.ownerId||null,
 native:!!n,open:host?.classList.contains('is-open'),nativeResearchVisible:!!n&&!n.hidden&&!!n.getClientRects().length&&host.classList.contains('is-open'),
 contract:window.GBReaderContract?.version||null,w57:!!app,w57Visible:!!app&&!!app.getClientRects().length&&!document.body.classList.contains('np-u-hide-right')&&getComputedStyle(app).visibility!=='hidden',personalW57:!!$('#npW57NotesDetails'),library:!!$('#gb-hl-panel'),
 active:window.GBReaderState?.getActiveSection()||null,focus:a?.id||a?.className||a?.tagName,
 scroll:n?.scrollTop,panelTranslate:getComputedStyle($('#partTocOverlay .toc-sheet')).transform,peek:!!$('.gbs2-peek.gbs2-on'),
 mobileTitle:text($('.gbr-marginalia-lead h3')),mobileGroups:[...document.querySelectorAll('.gbr-marginalia-group-head')].map(el=>[text(el.querySelector('h4,strong')),text(el.querySelector('span'))]),
 mobileRefs:[...document.querySelectorAll('.gbr-marginalia-chips button')].map(text),mobileRefsScope:text($('.gbr-marginalia-chips')?.parentElement?.querySelector('.gbr-marginalia-empty')),personalMobile:!![...document.querySelectorAll('.gbr-marginalia-group-head strong')].find(el=>text(el)==='Мои пометы'),
 mobileTerms:[...document.querySelectorAll('.gbr-marginalia-term summary')].map(text),mobileEvidence:[...document.querySelectorAll('.gbr-marginalia-evidence p')].map(text),
 desktopGroup:text($('.np-u-major-link[aria-current="location"] .np-u-major-name')),desktopGroupId:$('.np-u-major-link[aria-current="location"]')?.dataset.npUGoto,
 desktopSections:window.GBReaderContract?.inspect().groups.map(g=>({id:g.id,primary:g.primaryIds}))||null,
 desktopTerms:[...document.querySelectorAll('#npUResearch [data-np-u-lex-picker] option')].map(text),desktopRefs:[...document.querySelectorAll('#npUResearch [data-np-u-scripture-picker] option')].map(text),
 desktopModules:[...document.querySelectorAll('#npUResearch [data-np-u-module]')].map(el=>[el.dataset.npUModule,text(el.querySelector('summary strong'))]),
 desktopEvidence:[...document.querySelectorAll('#npUThoughtAnalysis .np-u-thought-evidence')].map(text),
 desktopEvidenceTargets:[...document.querySelectorAll('#npUThoughtAnalysis [data-np-u-evidence-index]')].map(el=>{
  const target=window.GBReaderContract.articleRoot(document).querySelectorAll('p,blockquote')[Number(el.dataset.npUEvidenceIndex)];return {id:target?.id,text:text(target)?.slice(0,95)};
 })};
});
async function scene(c,p,mode,section,s){
 if(mode==='W57-desktop'){
  await p.waitForFunction(()=>document.querySelector('#npW57NotesDetails')&&document.querySelector('#npUSectionHost [data-np-u-module]'));
  const edge=p.locator('#npUEdgeToggle');if(await edge.getAttribute('aria-expanded')!=='true')await edge.click();
  await p.waitForFunction(()=>document.querySelector('#npUResearch').getAttribute('aria-hidden')==='false');await wait(p);
 }
 const heading=p.locator(`#${section}`);await heading.waitFor();
 s.headingLabel=await heading.innerText();s.atStart=await nativeState(p);
 await heading.evaluate(el=>scrollBy(0,el.getBoundingClientRect().top+40));await wait(p);
 s.before=await nativeState(p);
 if(mode==='mobile'){
  await open(p);s.analytics=await nativeState(p);assert.equal(s.analytics.owner,'gill-part-toc');assert.equal(s.analytics.w57,false);
  const phrase=p.locator('#gbrMarginalia .gbr-marginalia-evidence button').first();
  assert.ok(s.analytics.mobileEvidence.length);
  await p.screenshot({path:`${out}/${s.key}.png`});
  const evidenceGroup=p.locator('#gbrMarginalia details.gbr-marginalia-group').filter({hasText:'Ход текста'});
  if(await evidenceGroup.count())await evidenceGroup.locator(':scope > summary').tap();
  await phrase.tap();await p.waitForTimeout(780);s.jump=await nativeState(p);
  s.jumpDestination=await p.evaluate(()=>window.lastJump||null);assert.equal(s.jump.owner,null);
  if(section==='ogpu-1923'&&s.analytics.mobileRefs.includes('Рим. 13:1–5')){
   await heading.evaluate(el=>scrollBy(0,el.getBoundingClientRect().top+40));await wait(p);await open(p);
   const scripture=p.locator('#gbrMarginalia details.gbr-marginalia-group').filter({has:p.getByText('Писание',{exact:true})});await scripture.locator(':scope > summary').tap();
   await scripture.getByRole('button',{name:'Рим. 13:1–5',exact:true}).tap();await p.waitForTimeout(780);s.scriptureJump=await p.evaluate(()=>window.lastJump);s.scriptureJumpState=await nativeState(p);
  }
 }else{
  s.analytics=await nativeState(p);
  if(mode==='W57-desktop'){assert.equal(s.analytics.w57Visible,true);await p.screenshot({path:`${out}/${s.key}.png`});}
  else{assert.equal(s.analytics.w57,false);assert.equal(s.analytics.nativeResearchVisible,false);}
 }
}
async function swipes(c,p,s){
 const state=()=>nativeState(p);const panel=p.locator('#gbrMarginalia');const d=await c.newCDPSession(p);
 const drag=async(dx,dy,where='body')=>{
  const r=await p.locator(where==='body'?'#gbrMarginalia':'#partTocOverlay .toc-sheet__handle').boundingBox();
  const x=where==='body'?(dx<0?r.x+r.width*.71:r.x+r.width*.24):r.x+r.width/2;
  const y=where==='body'?r.y+Math.min(r.height*.46,180):r.y+r.height/2;
  await p.evaluate(()=>window.touchLog=[]);
  const send=(type,points)=>d.send('Input.dispatchTouchEvent',{type,touchPoints:points});await send('touchStart',[{x,y}]);
  for(let i=1;i<=11;i++){await send('touchMove',[{x:x+dx*i/11,y:y+dy*i/11}]);await p.waitForTimeout(20);}
  const during=await state();await send('touchEnd',[]);await wait(p);const after=await state();
  return{dx,dy,where,during:{transform:during.panelTranslate,scroll:during.scroll,peek:during.peek},after:{owner:after.owner,scroll:after.scroll,path:after.path,y:after.y,focus:after.focus,lock:after.lock},trace:await p.evaluate(()=>window.touchLog)};
 };
 async function one(name,dx,dy,{scrollFirst=false,where='body',entry='toc'}={}){
  if(await p.locator('#partTocOverlay.is-open').count()){await p.keyboard.press('Escape');await wait(p);}
  await open(p,entry);
  if(scrollFirst){const terms=panel.locator('details.gbr-marginalia-group').filter({hasText:'Понятия'});if(await terms.count())await terms.locator(':scope > summary').tap();const evidence=panel.locator('details.gbr-marginalia-group').filter({hasText:'Ход текста'});if(await evidence.count())await evidence.locator(':scope > summary').tap();}
  await panel.evaluate(el=>el.scrollTop=0);
  const g={name};s.cases.push(g);
  if(scrollFirst)g.prepare=await drag(0,-130);
  g.before=await state();g.result=await drag(dx,dy,where);
  assert.ok(g.result.trace.some(e=>e.type==='touchstart'&&e.trusted));
  if(g.result.after.owner)await p.keyboard.press('Escape');await wait(p);
 }
 await one('horizontal-content',-158,0,{entry:'top'});
 await one('down-away-from-top',0,95,{scrollFirst:true});
 await one('down-from-top',0,96);
 await one('mostly-horizontal-down-from-top',-157,88);
 await one('short-down-from-top',0,64);
 await one('handle-when-content-scrolled',0,95,{scrollFirst:true,where:'handle'});
 await d.detach();
}
try{for(const [sha,root,port] of builds.filter(([sha])=>!process.env.ONLY_SHA||sha.startsWith(process.env.ONLY_SHA))){
 const origin=`http://127.0.0.1:${port}`;
 const server=spawn('python3',['-u',root+'/research/reader-w57-pilot/preview.py'],{env:{...process.env,READER_W57_DIST:root+'/dist',READER_W57_PORT:String(port)},stdio:['ignore','pipe','ignore']});
 try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const [doc,path,section] of docs)for(const [mode,width,height,mobile,pilot] of modes){
  const s={sha,doc,mode,width,height,key:`${sha.slice(0,7)}-${doc}-${mode}`,errors:[]};report.scenes.push(s);
  const c=await b.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   await c.addInitScript(()=>{window.touchLog=[];for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>window.touchLog.push({type,trusted:e.isTrusted,area:e.target.closest('#gbrMarginalia')?.id||e.target.closest('.toc-sheet__handle')?.className||e.target.tagName}),{passive:true});const f=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){if(this.closest('article'))window.lastJump={id:this.id,tag:this.tagName,text:this.textContent.trim().slice(0,100),motion:args[0]?.behavior};return f.apply(this,args);};});
   const p=await c.newPage();p.setDefaultTimeout(5500);p.on('pageerror',e=>s.errors.push(String(e)));const url=origin+path+(pilot?'?reader-pilot=1&paper=space':'');
   assert.equal((await p.goto(url)).status(),200);await p.waitForFunction(()=>window.GBReaderState&&window.OverlayRuntime);await p.evaluate(()=>document.fonts.ready);
   await scene(c,p,mode,section,s);
   if(mode==='mobile'&&doc==='gill'){
    await p.reload();await p.waitForFunction(()=>window.OverlayRuntime);await p.evaluate(()=>scrollTo(0,0));await wait(p);
    const g={sha,doc,width,height,cases:[]};report.swipes.push(g);await swipes(c,p,g);
   }
  }catch(e){s.probeError=String(e);console.error(s.key,e);process.exitCode=1;}finally{await c.close();}
 }
 }finally{server.kill();await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));}
}}finally{await b.close();}
