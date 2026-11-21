import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.MOBILE_SHA||'f8df423a308fb3b84081bae1cd338c6d4e35a3a8';
const root=process.env.MOBILE_ROOT||'/tmp/mobile-f8df423a',out=process.env.MOBILE_OUT||'reports/mobile-argon-qa';
await mkdir(out,{recursive:true});
const port=Number(process.env.MOBILE_PORT||19125),origin=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const q={panel:'#gbrMarginalia',rail:'.gbr-scripture-rail',ref:'.gbr-scripture-ref',chosen:'.gbr-scripture-ref[aria-pressed=true]',prev:'.gbr-scripture-step:first-child',next:'.gbr-scripture-step:last-child',passage:'.gbr-scripture-passage',dest:'.gbr-scripture-return'};
const report={sha,browser:b.version(),scenes:[]};
const gill='/articles/dzhon-gill-chast-2-uchenyi/',exegete='/articles/dzhon-gill-chast-4-ekzeget/',bapt='/baptisty-rossii/goneniya-i-sovest/';
const wait=(p,ms=420)=>p.waitForTimeout(ms);
const chapter=p=>p.locator('details.gbr-marginalia-group').filter({has:p.getByText('Писание',{exact:true})});
const row=(p,label)=>p.locator(q.rail).getByRole('button',{name:label,exact:true});
const snap=p=>p.evaluate(q=>{
 const $=s=>document.querySelector(s),t=s=>$(s)?.textContent.trim()||null;
 const rail=$(q.rail),panel=$(q.panel),chosen=$(q.chosen),passage=$(q.passage),r=rail?.getBoundingClientRect(),v=chosen?.getBoundingClientRect(),p=panel?.getBoundingClientRect(),x=passage?.getBoundingClientRect();
 const elem=document.activeElement,labels=[...document.querySelectorAll(q.ref)].map(e=>({label:e.textContent,top:e.offsetTop,h:e.offsetHeight,w:e.offsetWidth}));
 const overlap=(a,z,b,y)=>Math.max(0,Math.min(z,y)-Math.max(a,b));
 const verse=t('.gbr-scripture-quote'),src=t('.gbr-scripture-source'),projection=window.SCRIPTURE_DATA||{};
 const geom=s=>{const e=$(s),r=e?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:r.height,bg:getComputedStyle(e).backgroundColor}:null;};
 const fonts=[...document.fonts].filter(f=>f.family.includes('GB Cormorant Scripture')).map(f=>[f.family,f.status]);
 return {route:location.pathname,y:scrollY,owner:window.OverlayRuntime.topLayer()?.ownerId||null,locked:document.documentElement.hasAttribute('data-scroll-locked'),layout:{panel:geom(q.panel),sheet:geom('#partTocOverlay .toc-sheet'),head:geom('#partTocOverlay .toc-sheet__head'),footer:geom('#partTocOverlay .gbat-foot'),quote:geom(q.passage)},fonts,dark:document.documentElement.classList.contains('dark'),title:t('.gbr-marginalia-lead h3'),scope:t('.gbr-scripture-scope'),selected:chosen?.textContent||null,reading:t('#gbrScriptureActiveRef'),count:t('.gbr-scripture-count'),verse,src,projectsAs:Object.keys(projection).filter(k=>projection[k]===verse&&window.SCRIPTURE_SOURCE_BY_REF?.[k]===src),keys:Object.keys(projection),focus:elem?.id||elem?.className||elem?.tagName,focusLabel:elem?.getAttribute('aria-label')||elem?.textContent.trim().slice(0,65),jump:window.qaJump,labels,
  rail:r?{l:r.left,r:r.right,t:r.top,b:r.bottom,left:rail.scrollLeft,max:rail.scrollWidth-rail.clientWidth,rows:[...new Set(labels.map(i=>i.top))],prev:$(q.prev).disabled,next:$(q.next).disabled}:null,
  selectedWidth:v?.width,selectedVisibleX:v&&r?overlap(v.left,v.right,r.left,r.right):null,readingVisibleY:x&&p?overlap(x.top,x.bottom,p.top,p.bottom):null,passage:passage?{top:passage.scrollTop,max:passage.scrollHeight-passage.clientHeight,css:getComputedStyle(passage).overscrollBehaviorY}:null,font:document.fonts.check('500 22px "GB Cormorant Scripture"','Писание'),docW:document.documentElement.scrollWidth,viewW:innerWidth,panelTop:panel?.scrollTop,trace:window.qaTrace.slice()};
},q);
async function seek(p,id){if(id){await p.locator('#'+id).evaluate(e=>scrollBy({top:e.getBoundingClientRect().top-70,behavior:'instant'}));await wait(p);}}
async function open(p){await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();await chapter(p).locator(':scope > summary').tap();if(!process.env.LAYOUT_ONLY)await p.locator(q.rail).waitFor();await p.evaluate(()=>document.fonts.ready);await wait(p);}
async function drag(c,p,x,y,dx,dy){
 const d=await c.newCDPSession(p);try{
  await p.evaluate(()=>window.qaTrace=[]);
  const send=(type,points)=>d.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await send('touchStart',[{x,y}]);for(let i=1;i<=14;i++){await send('touchMove',[{x:x+dx*i/14,y:y+dy*i/14}]);await wait(p,24);}
  await send('touchEnd',[]);await wait(p,500);
  const state=await snap(p);assert.ok(state.trace.some(t=>t.trusted&&t.type==='touchstart'));return state;
 }finally{await d.detach();}
}
async function scene(name,route,id,width,height,fn){
 if(process.env.ONLY_SCENE&&!name.startsWith(process.env.ONLY_SCENE))return;
 const s={name,route,id,width,height,errors:[]};report.scenes.push(s);
 const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{
   window.qaTrace=[];window.qaJump=null;
   for(const type of ['touchstart','touchend','touchcancel'])document.addEventListener(type,e=>window.qaTrace.push({type,trusted:e.isTrusted,area:e.target.closest('.gbr-scripture-rail,.gbr-scripture-passage,.toc-sheet__handle')?.className||e.target.tagName}),{capture:true,passive:true});
   const f=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){if(this.closest('article'))window.qaJump={id:this.id,tag:this.tagName,motion:args[0]?.behavior};return f.apply(this,args);};
  });
  const p=await c.newPage();p.setDefaultTimeout(6200);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+route)).status(),200);await p.waitForFunction(()=>window.GBReaderState&&window.OverlayRuntime&&window.SCRIPTURE_DATA);await seek(p,id);s.before=await snap(p);await open(p);s.open=await snap(p);await fn(c,p,s);assert.deepEqual(s.errors,[]);
 }catch(e){s.probeError=String(e);console.error(name,e);process.exitCode=1;}finally{await c.close();}
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 if(process.env.LAYOUT_ONLY)await scene('landscape-layout',bapt,'ogpu-1923',568,320,async(c,p,s)=>{
  const legacy=p.locator('.gbr-scripture-heading');if(await legacy.count())await legacy.first().tap();
  s.afterOpen=await snap(p);await p.screenshot({path:`${out}/landscape-layout.png`});
 });
 else {
 for(const width of [320,390])await scene('rail-'+width,gill,'part-controversy',width,width===320?568:844,async(c,p,s)=>{
  const rail=p.locator(q.rail),right=p.locator(q.next);assert.equal(s.open.labels.length,18);assert.equal(s.open.rail.rows.length,2);assert.ok(s.open.projectsAs.length);
  await rail.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const r=await rail.boundingBox();
  s.drag=await drag(c,p,r.x+r.width*.8,r.y+23,-Math.min(145,r.width*.66),0);
  for(let i=0;i<7&&await right.isEnabled();i++){await right.tap();await wait(p,510);}
  s.edge=await snap(p);await p.keyboard.press('Tab');s.tabFromEdge=await snap(p);const z=await rail.boundingBox();s.edgeDrag=await drag(c,p,z.x+z.width*.76,z.y+23,-Math.min(145,z.width*.65),0);
  const last=rail.locator(q.ref).last();await last.tap();s.last=await snap(p);await p.screenshot({path:`${out}/rail-${width}-last.png`});
  await p.keyboard.press('Escape');await wait(p,440);s.closed=await snap(p);await open(p);s.reopen=await snap(p);await p.screenshot({path:`${out}/rail-${width}-reopen.png`});
  const first=rail.locator(q.ref).first();await first.press('End');await wait(p,270);s.end=await snap(p);
  await p.keyboard.press('ArrowRight');await wait(p,270);s.wrap=await snap(p);
  await p.keyboard.press('End');await wait(p,250);s.endAgain=await snap(p);
  await p.keyboard.press('Tab');s.afterTab=await snap(p);
  await rail.locator(q.ref).last().press('Home');await wait(p,270);s.home=await snap(p);
 });
 await scene('alias',exegete,'sec-method',390,844,async(c,p,s)=>{
  const label=s.open.labels.map(x=>x.label).find(x=>/^Рим\.? 12:6$/u.test(x));assert.ok(label);
  const select=async()=>{await row(p,label).tap();await wait(p,230);return snap(p);};
  s.selected=await select();assert.equal(await p.locator(q.dest).count(),2);await p.screenshot({path:`${out}/alias.png`});
  s.jumps=[];for(let i=0;i<2;i++){
   if(i){await seek(p,'sec-method');await open(p);await select();}
   if(i)await p.locator(q.dest).nth(i).press('Enter');else await p.locator(q.dest).nth(i).tap();
   await wait(p,1650);s.jumps.push(await snap(p));
  }
 });
 await scene('coverage',exegete,'sec-seven-texts',390,844,async(c,p,s)=>{
  s.missing=['1 Тим 2:4','2 Пет 3:9','Ин 3:16'].map(label=>({label,projected:s.open.keys.includes(label),listed:s.open.labels.some(x=>x.label===label)}));
 });
 await scene('short-landscape',bapt,'ogpu-1923',568,320,async(c,p,s)=>{
  await p.screenshot({path:`${out}/landscape-initial.png`});
  const block=p.locator(q.passage);await block.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await wait(p);s.atPassage=await snap(p);
  const r=await block.boundingBox();const surface=await p.locator(q.panel).boundingBox();
  const top=Math.max(surface.y,r.y),bottom=Math.min(surface.y+surface.height,r.y+r.height);
  assert.ok(bottom-top>18);const x=r.x+r.width*.5,y=top+(bottom-top)*.8;
  s.up=await drag(c,p,x,y,0,-135);
  s.atBottom=await block.evaluate(e=>{e.scrollTop=e.scrollHeight;return e.scrollTop;});
  s.atBottomBefore=await snap(p);
  s.atBottomDrag=await drag(c,p,x,y,0,-135);
  await p.locator(q.dest).evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await wait(p);await p.screenshot({path:`${out}/landscape-end.png`});
  await p.locator(q.dest).tap();await wait(p,1680);s.jump=await snap(p);
 });
 await scene('passage-switch',gill,'part-controversy',320,568,async(c,p,s)=>{
  const a=row(p,'Мф. 1:18–20'),z=row(p,'Тит. 1:5–7'),block=p.locator(q.passage);
  await a.tap();await block.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await wait(p);
  s.first=await snap(p);const r=await block.boundingBox();const panel=await p.locator(q.panel).boundingBox();
  const top=Math.max(r.y,panel.y),bottom=Math.min(r.y+r.height,panel.y+panel.height);
  s.firstDragged=await drag(c,p,r.x+r.width*.5,top+(bottom-top)*.78,0,-125);
  // Return to the rail without resetting the passage's own scroll position.
  await z.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await wait(p);
  s.beforeSwitch=await snap(p);await z.tap();await wait(p);s.afterSwitch=await snap(p);
  await block.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await wait(p);s.secondReading=await snap(p);
  await p.screenshot({path:`${out}/passage-switch.png`});
  // Diagnostic control only: move the same viewport to the verse's first line.
  await block.evaluate(e=>e.scrollTop=0);await wait(p);s.manualReset=await snap(p);
  await p.screenshot({path:`${out}/passage-switch-reset-control.png`});
 });
 }
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
