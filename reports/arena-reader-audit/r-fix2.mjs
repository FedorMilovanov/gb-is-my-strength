import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const A='/articles/dzhon-gill-chast-1-chelovek/', B='/articles/serdce-i-duh/';
// wide-overflow probe on B mobile
{
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+B,{waitUntil:'load'});await p.waitForTimeout(800);
  await p.evaluate(`GBReaderPreferences.set({measure:'wide'})`);await p.waitForTimeout(300);
  const r=await p.evaluate(`(()=>{const vw=document.documentElement.clientWidth;const out=[];document.querySelectorAll('*').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&b.right>vw+1&&getComputedStyle(e).position!=='fixed')out.push(e.tagName+'.'+(e.className||'').toString().slice(0,40)+' r='+b.right.toFixed(0));});return {vw,sw:document.body.scrollWidth,off:out.slice(0,6)};})()`);
  console.log('B wide overflow:',JSON.stringify(r,null,0));
  await p.evaluate(`GBReaderPreferences.set({measure:'normal'})`);await p.close();
}
// sheet close probe on A with the real opener
{
  const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
  await p.goto(BASE+A,{waitUntil:'load'});await p.waitForTimeout(800);
  const btns=await p.evaluate(`[...document.querySelectorAll('button,[role=button],a')].filter(e=>/toc|содерж|оглавл/i.test((e.getAttribute('aria-label')||'')+(e.dataset?JSON.stringify(e.dataset):'')+e.className)).slice(0,8).map(e=>e.tagName+'|'+e.className.slice(0,40)+'|'+(e.getAttribute('aria-label')||'').slice(0,30)+'|'+JSON.stringify(e.dataset).slice(0,60))`);
  console.log('candidate toc openers:',JSON.stringify(btns,null,1));
  await p.close();
}
await browser.close();
