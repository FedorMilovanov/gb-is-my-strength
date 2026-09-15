import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(()=>{const vw=document.documentElement.clientWidth;
 const rr=[...document.querySelectorAll('article p, main p')].filter(p=>p.getBoundingClientRect().width>60).map(p=>p.getBoundingClientRect());
 return {vw, ovfX:document.body.scrollWidth-document.documentElement.clientWidth,
  clip:rr.filter(r=>r.right>vw+2).length, medW:rr.length?+rr.map(r=>r.width).sort((a,b)=>a-b)[Math.floor(rr.length/2)].toFixed(0):null};})()`;
for(const [name,url,vp,shot] of [
  ['A@1280','/articles/dzhon-gill-chast-1-chelovek/',1280,1],
  ['B@1280','/articles/serdce-i-duh/',1280,1],
  ['B@390','/articles/serdce-i-duh/',390,0],
  ['hrail@1280','/articles/lot-i-sodom/',1280,0],
  ['teen@1024','/articles/podrostok-za-kadrom-chto-delat-tserkvi/',1024,0]]){
  const p=await ctx.newPage();
  const cdp=await p.context().newCDPSession(p);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  let homeReq=0; p.on('request',r=>{if(r.url().includes('home.css'))homeReq++;});
  const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,80)));
  await p.setViewportSize({width:vp,height:900});
  await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(900);
  const r=await p.evaluate(probe);
  console.log(name, JSON.stringify(r), 'home.css requests:', homeReq, errs.length?'ERR:'+errs:'');
  if(shot) await p.screenshot({path:`shots/weight-${name.replace('@','-')}.png`});
  await p.close();
}
await browser.close();
