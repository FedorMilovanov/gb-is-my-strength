import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const root=process.env.QA_ROOT||'/tmp/mobile-a595629f',sha=process.env.QA_SHA||'a595629f15a2324205cbb9b1c2cb2cc936814214',out=process.env.QA_OUT||'reports/reader-kind-qa';
const port=19129,origin=`http://127.0.0.1:${port}`,route='/articles/dzhon-gill-chast-2-uchenyi/';
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',`${root}/dist`],{stdio:['ignore','pipe','ignore']});
await mkdir(out,{recursive:true});const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const delay=(p,ms=420)=>p.waitForTimeout(ms);
const action='Открыть библиотеку';
const snapshot=p=>p.evaluate(()=>{
 const btn=[...document.querySelectorAll('#gbrMarginalia button')].find(b=>b.textContent==='Открыть библиотеку');
 const panel=document.querySelector('#gbrMarginalia'),r=btn?.getBoundingClientRect(),v=panel.getBoundingClientRect(),x=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return {owner:window.OverlayRuntime.topLayer()?.ownerId||null,scroll:panel.scrollTop,articleY:scrollY,focus:document.activeElement.id||document.activeElement.textContent.slice(0,24),focused:document.activeElement===btn,library:document.querySelector('#gb-hl-backdrop').classList.contains('is-open'),buttonRect:r?[r.top,r.bottom,r.height]:null,panelRect:[v.top,v.bottom,v.height],buttonHit:!!btn&&(x===btn||btn.contains(x)),visiblePx:r?Math.max(0,Math.min(r.bottom,v.bottom)-Math.max(r.top,v.top)):null,count:btn?.closest('details')?.querySelector('summary span')?.textContent||null,opened:btn?.closest('details')?.open,selected:document.querySelector('#gbrScriptureActiveRef')?.textContent,originalButtonStillConnected:window.qaOriginal?.isConnected,trace:window.qaTrace};
});
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const width of [320,390]){
  const c=await b.newContext({viewport:{width,height:width===320?568:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  const s={width,errors:[]};report.scenes.push(s);
  try{
   await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   await c.addInitScript(()=>{window.qaTrace=[];for(const n of ['touchstart','touchend','click'])document.addEventListener(n,e=>{
    if(e.target.closest('#gbrMarginalia'))window.qaTrace.push({n,trusted:e.isTrusted,target:e.target.textContent.slice(0,30)});
   },{capture:true,passive:true});});
   const a=await c.newPage(),other=await c.newPage();for(const p of [a,other]){p.setDefaultTimeout(6200);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+route)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary);}
   await other.locator('#gb-hl-fab').tap();await other.locator('#gb-hl-new-note').tap();
   const note='QA: сохранено во второй вкладке.\n\n'+('Поле заметки содержит обычные строки, чтобы новая карточка заметно удлинила список помет. ').repeat(5);
   await other.locator('#gb-hl-note-text').fill(note);
   await a.locator('.mobile-top-bar [data-gill-marginalia-open]').tap();await delay(a);
   s.direct=await snapshot(a);s.dialogLabel=await a.locator('#partTocOverlay [role=dialog]').getAttribute('aria-label');
   const group=a.locator('#gbrMarginalia details.gbr-marginalia-group').filter({has:a.getByText('Мои пометы',{exact:true})});await group.locator(':scope > summary').tap();
   const btn=group.getByRole('button',{name:action,exact:true});await btn.scrollIntoViewIfNeeded();await btn.focus();await btn.evaluate(el=>window.qaOriginal=el);s.before=await snapshot(a);
   await other.locator('#gb-hl-editor [type=submit]').tap();await expectCount('1');s.updated=await snapshot(a);
   await a.screenshot({path:`${out}/live-focus-${width}.png`});
   await a.keyboard.press('Enter');await a.locator('#gb-hl-backdrop.is-open').waitFor();s.keyboardCanOpen=await snapshot(a);
   assert.ok(s.keyboardCanOpen.library);assert.deepEqual(s.errors,[]);
   async function expectCount(n){await a.waitForFunction(n=>[...document.querySelectorAll('#gbrMarginalia details')].find(x=>x.querySelector('summary strong')?.textContent==='Мои пометы')?.querySelector('summary span')?.textContent===n,n);await delay(a);}
  }catch(e){s.probeError=String(e);console.error(width,e);process.exitCode=1;}finally{await c.close();}
 }
}finally{await writeFile(`${out}/live-focus.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
