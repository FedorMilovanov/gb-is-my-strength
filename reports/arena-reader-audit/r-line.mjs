import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const PAGES=[['A','/articles/dzhon-gill-chast-1-chelovek/','.article-body > p'],['B','/articles/serdce-i-duh/','main.article-main article > p']];
for(const [fam,url,sel] of PAGES){
  const page=await ctx.newPage(); await page.setViewportSize({width:1280,height:900});
  await page.goto(BASE+url,{waitUntil:'load'}); await page.waitForTimeout(1300);
  const get=()=>page.evaluate(`(()=>{const ps=[...document.querySelectorAll('${sel}')].filter(p=>p.getBoundingClientRect().width>100);const s=ps[4]||ps[0];const c=getComputedStyle(s);return {ratio:+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(3), font:c.fontSize, line:c.lineHeight, n:ps.length};})()`);
  const g=await page.$('button[aria-label*="астройк"]'); await g.click(); await page.waitForTimeout(500);
  const rows=[];
  for(const t of ['Обычный','Плотный','Свободный']){
    const el=await page.$(`button:has-text("${t}")`); await el.click(); await page.waitForTimeout(450);
    rows.push(t+'='+JSON.stringify(await get()));
  }
  console.log(`${fam} ${sel}: `+rows.join(' | '));
  await page.close();
}
await browser.close();
