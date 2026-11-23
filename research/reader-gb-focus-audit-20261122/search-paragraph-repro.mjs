// Compare current per-article Learning search with actual Pagefind-backed shared search.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8496',output=process.env.OUTPUT_DIR||'/tmp/search-paragraph';fs.mkdirSync(output,{recursive:true});
const desktop=process.env.DESKTOP==='1';
const route='/articles/dzhon-gill-chast-2-uchenyi/',query='беспрецедентным',results=[];
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
async function settle(p){await p.waitForTimeout(400);let n=0,last=null;for(let i=0;i<60;i++){await p.waitForTimeout(100);const y=await p.evaluate(()=>scrollY);n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;if(n>=6)return true;}return false;}
try{for(const surface of ['learning','shared']){
 const ctx=await browser.newContext({viewport:desktop?{width:1440,height:900}:{width:390,height:844},isMobile:!desktop,hasTouch:!desktop,reducedMotion:'reduce',serviceWorkers:'block'}),p=await ctx.newPage(),errors=[],responses=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/pagefind/'))responses.push({url:r.url(),status:r.status()});});
 await p.goto(base+route+(desktop?'?reader-pilot=1&paper=space':''));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(650);
 const surfaceState=await p.evaluate(()=>({w57:document.body.classList.contains('np-w57-ready'),annotations:!!window.__NP_W57_ANNOTATIONS__?.ready}));
 if(desktop&&!surfaceState.w57)throw Error('DESKTOP requires genuine W57 preview.py surface');
 const original=await p.evaluate(q=>{const article=document.querySelector('article.article-body')||document.querySelector('article');return {paragraphs:[...article.querySelectorAll('p')].filter(p=>p.textContent.toLowerCase().includes(q)).map(p=>({id:p.id,text:p.textContent.trim()})),headings:[...article.querySelectorAll('h1,h2,h3')].filter(p=>p.textContent.toLowerCase().includes(q)).map(p=>p.textContent.trim())};},query);
 if(desktop){const native=p.locator('#railSettingsBtn');await (await native.isVisible()?native:p.locator('#npUOutline .np-u-type-open')).click();await p.locator('#npUFontPanel').waitFor({state:'visible'});}
 else {await p.locator('#mobSettingsBtn').click();await p.locator('#gillSettingsOverlay[aria-hidden="false"]').waitFor({state:'visible'});}
 await p.locator('#mobLearningBtn').click();await p.locator('#gillLearningOverlay[aria-hidden="false"]').waitFor({state:'visible'});await p.locator('#tabSearch').click();
 const row={surface,desktop,surfaceState,query,original};
 if(surface==='learning'){
  await p.locator('#learningSearchInput').fill(query);await p.locator('.gill-search-result').first().waitFor({state:'visible'});
  row.results=await p.locator('.gill-search-result').allTextContents();await p.screenshot({path:output+'/learning-results.png'});
  await p.locator('.gill-search-result').first().focus();await p.keyboard.press('Enter');await settle(p);
 }else{
  await p.locator('#globalSearchBtn').click();await p.locator('.cp-backdrop.is-open .cp-input').waitFor({state:'visible'});await p.locator('.cp-input').fill(query);
  await p.waitForTimeout(2500);row.results=await p.locator('#cp-listbox').innerText();row.resultDom=await p.locator('#cp-listbox').innerHTML();row.pagefind=await p.evaluate(()=>!!window.__pagefind__);
  await p.screenshot({path:output+'/shared-results.png'});await p.locator('.cp-input').focus();await p.keyboard.press('Enter');await settle(p);
 }
 row.after=await p.evaluate(q=>{const article=document.querySelector('article.article-body')||document.querySelector('article');return {path:location.pathname,hash:location.hash,focus:document.activeElement.id,learningHidden:document.getElementById('gillLearningOverlay')?.getAttribute('aria-hidden'),sharedOpen:!!document.querySelector('.cp-backdrop.is-open'),targets:[...article.querySelectorAll('p')].filter(p=>p.textContent.toLowerCase().includes(q)).map(p=>{let r=p.getBoundingClientRect();return {id:p.id,top:r.top,bottom:r.bottom,marked:p.classList.contains('is-search-target'),focused:p===document.activeElement};}),scrollY};},query);
 const y=row.after.scrollY;
 const point=await p.evaluate(()=>{const a=document.querySelector('article.article-body')||document.querySelector('article'),r=a.getBoundingClientRect();return {x:Math.min(innerWidth-10,Math.max(10,r.left+r.width/2)),y:Math.min(innerHeight-40,500)};});
 await p.mouse.move(point.x,point.y);await p.mouse.wheel(0,400);await p.waitForTimeout(650);row.wheel={before:y,after:await p.evaluate(()=>scrollY)};row.errors=errors;row.pagefindResponses=responses;results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/search.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
// Diagnostic completion, not blanket acceptance of either search owner.
