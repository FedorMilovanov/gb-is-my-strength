// Independent full 24-case actual-paper witness; no alteration of production routes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
const root=path.resolve(process.env.G3_SOURCE),out=path.resolve(process.env.G3_OUT),head=process.env.G3_PARENT;
assert(/^[a-f0-9]{40}$/.test(head));const dist=path.join(root,'dist');
const require=createRequire(path.join(root,'package.json'));const {chromium}=require('playwright');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const server=createServer((req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';const dirs=[dist];if(/^\/(?:js|css|fonts|data|icons|images)\//.test(p))dirs.push(root);const f=dirs.map(d=>path.resolve(d,'.'+p)).find(x=>x.startsWith(root+path.sep)&&fs.existsSync(x)&&fs.statSync(x).isFile());if(!f)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch{res.writeHead(500).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const cases=[],issues=[];const b=await chromium.launch();
try{for(const [kind,route] of [['journal','/journal/'],['dossier','/journal/dossiers/g3/'],['history','/journal/dossiers/g3/history/']])for(const paper of ['A4','Letter'])for(const theme of ['light','dark'])for(const javaScriptEnabled of [true,false]){
 const ctx=await b.newContext({viewport:{width:1440,height:1080},colorScheme:theme,javaScriptEnabled,serviceWorkers:'block'});const page=await ctx.newPage();const name=[kind,paper,theme,javaScriptEnabled?'js':'nojs'].join('-');const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const item={kind,paper,theme,javaScriptEnabled,pdf:path.join(out,name+'.pdf')};
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin||r.request().url().startsWith('data:')?r.continue():r.abort());
 try{
  assert.equal((await page.goto(origin+route,{waitUntil:'load'})).status(),200);
  await page.evaluate(()=>document.fonts.ready);
  if(javaScriptEnabled){await page.waitForFunction(()=>['light','dark'].includes(document.documentElement.dataset.readerTheme));if(await page.locator('html').getAttribute('data-reader-theme')!==theme)await page.locator('[data-journal-theme]').click();await page.waitForFunction(t=>document.documentElement.dataset.readerTheme===t,theme)}
  item.nativeTheme=await page.locator('html').getAttribute('data-reader-theme');
  await page.emulateMedia({media:'print'});
  item.dom=await page.evaluate(()=>{const next=document.querySelector('.je-next-story');const title=next?.querySelector('a').cloneNode(true);title?.querySelectorAll('[aria-hidden]').forEach(el=>el.remove());const norm=el=>el.textContent.replace(/\s+/gu,' ').trim();return {heading:norm(document.querySelector('h1')),sourceTitles:[...document.querySelectorAll('.bibliography-item h3')].map(norm),companion:next?{label:norm(next.querySelector('p')),title:norm(title),breakInside:getComputedStyle(next).breakInside}:null,reviewWarning:document.querySelector('.je-review-note')?norm(document.querySelector('.je-review-note')):null,screenOnlyLabels:[...new Set([...document.querySelectorAll('.skip-link, [data-journal-source-return]')].map(norm))],screenControlsHidden:[...document.querySelectorAll('.je-masthead, .je-editorial-rail, .je-source-return')].every(e=>getComputedStyle(e).display==='none'),paper:getComputedStyle(document.querySelector('.journal-edition')).getPropertyValue('--je-paper').trim(),bibPadding:getComputedStyle(document.querySelector('.bibliography-item')||document.body).paddingBlock}});
  assert.equal(item.dom.paper,'#fff');assert(item.dom.screenControlsHidden);
  if(kind==='history'){assert.equal(item.dom.sourceTitles.length,33);assert.equal(item.dom.bibPadding,'10px 12px');}
  if(kind==='dossier')assert.equal(item.dom.sourceTitles.length,21);
  await page.pdf({path:item.pdf,format:paper,printBackground:true,margin:{top:'14mm',bottom:'14mm',left:'14mm',right:'14mm'}});
  assert.deepEqual(errors,[]);console.log('CAPTURE',name,item.dom.sourceTitles.length,item.nativeTheme);
 }catch(e){issues.push({name,error:String(e)});console.log('FAIL',name,String(e))}
 finally{cases.push(item);await ctx.close();fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({head,engine:'chromium',version:b.version(),cases,issues},null,2))}
}}finally{await b.close();await new Promise(r=>server.close(r))}
console.log('CAPTURE_RESULT',JSON.stringify({count:cases.length,issues}));if(issues.length)process.exitCode=1;
