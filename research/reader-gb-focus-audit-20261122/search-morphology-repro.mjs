// Current W123 Pagefind vs literal source-handoff matching; no stale Learning selectors.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8498',output=process.env.OUTPUT_DIR||'/tmp/search-morphology';fs.mkdirSync(output,{recursive:true});
const route='/articles/dzhon-gill-chast-2-uchenyi/',results=[];
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{for(const width of [390,1440])for(const query of ['беспрецедентным','беспрецедентный']){
 const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block'}),p=await ctx.newPage(),errors=[],responses=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/pagefind/'))responses.push({url:r.url(),status:r.status()});});
 await p.goto(base+route+(width>1120?'?reader-pilot=1&paper=space&panel=open':''));await p.evaluate(()=>document.fonts.ready);if(width>1120)await p.waitForFunction(()=>document.body.classList.contains('np-w57-ready'));
 const initial=await p.evaluate(()=>({w57:document.body.classList.contains('np-w57-ready'),study:document.querySelectorAll('#gbAnalyticsStudy').length,retiredLearning:!!document.getElementById('gillLearningOverlay')}));
 if(width<1121){await p.locator('#mobPartTocBtn').click();await p.locator('#gbrMarginaliaTab').click();await p.getByRole('button',{name:'Поиск по сайту',exact:true}).click();}
 else await p.locator('#gbSearchBtn:visible,[data-fc-action="search"]:visible,.gb-nav-search-icon:visible').first().click();
 await p.locator('.cp-backdrop.is-open .cp-input').fill(query);
 await p.waitForFunction(()=>!!window.__pagefindReady__&&document.querySelectorAll('#cp-listbox .cp-item').length>0,null,{timeout:15000});
 const labels=await p.locator('#cp-listbox .cp-item').allTextContents(),index=labels.findIndex(t=>t.includes('Часть II'));
 if(index<0)throw Error('GillII result absent for '+query);
 await p.locator('.cp-input').focus();for(let i=0;i<=labels.length;i++){if(await p.locator('.cp-input').getAttribute('aria-activedescendant')==='cp-option-'+index)break;await p.keyboard.press('ArrowDown');}
 await p.screenshot({path:output+'/'+width+'-'+(query.endsWith('ым')?'exact':'lemma')+'-results.png'});
 await p.keyboard.press('Enter');await p.waitForTimeout(1700);if(width>1120)await p.waitForFunction(()=>document.body.classList.contains('np-w57-ready'));
 const after=await p.evaluate(q=>{const a=document.querySelector('article.article-body')||document.querySelector('article'),needle='беспрецедентным',matches=[...a.querySelectorAll('p')].filter(p=>p.textContent.toLowerCase().includes(needle));return {href:location.href,w57:document.body.classList.contains('np-w57-ready'),selection:getSelection()?.toString(),focus:document.activeElement.tagName,focusText:document.activeElement.textContent.slice(0,250),pending:sessionStorage.getItem('gb-reader-pagefind-hit-v1'),study:document.querySelectorAll('#gbAnalyticsStudy').length,bodyLiteral: a.textContent.toLowerCase().includes(q),targets:matches.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,focus:e===document.activeElement};}),scrollY};},query);
 await p.screenshot({path:output+'/'+width+'-'+(query.endsWith('ым')?'exact':'lemma')+'-after.png'});
 results.push({width,query,initial,labels,after,errors,pagefindResponses:responses});await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/morphology.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
// Diagnostic completion, not acceptance of morphology/fallback semantics.
