import { chromium } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const rows0=JSON.parse(fs.readFileSync('reports/arena-reader-audit/m-dom45.json','utf8'));
const reader=rows0.map(r=>r.url);
const hubs=['/baptisty-rossii/','/hard-texts/','/pastor-series/','/podrostok-za-kadrom/','/nagornaya/chast-1/','/izbrannoe/','/journal/','/'];
const VIEWS={1024:reader, 390:reader.concat(hubs), 1280:hubs};
const probe=`(() => {
  const ps=[...document.querySelectorAll('article p, main p')].filter(p=>{const b=p.getBoundingClientRect();return b.width>60&&b.height>4&&!p.closest('.summary-card,.quote-box,.info-box,.article-header,.breadcrumb,.resume-reading-block,.faq-accordion,.pullquote,figure,.article-meta,.author-card,.btoc-banner');});
  const rects=ps.map(p=>p.getBoundingClientRect());
  const widths=rects.map(r=>r.width).sort((a,b)=>a-b);
  const clippedRight=rects.filter(r=>r.right>innerWidth+2).length;
  const clippedLeft=rects.filter(r=>r.left<-2).length;
  const over=[...document.querySelectorAll('body *')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>40&&r.right>innerWidth+4).length;
  const rail=document.querySelector('.gbs-rail')||document.querySelector('.hrail');
  const rr=rail?rail.getBoundingClientRect():null;
  const med=rects.filter(r=>r.right<=innerWidth+2);
  const mw=med.map(r=>r.width).sort((a,b)=>a-b);
  return {np:ps.length, medW:mw.length?+mw[Math.floor(mw.length/2)].toFixed(0):null,
    clippedRight, clippedLeft, overCount:over,
    bodyOvfX:document.body.scrollWidth-document.body.clientWidth,
    rail: rr&&rr.width>0?{x:+rr.x.toFixed(0),r:+rr.right.toFixed(0)}:null,
    fam: document.querySelector('[data-gill-v16]')?(document.querySelector('.article-body')?'gillA':'gillB'):(document.querySelector('[data-reader-root]')?'hrail':'none') };
})()`;
const out={};
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const page=await ctx.newPage();
const perr={},cons={},reqfail={},http404={};
page.on('pageerror',e=>{(perr[cur]=perr[cur]||[]).push(String(e).slice(0,150));});
page.on('console',m=>{if(m.type()==='error'){(cons[cur]=cons[cur]||[]).push(m.text().slice(0,150));}});
page.on('requestfailed',r=>{const u=r.url();if(!u.startsWith(BASE)){(reqfail[cur]=reqfail[cur]||new Set()).add(u.slice(0,60));}});
page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(BASE)){(http404[cur]=http404[cur]||[]).push(r.url().replace(BASE,'').slice(0,70)+' ['+r.status()+']');}});
let cur='';
for(const [vw,urls] of Object.entries(VIEWS)){
  await page.setViewportSize({width:+vw,height:900});
  for(const u of urls){
    cur=vw+u;
    try{ await page.goto(BASE+u,{waitUntil:'load',timeout:45000}); }catch(e){ out[cur]={err:'NAV '+String(e).slice(0,80)}; continue; }
    await page.waitForTimeout(900);
    const d=await page.evaluate(probe).catch(e=>({err:String(e).slice(0,80)}));
    out[cur]={...d, perr:(perr[cur]||[]).slice(0,2), cons:(cons[cur]||[]).slice(0,2), ext:(reqfail[cur]?[...reqfail[cur]].slice(0,3):[]), http:(http404[cur]||[]).slice(0,4)};
    delete perr[cur]; delete cons[cur]; delete reqfail[cur]; delete http404[cur];
  }
}
fs.writeFileSync('reports/arena-reader-audit/r-scan.json',JSON.stringify(out,null,1));
// summary
const at=vw=>Object.entries(out).filter(([k])=>k.startsWith(vw));
for(const vw of ['1024','390','1280']){
  const list=at(vw);
  const clip=list.filter(([,d])=>(d.clippedRight||0)>0);
  const ovf=list.filter(([,d])=>(d.bodyOvfX||0)>0);
  const js=list.filter(([,d])=>(d.perr||[]).length||(d.cons||[]).length);
  const http=list.filter(([,d])=>(d.http||[]).length);
  console.log(`\n=== viewport ${vw}: pages ${list.length} | clippedRight>0: ${clip.length} | bodyOvfX>0: ${ovf.length} | js-errors: ${js.length} | local-404: ${http.length}`);
  if(clip.length)console.log('  CLIPPED:',clip.map(([k,d])=>k.slice(0,4)+k.slice(4).split('/')[1]+'/'+(k.slice(4).split('/')[2]||'')+'('+d.clippedRight+'p,'+d.fam+')').slice(0,14).join(', '));
  if(ovf.length)console.log('  OVFX:',ovf.map(([k,d])=>k.slice(4)+'='+d.bodyOvfX).slice(0,12).join(', '));
  if(js.length)console.log('  JSERR:',js.slice(0,8).map(([k,d])=>k.slice(4)+': '+((d.perr[0]||d.cons[0]||'').slice(0,70))).join('\n         '));
  if(http.length)console.log('  HTTP:',http.slice(0,8).map(([k,d])=>k.slice(4)+': '+d.http[0]).join('\n        '));
}
// family medW comparison per viewport
for(const vw of ['1024','390']){
  const g={};
  for(const [k,d] of at(vw)) (g[d.fam]=g[d.fam]||[]).push(d.medW);
  console.log(`\n${vw} median text width by family:`, Object.entries(g).map(([f,v])=>f+'='+v.filter(Boolean).join('/').slice(0,80)).join(' | '));
}
await page.close(); await browser.close();
