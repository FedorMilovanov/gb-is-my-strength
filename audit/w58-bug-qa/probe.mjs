import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.W58_PLAYWRIGHT || 'playwright');
import {spawn} from 'node:child_process';
const port=Number(process.env.W58_PORT || 19083),origin='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',process.env.W58_DIST || '/tmp/w58-bug-599ec09/dist'],{stdio:['ignore','ignore','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const result={sha:process.env.W58_SHA || '599ec0955665a30e407162d5a2a1eaccbc9a0fd6',browser:b.version(),scenes:[]};
const output=(process.env.W58_OUT || 'reports/w58-599ec09').replace(/\/$/,'')+'/';
await mkdir(output,{recursive:true});
const routes=['/articles/dzhon-gill-chast-2-uchenyi/','/baptisty-rossii/goneniya-i-sovest/'];
const getState=p=>p.evaluate(()=>{const id=e=>e?.id||e?.tagName;const dlg=document.querySelector('#partTocOverlay .toc-sheet');const settings=document.querySelector('#gillSettingsOverlay');const panel=document.querySelector('#gbrMarginalia');return {
 owner:window.OverlayRuntime?.topLayer()?.ownerId||null,active:id(document.activeElement),activeText:document.activeElement?.innerText?.trim()?.slice(0,35),locked:document.documentElement.hasAttribute('data-scroll-locked'),
 researchActive:document.getElementById('gbrMarginaliaTab')?.getAttribute('aria-selected'),heading:dlg?.querySelector('.toc-head-txt h3')?.textContent,dialogName:dlg?.getAttribute('aria-label'),readerSection:window.GBReaderState?.getActiveSection?.(), focusRole:document.activeElement?.getAttribute('aria-label'),
 scope:panel?.querySelector('.gbr-marginalia-lead h3')?.textContent,reading:document.querySelector('#gbs2MobSec')?.textContent,
 topExpanded:document.querySelector('[data-gill-marginalia-open]')?.getAttribute('aria-expanded'),bottomExpanded:document.getElementById('mobPartTocBtn')?.getAttribute('aria-expanded'),
 hidden:panel?.hidden,settingsInert:settings?.inert,y:scrollY};});
async function snap(p,name){await p.screenshot({path:output+name+'.png',animations:'disabled'});}
try {
 for(const [index,route] of routes.entries())for(const width of index?[390]:[320,390]){
  const c=await b.newContext({viewport:{width,height:width===320?700:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',locale:'ru-RU',serviceWorkers:'block'});
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const p=await c.newPage();const scene={route,width,errors:[]};result.scenes.push(scene);
  p.on('pageerror',e=>scene.errors.push(String(e)));
  await p.goto(origin+route,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.OverlayRuntime&&document.getElementById('partTocOverlay')?.dataset.gbrMarginaliaBound);
  await p.evaluate(()=>document.fonts.ready);
  const top=p.locator('.mobile-top-bar [data-gill-marginalia-open]');
  const toc=p.locator('#mobPartTocBtn');const gear=p.locator('.mobile-bottom-bar [data-gill-settings-open]');
  await top.tap();await p.waitForTimeout(220);scene.topOpen=await getState(p);
  if(!index&&width===390) await snap(p,'01-top-research');
  await p.keyboard.press('Escape');await p.waitForTimeout(580);scene.afterResearchEscape=await getState(p);
  await toc.tap();await p.waitForTimeout(250);scene.bottomOpen=await getState(p);
  await p.locator('#gbrMarginaliaTab').tap();await p.waitForTimeout(220);scene.bottomResearch=await getState(p);
  await p.keyboard.press('Escape');await p.waitForTimeout(580);scene.afterBottomEscape=await getState(p);
  if(await gear.count()){
   await gear.focus();await p.keyboard.press('Enter');await p.waitForTimeout(300);scene.gearOpen=await getState(p);
   const learning=p.locator('#gillSettingsOverlay [data-gill-learning-open]');
   if(await learning.count()){
    await learning.focus();await p.keyboard.press('Enter');await p.waitForTimeout(300);scene.learningOpen=await getState(p);
    await p.keyboard.press('Escape');await p.waitForTimeout(610);scene.learningEscape=await getState(p);
    await p.keyboard.press('Tab');scene.learningNextTab=await getState(p);
    if(!index&&width===390) await snap(p,'02-learning-lost-focus');
   }else await p.keyboard.press('Escape');
  }
  if(index){
   await top.tap(); await p.waitForTimeout(350);
   scene.headingCandidates=await p.locator('article.article-body h2[id]').evaluateAll(els=>els.slice(0,5).map(e=>({id:e.id,text:e.textContent.trim().slice(0,120),ancestor:e.parentElement.className,y:e.getBoundingClientRect().top})));
   scene.baptistParagraphs=await p.locator('#gbrMarginalia .gbr-marginalia-evidence p').allTextContents();
   await snap(p,'04-baptists-summary-instead-of-section');
   await p.keyboard.press('Escape');
  }
  if(!index){
   await p.locator('#gill-search-p-012').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
   await p.waitForTimeout(270);
   scene.beforeMidArticle=await getState(p);
   await toc.tap();await p.locator('#gbrMarginaliaTab').tap();await p.waitForTimeout(200);scene.midArticleResearch=await getState(p);
   await p.evaluate(()=>{window.__source=[];const native=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){window.__source.push({id:this.id,kind:this.tagName,options});return native.apply(this,arguments);};});
   const term=p.locator('#gbrMarginalia details.gbr-marginalia-term').first();await term.locator('summary').tap();
   const firstJump=term.locator('.gbr-marginalia-jump');await firstJump.tap();await p.waitForTimeout(820);
   scene.jumpAfter=await getState(p);scene.scrollCalls=await p.evaluate(()=>window.__source);
   scene.sourceBox=await p.evaluate(()=>{const node=document.activeElement;const r=node.getBoundingClientRect();return {text:node.textContent.trim().slice(0,85),top:r.top,bottom:r.bottom,shown:node.contains(document.elementFromPoint(r.x+2,r.y+2))};});
   if(width===390)await snap(p,'03-return-source');
  }
  await c.close();
 }
} finally {await writeFile(output+'evidence.json',JSON.stringify(result,null,2));await b.close();server.kill();}
