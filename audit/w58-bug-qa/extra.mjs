import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.W58_PLAYWRIGHT || 'playwright');
import {spawn} from 'node:child_process';
const port=Number(process.env.W58_PORT || 19083),origin='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',process.env.W58_DIST || '/tmp/w58-bug-599ec09/dist'],{stdio:'ignore'});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out='reports/w58-599ec09/';const evidence=[];
await mkdir(out,{recursive:true});
try{
for(const width of [320,390]){
const c=await b.newContext({viewport:{width,height:width===320?700:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
await c.addInitScript(()=>{const speech=new EventTarget();window.__utterances=[];Object.assign(speech,{getVoices:()=>[],speak(u){window.__utterances.push(u.rate);setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});Object.defineProperty(window,'speechSynthesis',{value:speech});Object.defineProperty(window,'VoskTTSEngine',{value:{isSupported:()=>false,isReady:()=>false}});});
const p=await c.newPage();
await p.goto(origin+'/articles/dzhon-gill-chast-2-uchenyi/',{waitUntil:'domcontentloaded'});
const appear=p.locator('.mobile-top-bar .gb-ember-expand');await appear.waitFor({state:'attached'});
await p.evaluate(()=>document.fonts.ready);
const r={width};evidence.push(r);
const play=p.locator('.mobile-top-bar button.gb-ember');
const geom=async()=>p.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y}};
 const touch=e=>{const r=e.getBoundingClientRect();return {...box(e),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}};
 return {width:innerWidth,height:innerHeight,scroll:(()=>{const n=document.querySelector('.mobile-top-bar .gb-ember-expand');return [n.scrollTop,n.scrollHeight,n.clientHeight,getComputedStyle(n).overflowY]})(),panel:box(document.querySelector('.mobile-top-bar .gb-ember-expand')),primary:[...document.querySelectorAll('.mobile-top-bar button.gb-ember,.mobile-top-bar [data-gill-marginalia-open],.mobile-top-bar .mobile-top-save')].map(touch),speeds:[...document.querySelectorAll('.mobile-top-bar .gb-ember-expand [data-speed]')].map(e=>({rate:e.dataset.speed,...touch(e)})),speaks:window.__utterances,state:document.querySelector('.mobile-top-bar .gb-ember').dataset.state,echo:document.querySelector('.mobile-top-bar .gb-ember-speed-echo')?.textContent};
});
r.closed=await geom();await play.tap();await p.locator('.mobile-top-bar .gb-ember-expand.is-open').waitFor();await p.waitForTimeout(400);r.open=await geom();
if(width===390){await p.setViewportSize({width:844,height:390});await p.waitForTimeout(450);r.landscape=await geom();await p.screenshot({path:out+'05-active-speed-landscape.png'});await p.setViewportSize({width:700,height:320});await p.waitForTimeout(430);r.landscapeShort=await geom();await p.screenshot({path:out+'06-speed-short-landscape.png'});const cdp=await c.newCDPSession(p);const x=r.landscapeShort.panel.x+25;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:236}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:236-i*8}]});await p.waitForTimeout(18);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(350);r.landscapeShortAfterSwipe=await geom();await p.screenshot({path:out+'07-speed-after-swipe.png'});await p.setViewportSize({width:390,height:844});await p.waitForTimeout(400);}
const target=appear.locator('[data-speed="1.25"]');await target.tap();await p.waitForTimeout(420);r.choice=await geom();
await p.reload({waitUntil:'domcontentloaded'});await appear.waitFor({state:'attached'});await p.evaluate(()=>document.fonts.ready);
const toc=p.locator('#mobPartTocBtn');
const sections=await p.locator('article.article-body > h2[id]').evaluateAll(items=>items.slice(0,6).map(e=>({id:e.id,title:e.textContent.trim()})));
r.scope=[];
for(const section of sections.slice(1,4)){
 const at=p.locator('#'+section.id);await at.evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-95,behavior:'instant'})); await p.waitForTimeout(160);
 const pre=await p.evaluate(()=>({y:scrollY,bottom:document.getElementById('gbs2MobSec').textContent,sec:GBReaderState.getActiveSection()}));
 await toc.tap();await p.locator('#gbrMarginaliaTab').tap();await p.waitForTimeout(160);
 const post=await p.evaluate(()=>({y:scrollY,scope:document.querySelector('.gbr-marginalia-lead h3').textContent,top:document.body.style.top,sec:GBReaderState.getActiveSection()}));
 await p.keyboard.press('Escape');await p.waitForTimeout(560);const exit=await p.evaluate(()=>scrollY);r.scope.push({section,pre,post,exit});
}
await c.close();
}
}finally{await writeFile(out+'extra.json',JSON.stringify(evidence,null,2));await b.close();server.kill();}
