// V8 combined component acceptance; only in disposable exact-source archive.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {chromium,firefox,webkit} from 'playwright';
const root=fileURLToPath(new URL('../../',import.meta.url));
const at=(...p)=>path.join(root,...p);
assert(process.env.G3_VISUAL_DISPOSABLE==='1'&&!existsSync(at('.git'))&&!existsSync(at('src/pages'))&&!existsSync(at('astro.config.mjs')));
const pkg=JSON.parse(readFileSync(at('package.json'),'utf8'));
assert.equal(JSON.parse(readFileSync(at('node_modules/astro/package.json'),'utf8')).version,pkg.devDependencies.astro);
mkdirSync(at('src/pages/journal/dossiers/g3/history'),{recursive:true});
writeFileSync(at('astro.config.mjs'),"import {defineConfig} from 'astro/config';import {fileURLToPath} from 'node:url';export default defineConfig({output:'static',vite:{resolve:{alias:{'@':fileURLToPath(new URL('./src/',import.meta.url))}}}});");
const adopted=process.env.G3_VISUAL_ADOPTED==='1';
if(adopted){
  // Witness only: canonical Product IDs may still be pending coordinator integration.
  const registry=at('src/data/journal/g3HistorySources.ts');
  let text=readFileSync(registry,'utf8');
  const review=JSON.parse(readFileSync(at('research/g3-visual-max/matrix-expansion-hold.json'),'utf8'));
  const extra=[2018,2021].filter(y=>!text.includes("id: 'gnl-"+y+"'")).map(y=>({
    id:'gnl-'+y,title:'GNL — каталог G3 '+y,period:String(y),role:'Каталог записей',
    url:review.locators[String(y)],boundary:'Выборка каталога, не полный список участников и не проверка устной речи.',
    returnHref:'#g3-year-'+y,researchLocator:'G3-HIST-PUB-12 · test-only registry projection'
  }));
  if(extra.length){
    const entries=extra.map(x=>'  '+JSON.stringify(x)+',').join('\n');
    const updated=text.replace(/\n\] as const;/,'\n'+entries+'\n] as const;');
    assert.notEqual(updated,text,'cannot extend disposable source witness');
    writeFileSync(registry,updated);
  }
}
const common = [
"import SourceReturn from '@/components/journal/JournalSourceReturn.astro';",
"import '@/components/journal/journalEditorial.css';",
"import '@/components/journal/g3History.css';"
].join('\n');
const shellStart='<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Internal G3 QA only</title><style is:global>body{margin:0}.witness{width:min(100%,850px);margin:auto}.witness-shell{padding:12px;box-sizing:border-box}</style></head><body><div class="journal-edition"><main class="witness-shell" data-journal-source-navigation><div class="witness prose">';
const shellEnd='</div></main></div></body></html>';
const history=[
'---',common,
"import Matrix from '@/components/journal/g3-visual/G3SpeakerMatrix.astro';",
"import Panorama from '@/components/journal/g3-graphics/G3HistoricalPanorama.astro';",
"import {G3_HISTORY_SOURCES as sources} from '@/data/journal/g3HistorySources';",
"const returns=[...new Set(sources.map(s=>s.returnHref))];",
...(adopted?["import {adoptedMatrixData, adoptedMatrixClaim} from '@/components/journal/g3-visual/adopted-visual-inputs';","import type {G3HistorySourceId} from '@/data/journal/g3HistorySources';","const ids={2013:'gnl-2013',2014:'gnl-2014',2015:'gnl-2015',2016:'gnl-2016',2017:'gnl-2017',2018:'gnl-2018',2019:'gnl-2019',2020:'gnl-2020',2021:'gnl-2021'} satisfies Record<number,G3HistorySourceId>;"]:[]),
'---',shellStart,
'{returns.map(h=><p id={h.slice(1)}>Раздел источника</p>)}',
adopted?'<Panorama/><Matrix data={adoptedMatrixData()} sourceIds={ids} claimId={adoptedMatrixClaim}/>':'<Panorama/><Matrix/>',
'<ol class="bibliography">{sources.map(s=><li id={"history-source-"+s.id} class="bibliography-item" tabindex="-1"><p class="biblio-meta">{s.period} · {s.role}</p><h3><a href={s.url}>{s.title}</a></h3><details class="biblio-details"><summary aria-label={"О документе: "+s.title}>О документе</summary><p>{s.boundary}</p></details><SourceReturn href={s.returnHref}/></li>)}</ol>',
shellEnd].join('\n');
const crisis=[
'---',common,
"import Annual from '@/components/journal/g3-visual/G3AnnualFinance.astro';",
"import Waterfall from '@/components/journal/g3-graphics/G3ExpenseWaterfall.astro';",
"import Ecosystem from '@/components/journal/g3-graphics/G3EcosystemSpread.astro';",
"import {G3_SOURCE_BIBLIOGRAPHY as sources} from '@/data/journal/g3SourceBibliography';",
...(!adopted?["import proposal from '../../../../../research/g3-visual-max/finance-proposal.json';"]:[]),
...(adopted?["import {adoptedAnnualFinance} from '@/components/journal/g3-visual/adopted-visual-inputs';"]:[]),
'---',shellStart,
'<p id="documents">Методика проверки</p><p id="finance">Финансы</p>'+(adopted?'<Annual projection={adoptedAnnualFinance()}/>':'<Annual reviewOnly={true} proposal={proposal}/>')+'<Waterfall total={1061800} conferences={817283} advertising={246511}/><Ecosystem/>',
'<ol class="bibliography">{sources.map(s=><li id={"src-"+s.id} class="bibliography-item" tabindex="-1"><p class="biblio-meta">{s.period}</p><h3>{s.title}</h3><details class="biblio-details"><summary>Локатор и доступ к документу</summary><p>{s.locator}</p>{s.publicUrl && <a href={s.publicUrl}>Источник</a>}</details><SourceReturn href="#documents"/></li>)}</ol>',
shellEnd].join('\n');
writeFileSync(at('src/pages/journal/dossiers/g3/history/index.astro'),history);
writeFileSync(at('src/pages/journal/dossiers/g3/index.astro'),crisis);
const cli=(...args)=>spawnSync(process.execPath,[at('scripts/astro-cli.mjs'),...args],{cwd:root,stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
const mapOnly=process.env.G3_VISUAL_MAP_ONLY==='1';
const typecheck=mapOnly?{status:0,diagnosticOnly:true}:cli('check');
console.log('TYPECHECK_EXIT',mapOnly?'not run: map diagnostic only':typecheck.status);
assert.equal(cli('build').status,0,'joint Astro build failed');
const dist=at('dist');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(p.endsWith('/'))p+='index.html';
  const f=path.resolve(dist,'.'+p);
  if(!f.startsWith(dist+path.sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(readFileSync(f));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const routes=['/journal/dossiers/g3/history/','/journal/dossiers/g3/'];
const issues=[],reports=[];
const note=(where,kind,detail)=>issues.push({where,kind,detail});
const widths=mapOnly?[740]:process.env.G3_VISUAL_FOCUSED==='1'?[390,740]:[320,390,580,660,680,740,850,1440,1920];
try{
 for(const [engine,browserType] of Object.entries({chromium,firefox,webkit})){
  if(process.env.G3_VISUAL_ENGINE&&process.env.G3_VISUAL_ENGINE!==engine)continue;
  const browser=await browserType.launch();
  let geometry=0,roundTrips=0,deepLinks=0,printCases=0;
  try{
   for(const route of routes)for(const width of widths)for(const dark of [false,true])for(const js of [false,true]){
    if(mapOnly&&(route!==routes[0]||dark||!js))continue;
    const where={engine,route,width,dark,js};
    const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:js});
    const page=await ctx.newPage(), errors=[];page.setDefaultTimeout(6000);
    page.on('pageerror',e=>errors.push(String(e)));
    try{
      await page.goto(origin+route);
      await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
      const idCheck=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {unique:new Set(ids).size===ids.length,missing:[...document.querySelectorAll('a[data-journal-citation]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.id),overflow:document.documentElement.scrollWidth-innerWidth}});
      if(!idCheck.unique||idCheck.missing.length||idCheck.overflow>0)note(where,'id/overflow',idCheck);
      if(adopted&&route===routes[0]){
       const c=await page.locator('.g3-matrix').getAttribute('data-publication-claims');
       const names=await page.locator('.gm-row').count(),pairs=await page.locator('.gm-row a').count();
       if(c!=='G3-HIST-PUB-12'||names!==26||pairs!==60)note(where,'adopted-matrix',{c,names,pairs});
      }
      if(adopted&&route===routes[1]){
       const c=await page.locator('.g3-annual-finance').getAttribute('data-publication-claims');
       const cells=await page.locator('.g3-annual-finance td').count(),banners=await page.locator('.gaf-hold').count();
       if(c!=='G3-PUB-017'||cells!==28||banners)note(where,'adopted-finance',{c,cells,banners});
      }
      geometry++;
      if(route===routes[0] && width===740 && !dark && js){
       const map=await page.locator('.g3g-atlas-map svg').evaluate(svg=>{
         const b=svg.getBoundingClientRect();
         const box={left:b.left,top:b.top,right:b.right,bottom:b.bottom};
         const entries=[...svg.querySelectorAll('text')].map(e=>{
           const r=e.getBoundingClientRect();
           return {text:e.textContent,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
         });
         return {box,entries};
       });
       const v=map.box;
       const offCrop=map.entries.filter(x=>x.right<=v.left||x.left>=v.right||x.bottom<=v.top||x.top>=v.bottom);
       const intendedOffCrop=offCrop.filter(x=>x.text==='40° с. ш.');
       const unexpectedOffCrop=offCrop.filter(x=>!intendedOffCrop.includes(x));
       const clipped=map.entries.filter(x=>!offCrop.includes(x)&&(x.left<v.left-1||x.right>v.right+1||x.top<v.top-1||x.bottom>v.bottom+1));
       console.log('MAP_SCREEN_RECTS',JSON.stringify({engine,labels:map.entries.length,intendedOffCrop:intendedOffCrop.map(x=>x.text),unexpectedOffCrop:unexpectedOffCrop.map(x=>x.text),clipped:clipped.map(x=>x.text)}));
       if(unexpectedOffCrop.length||clipped.length)note(where,'map-screen-clipping',{unexpectedOffCrop,clipped});
      }
      if(!mapOnly&&(width===390||width===740)){
       if(route===routes[0])await page.locator('.g3g-chron-details summary').click();
       const links=await page.locator('.g3g a[data-journal-citation],.g3-annual-finance a[data-journal-citation],.gm-row a[data-journal-citation]').evaluateAll(es=>es.map(a=>({id:a.id,hash:a.hash})));
       const selected=width===740&&!dark&&js&&process.env.G3_VISUAL_FOCUSED!=='1'?links:links.filter((a,i)=>i===0||i===links.length-1||a.id==='cite-g3g-finance-irs'||a.id==='cite-finance-annual-G3-S002');
       for(const a of selected){
        await page.locator('#'+a.id).click();
        const back=page.locator(a.hash+' [data-journal-source-return]');
        const got=await back.getAttribute('href');
        if(js&&got!=='#'+a.id)note(where,'source-return',{id:a.id,expected:'#'+a.id,got});
        await back.click();roundTrips++;
       }
       if(route===routes[0]){
        const hidden=page.locator('.g3g-chron-details a[data-journal-citation]').first();
        const id=await hidden.getAttribute('id');
        // A new document, initially closed: never accept a previous open state.
        await page.goto(origin+route+'?deep-link=1#'+id);
        await page.waitForTimeout(50);
        const revealed=await page.locator('.g3g-chron-details').evaluate(e=>e.open);
        if(!revealed)note(where,'closed-details-direct-hash',id);
        deepLinks++;
        // Force closed state and ask the native print stylesheet to expose all links.
        await page.locator('.g3g-chron-details').evaluate(e=>e.open=false);
        await page.emulateMedia({media:'print'});
        const pr=await hidden.evaluate(e=>({visibility:e.checkVisibility?e.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true}):e.getBoundingClientRect().height>0,rect:e.getBoundingClientRect().height,content:getComputedStyle(e.closest('details'),'::details-content').contentVisibility}));
        if(!pr.visibility||pr.rect===0)note(where,'closed-details-print',pr);
        printCases++;
       }else{
        const numbers=await page.locator('.g3g-finance-table td').allTextContents();
        if(numbers.length!==4)note(where,'waterfall-values',numbers);
        await page.emulateMedia({media:'print'});printCases++;
       }
       if(errors.length)note(where,'pageerror',errors);
      }
    }catch(error){note(where,'scenario-error',String(error))}
    finally{await ctx.close()}
   }
   reports.push({engine,version:browser.version(),geometry,roundTrips,deepLinks,printCases});
   console.log('ENGINE',JSON.stringify(reports.at(-1)));
  }finally{await browser.close()}
 }
}finally{await new Promise(r=>server.close(r))}
const byKind={};
for(const issue of issues){
 const key=issue.where.engine+':'+issue.kind;
 (byKind[key]??={count:0,first:issue}).count++;
}
writeFileSync(at('joint-qa-result.json'),JSON.stringify({typecheck:typecheck.status,reports,issues},null,2));
console.log('JOINT_RESULT',JSON.stringify({adopted,mapOnly,typecheck:mapOnly?null:typecheck.status,reports,issueCount:issues.length}));
for(const [key,value] of Object.entries(byKind))console.log('ISSUE',key,value.count,JSON.stringify(value.first).slice(0,900));
if(issues.length||typecheck.status!==0)process.exitCode=1;
