import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(() => {
  const R=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)};};
  const ps=[...document.querySelectorAll('article p, main p')].filter(p=>{const b=p.getBoundingClientRect();return b.width>60&&b.height>4&&!p.closest('.summary-card,.quote-box,.info-box,.article-header,.breadcrumb,.resume-reading-block,.faq-accordion,.pullquote,figure,.article-meta,.author-card');});
  const widths=ps.map(p=>p.getBoundingClientRect().width).sort((a,b)=>a-b);
  const s=ps[Math.floor(ps.length/2)];
  const cs=s?getComputedStyle(s):null;
  return { medW:widths.length?+widths[Math.floor(widths.length/2)].toFixed(1):null, lineH:cs?.lineHeight, fontS:cs?.fontSize,
    vw:innerWidth, ovfX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    bodyOvfX:document.body.scrollWidth-document.body.clientWidth,
    bottomBar:R(document.querySelector('.mobile-bottom-bar')), topBar:R(document.querySelector('.mobile-top-bar')), hmbar:R(document.querySelector('.hmbar')),
    barBtns:[...document.querySelectorAll('.mobile-bottom-bar > .gb-icon, .mobile-bottom-bar button, .mobile-top-bar .gb-icon, .hmbar .hm-icon, .hmtop .hm-icon')].map(b=>{const r=b.getBoundingClientRect();return {al:b.getAttribute('aria-label'),w:+r.width.toFixed(0),h:+r.height.toFixed(0)};}).slice(0,12),
    sheet:R(document.querySelector('.gill-settings-overlay.is-open,.hmsheet.is-open,.toc-overlay.is-open')),
  };
})()`;
// ---------- 1. hrail desktop settings UI ----------
{
  const page=await ctx.newPage();
  await page.setViewportSize({width:1280,height:900});
  await page.goto(BASE+'/articles/lot-i-sodom/',{waitUntil:'load'});await page.waitForTimeout(1200);
  const info=await page.evaluate(`(() => {
    const hits=[...document.querySelectorAll('*')].filter(e=>/^(Плотный|Свободный|Узкая|Шире|Сепия)$/.test((e.textContent||'').trim())&&e.children.length===0);
    const seen=new Map();
    for(const h of hits){ let box=h; for(let i=0;i<4&&box;i++){ const r=box.getBoundingClientRect(); if(r.width>0){break;} box=box.parentElement; }
      const sheet=h.closest('.hmsheet,.hm-pop,[class*=settings],[role=dialog]');
      seen.set((h.textContent||'').trim(), {sheetCls:sheet?sheet.className.toString().slice(0,50):null, sheetVisible:sheet?(sheet.offsetParent!==null||getComputedStyle(sheet).display!=='none'):null, sheetRect:sheet?(r=>({w:+r.width.toFixed(0),h:+r.height.toFixed(0)}))(sheet.getBoundingClientRect()):null}); }
    return Object.fromEntries(seen);
  })()`);
  console.log('HRAIL desktop settings segs:', JSON.stringify(info,null,1));
  const btn=await page.$('.hrail-bottom-btn[aria-label*="астройк"]');
  if(btn){await btn.click();await page.waitForTimeout(600);
    const after=await page.evaluate(`(() => { const sh=document.querySelector('.hmsheet'); const cs=sh?getComputedStyle(sh):null; const r=sh?sh.getBoundingClientRect():null; return {display:cs?.display, vis:cs?.visibility, rect:r?{w:+r.width.toFixed(0),h:+r.height.toFixed(0),x:+r.x.toFixed(0),y:+r.y.toFixed(0)}:null, open:sh?.className}; })()`);
    console.log('HRAIL after click settings:', JSON.stringify(after));
    await page.screenshot({path:'reports/arena-reader-audit/shots/hrail-desktop-settings.png'});
  }
  await page.close();
}
// ---------- 2. mobile B ----------
for(const [fam,url] of [['B','/articles/serdce-i-duh/'],['A','/articles/dzhon-gill-chast-1-chelovek/'],['HR','/articles/lot-i-sodom/']]){
  const page=await ctx.newPage();
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({});
  await page.goto(BASE+url,{waitUntil:'load'});await page.waitForTimeout(1400);
  console.log(`\n===== MOBILE ${fam} ${url} =====`);
  const d0=await page.evaluate(probe);
  console.log(' bars:',JSON.stringify({bb:d0.bottomBar,tb:d0.topBar,hm:d0.hmbar}), 'btns:',JSON.stringify(d0.barBtns));
  console.log(' text:',JSON.stringify({medW:d0.medW,lineH:d0.lineH,fontS:d0.fontS,ovfX:d0.ovfX,bodyOvfX:d0.bodyOvfX}));
  await page.screenshot({path:`reports/arena-reader-audit/shots/mob-${fam}-top.png`});
  // open settings from bottom bar / hmbar
  const gear=await page.$('.mobile-bottom-bar [aria-label*="астройк"], .hmbar [aria-label*="астройк"], .mobile-top-bar [aria-label*="астройк"]');
  if(gear){ await gear.click(); await page.waitForTimeout(700);
    const sh=await page.evaluate(probe);
    console.log(' sheet open rect:',JSON.stringify(sh.sheet));
    await page.screenshot({path:`reports/arena-reader-audit/shots/mob-${fam}-settings.png`});
    const click=async t=>{const el=await page.$(`button:has-text("${t}")`);if(el&&await el.isVisible().catch(()=>0)){await el.click();await page.waitForTimeout(450);return true;}return false;};
    await click('Свободный'); const d1=await page.evaluate(probe);
    console.log(` after «Свободный»: lineH ${d0.lineH} -> ${d1.lineH}`);
    await click('Узкая'); const d2=await page.evaluate(probe);
    console.log(` after «Узкая»: medW ${d1.medW} -> ${d2.medW} (vw ${d2.vw}, ovfX ${d2.ovfX}/${d2.bodyOvfX})`);
    await click('Шире'); const d3=await page.evaluate(probe);
    console.log(` after «Шире»: medW ${d2.medW} -> ${d3.medW}`);
    await page.screenshot({path:`reports/arena-reader-audit/shots/mob-${fam}-after-settings.png`});
  } else console.log(' !! no mobile settings trigger');
  // TOC + search stacking
  const toc=await page.$('.mobile-bottom-bar [aria-label*="главление"], .mobile-bottom-bar [aria-label*="Оглавление"], .hmbar [aria-label*="главлени"]');
  if(toc){ await toc.click(); await page.waitForTimeout(600);
    const z=await page.evaluate(`(() => { const o=document.querySelector('.toc-overlay.is-open'); const z1=o?getComputedStyle(o).zIndex:null; window.dispatchEvent(new CustomEvent('gb:openSearch')); const cp=document.querySelector('.cp-backdrop'); return {sheetZ:z1, sheetOpen:!!o, cpExists:!!cp, cpOpen:cp?cp.classList.contains('is-open'):null, cpZ:cp?getComputedStyle(cp).zIndex:null, topAtCentre:(e=>{const el=document.elementFromPoint(innerWidth/2, innerHeight/2); return el? (el.className.toString().slice(0,40)||el.tagName):null;})(0)}; })()`);
    console.log(' TOC open + search dispatched:',JSON.stringify(z));
    await page.screenshot({path:`reports/arena-reader-audit/shots/mob-${fam}-toc+search.png`});
  } else console.log(' !! no mobile TOC trigger');
  await page.close();
}
await browser.close();
