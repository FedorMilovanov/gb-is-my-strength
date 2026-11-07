#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, firefox, webkit } from 'playwright';

const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if (process.env.SOURCE_SHA) assert.equal(sourceSha,process.env.SOURCE_SHA,'Theme audit must use the exact tested head');
const DIST=path.resolve('dist');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const HTML=path.join(DIST,ROUTE.replace(/^\/+|\/+$/g,''),'index.html');
assert.ok(fs.existsSync(HTML),'candidate dist is required');
assert.match(fs.readFileSync(HTML,'utf8'),/<aside\s+class="hrail hrail--grok"/);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp',
 '.png':'image/png','.woff2':'font/woff2','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{
 try {
  const url=decodeURIComponent((req.url||'/').split('?')[0]);
  let file=path.resolve(DIST,url.replace(/^\/+/,''));
  if(!path.extname(file))file=path.join(file,'index.html');
  const rel=path.relative(DIST,file);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
 }catch {res.writeHead(400);res.end('invalid');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const results=[];
function check(engine,name,ok,details){
 results.push({engine,name,pass:!!ok,details});
 assert.ok(ok,engine+' '+name+' '+JSON.stringify(details));
}
try{
 for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(origin+ROUTE,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('.hrail--grok.grok-ready');
   check(engine,'reader settings trigger',await page.locator('#hrailSettingsBtn').count()===1);
   await page.locator('#hrailSettingsBtn').click();
   await page.waitForFunction(()=>document.querySelector('#hmSettings')?.getAttribute('aria-hidden')==='false');
   check(engine,'single existing settings surface is open',
    await page.locator('#hmSettings[aria-hidden=false]').count()===1);
   const surfaces=[];
   for(const theme of ['light','sepia','dark']){
    await page.locator('[data-hm-theme="'+theme+'"]').click();
    await page.waitForFunction(value=>document.documentElement.getAttribute('data-reader-theme')===value,theme);
    // The canonical link color has a 200ms CSS transition; assert settled contrast.
    await page.waitForTimeout(280);
    const snapshot=await page.evaluate(()=>{
     const rail=document.querySelector('.hrail--grok');
     const heading=rail.querySelector('.grok-row--h2 > .grok-entry a');
     const root=document.querySelector('[data-reader-root]');
     const link=getComputedStyle(heading),css=getComputedStyle(rail),html=document.documentElement;
     const selected=Array.from(document.querySelectorAll('[data-hm-theme]'))
       .filter(n=>n.getAttribute('aria-pressed')==='true').map(n=>n.getAttribute('data-hm-theme'));
     const colorTriplet=(value)=>{
       const raw=String(value||'').trim();
       const hex=raw.match(/^#([0-9a-f]{6})$/i);
       if(hex) return [0,2,4].map(n=>parseInt(hex[1].slice(n,n+2),16));
       const rgb=raw.match(/^rgba?\(([^)]+)\)$/i);
       return rgb ? rgb[1].split(/[, ]+/).slice(0,3).map(Number) : [];
     };
     const luminance=(parts)=>parts.length===3 ? parts
       .map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4)
       .reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0) : NaN;
     const colorLuminance=luminance(colorTriplet(link.color));
     const backgrounds=['--rail-surface','--rail-surface-raised']
       .map(token=>luminance(colorTriplet(css.getPropertyValue(token))));
     const contrast=Math.min(...backgrounds.map(bg=>
       (Math.max(bg,colorLuminance)+0.05)/(Math.min(bg,colorLuminance)+0.05)));
     return {contrast,theme:html.getAttribute('data-reader-theme'),
       dark:html.classList.contains('dark'),sepia:root?.getAttribute('data-hm-reader-theme'),
       selected,railBg:css.backgroundColor,railImage:css.backgroundImage,
       linkColor:link.color,railMuted:css.getPropertyValue('--rail-muted').trim(),
        colorTransition:link.transitionProperty,decoration:link.textDecorationLine,
       overflow:document.documentElement.scrollWidth-innerWidth,
       visible:css.display!=='none',
       originalSvg:!!document.getElementById('gbFloatingControls')};
    });
    surfaces.push(snapshot);
    check(engine,'theme '+theme+' selected',snapshot.selected.length===1&&snapshot.selected[0]===theme,snapshot);
    check(engine,'theme '+theme+' original tools and geometry',snapshot.visible&&snapshot.originalSvg&&snapshot.overflow<=2,snapshot);
    check(engine,'theme '+theme+' TOC links not underlined',snapshot.decoration==='none',snapshot);
     // The reader's text palette must change atomically with the background:
     // an animated color can temporarily be unreadable on Linux WebKit.
     check(engine,'theme '+theme+' text color is not animated',
       !snapshot.colorTransition.split(',').map(s=>s.trim()).some(s=>s==='all'||s==='color'),snapshot);
    check(engine,'theme '+theme+' WCAG AA small navigation text contrast',snapshot.contrast>=4.5,snapshot);
   }
   check(engine,'sepia actually changes computed styling',
    surfaces[1].railBg!==surfaces[0].railBg||surfaces[1].railImage!==surfaces[0].railImage,surfaces);
   check(engine,'night actually changes computed styling',
    surfaces[2].railBg!==surfaces[1].railBg||surfaces[2].railImage!==surfaces[1].railImage,surfaces);
   const before=await page.locator('[data-reader-root] .article-body').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
   await page.evaluate(()=>window.GBReaderPreferences.set({fontScale:1.25},{source:'grok-stage2-audit'}));
   await page.waitForFunction(()=>Math.abs(window.GBReaderPreferences.get().fontScale-1.25)<.001);
   const font=await page.evaluate(()=>{
    const p=document.querySelector('[data-reader-root] .article-body');
    const rail=document.querySelector('.hrail--grok'),toc=document.querySelector('.hrail-scroll');
    return {scale:window.GBReaderPreferences.get().fontScale,
      size:parseFloat(getComputedStyle(p).fontSize),
      horizontalOverflowPx:document.documentElement.scrollWidth-innerWidth,
      railHeight:rail.getBoundingClientRect().height,
      tocHeight:toc.clientHeight,
      controls:!!document.querySelector('.hrail-bottom')};
   });
   check(engine,'125 percent canonical maximum increases paragraph size',font.size>before*1.18,{before,font});
   check(engine,'125 percent canonical maximum keeps reader usable',font.horizontalOverflowPx<=2&&font.tocHeight>=80&&font.controls,font);
   await page.locator('#hmSettingsDone').click();
   await page.waitForFunction(()=>document.querySelector('#hmSettings')?.getAttribute('aria-hidden')==='true');
   await page.emulateMedia({media:'print'});
   const print=await page.evaluate(()=>{
    const rail=document.querySelector('.hrail--grok');
    const root=document.querySelector('[data-reader-root]');
    return {railDisplay:getComputedStyle(rail).display,bodyDisplay:getComputedStyle(root).display,
      articleVisible:!!document.querySelector('[data-reader-root] .article-body'),
      pageWidth:document.documentElement.scrollWidth,windowWidth:innerWidth};
   });
   check(engine,'A4 print hides desktop navigation',print.railDisplay==='none',print);
   check(engine,'print preserves actual article',print.articleVisible&&print.bodyDisplay!=='none',print);
   check(engine,'no uncaught errors',errors.length===0,errors);
   console.log('PASS',engine,JSON.stringify({themes:surfaces.map(s=>({theme:s.theme,background:s.railBg})),font,print}));
   await page.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
const target=path.resolve('reports/grok-stage2/theme-print-audit.json');
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify({sha:sourceSha,results},null,2));
console.log('GROK THEME/FONT/PRINT AUDIT: '+results.length+'/'+results.length+' PASS');
