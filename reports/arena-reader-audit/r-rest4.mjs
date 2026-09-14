import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(()=>{const vw=document.documentElement.clientWidth;
 const rr=[...document.querySelectorAll('article p, main p')].filter(p=>p.getBoundingClientRect().width>60).map(p=>p.getBoundingClientRect());
 const bad=[...document.querySelectorAll('body *')].map(e=>({e,b:e.getBoundingClientRect(),cs:getComputedStyle(e)})).filter(x=>x.b.width>30&&x.b.right>vw+2&&x.cs.position!=='fixed').slice(0,4).map(x=>x.e.tagName+'.'+String(x.e.className).slice(0,30)+' r='+x.b.right.toFixed(0));
 return {vw, sw:document.body.scrollWidth, ovfX:document.body.scrollWidth-document.documentElement.clientWidth,
  clip:rr.filter(r=>r.right>vw+2).length, medW:rr.length?+rr.map(r=>r.width).sort((a,b)=>a-b)[Math.floor(rr.length/2)].toFixed(0):null, bad};})()`;
for(const [name,url,w] of [
  ['diotrefy@1024','/articles/diotrefy-nashego-vremeni/',1024],
  ['diotrefy@390','/articles/diotrefy-nashego-vremeni/',390],
  ['teen@1024','/articles/podrostok-za-kadrom-chto-delat-tserkvi/',1024],
  ['vzrosl@1024','/articles/vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya/',1024],
  ['B@1024 regr','/articles/serdce-i-duh/',1024],
  ['A@1280 regr','/articles/dzhon-gill-chast-1-chelovek/',1280]]){
  const p=await ctx.newPage();await p.setViewportSize({width:w,height:900});
  await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(800);
  console.log(name, JSON.stringify(await p.evaluate(probe)));
  await p.close();
}
{ // gill sepia chrome palette
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+'/articles/dzhon-gill-chast-1-chelovek/',{waitUntil:'load'});await p.waitForTimeout(800);
  await p.evaluate(`GBReaderPreferences.set({theme:'sepia'})`);await p.waitForTimeout(400);
  const r=await p.evaluate(`(()=>{const g=document.querySelector('[data-gill-v16]');const cs=getComputedStyle(g);
    const bar=document.querySelector('.mobile-bottom-bar');const sheet=document.querySelector('.toc-sheet');
    return {gbSurface:cs.getPropertyValue('--gb-surface').trim(), gbText:cs.getPropertyValue('--gb-text').trim(),
      worldBg:cs.backgroundColor, barBg:bar?getComputedStyle(bar).backgroundColor:null,
      canvas:getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()};})()`);
  console.log('gill sepia chrome:', JSON.stringify(r));
  await p.screenshot({path:'shots/fix2-gill-sepia-mobile.png'});
  await p.evaluate(`GBReaderPreferences.set({theme:'light'})`);
  await p.close();
}
{ // shots
  for(const [name,url,w,h] of [['fix2-diotrefy-1024','/articles/diotrefy-nashego-vremeni/',1024,900],['fix2-teen-1024','/articles/podrostok-za-kadrom-chto-delat-tserkvi/',1024,900]]){
    const p=await ctx.newPage();await p.setViewportSize({width:w,height:h});
    await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(800);
    await p.screenshot({path:'shots/'+name+'.png'});await p.close();console.log('shot',name);
  }
}
await browser.close();
