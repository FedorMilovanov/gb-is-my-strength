import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.QA_SHA||'615eff9af809177b30612f93a77cecc053c3836b',root=process.env.QA_ROOT||'/tmp/mobile-615eff9a';
const out=process.env.QA_OUT||'reports/reader-backup-qa',route='/articles/dzhon-gill-chast-2-uchenyi/';
const port=Number(process.env.QA_PORT||19137),ports=[port,port+1],servers=[];const origin=i=>`http://127.0.0.1:${ports[i]}`;
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),events:[],errors:[]};
const cnew=()=>b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true,serviceWorkers:'block',reducedMotion:'reduce'});
async function page(c,i){
 const base=origin(i);await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 const p=await c.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>report.errors.push(String(e)));
 assert.equal((await p.goto(base+route)).status(),200);
 await p.waitForFunction(()=>window.GBReaderLibrary&&document.querySelector('#gill-search-p-013'));await p.evaluate(()=>document.fonts.ready);
 return p;
}
const action=(p,key)=>p.locator(`[data-research-action="${key}"]`);
const lib=(p,key)=>p.locator(`[data-library-action="${key}"]`);
const state=p=>p.evaluate(()=>({
 quotes:JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').map(q=>({id:q.id,chars:q.text.length,url:q.url,kind:q.kind??null,anchor:q.annotation?.anchor?.blockId??null})),
 notes:JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(n=>({id:n.id,text:n.text,url:n.url,quoteId:n.quoteId??null,contextChars:n.quoteText.length})),
 tags:JSON.parse(localStorage.getItem('gb-library-tags-v1')||'{}'),
 layers:[...CSS.highlights].filter(([k])=>k.startsWith('gb-hl-')).map(([k,v])=>[k,v.size]),
}));
async function open(p){await p.locator('#gb-hl-fab').tap();await p.locator('#gb-hl-manage').waitFor();}
async function saveBackup(p,name){
 await p.locator('#gb-hl-manage').tap();
 const [dl]=await Promise.all([p.waitForEvent('download'),action(p,'export-json').tap()]);
 const raw=await readFile(await dl.path());const {data}=JSON.parse(raw.toString());
 report.events.push({name,bytes:raw.length,status:await p.locator('#gb-hl-status').innerText(),stored:await state(p),exported:{quotes:data.quotes.map(q=>[q.id,q.text.length]),notes:data.notes.map(n=>[n.id,n.quoteText.length])}});
 await p.locator('#gb-hl-manage').tap();return raw;
}
async function selectText(p,length){
 // Real rendered paragraphs, no storage injection; browser Range replaces platform long press.
 return p.evaluate(async length=>{
  const start=document.querySelector('#gill-search-p-013'),article=start.closest('article');
  const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT,{acceptNode(n){
   const e=n.parentElement;
   if(!e.closest('.reveal')||e.closest('button,svg,sup,aside,.source-tooltip,.fn-marker,.gtip,.btip,.tooltip,[hidden],[aria-hidden=true]'))return NodeFilter.FILTER_SKIP;
   const r=document.createRange();r.selectNodeContents(n);
   if(!r.getClientRects().length||getComputedStyle(e).visibility!=='visible')return NodeFilter.FILTER_SKIP;
   return NodeFilter.FILTER_ACCEPT;
  }});
  const first=start.firstChild;walker.currentNode=first;
  let node=first,left=length;
  while(node&&node.length<left){left-=node.length;node=walker.nextNode();}
  if(!node)throw Error('article too short');
  start.scrollIntoView({block:'start',behavior:'instant'});scrollBy(0,-110);
  await new Promise(r=>setTimeout(r,420));
  const range=new Range();range.setStart(first,0);range.setEnd(node,left);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
  return {rangeChars:range.toString().length,visibleChars:sel.toString().length,starts:sel.toString().slice(0,25),end:node.parentElement.closest('p,li,blockquote')?.id};
 },length);
}
async function restore(raw,i,name){
 const c=await cnew();try{
  const p=await page(c,i);
  const observer=name==='same-origin-ok'?await c.newPage():null;
  if(observer){observer.on('pageerror',e=>report.errors.push(String(e)));assert.equal((await observer.goto(origin(i)+route)).status(),200);await observer.waitForFunction(()=>window.GBReaderLibrary&&document.querySelector('#gill-search-p-013'));await p.bringToFront();}
  await p.waitForTimeout(1100);await open(p);await p.locator('#gb-hl-manage').tap();
  const confirmation=p.locator('#gb-hl-import-confirm');
  const s={name,origin:i,before:await state(p)};report.events.push(s);
  await p.locator('#gb-hl-json-file').setInputFiles({name:'actual-ui-backup.json',mimeType:'application/json',buffer:raw});
  await p.waitForFunction(()=>!document.querySelector('#gb-hl-import-confirm').hidden||document.querySelector('#gb-hl-status').classList.contains('is-visible'));
  s.confirm=await confirmation.isVisible();if(s.confirm){s.prompt=await confirmation.innerText();await action(p,'confirm-import').tap();await confirmation.waitFor({state:'hidden'});}
  s.status=await p.locator('#gb-hl-status').innerText();s.after=await state(p);await p.waitForTimeout(1200);s.settled=await state(p);if(observer)s.observer=await state(observer);
  await p.screenshot({path:`${out}/${name}.png`});
  await p.locator('#gb-hl-close').tap();await p.waitForTimeout(400);s.closed=await state(p);
  await p.reload();await p.waitForFunction(()=>window.GBReaderLibrary);await p.waitForTimeout(1200);s.reload=await state(p);
  return s;
 }finally{await c.close();}
}
try{
 await mkdir(out,{recursive:true});
 for(const port of ports){const s=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});servers.push(s);await Promise.race([new Promise((r,j)=>{s.stdout.once('data',r);s.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);}
 const c=await cnew();try{
  const p=await page(c,0);
  await selectText(p,18);await p.locator('#gb-hl-selbar [data-hl-color=amber]').tap();await p.waitForTimeout(320);
  await open(p);await lib(p,'note-for-quote').tap();await p.locator('#gb-hl-note-text').fill('Заметка к реальной помете Gill II.');await p.locator('#gb-hl-editor [type=submit]').tap();await p.locator('#gb-hl-editor').waitFor({state:'hidden'});
  const small=await saveBackup(p,'export-small');
  const positive=await restore(small,0,'same-origin-ok');assert.equal(positive.reload.quotes.length,1);assert.equal(positive.reload.notes[0].quoteId,positive.reload.quotes[0].id);assert.equal(positive.reload.layers[0]?.[1],1);
  await restore(small,1,'other-origin');
  if(!process.env.QA_SMALL_ONLY){
  await p.locator('#gb-hl-close').tap();
  const mid=await selectText(p,2850);report.events.push({name:'select-medium',...mid});await p.locator('#gb-hl-selbar-quote').tap();await p.waitForTimeout(820);
  await open(p);const q=(await state(p)).quotes.find(x=>x.chars>1800);assert.ok(q,JSON.stringify({mid,stored:await state(p)}));
  await p.locator(`.gb-hl-item[data-id="${q.id}"]`).locator('[data-library-action=note-for-quote]').tap();await p.locator('#gb-hl-note-text').fill('Длинный контекст связанной заметки.');await p.locator('#gb-hl-editor [type=submit]').tap();await p.locator('#gb-hl-editor').waitFor({state:'hidden'});
  const medium=await saveBackup(p,'export-medium');await restore(medium,0,'long-note-context');
  await p.locator('#gb-hl-close').tap();
  const long=await selectText(p,28400);report.events.push({name:'select-large',...long});await p.locator('#gb-hl-selbar-quote').tap();await p.waitForTimeout(820);
  assert.ok((await state(p)).quotes.some(x=>x.chars>25000),JSON.stringify({long,stored:await state(p)}));
  await open(p);const large=await saveBackup(p,'export-large');await restore(large,0,'own-oversize-quote');
  }
 }finally{await c.close();}
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));await b.close();for(const s of servers)s.kill();}
