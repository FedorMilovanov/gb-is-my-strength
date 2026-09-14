import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8080';
const PAGES=[
  ['B  serdce-i-duh','/articles/serdce-i-duh/'],
  ['A  dzhon-gill-1','/articles/dzhon-gill-chast-1-chelovek/'],
  ['HR lot-i-sodom','/articles/lot-i-sodom/'],
];
const VWS=[1024,1280,1440,1920];
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const probe=`(() => {
  const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1),right:+b.right.toFixed(1)};};
  const rail=document.querySelector('.gbs-rail')||document.querySelector('.hrail');
  const wrap=document.querySelector('.page-wrap')||document.querySelector('main');
  const main=document.querySelector('main');
  const art=document.querySelector('article');
  const p=document.querySelector('article p')||document.querySelector('main p');
  const cs=e=>e?getComputedStyle(e):null;
  const gv=(e,n)=>e?getComputedStyle(e).getPropertyValue(n).trim():'';
  const world=document.querySelector('[data-gill-v16]');
  return {
    rail:r(rail), railPos:cs(rail)?.position, railZ:cs(rail)?.zIndex,
    wrap:r(wrap), main:r(main), art:r(art), p:r(p),
    pLine:cs(p)?.lineHeight, pFont:cs(p)?.fontSize,
    mainW:cs(main)?.width, wrapW:cs(wrap)?.width,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vars:{ gbMeasure:gv(world,'--gb-measure'), reserve:gv(world,'--gb-rail-reserve'),
           gbs2Line:gv(world,'--gbs2-article-line'), gbs2Measure:gv(world,'--gbs2-article-measure'),
           readerLine:gv(document.documentElement,'--gb-reader-line-height'),
           readerMeasure:gv(document.documentElement,'--gb-reader-measure'),
           readerFont:gv(document.documentElement,'--gb-reader-font-scale') },
    pIntersectsRail: (rail&&p)? !(p.getBoundingClientRect().right<=rail.getBoundingClientRect().left || p.getBoundingClientRect().left>=rail.getBoundingClientRect().right) : false,
    pUnderRailPx: (rail&&p)? Math.max(0, Math.min(p.getBoundingClientRect().right,rail.getBoundingClientRect().right)-Math.max(p.getBoundingClientRect().left,rail.getBoundingClientRect().left)) : 0,
    textCentreDrift: p? ((p.getBoundingClientRect().left+p.getBoundingClientRect().right)/2 - window.innerWidth/2) : null,
    artClass: art?.className||'(none)', mainClass: main?.className||'(none)'
  };
})()`;
for(const [label,url] of PAGES){
  const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  for(const vw of VWS){
    await page.setViewportSize({width:vw,height:900});
    await page.goto(BASE+url,{waitUntil:'load',timeout:60000});
    await page.waitForTimeout(1400);
    const d=await page.evaluate(probe);
    const f=n=>n==null?'—':(typeof n==='number'?n.toFixed(1):n);
    console.log(`\n[${label}] ${vw}px  main="${d.mainClass}" article="${d.artClass}"`);
    console.log(`  rail   x=${f(d.rail?.x)} right=${f(d.rail?.right)} w=${f(d.rail?.w)} pos=${d.railPos} z=${d.railZ}`);
    console.log(`  wrap   x=${f(d.wrap?.x)} w=${f(d.wrap?.w)}   main x=${f(d.main?.x)} w=${f(d.main?.w)}`);
    console.log(`  para   x=${f(d.p?.x)} right=${f(d.p?.right)} w=${f(d.p?.w)}  lineHeight=${d.pLine} fontSize=${d.pFont}`);
    console.log(`  overflowX=${d.overflowX}  para∩rail=${d.pIntersectsRail} (${f(d.pUnderRailPx)}px)  textCentreDrift=${f(d.textCentreDrift)}`);
    console.log(`  vars: --gb-measure=${d.vars.gbMeasure||'—'} reserve=${d.vars.reserve||'—'} gbs2-line=${d.vars.gbs2Line||'—'} gbs2-measure=${d.vars.gbs2Measure||'—'} reader-line=${d.vars.readerLine||'—'} reader-measure=${d.vars.readerMeasure||'—'} font-scale=${d.vars.readerFont||'—'}`);
    if(errs.length) console.log('  PAGE ERRORS:', errs.slice(0,3).join(' | '));
    if(vw===1280||vw===1024) await page.screenshot({path:`reports/arena-reader-audit/shots/${label.split(' ')[0]}-${url.split('/')[2]}-${vw}.png`,clip:{x:0,y:0,width:vw,height:900}});
  }
  await page.close();
}
await browser.close();
