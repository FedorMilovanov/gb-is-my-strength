import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),DIST=path.join(ROOT,'dist');
const OUT=path.join(ROOT,'reports','reader-mobile-sitewide-audit');fs.mkdirSync(OUT,{recursive:true});
const ROUTES=[['grok','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],['gill','/articles/dzhon-gill-chast-1-chelovek/'],['sermon','/nagornaya/chast-1/'],['heart','/articles/krajne-li-isporcheno-serdce/'],['pastor','/articles/20-antisovetov-pastoru/'],['baptists','/baptisty-rossii/']];
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv=http.createServer((req,res)=>{
 const url=decodeURIComponent((req.url||'/').split('?')[0]),file=path.resolve(DIST,'.'+(url.endsWith('/')?url+'index.html':url)),rel=path.relative(DIST,file);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+srv.address().port,result=[];
for(const [engine,driver] of Object.entries({chromium,webkit,firefox})){
 const browser=await driver.launch({headless:true});
 for(const width of [320,375,390,430,480]){
  const height=width===320?640:844;
  for(const [name,route] of ROUTES){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:engine!=='firefox',deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(6000);
   const row={engine,width,height,name,route,fail:[],warnings:[],measure:null,anchor:null,settings:null,errors:[]};
   page.on('pageerror',err=>row.errors.push(String(err).slice(0,180)));
   try{
    const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:15000});if(response.status()!==200)row.fail.push('HTTP '+response.status());
    await page.waitForTimeout(150);
    row.measure=await page.evaluate(()=>{
     const h=document.documentElement;
     const cols=[...document.querySelectorAll('main,article,.article-main,.page-wrap')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cl:String(e.className).slice(0,55),x:Math.round(r.x),w:Math.round(r.width),right:Math.round(r.right)}}).filter(x=>x.w>100);
     const bottom=[...document.querySelectorAll('.mobile-bottom-bar,.bottom-bar,.gbs2-bottom,.gb-mobile-bar,[data-mobile-chrome]')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>100&&r.height>10&&s.visibility!=='hidden'&&s.display!=='none'}).map(e=>{const r=e.getBoundingClientRect();return {selector:String(e.className).slice(0,60),top:Math.round(r.top),height:Math.round(r.height),position:getComputedStyle(e).position}});
     const controls=[...document.querySelectorAll('button,[role="button"]')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.y>=0&&r.y<innerHeight&&s.visibility!=='hidden'&&s.display!=='none'}).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,cl:String(e.className).slice(0,40),label:e.getAttribute('aria-label')||e.textContent?.trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y)}});
     return {innerWidth,clientWidth:h.clientWidth,scrollWidth:h.scrollWidth,innerHeight,cols:cols.slice(0,8),bottom,smallControls:controls.filter(x=>x.w<24||x.h<24).slice(0,10),controls:controls.slice(0,20)};
    });
    if(row.measure.scrollWidth>row.measure.clientWidth+2)row.fail.push('horizontal overflow '+(row.measure.scrollWidth-row.measure.clientWidth));
    if(row.measure.smallControls.length)row.warnings.push('tiny controls '+row.measure.smallControls.map(x=>x.id||x.cl).join(','));
    if((name==='heart'||name==='pastor')&&width===390){
      const anchor=page.locator('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]').first();
      if(await anchor.count()){
       await anchor.scrollIntoViewIfNeeded().catch(()=>{});await page.waitForTimeout(240);
       row.anchor=await anchor.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,inside:y>=0&&y<innerHeight,hit:hit?.outerHTML.slice(0,100),correct:hit===e||e.contains(hit)}});
       if(!row.anchor.inside||!row.anchor.correct)row.fail.push('heading anchor center is not a hit target');
       else try{await anchor.tap({timeout:3000});await page.waitForTimeout(60);row.anchor.after=await page.evaluate(()=>({hash:location.hash,toast:document.getElementById('anchor-copy-toast')?.classList.contains('is-visible')}));}catch(e){row.fail.push('heading anchor tap '+String(e).slice(0,140));}
      }
    }
    if(name==='grok'&&width===390){
      const settings=page.locator('#hmSettingsBtn');
      if(await settings.isVisible()){await settings.tap();await page.waitForTimeout(360);row.settings=await page.evaluate(()=>{const s=document.querySelector('#hmSettings'),r=s?.getBoundingClientRect();return {open:s?.classList.contains('is-open'),y:r?.y,h:r?.height,scrollWidth:document.documentElement.scrollWidth,inert:s?.inert}});if(!row.settings.open)row.fail.push('settings did not open from tap');await page.screenshot({path:path.join(OUT,engine+'-'+width+'-grok-settings.png')});await page.keyboard.press('Escape');}
    }
    if(name==='grok'&&width===390){
      const toc=page.locator('#hmSectionBtn');
      if(await toc.isVisible()){
        await toc.tap();await page.waitForTimeout(260);
        const shown=await page.evaluate(()=>document.getElementById('hmSheet')?.classList.contains('is-open'));
        if(!shown)row.fail.push('toc did not open on native section-button tap');
        await page.keyboard.press('Escape');
      }
    }
    if(width===390&&['grok','heart','sermon','baptists'].includes(name)){
      await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.screenshot({path:path.join(OUT,engine+'-'+width+'-'+name+'-top.png')});
      await page.evaluate(()=>window.scrollTo(0,Math.max(0,document.documentElement.scrollHeight-innerHeight)));await page.waitForTimeout(100);
      await page.screenshot({path:path.join(OUT,engine+'-'+width+'-'+name+'-end.png')});
    }
   }catch(e){row.fail.push('execution '+String(e).slice(0,220));}
   result.push(row);await context.close();
  }
 }
 await browser.close();
}
await new Promise(r=>srv.close(r));fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({cases:result.length,failed:result.filter(x=>x.fail.length).map(x=>({engine:x.engine,width:x.width,name:x.name,fail:x.fail,anchor:x.anchor})),warnings:result.filter(x=>x.warnings.length).map(x=>({engine:x.engine,width:x.width,name:x.name,warnings:x.warnings}))},null,2));

if(result.some(row=>row.fail.length)) process.exitCode=1;
