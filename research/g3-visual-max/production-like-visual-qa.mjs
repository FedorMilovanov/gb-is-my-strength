// Read-only independent QA against an existing exact production-like dist.
// No build, no source modification, no server public bind.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const dist=path.resolve(process.env.G3_DIST||'');
const source=path.resolve(process.env.G3_SOURCE||'');
const out=path.resolve(process.env.G3_OUT||'');
assert(process.env.G3_DIST&&process.env.G3_SOURCE&&process.env.G3_OUT);
assert(fs.existsSync(path.join(dist,'js/reader-preferences.js')),'production-like legacy runtime required');
const require=createRequire(path.join(source,'package.json'));
const {chromium,firefox,webkit}=require('playwright');
const data=JSON.parse(fs.readFileSync(path.join(source,'src/components/journal/g3-visual/adopted-visual-data.json'),'utf8'));
const base=JSON.parse(fs.readFileSync(path.join(source,'src/components/journal/g3-visual/matrix-data.json'),'utf8'));
const pairs=[...base.rows.flatMap(r=>r.years.map(y=>({id:'cite-g3-matrix-'+r.id+'-'+y,year:y,name:r.name}))),...data.matrix.entries.map(r=>({id:'cite-g3-matrix-'+r.id+'-'+r.year,year:r.year,name:r.name}))];
assert.equal(new Set(pairs.map(r=>r.id)).size,60);
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const server=createServer((req,res)=>{try{let f=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f!==dist&&!f.startsWith(dist+path.sep))return res.writeHead(403).end();if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch{res.writeHead(500).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,history='/journal/dossiers/g3/history/',crisis='/journal/dossiers/g3/';
const reports=[],issues=[];
const norm=s=>s.replace(/\s/g,'').replace('−','-');
try{for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
 if(process.env.G3_ENGINE&&process.env.G3_ENGINE!==engine)continue;
 const b=await type.launch();const count={engine,version:b.version(),geometry:0,returns:0,filters:0,pdf:0,theme:0};
 try{for(const width of [320,740,1440])for(const theme of ['light','dark'])for(const js of [false,true]){
  // No JS has no native runtime; test fallback without mislabeling it dark.
  if(!js&&theme==='dark')continue;
  const ctx=await b.newContext({viewport:{width,height:900},serviceWorkers:'block',javaScriptEnabled:js,colorScheme:'light',reducedMotion:'reduce'});
  const page=await ctx.newPage();page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin||r.request().url().startsWith('data:')?r.continue():r.abort());
  const where={engine,width,theme,js};
  try{
   for(const [kind,route] of [['history',history],['finance',crisis]]){
    assert.equal((await page.goto(origin+route,{waitUntil:'load'})).status(),200);
    if(js){await page.waitForFunction(()=>['light','dark'].includes(document.documentElement.dataset.readerTheme));if(await page.locator('html').getAttribute('data-reader-theme')!==theme)await page.locator('[data-journal-theme]').click();await page.waitForFunction(t=>document.documentElement.dataset.readerTheme===t,theme);assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),theme==='dark');count.theme++}
    const selector=kind==='history'?'.g3-matrix':'.g3-annual-finance';
    const mod=page.locator(selector);assert.equal(await mod.count(),1);
    const geo=await mod.evaluate(e=>({root:document.documentElement.scrollWidth-innerWidth,module:e.scrollWidth-e.clientWidth}));
    assert(geo.root<=1&&geo.module<=1,JSON.stringify(geo));count.geometry++;
    let refs;
    if(kind==='history'){
     const rows=mod.locator('.gm-row'),control=mod.locator('.gm-filter');assert.equal(await rows.count(),26);assert.equal(await rows.filter({visible:true}).count(),26);assert.equal(await mod.locator('a[data-journal-citation]').count(),60);if(js)await mod.locator('[data-gm-bound]').count();assert.equal(await control.isVisible(),js);
     const actual=await mod.locator('a[data-journal-citation]').evaluateAll(es=>es.map(e=>({id:e.id,hash:e.hash,exists:!!document.getElementById(e.hash.slice(1))})));
     for(const x of pairs)assert(actual.some(a=>a.id===x.id&&a.hash==='#history-source-gnl-'+x.year&&a.exists),x.id);
     refs=width===740&&theme==='light'?pairs.map(x=>({id:x.id,dest:'#history-source-gnl-'+x.year})):width===320?pairs.filter(x=>x.id==='cite-g3-matrix-lawson-2018'||x.id==='cite-g3-matrix-lawson-2021').map(x=>({id:x.id,dest:'#history-source-gnl-'+x.year})):[];
     if(js&&width===320){const q=control.locator('input');await q.fill('Вошер');assert.equal(await rows.filter({visible:true}).count(),1);await control.locator('select').selectOption('2018');assert.equal(await rows.filter({visible:true}).count(),0);await control.locator('button').click();assert.equal(await rows.filter({visible:true}).count(),26);count.filters++}
    }else{
     const vals=await mod.locator('tbody tr').evaluateAll(rs=>rs.map(r=>[...r.querySelectorAll('th,td')].map(c=>Number(c.textContent.replace(/\s/g,'').replace('−','-')))));
     assert.deepEqual(vals,data.finance.rows.map(r=>[r.fy,r.revenue,r.expenses,r.result,r.netAssets]));
     refs=['G3-S002','G3-S028'].map(s=>({id:'cite-finance-annual-'+s,dest:'#src-'+s}));
    }
    for(const {id,dest} of refs){
     const link=page.locator('#'+id);assert.equal(await link.getAttribute('href'),dest);await link.focus();await page.keyboard.press('Enter');await page.waitForFunction(t=>location.hash===t,dest,{timeout:5000});
     const back=page.locator(dest+' [data-journal-source-return]');await back.waitFor({state:'visible'});const href=await back.getAttribute('href');if(js)assert.equal(href,'#'+id);else assert.equal(await page.locator(href).count(),1);await back.focus();await page.keyboard.press('Enter');await page.waitForFunction(t=>location.hash===t,href,{timeout:5000});count.returns++;
    }
    if(js&&width===320&&kind==='history'){const a=page.locator('#cite-g3-matrix-lawson-2018'),q=mod.locator('input');await a.click();await q.fill('zz-no-match');assert.equal(await a.isVisible(),false);await page.locator('#history-source-gnl-2018 [data-journal-source-return]').click();await a.waitFor({state:'visible'});assert.equal(await q.inputValue(),'');count.filters++}
    if(engine==='chromium'&&width===740){if(kind==='history'&&js)await mod.locator('input').fill('Вошер');await page.emulateMedia({media:'print'});if(kind==='history')assert.equal(await mod.locator('.gm-row').filter({visible:true}).count(),26);for(const paper of ['A4','Letter']){await page.pdf({path:path.join(out,kind+'-'+paper+'-'+theme+'-'+(js?'js':'nojs')+'.pdf'),format:paper,printBackground:true,margin:{top:'14mm',bottom:'14mm',left:'14mm',right:'14mm'}});count.pdf++}await page.emulateMedia({media:'screen'})}
   }
   assert.equal(errors.length,0,errors.join('; '));
  }catch(e){issues.push({...where,error:String(e),url:page.url()});console.log('FAIL',JSON.stringify(issues.at(-1)))}
  finally{await ctx.close()}
 }}finally{await b.close()}
 reports.push(count);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({reports,issues},null,2));console.log('ENGINE',JSON.stringify(count));
}}finally{await new Promise(r=>server.close(r))}
console.log('RESULT',JSON.stringify({reports,issues}));if(issues.length)process.exitCode=1;
