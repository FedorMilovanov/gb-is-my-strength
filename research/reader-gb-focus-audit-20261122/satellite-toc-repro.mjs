// Diagnostic: satellite article's own TOC vs parent series navigation.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8490',output=process.env.OUTPUT_DIR||'/tmp/satellite-toc';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const results=[];
try{for(const [label,slug] of [['corpus','kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom'],['audit','mozhno-li-doveryat-1-enohu-kanonicheskiy-audit']]){
 const route='/hard-texts/'+slug+'/',context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+route);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(450);
 const state=await p.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const ov=document.querySelector('#partTocOverlay'),cur=ov.querySelector('.gbat-part.cur'),first=cur.querySelector('a[href]'),list=ov.querySelector('#gbs2PartToc'),article=document.querySelector('article.article-body')||document.querySelector('article');
  return {path:location.pathname,title:document.title,heading:document.querySelector('h1')?.textContent.trim(),sheetLabel:ov.querySelector('[role="dialog"]').getAttribute('aria-label'),currentLabel:cur.querySelector('.gbat-t').textContent.trim(),currentText:cur.innerText,firstLabel:first.textContent.trim(),firstHref:first.getAttribute('href'),localLinks:ov.querySelectorAll('a[href^="#"]').length,ownHeadings:[...article.querySelectorAll('h2[id],h3[id]')].map(e=>({id:e.id,text:e.textContent.trim()})),listRect:rect(list),currentRect:rect(cur.querySelector('.gbat-hd')),firstRect:rect(first),native:!document.body.classList.contains('np-w57-ready')};
 });
 await p.screenshot({path:output+'/'+label+'-toc.png'});
 let reached=false;for(let i=0;i<100;i++){if(await p.evaluate(h=>document.activeElement.getAttribute('href')===h,state.firstHref)){reached=true;break;}await p.keyboard.press('Tab');}
 if(reached){await p.keyboard.press('Enter');await p.waitForURL(url=>url.pathname!==route);await p.waitForTimeout(500);}
 const after=await p.evaluate(()=>({path:location.pathname,hash:decodeURIComponent(location.hash),title:document.title}));
 results.push({label,route,state,keyboardReachedFirst:reached,after,errors});await context.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/satellites.json',JSON.stringify(results,null,2));
// Diagnostic exit0 means the reproduction completed, NOT product acceptance.
console.log(JSON.stringify(results,null,2));
