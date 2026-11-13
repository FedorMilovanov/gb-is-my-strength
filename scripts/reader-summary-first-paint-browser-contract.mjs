// Site-wide summary first-paint contract: no flash on delayed JS, fail-open without JS.
import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const ROUTES=[
 '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
 '/nagornaya/chast-1/'
];
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
 const file=path.resolve(DIST,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 const rel=path.relative(DIST,file);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end();return;
 }
 const ext=path.extname(file),mime={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};
 res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const checks=[];
// The native disclosure changes the heading from "Коротко" to
// "Краткое содержание" and moves the list into .gb-summary-motion.
// Observe the SAME card before and after hydration; a direct-child-only
// selector would falsely report that the genuine card disappeared.
const snapshot=()=>{
 const card=Array.from(document.querySelectorAll('.summary-card')).find(el=>{
   const title=el.querySelector(':scope > .summary-card__head')?.textContent?.trim().toLocaleLowerCase('ru');
   return title==='коротко'||title==='краткое содержание';
 });
 const list=card?.querySelector('.summary-card__body');
 const panel=card?.querySelector('.gb-summary-motion');
 const toggle=card?.querySelector('.gb-summary-toggle');
 const style=list?getComputedStyle(list):null;
 return {exists:!!card,owner:card?.dataset.gbSummaryOwner||null,
   pending:card?.dataset.gbSummaryPending||null,display:style?.display||null,
   height:(panel||list)?.getBoundingClientRect().height||0,
   open:card?.dataset.gbSummaryOpen||null,
   collapsedInert:panel?panel.inert:null,
   ariaExpanded:toggle?.getAttribute('aria-expanded')||null,
   structure:panel?'hydrated':'original'};
};
const check=(engine,route,mode,pass,details)=>{
 checks.push({engine,route,mode,pass:Boolean(pass),details});
};
for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
 const browser=await driver.launch({headless:true});
 for(const route of ROUTES){
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await page.route('**/js/reader-preferences.js*',async r=>{
    await new Promise(resolve=>setTimeout(resolve,1800));await r.continue();
  });
  try {
   await page.goto(origin+route,{waitUntil:'commit'});
   // Linux WebKit can return from "commit" before the parser has emitted the
   // summary card. Observe the pre-hydration DOM as soon as the real card
   // exists rather than sampling an unfinished document at 250 ms.
   await page.waitForFunction(() => Array.from(document.querySelectorAll('.summary-card')).some(el=>{
     const title=el.querySelector(':scope > .summary-card__head')
       ?.textContent?.trim().toLocaleLowerCase('ru');
     return title==='коротко'||title==='краткое содержание';
   }),null,{timeout:1200});
   const before=await page.evaluate(snapshot);
   check(engine,route,'delayed runtime: original list never flashes',before.exists&&before.owner===null&&before.pending==='1'&&before.display==='none'&&before.height===0,before);
   await page.waitForFunction(() => document.querySelector('.summary-card[data-gb-summary-owner="1"] .gb-summary-motion') !== null,
     null,{timeout:3000});
   const after=await page.evaluate(snapshot);
   check(engine,route,'runtime assumes owner, closes, removes temporary guard',after.owner==='1'&&after.pending===null&&after.open==='false'&&after.height<=2&&after.collapsedInert===true&&after.ariaExpanded==='false'&&after.structure==='hydrated',after);
  }catch(e){check(engine,route,'delayed runtime exception',false,String(e));}
  await page.close();
  const disabled=await browser.newPage({viewport:{width:1440,height:900},javaScriptEnabled:false,serviceWorkers:'block'});
  try{
   await disabled.goto(origin+route,{waitUntil:'domcontentloaded'});
   const state=await disabled.evaluate(snapshot);
   check(engine,route,'no JavaScript shows full summary',state.exists&&state.pending===null&&state.height>30,state);
  }catch(e){check(engine,route,'no-JS exception',false,String(e));}
  await disabled.close();
  const broken=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  try{
   await broken.route('**/js/reader-preferences.js*',r=>r.abort('failed'));
   await broken.goto(origin+route,{waitUntil:'domcontentloaded'});
   await broken.waitForTimeout(100);
   const state=await broken.evaluate(snapshot);
   check(engine,route,'deferred runtime failed: content remains visible',
     state.exists&&state.pending===null&&state.height>30,state);
  }catch(e){check(engine,route,'failed runtime exception',false,String(e));}
  await broken.close();
 }
 await browser.close();
}
await new Promise(resolve=>server.close(resolve));
const out=path.join(ROOT,'reports','reader-summary-first-paint');
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));
console.log('SITEWIDE SUMMARY FIRST PAINT',checks.filter(x=>x.pass).length+'/'+checks.length,
 JSON.stringify(checks.filter(x=>!x.pass)));
if(checks.some(x=>!x.pass))process.exitCode=1;
