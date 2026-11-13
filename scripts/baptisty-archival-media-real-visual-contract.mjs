#!/usr/bin/env node
/**
 * Historical evidence preservation, not a photo-style approval.
 * Checks real images/fonts, document proportions, caption and source
 * on every Baptist-series chapter across engines, themes and widths.
 * Never crop a facsimile to make this pass.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const DIST=join(ROOT,'dist'),OUT=join(ROOT,'reports','baptisty-archival-media');
const sha=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const paths=['noch-na-kure','yuzhnaya-shtunda','dva-sezda-1884','peterburgskaya-liniya',
 'goneniya-i-sovest','sovetskaya-noch','vsehib-1944','iniciativnaya-gruppa','podpolnaya-pechat','spravochnik'];
const widths=[390,1440],themes=['light','dark','sepia'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
await mkdir(OUT,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const route=decodeURIComponent(new URL(req.url||'/','http://127.0.0.1').pathname);
  let file=resolve(DIST,'.'+route);
  if(file!==DIST&&!file.startsWith(DIST+sep))throw Error('escape');
  if((await stat(file)).isDirectory())file=join(file,'index.html');
  const body=await readFile(file);
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});
  res.end(body);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,results=[];
let browser=null;
try{
 for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
  browser=await driver.launch({headless:true});
  for(const slug of paths){
   const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
   try{
    const response=await page.goto(base+'/baptisty-rossii/'+slug+'/',{waitUntil:'domcontentloaded',timeout:30000});
    await page.evaluate(()=>document.querySelectorAll('img[loading=lazy]').forEach(img=>img.loading='eager'));
    await Promise.race([page.evaluate(()=>document.fonts?.ready),page.waitForTimeout(4000)]);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-baptist-master-evidence] img')].every(img=>img.complete),null,{timeout:5000}).catch(()=>{});
    for(const width of widths){
     await page.setViewportSize({width,height:width===390?844:900});
     for(const theme of themes){
      await page.evaluate(t=>{
       if(window.GBReaderPreferences?.setTheme)window.GBReaderPreferences.setTheme(t,{source:'baptist-archival-qa'});
       else{
        document.documentElement.setAttribute('data-reader-theme',t);
        document.documentElement.classList.toggle('dark',t==='dark');
       }
      },theme);
      // Firefox/WebKit may load a new font face after a viewport breakpoint
      // changes. Assess image/typography only once that layout settles.
      // A style/theme break can schedule new font requests *after* the
      // immediate FontFaceSet.ready promise. Let layout paint first.
      await page.evaluate(async()=>{
       await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
       await document.fonts?.ready;
      });
      await page.waitForFunction(()=>document.fonts?.status==='loaded',null,{timeout:4500}).catch(()=>{});
      const data=await page.evaluate(()=>{
       const vw=document.documentElement.clientWidth;
       return{
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-vw,
        fontsReady:document.fonts?.status==='loaded',
        figures:[...document.querySelectorAll('[data-baptist-master-evidence]')].map(fig=>{
         const img=fig.querySelector('img'),cap=fig.querySelector('figcaption'),link=fig.querySelector('a[href]');
         const r=img?.getBoundingClientRect(),fr=fig.getBoundingClientRect();
         const naturalRatio=(img?.naturalWidth&&img?.naturalHeight)?img.naturalWidth/img.naturalHeight:0;
         const renderedRatio=r?.height?r.width/r.height:0;
         return{
          id:fig.dataset.baptistMasterEvidence,
          loaded:!!img?.complete&&!!img?.naturalWidth,
          naturalWidth:img?.naturalWidth||0,naturalHeight:img?.naturalHeight||0,
          aspectError:Math.abs(renderedRatio-naturalRatio),
          imageOverflow:(r?.right||0)>vw+2||(r?.left||0)<-2,
          clippedToFigure:r?.width>fr.width+2,
          alt:img?.getAttribute('alt')||'',
          caption:cap?.innerText.trim()||'',
          sourceUrl:link?.href||'',
          objectFit:img?getComputedStyle(img).objectFit:null
         };
        })
       };
      });
      results.push({sha,engine,slug,width,theme,status:response.status(),...data});
      if(engine==='chromium'&&width===390&&['light','dark'].includes(theme)&&data.figures.length){
       await page.locator('[data-baptist-master-evidence]').first().scrollIntoViewIfNeeded();
       const name=[slug,theme,width,sha.slice(0,12)].join('--')+'.png';
       await page.locator('[data-baptist-master-evidence]').first().screenshot({path:join(OUT,name),timeout:14000}).catch(()=>{});
      }
     }
    }
   }catch(e){results.push({sha,engine,slug,error:String(e)})}
   await page.close();
  }
  await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(done=>server.close(done));}
await writeFile(join(OUT,'manifest.json'),JSON.stringify({sha,results},null,2));
const bad=results.filter(x=>x.error||x.status!==200||x.overflow>2||!x.fontsReady||
 x.figures?.some(f=>!f.loaded||f.aspectError>.04||f.imageOverflow||f.clippedToFigure||
 f.alt.length<15||f.caption.length<15||!f.sourceUrl.startsWith('https://')));
const summary={sha,cases:results.length,figureChecks:results.reduce((a,x)=>a+(x.figures?.length||0),0),
 issues:bad.length,failures:bad.slice(0,25)};
await writeFile(join(OUT,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(bad.length)process.exitCode=1;
