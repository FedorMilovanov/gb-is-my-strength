import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.QA_SHA||'615eff9af809177b30612f93a77cecc053c3836b',root=process.env.QA_ROOT||'/tmp/mobile-615eff9a';
const out=process.env.QA_OUT||'reports/reader-library-filter-qa',route='/articles/dzhon-gill-chast-2-uchenyi/';
const port=Number(process.env.QA_PORT||19141),origin=`http://127.0.0.1:${port}`;
await mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const noteA='Сравнить Ин 1:29 и Деян 20:28. Отдельная помета: историко-богословский обзор.';
const noteB='Обычная контрольная заметка о предисловии.';
const q={cards:'.gb-hl-item',search:'#gb-hl-search'};
const research=(p,key)=>p.locator(`[data-research-action="${key}"]`);
const topic=(p,label)=>p.locator('#gb-hl-topics').getByRole('button',{name:label,exact:true});
const card=(p,text)=>p.locator(q.cards).filter({hasText:text});
const open=async p=>{await p.locator('#gb-hl-fab').tap();await p.locator('#gb-hl-manage').waitFor();};
const tabAll=p=>p.locator('[data-library-tab=all]').tap();
async function addNote(p,text){
 await p.locator('#gb-hl-new-note').tap();await p.locator('#gb-hl-note-text').fill(text);
 await p.locator('#gb-hl-editor [type=submit]').tap();await p.locator('#gb-hl-editor').waitFor({state:'hidden'});await card(p,text).waitFor();
}
async function tag(p,text,tag){
 await card(p,text).locator('[data-research-action=edit-tag]').tap();
 await p.locator('#gb-hl-tag-input').fill(tag);await research(p,'save-tag').tap();
 await p.locator('#gb-hl-tag-editor').waitFor({state:'hidden'});
}
const snap=p=>p.evaluate(()=>{
 const $=s=>document.querySelector(s);const a=document.activeElement,id=a?.id||a?.tagName||null;
 const panel=$('#gb-hl-panel');const text=(s)=>$(s)?.innerText?.trim()??null;
 return {search:$('#gb-hl-search').value,tab:$('[data-library-tab][aria-pressed=true]')?.dataset.libraryTab,
  count:document.querySelectorAll('.gb-hl-item').length,empty:text('.gb-hl-empty-title'),status:text('#gb-hl-status'),
  cards:[...document.querySelectorAll('.gb-hl-item')].map(e=>({id:e.dataset.id,text:e.querySelector('.gb-hl-quote')?.textContent,tags:[...e.querySelectorAll('.gb-hl-tag')].map(x=>x.textContent)})),
  activeTopic:$('#gb-hl-topics [aria-pressed=true]')?.textContent??null,topics:[...document.querySelectorAll('#gb-hl-topics button')].map(x=>x.textContent),
  tags:JSON.parse(localStorage.getItem('gb-library-tags-v1')||'{}'),noteIds:JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(n=>n.id),
  focus:{id,text:a?.tagName==='BODY'?null:a?.textContent?.trim().slice(0,75),inside:panel.contains(a),open:!!panel.getClientRects().length&&!panel.closest('[inert]')}};
});
async function scene(name,fn){
 if(process.env.ONLY_SCENE&&!name.startsWith(process.env.ONLY_SCENE))return;
 const width=Number(process.env.QA_WIDTH||390),height=width===320?568:844;
 const s={name,width,height,errors:[]};report.scenes.push(s);
 const c=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const p=await c.newPage();p.on('pageerror',e=>s.errors.push(String(e)));p.setDefaultTimeout(7000);
  assert.equal((await p.goto(origin+route)).status(),200);await p.waitForFunction(()=>window.GBReaderLibrary);await p.evaluate(()=>document.fonts.ready);await open(p);
  await fn(p,s);assert.deepEqual(s.errors,[]);
 }catch(e){s.probeError=String(e);console.error(name,e);process.exitCode=1;}finally{await c.close();}
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 await scene('literal-search',async(p,s)=>{
  await addNote(p,noteB);await addNote(p,noteA);await tabAll(p);s.initial=await snap(p);assert.equal(s.initial.count,2);
  s.queries=[];for(const value of ['Ин 1:29','Ин 1 29','1:29','1 29','Деян 20:28','Деян 20 28','историко-богословский','историко богословский','предисловии']){
   await p.locator(q.search).fill(value);s.queries.push({query:value,...await snap(p)});
   if(value==='Ин 1:29')await p.screenshot({path:`${out}/search-literal.png`});
   if(value==='Ин 1 29')await p.screenshot({path:`${out}/search-spaced-control.png`});
  }
 });
 await scene('tag-delete-undo-and-focus',async(p,s)=>{
  await addNote(p,noteB);await addNote(p,noteA);await tag(p,noteA,'Азбука чтения');await tabAll(p);
  s.initial=await snap(p);assert.equal(s.initial.count,2);const t=topic(p,'Азбука чтения');
  // Keyboard activation rather than DOM click means browser focus is genuinely on the topic button.
  await t.focus();s.beforeTopic=await snap(p);await p.keyboard.press('Enter');s.afterTopic=await snap(p);assert.equal(s.afterTopic.count,1);
  s.tabs=[];for(let i=0;i<8;i++){await p.keyboard.press('Tab');s.tabs.push((await snap(p)).focus);}
  await t.focus();await p.keyboard.press('Enter');await p.keyboard.press('Shift+Tab');s.reverse=(await snap(p)).focus;
  await t.focus();await p.keyboard.press('Enter');await p.keyboard.press('Escape');s.escape=(await snap(p)).focus;
  if(!s.escape.open){await open(p);if((await snap(p)).activeTopic!=='Азбука чтения')await t.tap();}
  const del=()=>card(p,noteA).locator('[data-library-action=delete]').tap();
  await del();s.deleted=await snap(p);
  await p.getByRole('button',{name:'Отменить удаление'}).tap();s.undo=await snap(p);assert.equal(s.undo.cards[0].text,noteA);assert.deepEqual(s.undo.cards[0].tags,['Азбука чтения']);
  await del();await p.waitForTimeout(6150);s.expired=await snap(p);await p.screenshot({path:`${out}/deleted-topic.png`});
  await p.reload();await p.waitForFunction(()=>window.GBReaderLibrary);await open(p);s.reload=await snap(p);
  if(await t.count()){await t.tap();s.selectOrphan=await snap(p);}
 });
 await scene('tag-limit',async(p,s)=>{
  await addNote(p,noteB);const labels=Array.from({length:21},(_,i)=>`Тема ${String(i+1).padStart(2,'0')}`);
  for(const label of labels.slice(0,20))await tag(p,noteB,label);
  s.atTwenty=await snap(p);assert.equal(s.atTwenty.cards[0].tags.length,20);
  await tag(p,noteB,labels[20]);s.atTwentyOne=await snap(p);await p.screenshot({path:`${out}/tag-limit.png`});
  await p.reload();await p.waitForFunction(()=>window.GBReaderLibrary);await open(p);s.reload=await snap(p);
 });
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
