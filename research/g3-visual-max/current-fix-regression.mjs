// Focused regression on exact built routes with the archived native static runtime.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
const root=path.resolve(process.env.G3_SOURCE),out=path.resolve(process.env.G3_OUT);const dist=path.join(root,'dist');
const require=createRequire(path.join(root,'package.json'));const {chromium,firefox,webkit}=require('playwright');
assert(fs.existsSync(path.join(root,'js/reader-preferences.js')));fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const server=createServer((req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';const dirs=[dist];if(/^\/(?:js|css|fonts|data|icons|images)\//.test(p))dirs.push(root);const f=dirs.map(d=>path.resolve(d,'.'+p)).find(x=>x.startsWith(root+path.sep)&&fs.existsSync(x)&&fs.statSync(x).isFile());if(!f)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch{res.writeHead(500).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const axe=fs.readFileSync(process.env.G3_AXE,'utf8');
const history='/journal/dossiers/g3/history/',crisis='/journal/dossiers/g3/';
const reports=[],issues=[];
try{for(const [engine,type] of Object.entries({chromium,firefox,webkit})){const b=await type.launch();try{for(const width of [320,390])for(const theme of ['light','dark']){
 const ctx=await b.newContext({viewport:{width,height:844},colorScheme:'light',serviceWorkers:'block',reducedMotion:'reduce'});const page=await ctx.newPage();page.setDefaultTimeout(7000);const warnings=[],errors=[];page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));
 // Observe real calls; preserve native behavior. Negative-control proves monitor can observe empty ID lookup.
 await ctx.addInitScript(()=>{const native=Document.prototype.getElementById;window.__g3EmptyLookup=0;Document.prototype.getElementById=function(id){if(String(id)==='')window.__g3EmptyLookup++;return native.apply(this,arguments)}});
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin||r.request().url().startsWith('data:')?r.continue():r.abort());
 const where={engine,width,theme};
 const ready=async route=>{assert.equal((await page.goto(origin+route,{waitUntil:'load'})).status(),200);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>['light','dark'].includes(document.documentElement.dataset.readerTheme));if(await page.locator('html').getAttribute('data-reader-theme')!==theme)await page.locator('[data-journal-theme]').click();await page.waitForFunction(t=>document.documentElement.dataset.readerTheme===t,theme)};
 try{
 await ready(history);
 const mod=page.locator('.g3-matrix');await mod.locator('.gm-filter').waitFor({state:'visible'});
 assert.equal(await mod.locator('.gm-row:visible').count(),26);assert.equal(await mod.locator('a[data-journal-citation]').count(),60);
 const ids=await mod.locator('a[data-journal-citation]').evaluateAll(es=>es.map(e=>e.id));assert.equal(new Set(ids).size,60);
 assert(await page.locator('a[id^="cite-r6-"]').count()>0,'new R6 history source citations must be present');
 const a=mod.locator('#cite-g3-matrix-lawson-2018'),q=mod.locator('input');await a.click();await q.fill('zz-no-match');assert.equal(await a.isVisible(),false);
 const back=page.locator('#history-source-gnl-2018 [data-journal-source-return]');assert.equal(await back.getAttribute('href'),'#cite-g3-matrix-lawson-2018');await back.click();await a.waitFor({state:'visible'});assert.equal(await q.inputValue(),'');
 await page.evaluate(()=>{location.hash=''});await page.waitForFunction(()=>location.hash==='');await page.waitForTimeout(180);const empty=await page.evaluate(()=>window.__g3EmptyLookup);
 assert.equal(empty,0,'empty ID lookups on history startup/clear hash');
 assert(!warnings.some(s=>/Empty string passed to getElementById/i.test(s)),JSON.stringify(warnings));
 const negative=await page.evaluate(()=>{document.getElementById('');return window.__g3EmptyLookup});assert.equal(negative,1,'monitor negative control');
 await ready(crisis);const annual=page.locator('.g3-annual-finance');assert.equal(await annual.locator('tbody tr').count(),7);
 const link=page.locator('#cite-finance-G3-S002');await link.scrollIntoViewIfNeeded();const geometry=await link.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {width:r.width,height:r.height,display:s.display,minHeight:s.minHeight}});assert(geometry.height>=44,JSON.stringify(geometry));
 await page.addScriptTag({content:axe});const targetViolations=await page.evaluate(async()=>{const r=await window.axe.run({runOnly:{type:'rule',values:['target-size']}});return r.violations.flatMap(v=>v.nodes.map(n=>({target:n.target,summary:n.failureSummary})))});
 assert(!targetViolations.some(n=>n.target.includes('#cite-finance-G3-S002')),JSON.stringify(targetViolations));
 assert.equal(errors.length,0,errors.join('; '));
 const row={...where,emptyLookups:empty,negative,financeTarget:geometry,otherTargetViolations:targetViolations};reports.push(row);console.log('PASS',JSON.stringify(row));
 }catch(e){issues.push({...where,error:String(e),stack:e.stack,warnings:warnings.filter(x=>/getElementById/.test(x))});console.log('FAIL',JSON.stringify(issues.at(-1)))}
 finally{await ctx.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({reports,issues},null,2))}
 }}finally{await b.close()}}}finally{await new Promise(r=>server.close(r))}
console.log('RESULT',JSON.stringify({pass:reports.length,issues}));if(issues.length)process.exitCode=1;
