import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const sha='366f54cff2b04aaf3e125c6fb2e688734a1afe3c',root=process.env.MARKS_ROOT||'/tmp/w64-marks-366f54c';
const port=19093,origin=`http://127.0.0.1:${port}`,out='reports/w64-qa/marks';await mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={sha,browser:browser.version(),scenes:[]};
const article='/articles/dzhon-gill-chast-2-uchenyi/';
const other='/articles/dzhon-gill-chast-4-ekzeget/';
const color='#gb-hl-selbar [data-hl-color=amber]';
const snap=p=>p.evaluate(()=>({path:location.pathname,rows:JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]'),marks:[...(CSS.highlights.get('gb-hl-amber')||[])].map(r=>({text:r.toString(),start:r.startContainer.parentElement.closest('[id]')?.id,end:r.endContainer.parentElement.closest('[id]')?.id})),events:window.ev.slice()}));
try{
 await Promise.race([new Promise((res,rej)=>{server.stdout.once('data',res);server.once('exit',n=>rej(Error('server '+n)));}),new Promise((_,rej)=>setTimeout(()=>rej(Error('listen timeout')),4000))]);
 for(const mode of ['touch','mouse']){
  const s={mode,errors:[]};report.scenes.push(s);
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   await c.addInitScript(()=>{window.ev=[];for(const t of ['pointerdown','pointerup','touchstart','touchend','click'])addEventListener(t,e=>{if(e.target.closest('#gb-hl-selbar'))window.ev.push({t,trusted:e.isTrusted,id:e.target.dataset.hlColor||e.target.id});},{capture:true,passive:true});});
   const p=await c.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));
   await p.goto(origin+article);await p.waitForFunction(()=>document.querySelector('#gb-hl-fab')&&window.GBHighlights);await p.evaluate(()=>document.fonts.ready);
   // Select an unchanged article phrase which has real surrounding context on both sides.
   s.selected=await p.evaluate(()=>{
    const p=document.getElementById('gill-search-p-068');p.scrollIntoView({block:'center',behavior:'instant'});
    const node=[...p.childNodes].find(n=>n.nodeType===3&&n.length>100);if(!node)throw Error('no candidate text node');
    const words=[...node.textContent.matchAll(/\S+/g)];const a=words[4].index,b=words[5].index+words[5][0].length;
    window.testMark={node,a,b};return node.textContent.slice(a,b);
   });
   await p.waitForTimeout(360);
   await p.evaluate(()=>{const {node,a,b}=window.testMark,r=document.createRange();r.setStart(node,a);r.setEnd(node,b);const s=getSelection();s.removeAllRanges();s.addRange(r);});
   await p.locator('#gb-hl-selbar[data-open=true]').waitFor();
   const r=await p.locator(color).boundingBox();assert.ok(r);const x=r.x+r.width/2,y=r.y+r.height/2;
   s.hit=await p.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('button')?.dataset.hlColor,[x,y]);assert.equal(s.hit,'amber');
   await (mode==='touch'?p.touchscreen.tap(x,y):p.mouse.click(x,y));await p.waitForTimeout(360);
   s.result=await snap(p);
   if(s.result.rows.length){
    assert.equal(s.result.rows[0].text,s.selected);assert.ok(s.result.rows[0].before&&s.result.rows[0].after);
    await p.evaluate(()=>{getSelection().removeAllRanges();});
    await p.screenshot({path:`${out}/01-overpaint.png`});
    await p.reload();await p.waitForFunction(()=>CSS.highlights.get('gb-hl-amber')?.size>0);
    s.reloaded=await snap(p);
   }
   // Separate witness for wrong document scope: only the source URL differs.
   // Find a phrase that really appears on both unchanged pages.
   if(mode==='mouse'){
    const source='/articles/dzhon-gill-chast-2-uchenyi/';
    const phrase=await p.evaluate(async({source,other})=>{
     const html=await(await fetch(other)).text();const next=new DOMParser().parseFromString(html,'text/html');
     const paragraphs=d=>[...d.querySelectorAll('article.article-body p')].map(n=>({txt:n.textContent.replace(/\s+/g,' ').trim(),id:n.id}));
     const a=paragraphs(document),b=paragraphs(next).map(x=>x.txt.toLowerCase());
     for(const row of a){const terms=row.txt.split(' ');for(let i=1;i+1<terms.length;i++){
      const phrase=terms.slice(i,i+2).join(' ');if(row.id&&phrase.length>=10&&b.some(x=>x.includes(phrase.toLowerCase())))return{phrase,id:row.id,source};
     }}return null;
    },{source,other});
    assert.ok(phrase,'unchanged duplicate phrase missing');s.shared=phrase;
    await p.evaluate(({phrase,id,source})=>{
     localStorage.setItem('gb-highlights-v1',JSON.stringify([{id:'scope-witness',kind:'marker',color:'amber',text:phrase,url:location.origin+source+'#'+id,before:'',after:'',savedAt:Date.now()}]));
    },phrase);
    await p.goto(origin+other);await p.waitForFunction(()=>window.GBHighlights&&document.querySelector('#gb-hl-fab'));await p.waitForTimeout(1300);
    s.wrongDocument=await snap(p);
   }
  }finally{await c.close();}
 }
 const s={mode:'two-tabs-undo',errors:[]};report.scenes.push(s);
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{window.ev=[];});
  const a=await c.newPage(),b=await c.newPage();
  for(const tab of [a,b]){tab.setDefaultTimeout(5000);tab.on('pageerror',e=>s.errors.push(String(e)));}
  await Promise.all([a.goto(origin+article),b.goto(origin+article)]);
  for(const [tab,idx] of [[a,4],[b,11]]){
   await tab.evaluate(()=>document.fonts.ready);
   await tab.locator('#gill-search-p-068').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
   await tab.waitForTimeout(650);
   await tab.evaluate(i=>{
    const node=[...document.getElementById('gill-search-p-068').childNodes].find(n=>n.nodeType===3&&n.length>100);
    const words=[...node.textContent.matchAll(/\S+/g)];const r=document.createRange();r.setStart(node,words[i].index);r.setEnd(node,words[i+1].index+words[i+1][0].length);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
   },idx);
  }
  await a.locator(color).click();
  s.afterA=(await snap(a)).rows.map(x=>x.text);assert.equal(s.afterA.length,1);
  await b.locator(color).click();
  s.afterB=(await snap(b)).rows.map(x=>x.text);assert.equal(s.afterB.length,2);
  await a.getByRole('button',{name:'Вернуть',exact:true}).click();
  s.afterUndoA=(await snap(a)).rows.map(x=>x.text);
  await b.reload();await b.waitForFunction(()=>window.GBHighlights);s.afterReloadB=(await snap(b)).rows.map(x=>x.text);
 }finally{await c.close();}
}finally{await writeFile(out+'/evidence.json',JSON.stringify(report,null,2));server.kill();await browser.close();}
