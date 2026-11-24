import { build } from 'astro';
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import {waitForCanonicalFonts} from './wait-for-canonical-fonts.mjs';
import {captureKeyboardScale,interactionTarget} from './keyboard-scale-witness.mjs';
import { createServer } from 'node:http';
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
const requested = process.argv.slice(2);
const selected = requested.length ? requested : Object.keys(engines);
assert.ok(selected.every(name=>Object.hasOwn(engines,name)) && new Set(selected).size===selected.length,'Pass unique engine names: chromium firefox webkit');
const repo = fileURLToPath(new URL('../../', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'news-document-exhibit-'));
const copy = async (from, to=from) => {
  await mkdir(dirname(join(root,to)),{recursive:true});
  await cp(join(repo,from),join(root,to),{recursive:true});
};
console.log('EVIDENCE_DIR='+root);
await symlink(join(repo,'node_modules'),join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
for (const path of ['src/components/journal/editorial','src/components/journal/JournalSourceReturn.astro','src/components/journal/journalEditorial.css','src/styles/editorial-edition.css','fonts']) await copy(path);
await copy('research/news-visual-engineering/exhibit-fixture.astro.txt','src/pages/index.astro');
await copy('research/news-visual-engineering/exhibit-long-fixture.astro.txt','src/pages/long.astro');
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
const textScaleCheck=async page=>{
  const sizes=()=>page.evaluate(()=>[...document.querySelectorAll('.jdx-deck,.jdx-passage p:not(.jdx-locator),.jdx-commentary dd')].map(el=>parseFloat(getComputedStyle(el).fontSize)));
  const base=await sizes();assert.ok(base.length>0 && base.every(v=>v>0));
  try{
    await page.evaluate(()=>document.documentElement.style.setProperty('--gb-reader-font-scale','2'));
    const enlarged=await sizes();
    assert.equal(enlarged.length,base.length);
    for(let i=0;i<base.length;i++)assert.ok(Math.abs(enlarged[i]/base[i]-2)<.01,'Reader font scale failed at text index '+i);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% Reader text scale overflow');
  }finally{await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));}
  assert.deepEqual(await sizes(),base,'Reader font size did not reset');
};
const results=[];
const longResults=[];
const persist=()=>writeFile(join(evidence,'results.json'),JSON.stringify({selected,short:results,long:longResults},null,2)+'\n');
await persist();
const borderCheck=async page=>{
  const v=await page.locator('.jdx').first().evaluate(el=>{
    const css=getComputedStyle(el);const probe=document.createElement('span');el.append(probe);
    probe.style.color='var(--je-gold)';const gold=getComputedStyle(probe).color;
    probe.style.color='var(--je-rule)';const rule=getComputedStyle(probe).color;probe.remove();
    return {start:css.borderBlockStartWidth,end:css.borderBlockEndWidth,top:css.borderBlockStartColor,bottom:css.borderBlockEndColor,gold,rule};
  });
  const meta=await page.locator('.jdx-meta').first().evaluate(el=>({width:el.getBoundingClientRect().width,issuer:el.firstElementChild.getBoundingClientRect().width}));
  assert.ok(Math.abs(meta.width-meta.issuer)<1,'issuer must span complete metadata width');
  assert.equal(v.start,'2px');assert.equal(v.end,'1px');assert.equal(v.top,v.gold);assert.equal(v.bottom,v.rule);
};
try {
  for (const name of selected) {
    const engine=engines[name];
    console.log('ENGINE_START='+name);
    const browser=await engine.launch({headless:true,timeout:30000});
    try {
      for(const width of [320,390,768,1100])for(const dark of [false,true])for(const js of [false,true]){
        const context=await browser.newContext({viewport:{width,height:950},javaScriptEnabled:js});
        try {
          const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
          const response=await page.goto(url);assert.equal(response.status(),200);
          if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
          await waitForCanonicalFonts(page);
          const data=await page.evaluate(()=>{
            return {over:document.documentElement.scrollWidth>innerWidth,rows:document.querySelectorAll('.jdx-section').length,
              links:[...document.querySelectorAll('.jdx a')].every(a=>document.getElementById(a.hash.slice(1))),
              ids:[...document.querySelectorAll('[id]')].map(el=>el.id),
              unknown:document.querySelector('.jdx-meta').textContent.includes('Не установлена'),
              grid:getComputedStyle(document.querySelector('.jdx-section')).gridTemplateColumns,
              fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,''))};
          });
          assert.equal(data.over,false);assert.equal(data.rows,3);assert.equal(data.links,true);assert.equal(data.unknown,true);
          assert.equal(data.grid.split(' ').length,width>=768?2:1);assert.equal(new Set(data.ids).size,data.ids.length);
          for(const font of ['Lora','Playfair Display','Source Sans 3'])assert.ok(data.fonts.includes(font),'font not loaded: '+font);
          await borderCheck(page);
          if(js)await page.waitForFunction(()=>document.querySelector('[data-journal-source-navigation]').dataset.journalSourceNavigationBound==='true');
          const links=page.locator('.jdx a');
          for(let i=0;i<3;i++){
            const link=links.nth(i),id=await link.getAttribute('id'),target=await link.getAttribute('href');
            await activateCitation(page,link,target,{fixture:'short',name,width,dark,js,i});
            const back=page.locator(target+' [data-journal-source-return]');
            const expected=js?'#'+id:i===2?'#cite-13-test-document-document-three':'#cite-13-test-document-document-one';
            assert.equal(await back.getAttribute('href'),expected);
            await activateCitation(page,back,expected,{fixture:'short',name,width,dark,js,i});
          }
          await textScaleCheck(page);
          if(!js&&[320,1100].includes(width)){
            await page.goto(url);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
            await waitForCanonicalFonts(page);
            await page.screenshot({path:join(evidence,name+'-'+width+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
            if(name==='chromium'&&width===1100)for(const format of ['A4','Letter'])await page.pdf({path:join(evidence,format+'-'+(dark?'dark':'light')+'.pdf'),format,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'},printBackground:true});
          }
          const interaction=interactionTarget(width,dark,js,1100)?await captureKeyboardScale(page,{url,dark,js,evidence,stem:['qa-short',name,width,dark?'dark':'light',js?'js':'nojs'].join('-'),scaleSelector:'.jdx-deck,.jdx-passage p:not(.jdx-locator),.jdx-commentary dd',citations:3,external:0,returns:2}):null;
          results.push({engine:name,width,dark,js,citations:3,textScale:2,interaction});await persist();
          console.log('CASE_PASS '+JSON.stringify({fixture:'short',engine:name,width,dark,js}));
        } finally {await context.close();}
      }
      for(const width of [320,1100])for(const dark of [false,true])for(const js of [false,true]){
        const context=await browser.newContext({viewport:{width,height:950},javaScriptEnabled:js});
        try{
          const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);assert.equal((await page.goto(url+'/long/')).status(),200);
          if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
          await waitForCanonicalFonts(page);
          await borderCheck(page);
          const data=await page.evaluate(()=>({over:document.documentElement.scrollWidth>innerWidth,ids:[...document.querySelectorAll('[id]')].map(el=>el.id),rows:document.querySelectorAll('.jdx-section').length,exhibits:document.querySelectorAll('.jdx').length}));
          assert.equal(data.over,false);assert.equal(data.rows,10);assert.equal(data.exhibits,2);assert.equal(new Set(data.ids).size,data.ids.length);
          if(js)await page.waitForFunction(()=>document.querySelector('[data-journal-source-navigation]').dataset.journalSourceNavigationBound==='true');
          const links=page.locator('.jdx a');assert.equal(await links.count(),12);
          assert.equal(await page.locator('.jdx a[id$=":ref-2"]').count(),1);
          assert.ok((await page.locator('.jdx a[id$=":ref-2"]').textContent()).includes('Дополнительный локатор'));
          assert.equal(await page.locator('.jdx a[id$=":ref-2"]').getAttribute('href'),'#source-other');
          assert.equal(await page.locator('.jdx a[id$=":ref-3"]').count(),1);
          assert.ok((await page.locator('.jdx a[id$=":ref-3"]').textContent()).includes('Повторный источник, иной локатор'));
          assert.equal(await page.locator('.jdx a[id$=":ref-3"]').getAttribute('href'),'#source-fixture');
          for(let i=0;i<12;i++){
            const link=links.nth(i),id=await link.getAttribute('id'),target=await link.getAttribute('href');
            await activateCitation(page,link,target,{fixture:'long',name,width,dark,js,i});
            const back=page.locator(target+' [data-journal-source-return]');
            const fallback=target==='#source-fixture'?'#cite-13-long-document-document-part-1':'#cite-13-long-document-document-part-2';
            const expected=js?'#'+id:fallback;
            assert.equal(await back.getAttribute('href'),expected);
            await activateCitation(page,back,expected,{fixture:'long',name,width,dark,js,i});
          }
          await textScaleCheck(page);
          if(!js){
            await page.goto(url+'/long/');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
            await waitForCanonicalFonts(page);
            await page.screenshot({path:join(evidence,'long-'+name+'-'+width+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
            if(name==='chromium'&&width===1100){
              await page.emulateMedia({media:'print'});
              const border=await page.locator('.jdx').first().evaluate(el=>{const s=getComputedStyle(el);return [s.borderBlockStartWidth,s.borderBlockEndWidth,s.borderBlockStartColor,s.borderBlockEndColor]});
              assert.deepEqual(border,['2px','1px','rgb(85, 85, 85)','rgb(85, 85, 85)']);
              const paper=await page.evaluate(()=>({background:getComputedStyle(document.querySelector('.journal-edition')).backgroundColor,headingHyphens:[...document.querySelectorAll('.jdx h2,.jdx h3')].map(el=>getComputedStyle(el).hyphens)}));
              assert.equal(paper.background,'rgb(255, 255, 255)','canonical white paper');
              assert.ok(paper.headingHyphens.every(v=>v==='none'),'no headline hyphenation');
              for(const format of ['A4','Letter'])await page.pdf({path:join(evidence,'long-'+format+'-'+(dark?'dark':'light')+'.pdf'),format,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'},printBackground:true});
            }
          }
          const interaction=interactionTarget(width,dark,js,1100)?await captureKeyboardScale(page,{url:url+'/long/',dark,js,evidence,stem:['qa-long',name,width,dark?'dark':'light',js?'js':'nojs'].join('-'),scaleSelector:'.jdx-deck,.jdx-passage p:not(.jdx-locator),.jdx-commentary dd',citations:12,external:0,returns:2}):null;
          longResults.push({engine:name,width,dark,js,citations:12,interaction});await persist();
          console.log('CASE_PASS '+JSON.stringify({fixture:'long',engine:name,width,dark,js}));
        }finally{await context.close();}
      }
    } finally {await browser.close();}
    console.log(name+' PASS');
  }
} finally {
  await persist();server.close();
}
console.log('SCENARIOS='+results.length);
assert.equal(results.length,16*selected.length);
console.log('LONG_SCENARIOS='+longResults.length);
assert.equal(longResults.length,8*selected.length);
