import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(()=>{
  const vw=document.documentElement.clientWidth;
  const bad=[...document.querySelectorAll('body *')].map(e=>{const b=e.getBoundingClientRect();const cs=getComputedStyle(e);return {e,b,cs};})
    .filter(x=>x.b.width>30&&x.b.right>vw+2&&x.cs.position!=='fixed')
    .sort((a,b)=>b.b.right-a.b.right).slice(0,8)
    .map(x=>x.e.tagName+'.'+String(x.e.className).slice(0,44)+' w='+x.b.width.toFixed(0)+' r='+x.b.right.toFixed(0)+' cssW='+x.cs.width);
  const wrap=document.querySelector('.page-wrap'), main=document.querySelector('main'), ab=document.querySelector('.article-body');
  const info=n=>{const el=n==='wrap'?wrap:n==='main'?main:ab;if(!el)return null;const b=el.getBoundingClientRect();const cs=getComputedStyle(el);return {w:+b.width.toFixed(0),l:+b.left.toFixed(0),r:+b.right.toFixed(0),cssW:cs.width,maxW:cs.maxWidth,pad:cs.paddingLeft+'/'+cs.paddingRight};};
  return {vw, sw:document.body.scrollWidth, bad, wrap:info('wrap'), main:info('main'), ab:info('ab'),
    gill:!!document.querySelector('[data-gill-v16]'), readerRoot:!!document.querySelector('[data-reader-root]')};
})()`;
for(const [name,url,w] of [['diotrefy@1024','/articles/diotrefy-nashego-vremeni/',1024],['diotrefy@390','/articles/diotrefy-nashego-vremeni/',390],['teen@1024','/articles/podrostok-za-kadrom-chto-delat-tserkvi/',1024],['vzrosl@1024','/articles/vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya/',1024]]){
  const p=await ctx.newPage();await p.setViewportSize({width:w,height:900});
  await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(900);
  console.log('==',name,JSON.stringify(await p.evaluate(probe),null,1));
  await p.close();
}
await browser.close();
