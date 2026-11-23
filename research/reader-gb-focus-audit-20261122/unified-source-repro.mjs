// Current single quiz: plain source landing/resume vs modified source activation.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8499',output=process.env.OUTPUT_DIR||'/tmp/unified-source';fs.mkdirSync(output,{recursive:true});const route='/articles/dzhon-gill-chast-2-uchenyi/',results=[];
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
async function snapshot(p){return p.evaluate(()=>({url:location.href,hash:location.hash,state:sessionStorage.getItem('gb-reader-study-v1:'+location.pathname),quiz:document.querySelector('#gbAnalyticsQuiz')?.innerText,owners:document.querySelectorAll('#gbAnalyticsStudy').length,feedback:document.querySelectorAll('#gbAnalyticsQuiz .gb-study-feedback').length,w57:document.body.classList.contains('np-w57-ready')}));}
async function open(p,width){if(width<1121){await p.locator('#mobPartTocBtn').click();await p.locator('#gbrMarginaliaTab').click();await p.waitForFunction(()=>!!document.querySelector('#gbrMarginalia #gbAnalyticsStudy'));}else{await p.waitForFunction(()=>!!document.querySelector('#npUResearch #gbAnalyticsStudy'));}const root=p.locator('#gbAnalyticsStudy');if(!await root.evaluate(e=>e.open))await root.locator(':scope > summary').click();}
async function settle(p){await p.waitForTimeout(450);let n=0,last=null;for(let i=0;i<60;i++){await p.waitForTimeout(100);let y=await p.evaluate(()=>scrollY);n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;if(n>=6)return true;}return false;}
try{for(const width of [390,1440])for(const mode of ['Enter','Control+Enter','Control+click']){
 const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block'}),p=await ctx.newPage(),row={width,mode,checks:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await p.goto(base+route+(width>1120?'?paper=space&panel=open':''));await p.evaluate(()=>document.fonts.ready);if(width>1120)await p.waitForFunction(()=>document.body.classList.contains('np-w57-ready'));
 await open(p,width);await p.locator('#gbAnalyticsQuiz .gb-study-options button').first().click();await p.locator('#gbAnalyticsQuiz .gb-study-feedback a').waitFor({state:'visible'});
 const link=p.locator('#gbAnalyticsQuiz .gb-study-feedback a').first();const before=await snapshot(p);row.before=before;const href=await link.getAttribute('href');row.source=new URL(href,p.url()).href;
 let reached=false;for(let i=0;i<120;i++){if(await link.evaluate(e=>e===document.activeElement)){reached=true;break;}await p.keyboard.press('Shift+Tab');}check('Source reached by real Shift+Tab after answer',reached);
 if(mode==='Enter'){
  await p.keyboard.press('Enter');const stable=await settle(p);const id=decodeURIComponent(new URL(row.source).hash.slice(1));
  const landing=await p.evaluate(id=>{const e=document.getElementById(id),r=e?.getBoundingClientRect();return {focus:document.activeElement.id,top:r?.top,bottom:r?.bottom,height:innerHeight,open:document.getElementById('partTocOverlay').getAttribute('aria-hidden'),owners:document.querySelectorAll('#gbAnalyticsStudy').length};},id);row.landing=landing;
  check('Plain Enter closes native modal and focuses visible exact source',stable&&landing.focus===id&&landing.top>=0&&landing.top<landing.height&&landing.open==='true',landing);
  const y=await p.evaluate(()=>scrollY),point=await p.evaluate(()=>{const r=document.querySelector('article.article-body').getBoundingClientRect();return {x:r.left+r.width/2,y:500};});await p.mouse.move(point.x,point.y);await p.mouse.wheel(0,400);await p.waitForTimeout(650);const afterY=await p.evaluate(()=>scrollY);check('Source navigation unlocks article wheel',afterY>y+100,{before:y,after:afterY});
  await open(p,width);row.resumed=await snapshot(p);check('Reopening quiz retains exact answer/session and one owner',row.resumed.state===before.state&&row.resumed.quiz===before.quiz&&row.resumed.owners===1&&row.resumed.feedback===1,row.resumed);
 }else{
  const popupPromise=ctx.waitForEvent('page',{timeout:7000});
  if(mode==='Control+Enter')await p.keyboard.press(mode);else await link.click({modifiers:['Control']});
  const popup=await popupPromise.catch(e=>{row.popupError=String(e);return null;});if(popup){await popup.waitForURL(u=>u.href!=='about:blank',{timeout:15000});await popup.waitForLoadState('domcontentloaded');}row.popup=popup?.url()||null;row.after=await snapshot(p);
  check('Modified activation opens actual source URL in new tab',row.popup===row.source,row.popup);
  check('Modified activation preserves original URL/question/attempt',row.after.url===before.url&&row.after.state===before.state&&row.after.quiz===before.quiz&&row.after.owners===1&&row.after.feedback===1,row.after);
 }
 check('Retired Learning absent',await p.locator('#gillLearningOverlay,#mobLearningBtn').count()===0);
 check('Zero original-page JS errors',errors.length===0,errors);results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/unified.json',JSON.stringify(results,null,2));const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
