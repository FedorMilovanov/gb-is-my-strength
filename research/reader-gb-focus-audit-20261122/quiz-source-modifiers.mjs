// Existing Learning is retiring: preserve native source-link behavior in unified Analytics.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8496',output=process.env.OUTPUT_DIR||'/tmp/quiz-source-modifiers';fs.mkdirSync(output,{recursive:true});
const route='/articles/dzhon-gill-istoricheskiy-kontekst/';const results=[];
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
async function settle(p){await p.waitForTimeout(400);let n=0,last=null;for(let i=0;i<60;i++){await p.waitForTimeout(100);const y=await p.evaluate(()=>scrollY);n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;if(n>=6)return true;}return false;}
try{for(const mode of ['Enter','Control+Enter','Control+click','middle']){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark',reducedMotion:'no-preference',serviceWorkers:'block'}),p=await ctx.newPage(),row={mode,checks:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await p.goto(base+route);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(350);
 await p.locator('#mobSettingsBtn').click();await p.locator('#gillSettingsOverlay[aria-hidden="false"]').waitFor({state:'visible'});
 await p.locator('#mobLearningBtn').click();await p.locator('#gillLearningOverlay[aria-hidden="false"]').waitFor({state:'visible'});
 await p.locator('#tabQuiz').click();await p.locator('.quiz-conf__btn').first().click();await p.locator('.quiz-option').first().click();await p.locator('#glsQuizSource').waitFor({state:'visible'});
 row.source=await p.locator('#glsQuizSource').evaluate(e=>({href:e.href,raw:e.getAttribute('href'),question:document.getElementById('glsQuizQuestion').textContent,hash:location.hash}));
 check('Natural shuffled question source is current document',new URL(row.source.href).pathname===route,row.source);
 let reached=false;for(let i=0;i<90;i++){if(await p.evaluate(()=>document.activeElement.id==='glsQuizSource')){reached=true;break;}await p.keyboard.press('Tab');}check('Source reached by real Tab after answer',reached);
 let popup=null,popupError=null;const listener=next=>{popup=next;};ctx.on('page',listener);
 if(mode==='middle')await p.locator('#glsQuizSource').click({button:'middle'});
 else if(mode==='Control+click')await p.locator('#glsQuizSource').click({modifiers:['Control']});
 else await p.keyboard.press(mode);
 await settle(p);if(mode!=='Enter'){for(let i=0;i<30&&!popup;i++)await p.waitForTimeout(100);}
 if(popup){try{await popup.waitForLoadState('domcontentloaded');await settle(popup);}catch(e){popupError=e.message;}}
 row.after=await p.evaluate(href=>{const id=decodeURIComponent(new URL(href).hash.slice(1)),e=document.getElementById(id),r=e?.getBoundingClientRect();return {hash:location.hash,focus:document.activeElement.id,hidden:document.getElementById('gillLearningOverlay').getAttribute('aria-hidden'),top:r?.top,height:innerHeight,overflow:getComputedStyle(document.body).overflow};},row.source.href);
 row.popup=popup?{url:popup.url(),error:popupError}:null;
 if(mode==='Enter'){
  check('Plain Enter closes sheet, keeps native hash and exact source focus',row.after.hidden==='true'&&row.after.hash===new URL(row.source.href).hash&&row.after.focus===decodeURIComponent(new URL(row.source.href).hash.slice(1))&&row.after.top>=0&&row.after.top<row.after.height,row.after);
  const y=await p.evaluate(()=>scrollY);await p.mouse.move(195,500);await p.mouse.wheel(0,400);await p.waitForTimeout(700);row.wheel={before:y,after:await p.evaluate(()=>scrollY)};check('Plain Enter actually unlocks article scroll',row.wheel.after>y+100,row.wheel);
 }else check('Modified activation opens browser tab without changing source sheet/hash',!!popup&&popup.url()===row.source.href&&row.after.hash===row.source.hash&&row.after.hidden==='false',{after:row.after,popup:row.popup});
 check('Zero original-page JS errors',errors.length===0,errors);results.push(row);ctx.off('page',listener);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/modifiers.json',JSON.stringify(results,null,2));const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
