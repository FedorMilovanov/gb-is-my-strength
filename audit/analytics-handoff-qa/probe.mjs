import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const builds=[['62be8caa145fbe18aa099dff89cffa20cd626451','/tmp/mobile-62be8caa',19107],['6b7d7c353b65c669501860ef2e938549ca2097db','/tmp/mobile-6b7d7c3',19108],['4accceeef1f01e0cc19bb0fe4f807e49758a2892','/tmp/mobile-4acccee',19109]];
const root=process.env.AUDIT_ROOT;const out=process.env.AUDIT_OUT||'reports/analytics-handoff-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={browser:b.version(),scenes:[]};
const gill='/articles/dzhon-gill-chast-2-uchenyi/';
const textp='#sec-systematics';
const wait=(p,ms=530)=>p.waitForTimeout(ms);
const state=p=>p.evaluate(()=>{
 const a=document.activeElement,rect=a.getBoundingClientRect(),v=visualViewport,hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
 return {y:scrollY,hash:location.hash,section:window.GBReaderState?.getActiveSection()?.id,osReduced:matchMedia('(prefers-reduced-motion: reduce)').matches,inAppMotion:window.GBReaderPreferences?.get().motion,lock:document.documentElement.getAttribute('data-scroll-locked'),owner:window.OverlayRuntime?.topLayer()?.ownerId||null,
  focus:{id:a.id,tag:a.tagName,cls:a.className?.baseVal||a.className,label:a.getAttribute('aria-label'),term:a.dataset.termTitle||a.dataset.term||null,visible:a!==document.body&&a.contains(hit)&&rect.top>=v.offsetTop&&rect.bottom<=v.offsetTop+v.height,focusVisible:a.matches(':focus-visible'),top:rect.top,bottom:rect.bottom,hit:hit?.id||(typeof hit?.className==='string'?hit.className:hit?.className?.baseVal)||hit?.tagName,scrollMargin:getComputedStyle(a).scrollMarginTop,expanded:a.getAttribute('aria-expanded')},
  analytics:document.querySelector('#partTocOverlay').classList.contains('is-open'),library:document.querySelector('#gb-hl-backdrop').classList.contains('is-open'),tips:[...document.querySelectorAll('.gb-floating-tip.is-open')].map(t=>({id:t.id,role:t.getAttribute('role'),top:t.getBoundingClientRect().top,bottom:t.getBoundingClientRect().bottom})),stack:window.OverlayRuntime?.getStack?.()?.map(x=>x.ownerId)||[],lastJump:window.jumpCalls.at(-1)||null};
});
async function seek(p,selector){const loc=p.locator(selector).first();await loc.evaluate(el=>scrollBy(0,el.getBoundingClientRect().top-125));await wait(p);}
async function analytics(p){await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();await p.locator('#gbrMarginalia:not([hidden])').waitFor();await wait(p,380);}
function group(p,name){return p.locator('details.gbr-marginalia-group').filter({has:p.getByText(name,{exact:true})});}
function openGroup(p,name){return group(p,name).locator(':scope > summary').tap();}
const tests={
 async 'article-keyboard'(p,s){
  const term=p.locator('article .gterm[data-gb-tooltip-ready="1"]').first();await term.waitFor();await seek(p,'article .gterm[data-gb-tooltip-ready="1"]');
  // Registered marker is focused by a genuine Tab from the immediately preceding DOM position.
  await term.evaluate(el=>{const n=document.createElement('button');n.id='qa-before';n.textContent='QA Tab precursor';n.style.cssText='position:absolute;width:1px;height:1px;clip-path:inset(50%);';el.before(n);n.focus({preventScroll:true});});
  await p.keyboard.press('Tab');await wait(p);s.tab=await state(p);assert.ok(s.tab.focus.term||s.tab.owner==='article-inline-tooltip');
  await p.keyboard.press('Enter');await wait(p);s.enter=await state(p);
  await p.screenshot({path:`${out}/${s.key}-term.png`});await p.keyboard.press('Escape');await wait(p,790);s.escape=await state(p);
  const f=p.locator('article .gterm[data-gb-tooltip-ready="1"]').first();await f.tap();await wait(p);s.tap=await state(p);await p.keyboard.press('Escape');await wait(p,790);s.tapEscape=await state(p);
 },
 async 'term-via-analytics'(p,s){
  await seek(p,textp);s.before=await state(p);await analytics(p);
  const glossary=group(p,'Понятия');if(await glossary.count())await openGroup(p,'Понятия');
  const entry=p.locator('#gbrMarginalia .gbr-marginalia-term').first();await entry.locator('summary').tap();s.term=await entry.locator('summary').innerText();
  const action=entry.getByRole('button',{name:/Показать в статье/});
  if(s.input==='keyboard'){await action.focus();await p.keyboard.press('Enter');}else await action.tap();
  await wait(p,1880);s.after=await state(p);await p.screenshot({path:`${out}/${s.key}-jump.png`});
  if(s.after.tips.length){await p.keyboard.press('Escape');await wait(p,790);s.afterEscape=await state(p);}
 },
 async 'library-bridge'(p,s){
  await seek(p,textp);s.before=await state(p);await analytics(p);await openGroup(p,'Мои пометы');
  const button=group(p,'Мои пометы').getByRole('button',{name:'Открыть библиотеку'});await button.focus();await p.keyboard.press('Enter');await wait(p);s.open=await state(p);
  await p.keyboard.press('Escape');await wait(p,800);s.closed=await state(p);await p.keyboard.press('Tab');await wait(p,280);s.nextTab=await state(p);
  await p.locator('#gb-hl-fab').tap();await wait(p);s.directOpen=await state(p);await p.keyboard.press('Escape');await wait(p,800);s.directClose=await state(p);
 },
 async 'evidence-motion'(p,s){
  if(s.input==='in-app-reduced'){
   await p.locator('#mobSettingsBtn').tap();await p.locator('#gillSettingsOverlay [data-motion=reduced]').tap();
   await p.keyboard.press('Escape');await wait(p);assert.equal((await state(p)).inAppMotion,'reduced');
  }
  // Position reader deep inside a chapter with an evidence jump back toward its beginning.
  await seek(p,textp);s.before=await state(p);await analytics(p);
  if(await group(p,'Ход текста').count())await openGroup(p,'Ход текста');
  const phrase=p.locator('#gbrMarginalia .gbr-marginalia-evidence button').first();await phrase.tap();
  await wait(p,1960);s.after=await state(p);s.samples=await p.evaluate(()=>window.jumpFrames);
 },
};
try{for(const [sha,defaultRoot,port] of builds.filter(([v])=>!process.env.ONLY_SHA||v.startsWith(process.env.ONLY_SHA))){
 const origin=`http://127.0.0.1:${port}`,dir=root||defaultRoot;
 const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',dir+'/dist'],{stdio:['ignore','pipe','ignore']});
 try{
  await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
  const plan=[['article-keyboard',390,844,'keyboard'],['term-via-analytics',390,844,'keyboard'],['term-via-analytics',390,844,'touch'],['evidence-motion',390,844,'touch']];
  if(sha.startsWith('4acc'))plan.push(['evidence-motion',390,844,'in-app-reduced']);
  if(!sha.startsWith('62be'))plan.push(['library-bridge',390,844,'keyboard'],['library-bridge',320,568,'keyboard']);
  for(const [kind,width,height,input] of plan){
   const s={sha,kind,width,height,input,key:`${sha.slice(0,7)}-${kind}-${width}-${input}`,errors:[]};report.scenes.push(s);
   const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:input==='in-app-reduced'?'no-preference':'reduce',serviceWorkers:'block'});
   try{
    await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await c.addInitScript(()=>{
     window.jumpCalls=[];window.jumpFrames=[];
     const scroll=Element.prototype.scrollIntoView;
     Element.prototype.scrollIntoView=function(...args){
      if(this.closest('article')){
       const call={y:scrollY,targetTop:this.getBoundingClientRect().top,dest:this.id||this.closest('p')?.id||this.tagName,label:(this.dataset.termTitle||this.dataset.term||this.textContent).trim().slice(0,70),opts:args[0]};
       window.jumpCalls.push(call);const start=performance.now();window.jumpFrames=[];
       const sample=()=>{window.jumpFrames.push([Math.round(performance.now()-start),Math.round(scrollY)]);if(performance.now()-start<1800)requestAnimationFrame(sample);};requestAnimationFrame(sample);
      }
      return scroll.apply(this,args);
     };
    });
    const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+gill)).status(),200);
    await p.waitForFunction(()=>window.OverlayRuntime&&window.GBReaderState&&window.GBReaderLibrary);await p.evaluate(()=>document.fonts.ready);await tests[kind](p,s);
   }catch(e){s.probeError=String(e);console.error(s.key,e);process.exitCode=1;}finally{await c.close();}
  }
 }finally{server.kill();await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));}
}}finally{await b.close();}
