// Exhaustive authored TOC href integrity, sampled real keyboard navigation per route.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json'));
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8490';
const output=process.env.OUTPUT_DIR||'/tmp/reader-route-sweep';
const dist=process.env.DIST_DIR;
if(!dist)throw Error('DIST_DIR required: exact built artifact used to enumerate overlay routes');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const routes=walk(dist).filter(p=>p.endsWith('/index.html')&&fs.readFileSync(p,'utf8').includes('id="partTocOverlay"')).map(p=>'/'+path.relative(dist,path.dirname(p)).split(path.sep).join('/')+'/').sort();
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
let next=0;const results=[];
async function settle(p){await p.waitForTimeout(250);let n=0,last=null;for(let i=0;i<60;i++){await p.waitForTimeout(100);let y=await p.evaluate(()=>scrollY);n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;if(n>=6)return true;}return false;}
async function open(p){await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Enter');await p.waitForTimeout(300);}
async function tabTo(p,href){for(let i=0;i<220;i++){if(await p.evaluate(h=>document.activeElement.closest('#partTocOverlay')&&document.activeElement.getAttribute('href')===h,href))return true;await p.keyboard.press('Tab');}return false;}
async function worker(){while(next<routes.length){
 const route=routes[next++],row={route,checks:[],samples:[]},errors=[];
 const check=(name,pass,data)=>row.checks.push({name,pass,data});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(base+route);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);await open(p);
 const integrity=await p.evaluate(()=>{
  const links=[...document.querySelectorAll('#partTocOverlay a[href^="#"]')].filter(a=>a.hash.length>1);
  return {native:!document.body.classList.contains('np-w57-ready'),pageMarkers:[...document.querySelectorAll('#partTocOverlay [aria-current="page"]')].map(e=>e.getAttribute('href')),
   targets:links.map(a=>{const id=decodeURIComponent(a.hash.slice(1)),matches=[...document.querySelectorAll('[id]')].filter(e=>e.id===id),t=matches[0];return {href:a.getAttribute('href'),id,count:matches.length,tag:t?.tagName,excluded:!!t?.closest('[hidden],[data-reader-exclude]')};})};
 });row.integrity=integrity;
 check('Native mobile Reader',integrity.native);
 check('Every local TOC href resolves one unique authored target',integrity.targets.length>0&&integrity.targets.every(t=>t.count===1),integrity.targets.filter(t=>t.count!==1));
 check('No TOC target inside hidden/reader-excluded authored region',integrity.targets.every(t=>!t.excluded),integrity.targets.filter(t=>t.excluded));
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 const targets=[...new Map([integrity.targets[0],integrity.targets.at(-1)].filter(Boolean).map(t=>[t.href,t])).values()];
 for(const target of targets){
  await open(p);const reached=await tabTo(p,target.href);check('Keyboard reaches '+target.href,reached);
  if(!reached){await p.keyboard.press('Escape');continue;}
  await p.keyboard.press('Enter');const stable=await settle(p);
  const state=await p.evaluate(id=>({hash:decodeURIComponent(location.hash),focus:document.activeElement.id,hidden:document.querySelector('#partTocOverlay').getAttribute('aria-hidden'),top:document.getElementById(id)?.getBoundingClientRect().top,section:window.GBReaderState?.getSnapshot().sectionId}),target.id);
  row.samples.push({target,stable,state});
  check('Native hash closes overlay '+target.href,stable&&state.hash==='#'+target.id&&state.hidden==='true',state);
  check('Exact destination owns keyboard focus '+target.href,state.focus===target.id,state.focus);
  await open(p);const pages=await p.evaluate(()=>[...document.querySelectorAll('#partTocOverlay [aria-current="page"]')].map(e=>e.getAttribute('href')));
  check('Current-page identity survives navigation '+target.href,JSON.stringify(pages)===JSON.stringify(integrity.pageMarkers),pages);
  await p.keyboard.press('Escape');await p.waitForTimeout(300);
  check('Escape restores opener '+target.href,await p.evaluate(()=>document.activeElement.id==='mobPartTocBtn'));
 }
 check('Zero page JS errors',errors.length===0,errors);
 }catch(e){check('Harness completed route',false,e.stack);}finally{await context.close();results.push(row);fs.writeFileSync(output+'/partial.json',JSON.stringify(results));console.log(route,row.checks.filter(c=>!c.pass).map(c=>c.name).join(';'));}
}}
try{await Promise.all([worker(),worker(),worker()]);}finally{await browser.close();}
results.sort((a,b)=>a.route.localeCompare(b.route));fs.writeFileSync(output+'/routes.json',JSON.stringify(results,null,2));
const checks=results.flatMap(r=>r.checks),summary={routes:results.length,localLinks:results.reduce((n,r)=>n+(r.integrity?.targets.length||0),0),keyboardSamples:results.reduce((n,r)=>n+r.samples.length,0),passed:checks.filter(c=>c.pass).length,total:checks.length,failures:checks.filter(c=>!c.pass)};
fs.writeFileSync(output+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,failures:summary.failures.length}));process.exitCode=checks.every(c=>c.pass)?0:1;
