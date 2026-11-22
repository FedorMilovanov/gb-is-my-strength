// Real keyboard tab-panel isolation; no Product source or DOM mutations.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json'));
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8483';
const output=process.env.OUTPUT_DIR||'/tmp/reader-panel-keyboard';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const results=[];
async function tabTo(p,s){for(let i=0;i<100;i++){if(await p.evaluate(s=>document.activeElement.matches(s),s))return;await p.keyboard.press('Tab');}throw Error('Unreachable '+s);}
async function open(p){await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(450);}
async function snapshot(p){return p.evaluate(()=>({focus:document.activeElement.id||document.activeElement.className,closed:document.querySelector('#partTocOverlay').getAttribute('aria-hidden'),tabs:[...document.querySelectorAll('[data-gbr-tab]')].map(e=>({id:e.id,selected:e.getAttribute('aria-selected'),tabindex:e.tabIndex})),panels:['gbs2PartToc','gbrMarginalia'].map(id=>{const e=document.getElementById(id);return {id,hidden:e.hidden,inert:e.inert};})}));}
try{for(const viewport of [{width:390,height:844},{width:568,height:320}])for(const colorScheme of ['light','dark']){
 const context=await browser.newContext({viewport,colorScheme,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage();
 const row={viewport,colorScheme,checks:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));
 const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await p.goto(base+'/articles/dzhon-gill-chast-2-uchenyi/');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(450);
 await open(p);await tabTo(p,'#gbrTocTab');await p.keyboard.press('End');await p.waitForTimeout(300);
 let s=await snapshot(p);check('End selects/focuses Analytics and isolates TOC',s.focus==='gbrMarginaliaTab'&&s.tabs[1].selected==='true'&&s.tabs[1].tabindex===0&&s.tabs[0].tabindex===-1&&s.panels[0].hidden&&s.panels[0].inert&&!s.panels[1].hidden&&!s.panels[1].inert,s);
 await tabTo(p,'#gbrMarginalia details > summary');await p.keyboard.press('Enter');
 const expanded=await p.evaluate(()=>document.activeElement.parentElement.open);check('Analytics details expands with Enter',expanded);
 await tabTo(p,'#partTocOverlay .toc-sheet__handle');await p.keyboard.press('Shift+Tab');
 const reverse=await p.evaluate(()=>({last:document.activeElement.matches('[data-gbat-continue] + button'),inside:!!document.activeElement.closest('#partTocOverlay')}));
 await p.keyboard.press('Tab');const forward=await p.evaluate(()=>document.activeElement.matches('#partTocOverlay .toc-sheet__handle'));
 check('Expanded Analytics reverse and forward trap wrap',reverse.last&&reverse.inside&&forward,reverse);
 await tabTo(p,'#gbrMarginaliaTab');
 // Walk an entire visible focus cycle, including dynamically generated details/actions.
 const trail=[];for(let i=0;i<140;i++){
  await p.keyboard.press('Tab');const state=await p.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,inDialog:!!document.activeElement.closest('#partTocOverlay'),inToc:!!document.activeElement.closest('#gbs2PartToc'),inResearch:!!document.activeElement.closest('#gbrMarginalia'),hiddenAncestor:!!document.activeElement.closest('[hidden],[inert]')}));trail.push(state);
  if(state.id==='gbrMarginaliaTab')break;
 }
 check('Dynamic Analytics Tab cycle stays in dialog and skips hidden TOC',trail.length<140&&trail.every(e=>e.inDialog&&!e.inToc&&!e.hiddenAncestor)&&trail.some(e=>e.inResearch),trail);
 await p.keyboard.press('Home');s=await snapshot(p);check('Home selects/focuses TOC and isolates Analytics',s.focus==='gbrTocTab'&&s.tabs[0].selected==='true'&&!s.panels[0].hidden&&!s.panels[0].inert&&s.panels[1].hidden&&s.panels[1].inert,s);
 await p.keyboard.press('ArrowRight');s=await snapshot(p);check('ArrowRight reopens Analytics with keyboard focus',s.focus==='gbrMarginaliaTab'&&s.tabs[1].selected==='true',s);
 await p.keyboard.press('Escape');await p.waitForTimeout(400);s=await snapshot(p);check('Analytics Escape restores opener',s.focus==='mobPartTocBtn'&&s.closed==='true',s);
 for(const [name,selector]of [['Close','#partTocOverlay .toc-sheet__handle'],['Continue','[data-gbat-continue]']]){
  await open(p);await tabTo(p,'#gbrTocTab, #gbrMarginaliaTab');await p.keyboard.press('End');await tabTo(p,selector);await p.keyboard.press('Enter');await p.waitForTimeout(700);s=await snapshot(p);check('Analytics '+name+' Enter restores opener',s.focus==='mobPartTocBtn'&&s.closed==='true',s);
 }
 check('No page JS errors',errors.length===0,errors);results.push(row);await context.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/panels.json',JSON.stringify(results,null,2));
const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
