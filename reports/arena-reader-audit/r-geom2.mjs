import { chromium } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const PAGES=[
  ['B','/articles/serdce-i-duh/'],
  ['B','/hard-texts/duhi-v-temnice-noi-kreshchenie-pobeda/'],
  ['A','/articles/dzhon-gill-chast-1-chelovek/'],
  ['A','/baptisty-rossii/sovetskaya-noch/'],
  ['HR','/articles/lot-i-sodom/'],
];
const VWS=[1024,1280,1440,1920];
const probe=`(() => {
  const R=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),right:+b.right.toFixed(1),w:+b.width.toFixed(1)};};
  const rail=document.querySelector('.gbs-rail')||document.querySelector('.hrail');
  const wrap=document.querySelector('.page-wrap');
  const main=document.querySelector('main');
  const art=document.querySelector('article');
  // body paragraphs: exclude lead/header/card/quote containers
  const ps=[...document.querySelectorAll('article p, main p')].filter(p=>{
    const b=p.getBoundingClientRect(); if(b.width<80||b.height<4) return false;
    if(p.closest('.summary-card,.quote-box,.info-box,.warn-box,.article-header,.breadcrumb,.resume-reading-block,.faq-accordion,.pullquote,figure,figcaption,.btoc-banner,.article-meta,.author-card,.note-box')) return false;
    return true;
  });
  const widths=ps.map(p=>+p.getBoundingClientRect().width.toFixed(1)).sort((a,b)=>a-b);
  const med=widths.length?widths[Math.floor(widths.length/2)]:null;
  const sample=ps.find(p=>Math.abs(p.getBoundingClientRect().width-med)<2)||ps[0]||null;
  const sb=sample?sample.getBoundingClientRect():null;
  const cs=sample?getComputedStyle(sample):null;
  const gv=(e,n)=>e?getComputedStyle(e).getPropertyValue(n).trim().replace(/\\s+/g,' '):'';
  const world=document.querySelector('[data-gill-v16]');
  const rr=rail?rail.getBoundingClientRect():null;
  return { n:ps.length, medW:med,
    sampleW: sb?+sb.width.toFixed(1):null, sampleL: sb?+sb.left.toFixed(1):null, sampleR: sb?+sb.right.toFixed(1):null,
    sampleTag: sample? sample.tagName+'.'+(sample.className||'(none)')+' in '+(sample.parentElement?.className||sample.parentElement?.tagName):null,
    lineH: cs?.lineHeight, fontS: cs?.fontSize,
    rail:R(rail), wrap:R(wrap), main:R(main), art:R(art),
    underRail: (rr&&sb)? +Math.max(0, Math.min(sb.right,rr.right)-Math.max(sb.left,rr.left)).toFixed(1):0,
    mainUnderRail: (rr&&main)? +Math.max(0, Math.min(main.getBoundingClientRect().right,rr.right)-Math.max(main.getBoundingClientRect().left,rr.left)).toFixed(1):0,
    drift: sb? +((sb.left+sb.right)/2 - innerWidth/2).toFixed(1):null,
    ovfX: document.documentElement.scrollWidth-document.documentElement.clientWidth,
    bodyOvfX: document.body.scrollWidth-document.body.clientWidth,
    vars:{gbMeasure:gv(world,'--gb-measure').slice(0,60),gbs2Line:gv(world,'--gbs2-article-line'),gbs2Measure:gv(world,'--gbs2-article-measure').slice(0,40),readerLine:gv(document.documentElement,'--gb-reader-line-height'),readerMeasure:gv(document.documentElement,'--gb-reader-measure'),fontScale:gv(document.documentElement,'--gb-reader-font-scale')},
    mainCls: main?.className||'(none)', artCls: art?.className||'(none)'
  };
})()`;
const out=[];
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
for(const [fam,url] of PAGES){
  const page=await ctx.newPage();
  const errs=[],failed=[];
  page.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  page.on('requestfailed',r=>failed.push(r.url().slice(0,90)));
  for(const vw of VWS){
    await page.setViewportSize({width:vw,height:900});
    await page.goto(BASE+url,{waitUntil:'load',timeout:60000});
    await page.waitForTimeout(1500);
    const d=await page.evaluate(probe);
    out.push({fam,url,vw,...d});
    console.log(`[${fam}] ${vw}  ${url}`);
    console.log(`    rail ${d.rail?d.rail.x+'→'+d.rail.right:'—'} | wrap ${d.wrap?d.wrap.x+'→'+d.wrap.right+' ('+d.wrap.w+')':'—'} | main ${d.main?d.main.x+'→'+d.main.right+' ('+d.main.w+')':'—'} | art ${d.art?d.art.w:'—'}`);
    console.log(`    body-p n=${d.n} medianW=${d.medW} sample ${d.sampleL}→${d.sampleR} | line=${d.lineH} font=${d.fontS} | drift=${d.drift} | textUnderRail=${d.underRail}px mainUnderRail=${d.mainUnderRail}px | ovfX=${d.ovfX}/${d.bodyOvfX}`);
    console.log(`    sample=${d.sampleTag}`);
    if(errs.length)console.log('    PAGEERROR:',errs[0]);
    if(failed.length)console.log('    FAILED REQ (first 2):',failed.slice(0,2).join(' , '));
    await page.screenshot({path:`reports/arena-reader-audit/shots/${fam}-${url.split('/').filter(Boolean).pop()}-${vw}.png`,clip:{x:0,y:0,width:vw,height:900}});
  }
  errs.length=0;failed.length=0;
  await page.close();
}
fs.writeFileSync('reports/arena-reader-audit/r-geom2.json',JSON.stringify(out,null,1));
await browser.close();
