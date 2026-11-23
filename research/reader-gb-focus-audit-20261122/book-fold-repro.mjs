// Nested book accordion state, actual Tab/Enter without navigation or geometry override.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8494',output=process.env.OUTPUT_DIR||'/tmp/book-fold';fs.mkdirSync(output,{recursive:true});
const route='/baptisty-rossii/dva-sezda-1884/';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const results=[];
async function tabTo(p,selector){for(let i=0;i<160;i++){if(await p.evaluate(s=>document.activeElement.matches(s),selector))return true;await p.keyboard.press('Tab');}return false;}
async function snap(p){return p.evaluate(()=>{
 const ov=document.getElementById('partTocOverlay'),part=ov.querySelector('.gbat-part.cur');
 const articles=[...part.querySelectorAll('.gbat-art')].map(art=>{let button=art.querySelector('.gbat-art-chev'),region=button&&document.getElementById(button.getAttribute('aria-controls'));return {href:art.querySelector('a.gbat-sat').getAttribute('href'),open:art.classList.contains('open'),expanded:button?.getAttribute('aria-expanded'),regionId:region?.id,inert:region?.inert};});
 return {path:location.pathname,chapter:part.querySelector('.gbat-t').textContent.trim(),chapterOpen:part.classList.contains('open'),chapterExpanded:part.querySelector('.gbat-hd').getAttribute('aria-expanded'),chapterInert:part.querySelector('.gbat-subs').inert,pageMarkers:[...ov.querySelectorAll('[aria-current="page"]')].map(e=>e.getAttribute('href')),focus:document.activeElement.id||document.activeElement.className,articles};
});}
try{for(const viewport of [{width:390,height:844},{width:568,height:320}])for(const colorScheme of ['light','dark']){
 const ctx=await browser.newContext({viewport,colorScheme,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'}),p=await ctx.newPage(),row={viewport,colorScheme,checks:[],states:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await p.goto(base+route);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(450);
 let s=await snap(p);row.states.push(s);check('Initial page identity distinct from chapter',s.chapter==='Рождение братства'&&s.pageMarkers.length===1&&s.pageMarkers[0]===route,s);
 const current=s.articles.find(a=>a.href===route),other=s.articles.find(a=>a.href!==route&&a.regionId);if(!current||!other)throw Error('Fixture has no current+other article');
 check('Current article alone expanded initially',s.articles.filter(a=>a.open).length===1&&current.open&&current.expanded==='true'&&!current.inert,s.articles);
 const toggleSelector='.gbat-art-chev[aria-controls='+JSON.stringify(other.regionId)+']';check('Tab reaches another article chevron',await tabTo(p,toggleSelector));await p.keyboard.press('Enter');await p.waitForTimeout(500);
 s=await snap(p);row.states.push(s);check('Opening another article closes previous via inert and aria',s.articles.filter(a=>a.open).length===1&&s.articles.every(a=>a.open?(a.regionId===other.regionId&&a.expanded==='true'&&!a.inert):(a.expanded==='false'&&a.inert)),s.articles);
 check('Expansion does not navigate or steal current-page identity',s.path===route&&s.pageMarkers.length===1&&s.pageMarkers[0]===route,s);
 // Full Tab cycle from expanded sibling chevron; focusable rows must never enter folded regions.
 const trail=[];for(let i=0;i<160;i++){await p.keyboard.press('Tab');const step=await p.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,href:document.activeElement.getAttribute('href'),inside:!!document.activeElement.closest('#partTocOverlay'),inertAncestor:!!document.activeElement.closest('[inert]'),hiddenAncestor:!!document.activeElement.closest('[hidden]'),region:document.activeElement.closest('.gbat-artsecs')?.id}));trail.push(step);if(await p.evaluate(s=>document.activeElement.matches(s),toggleSelector))break;}
 check('Expanded sibling Tab cycle excludes all folded regions',trail.length<160&&trail.every(t=>t.inside&&!t.inertAncestor&&!t.hiddenAncestor)&&trail.some(t=>t.region===other.regionId),trail);
 await p.keyboard.press('Enter');await p.waitForTimeout(500);s=await snap(p);row.states.push(s);check('Collapsing sibling leaves no article region focusable',s.articles.every(a=>!a.open&&a.expanded==='false'&&a.inert),s.articles);
 check('Tab reaches current chapter header',await tabTo(p,'#partTocOverlay .gbat-part.cur > .gbat-hd'));await p.keyboard.press('Enter');await p.waitForTimeout(500);s=await snap(p);row.states.push(s);check('Chapter collapse updates aria and inert without page change',!s.chapterOpen&&s.chapterExpanded==='false'&&s.chapterInert&&s.path===route,s);
 await p.keyboard.press('Tab');const next=await p.evaluate(()=>({inside:!!document.activeElement.closest('#partTocOverlay'),folded:!!document.activeElement.closest('.gbat-part.cur .gbat-subs')}));check('Tab skips collapsed entire chapter',next.inside&&!next.folded,next);
 await p.keyboard.press('Escape');await p.waitForTimeout(450);check('Escape returns native opener after nested folds',await p.evaluate(()=>document.activeElement.id==='mobPartTocBtn'&&document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='true'));
 check('Zero page JS errors',errors.length===0,errors);results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/folds.json',JSON.stringify(results,null,2));const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
