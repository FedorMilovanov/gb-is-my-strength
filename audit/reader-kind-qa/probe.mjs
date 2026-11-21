import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const root=process.env.QA_ROOT||'/tmp/mobile-a595629f',sha=process.env.QA_SHA||'a595629f15a2324205cbb9b1c2cb2cc936814214',out=process.env.QA_OUT||'reports/reader-kind-qa';
const port=19128,origin=`http://127.0.0.1:${port}`;
const route='/articles/dzhon-gill-chast-2-uchenyi/',phrase='Гилл стал пастором';
const server=spawn('python3',['-u',`${root}/research/reader-w57-pilot/preview.py`],{env:{...process.env,READER_W57_DIST:root+'/dist',READER_W57_PORT:String(port)},stdio:['ignore','pipe','ignore']});
await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:b.version(),scenes:[]};
const wait=(p,ms=400)=>p.waitForTimeout(ms);
const snap=p=>p.evaluate(()=>{
 const all=window.GBReaderLibrary.getAll();const records=all.map(r=>({id:r.id,kind:r.kind??null,color:r.color??null,annotation:r.annotation??null,text:r.text,source:r.url}));
 const inArticle=r=>[r.startContainer.parentElement?.closest('p,li,blockquote')?.id,r.startOffset,r.endOffset,r.toString()];
 const layers=[...CSS.highlights].filter(([name])=>/^(gb-hl-|np-w57-)/.test(name)).map(([name,group])=>({name,ranges:[...group].map(inArticle)}));
 return {records,layers,y:scrollY,width:innerWidth,pilot:!!window.__NP_W57_ANNOTATIONS__?.ready,articleRange:all[0]&&window.GBReaderLibrary.resolveRange(all[0])?inArticle(window.GBReaderLibrary.resolveRange(all[0])):null};
});
const visuals=p=>p.evaluate(()=>{const t=document.querySelector('#gb-hl-toast'),a=t?.querySelector('.gb-hl-toast-action'),r=a?.getBoundingClientRect();if(!r)return {open:false};const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {open:t.dataset.open==='true',message:t.querySelector('.gb-hl-toast-text').textContent,rect:[r.x,r.y,r.width,r.height],hit:a===hit||a.contains(hit),focus:document.activeElement?.id,view:[innerWidth,innerHeight]};});
async function load(p,desktop){
 assert.equal((await p.goto(origin+route+(desktop?'?reader-pilot=1&paper=space':''))).status(),200);
 await p.waitForFunction(desktop=>window.GBReaderLibrary&&(!desktop||window.__NP_W57_ANNOTATIONS__?.ready),desktop);
 await p.evaluate(()=>document.fonts.ready);await wait(p,460);
}
async function position(p){const s=await p.evaluate(phrase=>{
 for(const el of document.querySelectorAll('article.article-body p')){
  const node=[...el.childNodes].find(n=>n.nodeType===3&&n.nodeValue.includes(phrase));if(!node)continue;
  el.scrollIntoView({block:'center',behavior:'instant'});
  window.qa={node,i:node.nodeValue.indexOf(phrase),n:phrase.length};return el.id;
 }
},phrase);assert.ok(s);await wait(p,420);return s;}
async function select(p,mouse=false){
 await position(p);const coords=await p.evaluate(mouse=>{
  const {node,i,n}=window.qa,r=new Range();
  if(!mouse){r.setStart(node,i);r.setEnd(node,i+n);getSelection().removeAllRanges();getSelection().addRange(r);return null;}
  return [i,i+n-1].map((at,idx)=>{r.setStart(node,at);r.setEnd(node,at+1);const b=r.getBoundingClientRect();return [idx?b.right-.1:b.left+1,b.y+b.height/2];});
 },mouse);
 if(coords){await p.mouse.move(...coords[0]);await p.mouse.down();await p.mouse.move(...coords[1],{steps:18});await p.mouse.up();}
 assert.equal(await p.evaluate(()=>getSelection().toString()),phrase);
}
async function context(width,height,touch,fn){
 const c=await b.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce',serviceWorkers:'block'});
 try{await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await fn(c);}finally{await c.close();}
}
function watch(s,p){p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const kind of ['marker','underline','quote'])await context(1440,900,false,async c=>{
  const a=await c.newPage(),m=await c.newPage(),s={kind,errors:[]};report.scenes.push(s);watch(s,a);watch(s,m);
  try{
   await m.setViewportSize({width:390,height:844});await load(m,false);assert.equal((await snap(m)).records.length,0);
   await load(a,true);await select(a,true);await a.locator(`#npW57SelectionToolbar [data-w57-action=${kind}]`).click();await wait(a,620);
   s.desktop=await snap(a);assert.equal(s.desktop.records.length,1);assert.equal(s.desktop.records[0].annotation.kind,kind);
   s.mobileLive=await snap(m);await load(m,false);await position(m);s.mobileReload=await snap(m);assert.equal(s.mobileReload.records[0].id,s.desktop.records[0].id);assert.deepEqual(s.mobileReload.articleRange,s.desktop.articleRange);
   if(kind!=='marker')await m.screenshot({path:`${out}/mobile-${kind}.png`});
   await m.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await wait(m);
   await m.locator('.mobile-top-bar [data-gill-marginalia-open]').click();const group=m.locator('#gbrMarginalia details').filter({has:m.getByText('Мои пометы',{exact:true})});await group.locator(':scope > summary').click();
   s.analytics=await group.locator('.gbr-marginalia-personal').allTextContents();
   await load(a,true);s.desktopAgain=await snap(a);assert.equal(s.desktopAgain.records[0].annotation.kind,kind);assert.deepEqual(s.errors,[]);
  }catch(e){s.probeError=String(e);console.error(kind,e);process.exitCode=1;}
 });
 for(const [width,height] of [[320,568],[568,320],[390,844]])await context(width,height,true,async c=>{
  const p=await c.newPage(),s={kind:'mobile-toast-undo',width,height,errors:[]};report.scenes.push(s);watch(s,p);
  try{
   await load(p,false);await select(p);await p.locator('#gb-hl-selbar [data-hl-color=amber]').tap();
   s.toast=await visuals(p);s.saved=await snap(p);assert.equal(s.saved.records.length,1);
   if(s.toast.open&&s.toast.hit){await p.locator('#gb-hl-toast .gb-hl-toast-action').tap();s.afterUndo=await snap(p);s.afterToast=await visuals(p);await load(p,false);s.afterReload=await snap(p);}
   else await p.screenshot({path:`${out}/toast-${width}.png`});
  }catch(e){s.probeError=String(e);console.error(width,e);process.exitCode=1;}
 });
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
