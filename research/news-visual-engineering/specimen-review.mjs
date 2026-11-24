import { build } from 'astro';
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import {waitForCanonicalFonts} from './wait-for-canonical-fonts.mjs';
import {captureKeyboardScale,interactionTarget} from './keyboard-scale-witness.mjs';
import {physicalWordCount} from './pdf-word-bounds.mjs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { cp, readFile, writeFile, mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Native fragment navigation can finish after keyboard dispatch.
async function activateCitation(page,link,expected,scenario){
  const before=new URL(page.url()).hash, href=await link.getAttribute('href');
  assert.equal(href,expected,'native anchor target');
  try{
    await link.focus();
    assert.equal(await link.evaluate(el=>document.activeElement===el),true,'native link focus');
    const start=Date.now();
    await page.keyboard.press('Enter');
    const immediate=new URL(page.url()).hash;
    await page.waitForURL(u=>u.hash===expected,{timeout:5000});
    assert.equal(new URL(page.url()).hash,expected);
    if(immediate!==expected)console.log('NATIVE_HASH_DEFERRED '+JSON.stringify({scenario,before,href,immediate,after:new URL(page.url()).hash,elapsed:Date.now()-start}));
  }catch(error){
    console.error('NATIVE_HASH_FAILURE '+JSON.stringify({scenario,before,href,expected,after:new URL(page.url()).hash,active:await page.evaluate(()=>({id:document.activeElement?.id,href:document.activeElement?.getAttribute('href')})).catch(()=>null)}));
    throw error;
  }
}
const engines = {chromium,firefox,webkit};
const compareMode=process.argv.includes('--compare-2022');
const historyMode=compareMode||process.argv.includes('--history-2018');
assert.ok(!(compareMode&&process.argv.includes('--history-2018')),'choose one specimen');
const requested = process.argv.slice(2).filter(arg=>!['--history-2018','--compare-2022'].includes(arg));
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
await copy('research/news-visual-engineering/private-focus.css','src/news-private-focus.css');
if(historyMode){
 await copy('research/news-visual-engineering/group-evidence-families.mjs','src/group-evidence-families.mjs');
 await copy('research/news-visual-engineering/'+(compareMode?'g3-hist-pub-16':'g3-hist-pub-13')+'-specimen.json','src/history-evidence.json');
 await copy('research/news-visual-engineering/'+(compareMode?'g3-hist-pub-16':'g3-hist-pub-13')+'-specimen.astro.txt','src/pages/index.astro');
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
 const expectedGroups=compareMode?history.sources.map(source=>({label:source.topic,sourceIds:[source.id]})):history.groups;
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
    assert.equal(witness.text,history.readerSafeText);assert.equal(witness.boundary,history.boundary);assert.equal(witness.over,false);assert.deepEqual(witness.groups,expectedGroups.map(g=>g.sourceIds));assert.equal(new Set(witness.ids).size,witness.ids.length);
    if(compareMode){const records=await page.locator('.jhc-record [data-record-date-role]').evaluateAll(nodes=>nodes.map(n=>({role:n.dataset.recordDateRole,value:n.querySelector('time')?.getAttribute('datetime')??null})));assert.deepEqual(records,history.sources.map(src=>src.recordDate));}
    const links=page.locator('.jhe-group a');assert.equal(await links.count(),history.sources.length);
    if(js)await page.waitForFunction(()=>document.querySelector('[data-journal-source-navigation]').dataset.journalSourceNavigationBound==='true');
    for(let i=0;i<history.sources.length;i++){
     const link=links.nth(i),id=await link.getAttribute('id'),href=await link.getAttribute('href');
     assert.equal(await link.innerText(),history.sources[i].label);assert.ok((await link.getAttribute('aria-label')).startsWith(history.sources[i].label+' · '));
     await activateCitation(page,link,href,{mode:compareMode?'compare':'history',name,width,dark,js,i});
     const back=page.locator(href+' [data-journal-source-return]');assert.equal(await back.getAttribute('href'),'#'+id);await activateCitation(page,back,'#'+id,{mode:compareMode?'compare':'history',name,width,dark,js,i});
    }
    const sizes=()=>page.evaluate(()=>[...document.querySelectorAll(' .jhe-summary,.jhe-boundary p,.jhe-group li p,.jhc-role')].map(el=>parseFloat(getComputedStyle(el).fontSize)));
    const base=await sizes();
    await page.evaluate(()=>document.documentElement.style.setProperty('--gb-reader-font-scale','2'));
    try{
      const scaled=await sizes();assert.equal(scaled.length,base.length);assert.ok(scaled.length>0&&scaled.every((s,i)=>Math.abs(s/base[i]-2)<.01));
      const layout=await page.evaluate(()=>{
        const usableWidth=document.documentElement.clientWidth,scrollWidth=document.documentElement.scrollWidth;
        const offenders=[];
        for(const el of document.querySelectorAll('article *')){
          const r=el.getBoundingClientRect(),css=getComputedStyle(el);
          if(r.width<=0||r.height<=0)continue;
          if(r.left<-.5||r.right>usableWidth+.5||(css.display!=='inline'&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+1)){
            offenders.push({tag:el.tagName,id:el.id,className:String(el.className||''),rect:r.toJSON(),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,font:css.font,overflowWrap:css.overflowWrap,wordBreak:css.wordBreak,text:el.textContent.trim().slice(0,180)});
          }
        }
        const words=[];
        if(scrollWidth>usableWidth){
          const walker=document.createTreeWalker(document.querySelector('article'),NodeFilter.SHOW_TEXT);
          while(walker.nextNode()){
            const node=walker.currentNode;
            for(const match of node.textContent.matchAll(/\S+/gu)){
              const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
              for(const r of range.getClientRects())if(r.right>usableWidth+.5||r.left<-.5)words.push({word:match[0],parent:node.parentElement.tagName,className:String(node.parentElement.className||''),rect:r.toJSON()});
            }
          }
        }
        return {usableWidth,scrollWidth,offenders,words};
      });
      if(layout.scrollWidth>layout.usableWidth){
        const stem=[name,width,dark?'dark':'light',js?'js':'nojs',compareMode?'compare':'history','scale2-overflow'].join('-');
        await writeFile(join(evidence,stem+'.json'),JSON.stringify(layout,null,2));
        console.error('SCALE2_OVERFLOW '+JSON.stringify({scenario:stem,...layout}));
        await page.screenshot({path:join(evidence,stem+'.png'),fullPage:true,timeout:8000}).catch(error=>console.error('SCALE2_SCREENSHOT_FAILURE '+error.message));
      }
      assert.equal(layout.scrollWidth,layout.usableWidth,'2x Reader scale horizontal overflow');
    }finally{await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));}
    assert.deepEqual(await sizes(),base);
    if(!js){await page.goto(url);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await waitForCanonicalFonts(page);const stem=[name,width,dark?'dark':'light','history'].join('-');await page.screenshot({path:join(evidence,stem+'.png'),fullPage:true});await page.screenshot({path:join(evidence,stem+'-viewport.png')});}
    if(name==='chromium'&&width===1440){
     await page.goto(url);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await waitForCanonicalFonts(page);
     await page.emulateMedia({media:'print'});
     assert.equal(await page.locator('.journal-edition').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
     for(const format of ['A4','Letter']){
      const file=join(evidence,['history',format,dark?'dark':'light',js?'js':'nojs'].join('-')+'.pdf');
      await page.pdf({path:file,format,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'},printBackground:true});
      const extract=spawnSync('pdftotext',['-layout','-enc','UTF-8',file,'-'],{encoding:'utf8'});
      assert.equal(extract.status,0,extract.error?.message??extract.stderr);
      const pages=extract.stdout.split('\f').map(t=>t.trim()).filter(Boolean);
      const words=v=>v.replace(/[\s\u00ad\-]/gu,'');
      const text=words(pages.join('\n'));
      assert.equal(text.split(words(history.readerSafeText)).length-1,1,'one immutable paragraph');
      assert.ok(text.includes(words(history.boundary)),'evidence limitation retained');
      for(const source of history.sources){
       assert.ok(text.includes(words(source.locator)),'full locator retained: '+source.id);
       assert.ok(pages.some(p=>words(p).includes(words(source.label))&&words(p).includes(words(source.role))),'evidence role stays with label: '+source.id);
      }
      for(const group of expectedGroups)assert.ok(text.includes(words(group.label)),'group heading retained');
      if(compareMode)for(const source of history.sources){const display=source.recordDate.value===null?'Не установлена':new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeZone:'UTC'}).format(new Date(source.recordDate.value+'T00:00:00Z'));assert.ok(pages.some(p=>words(p).includes(words(source.label))&&words(p).includes(words(display))),'record date stays with source');}
      const count=physicalWordCount(file,pages.length,format);
      paperAcceptance.push({format,dark,js,pages:pages.length,words:count});
      await writeFile(join(evidence,'history-paper.json'),JSON.stringify(paperAcceptance,null,2));
      console.log('HISTORY_PAPER_PASS '+JSON.stringify(paperAcceptance.at(-1)));
     }
    }
    const interaction=interactionTarget(width,dark,js,1440)?await captureKeyboardScale(page,{url,dark,js,evidence,stem:['qa-'+(compareMode?'compare-2022':'history-2018'),name,width,dark?'dark':'light',js?'js':'nojs'].join('-'),scaleSelector:'.jhe-summary,.jhe-boundary p,.jhe-group li p,.jhc-role',citations:history.sources.length,external:history.sources.length,returns:history.sources.length}):null;
    results.push({name,width,dark,js,citations:history.sources.length,interaction});await writeFile(join(evidence,'history-results.json'),JSON.stringify(results,null,2));console.log('HISTORY_PASS '+JSON.stringify(results.at(-1)));
   }finally{await page.close();}
  }
  }finally{await browser.close();}
 }
 }finally{server.close();}
 assert.equal(results.length,12*selected.length);assert.equal(paperAcceptance.length,selected.includes('chromium')?8:0);console.log('HISTORY_CASES='+results.length+' PAPER='+paperAcceptance.length);
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
      await activateCitation(page,target,'#src-G3-S008',{mode:'compact-compare',name,width,dark,variant});
      const back=page.locator('#src-G3-S008 [data-journal-source-return]');assert.equal(await back.getAttribute('href'),'#'+link.id);
      await activateCitation(page,back,'#'+link.id,{mode:'compact-compare',name,width,dark,variant});
     }
     await page.goto(url+'/'+variant+'/');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await waitForCanonicalFonts(page);
     const stem=[name,width,dark?'dark':'light',variant].join('-');
     await page.screenshot({path:join(evidence,stem+'-full.png'),fullPage:true});await page.screenshot({path:join(evidence,stem+'-viewport.png')});
     const interaction=variant==='compact'&&interactionTarget(width,dark,true,1440)?await captureKeyboardScale(page,{url:url+'/compact/',dark,js:true,evidence,stem:['qa-compact',name,width,dark?'dark':'light','js'].join('-'),scaleSelector:'.jdc-summary,.jdc-note dd',citations:2,external:2,returns:1}):null;
     results.push({name,width,dark,variant,opening:witness.opening,textStart:witness.textStart,links:witness.links.length,interaction});await writeFile(join(evidence,'results.json'),JSON.stringify(results,null,2));console.log('CASE_PASS '+stem);
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
      await activateCitation(page,links.nth(i),'#src-G3-S008',{mode:'compact-nojs',name,width,dark,i});
      const back=page.locator('#src-G3-S008 [data-journal-source-return]');
      assert.equal(await back.getAttribute('href'),'#'+primary,'noJS primary fallback');
      await activateCitation(page,back,'#'+primary,{mode:'compact-nojs',name,width,dark,i});
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
       const count=physicalWordCount(file,pages.length,format);
       paperAcceptance.push({format,dark,pages:pages.length,words:count,file});console.log('PAPER_PASS '+format+' '+dark+' '+pages.length+' words='+count);
      }
     }
     const interaction=interactionTarget(width,dark,false,1440)?await captureKeyboardScale(page,{url:url+'/compact/',dark,js:false,evidence,stem:['qa-compact',name,width,dark?'dark':'light','nojs'].join('-'),scaleSelector:'.jdc-summary,.jdc-note dd',citations:2,external:2,returns:1}):null;
     compactAcceptance.push({name,width,dark,js:false,citations:2,textScale:2,interaction});
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
