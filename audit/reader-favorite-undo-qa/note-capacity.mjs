import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.QA_SHA||'615eff9af809177b30612f93a77cecc053c3836b',root=process.env.QA_ROOT||'/tmp/mobile-615eff9a';
const out=process.env.QA_OUT||'reports/reader-favorite-undo-qa',port=Number(process.env.QA_PORT||19146),origin=`http://127.0.0.1:${port}`;
const route='/articles/dzhon-gill-chast-2-uchenyi/';
await mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const payload=notes=>Buffer.from(JSON.stringify({format:'gospod-bog-reader-library',version:3,data:{quotes:[],notes,favorites:[]}}));
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(({id,text})=>({id,text})));
const status=p=>p.locator('#gb-hl-status').innerText();
const choose=(p,raw)=>p.locator('#gb-hl-json-file').setInputFiles({name:'library.json',mimeType:'application/json',buffer:raw});
const action=(p,key)=>p.locator(`[data-research-action="${key}"]`);
const openMenu=p=>p.locator('#gb-hl-manage').tap();
const open=async p=>{await p.locator('#gb-hl-fab').tap();await p.locator('#gb-hl-manage').waitFor();};
const confirm=async p=>{await action(p,'confirm-import').tap();await p.locator('#gb-hl-import-confirm').waitFor({state:'hidden'});};
const textA='Контрольная заметка А о первоисточнике.',textB='Новая заметка Б о прочитанном.';
const card=(p,text)=>p.locator('.gb-hl-item').filter({hasText:text});
const draft=async(p,text)=>{await p.locator('#gb-hl-new-note').tap();await p.locator('#gb-hl-note-text').fill(text);};
const submit=p=>p.locator('#gb-hl-editor [type=submit]').tap();
const cnew=()=>b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true,reducedMotion:'reduce',serviceWorkers:'block'});
async function page(c,s){
 const p=await c.newPage();await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+route)).status(),200);
 await p.waitForFunction(()=>window.GBReaderLibrary);return p;
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const total of [499,500]){
  const s={total,errors:[]};report.scenes.push(s);const c=await cnew();
  try{
   const a=await page(c,s),side=await page(c,s);await open(side);await draft(side,textB);
   await a.bringToFront();await open(a);await draft(a,textA);await submit(a);await card(a,textA).waitFor();
   const target=(await state(a))[0];assert.equal(target.text,textA);
   const extras=Array.from({length:total-1},(_,i)=>({id:`capacity-fixture-${i}`,text:`Запись для заполнения ${i+1}`,articleTitle:'Фон',url:route,savedAt:1700000000000+i}));
   await openMenu(a);await choose(a,payload(extras));await confirm(a);await openMenu(a);
   assert.equal((await state(a)).length,total);
   await card(a,textA).locator('[data-library-action=delete]').tap();assert.equal((await state(a)).length,total-1);
   const undo=a.locator('[data-library-action=undo]');await undo.waitFor();
   await side.bringToFront();await submit(side);await side.locator('#gb-hl-editor').waitFor({state:'hidden'});
   const filled=await state(side);assert.equal(filled.length,total);assert.ok(filled.some(x=>x.text===textB));assert.ok(!filled.some(x=>x.text===textA));
   await a.bringToFront();await undo.tap();s.undoStatus=await status(a);const recovered=await state(a);
   s.afterUndo={count:recovered.length,A:recovered.find(x=>x.id===target.id)||null,B:recovered.find(x=>x.text===textB)||null};
   await a.reload();await a.waitForFunction(()=>window.GBReaderLibrary);const persisted=await state(a);assert.deepEqual(persisted,recovered);
   await open(a);await openMenu(a);const [dl]=await Promise.all([a.waitForEvent('download'),action(a,'export-json').tap()]);
   const raw=await readFile(await dl.path());s.exported={bytes:raw.length,notes:JSON.parse(raw.toString()).data.notes.length};
   const receiver=await cnew();try{
    const r=await page(receiver,s);await open(r);await openMenu(r);await choose(r,raw);
    await r.waitForFunction(()=>!document.querySelector('#gb-hl-import-confirm').hidden||document.querySelector('#gb-hl-status').classList.contains('is-visible'));
    s.confirm=await r.locator('#gb-hl-import-confirm').isVisible();if(s.confirm)await confirm(r);
    s.restored={count:(await state(r)).length,status:await status(r)};
    await r.screenshot({path:`${out}/notes-start-${total}.png`});
   }finally{await receiver.close();}
   if(total===499){assert.equal(s.restored.count,500);assert.ok(s.afterUndo.A&&s.afterUndo.B);}
   assert.deepEqual(s.errors,[]);
  }catch(e){s.probeError=String(e);console.error('notes',total,e);process.exitCode=1;}finally{await c.close();}
 }
}finally{await writeFile(`${out}/note-capacity.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
