import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const out='reports/analytics-handoff-qa/touch';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const builds=[['4accceeef1f01e0cc19bb0fe4f807e49758a2892','/tmp/mobile-4acccee',19114],['bfc427eb55d89dfa3c3bfed4443b39109aa49dbe','/tmp/mobile-bfc427e',19115]];
const route='/articles/dzhon-gill-chast-2-uchenyi/';const report={browser:b.version(),scenes:[]};
const selectors={mark:'#gb-hl-selbar [data-hl-color=amber]',quote:'#gb-hl-selbar-quote',note:'#gb-hl-selbar-note'};
const snap=p=>p.evaluate(()=>{const t=document.querySelector('#gb-hl-toast'),r=t?.getBoundingClientRect(),panel=document.querySelector('#gb-hl-panel'),target=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{quotes:window.GBReaderLibrary.getAll().map(q=>({text:q.text,kind:q.kind,color:q.color})),notes:window.GBReaderLibrary.getNotes().map(n=>({text:n.text,quoteText:n.quoteText})),editor:!document.querySelector('#gb-hl-editor').hidden,editorText:document.querySelector('#gb-hl-note-context').textContent,library:panel.parentElement.classList.contains('is-open'),toast:t?.textContent||null,toastReceivesHit:!!t&&t.contains(target),trace:window.events.slice()};});
try{for(const [sha,root,port] of builds){
 const origin=`http://127.0.0.1:${port}`;const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
 try{
  await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
  for(const action of Object.keys(selectors)){
   const s={sha,action,width:390,height:844,errors:[]};report.scenes.push(s);const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
   try{
    await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await c.addInitScript(()=>{window.events=[];for(const name of ['pointerdown','touchstart','touchend','click'])document.addEventListener(name,e=>{const b=e.target.closest('#gb-hl-selbar button');if(b)window.events.push({type:name,id:b.id||b.dataset.hlColor,trusted:e.isTrusted});},{capture:true,passive:true});});
    const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>s.errors.push(String(e)));await p.goto(origin+route);await p.waitForFunction(()=>window.GBReaderLibrary&&document.querySelector('article p[id^="gill-search-p-"]'));await p.evaluate(()=>document.fonts.ready);
    const phrase='Гилл стал пастором';s.prepared=await p.evaluate(phrase=>{let node;for(const el of document.querySelectorAll('article.article-body p')){node=[...el.childNodes].find(n=>n.nodeType===3&&n.nodeValue.includes(phrase));if(node)break;}if(!node)return null;node.parentElement.scrollIntoView({behavior:'instant',block:'center'});window.qaSel={node,phrase};return node.parentElement.id;},phrase);assert.ok(s.prepared);
    await p.waitForTimeout(440);await p.evaluate(()=>{const {node,phrase}=window.qaSel,r=new Range(),start=node.nodeValue.indexOf(phrase);r.setStart(node,start);r.setEnd(node,start+phrase.length);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);});
    const button=p.locator(selectors[action]);await button.waitFor();await button.tap();await p.waitForTimeout(450);s.after=await snap(p);
    if(action==='note'&&s.after.editor){
     await p.locator('#gb-hl-note-text').fill('QA: заметка из тулбара');await p.locator('#gb-hl-editor [type=submit]').tap();await p.locator('#gb-hl-editor').waitFor({state:'hidden'});s.saved=await snap(p);
     await p.keyboard.press('Escape');await p.waitForTimeout(520);await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();const g=p.locator('details.gbr-marginalia-group').filter({has:p.getByText('Мои пометы',{exact:true})});await g.locator('summary').tap();s.visibleInAnalytics=await g.getByText('QA: заметка из тулбара',{exact:true}).isVisible();
    }
   }catch(e){s.probeError=String(e);console.error(sha,action,e);process.exitCode=1;}finally{await c.close();}
  }
 }finally{server.kill();await writeFile(`${out}/selection.json`,JSON.stringify(report,null,2));}
}}finally{await b.close();}
