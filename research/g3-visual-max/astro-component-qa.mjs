// Run only in a disposable exact Git archive of the listed files with installed dependencies.
// No production routes, no deploy, no shared repo writes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, firefox, webkit } from 'playwright';
const root=fileURLToPath(new URL('../../',import.meta.url));
assert(process.env.G3_VISUAL_DISPOSABLE==='1','Run in a disposable archive with G3_VISUAL_DISPOSABLE=1');
const at=(...p)=>path.join(root,...p);
assert(!existsSync(at('.git')),'Never run in a Git working tree');
assert(!existsSync(at('src/pages')),'Refusing to overwrite existing routes');
assert(!existsSync(at('astro.config.mjs')),'Refusing to overwrite an existing config');
const pkg=JSON.parse(readFileSync(at('package.json'),'utf8'));
const installed=JSON.parse(readFileSync(at('node_modules/astro/package.json'),'utf8'));
assert.equal(installed.version,pkg.devDependencies.astro);
console.log('Astro',installed.version,'Node',process.version,'repo engines',pkg.engines.node);
mkdirSync(at('src/pages'),{recursive:true});
writeFileSync(at('astro.config.mjs'),`import { defineConfig } from 'astro/config';import { fileURLToPath } from 'node:url';export default defineConfig({output:'static',vite:{resolve:{alias:{'@':fileURLToPath(new URL('./src/',import.meta.url))}}}});`);
writeFileSync(at('src/pages/index.astro'),`---
import Matrix from '../components/journal/g3-visual/G3SpeakerMatrix.astro';
import Finance from '../components/journal/g3-visual/G3AnnualFinance.astro';
import SourceReturn from '../components/journal/JournalSourceReturn.astro';
import {G3_HISTORY_SOURCES} from '../data/journal/g3HistorySources';
import '../styles/editorial-edition.css';
import proposal from '../../research/g3-visual-max/finance-proposal.json';
const sources=G3_HISTORY_SOURCES.filter(s=>/^gnl-/.test(s.id));
---
<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Internal G3 visual component witness</title><style is:global>body{margin:0}main{padding:12px;box-sizing:border-box}.witness-column{width:min(100%,850px);margin:auto}.bibliography-item{padding:1rem 0}</style></head><body><main class="journal-edition" data-journal-source-navigation><div class="witness-column">
<p id="g3-history">Внутренняя проверка компонентов</p>
{sources.map(s=><p id={s.returnHref.slice(1)}>{s.title}</p>)}
<Matrix/>
<p id="finance">Финансовая отчётность</p>
<Finance reviewOnly={true} proposal={proposal}/>
{sources.map(s=><section class="bibliography-item" id={\`history-source-\${s.id}\`} tabindex="-1"><h3>{s.title}</h3><SourceReturn href={s.returnHref}/></section>)}
<section class="bibliography-item" id="src-G3-S002" tabindex="-1"><h3>IRS Form 990</h3><SourceReturn href="#finance"/></section>
</div></main></body></html>`);
const result=spawnSync(process.execPath,[at('scripts/astro-cli.mjs'),'build'],{cwd:root,stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
assert.equal(result.status,0,'Astro build failed');
const dist=at('dist');
assert(existsSync(path.join(dist,'index.html')));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const f=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
  if(!f.startsWith(dist+path.sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(readFileSync(f));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
const widths=[320,390,580,680,704,740,850,1440,1920];
const reports=[];
try {
  for (const [engine,type] of Object.entries({chromium,firefox,webkit})) {
    const browser=await type.launch({headless:true});
    try {
      let count=0;
      for (const width of widths) for (const dark of [false,true]) for (const js of [false,true]) {
        const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:js});
        const page=await ctx.newPage();
        const errors=[];page.on('pageerror',e=>errors.push(String(e)));
        await page.goto(url);
        await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
        assert.equal(await page.locator('.gm-row:visible').count(),15);
        assert.equal(await page.locator('.gm-cell a').count(),37);
        assert.equal(await page.locator('.g3-annual-finance td').count(),28);
        assert.equal(await page.getByRole('cell').count(),28);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.locator('.gm-filter').isVisible(),js);
        const target=page.locator('#cite-g3-matrix-lawson-2013');
        if (width===390||width===740) {
          await target.click();
          const back=page.locator('#history-source-gnl-2013 [data-journal-source-return]');
          assert.equal(await back.getAttribute('href'),js?'#cite-g3-matrix-lawson-2013':'#g3-year-2013');
          await back.click();
          if(js) {
            const input=page.locator('.gm-filter input');await input.fill('Вошер');
            assert.equal(await target.isVisible(),false);
            await back.focus();await page.keyboard.press('Enter');
            await target.waitFor({state:'visible'});assert.equal(await input.inputValue(),'');
            await input.fill('Вошер');assert.equal(await target.isVisible(),false);
            await back.click();await target.waitFor({state:'visible'});
            await input.fill('Вошер');assert.equal(await target.isVisible(),false);
            await page.goBack();await page.goForward();await target.waitFor({state:'visible'});
            assert.equal(await input.inputValue(),'');
          }
          const tax=page.locator('#cite-finance-annual-G3-S002');await tax.click();
          const taxBack=page.locator('#src-G3-S002 [data-journal-source-return]');
          assert.equal(await taxBack.getAttribute('href'),js?'#cite-finance-annual-G3-S002':'#finance');
          await taxBack.click();
        }
        assert.deepEqual(errors,[]);
        count++;await ctx.close();
      }
      reports.push({engine,version:browser.version(),scenarios:count});
      console.log(engine,count,'PASS');
    } finally {await browser.close()}
  }
} finally {await new Promise(resolve=>server.close(resolve))}
console.log(JSON.stringify({astro:installed.version,node:process.version,reports}));
