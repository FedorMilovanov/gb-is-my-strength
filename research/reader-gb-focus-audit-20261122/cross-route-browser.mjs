// Representative keyboard cross-document TOC fragment transitions on built native Reader.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json')),{chromium}=require('playwright');
const input=JSON.parse(fs.readFileSync(process.env.LINKS_JSON,'utf8')),base=process.env.BASE_URL||'http://127.0.0.1:8493',output=process.env.OUTPUT_DIR||'/tmp/reader-cross-browser';fs.mkdirSync(output,{recursive:true});
const fixtures=['/articles/dzhon-gill-chast-2-uchenyi/','/baptisty-rossii/dva-sezda-1884/','/hard-texts/enoh-prorochestvoval-iuda-14-15-4q204/'].map(source=>input.find(r=>r.source===source&&r.crossRoute&&r.fragment&&r.overlay==='partTocOverlay'));
if(fixtures.some(r=>!r))throw Error('Missing published fixture');
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const results=[];
async function settle(p){await p.waitForTimeout(500);let n=0,last=null;for(let i=0;i<60;i++){await p.waitForTimeout(100);let y=await p.evaluate(()=>scrollY);n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;if(n>=6)return true;}return false;}
try{for(const fixture of fixtures){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'}),p=await ctx.newPage(),row={fixture,checks:[]},errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,pass,data)=>row.checks.push({name,pass,data});
 await p.goto(base+fixture.source);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(400);
 // Exact href obtained from the built static audit, not fabricated selectors or destinations.
 const link=p.locator('#partTocOverlay a[href='+JSON.stringify(fixture.href)+']').first();
 const part=link.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," gbat-part ")][1]');
 const header=part.locator(':scope > .gbat-hd');
 if(await header.getAttribute('aria-expanded')==='false'){await header.focus();await p.keyboard.press('Enter');await p.waitForTimeout(400);}
 const art=link.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," gbat-art ")][1]');
 if(await art.count()){
  const toggle=art.locator('.gbat-art-chev');
  if(await toggle.getAttribute('aria-expanded')==='false'){await toggle.focus();await p.keyboard.press('Enter');await p.waitForTimeout(400);}
 }
 let reached=false;for(let i=0;i<220;i++){if(await link.evaluate(e=>e===document.activeElement)){reached=true;break;}await p.keyboard.press('Tab');}
 check('Tab reaches cross-route fragment link after keyboard expansion',reached);
 if(reached){await p.keyboard.press('Enter');await p.waitForURL(u=>u.pathname===fixture.targetPath);await p.evaluate(()=>document.fonts.ready);const stable=await settle(p);
  const state=await p.evaluate(id=>({path:location.pathname,hash:decodeURIComponent(location.hash),top:document.getElementById(id)?.getBoundingClientRect().top,height:innerHeight,overlay:document.querySelector('#partTocOverlay').getAttribute('aria-hidden'),focus:document.activeElement.id,native:!document.body.classList.contains('np-w57-ready')}),fixture.fragment);
  check('Native cross-route hash reaches visible target with closed destination dialog',stable&&state.path===fixture.targetPath&&state.hash==='#'+fixture.fragment&&state.top>=0&&state.top<state.height&&state.overlay==='true'&&state.native,state);
 }
 check('Zero page JS errors',errors.length===0,errors);results.push(row);await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(output+'/browser.json',JSON.stringify(results,null,2));const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));process.exitCode=checks.every(c=>c.pass)?0:1;
