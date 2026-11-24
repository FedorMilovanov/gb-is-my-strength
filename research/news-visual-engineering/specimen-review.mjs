import { build } from 'astro';
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import {waitForCanonicalFonts} from './wait-for-canonical-fonts.mjs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { cp, readFile, writeFile, mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const engines = {chromium,firefox,webkit};
const historyMode=process.argv.includes('--history-2018');
const requested = process.argv.slice(2).filter(arg=>arg!=='--history-2018');
const selected = requested.length ? requested : Object.keys(engines);
assert.ok(selected.every(name=>Object.hasOwn(engines,name)) && new Set(selected).size===selected.length,'Pass unique engine names: chromium firefox webkit');
const repo = fileURLToPath(new URL('../../', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'news-real-specimen-'));
const copy = async (from, to=from) => {
  await mkdir(dirname(join(root,to)),{recursive:true});
  await cp(join(repo,from),join(root,to),{recursive:true});
};
console.log('EVIDENCE_DIR='+root);
await symlink(join(repo,'node_modules'),join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
for (const path of ['src/components/journal/editorial','src/components/journal/JournalSourceReturn.astro','src/components/journal/journalEditorial.css','src/styles/editorial-edition.css','fonts']) await copy(path);
if(historyMode){
 await copy('research/news-visual-engineering/g3-hist-pub-13-specimen.json','src/history-evidence.json');
 await copy('research/news-visual-engineering/g3-hist-pub-13-specimen.astro.txt','src/pages/index.astro');
}
await copy('research/news-visual-engineering/g3-pub-018-specimen.json','src/specimen.json');
await copy('research/news-visual-engineering/g3-pub-018-specimen.astro.txt','src/pages/specimen.astro');
await mkdir(join(root,'src/components'),{recursive:true});
// The fixture is a component, not a published route.
await cp(join(root,'src/pages/specimen.astro'),join(root,'src/components/PrivateSpecimen.astro'));
await import('node:fs/promises').then(fs=>fs.unlink(join(root,'src/pages/specimen.astro')));
for(const variant of ['before','after','compact']) await writeFile(join(root,'src/pages',variant+'.astro'),`---\nimport PrivateSpecimen from '../components/PrivateSpecimen.astro';\n---\n<PrivateSpecimen variant="${variant}"/>\n`);
await writeFile(join(root,'package.json'),'{"type":"module","private":true}');
await build({root,cacheDir:join(root,'.astro-cache'),vite:{cacheDir:join(root,'.vite-cache')},telemetry:false});
const dist=resolve(root,'dist');
const mime={'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(dist,'.'+(path.endsWith('/')?path+'index.html':path));
    if (!file.startsWith(dist+sep)) throw Error('outside dist');
    const bytes=await readFile(file);
    res.setHeader('Content-Type',mime[extname(file)]??'text/html; charset=utf-8');res.end(bytes);
  } catch {res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const evidence=join(root,'evidence');await mkdir(evidence);
const specimen=JSON.parse(await readFile(join(root,'src/specimen.json'),'utf8'));
const results=[];
const verifyCompactLinkNames=async page=>{
 const links=page.locator('.jdc-links a');
 const expected=['Архив заявления','Воспроизведение заявления'];
 assert.equal(await links.count(),2);
 for(let i=0;i<expected.length;i++){
  const link=links.nth(i), label=expected[i];
  assert.equal((await link.innerText()).trim(),label);
  assert.ok((await link.getAttribute('aria-label')).startsWith(label+' · '));
  assert.equal(await page.getByRole('link',{name:new RegExp('^'+label+' · ')}).count(),1);
 }
};
const compactAcceptance=[];
const paperAcceptance=[];
if(historyMode){
 const history=JSON.parse(await readFile(join(root,'src/history-evidence.json'),'utf8'));
 try{
 for(const name of selected){
  const browser=await engines[name].launch({headless:true,timeout:30000});
  try{
  for(const width of [320,768,1440])for(const dark of [false,true])for(const js of [false,true]){
   const page=await browser.newPage({viewport:{width,height:950},javaScriptEnabled:js});
   try{
    page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
    assert.equal((await page.goto(url)).status(),200);
    if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
    await waitForCanonicalFonts(page);
    const witness=await page.evaluate(()=>({text:document.querySelector('.jhe-summary').textContent,boundary:document.querySelector('.jhe-boundary p').textContent,over:document.documentElement.scrollWidth>innerWidth,groups:[...document.querySelectorAll('.jhe-group')].map(g=>[...g.querySelectorAll('[data-source-id]')].map(n=>n.dataset.sourceId)),ids:[...document.querySelectorAll('[id]')].map(n=>n.id)}));
    assert.equal(witness.text,history.readerSafeText);assert.equal(witness.boundary,history.boundary);assert.equal(witness.over,false);assert.deepEqual(witness.groups,history.groups.map(g=>g.sourceIds));assert.equal(new Set(witness.ids).size,witness.ids.length);
    const links=page.locator('.jhe-group a');assert.equal(await links.count(),3);
    if(js)await page.waitForFunction(()=>document.querySelector('[data-journal-source-navigation]').dataset.journalSourceNavigationBound==='true');
    for(let i=0;i<3;i++){
     const link=links.nth(i),id=await link.getAttribute('id'),href=await link.getAttribute('href');
     assert.equal(await link.innerText(),history.sources[i].label);assert.ok((await link.getAttribute('aria-label')).startsWith(history.sources[i].label+' · '));
     await link.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,href);
     const back=page.locator(href+' [data-journal-source-return]');assert.equal(await back.getAttribute('href'),'#'+id);await back.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#'+id);
    }
    const sizes=()=>page.evaluate(()=>[...document.querySelectorAll('.jhe-summary,.jhe-boundary p,.jhe-group li p')].map(el=>parseFloat(getComputedStyle(el).fontSize)));
    const base=await sizes();await page.evaluate(()=>document.documentElement.style.setProperty('--gb-reader-font-scale','2'));assert.ok((await sizes()).every((s,i)=>Math.abs(s/base[i]-2)<.01));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));assert.deepEqual(await sizes(),base);
    if(!js){await page.goto(url);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await waitForCanonicalFonts(page);await page.screenshot({path:join(evidence,[name,width,dark?'dark':'light','history'].join('-')+'.png'),fullPage:true});}
    results.push({name,width,dark,js,citations:3});await writeFile(join(evidence,'history-results.json'),JSON.stringify(results,null,2));console.log('HISTORY_PASS '+JSON.stringify(results.at(-1)));
   }finally{await page.close();}
  }
  }finally{await browser.close();}
 }
 }finally{server.close();}
 assert.equal(results.length,12*selected.length);console.log('HISTORY_CASES='+results.length);
}else{
try{
 for(const name of selected){
  const browser=await engines[name].launch({headless:true,timeout:30000});
  try{
   for(const width of [320,390,768,1024,1440,1920])for(const dark of [false,true])for(const variant of ['before','after','compact']){
    const page=await browser.newPage({viewport:{width,height:950}});
    try{
     page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
     assert.equal((await page.goto(url+'/'+variant+'/')).status(),200);
     if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
     await waitForCanonicalFonts(page);
     const witness=await page.evaluate(()=>({text:document.querySelector('#buice').textContent,summary:document.querySelector('.jdx-passage p:not(.jdx-locator)')?.textContent??document.querySelector('[data-publication-claims]').textContent,over:document.documentElement.scrollWidth>innerWidth,ids:[...document.querySelectorAll('[id]')].map(el=>el.id),opening:Math.round(document.querySelector('#buice').getBoundingClientRect().height),textStart:Math.round((document.querySelector('.jdx-passage p:not(.jdx-locator),[data-publication-claims]')).getBoundingClientRect().top+scrollY),links:[...document.querySelectorAll('#buice a[data-journal-citation]')].map(a=>({id:a.id,href:a.getAttribute('href')}))}));
     assert.equal(witness.summary,specimen.readerSafeText);assert.equal(witness.text.split(specimen.readerSafeText).length-1,1);assert.equal(witness.over,false);assert.equal(new Set(witness.ids).size,witness.ids.length);
     assert.equal(witness.links.length,variant==='before'?1:2);
     if(variant==='compact')await verifyCompactLinkNames(page);
     assert.ok(witness.links.every(l=>l.href==='#src-G3-S008'));
     assert.equal(await page.locator('#src-G3-S008 a[href^="https://"]').count(),2);
     for(const link of witness.links){
      const target=page.locator('[id='+JSON.stringify(link.id)+']');
      await target.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#src-G3-S008');
      const back=page.locator('#src-G3-S008 [data-journal-source-return]');assert.equal(await back.getAttribute('href'),'#'+link.id);
      await back.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#'+link.id);
     }
     await page.goto(url+'/'+variant+'/');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await waitForCanonicalFonts(page);
     const stem=[name,width,dark?'dark':'light',variant].join('-');
     await page.screenshot({path:join(evidence,stem+'-full.png'),fullPage:true});await page.screenshot({path:join(evidence,stem+'-viewport.png')});
     results.push({name,width,dark,variant,opening:witness.opening,textStart:witness.textStart,links:witness.links.length});await writeFile(join(evidence,'results.json'),JSON.stringify(results,null,2));console.log('CASE_PASS '+stem);
    }finally{await page.close();}
   }
   // The comparison matrix is JS-enabled; separately certify compact noJS
   // and Reader text preference without conflating it with browser zoom.
   for(const width of [320,390,768,1024,1440,1920])for(const dark of [false,true]){
    const page=await browser.newPage({viewport:{width,height:950},javaScriptEnabled:false});
    try{
     page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
     assert.equal((await page.goto(url+'/compact/')).status(),200);
     if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
     await waitForCanonicalFonts(page);
     const snapshot=()=>page.evaluate(()=>({
      summary:document.querySelector('.jdc-summary').textContent,
      annotation:document.querySelector('.jdc-note div:first-child dd').textContent,
      boundary:document.querySelector('.jdc-note div:last-child dd').textContent,
      dates:[...document.querySelectorAll('.jdc-dates time')].map(t=>t.getAttribute('datetime')),
      fields:document.querySelectorAll('.jdc-dates dt').length,
      over:document.documentElement.scrollWidth>innerWidth,
      fontSizes:[...document.querySelectorAll('.jdc-summary,.jdc-note dd')].map(el=>parseFloat(getComputedStyle(el).fontSize)),
      ids:[...document.querySelectorAll('[id]')].map(el=>el.id),
      targetSizes:[...document.querySelectorAll('.jdc-links a')].map(a=>a.getBoundingClientRect().height),
      family:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,''))
     }));
     const base=await snapshot();
     assert.equal(base.summary,specimen.readerSafeText);assert.equal(base.annotation,specimen.annotation);assert.equal(base.boundary,specimen.boundary);
     assert.equal(base.fields,5);assert.deepEqual(base.dates,['2025-05-12','2025-05-12','2025-05-12','2025-05-13']);
     assert.equal(base.over,false);assert.equal(new Set(base.ids).size,base.ids.length);
     assert.ok(base.targetSizes.length===2&&base.targetSizes.every(h=>h>=44));
     for(const font of ['Lora','Playfair Display','Source Sans 3'])assert.ok(base.family.includes(font),'missing font '+font);
     await verifyCompactLinkNames(page);
     const links=page.locator('.jdc-links a');const primary=await links.first().getAttribute('id');
     for(let i=0;i<2;i++){
      await links.nth(i).focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#src-G3-S008');
      const back=page.locator('#src-G3-S008 [data-journal-source-return]');
      assert.equal(await back.getAttribute('href'),'#'+primary,'noJS primary fallback');
      await back.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#'+primary);
     }
     await page.evaluate(()=>document.documentElement.style.setProperty('--gb-reader-font-scale','2'));
     const enlarged=await snapshot();assert.equal(enlarged.over,false);
     assert.equal(enlarged.summary,base.summary);assert.equal(enlarged.boundary,base.boundary);
     assert.ok(enlarged.fontSizes.every((size,i)=>Math.abs(size/base.fontSizes[i]-2)<.01),'Reader text scale ratio');
     await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));
     assert.deepEqual((await snapshot()).fontSizes,base.fontSizes);
     await page.goto(url+'/compact/');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await waitForCanonicalFonts(page);
     const stem=[name,width,dark?'dark':'light','compact-nojs'].join('-');
     await page.screenshot({path:join(evidence,stem+'-full.png'),fullPage:true});
     if(name==='chromium'&&width===1440){
      await page.emulateMedia({media:'print'});
      assert.equal(await page.locator('.journal-edition').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
      for(const format of ['A4','Letter']){
       const file=join(evidence,'compact-'+format+'-'+(dark?'dark':'light')+'.pdf');
       await page.pdf({path:file,format,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'},printBackground:true});
       const extract=spawnSync('pdftotext',['-layout','-enc','UTF-8',file,'-'],{encoding:'utf8'});
       assert.equal(extract.status,0,extract.error?.message??extract.stderr);
       const pages=extract.stdout.split('\f').map(p=>p.trim()).filter(Boolean);
       const normalize=v=>v.replace(/-\s*\n\s*/gu,'').replace(/\s+/gu,' ').trim();
       const text=normalize(pages.join('\n'));
       // Exact browser text is checked above. PDF may insert typographic
       // hyphenation and layout whitespace, so compare all words normalized.
       const words=v=>v.replace(/[\s\u00ad\-]/gu,'');
       assert.equal(words(text).split(words(specimen.readerSafeText)).length-1,1,'approved paragraph in PDF');
       assert.ok(words(text).includes(words(specimen.annotation)),'annotation retained');
       assert.ok(words(text).includes(words(specimen.boundary)),'boundary retained');
       assert.ok(text.includes('Архив заявления')&&text.includes('Воспроизведение заявления'),'both reference labels retained');
       const notePages=pages.filter(p=>p.includes('Значение')||p.includes('Предел доказательства'));
       assert.equal(notePages.length,1,'compact annotation pair on one sheet');
       assert.ok(notePages[0].includes('Значение')&&notePages[0].includes('Предел доказательства'));
       paperAcceptance.push({format,dark,pages:pages.length,file});console.log('PAPER_PASS '+format+' '+dark+' '+pages.length);
      }
     }
     compactAcceptance.push({name,width,dark,js:false,citations:2,textScale:2});
     await writeFile(join(evidence,'compact-acceptance.json'),JSON.stringify({compactAcceptance,paperAcceptance},null,2));
     console.log('COMPACT_PASS '+stem);
    }finally{await page.close();}
   }
  }finally{await browser.close();}
 }
}finally{server.close();}
assert.equal(results.length,36*selected.length);
for(const name of selected)for(const width of [320,390,768,1024,1440,1920])for(const dark of [false,true]){
 const rows=results.filter(r=>r.name===name&&r.width===width&&r.dark===dark);
 const full=rows.find(r=>r.variant==='after'), compact=rows.find(r=>r.variant==='compact');
 assert.ok(compact.opening<full.opening,'compact section must be shorter than full exhibit');
 assert.ok(compact.textStart<full.textStart,'compact reader text must start earlier');
}
assert.equal(compactAcceptance.length,12*selected.length);
assert.equal(paperAcceptance.length,selected.includes('chromium')?4:0);
console.log('SPECIMEN_CASES='+results.length+' COMPACT_NOJS='+compactAcceptance.length+' PAPER='+paperAcceptance.length);
}
