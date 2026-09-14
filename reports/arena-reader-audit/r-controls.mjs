import { chromium } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const PAGES=[['B','/articles/serdce-i-duh/'],['A','/articles/dzhon-gill-chast-1-chelovek/'],['HR','/articles/lot-i-sodom/']];
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const results={};
const bodyProbe=`(() => {
  const ps=[...document.querySelectorAll('article p, main p')].filter(p=>{const b=p.getBoundingClientRect();return b.width>80&&b.height>4&&!p.closest('.summary-card,.quote-box,.info-box,.article-header,.breadcrumb,.resume-reading-block,.faq-accordion,.pullquote,figure,.article-meta,.author-card');});
  const widths=ps.map(p=>p.getBoundingClientRect().width).sort((a,b)=>a-b);
  const med=widths[Math.floor(widths.length/2)]||0;
  const s=ps.find(p=>Math.abs(p.getBoundingClientRect().width-med)<2)||ps[0];
  const cs=s?getComputedStyle(s):null;
  const r=s?s.getBoundingClientRect():null;
  const gv=(e,n)=>e?getComputedStyle(e).getPropertyValue(n).trim():'';
  const world=document.querySelector('[data-gill-v16]')||document.querySelector('[data-reader-root]');
  return { medW:+med.toFixed(1), left:r?+r.left.toFixed(1):null, right:r?+r.right.toFixed(1):null,
    lineH:cs?.lineHeight, fontS:cs?.fontSize,
    inlineLine:world?world.style.getPropertyValue('--gbs2-article-line')||world.style.getPropertyValue('--hm-article-line'):null,
    inlineMeasure:world?world.style.getPropertyValue('--gbs2-article-measure')||world.style.getPropertyValue('--hm-article-measure'):null,
    readerLine:gv(document.documentElement,'--gb-reader-line-height'), readerMeasure:gv(document.documentElement,'--gb-reader-measure'), fontScale:gv(document.documentElement,'--gb-reader-font-scale'),
    theme:document.documentElement.getAttribute('data-reader-theme'), ls:Object.keys(localStorage).filter(k=>/reader|font|pref/.test(k)).map(k=>k+'='+localStorage.getItem(k)).join('; ').slice(0,220) };
})()`;
for(const [fam,url] of PAGES){
  const page=await ctx.newPage();
  await page.setViewportSize({width:1280,height:900});
  await page.goto(BASE+url,{waitUntil:'load',timeout:60000});
  await page.waitForTimeout(1500);
  const log=[];
  // 1. discover triggers
  const triggers=await page.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button,[role=button]')].filter(b=>b.offsetParent!==null || b.closest('.gbs-rail,.hrail,.mobile-bottom-bar'));
    return btns.map(b=>({al:b.getAttribute('aria-label'),tt:b.getAttribute('data-tip'),fc:b.getAttribute('data-fc-action'),cls:(b.className||'').toString().slice(0,40),txt:(b.textContent||'').trim().slice(0,24)})).filter(t=>t.al||t.tt||t.fc).slice(0,40);
  })()`);
  log.push('TRIGGERS: '+JSON.stringify(triggers));
  // 2. open settings
  const openSel=['[data-fc-action="settings"]','button[aria-label*="астройк"]','.gbs-rail-foot__btn[aria-label*="астройк"]','.gb-icon[aria-label*="астройк"]','.hrail-bottom-btn[aria-label*="астройк"]','.hm-icon[aria-label*="астройк"]'];
  let opened=false;
  for(const s of openSel){
    const el=await page.$(s);
    if(el){ try{ await el.click({timeout:3000}); opened=true; log.push('opened via '+s); break; }catch(e){} }
  }
  if(!opened) log.push('!! settings trigger NOT found');
  await page.waitForTimeout(700);
  const sheetInfo=await page.evaluate(`(() => {
    const sh=document.querySelector('.gill-settings-overlay,.gill-settings-sheet,.hmsheet,[class*=settings-overlay]');
    if(!sh) return null;
    const vis=sh.offsetParent!==null||getComputedStyle(sh).display!=='none';
    const segs=[...sh.querySelectorAll('button')].map(b=>(b.textContent||'').trim().replace(/\\s+/g,' ').slice(0,26)).filter(Boolean);
    return {cls:sh.className.toString().slice(0,60), visible:vis, segs};
  })()`);
  log.push('SHEET: '+JSON.stringify(sheetInfo));
  await page.screenshot({path:`reports/arena-reader-audit/shots/ctl-${fam}-sheet-open.png`});
  const before=await page.evaluate(bodyProbe);
  log.push('BEFORE: '+JSON.stringify(before));
  // 3. click line-height "Свободный"
  const clickByText=async (txts)=>{ for(const t of txts){ const el=await page.$(`button:has-text("${t}")`); if(el&&await el.isVisible().catch(()=>false)){ await el.click(); return t; } } return null; };
  const lh=await clickByText(['Свободный','СВОБОДНЫЙ']);
  await page.waitForTimeout(500);
  const afterLH=await page.evaluate(bodyProbe);
  log.push(`CLICK line="${lh}" AFTER: ${JSON.stringify(afterLH)}`);
  // 4. click measure "Узкая"
  const mz=await clickByText(['Узкая','УЗКАЯ']);
  await page.waitForTimeout(500);
  const afterMZ=await page.evaluate(bodyProbe);
  log.push(`CLICK measure="${mz}" AFTER: ${JSON.stringify(afterMZ)}`);
  // 5. click A+ (font)
  const fnt=await clickByText(['A+','А+','Крупнее']);
  if(!fnt){ const el=await page.$('[aria-label*="величить шрифт"],[data-fc-action="font-up"],[aria-label*="Увеличить"]'); if(el){await el.click(); log.push('clicked font-up by aria');} } else log.push('clicked font '+fnt);
  await page.waitForTimeout(500);
  const afterF=await page.evaluate(bodyProbe);
  log.push('AFTER FONT: '+JSON.stringify(afterF));
  // 6. theme sepia
  const th=await clickByText(['Сепия','СЕПИЯ']);
  await page.waitForTimeout(600);
  const colors=await page.evaluate(`(() => ({body:getComputedStyle(document.body).backgroundColor, main:getComputedStyle(document.querySelector('main')).backgroundColor, art:getComputedStyle(document.querySelector('article')).backgroundColor, rail:getComputedStyle(document.querySelector('.gbs-rail')||document.querySelector('.hrail')).backgroundColor, htmlAttr:document.documentElement.getAttribute('data-reader-theme')}))()`);
  log.push(`CLICK theme="${th}" COLORS: ${JSON.stringify(colors)}`);
  await page.screenshot({path:`reports/arena-reader-audit/shots/ctl-${fam}-sepia.png`});
  results[fam+url]=log.join('\n');
  console.log('\n================ '+fam+' '+url+'\n'+log.join('\n'));
  await page.close();
}
fs.writeFileSync('reports/arena-reader-audit/r-controls.txt',JSON.stringify(results,null,1));
await browser.close();
