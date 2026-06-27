import { chromium } from 'playwright';
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:1000}});
await pg.goto('http://127.0.0.1:8099/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',{waitUntil:'networkidle',timeout:20000});
await pg.waitForTimeout(700);
const box=await pg.evaluate(()=>{const f=document.querySelector('.gb-floater,[class*="floater"]');const r=f?f.getBoundingClientRect():null;return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;});
console.log('floater box:',JSON.stringify(box));
await pg.hover('.gb-ember-wrap');
await pg.waitForTimeout(500);
// screenshot region around the ember (right side of viewport)
const eb=await pg.evaluate(()=>{const e=document.querySelector('.gb-ember-wrap');const r=e.getBoundingClientRect();return {x:Math.max(0,r.x-360),y:Math.max(0,r.y-20),width:420,height:120};});
await pg.screenshot({path:'/home/user/repo/_hover2.png',clip:eb});
await b.close();
