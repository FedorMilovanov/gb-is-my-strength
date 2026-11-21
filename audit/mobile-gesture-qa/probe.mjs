import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.MOBILE_SHA||'62be8caa145fbe18aa099dff89cffa20cd626451',root=process.env.MOBILE_ROOT||'/tmp/mobile-62be8caa';
const origin='http://127.0.0.1:19097',out=process.env.MOBILE_OUT||'reports/mobile-gesture-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server','19097','--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:b.version(),scenes:[]};
const main='/articles/dzhon-gill-chast-2-uchenyi/',bapt='/baptisty-rossii/goneniya-i-sovest/',herm='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const snapshot=p=>p.evaluate(()=>{
 const cover=document.querySelector('.gbs2-peek.gbs2-on .gbs2-peek-img');
 return {cover:cover?{style:cover.getAttribute('style'),background:getComputedStyle(cover).backgroundImage,attributeNames:cover.getAttributeNames()}:null,sourceCovers:[...document.querySelectorAll('.gbs2-next-cover')].map(e=>getComputedStyle(e).backgroundImage),url:location.pathname,y:scrollY,owner:window.OverlayRuntime.topLayer()?.ownerId||null,focus:document.activeElement?.id||document.activeElement?.getAttribute('aria-label'),touch:window.touches.slice(),peek:document.querySelector('.gbs2-peek.gbs2-on')?.innerText||null,peekX:document.querySelector('.gbs2-peek.gbs2-on')?.style.getPropertyValue('--gbs2-peek')||null};});
async function scene(name,points,{route=main,width=390,height=844,openSheet=false,shot=false}={}){
 const s={name,route,width,height,points,pageErrors:[]};report.scenes.push(s);
 const ctx=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  await ctx.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await ctx.addInitScript(()=>{window.touches=[];for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{const f=e.touches[0]||e.changedTouches[0];window.touches.push({type,x:f?.clientX,y:f?.clientY,trusted:e.isTrusted,target:e.target.closest('article,.toc-sheet')?.className||e.target.tagName});},{passive:true});});
  const p=await ctx.newPage();p.on('pageerror',e=>s.pageErrors.push(String(e)));assert.equal((await p.goto(origin+route)).status(),200);
  await p.waitForFunction(()=>window.OverlayRuntime);await p.evaluate(()=>document.fonts.ready);
  if(openSheet){await p.locator('#mobPartTocBtn').tap();await p.locator('#partTocOverlay.is-open').waitFor();await p.waitForTimeout(350);}
  else{await p.evaluate(()=>scrollTo(0,2400));await p.waitForTimeout(360);}
  s.before=await snapshot(p);await p.evaluate(()=>{window.touches=[];});
  const cdp=await ctx.newCDPSession(p);
  const send=(type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{x:point[0],y:point[1]}]:[]});
  await send('touchStart',points[0]);
  for(const point of points.slice(1)){await send('touchMove',point);await p.waitForTimeout(26);}
  s.during=await snapshot(p);assert.ok(s.during.touch.some(e=>e.type==='touchmove'&&e.trusted));
  if(shot)await p.screenshot({path:`${out}/${name}.png`});
  await send('touchEnd');await p.waitForTimeout(850);
  s.after=await snapshot(p);
  if(openSheet&&s.after.owner){await p.keyboard.press('Escape');await p.waitForTimeout(450);s.cleanup=await snapshot(p);}
 }finally{await ctx.close();}
}
const flat=[[274,480],[249,480],[224,480],[200,482],[175,483],[145,484],[117,484]];
const turned=[[274,510],[248,509],[222,501],[190,472],[163,415],[150,350],[150,292],[149,226]];
const vertical=[[274,510],[273,483],[271,448],[266,395],[261,345],[255,285],[248,226]];
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 await scene('intentional-horizontal',flat);
 await scene('vertical-control',vertical);
 assert.equal(report.scenes[0].after.url,'/articles/dzhon-gill-chast-4-ekzeget/');
 assert.equal(report.scenes[1].after.url,main);
 assert.ok(report.scenes[1].after.y>report.scenes[1].before.y);
 await scene('horizontal-then-vertical',turned,{shot:true});
 await scene('short-preview',[[274,480],[250,480],[225,480],[210,482]],{shot:true});
 await scene('reverse-before-release',[[274,480],[249,480],[210,480],[165,480],[137,480],[182,481],[230,482],[258,482]]);
 await scene('sheet-dismiss-down',[[200,145],[200,167],[202,190],[202,218],[203,255],[204,283]],{openSheet:true});
 await scene('bapt-horizontal-then-vertical',turned,{route:bapt});
 await scene('hermeneutics-no-series-route',turned,{route:herm});
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
