import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const out=process.env.QA_OUT||'reports/reader-w64-independent';await mkdir(out,{recursive:true});
const route='/articles/dzhon-gill-chast-2-uchenyi/',target='Гилл стал пастором';
const builds=[['615eff9af809177b30612f93a77cecc053c3836b','/tmp/mobile-615eff9a',19149],['e4d110e2b0e829e045bed67dd2f4debb83f5a9be','/tmp/mobile-e4d110e2',19150]];
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={browser:b.version(),scenes:[]};
const snapshot=p=>p.evaluate(()=>({
 quotes:JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').map(q=>({id:q.id,text:q.text,kind:q.kind||q.annotation?.kind||'quote',color:q.color||q.annotation?.color||null,anchor:q.annotation?.anchor||null})),
 notes:JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(n=>({id:n.id,quoteId:n.quoteId,text:n.text})),
 layers:[...CSS.highlights].filter(([k])=>k.startsWith('gb-hl-')).map(([name,v])=>({name,text:[...v].map(x=>x.toString())})),
 toast:document.querySelector('.gb-hl-toast[data-open=true]')?.innerText||null,
}));
async function select(p,block,needle,n=0){
 const result=await p.evaluate(async ({block,needle,n})=>{
  const p=document.querySelector(block);p.scrollIntoView({block:'center',behavior:'instant'});
  const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);const ranges=[];
  while(w.nextNode()){
   const node=w.currentNode;if(node.parentElement.closest('.gtip,.btip,.tooltip,[hidden],[aria-hidden=true]'))continue;
   for(let i=-1;(i=node.nodeValue.indexOf(needle,i+1))>=0;){const r=new Range();r.setStart(node,i);r.setEnd(node,i+needle.length);if(r.getClientRects().length)ranges.push(r);}
  }
  const r=ranges[n];if(!r)throw Error('Missing '+needle+' '+n+' of '+ranges.length);
  const box=r.getBoundingClientRect();window.scrollBy({top:box.top+box.height/2-innerHeight/2,behavior:'instant'});
  await new Promise(r=>setTimeout(r,385));const current=getSelection();current.removeAllRanges();current.addRange(r);
  const exact=window.GBReaderAnchors.capture(p.closest('article'));
  return {text:current.toString(),captured:exact?.anchor?.blockId??null};
 },{block,needle,n});assert.equal(result.text,needle);assert.equal(result.captured,block.slice(1),'Range centered and visible before action');
}
const open=p=>p.locator('#gb-hl-fab').tap();
const loaded=async(p,url)=>{assert.equal((await p.goto(url)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary&&document.querySelector('#gill-search-p-013'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1000);};
async function ordinary(a,url,d){
 const quote=a.locator('#gb-hl-selbar-quote');
 await select(a,'#gill-search-p-013',target);await quote.tap();await a.waitForTimeout(780);d.plain=await snapshot(a);
 assert.equal(d.plain.quotes[0].text,target);assert.deepEqual(d.plain.layers,[]);
 await open(a);await a.locator('.gb-hl-item [data-library-action=note-for-quote]').tap();await a.locator('#gb-hl-note-text').fill('Проверка привязки к исходной цитате.');await a.locator('#gb-hl-editor [type=submit]').tap();await a.locator('#gb-hl-editor').waitFor({state:'hidden'});await a.locator('#gb-hl-close').tap();
 d.linked=await snapshot(a);assert.equal(d.linked.notes[0].quoteId,d.plain.quotes[0].id);
 await select(a,'#gill-search-p-013',target);await a.locator('#gb-hl-selbar [data-hl-color=amber]').tap();await a.waitForTimeout(300);
 d.amber=await snapshot(a);d.amber.message=await a.locator('#gb-hl-status').textContent();
 d.amber.toastText=await a.locator('.gb-hl-toast-text').textContent();
 await a.screenshot({path:`${out}/quote-then-marker-${d.sha.slice(0,7)}-${d.width}.png`});
 await loaded(a,url);d.reloaded=await snapshot(a);
 assert.equal(d.reloaded.notes[0].quoteId,d.plain.quotes[0].id);
 await select(a,'#gill-search-p-013',target);await a.locator('#gb-hl-selbar [data-hl-color=blue]').tap();await a.waitForTimeout(300);d.blue=await snapshot(a);d.blue.toastText=await a.locator('.gb-hl-toast-text').textContent();
}
async function occurrences(a,url,d){
 for(const n of [0,1,1]){
  await select(a,'#gill-search-p-048','позволить',n);await a.locator('#gb-hl-selbar-quote').tap();await a.waitForTimeout(780);(d.attempts??=[]).push(await snapshot(a));
 }
 await loaded(a,url);d.reloaded=await snapshot(a);assert.deepEqual(d.reloaded.layers,[]);
}
try{
 for(const [sha,root,port] of builds){
  const origin=`http://127.0.0.1:${port}`,url=origin+route;
  const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',`${root}/dist`],{stdio:['ignore','pipe','ignore']});
  try{
   await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
   for(const [kind,width,fn] of [['quote-then-marker',390,ordinary],['quote-then-marker',320,ordinary],['repeat',390,occurrences]]){
    const d={sha,width,kind,errors:[]};report.scenes.push(d);
    const c=await b.newContext({viewport:{width,height:width===320?568:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
    try{
     await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
     const a=await c.newPage();a.setDefaultTimeout(6700);a.on('pageerror',e=>d.errors.push(String(e)));
     await loaded(a,url);await fn(a,url,d);assert.deepEqual(d.errors,[]);
    }catch(e){d.probeError=String(e);console.error(sha,kind,width,e);process.exitCode=1;}finally{await c.close();}
   }
  }finally{server.kill();}
 }
}finally{await writeFile(`${out}/quote-to-marker.json`,JSON.stringify(report,null,2));await b.close();}
