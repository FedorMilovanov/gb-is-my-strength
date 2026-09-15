import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(()=>{const root=document.querySelector('[data-reader-root]')||document;
 const ps=[...root.querySelectorAll('.article-body > p')].filter(p=>p.getBoundingClientRect().width>200&&!p.closest('.hmsheet,.hrail,.summary-card'));
 const s=ps[3]||ps[0];const c=getComputedStyle(s);
 return {n:ps.length, font:parseFloat(c.fontSize), ratio:+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(2), col:+s.getBoundingClientRect().width.toFixed(0)};})()`;
for(const [name,vp] of [['hrail-1280',1280],['hrail-390',390]]){
  const p=await ctx.newPage();await p.setViewportSize({width:vp,height:900});
  await p.goto(BASE+'/articles/lot-i-sodom/',{waitUntil:'load'});await p.waitForTimeout(900);
  await p.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>/астройк/.test(b.getAttribute('aria-label')||''))?.click()})()`);
  await p.waitForTimeout(500);
  const click=async(l)=>{const ok=await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent).find(x=>(x.textContent||'').trim()==='${l}');if(b){b.click();return true;}return false;})()`);await p.waitForTimeout(350);return ok;};
  const row={base:await p.evaluate(probe)};
  row.denseOk=await click('Плотный'); row.dense=await p.evaluate(probe);
  await click('Обычный');
  row.narrowOk=await click('Узкая'); row.narrow=await p.evaluate(probe);
  await click('Обычная');
  row.fontOk=await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent).find(x=>/увеличить/i.test(x.getAttribute('aria-label')||''));if(b){b.click();return true;}return false;})()`);
  await p.waitForTimeout(350);row.font=await p.evaluate(probe);
  console.log(name, JSON.stringify(row));
  await p.evaluate(`GBReaderPreferences.set({theme:'light',lineHeight:'normal',measure:'normal',fontScale:1})`);
  await p.close();
}
await browser.close();
