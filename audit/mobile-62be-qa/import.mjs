import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha='62be8caa145fbe18aa099dff89cffa20cd626451',root=process.env.MOBILE_ROOT||'/tmp/mobile-62be8caa';
const port=19096,origin=`http://127.0.0.1:${port}`,route='/articles/dzhon-gill-chast-2-uchenyi/',out='reports/mobile-62be-qa';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const report={sha,browser:b.version(),pageErrors:[]};
const v=id=>({id,text:'вечном завете',url:origin+route+'#'+(id==='A'?'gill-search-p-059':'gill-search-p-068'),before:'Контекст '+id+' ',after:' после '+id,articleTitle:'Гилл II',savedAt:1700000000000});
const payload=(name,quotes=[],notes=[])=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'gospod-bog-reader-library',version:3,data:{quotes,notes,favorites:[]}}))});
const store=p=>p.evaluate(()=>({quotes:JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]'),notes:JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]')}));
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server exited '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{const real=File.prototype.text;File.prototype.text=function(){return this.name==='delayed.json'?new Promise((resolve,reject)=>{window.releaseImport=()=>real.call(this).then(resolve,reject);}):real.call(this);};});
  const p=await c.newPage();p.on('pageerror',e=>report.pageErrors.push(String(e)));p.setDefaultTimeout(7000);
  await p.goto(origin+route);await p.locator('#gb-hl-fab').tap();
  const menu=p.locator('#gb-hl-manage'),file=p.locator('#gb-hl-json-file'),confirm=p.locator('[data-research-action=confirm-import]'), box=p.locator('#gb-hl-import-confirm');
  await menu.tap();
  const add=async x=>{await file.setInputFiles(x);await confirm.tap();await box.waitFor({state:'hidden'});};
  await add(payload('legacy.json',[v('A'),v('B')],[{id:'legacy-note',quoteId:'B',text:'Заметка к B',url:v('B').url,quoteText:v('B').text}]));
 report.legacyImport=await store(p);
 report.legacySuccess=await p.locator('#gb-hl-status').textContent();
 await p.evaluate(()=>{localStorage.removeItem('gb-highlights-v1');localStorage.removeItem('gb-reader-notes-v1');});
 const canonical=(id,index)=>({...v(id),annotation:{version:1,anchor:{blockId:'gill-search-p-'+index,blockIndex:index,start:12,end:25,exact:'вечном завете'}}});
 await add(payload('initial.json',[canonical('A',59),canonical('B',68)]));
  report.imported=await store(p);assert.deepEqual(report.imported.quotes.map(q=>q.id).sort(),['A','B']);
  await menu.tap(); // close management controls to expose the cards
  const row=p.locator('.gb-hl-item[data-id=A]');
  await row.locator('[data-library-action=note-for-quote]').tap();
  await p.locator('#gb-hl-note-text').fill('Заметка принадлежит только A');await p.locator('#gb-hl-editor [type=submit]').tap();await p.locator('#gb-hl-editor').waitFor({state:'hidden'});
  report.afterNote=await store(p);assert.equal(report.afterNote.notes[0].quoteId,'A');
  await menu.tap();
  const downloaded=p.waitForEvent('download');await p.locator('[data-research-action=export-json]').tap();const download=await downloaded;
  const buffer=await readFile(await download.path());report.exported=JSON.parse(buffer.toString()).data;
  await add({name:'actual-export.json',mimeType:'application/json',buffer});report.afterRepeat=await store(p);
  assert.deepEqual(report.afterRepeat.quotes.map(q=>q.id).sort(),['A','B']);assert.equal(report.afterRepeat.notes[0].quoteId,'A');
  await file.setInputFiles(payload('delayed.json',[canonical('DELAYED',71)]));await p.waitForFunction(()=>window.releaseImport);
  await file.setInputFiles(payload('newer.json',[canonical('NEW-1',72),canonical('NEW-2',73)]));await box.waitFor();
  await p.evaluate(()=>window.releaseImport());await p.waitForTimeout(180);report.afterLateA=await box.innerText();
  await confirm.tap();await box.waitFor({state:'hidden'});report.afterRace=await store(p);
  assert.deepEqual(report.afterRace.quotes.map(q=>q.id).sort(),['A','B','NEW-1','NEW-2']);
  await p.evaluate(()=>{window.releaseImport=null;});
  await file.setInputFiles(payload('delayed.json',[canonical('ESCAPED',74)]));await p.waitForFunction(()=>window.releaseImport);
  await p.keyboard.press('Escape');await p.evaluate(()=>window.releaseImport());await p.waitForTimeout(250);
  report.escape={boxVisible:await box.isVisible(),rows:await store(p)};
  assert.equal(report.escape.boxVisible,false);assert.deepEqual(report.pageErrors,[]);
 }finally{await c.close();}
}finally{await writeFile(out+'/import.json',JSON.stringify(report,null,2));server.kill();await b.close();}
