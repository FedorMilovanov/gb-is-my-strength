import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const root=path.resolve(process.env.MOBILE_ROOT||'/tmp/mobile-bfc427e'),sha=process.env.MOBILE_SHA||'bfc427eb55d89dfa3c3bfed4443b39109aa49dbe';
const {loadBibleRegistry,parseBibleReference}=await import(pathToFileURL(`${root}/src/lib/bible-reference-core.mjs`));
const registry=loadBibleRegistry(root);
const key=s=>{const x=parseBibleReference(s.replace(/\s*↗$/u,''),registry);return x.ok?`${x.bookId}:${x.key}`:null;};
const index=JSON.parse(await readFile(root+'/dist/data/scripture-search-index.json','utf8'));
const out=process.env.MOBILE_OUT||'reports/analytics-scripture-qa';await mkdir(out,{recursive:true});
const port=19121,origin=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const width=Number(process.env.MOBILE_WIDTH||390),height=width===320?568:844;
const report={sha,width,height,browser:b.version(),scenes:[]};
const docs=[['gill-exegete','/articles/dzhon-gill-chast-4-ekzeget/',['sec-exegete-intro','sec-seven-texts','sec-method']],['gill-scholar','/articles/dzhon-gill-chast-2-uchenyi/',['part-controversy','part-works']],['bapt','/baptisty-rossii/goneniya-i-sovest/',['ogpu-1923']],['gill-man','/articles/dzhon-gill-chast-1-chelovek/',[]],['gill-legacy','/articles/dzhon-gill-chast-3-nasledie/',[]]];
const scripture=p=>p.locator('details.gbr-marginalia-group').filter({has:p.getByText('Писание',{exact:true})});
async function open(p){await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();await p.locator('#gbrMarginalia:not([hidden])').waitFor();await p.waitForTimeout(360);}
async function seek(p,id){const el=p.locator('#'+id);await el.evaluate(n=>window.scrollBy({top:n.getBoundingClientRect().top-112,behavior:'instant'}));await p.waitForTimeout(380);}
try{
 await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4000))]);
 for(const [doc,route,wanted] of docs.filter(([doc])=>!process.env.ONLY_DOC||doc===process.env.ONLY_DOC)){
  const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});const s={doc,route,errors:[],sections:[]};report.scenes.push(s);
  try{
   await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   await c.addInitScript(()=>{window.analyticsJump=null;const f=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){if(this.closest('article'))window.analyticsJump={id:this.id||this.closest('p,[id]')?.id||null,tag:this.tagName,source:this.textContent.replace(/\s+/g,' ').trim().slice(0,650),ref:this.dataset.ref||null};return f.apply(this,args);};});
   const p=await c.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>s.errors.push(String(e)));assert.equal((await p.goto(origin+route)).status(),200);await p.waitForFunction(()=>window.GBReaderState&&window.OverlayRuntime);await p.evaluate(()=>document.fonts.ready);
   s.heads=await p.locator('article.article-body h2[id]').evaluateAll(nodes=>nodes.map(n=>[n.id,n.innerText]));
   for(const [id,title] of s.heads.filter(([id])=>!wanted.length||wanted.includes(id))){
    const q={id,title};s.sections.push(q);await seek(p,id);
    q.source=await p.evaluate(id=>{
     const a=document.getElementById(id),article=a.closest('article'),hs=[...article.querySelectorAll('h2[id]')],z=hs[hs.indexOf(a)+1];
     const within=e=>(a.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)&&(!z||(e.compareDocumentPosition(z)&Node.DOCUMENT_POSITION_FOLLOWING));
     const selectors='p,blockquote,li,.manuscript-quote-text,td,h3,h4';
     return [...article.querySelectorAll(selectors)].filter(e=>within(e)&&!e.closest('aside,nav,footer')&&!e.querySelector(selectors)).map(e=>{
      const n=e.cloneNode(true);n.querySelectorAll('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden=true],.fn-marker,.footnote-ref').forEach(k=>k.remove());
      return {id:e.id||null,tag:e.tagName,cls:e.className,text:n.textContent.replace(/\s+/g,' ').trim(),marked:[...e.querySelectorAll('button.bref[data-ref]')].map(x=>x.dataset.ref)};
     }).filter(e=>/\d\s*:\s*\d/u.test(e.text)||e.marked.length);
    },id);
    await open(p);
    q.ui=await p.evaluate(()=>({title:document.querySelector('.gbr-marginalia-lead h3').textContent,scope:document.querySelector('.gbr-marginalia-chips')?.parentElement.querySelector('.gbr-marginalia-empty')?.textContent||null,labels:[...document.querySelectorAll('.gbr-marginalia-chips button')].map(e=>e.textContent),owner:window.OverlayRuntime.topLayer()?.ownerId}));
    const scopeIds=new Set([id,...q.source.filter(x=>['H3','H4'].includes(x.tag)).map(x=>x.id)]);
    q.index=index.references.flatMap(r=>{const anchors=[...new Set(r.occurrences.filter(o=>o.url===route&&scopeIds.has(o.anchor)).map(o=>o.anchor))];return anchors.length?[[r.id,r.label,anchors]]:[];});
    q.missingIndexed=q.index.filter(([x])=>!q.ui.labels.map(key).includes(x));
    q.keys=q.ui.labels.map(key);q.sameKeys=Object.entries(Object.groupBy(q.ui.labels,v=>key(v)||`unparsed:${v}`)).filter(([,f])=>f.length>1);
    const chosen=id==='sec-seven-texts'?['Ин 1:29']:id==='ogpu-1923'?['Рим. 13:1–5']:['sec-method','part-legacy'].includes(id)?q.sameKeys[0]?.[1]||[]:[];
    q.targets=[];
    if(await scripture(p).count()){
     await scripture(p).locator(':scope > summary').tap();
     if(['sec-seven-texts','sec-method','ogpu-1923','part-legacy'].includes(id))await p.screenshot({path:`${out}/${doc}-${id}.png`});
    }
    for(const label of chosen.filter(x=>q.ui.labels.includes(x))){
     if(q.targets.length){await seek(p,id);await open(p);await scripture(p).locator(':scope > summary').tap();}
     await scripture(p).getByRole('button',{name:label,exact:true}).tap();await p.waitForTimeout(1750);
     q.targets.push({label,...await p.evaluate(()=>({jump:window.analyticsJump,locked:document.documentElement.hasAttribute('data-scroll-locked'),owner:window.OverlayRuntime.topLayer()?.ownerId||null,focus:document.activeElement.id||document.activeElement.tagName}))});
    }
    if(!q.targets.length){await p.keyboard.press('Escape');await p.waitForTimeout(380);}
   }
  }catch(e){s.probeError=String(e);console.error(doc,e);process.exitCode=1;}finally{await c.close();}
 }
}finally{await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));server.kill();await b.close();}
