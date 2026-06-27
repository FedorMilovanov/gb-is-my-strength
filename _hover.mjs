import { chromium } from 'playwright';
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:1000}});
await pg.goto('http://127.0.0.1:8099/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',{waitUntil:'networkidle',timeout:20000});
await pg.waitForTimeout(700);
// closed state
const closed=await pg.evaluate(()=>{const p=document.querySelector('.gb-ember-expand');return p?{opacity:getComputedStyle(p).opacity,clip:getComputedStyle(p).clipPath.slice(0,20)}:null;});
// hover the wrap
await pg.hover('.gb-ember-wrap');
await pg.waitForTimeout(500);
const hovered=await pg.evaluate(()=>{
  const p=document.querySelector('.gb-ember-expand');
  const e=document.querySelector('.gb-ember');
  const btns=[...document.querySelectorAll('.gb-ember-expand__btn')].filter(b=>getComputedStyle(b).opacity==='1').length;
  return {opacity:p?getComputedStyle(p).opacity:null, isOpen:p?p.classList.contains('is-open'):null, visibleBtns:btns, emberTransform:e?getComputedStyle(e).transform:null};
});
console.log('CLOSED:',JSON.stringify(closed));
console.log('HOVERED:',JSON.stringify(hovered));
await pg.screenshot({path:'/home/user/repo/_hover.png',clip:{x:980,y:330,width:300,height:260}});
await b.close();
