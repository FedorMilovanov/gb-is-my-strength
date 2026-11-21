import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const root=process.env.EXTRA_ROOT||'/tmp/mobile-fe5a4cd',sha=process.env.EXTRA_SHA||'fe5a4cd591e1531f66b7548be125ba0834ef24df';
const origin='http://127.0.0.1:19106',out=process.env.ANALYTICS_OUT||'reports/analytics-parity-qa/fresh';await mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server','19106','--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const route='/articles/dzhon-gill-chast-2-uchenyi/',other='/articles/dzhon-gill-chast-3-nasledie/';
async function run(width,height,name,fn){const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});const s={width,height,name,errors:[]};report.scenes.push(s);try{
 await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+route)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary&&window.OverlayRuntime);await p.evaluate(()=>document.fonts.ready);await fn(c,p,s);
 }catch(e){s.probeError=String(e);console.error(e);process.exitCode=1;}finally{await c.close();}}
const seek=async(p,path)=>{assert.equal((await p.goto(origin+path)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary&&window.OverlayRuntime);};
const state=p=>p.evaluate(()=>({path:location.pathname,owner:window.OverlayRuntime.topLayer()?.ownerId||null,lock:document.documentElement.hasAttribute('data-scroll-locked'),focus:document.activeElement.id||document.activeElement.tagName}));
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const [w,h] of [[320,568],[390,844]])await run(w,h,'shelf',async(c,p,s)=>{
  const track=p.locator('.gill-series-shelf .shelf-track');await track.scrollIntoViewIfNeeded();await p.waitForTimeout(450);
  const prev=p.locator('.shelf-controls [data-step="-1"]'),next=p.locator('.shelf-controls [data-step="1"]');
  const snapshot=()=>p.evaluate(()=>{const x=document.querySelector('.shelf-track'),r=x.getBoundingClientRect();return{path:location.pathname,left:x.scrollLeft,max:x.scrollWidth-x.clientWidth,x:r.x,width:r.width,active:x.querySelector('.gill-card--active')?.textContent.trim().replace(/\s+/g,' ').slice(0,85),peek:!!document.querySelector('.gbs2-peek.gbs2-on'),nextDisabled:document.querySelector('.shelf-controls [data-step="1"]').disabled,prevDisabled:document.querySelector('.shelf-controls [data-step="-1"]').disabled};});
  const d=await c.newCDPSession(p);const drag=async()=>{const r=await track.boundingBox();const x=r.x+r.width*.82,y=r.y+Math.min(r.height*.46,75);const pt=v=>[{x:x+v,y}];await d.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pt(0)});for(let i=1;i<=12;i++){await d.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pt(-145*i/12)});await p.waitForTimeout(20);}const a=await snapshot();await d.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(550);return{during:a,after:await snapshot()};};
  s.start=await snapshot();s.swipe=await drag();
  if(await prev.isEnabled()){await prev.tap();await p.waitForTimeout(360);}s.arrowBack=await snapshot();
  for(let i=0;i<7&&await next.isEnabled();i++){await next.tap();await p.waitForTimeout(300);}s.end=await snapshot();s.edge=await drag();
  await p.screenshot({path:`${out}/shelf-${w}.png`});await d.detach();
 });
 await run(390,844,'analytics-library-round-trip',async(c,p,s)=>{
  const note='QA: заметка только для этой статьи';
  const open=async()=>{await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();const g=p.locator('details.gbr-marginalia-group').filter({has:p.getByText('Мои пометы',{exact:true})});await g.locator('summary').tap();return g;};
  await p.locator('#gb-hl-fab').tap();await p.locator('#gb-hl-new-note').tap();await p.locator('#gb-hl-note-text').fill(note);await p.locator('#gb-hl-editor [type=submit]').tap();
  await p.waitForFunction(text=>window.GBReaderLibrary.getNotes().some(n=>n.text===text),note);s.save=await p.evaluate(text=>window.GBReaderLibrary.getNotes().find(n=>n.text===text),note);
  await p.keyboard.press('Escape');await p.waitForTimeout(520);let r=await open();s.inAnalytics=await r.getByText(note,{exact:true}).isVisible();s.beforeBridge=await state(p);
  await r.getByRole('button',{name:'Открыть библиотеку'}).tap();await p.waitForTimeout(525);s.afterBridge=await state(p);s.inLibrary=await p.locator('#gb-hl-panel').getByText(note,{exact:true}).isVisible();
  await seek(p,other);r=await open();s.leaksOtherArticle=await r.getByText(note,{exact:true}).count();
  await seek(p,route);r=await open();s.afterReload=await r.getByText(note,{exact:true}).isVisible();
 });
}finally{await writeFile(`${out}/shelf-library.json`,JSON.stringify(report,null,2));await b.close();server.kill();}
