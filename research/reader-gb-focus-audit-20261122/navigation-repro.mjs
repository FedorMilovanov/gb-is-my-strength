// Hash/history and page-navigation boundary for the separately built combined candidate.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json'));
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8483';
const output=process.env.OUTPUT_DIR||'/tmp/reader-gb-navigation';
const route='/articles/dzhon-gill-chast-2-uchenyi/';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const results=[];
async function settle(page){
 await page.waitForTimeout(350);
 // Driver-side clock also works with javaScriptEnabled:false; page timers do not.
 let last=null,n=0;
 for(let i=0;i<60;i++){
  await page.waitForTimeout(100);const y=await page.evaluate(()=>scrollY);
  n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;
  if(n>=6)return true;
 }
 return false;
}
async function open(page){await page.locator('#mobPartTocBtn').focus();await page.keyboard.press('Enter');await page.waitForTimeout(450);}
async function tabTo(page,selector){for(let i=0;i<80;i++){if(await page.evaluate(s=>document.activeElement.matches(s),selector))return;await page.keyboard.press('Tab');}throw Error('Not reached: '+selector);}
async function read(page,id){return page.evaluate(id=>({hash:location.hash,path:location.pathname,section:window.GBReaderState?.getSnapshot().sectionId,
 focus:document.activeElement.id,top:document.getElementById(id)?.getBoundingClientRect().top,
 height:innerHeight,hidden:document.querySelector('#partTocOverlay')?.getAttribute('aria-hidden')}),id);}
try{
for(const viewport of [{width:390,height:844},{width:568,height:320}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 console.log('PROFILE',viewport);
 const page=await context.newPage(),row={viewport,checks:[],observations:[]},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await page.goto(base+route);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
 for(const id of ['sec-canticles','sec-ordinances']){
  await open(page);await tabTo(page,`#partTocOverlay a[href="#${id}"]`);await page.keyboard.press('Enter');const stable=await settle(page);const state=await read(page,id);
  check(`Native anchor + exact focus ${id}`,stable&&state.hash==='#'+id&&state.focus===id&&state.section===id&&state.top>=0&&state.top<state.height,state);
  await open(page);
  const marker=await page.evaluate(()=>[...document.querySelectorAll('#partTocOverlay a[aria-current="location"]')].map(e=>e.getAttribute('href')));
  check(`Marker follows actual destination on reopen ${id}`,marker.length===1&&marker[0]==='#'+id,marker);
  await page.keyboard.press('Escape');await page.waitForTimeout(350);
 }
 await page.goBack();const backStable=await settle(page);const back=await read(page,'sec-canticles');
 check('Native Back preserves previous hash and visible section',backStable&&back.hash==='#sec-canticles'&&back.section==='sec-canticles'&&back.top>=0&&back.top<back.height,back);
 await page.reload();await page.evaluate(()=>document.fonts.ready);const reloadStable=await settle(page);const reloaded=await read(page,'sec-canticles');
 check('Hash reload preserves destination',reloadStable&&reloaded.hash==='#sec-canticles'&&reloaded.section==='sec-canticles'&&reloaded.top>=0&&reloaded.top<reloaded.height,reloaded);
 await open(page);await tabTo(page,'#backToSeries');await page.keyboard.press('Enter');await page.waitForTimeout(400);
 await tabTo(page,'#seriesTocOverlay a.toc-item:not(.is-current)[href]');
 const expected=await page.evaluate(()=>document.activeElement.href);
 await page.keyboard.press('Enter');await page.waitForURL(expected);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(450);
 const cross=await page.evaluate(()=>({url:location.href,hidden:document.querySelector('#partTocOverlay')?.getAttribute('aria-hidden'),current:document.querySelector('#partTocOverlay .gbat-part.cur .gbat-t')?.textContent.trim()}));
 check('Other series page remains native full-route navigation',cross.url===expected&&cross.hidden==='true',cross);
 // New fresh source page: modified Enter must retain browser tab semantics.
 const modified=await context.newPage();await modified.goto(base+route);await modified.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
 await open(modified);await tabTo(modified,'#partTocOverlay a[href="#sec-canticles"]');
 let popup=null,popupError=null;
 try{[popup]=await Promise.all([context.waitForEvent('page',{timeout:5000}),modified.keyboard.press('Control+Enter')]);await popup.waitForLoadState('domcontentloaded');await settle(popup);}catch(e){popupError=e.message;}
 const source=await modified.evaluate(()=>({hash:location.hash,hidden:document.querySelector('#partTocOverlay').getAttribute('aria-hidden')}));
 check('Control+Enter opens browser tab without dismissing source dialog',!!popup&&popup.url().endsWith('#sec-canticles')&&source.hash===''&&source.hidden==='false',{popup:popup?.url(),source,popupError});
 check('No original-page JS errors',errors.length===0,errors);
 await context.close();
 const nojs=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block',javaScriptEnabled:false});
 const plain=await nojs.newPage();await plain.goto(base+route+'#sec-canticles');await plain.evaluate(()=>document.fonts.ready);await settle(plain);
 const fallback=await plain.evaluate(()=>({hash:location.hash,top:document.getElementById('sec-canticles').getBoundingClientRect().top,height:innerHeight,reader:typeof window.GBReaderState}));
 check('No-JS direct authored hash remains usable (not TOC opener)',fallback.hash==='#sec-canticles'&&fallback.top>=0&&fallback.top<fallback.height&&fallback.reader==='undefined',fallback);
 await nojs.close();results.push(row);
 fs.writeFileSync(`${output}/partial.json`,JSON.stringify(results,null,2));
}
}finally{await browser.close();}
fs.writeFileSync(`${output}/navigation.json`,JSON.stringify(results,null,2));
const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));
process.exitCode=checks.every(c=>c.pass)?0:1;
