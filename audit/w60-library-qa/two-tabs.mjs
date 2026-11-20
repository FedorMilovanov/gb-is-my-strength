import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const route='/articles/dzhon-gill-chast-2-uchenyi/';
const builds=[['2346','e567400e7381be3786907396e1ecd6e69a4547c2',process.env.W60_PR_ROOT||'/tmp/w60-bug-e567400',19086],['2352','8da79cb6e5ebd80e42fbbd4ea5f5942b8e6d68d0',process.env.W60_FIX_ROOT||'/tmp/w60-library-8da79cb',19087]];
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out='reports/w60-library-qa';await mkdir(out,{recursive:true});
const report={browser:browser.version(),scenes:[]};
const editors={library:{text:'#gb-hl-note-text',form:'#gb-hl-editor',save:'#gb-hl-editor [type=submit]',status:'#gb-hl-status'},marginalia:{text:'#npW57NoteText',form:'#npW57NoteEditor',save:'#npW57SaveNote',status:'#npW57NotesStatus'}};
const rec=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(({id,text,quoteId})=>({id,text,quoteId})));
const card=(p,id)=>p.locator(`#gb-hl-list [data-type="note"][data-id="${id}"]`);
const libraryEdit=(p,id)=>card(p,id).locator('[data-library-action="edit-note"]').click();
async function openLibrary(p){await p.locator('#gb-hl-fab').click();await p.locator('#gb-hl-panel').waitFor();await p.locator('[data-library-tab="note"]').click();}
async function makeNote(p,which,text){
 if(which==='library'){
  await openLibrary(p);await p.locator('#gb-hl-new-note').click();
 }else{
  const loc=p.locator('#gill-search-p-012');
  const coords=await loc.evaluate(e=>{e.scrollIntoView({block:'center',behavior:'instant'});const n=e.firstChild;return ['Гилл','пастором'].map((word,i)=>{
   const at=n.nodeValue.indexOf(word)+(i?word.length-1:0),r=new Range();r.setStart(n,at);r.setEnd(n,at+1);const b=r.getBoundingClientRect();return [i?b.right-.1:b.left+1.4,b.y+b.height/2];
  });});
  await p.mouse.move(...coords[0]);await p.mouse.down();await p.mouse.move(...coords[1],{steps:20});await p.mouse.up();
  assert.equal(await p.evaluate(()=>getSelection().toString()),'Гилл стал пастором');
  await p.locator('#npW57SelectionToolbar [data-w57-action="note"]').click();
 }
 const editor=editors[which];await p.locator(editor.text).fill(text);await p.locator(editor.save).click();await p.locator(editor.form).waitFor({state:'hidden'});
 const notes=await rec(p);assert.equal(notes.length,1);assert.equal(notes[0].text,text);return notes[0];
}
try{
for(const [pr,sha,root,port] of builds){
 const origin=`http://127.0.0.1:${port}`;
 const server=spawn('python3',['-u',root+'/research/reader-w57-pilot/preview.py'],{cwd:root,env:{...process.env,READER_W57_PORT:String(port)},stdio:['ignore','pipe','inherit']});
 try{
  await Promise.race([new Promise((res,rej)=>{server.stdout.once('data',res);server.once('exit',code=>rej(new Error('preview exit '+code)));}),new Promise((_,rej)=>setTimeout(()=>rej(new Error('preview start timeout')),3500))]);
  for(const which of ['library','marginalia'])for(const change of ['edit','delete']){
   const c=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   try{
    await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const a=await c.newPage(),b=await c.newPage();
    const s={pr,sha,editorA:which,changeInLibraryB:change,errors:[]};report.scenes.push(s);
    for(const p of [a,b])p.on('pageerror',e=>s.errors.push(e.message));
    const q=which==='marginalia'?'?reader-pilot=1&paper=space':'';
    assert.equal((await a.goto(origin+route+q,{waitUntil:'domcontentloaded'})).status(),200);
    if(which==='marginalia')await a.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);
    await a.evaluate(()=>document.fonts.ready);
    const note=await makeNote(a,which,'Исходный текст заметки.');s.initial=note;
    const ed=editors[which];
    if(which==='library') await libraryEdit(a,note.id);
    else await a.locator(`#npW57NotesDetails li[data-id="${note.quoteId}"] [data-action="edit"]`).click();
    await a.locator(ed.text).fill('Старый черновик из вкладки А.');
    await b.goto(origin+route,{waitUntil:'domcontentloaded'});await openLibrary(b);
    if(change==='edit'){
     await libraryEdit(b,note.id);await b.locator(editors.library.text).fill('Новая правка из вкладки Б.');
     await b.locator(editors.library.save).click();
     await b.locator(editors.library.form).waitFor({state:'hidden'});
    } else await card(b,note.id).locator('[data-library-action="delete"]').click();
    const afterB=await rec(b);
    assert.equal(afterB.length,change==='edit'?1:0);if(change==='edit')assert.equal(afterB[0].text,'Новая правка из вкладки Б.');
    s.afterB=afterB;
    assert.equal(await a.locator(ed.text).inputValue(),'Старый черновик из вкладки А.');
    await a.locator(ed.save).click();
    s.status=await a.locator(ed.status).textContent();s.editorVisible=await a.locator(ed.form).isVisible();
    s.draft=s.editorVisible?await a.locator(ed.text).inputValue():null;s.final=await rec(a);
    assert.deepEqual(s.errors,[]);
    if(pr==='2352'&&which==='library'){
     assert.deepEqual(s.final,s.afterB);
     assert.equal(s.draft,'Старый черновик из вкладки А.');
     assert.match(s.status,/Черновик не сохранён/);
    }else if(change==='edit'){
     assert.equal(s.final[0].id,note.id);
     assert.equal(s.final[0].text,'Старый черновик из вкладки А.');
    }else if(which==='marginalia'){
     assert.equal(s.final.length,1);
     assert.notEqual(s.final[0].id,note.id);
     assert.equal(s.final[0].quoteId,note.quoteId);
     assert.equal(s.final[0].text,'Старый черновик из вкладки А.');
    }else{
     assert.deepEqual(s.final,[]);
     assert.equal(s.editorVisible,false);
     assert.match(s.status,/Заметка обновлена/);
    }
    if(which==='marginalia'&&pr==='2352')await a.screenshot({path:`${out}/2352-marginalia-${change}.png`});
    await b.reload({waitUntil:'domcontentloaded'});s.afterReload=await rec(b);assert.deepEqual(s.afterReload,s.final);
   }finally{await c.close();}
  }
 }finally{server.kill();await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));}
}
}finally{await browser.close();}
