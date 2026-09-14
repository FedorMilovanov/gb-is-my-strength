import { chromium } from 'playwright';
import postcss from 'postcss'; import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
// --- 1. stacking context of the sheet's ancestors (mobile B, sheet open) ---
{
  const page=await ctx.newPage(); await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'/articles/serdce-i-duh/',{waitUntil:'load'}); await page.waitForTimeout(1200);
  const g=await page.$('.mobile-bottom-bar [aria-label*="астройк"]'); await g.click(); await page.waitForTimeout(600);
  const info=await page.evaluate(`(() => {
    const o=document.querySelector('.toc-overlay.is-open'); const cs=getComputedStyle(o);
    const anc=[]; let e=o.parentElement;
    while(e&&e!==document.body){ const c=getComputedStyle(e); if(c.transform!=='none'||c.filter!=='none'||c.backdropFilter!=='none'||c.willChange!=='auto'||c.contain!=='none'||c.perspective!=='none'||c.isolation==='isolate'||+c.zIndex>0) anc.push({cls:(e.className.toString()||e.tagName).slice(0,40),transform:c.transform.slice(0,24),filter:c.filter,backdrop:c.backdropFilter,willChange:c.willChange,contain:c.contain,z:c.zIndex,isolation:c.isolation}); e=e.parentElement; }
    return {ovPos:cs.position, ovZ:cs.zIndex, ovParentChain:anc};
  })()`);
  console.log('SHEET STACKING:',JSON.stringify(info,null,1));
  await page.close();
}
// --- 2. line-height control: A vs B, click «Плотный» from relaxed state ---
for(const [fam,url] of [['A','/articles/dzhon-gill-chast-1-chelovek/'],['B','/articles/serdce-i-duh/']]){
  const page=await ctx.newPage(); await page.setViewportSize({width:1280,height:900});
  await page.goto(BASE+url,{waitUntil:'load'}); await page.waitForTimeout(1200);
  const get=async()=>page.evaluate(`(()=>{const ps=[...document.querySelectorAll('article p')].filter(p=>p.getBoundingClientRect().width>80&&!p.closest('.summary-card,.quote-box,.article-header,figure'));const s=ps[Math.floor(ps.length/2)];const w=document.querySelector('[data-gill-v16]');return {line:getComputedStyle(s).lineHeight, tok:w.style.getPropertyValue('--gbs2-article-line')};})()`);
  const g=await page.$('button[aria-label*="астройк"]'); await g.click(); await page.waitForTimeout(500);
  const before=await get();
  const b=await page.$('button:has-text("Плотный")'); await b.click(); await page.waitForTimeout(500);
  const after=await get();
  console.log(`${fam}: line-height before=${before.line} tok=${before.tok} | after «Плотный» line=${after.line} tok=${after.tok} | CHANGED=${before.line!==after.line}`);
  await page.close();
}
// --- 3. hrail settings CSS at >=1200 ---
const f='dist/_astro/ReaderSettings.JYPId-XB.css';
const root=postcss.parse(fs.readFileSync(f,'utf8'),{from:f});
const chain=r=>{const p=[];let x=r.parent;while(x&&x.type!=='root'){if(x.type==='atrule')p.unshift('@'+x.name+' '+x.params);x=x.parent;}return p.join(' && ')||'(top)';};
root.walkRules(r=>{const sel=(r.selector||'').replace(/\s+/g,' ');
  if(!/\.hmsheet|hmsheet-panel|hm-pop/.test(sel))return;
  const d=r.nodes.filter(x=>x.type==='decl'&&['display','position','width','height','top','bottom'].includes(x.prop));
  if(d.length)console.log('['+chain(r)+'] '+sel.slice(0,90)+' => '+d.map(x=>x.prop+':'+x.value+(x.important?'!':'')).join('; '));
});
await browser.close();
