// Fresh independent contexts at1120/1121; no resize or persistence takeover.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8495',output=process.env.OUTPUT_DIR||'/tmp/reader-boundary';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const results=[];
const cases=[...['light','dark'].flatMap(colorScheme=>[390,1120,1121,1440].map(width=>({route:'/articles/dzhon-gill-chast-2-uchenyi/',width,colorScheme}))),...[1120,1121].map(width=>({route:'/baptisty-rossii/dva-sezda-1884/',width,colorScheme:'light'}))];
try{for(const profile of cases){
 const ctx=await browser.newContext({viewport:{width:profile.width,height:900},colorScheme:profile.colorScheme,isMobile:profile.width<600,hasTouch:profile.width<600,reducedMotion:'reduce',serviceWorkers:'block'}),p=await ctx.newPage(),row={profile,checks:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,pass,data)=>row.checks.push({name,pass,data});
 const response=await p.goto(base+profile.route+'?reader-pilot=1&paper=space');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(900);
 const state=await p.evaluate(()=>{const rect=s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,painted:!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'}:null;};return {ready:document.body.classList.contains('np-w57-ready'),annotated:!!window.__NP_W57_ANNOTATIONS__?.ready,noteCards:document.querySelectorAll('#npW57NotesDetails').length,scripts:[...document.scripts].map(e=>e.src).filter(s=>/\/__reader_w57__\/(?:reader_w57|reader_universal_preview)\.js/.test(s)),toc:rect('#mobPartTocBtn'),bar:rect('.mobile-top-bar'),play:rect('.reader-mobile-play'),main:rect('main.np-u-reader-main'),outline:rect('#npUOutline'),research:rect('#npUResearch'),overflow:document.documentElement.scrollWidth-innerWidth};});row.state=state;
 check('HTTP200, no horizontal document overflow',response.status()===200&&state.overflow<=1,state.overflow);
 if(profile.width<1121){
  check('Native only: no mounted/injected W57 runtime or annotations',!state.ready&&!state.annotated&&state.noteCards===0&&state.scripts.length===0,state);
  check('Native TOC and Play exposed',state.toc?.painted&&state.play?.painted&&state.play.width>=38&&state.play.height>=38,state);
  await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(400);
  check('Native Enter opens real part TOC',await p.evaluate(()=>document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='false'&&document.activeElement.matches('#partTocOverlay .toc-sheet__handle')));
  let reached=false;for(let i=0;i<100;i++){if(await p.evaluate(()=>document.activeElement.id==='gbrTocTab')){reached=true;break;}await p.keyboard.press('Tab');}
  if(reached)await p.keyboard.press('End');
  check('Native Analytics keyboard owns panel',reached&&await p.evaluate(()=>document.activeElement.id==='gbrMarginaliaTab'&&document.getElementById('gbs2PartToc').inert&&!document.getElementById('gbrMarginalia').inert));
  await p.keyboard.press('Escape');await p.waitForTimeout(400);check('Native Escape restores correct native opener',await p.evaluate(()=>document.activeElement.id==='mobPartTocBtn'&&document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='true'));
 }else{
  check('Genuine desktop W57 mounted with annotation owner exactly once',state.ready&&state.annotated&&state.noteCards===1&&state.scripts.length===2,state);
  check('Desktop reader main painted; folded panels are not required open',state.main?.painted&&state.main.width>100&&await p.locator('#npUOutline').count()===1&&await p.locator('#npUResearch').count()===1,state);
  const toggle=p.locator('#npUEdgeToggle');
  check('Desktop research has a visible dedicated toggle',await toggle.isVisible());
  if(await toggle.isVisible()){
   if(!await p.locator('#npUResearch').isVisible())await toggle.click();
   await p.waitForTimeout(400);
   const opened=await p.locator('#npUResearch').boundingBox();
   check('Desktop research can be opened by real control',!!opened&&opened.width>0&&opened.x<profile.width&&opened.x+opened.width>0,opened);
  }
 }
 check('Zero page JS errors',errors.length===0,errors);results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/boundary.json',JSON.stringify(results,null,2));const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
