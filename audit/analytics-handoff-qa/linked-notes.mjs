import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const builds=[['62be8caa145fbe18aa099dff89cffa20cd626451','/tmp/mobile-62be8caa',19110],['4accceeef1f01e0cc19bb0fe4f807e49758a2892','/tmp/mobile-4acccee',19111]];
const out=process.env.AUDIT_OUT||'reports/analytics-handoff-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={browser:b.version(),scenes:[]},pagePath='/articles/dzhon-gill-chast-2-uchenyi/';
const storage=p=>p.evaluate(()=>({quotes:JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').map(q=>({id:q.id,url:q.url,annotation:q.annotation})),notes:JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(n=>({id:n.id,quoteId:n.quoteId,text:n.text}))}));
const draft='#npW57NoteText',editor='#npW57NoteEditor';
try{for(const [sha,defaultRoot,port] of builds.filter(([s])=>!process.env.ONLY_SHA||s.startsWith(process.env.ONLY_SHA))){
 const root=process.env.AUDIT_ROOT||defaultRoot,origin=`http://127.0.0.1:${port}`,url=origin+pagePath;
 const server=spawn('python3',['-u',root+'/research/reader-w57-pilot/preview.py'],{env:{...process.env,READER_W57_DIST:root+'/dist',READER_W57_PORT:String(port)},stdio:['ignore','pipe','ignore']});
 const c=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});const s={sha,errors:[]};report.scenes.push(s);
 try{
  await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));
  assert.equal((await p.goto(url)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary);
  const exact='вечном завете';
  await p.waitForFunction(()=>document.querySelector('article.article-body p[id^="gill-search-p-"]'));
  const anchors=await p.evaluate(exact=>[...document.querySelectorAll('article.article-body p[id^="gill-search-p-"]')].flatMap(block=>{
   const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,raw='';
   while((node=walker.nextNode()))if(!node.parentElement.closest('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden=true],[role=tooltip]'))raw+=node.nodeValue;
   const phrase=[exact,'Гилл стал пастором'].find(text=>raw.includes(text));if(!phrase)return [];
   const start=raw.indexOf(phrase),end=start+phrase.length;
   return[{projection:'reader-visible-v1',blockId:block.id,start,end,exact:phrase,prefix:raw.slice(Math.max(0,start-64),start),suffix:raw.slice(end,end+64)}];
  }).slice(0,2),exact);
  assert.equal(anchors.length,2);const ids=anchors.map(a=>a.blockId);s.ids=ids;s.phrases=anchors.map(a=>a.exact);
  await p.locator('#gb-hl-fab').click();await p.locator('#gb-hl-manage').click();
  const quotes=ids.map((block,i)=>({id:i?'B':'A',text:anchors[i].exact,articleTitle:'Джон Гилл II',url:`${url}#${block}`,kind:'marker',color:i?'rose':'amber',savedAt:1700000000000+i,annotation:{version:1,kind:'marker',color:i?'rose':'amber',anchor:anchors[i]}}));
  const payload={format:'gospod-bog-reader-library',version:3,data:{quotes,notes:[],favorites:[]}};
  await p.locator('#gb-hl-json-file').setInputFiles({name:'two-markers.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await p.locator('[data-research-action=confirm-import]').click();await p.locator('#gb-hl-import-confirm').waitFor({state:'hidden'});
  s.afterImport=await storage(p);assert.deepEqual(s.afterImport.quotes.map(q=>q.id).sort(),['A','B']);
  async function createLibraryNote(id,text){
   if(!await p.locator('#gb-hl-panel').isVisible())await p.locator('#gb-hl-fab').click();
   await p.locator('[data-library-tab=quote]').click();const row=p.locator(`#gb-hl-list .gb-hl-item[data-id=${id}]`);
   await row.locator('[data-library-action=note-for-quote]').click();await p.locator('#gb-hl-note-text').fill(text);await p.locator('#gb-hl-editor [type=submit]').click();await p.locator('#gb-hl-editor').waitFor({state:'hidden'});
  }
  await p.locator('#gb-hl-manage').click();await createLibraryNote('A','Первая заметка к A');await createLibraryNote('B','Контрольная заметка к B');s.afterOneEach=await storage(p);
  const preview=url+'?reader-pilot=1&paper=space';
  async function openW57(){await p.goto(preview);await p.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);const button=p.locator('#npUEdgeToggle');if(await button.getAttribute('aria-expanded')!=='true')await button.click();const marks=p.locator('#npW57NotesDetails');if(!await marks.evaluate(n=>n.open))await marks.locator('summary').click();}
  async function editW57(id){await p.locator(`#npW57NotesDetails li[data-id=${id}] [data-action=edit]`).click();return p.locator(draft).inputValue();}
  async function saveW57(text){await p.locator(draft).fill(text);await p.locator('#npW57SaveNote').click();await p.locator(editor).waitFor({state:'hidden'});}
  await openW57();s.singleA=await editW57('A');await p.locator('#npW57CancelNote').click();s.singleB=await editW57('B');await p.locator('#npW57CancelNote').click();
  // Re-enter ordinary Library on the same origin; creates a second valid quoteId=A link using the real button.
  await p.goto(url);await createLibraryNote('A','Вторая заметка к A');s.afterSecondA=await storage(p);
  await openW57();s.multipleA=await editW57('A');await p.screenshot({path:`${out}/${sha.slice(0,7)}-duplicate-note.png`});await saveW57('Третья, созданная в W57');s.afterW57Save=await storage(p);
  await openW57();s.reopenA=await editW57('A');await p.locator('#npW57CancelNote').click();s.reopenB=await editW57('B');
 }catch(e){s.probeError=String(e);console.error(e);process.exitCode=1;}finally{await c.close();server.kill();await writeFile(`${out}/linked-notes.json`,JSON.stringify(report,null,2));}
}}finally{await b.close();}
