import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const A='/articles/dzhon-gill-chast-1-chelovek/', B='/articles/serdce-i-duh/';
{ // wide overflow re-check
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+B,{waitUntil:'load'});await p.waitForTimeout(800);
  await p.evaluate(`GBReaderPreferences.set({measure:'wide'})`);await p.waitForTimeout(300);
  console.log('B wide:',JSON.stringify(await p.evaluate(`(()=>{const vw=document.documentElement.clientWidth;const t=[...document.querySelectorAll('main.article-main article > p')].filter(x=>x.getBoundingClientRect().width>50)[0];return {vw,sw:document.body.scrollWidth,ovfX:document.body.scrollWidth-vw,textW:+t.getBoundingClientRect().width.toFixed(1)};})()`)));
  await p.evaluate(`GBReaderPreferences.set({measure:'normal'})`);await p.close();
}
{ // real sheet -> search flow
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+A,{waitUntil:'load'});await p.waitForTimeout(800);
  const opened=await p.evaluate(`(()=>{
    const cands=['.mobile-btoc-section','[data-gbs2-toggle]','.mobile-bottom-bar'];
    for(const s of cands){const el=document.querySelector(s);if(el){el.click();break;}}
    return document.querySelector('.gbs2-open')?'gbs2-open':(document.querySelector('.toc-overlay.is-open')?'toc is-open':'none');
  })()`);
  await p.waitForTimeout(400);
  const st1=await p.evaluate(`document.querySelector('.gbs2-open')?'gbs2-open':(document.querySelector('.toc-overlay.is-open')?'toc':'closed')`);
  await p.evaluate(`(()=>{const el=document.querySelector('[data-gbs2-search]')||document.querySelector('[data-fc-action="search"]')||document.querySelector('#gbSearchBtn');if(el)el.click();})()`);
  await p.waitForTimeout(500);
  const st2=await p.evaluate(`({sheet:document.querySelector('.gbs2-open')?'OPEN':'closed',toc:document.querySelector('.toc-overlay.is-open')?'OPEN':'closed',searchVisible:!!document.querySelector('.search-overlay.is-open,#gbSearchOverlay.is-open,[data-search-overlay].is-open,.command-palette.is-open')})`);
  console.log('sheet flow:',opened,'->',st1,'-> after search click:',JSON.stringify(st2));
  await p.close();
}
await browser.close();
