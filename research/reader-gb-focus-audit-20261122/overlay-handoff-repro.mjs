// Native series↔part modal ownership, visible focus return and scroll unlock.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8496',output=process.env.OUTPUT_DIR||'/tmp/overlay-handoff';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const results=[];
async function tabTo(p,selector){for(let i=0;i<180;i++){if(await p.evaluate(s=>document.activeElement.matches(s),selector))return true;await p.keyboard.press('Tab');}return false;}
async function state(p){return p.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return {open:[...document.querySelectorAll('.toc-overlay[aria-hidden="false"],.gill-settings-overlay[aria-hidden="false"]')].map(e=>e.id),focus:e.id||e.className,focusOverlay:e.closest('.toc-overlay')?.id,focusVisible:!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&!e.closest('[inert],[hidden]'),bodyOverflow:getComputedStyle(document.body).overflow,htmlOverflow:getComputedStyle(document.documentElement).overflow,backgroundInert:!!document.querySelector('main')?.inert,scrollY};});}
try{for(const route of ['/articles/dzhon-gill-chast-2-uchenyi/','/baptisty-rossii/dva-sezda-1884/'])for(const viewport of [{width:390,height:844},{width:568,height:320},{width:1120,height:800}]){
 const ctx=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600,reducedMotion:'no-preference',serviceWorkers:'block'}),p=await ctx.newPage(),row={route,viewport,checks:[],states:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await p.goto(base+route);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
 await p.mouse.move(viewport.width/2,Math.min(400,viewport.height-40));await p.mouse.wheel(0,1500);await p.waitForTimeout(700);
 const before=await state(p);row.before=before;
 await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(450);
 let s=await state(p);row.states.push(s);check('Part opens as sole modal with focus inside',s.open.length===1&&s.open[0]==='partTocOverlay'&&s.focusOverlay==='partTocOverlay',s);
 for(let cycle=0;cycle<2;cycle++){
  check('Back-to-series reachable by Tab '+cycle,await tabTo(p,'#backToSeries'));await p.keyboard.press('Enter');await p.waitForTimeout(450);s=await state(p);row.states.push(s);
  check('Series takes sole modal/focus ownership '+cycle,s.open.length===1&&s.open[0]==='seriesTocOverlay'&&s.focusOverlay==='seriesTocOverlay',s);
  check('Current series item reachable '+cycle,await tabTo(p,'#seriesTocOverlay .toc-item.is-current'));await p.keyboard.press('Enter');await p.waitForTimeout(450);s=await state(p);row.states.push(s);
  check('Current series item returns to sole part owner '+cycle,s.open.length===1&&s.open[0]==='partTocOverlay'&&s.focusOverlay==='partTocOverlay',s);
 }
 await p.keyboard.press('Escape');await p.waitForTimeout(500);s=await state(p);row.closed=s;
 check('Escape closes all modals and restores visible non-inert opener',s.open.length===0&&s.focusVisible&&['mobTocBtn','mobPartTocBtn'].includes(s.focus),s);
 check('Handoff does not move article before dismissal',Math.abs(s.scrollY-before.scrollY)<=1,{before:before.scrollY,after:s.scrollY});
 await p.mouse.move(viewport.width/2,Math.min(400,viewport.height-40));await p.mouse.wheel(0,450);await p.waitForTimeout(650);const after=await state(p);row.afterWheel=after;
 check('Article scroll actually unlocked after nested handoffs',after.scrollY>s.scrollY+100,{before:s.scrollY,after:after.scrollY});
 // Separate terminal path: dismiss Series instead of returning to part.
 await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(400);await tabTo(p,'#backToSeries');await p.keyboard.press('Enter');await p.waitForTimeout(400);await p.keyboard.press('Escape');await p.waitForTimeout(450);s=await state(p);row.seriesDismiss=s;
 check('Escape directly from Series restores a visible native opener',s.open.length===0&&s.focusVisible&&['mobTocBtn','mobPartTocBtn'].includes(s.focus),s);
 check('Zero page JS errors',errors.length===0,errors);results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/handoff.json',JSON.stringify(results,null,2));const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
