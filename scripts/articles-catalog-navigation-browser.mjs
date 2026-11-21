#!/usr/bin/env node
// Owner7053771242: native Back and SSR alternative are DIFFERENT contracts.
// Usage: node scripts/articles-catalog-navigation-browser.mjs ORIGIN SHA40 NEW_OUTPUT_DIR [CHROMIUM_EXECUTABLE]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {catalogReturnHref,CATALOG_RESUME_KEY} from '../src/components/articles/articlesCatalogNavigation.ts';
export const CATALOG_DEPARTURE_TRACE_PREFIX='gb:qa:articles-departure:';
// A departing context can lose Runtime console/binding notifications. UserTiming
// trace records survive it; accept exactly one controlled, attributable snapshot.
export function readCatalogDepartureTrace(events,url,href){
 const marks=events.filter(e=>typeof e.name==='string'&&e.name.startsWith(CATALOG_DEPARTURE_TRACE_PREFIX)).map(e=>({...JSON.parse(e.name.slice(CATALOG_DEPARTURE_TRACE_PREFIX.length)),traceTimestamp:e.ts}));
 const controls=marks.filter(e=>e.phase==='control'&&e.url===url),snapshots=marks.filter(e=>e.phase==='pagehide'&&e.url===url),errors=marks.filter(e=>e.phase==='error');
 assert.equal(errors.length,0,'Departure callback error:'+JSON.stringify(errors));
 assert.ok(controls.length<=1&&snapshots.length<=1,'Ambiguous departure trace');
 const control=controls[0]??null,snapshot=snapshots[0]??null;
 if(snapshot){
  assert.ok(control&&Number.isFinite(control.traceTimestamp)&&Number.isFinite(snapshot.traceTimestamp)&&snapshot.traceTimestamp>=control.traceTimestamp,'Uncontrolled departure trace');
  assert.equal(snapshot.active?.href,href,'Departure belongs to another link');
  assert.ok(Number.isFinite(snapshot.scrollY)&&snapshot.scrollY>=0&&Number.isFinite(snapshot.height)&&snapshot.height>0&&snapshot.originalRect&&['x','y','width','height'].every(k=>Number.isFinite(snapshot.originalRect[k]))&&snapshot.originalRect.width>0&&snapshot.originalRect.height>0,'Invalid departure geometry');
 }
 return{control,snapshot,marks};
}
async function main(){
const [origin,source,directory,executablePath=process.env.ARTICLES_BROWSER_EXECUTABLE]=process.argv.slice(2);
assert.ok(origin&&/^[0-9a-f]{40}$/.test(source)&&directory,'Supply origin, exact source and a NEW output directory');
const out=path.resolve(directory);assert.ok(!fs.existsSync(out),'Never overwrite/rerun a cohort until green');fs.mkdirSync(out,{recursive:true});
const selected='/articles/svoboda-vo-hriste/',next='/articles/skrytye-idoly-serdca/',fragment='#catalog-topic-богословие';
const captureScreenshots=process.env.ARTICLES_BROWSER_SCREENSHOTS!=='off';
const allScenarios=['nativeBack','ssrReturnAlternative','ssrReverseNativeSeparate','hashReloadSeparate','modifiedLink'];
const scenarios=new Set((process.env.ARTICLES_BROWSER_SCENARIOS??allScenarios.join(',')).split(','));
assert.ok(scenarios.size&&[...scenarios].every(s=>allScenarios.includes(s)),'Unknown requested scenario');
const report={source,origin,selected,next,fragment,contract:'Owner7053771242:JS traversal enhancement;actual noJS native observations retained separately;SSR return is NOT browser Back',initScripts:0,interception:false,forcedReducedMotion:false,qaPostBackFocusScrollHistoryWrites:0,minimumObservationMs:4000,cases:[],problems:[]};
report.screenshots=captureScreenshots?'two native-return states':'disabled;existing Product-state PNGs retained without relabeling';
report.requestedScenarios=[...scenarios];report.omittedScenarios=allScenarios.filter(s=>!scenarios.has(s));report.allRequiredScenariosRun=report.omittedScenarios.length===0;
report.runnerSource=process.env.ARTICLES_BROWSER_RUNNER_SHA??null;
report.actualDepartureObserver='JS-on passive pagehide UserTiming trace with positive control and raw trace;no Runtime binding/init script/DOM/history/focus/scroll writes;no observer installed in actual noJS';
const browser=await chromium.launch({executablePath,ignoreDefaultArgs:['--disable-back-forward-cache'],args:['--no-sandbox','--disable-dev-shm-usage']});
report.browser=browser.version();report.launch={executablePath:executablePath??chromium.executablePath(),BFCache:'Playwright disabling argument removed,not forced enabled;actual CDP reasons/timeOrigin recorded;no Product browser flags'};
function state(href){
 const original=[...document.querySelectorAll('[data-catalog-route]')].find(a=>a.getAttribute('href')===href),title=original?.querySelector('.h-article-title')??original,r=title?.getBoundingClientRect(),active=document.activeElement,ar=active?.getBoundingClientRect();
 const bars=[...document.querySelectorAll('.mcp-top,[data-site-mobile-header]')].filter(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&b.bottom>0&&b.top<innerHeight;});
 const headerBottom=Math.max(0,...bars.map(e=>e.getBoundingClientRect().bottom));
 let target=null;try{target=location.hash?document.getElementById(decodeURIComponent(location.hash.slice(1))):null;}catch{}
 const tr=target?.getBoundingClientRect();
 return{url:location.href,hash:location.hash,scrollY,height:document.documentElement.scrollHeight,viewport:innerHeight,timeOrigin:performance.timeOrigin,fonts:document.fonts.status,readyState:document.readyState,documentFocus:document.hasFocus(),headerBottom,original:{title:title?.textContent.trim(),id:original?.id,rect:r?.toJSON(),visible:!!r&&r.top>=headerBottom-1&&r.bottom<=innerHeight+1},active:{tag:active?.tagName,id:active?.id,href:active?.getAttribute('href'),focusVisible:active?.matches(':focus-visible'),rect:ar?.toJSON()},target:{id:target?.id,rect:tr?.toJSON(),visible:!!tr&&tr.top>=headerBottom-1&&tr.bottom<=innerHeight+1,expectedNextHref:target?.closest('section')?.querySelector('[data-catalog-route]')?.getAttribute('href')??null},navigation:performance.getEntriesByType('navigation').map(n=>({type:n.type,notRestoredReasons:n.notRestoredReasons?.toJSON?.()??null})),historyLength:history.length,historyState:history.state,rootScrollBehavior:getComputedStyle(document.documentElement).scrollBehavior};
}
async function observeActualDeparture(p,cdp,item){
 if(!item.javaScriptEnabled)return async()=>{};
 const events=[],expectedURL=await p.url(),collect=e=>events.push(...e.value);
 cdp.on('Tracing.dataCollected',collect);
 await cdp.send('Tracing.start',{categories:'blink.user_timing',transferMode:'ReportEvents'});
 await p.evaluate(({href,prefix})=>{
  performance.mark(prefix+JSON.stringify({phase:'control',url:location.href,scrollY}));
  addEventListener('pagehide',event=>{
   try{
    const link=[...document.querySelectorAll('[data-catalog-route]')].find(a=>a.getAttribute('href')===href),title=link?.querySelector('.h-article-title'),active=document.activeElement;
    performance.mark(prefix+JSON.stringify({phase:'pagehide',persisted:event.persisted,url:location.href,scrollY,height:document.documentElement.scrollHeight,fonts:document.fonts.status,readyState:document.readyState,originalRect:title?.getBoundingClientRect().toJSON(),active:{tag:active?.tagName,id:active?.id,href:active?.getAttribute('href')},historyState:history.state}));
   }catch(error){performance.mark(prefix+JSON.stringify({phase:'error',message:String(error)}));}
  },{once:true,passive:true});
 },{href:selected,prefix:CATALOG_DEPARTURE_TRACE_PREFIX});
 return async()=>{
  const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
  await cdp.send('Tracing.end');await complete;cdp.off('Tracing.dataCollected',collect);
  const filename=`native-departure-${item.width}-${item.hashEntry?'hash':'clean'}.trace.json`,bytes=JSON.stringify({traceEvents:events},null,2)+'\n';fs.writeFileSync(path.join(out,filename),bytes);
  const parsed=readCatalogDepartureTrace(events,expectedURL,selected);item.actualDeparture=parsed.snapshot;
  item.departureTrace={filename,sha256:createHash('sha256').update(bytes).digest('hex'),events:events.length,control:parsed.control,marks:parsed.marks};
 };
}
function controlState(a){const s=getComputedStyle(a),r=a.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{fontFamily:s.fontFamily,fontSize:s.fontSize,textDecoration:s.textDecorationLine,minHeight:s.minHeight,rect:r.toJSON(),visible:r.top>=0&&r.bottom<=innerHeight,unobscured:hit===a||a.contains(hit),label:a.textContent.trim(),active:document.activeElement===a,focusVisible:a.matches(':focus-visible')};}
function controlPass(c){return c.fontFamily.includes('Source Sans 3')&&c.fontSize==='13px'&&c.textDecoration.includes('underline')&&parseFloat(c.minHeight)>=44&&c.visible&&c.unobscured&&c.active&&c.focusVisible;}
async function observe(p){const start=Date.now(),samples=[];while(Date.now()-start<4000){samples.push({elapsedMs:Date.now()-start,...await p.evaluate(state,selected)});await p.waitForTimeout(100);}return{observedMs:Date.now()-start,samples,final:await p.evaluate(state,selected)};}
async function reach(p,href,max=350,key='Tab'){for(let n=0;n<=max;n++){if(await p.evaluate(()=>document.activeElement?.getAttribute('href'))===href)return n;await p.keyboard.press(key);}throw Error('Native '+key+' did not reach '+href);}
async function catalog(p,hashEntry){const r=await p.goto(origin+'/articles/',{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);assert.equal(r.headers()['x-qa-served-source'],source);const meta={status:r.status(),htmlSHA256:createHash('sha256').update(await r.body()).digest('hex')};await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);if(hashEntry){meta.tabsToTopic=await reach(p,fragment);await p.keyboard.press('Enter');await p.waitForURL(u=>decodeURIComponent(u.hash)===fragment);await p.waitForTimeout(1200);}return meta;}
async function enterArticle(p){const n=p.waitForNavigation({waitUntil:'domcontentloaded'});await p.keyboard.press('Enter');const r=await n;assert.equal(r.status(),200);assert.equal(new URL(p.url()).pathname,selected);assert.ok(await p.locator('h1').count());return{status:r.status(),url:p.url(),h1:await p.locator('h1').first().innerText()};}
async function setup(item){const c=await browser.newContext({viewport:{width:item.width,height:item.height},javaScriptEnabled:item.javaScriptEnabled,colorScheme:'light',serviceWorkers:'allow'}),p=await c.newPage();item.errors=[];item.localHTTPProblems=[];p.on('pageerror',e=>item.errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)item.localHTTPProblems.push({url:r.url(),status:r.status()});});return{c,p};}
async function shot(p,name){await p.screenshot({path:path.join(out,name)});return{name,sha256:createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')};}
function save(){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');}
async function run(item,fn){report.cases.push(item);const{c,p}=await setup(item);try{await fn(p,c);}catch(e){item.pass=false;item.error=e.stack;report.problems.push({scenario:item.scenario,width:item.width,js:item.javaScriptEnabled,error:e.message});}finally{await c.close();save();}console.log(JSON.stringify({scenario:item.scenario,width:item.width,js:item.javaScriptEnabled,hash:item.hashEntry,pass:item.pass,nativeUXPass:item.nativeUXPass,delta:item.scrollDelta,afterActive:item.after?.active?.href,firstTab:item.firstTab?.active?.href,error:item.error}));}
try{
 if(scenarios.has('nativeBack'))for(const width of[390,1440])for(const javaScriptEnabled of[true,false])for(const hashEntry of[false,true]){
  const item={scenario:'nativeBack',width,height:width===390?844:1080,javaScriptEnabled,hashEntry,source};
  await run(item,async(p,c)=>{const cdp=await c.newCDPSession(p);await cdp.send('Page.enable');item.BFCacheNotUsed=[];cdp.on('Page.backForwardCacheNotUsed',e=>item.BFCacheNotUsed.push(e));item.catalog=await catalog(p,hashEntry);item.tabsToOrigin=await reach(p,selected);await p.waitForTimeout(1500);item.before=await p.evaluate(state,selected);assert.equal(item.before.active.href,selected);const finishDeparture=await observeActualDeparture(p,cdp,item);try{item.article=await enterArticle(p);const r=await p.goBack({waitUntil:'domcontentloaded'});item.backHTTPStatus=r?.status()??null;item.observation=await observe(p);item.after=item.observation.final;}finally{await finishDeparture();}item.scrollDelta=item.after.scrollY-item.before.scrollY;item.actualDepartureScrollDelta=item.actualDeparture?item.after.scrollY-item.actualDeparture.scrollY:null;item.actualDepartureRectDeltaY=item.actualDeparture?item.after.original.rect.y-item.actualDeparture.originalRect.y:null;item.actualDeparturePositionPass=item.actualDeparture?item.after.original.visible&&Math.abs(item.actualDepartureScrollDelta)<=1&&Math.abs(item.actualDepartureRectDeltaY)<=1:null;item.documentReloaded=item.before.timeOrigin!==item.after.timeOrigin;
   if(captureScreenshots&&width===390&&javaScriptEnabled&&hashEntry)item.screenshot=await shot(p,'js-native-back-origin-focus.png');
   await p.keyboard.press('Tab');await p.waitForTimeout(600);item.firstTab=await p.evaluate(state,selected);item.nativeUXPass=item.after.original.visible&&item.firstTab.active.href===next&&item.firstTab.documentFocus;item.pass=item.nativeUXPass;item.identityFocusPass=item.after.active.href===selected&&item.after.active.focusVisible;item.positionPass=item.after.original.visible&&Math.abs(item.scrollDelta)<=1;item.disposition=javaScriptEnabled?'JS implementation acceptance':'Actual noJS native observation;NOT covered by SSR fallback or counted as a JS repair PASS';
  });
 }
 if(scenarios.has('ssrReturnAlternative'))for(const width of[390,1440])for(const javaScriptEnabled of[true,false]){
  const item={scenario:'ssrReturnAlternative',width,height:width===390?844:1080,javaScriptEnabled,hashEntry:true,source,explicitlyNotNativeBack:true};
  await run(item,async p=>{item.catalog=await catalog(p,true);await reach(p,selected);await p.waitForTimeout(1500);item.departure=await p.evaluate(state,selected);item.article=await enterArticle(p);item.returnHref=await p.locator('a[data-catalog-return]').getAttribute('href');assert.equal(item.returnHref,catalogReturnHref(selected));await p.evaluate(()=>document.fonts.ready);item.nativeTabsToSSRReturn=await reach(p,item.returnHref,500);await p.waitForTimeout(1800);item.returnControl=await p.locator('a[data-catalog-return]').evaluate(controlState);item.returnAffordancePass=controlPass(item.returnControl);const n=p.waitForNavigation({waitUntil:'domcontentloaded'});await p.keyboard.press('Enter');const response=await n;assert.equal(response.status(),200);assert.equal(response.headers()['x-qa-served-source'],source);item.observation=await observe(p);item.after=item.observation.final;if(captureScreenshots&&width===390&&!javaScriptEnabled)item.screenshot=await shot(p,'nojs-ssr-return-origin-focus.png');await p.keyboard.press('Tab');await p.waitForTimeout(600);item.firstTab=await p.evaluate(state,selected);item.pass=item.returnAffordancePass&&item.after.original.visible&&item.after.active.href===selected&&item.firstTab.active.href===next&&item.firstTab.documentFocus;item.disposition='Native closing link to exact SSR item fragment;not Back restoration';});
 }
 if(scenarios.has('ssrReverseNativeSeparate'))for(const width of[390,1440]){
  const item={scenario:'ssrReverseNativeSeparate',width,height:width===390?844:1080,javaScriptEnabled:true,hashEntry:true,source,explicitlyNotNativeBack:true,explicitlyNotForwardTabRepair:true};
  await run(item,async p=>{item.catalog=await catalog(p,true);await reach(p,selected);await p.waitForTimeout(1500);item.article=await enterArticle(p);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);item.initialArticleFocus=await p.evaluate(()=>document.activeElement?.tagName);assert.ok(['BODY','HTML'].includes(item.initialArticleFocus),'Do not reset focus to make reverse navigation pass');item.returnHref=await p.locator('a[data-catalog-return]').getAttribute('href');assert.equal(item.returnHref,catalogReturnHref(selected));item.nativeReverseTabsToSSRReturn=await reach(p,item.returnHref,40,'Shift+Tab');await p.waitForTimeout(1800);item.returnControl=await p.locator('a[data-catalog-return]').evaluate(controlState);item.returnAffordancePass=controlPass(item.returnControl);const n=p.waitForNavigation({waitUntil:'domcontentloaded'});await p.keyboard.press('Enter');const r=await n;assert.equal(r.status(),200);assert.equal(r.headers()['x-qa-served-source'],source);item.observation=await observe(p);item.after=item.observation.final;await p.keyboard.press('Tab');await p.waitForTimeout(600);item.firstTab=await p.evaluate(state,selected);item.pass=item.returnAffordancePass&&item.after.original.visible&&item.after.active.href===selected&&item.firstTab.active.href===next&&item.firstTab.documentFocus;item.disposition='Ordinary reverse keyboard path to the SAME closing SSR link;not Back,not a forward-only Reader glossary fix,not an Escape workaround';});
 }
 if(scenarios.has('hashReloadSeparate'))for(const width of[390,1440])for(const javaScriptEnabled of[true,false]){
  const item={scenario:'hashReloadSeparate',width,height:width===390?844:1080,javaScriptEnabled,source};
  await run(item,async p=>{item.catalog=await catalog(p,true);const r=await p.reload({waitUntil:'domcontentloaded'});assert.equal(r.status(),200);item.observation=await observe(p);item.after=item.observation.final;await p.keyboard.press('Tab');await p.waitForTimeout(600);item.firstTab=await p.evaluate(state,selected);item.pass=item.after.target.visible&&item.firstTab.active.href===item.after.target.expectedNextHref;});
 }
 if(scenarios.has('modifiedLink'))for(const javaScriptEnabled of[true,false])for(const gesture of['Control-click','middle-click']){
  const item={scenario:'modifiedLink',width:390,height:844,javaScriptEnabled,gesture,source};
  await run(item,async(p,c)=>{item.catalog=await catalog(p,false);await reach(p,selected);await p.waitForTimeout(1200);item.before=await p.evaluate(state,selected);const link=p.locator(`a[data-catalog-route="${selected}"]`),r=await link.boundingBox();assert.ok(r);const popup=c.waitForEvent('page',{timeout:4000}).catch(()=>null);if(gesture==='Control-click')await p.keyboard.down('Control');await p.mouse.click(r.x+r.width/2,Math.min(r.y+r.height/2,700),{button:gesture==='middle-click'?'middle':'left'});if(gesture==='Control-click')await p.keyboard.up('Control');const child=await popup;item.newTabObserved=!!child;if(child){await child.waitForLoadState('domcontentloaded');item.newTabURL=child.url();item.correctArticleInNewTab=new URL(child.url()).pathname===selected;}item.after=await p.evaluate(state,selected);item.parentURLUnchanged=item.after.url===item.before.url;item.parentHistoryUnchanged=JSON.stringify(item.after.historyState)===JSON.stringify(item.before.historyState)&&item.after.historyLength===item.before.historyLength;item.pass=item.parentURLUnchanged&&item.parentHistoryUnchanged&&(!child||item.correctArticleInNewTab);item.disposition=child?'Native child observed;parent preserved':'Parent preserved;new-tab observation unavailable,not universal new-tab PASS';});
 }
}finally{
 await browser.close();const group=s=>report.cases.filter(c=>c.scenario===s),passed=a=>a.filter(c=>c.pass).length,js=group('nativeBack').filter(c=>c.javaScriptEnabled),nojs=group('nativeBack').filter(c=>!c.javaScriptEnabled);
 report.summary={jsNative:{cases:js.length,UXPass:passed(js),identityFocusPass:js.filter(c=>c.identityFocusPass).length,positionPass:js.filter(c=>c.positionPass).length,actualDepartureObserved:js.filter(c=>c.actualDeparture).length,actualDeparturePositionPass:js.filter(c=>c.actualDeparturePositionPass).length},nojsNative:{cases:nojs.length,UXPass:passed(nojs),guarantee:'NOT_IMPLEMENTED_OR_CLAIMED;platform ceiling retained'},ssrAlternative:{cases:group('ssrReturnAlternative').length,pass:passed(group('ssrReturnAlternative'))},ssrReverseSeparate:{cases:group('ssrReverseNativeSeparate').length,pass:passed(group('ssrReverseNativeSeparate'))},hashReloadSeparate:{cases:group('hashReloadSeparate').length,pass:passed(group('hashReloadSeparate'))},modified:{cases:group('modifiedLink').length,parentPass:passed(group('modifiedLink')),newTabs:group('modifiedLink').filter(c=>c.newTabObserved&&c.correctArticleInNewTab).length},setupErrors:report.problems.length,historyNamespace:CATALOG_RESUME_KEY};
 // Reader criterion is visible origin + next Tab. Pixel deltas remain independent raw metrics.
 // noJS Back/reload focus observations MUST NOT be disguised as implementation guarantees.
 const hashReload=group('hashReloadSeparate');
 const ok=report.allRequiredScenariosRun&&js.length===4&&passed(js)===4&&js.every(c=>c.identityFocusPass)&&js.every(c=>c.actualDeparturePositionPass)&&passed(group('ssrReturnAlternative'))===4&&hashReload.length===4&&hashReload.every(c=>c.after?.target.visible)&&hashReload.filter(c=>c.javaScriptEnabled).every(c=>c.pass)&&passed(group('modifiedLink'))===4&&report.problems.length===0;
 report.status=ok?'JS_REPAIR_AND_SSR_ALTERNATIVE_VERIFIED_NOJS_NATIVE_CEILING_RETAINED':'IMPLEMENTATION_UNRESOLVED';report.release='NO_GO/HOLD pending Owner acceptance of precise noJS native ceiling;NO_MERGE/NO_DEPLOY';save();console.log(report.status,JSON.stringify(report.summary));process.exitCode=ok?0:1;
}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
