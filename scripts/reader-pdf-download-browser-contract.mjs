// Synthetic PDF bytes; actual download events and saved bytes in both engines.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const root=resolve(process.env.GB_REPO_ROOT||'.');
const require=createRequire(join(root,'package.json'));
const {chromium,webkit}=require('playwright');
const runtime=readFileSync(process.env.GB_ACTIONS_RUNTIME||join(root,'src/runtime/reader-actions.js'));
const css=readFileSync(join(root,'src/runtime/reader-export.css'));
const generator=await chromium.launch({headless:true});
let pdf;
try{const p=await generator.newPage();await p.setContent('<h1>Synthetic Reader download test</h1>');pdf=await p.pdf({format:'A4'});}finally{await generator.close();}
const hash=createHash('sha256').update(pdf).digest('hex');
const url='/reader-pdf/'+hash+'/synthetic.pdf',route='/articles/synthetic/',rev='a'.repeat(40);
const meta=(p=url,r=route,v=rev,n=pdf.length)=>'<meta name="gb-reader-pdf" content="'+p+'" data-route="'+r+'" data-revision="'+v+'" data-bytes="'+n+'">';
let requests=0;
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),path=u.pathname;
 if(path===url){requests++;res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length});res.end(pdf);return;}
 if(path==='/runtime.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(runtime);return;}
 if(path==='/runtime.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(css);return;}
 if(path===route){
 const k=u.searchParams.get('fixture');
 const metadata=k==='valid'||k==='mutated'?meta():k==='wrong-route'?meta(url,'/articles/other/'):k==='external'?meta('https://example.invalid/a.pdf'):k==='duplicate'?meta()+meta():k==='bad-bytes'?meta(url,route,rev,'0'):'';
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 res.end('<!doctype html><html><head>'+metadata+'<link rel="stylesheet" href="/runtime.css"></head><body><button data-action="print">Export</button><script>window.__printCalls=0;window.print=()=>{window.__printCalls++}</script><script src="/runtime.js"></script></body></html>');return;
 }
 res.writeHead(404);res.end();
});
await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
const origin='http://127.0.0.1:'+server.address().port;
const results=[];
try{
 for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
 for(const kind of ['valid','absent','wrong-route','external','duplicate','bad-bytes','mutated']){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844},serviceWorkers:'block'});
 try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const start=requests;
 await page.goto(origin+route+'?fixture='+kind);await page.waitForFunction(()=>window.GBReaderActions?.version===2);
 const startUrl=page.url();await page.locator('[data-action="print"]').click();
 const menu=page.locator('#gbReaderExportMenu');await menu.waitFor({state:'visible'});
 const download=menu.locator('[data-reader-export-command="download"]');
 assert.equal(await menu.locator('[role="menuitem"]').count(),2);
 assert.equal(await download.getAttribute('aria-disabled'),String(!['valid','mutated'].includes(kind)));
 assert.equal(requests,start,'no prefetch');
 if(kind==='valid'){
 const [file]=await Promise.all([page.waitForEvent('download'),download.click()]);
 assert.equal(file.suggestedFilename(),'synthetic.pdf');assert.equal(await file.failure(),null);
 assert.deepEqual(readFileSync(await file.path()),pdf);assert.equal(requests,start+1);
 }else{
 if(kind==='mutated')await page.evaluate(()=>document.querySelector('meta[name="gb-reader-pdf"]').remove());
 const status=await page.evaluate(()=>window.GBReaderActions.export.invoke('download'));
 assert.equal(status.status,'unavailable');
 if(kind!=='mutated')await download.evaluate(n=>n.click());
 assert.equal(requests,start);
 }
 assert.equal(page.url(),startUrl);assert.equal(await page.evaluate(()=>window.__printCalls),0);assert.deepEqual(errors,[]);
 results.push({browser:name,kind,status:'PASS'});
 console.log(name,kind,'PASS');
 }finally{await context.close();}
 }
 }finally{await browser.close();}
 }
 console.log(JSON.stringify({results,bytes:pdf.length,sha256:hash,requests}));
 assert.equal(results.length,14);assert.equal(requests,2);
 console.log('Reader PDF browser contract: 14/14 PASS');
}finally{await new Promise(r=>server.close(r));}
