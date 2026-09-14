import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const B='/articles/serdce-i-duh/', A='/articles/dzhon-gill-chast-1-chelovek/', H='/articles/lot-i-sodom/';
const geo=async(page,sel)=>page.evaluate(`(()=>{
  const vw=document.documentElement.clientWidth;
  const ps=[...document.querySelectorAll('${sel}')].filter(p=>p.getBoundingClientRect().width>100);
  const r=ps.map(p=>p.getBoundingClientRect());
  const maxR=Math.max(...r.map(x=>x.right)), minL=Math.min(...r.map(x=>x.left));
  const m=document.querySelector('main.article-main');const wr=document.querySelector('.page-wrap');
  const cs=m?getComputedStyle(m):null;
  return {vw, maxR:+maxR.toFixed(1), minL:+minL.toFixed(1),
    drift:+((maxR+minL)/2-vw/2).toFixed(1),
    clip:maxR>vw?+(maxR-vw).toFixed(1):0,
    mainW:m?+m.getBoundingClientRect().width.toFixed(1):null,
    wrapW:wr?+wr.getBoundingClientRect().width.toFixed(1):null,
    mainLH:cs?cs.lineHeight:null};
})()`);
console.log('=== B geometry desktop ===');
for(const w of [1024,1280,1440,1920]){
  const p=await ctx.newPage();await p.setViewportSize({width:w,height:900});
  await p.goto(BASE+B,{waitUntil:'load'});await p.waitForTimeout(900);
  console.log(w, JSON.stringify(await geo(p,'main.article-main article > p')));await p.close();
}
console.log('=== A geometry desktop (regression) ===');
for(const w of [1280,1920]){
  const p=await ctx.newPage();await p.setViewportSize({width:w,height:900});
  await p.goto(BASE+A,{waitUntil:'load'});await p.waitForTimeout(900);
  console.log(w, JSON.stringify(await geo(p,'.article-body > p')));await p.close();
}
console.log('=== B mobile 390: measure scale ===');
{
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+B,{waitUntil:'load'});await p.waitForTimeout(900);
  for(const m of ['normal','narrow','wide']){
    await p.evaluate(`GBReaderPreferences.set({measure:'${m}'})`);await p.waitForTimeout(250);
    const r=await p.evaluate(`(()=>{const w=document.querySelector('.page-wrap');const m2=document.querySelector('main.article-main');const p2=[...document.querySelectorAll('main.article-main article > p')].filter(x=>x.getBoundingClientRect().width>50)[0];return {wrap:+w.getBoundingClientRect().width.toFixed(1),main:+m2.getBoundingClientRect().width.toFixed(1),text:+p2.getBoundingClientRect().width.toFixed(1),ovfX:document.body.scrollWidth-document.documentElement.clientWidth};})()`);
    console.log(m, JSON.stringify(r));
  }
  await p.close();
}
console.log('=== hrail (B-lot): dual-scale + sepia ===');
{
  const p=await ctx.newPage();await p.setViewportSize({width:1280,height:900});
  await p.goto(BASE+H,{waitUntil:'load'});await p.waitForTimeout(900);
  await p.evaluate(`GBReaderPreferences.set({measure:'narrow',theme:'sepia'})`);await p.waitForTimeout(350);
  const r=await p.evaluate(`(()=>{const c=document.querySelector('[data-reader-root]');const cs=getComputedStyle(c);const b=document.querySelector('.article-body')||c;return {hmMeasure:c.style.getPropertyValue('--hm-article-measure'),gbMeasure:getComputedStyle(document.documentElement).getPropertyValue('--gb-reader-measure'),bodyBg:getComputedStyle(b).backgroundColor,canvas:cs.getPropertyValue('--color-canvas').trim()};})()`);
  console.log(JSON.stringify(r));
  await p.evaluate(`GBReaderPreferences.set({measure:'normal',theme:'light'})`);
  await p.close();
}
console.log('=== gill: search-over-sheet close + tap targets 390 ===');
{
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+A,{waitUntil:'load'});await p.waitForTimeout(900);
  const t=await p.evaluate(`(()=>{const g=s=>document.querySelector(s);const r=e=>{const b=e.getBoundingClientRect();return +b.height.toFixed(0)+'x'+ +b.width.toFixed(0)};return {top:r(g('.mobile-top-bar .gb-icon')),bot:r(g('.mobile-bottom-bar > .gb-icon'))};})()`);
  console.log('tap', JSON.stringify(t));
  // open TOC sheet, then dispatch gb:openSearch
  const before=await p.evaluate(`(()=>{const ov=document.querySelector('.toc-overlay');if(!ov)return 'no-overlay';document.querySelector('[data-gb-toc-open]')?.click();return ov.className;})()`);
  await p.waitForTimeout(400);
  const st1=await p.evaluate(`document.querySelector('.toc-overlay')?.className||'none'`);
  await p.evaluate(`window.dispatchEvent(new CustomEvent('gb:openSearch',{bubbles:true}))`);
  await p.waitForTimeout(400);
  const st2=await p.evaluate(`document.querySelector('.toc-overlay')?.className||'none'`);
  console.log('sheet before:',st1,'| after gb:openSearch:',st2);
  await p.evaluate(`document.querySelector('.search-overlay.is-open [data-search-close],.search-overlay.is-open button')?.click?.()`);
  await p.close();
}
await browser.close();
