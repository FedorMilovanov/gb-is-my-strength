import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const ROOT=process.env.DIST || '/tmp/w8/dist', V=process.env.VARIANT;
const T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);let f=path.join(ROOT,p);if(p==='/articles/')f=V;else if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':'max-age=600'});fs.createReadStream(f).pipe(r)}).listen(8794,'127.0.0.1');
const b=await chromium.launch({executablePath:(process.env.CHROMIUM_PATH || '/tmp/chromium'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await b.newContext({viewport:{width:390,height:844},javaScriptEnabled:false,serviceWorkers:'block',reducedMotion:process.env.REDUCED?'reduce':'no-preference'});
const pg=await ctx.newPage(); const B='http://127.0.0.1:8794';
await pg.goto(B+'/articles/',{waitUntil:'load'}); await pg.locator('a[href="#catalog-materials"]').first().click(); await pg.waitForTimeout(300);
const t=pg.locator('#catalog-materials a[href^="/"]').last(); await t.scrollIntoViewIfNeeded(); await pg.waitForTimeout(400);
const before=await pg.evaluate(()=>scrollY); await t.click(); await pg.waitForLoadState('load'); await pg.waitForTimeout(400);
const t0=Date.now(); await pg.goBack({waitUntil:'commit'}); const s=[];
for(let i=0;i<25;i++){try{s.push(await pg.evaluate(()=>[Math.round(scrollY),document.documentElement.scrollHeight,getComputedStyle(document.documentElement).scrollBehavior,document.readyState,document.fonts.status]).then(v=>[Date.now()-t0,...v]))}catch{s.push([Date.now()-t0,'eval-fail'])} await pg.waitForTimeout(i<10?20:150)}
console.log(process.env.TAG,'before',Math.round(before)); for(const x of s) console.log('  ',x.join(' ')); await b.close(); srv.close();
