import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readdir,writeFile,access} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha=process.env.QA_SHA||'615eff9af809177b30612f93a77cecc053c3836b',root=process.env.QA_ROOT||'/tmp/mobile-615eff9a';
const out=process.env.QA_OUT||'reports/reader-favorite-undo-qa',port=Number(process.env.QA_PORT||19144),origin=`http://127.0.0.1:${port}`;
const primary='/articles/dzhon-gill-chast-2-uchenyi',newPage='/articles/dzhon-gill-chast-4-ekzeget';
const paths=[];
for(const entry of (await readdir(`${root}/dist/articles`,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
 const path='/articles/'+entry.name;if(!entry.isDirectory()||[primary,newPage].includes(path))continue;
 try{await access(`${root}/dist${path}/index.html`);paths.push(path);}catch{}
}
assert.ok(paths.length>=49,'actual built article routes');
await mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const save=p=>p.locator('.mobile-top-save');
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gb-favorites')||'[]').map(({path,addedAt,title})=>({path,addedAt,title})));
const pathset=items=>items.map(x=>x.path).sort();
const status=p=>p.locator('#gb-hl-status').innerText();
const diff=(before,after)=>({removed:pathset(before).filter(x=>!after.some(y=>y.path===x)),added:pathset(after).filter(x=>!before.some(y=>y.path===x))});
async function scene(name,width,total,ordering){
 const s={name,width,height:width===320?568:844,total,ordering,errors:[]};report.scenes.push(s);
 const c=await b.newContext({viewport:{width,height:s.height},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=async path=>{const p=await c.newPage();p.on('pageerror',e=>s.errors.push(String(e)));p.setDefaultTimeout(6500);assert.equal((await p.goto(`${origin}${path}/`)).status(),200);await p.waitForFunction(()=>window.GBFavoriteStore&&window.GBReaderLibrary);return p;};
  const a=await page(primary),side=await page(newPage);await a.bringToFront();
  await save(a).tap();const saved=(await state(a))[0];assert.equal(saved.path,primary);assert.equal(await save(a).getAttribute('aria-pressed'),'true');
  await a.locator('#gb-hl-fab').tap();await a.locator('#gb-hl-manage').tap();
  // Only the other saved items are a fixture; the paths are real. Import them via UI, keeping the tested page a real save.
  const favorites=paths.slice(0,total-1).map((path,i)=>({path,title:'Фоновая статья '+String(i+1).padStart(2,'0'),addedAt:saved.addedAt+(ordering==='oldest'?1:-1)*(i+1)}));
  const payload={format:'gospod-bog-reader-library',version:3,data:{quotes:[],notes:[],favorites}};
  await a.locator('#gb-hl-json-file').setInputFiles({name:'capacity-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await a.locator('[data-research-action=confirm-import]').tap();await a.locator('#gb-hl-import-confirm').waitFor({state:'hidden'});await a.locator('#gb-hl-manage').tap();
  s.before=await state(a);assert.equal(s.before.length,total);assert.equal(s.before[ordering==='oldest'?total-1:0].path,primary);
  await a.locator('[data-library-tab=favorite]').tap();
  await a.locator('#gb-hl-source').selectOption(saved.title);
  const target=a.locator(`.gb-hl-item[data-id="${primary}"]`);const undo=a.locator('[data-library-action=undo-favorite]');
  await target.locator('[data-library-action=remove-favorite]').tap();
  s.removed=await state(a);s.removeStatus=await status(a);assert.equal(s.removed.length,total-1);assert.ok(!s.removed.some(x=>x.path===primary));
  await undo.waitFor();const started=Date.now();
  await side.bringToFront();await save(side).tap();assert.equal(await save(side).getAttribute('aria-pressed'),'true');
  s.refilled=await state(side);assert.equal(s.refilled.length,total);assert.ok(s.refilled.some(x=>x.path===newPage));
  await a.bringToFront();await undo.tap();s.elapsedAfterRemoveMs=Date.now()-started;
  s.undoStatus=await status(a);s.after=await state(a);s.change=diff(s.refilled,s.after);
  s.targetToggle=await save(a).getAttribute('aria-pressed');
  if(s.targetToggle==='true')await a.locator('#gb-hl-source').selectOption(saved.title);
  s.targetVisible=await target.isVisible();
  await a.screenshot({path:`${out}/${name}.png`});
  await a.reload();await a.waitForFunction(()=>window.GBFavoriteStore);s.reload=await state(a);assert.deepEqual(pathset(s.reload),pathset(s.after));
  assert.deepEqual(s.errors,[]);
  if(total===49){assert.ok(s.targetVisible);assert.deepEqual(s.change,{removed:[],added:[primary]});}
 }catch(e){s.probeError=String(e);console.error(name,e);process.exitCode=1;}finally{await c.close();}
}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const width of (process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:[390]))for(const [name,total,ordering] of [['room-control',49,'oldest'],['full-restore-oldest',50,'oldest'],['full-restore-newer',50,'newer']])await scene(name,width,total,ordering);
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
