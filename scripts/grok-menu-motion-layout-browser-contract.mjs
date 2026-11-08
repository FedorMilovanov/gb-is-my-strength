// Real candidate overlay motion and reader-layout invariants.
import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const htmlPath=path.join(DIST,ROUTE.slice(1),'index.html');
if(!fs.existsSync(htmlPath)||!fs.readFileSync(htmlPath,'utf8').includes('hrail--grok'))throw Error('Built flag-ON Grok candidate is required');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
 const uri=decodeURIComponent((req.url||'/').split('?')[0]);
 const target=path.resolve(DIST,'.'+(uri.endsWith('/')?uri+'index.html':uri));
 const rel=path.relative(DIST,target);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end('not found');return;}
 res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(target).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+ROUTE;
const outcomes=[];
const measure=()=>{const q=s=>document.querySelector(s),rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;},h=document.documentElement,b=document.body,a=q('.article-body'),p=a?.querySelector('p'),menu=q('#hMobileNav'),sheet=q('#hmSettings'),pop=sheet?.querySelector('.hmsheet-panel');
 return{cw:h.clientWidth,scrollY:scrollY,htmlGutter:getComputedStyle(h).scrollbarGutter,
  article:rect(a),p:rect(p),bodyPadding:getComputedStyle(b).paddingRight,
  bodyClientWidth:b.clientWidth,bodyGutter:getComputedStyle(b).scrollbarGutter,
  locked:h.getAttribute('data-scroll-locked'),
  menu:{open:menu?.classList.contains('open'),hidden:menu?.hidden,opacity:menu?+getComputedStyle(menu).opacity:0,transform:menu?getComputedStyle(menu).transform:'',display:menu?getComputedStyle(menu).display:''},
  sheet:{open:sheet?.classList.contains('is-open'),closing:sheet?.classList.contains('is-closing'),entering:sheet?.classList.contains('is-entering'),inert:sheet?.inert,display:sheet?getComputedStyle(sheet).display:'',opacity:pop?+getComputedStyle(pop).opacity:0,transform:pop?getComputedStyle(pop).transform:'',rect:rect(pop)}};
};
const closeEnough=(a,b)=>a&&b&&Math.abs(a.x-b.x)<=.75&&Math.abs(a.w-b.w)<=.75;
for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
 const browser=await driver.launch({headless:true});
 for(const width of [1200,1440]){
  const p=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'no-preference'});
  const row={engine,width,passed:[],failed:[],states:{}},errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const test=(name,ok,detail)=>{(ok?row.passed:row.failed).push({name,...(!ok?{detail}:{})})};
  try{
   await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('.hrail--grok.grok-ready').waitFor();
   await p.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';window.scrollTo({top:550,behavior:'instant'});});
   await p.waitForFunction(()=>Math.abs(window.scrollY-550)<2,{timeout:2500});
   await p.waitForTimeout(50);
   // Capture actual CSS transition events INSIDE the browser process.
   // Playwright .click() may return after a complete 260ms opacity tween
   // on a heavily loaded Linux/WebKit runner, making sampled "start"=1
   // despite a real animation. Do not mistake that scheduling for a UI bug.
   // The gate still requires a genuine nonzero-duration opacity transition.
   await p.evaluate(() => {
     window.__gbSettingsOpacityMotion=[];
     const panel=document.querySelector('#hmSettings .hmsheet-panel');
     for(const type of ['transitionrun','transitionend']) panel?.addEventListener(type,event=>{
       if(event.target!==panel||event.propertyName!=='opacity')return;
       window.__gbSettingsOpacityMotion.push({type,time:performance.now(),opacity:Number(getComputedStyle(panel).opacity)});
     });
   });
   // Observe actual CSS events in the browser, not only delayed Playwright
   // snapshots: on overloaded WebKit runners click() may return after the
   // first opacity sample and report 1 -> .92 -> 1 despite a real tween.
   await p.evaluate(() => {
     window.__gbMenuOpacityEvents=[];
     const menu=document.querySelector('#hMobileNav');
     for(const type of ['transitionrun','transitionend']) menu?.addEventListener(type,event=>{
       if(event.target!==menu || event.propertyName!=='opacity') return;
       window.__gbMenuOpacityEvents.push({type,time:performance.now(),opacity:Number(getComputedStyle(menu).opacity)});
     });
   });
   row.states.base=await p.evaluate(measure);
   await p.locator('#hMobileMenuBtn').click();
   row.states.menuStart=await p.evaluate(measure);
   await p.waitForTimeout(100);row.states.menuMid=await p.evaluate(measure);
   await p.waitForTimeout(320);row.states.menuEnd=await p.evaluate(measure);
   const base=row.states.base,early=row.states.menuStart,mid=row.states.menuMid,end=row.states.menuEnd;
   test('stable article while site menu opens',closeEnough(base.article,end.article)&&closeEnough(base.p,end.p),{base:base.p,end:end.p});
   test('stable root gutter',base.htmlGutter==='stable'&&end.htmlGutter==='stable',{base:base.htmlGutter,end:end.htmlGutter});
   row.states.menuOpacityEvents=await p.evaluate(()=>window.__gbMenuOpacityEvents||[]);
   const menuRun=row.states.menuOpacityEvents.find(e=>e.type==='transitionrun');
   const menuEnd=row.states.menuOpacityEvents.find(e=>e.type==='transitionend');
   const menuEventTween=!!(menuRun&&menuEnd&&menuEnd.time-menuRun.time>=100);
   const menuSampleTween=early.menu.opacity<.995&&mid.menu.opacity>=early.menu.opacity&&mid.menu.opacity<=1;
   test('animated site-menu entry',early.menu.open&&end.menu.opacity>.99&&(menuEventTween||menuSampleTween),
     {early:early.menu,mid:mid.menu,end:end.menu,events:row.states.menuOpacityEvents,menuEventTween,menuSampleTween});
   await p.mouse.click(width-50,430);
   row.states.menuCloseStart=await p.evaluate(measure);
   await p.waitForTimeout(130);row.states.menuCloseMid=await p.evaluate(measure);
   await p.waitForTimeout(310);row.states.menuCloseEnd=await p.evaluate(measure);
   test('animated site-menu exit and native hidden',!row.states.menuCloseStart.menu.open&&row.states.menuCloseMid.menu.opacity<1&&row.states.menuCloseEnd.menu.hidden,{start:row.states.menuCloseStart.menu,mid:row.states.menuCloseMid.menu,end:row.states.menuCloseEnd.menu});
   await p.locator('#hrailSettingsBtn').click();
   row.states.settingsStart=await p.evaluate(measure);
   await p.waitForTimeout(110);row.states.settingsMid=await p.evaluate(measure);
   await p.waitForTimeout(330);row.states.settingsEnd=await p.evaluate(measure);
   const s0=row.states.settingsStart,s1=row.states.settingsMid,s2=row.states.settingsEnd;
   test('stable article while reader settings opens',closeEnough(base.article,s2.article)&&closeEnough(base.p,s2.p),{base:base.p,end:s2.p});
   row.states.settingsOpacityMotion=await p.evaluate(()=>window.__gbSettingsOpacityMotion || []);
   const motionStart=row.states.settingsOpacityMotion.find(e=>e.type==='transitionrun');
   const motionEnd=row.states.settingsOpacityMotion.find(e=>e.type==='transitionend');
   const observedTween=!!(motionStart&&motionEnd&&motionEnd.time-motionStart.time>=120);
   const sampledTween=s0.sheet.opacity<.85&&s1.sheet.opacity>s0.sheet.opacity;
   test('animated settings entry',s0.sheet.open&&s2.sheet.opacity>.99&&(sampledTween||observedTween),
     {start:s0.sheet,mid:s1.sheet,end:s2.sheet,motion:row.states.settingsOpacityMotion,sampledTween,observedTween});
   await p.mouse.click(width-50,430);
   row.states.settingsCloseStart=await p.evaluate(measure);
   await p.waitForTimeout(140);row.states.settingsCloseMid=await p.evaluate(measure);
   await p.waitForTimeout(350);row.states.settingsCloseEnd=await p.evaluate(measure);
   const c0=row.states.settingsCloseStart,c1=row.states.settingsCloseMid,c2=row.states.settingsCloseEnd;
   test('visible settings during exit',!c0.sheet.open&&c0.sheet.closing&&c0.sheet.display!=='none'&&c1.sheet.display!=='none'&&c1.sheet.opacity<c0.sheet.opacity,{start:c0.sheet,mid:c1.sheet});
   test('settings fully hidden after exit',c2.sheet.display==='none'&&!c2.sheet.closing,{end:c2.sheet});
   test('scroll restored',Math.abs(row.states.settingsCloseEnd.scrollY-base.scrollY)<2,{base:base.scrollY,after:row.states.settingsCloseEnd.scrollY});
   await p.locator('#hrailSettingsBtn').click();await p.waitForTimeout(380);
   await p.locator('#hmSettingsClose').click();await p.waitForTimeout(75);
   await p.evaluate(()=>document.dispatchEvent(new CustomEvent('hm:open-settings')));
   await p.waitForTimeout(550);
   row.states.quickReopen=await p.evaluate(measure);
   test('quick reopen cancels pending close',row.states.quickReopen.sheet.open&&!row.states.quickReopen.sheet.closing&&row.states.quickReopen.sheet.display!=='none'&&row.states.quickReopen.sheet.opacity>.99&&!row.states.quickReopen.sheet.inert,row.states.quickReopen.sheet);
   await p.keyboard.press('Escape');await p.waitForTimeout(470);
   row.states.escapeClosed=await p.evaluate(measure);
   test('Escape closes after rapid reopen',!row.states.escapeClosed.sheet.open&&row.states.escapeClosed.sheet.display==='none',row.states.escapeClosed.sheet);
   test('no runtime errors',errors.length===0,errors);
  }catch(e){row.failed.push({name:'test-execution',detail:String(e)})}
  outcomes.push(row);await p.close();
 }
 await browser.close();
}
// Native mobile reader sheets must not make a 15px internal body gutter.
// Chromium previously shifted centered prose 7.5px at 320/390px on opening.
for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
 const browser=await driver.launch({headless:true});
 for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:width===320?640:844},serviceWorkers:'block',reducedMotion:'no-preference'});
  const row={engine,width,mobile:true,passed:[],failed:[]},errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const test=(label,pass,detail)=>{(pass?row.passed:row.failed).push({label,...(!pass?{detail}:{})});};
  try{
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(100);
   const before=await page.evaluate(measure);
   await page.evaluate(()=>document.dispatchEvent(new CustomEvent('hm:open-settings')));
   await page.waitForTimeout(435);
   const opened=await page.evaluate(measure);
   test('mobile paragraph position/measure invariant',closeEnough(before.p,opened.p),{before:before.p,opened:opened.p});
   test('mobile article invariant',closeEnough(before.article,opened.article),{before:before.article,opened:opened.article});
   test('no inner fixed-body scrollbar gutter',opened.bodyClientWidth===before.bodyClientWidth,{before:before.bodyClientWidth,opened:opened.bodyClientWidth,gutter:opened.bodyGutter});
   test('sheet opens without overflow',opened.sheet.open&&opened.sheet.display==='block'&&opened.sheet.inert===false&&opened.cw>=width&&opened.sheet.rect?.h>0,opened.sheet);
   await page.locator('#hmSettingsClose').click();
   await page.waitForTimeout(490);
   const after=await page.evaluate(measure);
   test('mobile close and scrollbar style restore',after.sheet.display==='none'&&!after.sheet.closing&&after.bodyClientWidth===before.bodyClientWidth&&after.bodyGutter===before.bodyGutter,{before,after});
   test('mobile runtime errors',errors.length===0,errors);
  }catch(e){row.failed.push({label:'mobile execution',detail:String(e)});}
  outcomes.push(row);
  await page.close();
 }
 await browser.close();
}
const reduced=await chromium.launch({headless:true});
const p=await reduced.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
const r={engine:'chromium',width:1440,motion:'reduce',passed:[],failed:[]};
try {
 await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#hrailSettingsBtn').click();await p.locator('#hmSettingsClose').click();
 const x=await p.evaluate(measure);(x.sheet.display==='none'&&!x.sheet.closing?r.passed:r.failed).push({name:'no delayed exit under reduced motion',state:x.sheet});
}catch(e){r.failed.push({name:'execution',detail:String(e)})}
await p.close();await reduced.close();outcomes.push(r);
const REPORT_DIR=path.join(ROOT,'reports','grok-menu-motion');
fs.mkdirSync(REPORT_DIR,{recursive:true});
fs.writeFileSync(path.join(REPORT_DIR,'checks.json'),JSON.stringify(outcomes,null,2));
console.log(JSON.stringify(outcomes.map(x=>({engine:x.engine,width:x.width,motion:x.motion,pass:x.passed.length,fail:x.failed})),null,2));
await new Promise(resolve=>server.close(resolve));
if(outcomes.some(x=>x.failed.length))process.exitCode=1;