#!/usr/bin/env node
// Permanent browser contract for the actual Grok reader and personal library.
// Uses its production-like dist, isolated local storage and headless browsers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, firefox, webkit } from 'playwright';

const ROOT=path.resolve('dist');
const REPORTS=path.resolve('reports/reader-ux-stability');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml',
  '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
fs.mkdirSync(REPORTS,{recursive:true});
const server=http.createServer((req,res)=>{
  try {
    const url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const f=path.resolve(ROOT,'.'+(url.endsWith('/')?url+'index.html':url));
    const relative=path.relative(ROOT,f);
    if(relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(f) || !fs.statSync(f).isFile()){
      res.writeHead(404);res.end('Not found');return;
    }
    res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(f).pipe(res);
  }catch(error){res.writeHead(400);res.end('Bad URL');}
});
const results=[];
function check(engine,caseName,ok,evidence){
  results.push({engine,caseName,ok:Boolean(ok),evidence});
  if(!ok) throw Error('UX CONTRACT FAIL '+engine+' '+caseName+' '+JSON.stringify(evidence));
}
async function tocAndTooltip(driver,name,origin){
  const browser=await driver.launch({headless:true});
  try {
    const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference',serviceWorkers:'block'});
    await p.goto(origin+ROUTE,{waitUntil:'domcontentloaded',timeout:30000});
    await p.waitForFunction(()=>document.querySelector('.grok-toc li.grok-row'),null,{timeout:12000});
    const runtime=await p.evaluate(()=>({
      tooltip:window.GBArticleTooltips?.version||0,
      reader:typeof (window.GBReaderState?.getSnapshot||window.GBReaderState?.get),
      rows:document.querySelectorAll('.grok-toc li.grok-row').length,
      scripts:[...document.scripts].map(x=>x.src).filter(x=>x.includes('reader')||x.includes('article'))
    }));
    console.log('UX_RUNTIME',name,JSON.stringify(runtime));
    check(name,'canonical tooltip and ReaderState mounted',
      runtime.tooltip===20 && runtime.reader==='function',runtime);
    const sub1=p.locator('.grok-row--sub[data-grok-heading] > .grok-entry > a').first();
    const sub2=p.locator('.grok-row--sub[data-grok-heading] > .grok-entry > a').nth(1);
    await sub1.click();
    await p.waitForFunction(()=>document.querySelector('.grok-row--sub > .grok-entry > a[href="#sec-what-is"]')?.getAttribute('aria-current')==='location',null,{timeout:6000});
    const active1=await p.evaluate(()=>[...document.querySelectorAll('.grok-row.hrail-act > .grok-entry > a')].map(x=>x.getAttribute('href')));
    check(name,'first H3 becomes exact current location',active1.length===1&&active1[0]==='#sec-what-is',active1);
    await sub2.click();
    const secondHref=await sub2.getAttribute('href');
    await p.waitForFunction(href=>document.querySelector('.grok-row--sub > .grok-entry > a[href="'+href+'"]')?.getAttribute('aria-current')==='location',secondHref,{timeout:6500});
    const active2=await p.evaluate(()=>[...document.querySelectorAll('.grok-row.hrail-act > .grok-entry > a')].map(x=>x.getAttribute('href')));
    check(name,'second H3 moves exact current location',active2.length===1&&active2[0]===secondHref,active2);
    if(name==='chromium'){
      await p.evaluate(()=>{
        document.documentElement.classList.add('dark');
        document.documentElement.dataset.readerTheme='dark';
      });
      await p.screenshot({path:path.join(REPORTS,'grok-h3-active-dark.png'),animations:'disabled'});
    }
    const frames=await p.evaluate(async()=>{
      const rail=document.querySelector('.hrail--grok'),outline=rail.querySelector('.hrail-scroll');
      document.getElementById('hrailLayoutToggle').click();
      const records=[];
      for(let i=0;i<42;i++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const r=rail.getBoundingClientRect(),s=getComputedStyle(outline);
        records.push({w:r.width,opacity:parseFloat(s.opacity),visibility:s.visibility,
          clipped:s.clipPath,folding:rail.classList.contains('grok-rail-switching')});
      }
      return records;
    });
    const leaks=frames.filter(f=>f.folding&&(f.opacity>.01||f.visibility!=='hidden'));
    check(name,'TOC remains hidden throughout fold',leaks.length===0,{leaks,first:frames[0],last:frames.at(-1)});
    check(name,'rail settles at 68 px',Math.abs(frames.at(-1).w-68)<1,frames.at(-1));
    if(name==='chromium')await p.screenshot({path:path.join(REPORTS,'grok-rail-collapsed.png')});

    await p.evaluate(()=>{
      const fixture=document.createElement('div');
      fixture.id='gb-ux-tip-fixture';
      Object.assign(fixture.style,{position:'fixed',zIndex:'2147481000',left:'600px',
        top:'200px',display:'flex',gap:'26px',background:'transparent'});
      fixture.innerHTML=
        '<span id="gb-ux-tip-one" class="gterm" role="button" tabindex="0">One<span class="gtip">Да.</span></span>'+
        '<span id="gb-ux-tip-two" class="gterm" role="button" tabindex="0">Two<span class="gtip">Нет.</span></span>';
      document.body.appendChild(fixture);
      window.GBArticleTooltips.init(fixture);
    });
    const one=p.locator('#gb-ux-tip-one'),two=p.locator('#gb-ux-tip-two');
    await one.hover();
    await p.waitForFunction(()=>document.querySelector('#gb-ux-tip-one')?.getAttribute('aria-expanded')==='true');
    const firstWidth=await p.locator('body > .gb-floating-tip.is-open').evaluate(t=>t.getBoundingClientRect().width);
    if(firstWidth>=215){
      const rules=await p.locator('body > .gb-floating-tip.is-open').evaluate(t=>{
        const styles=[];
        function walk(rules,src){
          for(const r of rules){
            if(r.type===CSSRule.STYLE_RULE){
              let match=false;try{match=t.matches(r.selectorText)}catch{}
              if(match&&['width','min-width','max-width'].some(p=>r.style.getPropertyValue(p)))
                styles.push({src:src?.split('/').pop(),selector:r.selectorText.slice(0,200),
                  width:r.style.getPropertyValue('width'),minWidth:r.style.getPropertyValue('min-width'),
                  maxWidth:r.style.getPropertyValue('max-width'),priority:r.style.getPropertyPriority('width')});
            }else if(r.cssRules)walk(r.cssRules,src);
          }
        }
        for(const sheet of document.styleSheets)try{walk(sheet.cssRules,sheet.href)}catch{}
        const val=el=>el&&({cls:el.className,w:el.getBoundingClientRect().width,
          css:getComputedStyle(el).width,min:getComputedStyle(el).minWidth,
          max:getComputedStyle(el).maxWidth,display:getComputedStyle(el).display});
        return {tip:val(t),first:val(t.firstElementChild),second:val(t.firstElementChild?.firstElementChild),rules:styles};
      });
      console.log('TIP_CASCADE',name,JSON.stringify(rules));
    }
    check(name,'short popup has intrinsic width',firstWidth<215&&firstWidth>35,{firstWidth});
    if(name==='chromium')await p.screenshot({path:path.join(REPORTS,'short-tooltip-dark.png'),animations:'disabled'});
    await two.hover();
    await p.waitForFunction(()=>document.querySelector('#gb-ux-tip-two')?.getAttribute('aria-expanded')==='true');
    const handoff=await p.evaluate(()=>({
      old:document.querySelector('#gb-ux-tip-one')?.getAttribute('aria-expanded'),
      next:document.querySelector('#gb-ux-tip-two')?.getAttribute('aria-expanded'),
      portals:document.querySelectorAll('body > .gb-floating-tip.is-open').length
    }));
    check(name,'pointer moves immediately to next popup',
      handoff.old==='false'&&handoff.next==='true'&&handoff.portals===1,handoff);
    // The owner uses a 220ms leave timer with a brief hover-transit grace.
    // A hard 230ms sleep races Firefox/Linux scheduling. Assert the actual
    // observable dismissal within a strict 650ms interaction budget instead.
    const leaveStarted=await p.evaluate(()=>performance.now());
    await p.mouse.move(1330,820);
    await p.waitForFunction(()=>(
      document.querySelectorAll('body > .gb-floating-tip.is-open').length===0 &&
      document.querySelector('#gb-ux-tip-two')?.getAttribute('aria-expanded')==='false'
    ),null,{timeout:650});
    const abandoned=await p.evaluate(started=>({
      visible:document.querySelectorAll('body > .gb-floating-tip.is-open').length,
      expanded:document.querySelector('#gb-ux-tip-two')?.getAttribute('aria-expanded'),
      elapsedMs:performance.now()-started
    }),leaveStarted);
    check(name,'popup dismisses quickly after pointer leaves',
      abandoned.visible===0&&abandoned.expanded==='false'&&abandoned.elapsedMs<=650,abandoned);
    await two.focus();
    await p.waitForFunction(()=>document.querySelector('#gb-ux-tip-two')?.getAttribute('aria-expanded')==='true');
    await p.keyboard.press('Escape');
    check(name,'keyboard Escape still closes tooltip',
      await two.getAttribute('aria-expanded')==='false',null);
    await p.close();
  }finally{await browser.close();}
}
async function library(driver,name,origin,width,height){
  const browser=await driver.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block',locale:'ru-RU',reducedMotion:'reduce'});
    const q=Array.from({length:22},(_,i)=>({id:'seed-'+i,text:'A well documented quote '+i+'. '.repeat(i%4?2:25),
      articleTitle:'Source article '+(i%4),url:'/articles/seed-'+(i%4)+'/',savedAt:1781100000000+i}));
    await ctx.addInitScript(data=>{
      localStorage.setItem('gb-highlights-v1',JSON.stringify(data));
      localStorage.setItem('gb-reader-notes-v1',JSON.stringify([
        {id:'note-1',text:'Research note',articleTitle:'Source article 1',url:'/articles/seed-1/',savedAt:1781100000040}]));
      localStorage.setItem('gb-favorites',JSON.stringify([
        {path:'/articles/seed-2/',title:'Saved source',description:'Favorite',addedAt:1781100000050}]));
    },q);
    const p=await ctx.newPage();
    await p.goto(origin+ROUTE,{waitUntil:'domcontentloaded',timeout:30000});
    const fab=p.locator('#gb-hl-fab');
    await fab.waitFor({state:'visible',timeout:12000});
    await fab.click();
    await p.locator('.gb-hl-item').first().waitFor({timeout:15000});
    await p.evaluate(()=>document.fonts.ready);
    const snapshots=[];
    for(const tab of ['all','source','quote','note','favorite','all','source']){
      await p.locator('[data-library-tab="'+tab+'"]').click();
      const snapshot=await p.evaluate(()=>{
        const panel=document.querySelector('#gb-hl-panel'),r=panel.getBoundingClientRect();
        const list=document.querySelector('#gb-hl-list');
        const tabs=document.querySelector('#gb-hl-tabs').getBoundingClientRect();
        return {h:r.height,w:r.width,top:r.top,bottom:r.bottom,
          listVisible:getComputedStyle(list).display!=='none',
          listScrollable:list.scrollHeight>list.clientHeight+1,
          count:document.querySelectorAll('.gb-hl-item').length,
          tabsTop:tabs.top};
      });
      snapshots.push({tab,...snapshot});
      if(name==='chromium'&&width===1440&&['all','source','quote'].includes(tab)){
        await p.screenshot({path:path.join(REPORTS,'library-'+tab+'-'+width+'.png'),animations:'disabled'});
      }
    }
    const delta=Math.max(...snapshots.map(v=>v.h))-Math.min(...snapshots.map(v=>v.h));
    const movingHeader=Math.max(...snapshots.map(v=>v.tabsTop))-Math.min(...snapshots.map(v=>v.tabsTop));
    check(name+'-'+width,'library shell height stays stable across tabs',delta<=1,{delta,snapshots});
    check(name+'-'+width,'library tabs stay fixed within shell',movingHeader<=1,{movingHeader});
    check(name+'-'+width,'all entries scroll internally',snapshots[0].listScrollable,snapshots[0]);
    check(name+'-'+width,'library stays inside viewport',
      snapshots.every(v=>v.top>=-1&&v.bottom<=height+1&&v.w<=width+1),snapshots);
    await ctx.close();
  }finally{await browser.close()}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    for(const [name,driver] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]])
      await tocAndTooltip(driver,name,origin);
    for(const [name,driver,width,height] of [
      ['chromium',chromium,1440,900],['chromium',chromium,390,844],
      ['webkit',webkit,1440,900],['webkit',webkit,390,844]])
      await library(driver,name,origin,width,height);
    fs.writeFileSync(path.join(REPORTS,'checks.json'),JSON.stringify(results,null,2));
    console.log('READER_UX_STABILITY_PASS',results.length,'checks');
  }finally{await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{
  fs.writeFileSync(path.join(REPORTS,'checks.json'),JSON.stringify(results,null,2));
  console.error('READER_UX_STABILITY_FAILED',err.stack||String(err));
  process.exitCode=1;
});
