import { build } from 'astro';
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, readFile, writeFile, mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const engines = {chromium,firefox,webkit};
const requested = process.argv.slice(2);
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
await copy('research/news-visual-engineering/g3-pub-018-specimen.json','src/specimen.json');
await copy('research/news-visual-engineering/g3-pub-018-specimen.astro.txt','src/pages/specimen.astro');
await mkdir(join(root,'src/components'),{recursive:true});
// The fixture is a component, not a published route.
await cp(join(root,'src/pages/specimen.astro'),join(root,'src/components/PrivateSpecimen.astro'));
await import('node:fs/promises').then(fs=>fs.unlink(join(root,'src/pages/specimen.astro')));
for(const variant of ['before','after']) await writeFile(join(root,'src/pages',variant+'.astro'),`---\nimport PrivateSpecimen from '../components/PrivateSpecimen.astro';\n---\n<PrivateSpecimen variant="${variant}"/>\n`);
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
try{
 for(const name of selected){
  const browser=await engines[name].launch({headless:true,timeout:30000});
  try{
   for(const width of [320,390,768,1024,1440,1920])for(const dark of [false,true])for(const variant of ['before','after']){
    const page=await browser.newPage({viewport:{width,height:950}});
    try{
     page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
     assert.equal((await page.goto(url+'/'+variant+'/')).status(),200);
     if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
     await page.evaluate(()=>document.fonts.ready);
     const witness=await page.evaluate(()=>({text:document.querySelector('#buice').textContent,summary:document.querySelector('.jdx-passage p:not(.jdx-locator)')?.textContent??document.querySelector('[data-publication-claims]').textContent,over:document.documentElement.scrollWidth>innerWidth,ids:[...document.querySelectorAll('[id]')].map(el=>el.id),opening:Math.round(document.querySelector('#buice').getBoundingClientRect().height),links:[...document.querySelectorAll('#buice a[data-journal-citation]')].map(a=>({id:a.id,href:a.getAttribute('href')}))}));
     assert.equal(witness.summary,specimen.readerSafeText);assert.equal(witness.text.split(specimen.readerSafeText).length-1,1);assert.equal(witness.over,false);assert.equal(new Set(witness.ids).size,witness.ids.length);
     assert.equal(witness.links.length,variant==='after'?2:1);
     assert.ok(witness.links.every(l=>l.href==='#src-G3-S008'));
     assert.equal(await page.locator('#src-G3-S008 a[href^="https://"]').count(),2);
     for(const link of witness.links){
      const anchor=page.locator('a[data-journal-citation]').filter({hasText:''});
      const target=page.locator('[id='+JSON.stringify(link.id)+']');
      await target.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#src-G3-S008');
      const back=page.locator('#src-G3-S008 [data-journal-source-return]');assert.equal(await back.getAttribute('href'),'#'+link.id);
      await back.focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#'+link.id);
     }
     await page.goto(url+'/'+variant+'/');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.evaluate(()=>document.fonts.ready);
     const stem=[name,width,dark?'dark':'light',variant].join('-');
     await page.screenshot({path:join(evidence,stem+'-full.png'),fullPage:true});await page.screenshot({path:join(evidence,stem+'-viewport.png')});
     results.push({name,width,dark,variant,opening:witness.opening,links:witness.links.length});await writeFile(join(evidence,'results.json'),JSON.stringify(results,null,2));console.log('CASE_PASS '+stem);
    }finally{await page.close();}
   }
  }finally{await browser.close();}
 }
}finally{server.close();}
assert.equal(results.length,24*selected.length);
console.log('SPECIMEN_CASES='+results.length);
