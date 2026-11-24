
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync,cpSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {chromium,firefox,webkit} from 'playwright';
const root=fileURLToPath(new URL('../../',import.meta.url));
const at=(...p)=>path.join(root,...p);
assert(process.env.G3_GRAPHICS_DISPOSABLE==='1'&&!existsSync(at('.git'))&&!existsSync(at('src/pages'))&&!existsSync(at('astro.config.mjs')),'disposable archive only');
const pkg=JSON.parse(readFileSync(at('package.json'),'utf8'));
const astro=JSON.parse(readFileSync(at('node_modules/astro/package.json'),'utf8')).version;
assert.equal(astro,pkg.devDependencies.astro);
const out=process.env.G3_GRAPHICS_OUTPUT;assert(out&&!out.startsWith(root));
mkdirSync(out,{recursive:true});mkdirSync(at('src/pages/journal/dossiers/g3/history'),{recursive:true});
mkdirSync(at('public'),{recursive:true});cpSync(at('fonts'),at('public/fonts'),{recursive:true});
writeFileSync(at('astro.config.mjs'),"import {defineConfig} from 'astro/config';import {fileURLToPath} from 'node:url';export default defineConfig({output:'static',vite:{resolve:{alias:{'@':fileURLToPath(new URL('./src/',import.meta.url))}}}});");
const pageStart = '<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>G3 component verification</title><link rel="stylesheet" href="/fonts/fonts.css"/><style is:global>body{margin:0}.witness-column{width:min(100% - 24px,740px);margin:auto}.bibliography-item{padding:1rem 0}.witness-anchor{margin:0;font-size:12px}@media print{.witness-column{width:100%}}</style></head><body><main class="journal-edition" data-journal-source-navigation><div class="witness-column">';
const pageEnd='</div></main></body></html>';
const history = [
'---',
"import History from '@/components/journal/g3-graphics/G3HistoricalPanorama.astro';",
"import SourceReturn from '@/components/journal/JournalSourceReturn.astro';",
"import {G3_HISTORY_SOURCES} from '@/data/journal/g3HistorySources';",
"import '@/components/journal/journalEditorial.css';",
'const fallback=[...new Set(G3_HISTORY_SOURCES.map(s=>s.returnHref))];',
'---',pageStart,
'{fallback.map(h=><p class="witness-anchor" id={h.slice(1)} tabindex="-1">{h}</p>)}',
'<History/>',
'{G3_HISTORY_SOURCES.map(s=><section class="bibliography-item" id={"history-source-"+s.id} tabindex="-1"><h3>{s.title}</h3><p>{s.boundary}</p><SourceReturn href={s.returnHref}/></section>)}',
pageEnd].join('\n');
const crisis = [
'---',
"import Eco from '@/components/journal/g3-graphics/G3EcosystemSpread.astro';",
"import Finance from '@/components/journal/g3-graphics/G3ExpenseWaterfall.astro';",
"import SourceReturn from '@/components/journal/JournalSourceReturn.astro';",
"import {G3_SOURCE_BIBLIOGRAPHY} from '@/data/journal/g3SourceBibliography';",
"import '@/components/journal/journalEditorial.css';",
'const sources=G3_SOURCE_BIBLIOGRAPHY.filter(s=>["G3-S001","G3-S002","G3-S011","G3-S017","G3-S033","G3-S050","G3-S053"].includes(s.id));',
'---',pageStart,
'<p id="finance" tabindex="-1">Finance</p><Finance total={1061800} conferences={817283} advertising={246511}/><Eco/><p id="documents" tabindex="-1">Documents</p>',
'{sources.map(s=><section class="bibliography-item" id={"src-"+s.id} tabindex="-1"><h3>{s.title}</h3><p>{s.locator}</p><SourceReturn href={s.id==="G3-S002"?"#finance":"#documents"}/></section>)}',
pageEnd].join('\n');
writeFileSync(at('src/pages/journal/dossiers/g3/history/index.astro'),history);
writeFileSync(at('src/pages/journal/dossiers/g3/index.astro'),crisis);
const b=spawnSync(process.execPath,[at('scripts/astro-cli.mjs'),'build'],{cwd:root,stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});assert.equal(b.status,0);
const dist=at('dist');const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=createServer((req,res)=>{let f=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(existsSync(f)&&statSync(f).isDirectory())f=path.join(f,'index.html');if(!f.startsWith(dist+path.sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+'/journal/dossiers/g3/';
const reports=[], failures=[];
const widths=[320,390,580,680,704,740,850,1440,1920];
const check=(ok,message)=>{if(!ok)throw Error(message)};
async function geometry(page,which){
  return page.evaluate(async(which)=>{
    await document.fonts.ready;
    const fail=[],components=[...document.querySelectorAll('.g3g')];
    if(document.documentElement.scrollWidth>innerWidth+1)fail.push('page overflow');
    const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);if(ids.length!==new Set(ids).size)fail.push('duplicate IDs');
    for(const c of components){const r=c.getBoundingClientRect();if(c.scrollWidth>c.clientWidth+1)fail.push(c.className+' overflow');
      for(const n of c.querySelectorAll('h3,h4,h5,summary,a,td,th')){const b=n.getBoundingClientRect();if(!b.width||!b.height)continue;if(b.right>r.right+1||b.left<r.left-1)fail.push('out: '+n.textContent.trim().slice(0,60));if(n.matches('a.g3g-source')&&b.height<43.5)fail.push('short link: '+n.id);}
      for(const a of c.querySelectorAll('a[data-journal-citation]')){if(!a.id||!a.textContent.trim()||!document.getElementById(decodeURIComponent(a.hash.slice(1))))fail.push('bad source: '+a.id);}
      for(const svg of c.querySelectorAll('svg')){const s=svg.getBoundingClientRect();if(!s.width||!s.height)continue;const labels=[...svg.querySelectorAll('text')].map(t=>({t:t.textContent,r:t.getBoundingClientRect()})).filter(x=>x.r.top>=s.top-1&&x.r.bottom<=s.bottom+1&&x.r.left>=s.left-1&&x.r.right<=s.right+1);
        for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>2&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>2)fail.push('SVG text overlap: '+a.t+' / '+b.t);}
      }
    }
    if(which==='history'&&document.querySelectorAll('.g3g a[data-journal-citation]').length!==18)fail.push('history link count');
    if(which==='crisis'&&document.querySelectorAll('.g3g a[data-journal-citation]').length!==8)fail.push('crisis link count');
    if(!document.fonts.check('600 24px "Playfair Display"','История')||!document.fonts.check('400 14px "Source Sans 3"','История'))fail.push('font check');
    return {fail,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),story:components[0].getBoundingClientRect().width};
  },which);
}
async function roundTrips(page,js,which){
  if(which==='history')await page.locator('.g3g-chron-details summary').click();
  const anchors=await page.locator('.g3g a[data-journal-citation]').evaluateAll(as=>as.map(a=>({id:a.id,hash:a.hash})));
  for(const a of anchors){
    const link=page.locator('#'+a.id);await link.focus();await page.keyboard.press('Enter');
    const back=page.locator(a.hash+' [data-journal-source-return]');
    const href=await back.getAttribute('href');
    check(js?href==='#'+a.id:href!==('#'+a.id)&&href?.startsWith('#'),'wrong return '+a.id+' '+href);
    await back.focus();await page.keyboard.press('Enter');
    check(await page.evaluate(()=>location.hash)===href,'wrong hash return '+a.id);
  }
  return anchors.length;
}
try{
for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
  if(process.env.G3_GRAPHICS_ENGINE&&engine!==process.env.G3_GRAPHICS_ENGINE)continue;
  let geometryPass=0,returnPass=0,hashPass=0,printPass=0,crossPass=0;
  const browser=await type.launch({headless:true});
  try{
  for(const width of widths)for(const dark of [false,true])for(const js of [false,true]){
    const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:js});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    try{
      for(const which of ['history','crisis']){
        try{
          const url=base+(which==='history'?'history/':'');
          await page.goto(url);await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
          const g=await geometry(page,which);check(!g.fail.length,JSON.stringify(g));check(g.fonts.length>0,'no canonical fonts loaded');geometryPass++;
          if((width===390||width===850)&&!dark){
            if(which==='history'){
              await page.goto(url+'#cite-g3g-history-6');
              const revealed=await page.locator('.g3g-chron-details').evaluate(el=>el.open);
              check(revealed,'closed disclosure hash not revealed');hashPass++;
              await page.goto(url);await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
            }
            returnPass+=await roundTrips(page,js,which);
            if(which==='crisis'){
              const cross=page.locator('#cite-g3g-ecosystem-object-1-1');await cross.click();
              check(await page.evaluate(()=>location.pathname.endsWith('/history/')&&location.hash==='#history-source-challies'),'cross route source');crossPass++;
            }
          }
          if((width===390||width===850)&&js){
            await page.goto(url);await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);await page.evaluate(()=>document.fonts.ready);
            for(const [i,c] of (await page.locator('.g3g').all()).entries())await c.screenshot({path:path.join(out,engine+'-'+which+'-'+i+'-'+width+'-'+(dark?'dark':'light')+'.png')});
            if(width===850){
              await page.emulateMedia({media:'print'});
              if(which==='history'){const hidden=await page.locator('.g3g a[data-journal-citation]').evaluateAll(as=>as.filter(a=>!a.getBoundingClientRect().height).map(a=>a.id));check(hidden.length===0,'print hides sources '+hidden.join(','));}
              printPass++;
              if(engine==='chromium')await page.pdf({path:path.join(out,which+'-'+(dark?'dark':'light')+'.pdf'),format:'A4',printBackground:true});
              await page.emulateMedia({media:'screen'});
            }
          }
          check(!errors.length,errors.join(';'));
        }catch(e){failures.push({engine,width,dark,js,which,error:String(e)});console.log('FAIL',JSON.stringify(failures.at(-1)));}
      }
    }finally{await ctx.close();}
  }
  }finally{await browser.close();}
  const report={engine,geometryPass,returnPass,hashPass,printPass,crossPass};reports.push(report);console.log('ENGINE',JSON.stringify(report));
}
}finally{await new Promise(r=>server.close(r));}
const report={node:process.version,astro,reports,failures};writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('G3_GRAPHICS_REPORT',JSON.stringify(report));if(failures.length)process.exitCode=1;
