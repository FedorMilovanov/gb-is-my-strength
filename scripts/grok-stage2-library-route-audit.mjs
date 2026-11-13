#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import { chromium, firefox, webkit } from 'playwright';

const ROOT=path.resolve('.');
const DIST=path.join(ROOT,'dist');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const doc=path.join(DIST,ROUTE.replace(/^\/+|\/+$/g,''),'index.html');
assert.ok(fs.existsSync(doc),'production-like dist must exist');
assert.match(fs.readFileSync(doc,'utf8'),/<aside\s+class="hrail hrail--grok"/,'expected pilot ON');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp',
 '.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
const server=http.createServer((req,res)=>{
 try {
  const url=decodeURIComponent((req.url||'/').split('?')[0]);
  let full=path.resolve(DIST,url.replace(/^\/+/,''));
  if(!path.extname(full)) full=path.join(full,'index.html');
  const rel=path.relative(DIST,full);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!fs.existsSync(full)||!fs.statSync(full).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'content-type':mime[path.extname(full)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(full).pipe(res);
 }catch {res.writeHead(400);res.end('bad request');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
// Production-like offline Library test: Yandex analytics is third-party and
// its blocked beacon must not masquerade as a Library JavaScript exception.
// This matches the existing canonical Grok rail browser test. First-party
// errors are NOT suppressed or ignored.
async function isolateAnalytics(page) {
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/(^|\.)(?:yandex\.(?:ru|com)|yastatic\.net)$/i.test(url.hostname)) {
      return route.continue();
    }
    return route.fulfill({
      status:200,
      contentType:route.request().resourceType()==='script'
        ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8',
      body:''
    });
  });
}
let total=0;
const result=[];
const verify=(engine,name,cond,evidence)=>{assert.ok(cond,engine+' '+name+': '+JSON.stringify(evidence));total++;};
try {
 for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
  const browser=await driver.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:1440,height:900},locale:'ru-RU',acceptDownloads:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   await isolateAnalytics(page);
   page.on('pageerror',e=>errors.push(e.message));
   const action=name=>page.locator('[data-research-action="'+name+'"]');
   const getStatus=()=>page.evaluate(()=>{
    const records=JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}');
    const selected=Object.entries(records).find(([path])=>path.includes('hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki'));
    return {key:selected?.[0]??null,state:selected?.[1]?.state??null,anchor:selected?.[1]?.anchor??null};
   });
   try{
    await page.goto(origin+ROUTE,{waitUntil:'domcontentloaded'});
    await page.locator('.hrail--grok.grok-ready').waitFor();
    await page.locator('#gb-hl-fab').click();
    await action('start-current').waitFor();
    verify(engine,'original Library V3 offers save on real article',await action('start-current').count()===1);
    await action('start-current').click();
    const saved=await getStatus();
    verify(engine,'explicit reading start persists',saved.state==='reading',saved);
    await action('finish-current').waitFor();
    verify(engine,'status action becomes Finish',await action('finish-current').count()===1);
    await action('manage').click();
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:10000}),action('export-json').click()]);
    const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    verify(engine,'backup is canonical V3',backup.format==='gospod-bog-reader-library'&&backup.version===3);
    verify(engine,'backup includes real article status',backup.data.reading?.[saved.key]?.state==='reading',Object.keys(backup.data.reading||{}));
    await page.reload({waitUntil:'domcontentloaded'});
    const restored=await getStatus();
    verify(engine,'reading status survives reload',restored.state==='reading',restored);
    await page.locator('#gb-hl-fab').click();
    await action('finish-current').waitFor();
    verify(engine,'read-back status reflected in UI',await action('finish-current').count()===1);
    await action('manage').click();
    await page.locator('#gb-hl-json-file').setInputFiles({
      name:'grok-qa-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))
    });
    await action('confirm-import').click();
    const reimported=await getStatus();
    verify(engine,'backup restore is idempotent',reimported.state==='reading',reimported);
    verify(engine,'no runtime errors',errors.length===0,errors);
    console.log('PASS',engine,JSON.stringify({saved,restored,reimported}));
    result.push({engine,saved,restored,reimported,checks:9});
   }finally{await page.close();await context.close();}
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
fs.mkdirSync(path.join(ROOT,'reports/grok-stage2'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'reports/grok-stage2/library-real-route.json'),JSON.stringify(result,null,2));
console.log('GROK V26 REAL ARTICLE LIBRARY SMOKE: '+total+'/'+total+' PASS');
