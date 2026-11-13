#!/usr/bin/env node
/**
 * Cross-engine Reader visual evidence. Never block fonts or images.
 * Not a visual design snapshot: this guards content geometry, asset loading,
 * preserved document proportions, theme and viewport after genuine rendering.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const DIST=join(ROOT,'dist');
const REPORT=join(ROOT,'reports','reader-real-assets');
const FAST=process.env.GB_READER_REAL_ASSETS_FAST==='1';
const widths=FAST?[320,390,768,1440]:[320,360,390,430,768,1024,1200,1440,1920];
const themes=['light','dark','sepia'];
const routes=[
 ['gill','/articles/dzhon-gill-chast-1-chelovek/'],
 ['heart','/articles/chto-bibliya-nazyvaet-serdcem/'],
 ['hermenevtika','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
 ['baptist-chapter','/baptisty-rossii/dva-sezda-1884/'],
 ['baptist-index','/baptisty-rossii/'],
];
const sha=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.woff2':'font/woff2','.ico':'image/x-icon'};
await mkdir(REPORT,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url||'/', 'http://127.0.0.1').pathname);
  let file=resolve(DIST,'.'+name);
  if(file!==DIST&&!file.startsWith(DIST+sep))throw Error('outside dist');
  if((await stat(file)).isDirectory())file=join(file,'index.html');
  const buf=await readFile(file);
  res.writeHead(200,{'content-type':MIME[extname(file)]||'application/octet-stream','cache-control':'no-store'});
  res.end(buf);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
const results=[];
let browser=null;
try{
for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
 browser=await driver.launch({headless:true});
 for(const [label,route] of routes){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto(url+route,{waitUntil:'domcontentloaded',timeout:30000});
   await page.evaluate(()=>document.querySelectorAll('img[loading=lazy]').forEach(el=>el.loading='eager'));
   await Promise.race([page.evaluate(()=>document.fonts?.ready),page.waitForTimeout(4500)]);
   await page.waitForFunction(()=>[...document.querySelectorAll('main img, article img')]
     .every(img=>img.complete),null,{timeout:4500}).catch(()=>{});
   for(const width of widths){
    await page.setViewportSize({width,height:width<=430?844:900});
    for(const theme of themes){
     await page.evaluate(t=>{
      if(typeof window.GBReaderPreferences?.setTheme==='function')
       window.GBReaderPreferences.setTheme(t,{source:'reader-real-assets-qa'});
      else{
       document.documentElement.classList.toggle('dark',t==='dark');
       document.documentElement.setAttribute('data-reader-theme',t);
      }
     },theme);
     // Responsive font faces can switch after width/theme changes.
     // The manifest and screenshots must describe a settled visual state.
     await page.evaluate(async()=>{
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      await document.fonts?.ready;
     });
     await page.waitForFunction(()=>document.fonts?.status==='loaded',null,{timeout:4500}).catch(()=>{});
     const data=await page.evaluate(()=>{
      const viewport=document.documentElement.clientWidth;
      const imgs=[...document.querySelectorAll('main img, article img')]
        .filter(img=>img.getClientRects().length>0);
      const boxes=[...document.querySelectorAll('main img, main figure, main figcaption, main pre, main table, article img, article figure, article pre, article table')]
        .filter(el=>{const b=el.getBoundingClientRect();return b.width>0 && b.right>viewport+2 && getComputedStyle(el).position!=='fixed';})
        .slice(0,6).map(el=>({tag:el.tagName,cls:String(el.className||'').slice(0,50),right:Math.round(el.getBoundingClientRect().right)}));
      return{
       htmlWidth:document.documentElement.scrollWidth,
       bodyWidth:document.body.scrollWidth,
       clientWidth:viewport,
       overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-viewport,
       fontStatus:document.fonts?.status||null,
       fonts:document.fonts?.size||0,
       imageCount:imgs.length,
       imagesBroken:imgs.filter(img=>img.complete&&img.naturalWidth===0).map(img=>img.currentSrc).slice(0,6),
       imagesPending:imgs.filter(img=>!img.complete).map(img=>img.currentSrc).slice(0,6),
       imageOverflow:boxes,
       appliedTheme:document.documentElement.getAttribute('data-reader-theme')||'',
      };
     });
     const row={sha,engine,label,route,width,theme,status:response.status(),...data};
     results.push(row);
     if((width===390&&(theme==='light'||theme==='dark'))||(width===1440&&theme==='light')){
      const file=[label,engine,width,theme,sha.slice(0,12)].join('--')+'.png';
      await page.screenshot({path:join(REPORT,file),timeout:18000}).catch(()=>{});
     }
    }
   }
  }catch(e){results.push({sha,engine,label,route,error:String(e)})}
  await page.close();
 }
 await browser.close();browser=null;
 console.log('[READER-REAL-ASSETS] '+engine+' complete');
}
}finally{await browser?.close();await new Promise(done=>server.close(done));}
await writeFile(join(REPORT,'manifest.json'),JSON.stringify({sha,fast:FAST,results},null,2));
const failures=results.filter(row=>row.error||row.status!==200||row.overflow>2||
 row.fontStatus!=='loaded'||row.imagesBroken?.length>0||row.imagesPending?.length>0||row.imageOverflow?.length>0||
 (row.appliedTheme&&row.appliedTheme!==row.theme));
const summary={sha,fast:FAST,routes:routes.length,engines:3,widths:widths.length,themes:themes.length,
 scenarios:results.length,failures:failures.length,failed:failures.slice(0,25)};
await writeFile(join(REPORT,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(failures.length)process.exitCode=1;
