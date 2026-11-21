import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const out=process.env.QA_OUT||'reports/reader-anchor-reflow-qa';await mkdir(out,{recursive:true});
const route='/articles/dzhon-gill-chast-2-uchenyi/',phrase='Гилл стал пастором';
const builds=[['a595629f15a2324205cbb9b1c2cb2cc936814214','/tmp/mobile-a595629f',19130],['615eff9af809177b30612f93a77cecc053c3836b','/tmp/mobile-615eff9a',19131]];
if(process.env.QA_SHA&&process.env.QA_ROOT)builds.push([process.env.QA_SHA,process.env.QA_ROOT,19132]);
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={browser:browser.version(),scenes:[]};
const snapshot=p=>p.evaluate(()=>{
 const blocks=[...document.querySelectorAll('article.article-body p')];
 const e=b=>b?{id:b.id,role:b.dataset.qaEdit||null,starts:b.textContent.slice(0,110)}:null;
 const range=r=>r?{block:e(r.startContainer.parentElement?.closest('p,li,blockquote')),text:r.toString(),offsets:[r.startOffset,r.endOffset]}:null;
 const records=window.GBReaderLibrary.getAll().map(x=>({id:x.id,kind:x.kind,anchor:x.annotation?.anchor||null,range:range(window.GBReaderLibrary.resolveRange(x))}));
 return {records,source:e(blocks.find(b=>b.textContent.includes('Гилл стал пастором в 1720 году — на следующий год после спора'))),inserted:e(blocks.find(b=>b.dataset.qaEdit==='inserted')),decoy:e(blocks.find(b=>b.dataset.qaEdit==='decoy')),layers:[...CSS.highlights].filter(([k])=>k.startsWith('gb-hl-')).map(([k,v])=>[k,[...v].map(range)])};
});
const loaded=async(p,url)=>{assert.equal((await p.goto(url)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary&&document.querySelector('article.article-body [id^="gill-search-p-"]'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1100);};
try{
 for(const [sha,root,port] of builds.filter(([sha])=>!process.env.ONLY_SHA||sha.startsWith(process.env.ONLY_SHA))){
  const s={sha,errors:[]};report.scenes.push(s);const origin=`http://127.0.0.1:${port}`;
  const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
   const html=await readFile(root+'/dist'+route+'index.html','utf8');
   const original=html.match(/<p\b[^>]*>Гилл стал пастором в [^]*?<\/p>/u)?.[0];assert.ok(original,'source paragraph from published HTML');
   // Synthetic editorial edits to one local HTML response; scripts/data are the exact built SHA.
   const decoy='<p data-qa-edit="decoy">Гилл стал пастором в 1720 году — на следующий год после другого события в другом городе.</p>';
   const edits={
    insert:'<p data-qa-edit="inserted">Новый короткий абзац перед исходным текстом, добавленный редактором.</p>'+original,
    insertDecoy:decoy+original,
    inblock:original.replace(phrase,'Уточнение редактора. '+phrase),
    replace:'<p data-qa-edit="inserted">Исходный абзац заменён полностью и больше не содержит выбранную фразу.</p>'+decoy,
   };
   await c.route('**/*',r=>{
    const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();
    const key=u.pathname===route?u.searchParams.get('qa-edit'):null;
    return key&&edits[key]?r.fulfill({contentType:'text/html; charset=utf-8',body:html.replace(original,edits[key])}):r.continue();
   });
   const p=await c.newPage();p.setDefaultTimeout(6700);p.on('pageerror',e=>s.errors.push(String(e)));await loaded(p,origin+route);
   s.anchor=await p.evaluate(phrase=>{
    const p=[...document.querySelectorAll('article.article-body p')].find(el=>el.textContent.startsWith(phrase+' в 1720'));const n=p.firstChild,i=n.nodeValue.indexOf(phrase);p.scrollIntoView({block:'center',behavior:'instant'});window.qa={n,i};return p.id;
   },phrase);assert.match(s.anchor,/^gill-search-p-\d+$/u);
   await p.waitForTimeout(470);await p.evaluate(n=>{const r=new Range();r.setStart(window.qa.n,window.qa.i);r.setEnd(window.qa.n,window.qa.i+n);getSelection().removeAllRanges();getSelection().addRange(r);},phrase.length);
   await p.locator('#gb-hl-selbar [data-hl-color=amber]').tap();s.saved=await snapshot(p);assert.equal(s.saved.records.length,1);assert.equal(s.saved.records[0].anchor.blockId,s.anchor);
   for(const key of ['original','insert','insertDecoy','inblock','replace','originalAgain']){
    await loaded(p,origin+route+(edits[key]?'?qa-edit='+key:''));s[key]=await snapshot(p);
    assert.equal(s[key].records[0].id,s.saved.records[0].id);assert.deepEqual(s[key].records[0].anchor,s.saved.records[0].anchor);
   }
   for(const key of ['original','originalAgain']){
    assert.equal(s[key].records[0].range?.block.id,s.anchor);assert.deepEqual(s[key].records[0].range?.offsets,[0,18]);assert.equal(s[key].layers.length,1);
   }
   assert.deepEqual(s.inblock.records[0].range?.offsets,[21,39]);
   assert.notEqual(s.insert.source?.id,s.anchor);assert.equal(s.insert.inserted?.id,s.anchor);assert.deepEqual(s.errors,[]);
  }catch(e){s.probeError=String(e);console.error(sha,e);process.exitCode=1;}finally{await c.close();server.kill();}
 }
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));await browser.close();}
