import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.MOBILE_SHA||'62be8caa145fbe18aa099dff89cffa20cd626451',root=process.env.MOBILE_ROOT||'/tmp/mobile-62be8caa';
const origin='http://127.0.0.1:19099',out=process.env.MOBILE_OUT||'reports/mobile-swipe-visual-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server','19099','--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:b.version(),scenes:[]};
const main='/articles/dzhon-gill-chast-2-uchenyi/',bapt='/baptisty-rossii/goneniya-i-sovest/';
async function run(name,fn,{width=390,height=844,path=main,dark=false}={}){
 const s={name,width,height,path,dark,errors:[]};report.scenes.push(s);
 const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:dark?'dark':'light',serviceWorkers:'block'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{window.trace=[];for(const t of ['touchstart','touchend','touchcancel'])document.addEventListener(t,e=>window.trace.push({t,trusted:e.isTrusted,table:!!e.target.closest('.manuscript-table'),tag:e.target.tagName}),{passive:true});});
  const p=await c.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));
  assert.equal((await p.goto(origin+path)).status(),200);await p.waitForFunction(()=>window.OverlayRuntime&&window.GBReaderPreferences);await p.evaluate(()=>document.fonts.ready);
  await fn(p,s,c);
 }catch(e){s.probeError=String(e);console.error(name,e);process.exitCode=1;}finally{await c.close();}
}
async function slide(p,c,start,delta,{end=true}={}){
 const cdp=await c.newCDPSession(p);
 const send=(type,pt)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:pt[0],y:pt[1]}]:[]});
 await send('touchStart',start);
 for(let i=1;i<=12;i++){await send('touchMove',[start[0]+delta[0]*i/12,start[1]+delta[1]*i/12]);await p.waitForTimeout(17);}
 const finish=async()=>{await send('touchEnd');await p.waitForTimeout(650);await cdp.detach();};
 if(end)await finish();else return finish;
}
const peek=p=>p.evaluate(()=>{
 const e=document.querySelector('.gbs2-peek.gbs2-on'); if(!e)return null;
 const r=e.getBoundingClientRect(),vis=Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left));
 const textBox=(n)=>{const rg=document.createRange();rg.selectNodeContents(n);return Array.from(rg.getClientRects()).map(x=>({left:x.left,right:x.right,clipped:x.left<0||x.right>innerWidth}));};
 return {title:e.querySelector('b').innerText,caption:e.querySelector('i').innerText,width:r.width,visible:vis,titleBoxes:textBox(e.querySelector('b')),captionBoxes:textBox(e.querySelector('i')),background:getComputedStyle(e.querySelector('.gbs2-peek-img')).backgroundImage};
});
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('start timeout')),4000))]);
 for(const edge of ['start','right-edge','left-edge'])await run(`table-${edge}`,async(p,s,c)=>{
  const setup=await p.evaluate(edge=>{
   const t=[...document.querySelectorAll('.manuscript-table')].find(t=>t.scrollWidth-t.clientWidth>25&&['auto','scroll'].includes(getComputedStyle(t).overflowX));
   if(!t)return null;
   t.scrollIntoView({block:'center',behavior:'instant'});
   if(edge==='right-edge')t.scrollLeft=t.scrollWidth;
   return{client:t.clientWidth,width:t.scrollWidth,overflow:getComputedStyle(t).overflowX};
  },edge);assert.ok(setup,'expected real horizontal table');s.table=setup;
  await p.waitForTimeout(450);
  const table=()=>p.evaluate(()=>{
   const t=[...document.querySelectorAll('.manuscript-table')].find(t=>t.scrollWidth-t.clientWidth>25&&['auto','scroll'].includes(getComputedStyle(t).overflowX));
   if(!t)return null;
   const r=t.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,left:t.scrollLeft,yPage:scrollY};
  });
  s.before=await table();
  const mid=Math.round(Math.max(120,Math.min(700,s.before.y+Math.min(80,s.before.h/2))));
  const dir=edge==='left-edge'?1:-1;
  const finish=await slide(p,c,[dir>0?115:275,mid],[dir*145,0],{end:false});
  s.inGesture=await peek(p);s.trace=await p.evaluate(()=>window.trace);
  if(edge==='right-edge')await p.screenshot({path:`${out}/table-edge-390.png`});
  await finish();s.afterPath=new URL(p.url()).pathname;s.after=s.afterPath===main?await table():null;
 });
 for(const [name,width,direction,dx] of [['next-threshold',390,-1,92],['prev-threshold',390,1,92],['next-full',430,-1,207]])await run(name,async(p,s,c)=>{
  await p.evaluate(()=>scrollTo(0,2400));await p.waitForTimeout(380);
  const finish=await slide(p,c,[direction<0?width-65:65,480],[direction*dx,0],{end:false});
  s.peek=await peek(p);await p.screenshot({path:`${out}/${name}.png`});await finish();s.afterPath=new URL(p.url()).pathname;
 },{width});
 for(const [width,height,path,dark] of [[320,568,main,false],[390,844,main,false],[390,844,bapt,false],[390,844,bapt,true]])await run('chrome-visual',async(p,s)=>{
  if(dark){await p.locator('#mobSettingsBtn').tap();await p.locator('#gillSettingsOverlay [data-theme=dark]').tap();await p.keyboard.press('Escape');await p.waitForTimeout(520);}
  const suffix=`${width}-${path===main?'gill':'bapt'}-${dark?'night':'day'}`;
  await p.screenshot({path:`${out}/chrome-${suffix}.png`});
  const trig=p.locator('.mobile-top-bar [data-gill-marginalia-open]');
  s.trigger=await trig.evaluate(e=>({spanDisplay:getComputedStyle(e.querySelector('span')).display,label:e.getAttribute('aria-label'),book:!!document.querySelector('.mobile-bottom-bar #gb-hl-fab')}));
  await trig.tap();await p.locator('#partTocOverlay.is-open').waitFor();await p.waitForTimeout(390);
  s.colors=await p.locator('#partTocOverlay .toc-sheet').evaluate(e=>['.toc-sheet__head','#gbrMarginalia','.gbat-foot'].map(sel=>{const n=e.querySelector(sel),c=getComputedStyle(n);return{sel,bg:c.backgroundColor,color:c.color};}));
  s.sheetBg=await p.locator('#partTocOverlay .toc-sheet').evaluate(n=>getComputedStyle(n).backgroundColor);
  await p.screenshot({path:`${out}/analytics-${suffix}.png`});
  const glossary=p.locator('#gbrMarginalia details.gbr-marginalia-group').filter({has:p.getByText('Понятия',{exact:true})});
  if(await glossary.count())await glossary.locator(':scope > summary').tap();
  const summary=p.locator('#gbrMarginalia .gbr-marginalia-term summary').first();
  if(await summary.count()){
   const pseudo=()=>summary.evaluate(e=>{const s=getComputedStyle(e,'::after');return{content:s.content,borderRight:s.borderRightWidth,borderBottom:s.borderBottomWidth,transform:s.transform,open:e.parentElement.open};});
   s.closed=await pseudo();await summary.tap();s.open=await pseudo();await p.screenshot({path:`${out}/term-${suffix}.png`});
  }
 },{width,height,path,dark});
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
