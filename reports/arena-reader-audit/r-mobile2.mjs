import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(() => {
  const ps=[...document.querySelectorAll('article p, main p')].filter(p=>{const b=p.getBoundingClientRect();return b.width>60&&b.height>4&&!p.closest('.summary-card,.quote-box,.info-box,.article-header,.breadcrumb,.resume-reading-block,.faq-accordion,.pullquote,figure,.article-meta,.author-card');});
  const widths=ps.map(p=>p.getBoundingClientRect().width).sort((a,b)=>a-b);
  const s=ps[Math.floor(ps.length/2)];const cs=s?getComputedStyle(s):null;
  const over=[...document.querySelectorAll('body *')].map(e=>({e,r:e.getBoundingClientRect()})).filter(o=>o.r.width>40&&o.r.right>innerWidth+2&&!o.e.closest('.cp-backdrop')).slice(0,4).map(o=>({cls:(o.e.className.toString()||o.e.tagName).slice(0,44),right:+o.r.right.toFixed(0)}));
  return {medW:widths.length?+widths[Math.floor(widths.length/2)].toFixed(1):null, lineH:cs?.lineHeight, fontS:cs?.fontSize, bodyOvfX:document.body.scrollWidth-document.body.clientWidth, over};
})()`;
for(const [fam,url] of [['A','/articles/dzhon-gill-chast-1-chelovek/'],['HR','/articles/lot-i-sodom/'],['B','/articles/serdce-i-duh/']]){
  const page=await ctx.newPage();
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+url,{waitUntil:'load'});await page.waitForTimeout(1300);
  console.log(`\n===== MOBILE ${fam} ${url} =====`);
  const d0=await page.evaluate(probe);
  console.log(' text:',JSON.stringify({medW:d0.medW,lineH:d0.lineH,bodyOvfX:d0.bodyOvfX,over:d0.over}));
  const gear=await page.$('.mobile-bottom-bar [aria-label*="астройк"], .hmbar [aria-label*="астройк"]');
  if(gear){
    await gear.click(); await page.waitForTimeout(600);
    const click=async t=>{const el=await page.$(`button:has-text("${t}")`);if(el&&await el.isVisible().catch(()=>0)){await el.click();await page.waitForTimeout(400);return true;}return false;};
    await click('Свободный'); const d1=await page.evaluate(probe);
    console.log(` «Свободный»: lineH ${d0.lineH} -> ${d1.lineH}`);
    await click('Узкая'); const d2=await page.evaluate(probe);
    await click('Шире'); const d3=await page.evaluate(probe);
    console.log(` «Узкая»->«Шире»: medW ${d1.medW} -> ${d2.medW} -> ${d3.medW}`);
    // close sheet
    const back=await page.$('.toc-sheet__head .back, .toc-sheet__head--grid .back, [aria-label="Закрыть"]');
    if(back) await back.click().catch(()=>{}); else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  // TOC + search stacking
  const toc=await page.$('.mobile-bottom-bar [aria-label*="главлени"], .hmbar [aria-label*="главлени"], .mobile-bottom-bar .mobile-btoc-section');
  if(toc){ await toc.click({timeout:8000}).catch(e=>console.log(' toc click failed')); await page.waitForTimeout(600);
    const st=await page.evaluate(`(() => { const o=document.querySelector('.toc-overlay.is-open'); const cp0=document.querySelector('.cp-backdrop'); window.dispatchEvent(new CustomEvent('gb:openSearch')); return {sheetOpen:!!o, sheetZ:o?getComputedStyle(o).zIndex:null, sheetDisp:o?getComputedStyle(o).display:null, cpPre:!!cp0}; })()`);
    await page.waitForTimeout(800);
    const st2=await page.evaluate(`(() => { const cp=document.querySelector('.cp-backdrop'); const o=document.querySelector('.toc-overlay.is-open'); const el=document.elementFromPoint(innerWidth/2, innerHeight/2); return {cpOpen:cp?cp.classList.contains('is-open'):null, cpZ:cp?getComputedStyle(cp).zIndex:null, cpDisp:cp?getComputedStyle(cp).display:null, sheetStillOpen:!!o, topAtCentre: el?(el.className.toString().slice(0,46)||el.tagName):null, focusIn: document.activeElement? (document.activeElement.className.toString().slice(0,30)||document.activeElement.tagName):null}; })()`);
    console.log(' TOC+search:',JSON.stringify(st),JSON.stringify(st2));
    await page.screenshot({path:`reports/arena-reader-audit/shots/mob-${fam}-toc+search.png`});
  } else console.log(' !! no TOC trigger');
  await page.close();
}
await browser.close();
