import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.MOBILE_SHA||'62be8caa145fbe18aa099dff89cffa20cd626451',root=process.env.MOBILE_ROOT||'/tmp/mobile-62be8caa';
const origin='http://127.0.0.1:19100',out=process.env.MOBILE_OUT||'reports/mobile-zoom-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server','19100','--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:browser.version(),scenes:[]};
const gill='/articles/dzhon-gill-chast-2-uchenyi/',bapt='/baptisty-rossii/goneniya-i-sovest/',herm='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const snap=p=>p.evaluate(()=>{
 const v=visualViewport, peek=document.querySelector('.gbs2-peek.gbs2-on');
 const title=peek?.querySelector('b');const rg=document.createRange();if(title)rg.selectNodeContents(title);
 const bounds=title?[...rg.getClientRects()].map(x=>({l:x.left,r:x.right,t:x.top,b:x.bottom,visibleY:Math.max(0,Math.min(x.bottom,v.offsetTop+v.height)-Math.max(x.top,v.offsetTop)),visible:Math.max(0,Math.min(x.right,v.offsetLeft+v.width)-Math.max(x.left,v.offsetLeft))})):[];
 return {route:location.pathname,scale:v.scale,left:v.offsetLeft,top:v.offsetTop,vWidth:v.width,vHeight:v.height,x:scrollX,y:scrollY,layout:innerWidth,
    peek:peek?.innerText||null,titleBounds:bounds,trace:window.trace.slice()};
});
async function scene(name,path,{width=390,motion='horizontal',zoom='factor'}={}){
 const s={name,path,width,motion,zoom,errors:[]};report.scenes.push(s);
 const c=await browser.newContext({viewport:{width,height:width===320?650:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{window.trace=[];for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{const t=e.touches[0]||e.changedTouches[0];window.trace.push({type,n:e.touches.length,x:t?.clientX,y:t?.clientY,area:!!e.target.closest('article,main,[data-pagefind-body]'),trusted:e.isTrusted});},{passive:true});});
  const p=await c.newPage();p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+path)).status(),200);
  await p.waitForFunction(()=>document.querySelector('article')&&document.fonts.status==='loaded');
  await p.evaluate(()=>scrollTo(0,2400));await p.waitForTimeout(420);
  const d=await c.newCDPSession(p);
  if(zoom==='factor')await d.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  await p.waitForTimeout(360);s.before=await snap(p);if(zoom!=='plain')assert.ok(s.before.scale>1.75);
  const send=(type,pt)=>d.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:pt[0],y:pt[1]}]:[]});
  s.gestures=[];
  const count=motion==='horizontal'&&zoom==='factor'?4:1;
  for(let attempt=0;attempt<count;attempt++){
   const before=await snap(p);const g={before};s.gestures.push(g);
   await p.evaluate(()=>{window.trace=[];});
   const from=[zoom==='plain'?width-55:143,300];const delta=motion==='horizontal'?[zoom==='plain'?-220:-125,0]:[-5,-175];
   await send('touchStart',from);
   for(let i=1;i<=13;i++){await send('touchMove',[from[0]+delta[0]*i/13,from[1]+delta[1]*i/13]);await p.waitForTimeout(20);}
   g.during=await snap(p);assert.ok(g.during.trace.some(e=>e.type==='touchstart'&&e.trusted&&e.area));
   if(name==='gill-zoom-pan'&&g.during.peek)await p.screenshot({path:`${out}/zoom-peek-${attempt}.png`});
   await send('touchEnd');await p.waitForTimeout(660);g.after=await snap(p);
   if(g.after.route!==path)break;
  }
 }catch(e){s.probeError=String(e);console.error(name,e);process.exitCode=1;}finally{await c.close();}
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 await scene('gill-zoom-pan',gill);
 await scene('gill-zoom-vertical',gill,{motion:'vertical'});
 await scene('gill-normal-navigation',gill,{zoom:'plain'});
 await scene('bapt-zoom-pan',bapt);
 await scene('herm-zoom-pan',herm);
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await browser.close();}
