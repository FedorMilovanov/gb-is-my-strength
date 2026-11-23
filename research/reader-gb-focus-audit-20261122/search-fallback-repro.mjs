// Real Pagefind, repeated search with honest article fallback; no force-click.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8500',output=process.env.OUTPUT_DIR||'/tmp/search-fallback';fs.mkdirSync(output,{recursive:true});
const route='/articles/dzhon-gill-chast-2-uchenyi/',results=[];const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const ready=async(p,width)=>{await p.waitForTimeout(800);if(width>1120)await p.waitForFunction(()=>document.body.classList.contains('np-w57-ready'));};
try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block'}),p=await ctx.newPage(),errors=[],row={width,checks:[],steps:[]};const check=(name,pass,data)=>row.checks.push({name,pass,data});p.on('pageerror',e=>errors.push(e.message));
 await ctx.addInitScript(()=>{for(const name of ['gb:search-source-focused','gb:search-source-fallback'])document.addEventListener(name,e=>{const key='audit-search-events',all=JSON.parse(sessionStorage.getItem(key)||'[]');all.push({name,detail:e.detail});sessionStorage.setItem(key,JSON.stringify(all));});});
 await p.goto(base+route+(width>1120?'?paper=space&panel=open':''));await ready(p,width);
 for(const [i,query] of ['беспрецедентным','беспрецедентный','беспрецедентным'].entries()){
  if(i){const center=await p.evaluate(()=>{const r=document.querySelector('article.article-body').getBoundingClientRect();return r.left+r.width/2;});await p.mouse.move(center,400);await p.mouse.wheel(0,-10000);await p.waitForTimeout(700);}
  const trigger=p.locator(width<1121?'.mobile-top-bar .reader-mobile-top-search':'#gbSearchBtn:visible,[data-fc-action="search"]:visible,.gb-nav-search-icon:visible').first();
  await trigger.click();await p.locator('.cp-backdrop.is-open .cp-input').fill(query);
  await p.waitForFunction(()=>!!window.__pagefindReady__&&document.querySelectorAll('#cp-listbox .cp-item').length>0,null,{timeout:20000});
  const labels=await p.locator('#cp-listbox .cp-item').allTextContents(),index=labels.findIndex(t=>t.includes('Часть II'));if(index<0)throw Error('No Gill II result');
  await p.locator('.cp-input').focus();for(let k=0;k<=labels.length;k++){if(await p.locator('.cp-input').getAttribute('aria-activedescendant')==='cp-option-'+index)break;await p.keyboard.press('ArrowDown');}
  await p.keyboard.press('Enter');await ready(p,width);
  const after=await p.evaluate(q=>{const a=document.querySelector('article.article-body'),f=document.activeElement,r=f.getBoundingClientRect();return {url:location.href,focus:f.tagName,focusText:f.textContent.slice(0,220),top:r.top,bottom:r.bottom,selection:getSelection()?.toString(),pending:sessionStorage.getItem('gb-reader-pagefind-hit-v1'),w57:document.body.classList.contains('np-w57-ready'),literal:a.textContent.toLowerCase().includes(q),events:JSON.parse(sessionStorage.getItem('audit-search-events')||'[]'),scrollY,study:document.querySelectorAll('#gbAnalyticsStudy').length};},query);
  row.steps.push({query,labels,after});const exact=i!==1;check('Search '+i+' has expected focus/selection',exact?after.focus==='P'&&after.selection===query&&after.top>=0&&after.top<900:after.focus==='H1'&&after.selection===''&&!after.literal&&after.top>=0&&after.top<900,after);
  check('Search '+i+' consumes one-shot and preserves surface',after.pending===null&&after.w57===(width>1120)&&after.study===1);
  const event=after.events.at(-1);check('Search '+i+' emits truthful event',exact?event?.name==='gb:search-source-focused':event?.name==='gb:search-source-fallback'&&event.detail.reason==='literal-occurrence-not-found'&&event.detail.fallbackFocused===true,event);
  await p.screenshot({path:output+'/'+width+'-'+i+'-landing.png'});
 }
 // Reload after completed fallback/exact cycle must not replay an old pending source.
 const priorEvents=row.steps.at(-1).after.events;await p.reload();await ready(p,width);const replay=await p.evaluate(()=>({pending:sessionStorage.getItem('gb-reader-pagefind-hit-v1'),events:JSON.parse(sessionStorage.getItem('audit-search-events')||'[]')}));check('Reload does not replay consumed source',replay.pending===null&&JSON.stringify(priorEvents)===JSON.stringify(replay.events),replay);
 check('No JS errors',errors.length===0,errors);results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/fallback.json',JSON.stringify(results,null,2));const all=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:all.filter(c=>c.pass).length,total:all.length,results},null,2));process.exitCode=all.every(c=>c.pass)?0:1;
