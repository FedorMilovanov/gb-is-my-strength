import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const ROOT=process.argv[2], PORT=+process.argv[3], SEL=process.argv[4];
const T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);let f=path.join(ROOT,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':'max-age=600'});fs.createReadStream(f).pipe(r)}).listen(PORT,'127.0.0.1');
for (const js of [false,true]) for (const w of [390,1440]) {
const b=await chromium.launch({executablePath:(process.env.CHROMIUM_PATH || '/tmp/chromium'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const pg=await (await b.newContext({viewport:{width:w,height:w<600?844:900},javaScriptEnabled:js,serviceWorkers:'block'})).newPage(); const B=`http://127.0.0.1:${PORT}`;
await pg.goto(B+'/articles/',{waitUntil:'load'}); const l=pg.locator(SEL).first(); const href=await l.getAttribute('href'); await l.click(); await pg.waitForTimeout(1500);
const id=decodeURIComponent(href.slice(1)); const sec=pg.locator(`[id="${id}"]`);
const t=sec.locator("xpath=ancestor::div[1]/following-sibling::ul[1]//a[starts-with(@href,'/')]").last(); await t.scrollIntoViewIfNeeded(); await pg.waitForTimeout(1500);
const before=await pg.evaluate(()=>Math.round(scrollY)); await t.click(); await pg.waitForLoadState('load'); await pg.waitForTimeout(400);
await pg.goBack({waitUntil:'commit'}); await pg.waitForTimeout(3000); const after=await pg.evaluate(()=>Math.round(scrollY));
console.log(`${ROOT.split('/')[2]} ${href.slice(0,32)} js=${js?'Y':'n'} w=${w} before=${before} after=${after} Δ=${after-before}`); await b.close(); }
srv.close();
