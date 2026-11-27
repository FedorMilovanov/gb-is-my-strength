#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const route='/articles/library-progress-demo/';
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Тест продолжения · Господь Бог — Сила Моя</title><style>body{margin:0;background:#f9f4ed;font:18px Georgia}main{max-width:700px;margin:auto}article{padding:25px}article > section{height:820px}h2{scroll-margin-top:80px}</style></head><body><main><article><h1>Тест продолжения</h1><section><p>Начало исследования</p></section><h2 id="second">Вторая глава</h2><section>Полный текст исследования</section><h2 id="third">Третья глава</h2><section>Заключение</section></article></main><script type="module" src="/src/runtime/favorite-store.js"></script><script src="/js/highlights.js"></script></body></html>';
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),file=path.resolve(root,u.pathname.replace(/^\/+/,''));
 if(u.pathname.startsWith('/js/')||u.pathname.startsWith('/css/')||u.pathname==='/src/runtime/favorite-store.js'){
   if(!fs.existsSync(file))return res.writeHead(404).end();
   res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':'text/javascript'});
   return fs.createReadStream(file).pipe(res);
 }
 res.writeHead(200,{'Content-Type':'text/html'});res.end(html);
});
async function test(engine,driver,base){
 const browser=await driver.launch(), ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.addInitScript(()=>localStorage.setItem('gb-highlights-v1',JSON.stringify([{id:'daily1',text:'Важная первая цитата',url:'/articles/a/',articleTitle:'А',savedAt:10},{id:'daily2',text:'Важная вторая цитата',url:'/articles/b/',articleTitle:'Б',savedAt:20}])));
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+route);
 await page.locator('#gb-hl-fab').click();
 await page.locator('[data-research-action=start-current]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}')['/articles/library-progress-demo']?.state==='reading');
 await page.locator('#gb-hl-close').click();
 await page.evaluate(()=>window.scrollTo(0,1080));
 await page.waitForFunction(()=>{const x=JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}');return x['/articles/library-progress-demo']?.ratio>.1&&x['/articles/library-progress-demo']?.anchor==='second'},null,{timeout:5000});
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']);
 assert.equal(record.state,'reading');
 // Opening a mounted library immediately after scrolling must save the
 // reading viewport before scroll lock, not silently discard the debounce.
 await page.evaluate(()=>new Promise(resolve=>{
   window.addEventListener('scroll',()=>{document.querySelector('#gb-hl-fab').click();resolve();},{once:true});
   window.scrollTo({top:1900,behavior:'instant'});
 }));
 await page.locator('#gb-hl-backdrop.is-open').waitFor();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='third',null,{timeout:5000});
 await page.locator('#gb-hl-close').click();
 await page.evaluate(()=>window.scrollTo(0,1080));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='second',null,{timeout:5000});
 console.log('PASS '+engine+' rapid library open preserves pending reading viewport');
 // Combine an outstanding write with opening the real mounted presenter.
 // The queued viewport must be captured before the overlay changes layout.
 const openLock='gb-library:gb-reader-notes-v1';
 await page.evaluate(name=>new Promise(resolve=>{
   window.__openProgressCommits=[];
   window.addEventListener('gb:library-committed',e=>{
     if(e.detail.key==='gb-library-reading-v1')window.__openProgressCommits.push(JSON.parse(localStorage.getItem(e.detail.key))['/articles/library-progress-demo']);
   });
   navigator.locks.request(name,()=>new Promise(release=>{window.__releaseOpenProgressLock=release;resolve();}));
 }),openLock);
 let beforeOpen;
 try{
   await page.evaluate(()=>new Promise(resolve=>{
     window.addEventListener('scroll',resolve,{once:true});
     window.scrollTo({top:0,behavior:'instant'});
   }));
   let queued=false;
   for(let i=0;i<60;i++){
     if((await page.evaluate(()=>navigator.locks.query())).pending.some(x=>x.name===openLock)){queued=true;break;}
     await page.waitForTimeout(35);
   }
   assert.equal(queued,true,'previous progress write must actually be queued');
   beforeOpen=await page.evaluate(()=>new Promise(resolve=>{
     window.addEventListener('scroll',()=>{
       const ratio=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);
       document.querySelector('#gb-hl-fab').click();
       resolve(ratio);
     },{once:true});
     window.scrollTo({top:1900,behavior:'instant'});
   }));
   await page.locator('#gb-hl-backdrop.is-open').waitFor();
 }finally{await page.evaluate(()=>window.__releaseOpenProgressLock());}
 await page.waitForFunction(()=>window.__openProgressCommits.some(x=>x.anchor==='third'),null,{timeout:5000});
 const openCommits=await page.evaluate(()=>window.__openProgressCommits);
 assert.deepEqual(openCommits.map(x=>x.anchor),['','third']);
 assert(Math.abs(openCommits[1].ratio-beforeOpen)<.000001,'queued progress preserves pre-overlay ratio');
 await page.locator('#gb-hl-close').click();
 await page.evaluate(()=>window.scrollTo({top:1080,behavior:'instant'}));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='second',null,{timeout:5000});
 console.log('PASS '+engine+' queued reading viewport survives opening and drains with exact pre-overlay ratio');
 // A real document navigation can terminate an async pagehide write.
 // The next untracked route consumes the tab-local handoff under the same CAS.
 const navKey='gb-library-progress-navigation-v1';
 const navRequests=[];
 const trackNavigation=req=>navRequests.push(new URL(req.url()).pathname);
 page.on('request',trackNavigation);
 const navigation=page.waitForURL(/navigation-destination/);
 const savedRatio=await page.evaluate(()=>new Promise(resolve=>{
   window.addEventListener('scroll',()=>{
     const ratio=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);
     location.assign('/articles/navigation-destination/');
     resolve(ratio);
   },{once:true});
   window.scrollTo({top:1900,behavior:'instant'});
 }));
 await navigation;
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='third',null,{timeout:5000});
 await page.waitForFunction(key=>sessionStorage.getItem(key)===null,navKey);
 const savedAfterNavigation=await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']);
 assert(Math.abs(savedAfterNavigation.ratio-savedRatio)<.000001,'navigation preserves exact reading viewport');
 assert.equal(await page.locator('#gb-hl-backdrop').count(),0);
 assert.equal(navRequests.filter(p=>/reader-library-(presenter|v3|ranges).js$/.test(p)).length,0);
 page.off('request',trackNavigation);
 await page.goBack({waitUntil:'domcontentloaded'});
 await page.waitForURL(/library-progress-demo/);
 await page.evaluate(()=>window.scrollTo({top:1080,behavior:'instant'}));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='second',null,{timeout:5000});
 console.log('PASS '+engine+' rapid real navigation transfers exact pending viewport without optional UI');

 // Keep a real writer blocked across document teardown, then release it
 // from another tab. The last viewport must survive, not the older one.
 const peer=await ctx.newPage();
 await peer.goto(base+'/articles/navigation-peer/');
 await peer.waitForFunction(()=>typeof window.GBHighlights?.mutateLibrary==='function');
 const acquirePeer=()=>peer.evaluate(name=>new Promise(resolve=>{
   navigator.locks.request(name,()=>new Promise(release=>{window.__releaseNavLock=release;resolve();}));
 }),openLock);
 const releasePeer=()=>peer.evaluate(()=>window.__releaseNavLock());
 const waitPeerQueue=()=>peer.waitForFunction(name=>navigator.locks.query().then(x=>x.pending.some(l=>l.name===name)),openLock);
 const leaveWithScroll=async()=>{
   const navigation=page.waitForURL(/navigation-destination/);
   const ratio=await page.evaluate(()=>new Promise(resolve=>{
     window.addEventListener('scroll',()=>{
       const ratio=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);
       location.assign('/articles/navigation-destination/');
       resolve(ratio);
     },{once:true});
     window.scrollTo({top:1900,behavior:'instant'});
   }));
   await navigation;
   await page.waitForFunction(key=>!!sessionStorage.getItem(key),navKey);
   return ratio;
 };
 await acquirePeer();
 let queuedRatio;
 try{
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await waitPeerQueue();
   queuedRatio=await leaveWithScroll();
 }finally{await releasePeer();}
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='third',null,{timeout:5000});
 await page.waitForFunction(key=>sessionStorage.getItem(key)===null,navKey);
 assert(Math.abs(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo'].ratio)-queuedRatio)<.000001);
 console.log('PASS '+engine+' blocked earlier write does not lose latest navigation viewport');
 await page.goBack({waitUntil:'domcontentloaded'});
 await page.waitForURL(/library-progress-demo/);
 await page.evaluate(()=>window.scrollTo({top:1080,behavior:'instant'}));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor==='second',null,{timeout:5000});
 // A foreign same-state change is queued ahead of the navigation replay.
 // Its exact bytes must win; a pending handoff is not a storage override.
 const navigationForeign={...record,anchor:'second',ratio:.25,updatedAt:Date.now(),title:'Other tab navigation'};
 await acquirePeer();
 try{
   await peer.evaluate(value=>{
     const key='gb-library-reading-v1';
     window.__navForeignWrite=window.GBHighlights.mutateLibrary([key],stores=>({
       changes:{[key]:{...stores[key],'/articles/library-progress-demo':value}}
     }));
   },navigationForeign);
   await waitPeerQueue();
   await leaveWithScroll();
 }finally{await releasePeer();}
 assert.equal((await peer.evaluate(()=>window.__navForeignWrite)).ok,true);
 await page.waitForFunction(key=>sessionStorage.getItem(key)===null,navKey);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']),navigationForeign);
 await peer.close();
 console.log('PASS '+engine+' navigation handoff refuses foreign same-state replacement');




 await page.goto(base+'/articles/elsewhere/');
 await page.locator('#gb-hl-fab').click();
 // Finish opening the source document before measuring destination requests.
 await page.locator('#gb-hl-backdrop.is-open').waitFor();
 await page.locator('[data-research-action=resume]').waitFor();
 const resumeRequests=[];
 const trackResume=req=>resumeRequests.push(new URL(req.url()).pathname);
 page.on('request',trackResume);
 await page.locator('[data-research-action=resume]').click();
 await page.waitForURL(/library-progress-demo/,{timeout:5000});
 await page.waitForFunction(()=>window.scrollY>400,null,{timeout:8000});
 const scrolled=await page.evaluate(()=>({anchor:JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo']?.anchor,scrollY}));
 assert(scrolled.scrollY>400,'resumed near saved second section');
 // The warm document must record progress without mounting or fetching
 // the optional panel. The navigation was already on a different route.
 await page.evaluate(()=>window.scrollTo(0,1900));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}')['/articles/library-progress-demo']?.anchor==='third',null,{timeout:5000});
 assert.equal(await page.locator('#gb-hl-backdrop').count(),0,'warm progress must not construct the library DOM');
 assert.equal(resumeRequests.filter(p=>p.endsWith('/reader-library-presenter.js')).length,0,'warm progress must not request the presenter');
 assert.equal(resumeRequests.filter(p=>p.endsWith('/reader-library-v3.js')).length,0,'warm progress must not request the research UI');
 assert.equal(resumeRequests.filter(p=>p.endsWith('/reader-library-ranges.js')).length,0,'warm reading without saved marks must not request the range runtime');
 assert.equal(resumeRequests.filter(p=>p.endsWith('/reader-library-research-core.js')).length,1,'warm progress requests one shared core');
 console.log('PASS '+engine+' warm progress without presenter/research UI request or DOM');
 // Revisit a quote, suppress it permanently, then verify it will not reappear.
 await page.locator('#gb-hl-fab').click();
 await page.locator('#gb-hl-backdrop.is-open').waitFor();
 await page.locator('.gb-hl-daily').waitFor();
 assert.equal(resumeRequests.filter(p=>p.endsWith('/reader-library-research-core.js')).length,1,'opening panel reuses the warmed core module');
 assert.equal(resumeRequests.filter(p=>p.endsWith('/reader-library-v3.js')).length,1,'opening panel loads research UI once');
 page.off('request',trackResume);
 assert.equal(await page.locator('.gb-hl-daily').count(),1);
 // The tall article fixture must not impose its height on the real Library cards.
 const geometry=await page.evaluate(()=>{
   const article=document.querySelector('article > section'), card=document.querySelector('.gb-hl-daily');
   return {articleHeight:article.getBoundingClientRect().height,cardHeight:card.getBoundingClientRect().height};
 });
 assert.equal(geometry.articleHeight,820,'article scroll fixture must retain its height');
 assert(geometry.cardHeight<geometry.articleHeight,'Library card must not inherit artificial article height');
 const first=await page.locator('[data-research-action=never-quote]').getAttribute('data-value');
 await page.locator('[data-research-action=never-quote]').click();
 await page.waitForFunction(()=>Object.keys(JSON.parse(localStorage.getItem('gb-library-revisit-v1')||'{}').suppressed||{}).length===1);
 assert.equal(await page.locator('.gb-hl-daily').count(),1,'next quote suggested');
 const second=await page.locator('[data-research-action=never-quote]').getAttribute('data-value');
 assert.notEqual(first,second);
 await page.locator('[data-research-action=never-quote]').click();
 await page.locator('.gb-hl-daily').waitFor({state:'hidden'});
 assert.equal(await page.locator('.gb-hl-daily').count(),0);
 await page.locator('#gb-hl-close').click();
 await page.reload();
 await page.locator('#gb-hl-fab').click();
 await page.locator('#gb-hl-backdrop.is-open').waitFor();
 assert.equal(await page.locator('.gb-hl-daily').count(),0,'suppressed quotes survive reload');
 assert.deepEqual(errors,[]);
 console.log('PASS '+engine+' exact resume anchor and permanent daily exclusions');
 // A previously untracked route becomes active from a second tab. It must
 // start progress tracking without opening a library or constructing its DOM.
 const cold=await ctx.newPage(), coldRequests=[];
 cold.on('request',req=>coldRequests.push(new URL(req.url()).pathname));
 await cold.goto(base+'/articles/cold-progress/');
 await cold.locator('#gb-hl-fab').waitFor();
 assert.equal(coldRequests.filter(p=>/reader-library-(v3|research-core|presenter|ranges)\.js$/.test(p)).length,0,'untracked route stays cold');
 const warmResponse=cold.waitForEvent('response',{predicate:r=>new URL(r.url()).pathname.endsWith('/reader-library-research-core.js'),timeout:5000});
 const committed=await page.evaluate(()=>window.GBHighlights.mutateLibrary(['gb-library-reading-v1'],stores=>{
   const key='gb-library-reading-v1';
   return {changes:{[key]:{...stores[key],'/articles/cold-progress':{state:'reading',title:'Cold',updatedAt:Date.now(),anchor:'',ratio:0}}}};
 }));
 assert.equal(committed.ok,true);
 await (await warmResponse).finished();
 await cold.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await cold.evaluate(()=>window.scrollTo(0,1080));
 await cold.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}')['/articles/cold-progress']?.anchor==='second',null,{timeout:5000});
 assert.equal(await cold.locator('#gb-hl-backdrop').count(),0);
 assert.equal(coldRequests.filter(p=>/reader-library-(presenter|v3|ranges)\.js$/.test(p)).length,0);
 // A genuine queued Web Lock, not an async waitForFunction predicate.
 await cold.bringToFront();
 const lockName='gb-library:gb-reader-notes-v1';
 const waitForLocks=async predicate=>{
   for(let i=0;i<60;i++){
     const locks=await cold.evaluate(()=>navigator.locks.query());
     if(predicate(locks))return;
     await cold.waitForTimeout(35);
   }
   assert.fail('expected Web Lock state not observed');
 };
 await waitForLocks(x=>![...x.held,...x.pending].some(l=>l.name===lockName));
 await cold.evaluate(()=>{
   window.__progressTrace=[];
   const key='gb-library-reading-v1';
   const capture=type=>window.__progressTrace.push({type,y:scrollY,record:JSON.parse(localStorage.getItem(key)||'{}')['/articles/cold-progress']});
   window.addEventListener('scroll',()=>capture('scroll'));
   window.addEventListener('gb:library-committed',e=>{if(e.detail.key===key)capture('commit')});
 });
 for(const {first,last,firstAnchor,lastAnchor,hold} of [
   {first:0,last:1900,firstAnchor:'',lastAnchor:'third',hold:0},
   {first:1080,last:0,firstAnchor:'second',lastAnchor:'',hold:900},
 ]){
   await waitForLocks(x=>![...x.held,...x.pending].some(l=>l.name===lockName));
   await cold.evaluate(()=>{window.__progressTrace=[];});
   await cold.evaluate(name=>new Promise(resolve=>{
     navigator.locks.request(name,()=>new Promise(release=>{window.__releaseProgressLock=release;resolve();}));
   }),lockName);
   try{
     await cold.evaluate(y=>window.scrollTo(0,y),first);
     await cold.waitForFunction(y=>window.__progressTrace.some(x=>x.type==='scroll'&&x.y===y),first);
     await waitForLocks(x=>x.pending.some(l=>l.name===lockName));
     await cold.evaluate(y=>window.scrollTo(0,y),last);
     await cold.waitForFunction(y=>window.__progressTrace.some(x=>x.type==='scroll'&&x.y===y),last);
     if(hold)await cold.waitForTimeout(hold);
   }finally{await cold.evaluate(()=>window.__releaseProgressLock());}
   await cold.waitForFunction(anchor=>window.__progressTrace.some(x=>x.type==='commit'&&x.record.anchor===anchor),lastAnchor,{timeout:5000});
   const trace=await cold.evaluate(()=>window.__progressTrace);
   assert.deepEqual(trace.filter(x=>x.type==='commit').map(x=>x.record.anchor),[firstAnchor,lastAnchor],JSON.stringify(trace));
 }
 console.log('PASS '+engine+' queued newer scrolls survive prior own commits, including expired debounce');
 // Queue an actual competing canonical write before our scroll write.
 // A same-state replacement must not be mistaken for our own successor.
 await waitForLocks(x=>![...x.held,...x.pending].some(l=>l.name===lockName));
 await cold.evaluate(()=>{window.__progressTrace=[];});
 const foreign={state:'reading',title:'Other tab',updatedAt:Date.now(),anchor:'second',ratio:0.25};
 await cold.evaluate(name=>new Promise(resolve=>{
   navigator.locks.request(name,()=>new Promise(release=>{window.__releaseProgressLock=release;resolve();}));
 }),lockName);
 try{
   await page.evaluate(record=>{
     const key='gb-library-reading-v1';
     window.__foreignProgressWrite=window.GBHighlights.mutateLibrary([key],stores=>({
       changes:{[key]:{...stores[key],'/articles/cold-progress':record}}
     }));
   },foreign);
   await waitForLocks(x=>x.pending.filter(l=>l.name===lockName).length===1);
   await cold.evaluate(()=>window.scrollTo(0,1080));
   await cold.waitForFunction(()=>window.__progressTrace.some(x=>x.type==='scroll'&&x.y===1080));
   await waitForLocks(x=>x.pending.filter(l=>l.name===lockName).length===2);
   await cold.evaluate(()=>window.scrollTo(0,1900));
   await cold.waitForFunction(()=>window.__progressTrace.some(x=>x.type==='scroll'&&x.y===1900));
 }finally{await cold.evaluate(()=>window.__releaseProgressLock());}
 assert.equal((await page.evaluate(()=>window.__foreignProgressWrite)).ok,true);
 await waitForLocks(x=>![...x.held,...x.pending].some(l=>l.name===lockName));
 // Deliberately allow the newer scroll debounce to expire; no retry/write.
 await cold.waitForTimeout(1000);
 assert.deepEqual(await cold.evaluate(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/cold-progress']),foreign);
 assert.deepEqual((await cold.evaluate(()=>window.__progressTrace)).filter(x=>x.type==='commit'),[]);
 console.log('PASS '+engine+' foreign canonical same-state replacement is not overwritten by queued scrolls');

 await cold.close();
 console.log('PASS '+engine+' cross-tab cold reading activation without presenter');

 // Deliberately fail each lazy dependency on a tracked article. A temporary
 // bootstrap scroll observer must not remain active after either failure.
 for(const module of ['reader-library-dock.js','reader-library-research-core.js']){
   const failureCtx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   try{
     await failureCtx.addInitScript(()=>{
       localStorage.setItem('gb-library-reading-v1',JSON.stringify({'/articles/library-progress-demo':{state:'reading',title:'Failure fixture',updatedAt:10,anchor:'second',ratio:.5}}));
       window.__earlyObserver={adds:0,active:false};
       const add=window.addEventListener,remove=window.removeEventListener;
       window.addEventListener=function(type,listener,options){
         if(type==='scroll'&&listener?.name==='captureEarly'){window.__earlyObserver.adds++;window.__earlyObserver.active=true;}
         return add.call(this,type,listener,options);
       };
       window.removeEventListener=function(type,listener,options){
         if(type==='scroll'&&listener?.name==='captureEarly')window.__earlyObserver.active=false;
         return remove.call(this,type,listener,options);
       };
     });
     const failure=await failureCtx.newPage();let blocked=0;
     await failure.route('**/js/'+module+'*',r=>{blocked++;return r.abort();});
     await failure.goto(base+route);
     await failure.waitForFunction(()=>window.__earlyObserver?.adds>0&&!window.__earlyObserver.active,null,{timeout:5000});
     assert(blocked>0,'must actually fail the lazy module '+module);
     assert.equal(await failure.evaluate(()=>window.__earlyObserver.active),false);
     assert.equal(await failure.evaluate(()=>JSON.parse(localStorage.getItem('gb-library-reading-v1'))['/articles/library-progress-demo'].ratio),.5);
     console.log('PASS '+engine+' releases temporary scroll observer when '+module+' fails');
   }finally{await failureCtx.close();}
 }

 }finally{await ctx.close();await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const base='http://127.0.0.1:'+server.address().port;
for(const [name,driver] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]])await test(name,driver,base);
console.log('PROGRESS AND REVISIT 3/3 PASS');}finally{server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});