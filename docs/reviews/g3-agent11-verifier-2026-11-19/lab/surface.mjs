import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const ROOT=process.argv[2], PORT=+process.argv[3]; const axe=fs.readFileSync((process.env.AXE_PATH || '/tmp/arena-browser/node_modules/axe-core/axe.min.js'),'utf8');
const T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.xml':'application/xml'};
const miss=new Set();
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);let f=path.join(ROOT,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){miss.add(p);r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':'max-age=600'});fs.createReadStream(f).pipe(r)}).listen(PORT,'127.0.0.1');
const b=await chromium.launch({executablePath:(process.env.CHROMIUM_PATH || '/tmp/chromium'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const pages=['/articles/','/journal/','/journal/dossiers/g3/']; const out={overflow:[],console:[],deadLinks:[],axe:{}};
for(const scheme of ['light','dark']) for(const w of [320,390,768,1440,1920]){
 const ctx=await b.newContext({viewport:{width:w,height:900},colorScheme:scheme,serviceWorkers:'block'});
 for(const u of pages){ const pg=await ctx.newPage(); pg.on('console',m=>{if(m.type()==='error')out.console.push(`${u} ${w} ${scheme}: ${m.text().slice(0,140)}`)}); pg.on('pageerror',e=>out.console.push(`${u} pageerror ${e.message.slice(0,140)}`));
  await pg.goto(`http://127.0.0.1:${PORT}${u}`,{waitUntil:'load'}); await pg.waitForTimeout(300);
  const o=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth); if(o>0) out.overflow.push(`${u} ${w} ${scheme}: +${o}px`);
  if(w===390||w===1440){ await pg.addScriptTag({content:axe}); const r=await pg.evaluate(async()=>{const r=await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa','wcag22aa']});return r.violations.map(v=>`${v.id}(${v.impact})×${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)}); out.axe[`${u} ${w} ${scheme}`]=r; }
  if(w===1440&&scheme==='light'){ const hrefs=await pg.evaluate(()=>[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>h.startsWith(location.origin)).map(h=>h.split('#')[0]))]); for(const h of hrefs){ const p=new URL(h).pathname; let f=path.join(ROOT,decodeURIComponent(p)); if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html'); if(!fs.existsSync(f)) out.deadLinks.push(`${u} → ${p}`);} out[`links ${u}`]=hrefs.length; }
  await pg.close(); }
 await ctx.close(); }
out.missingAssets=[...miss]; console.log(JSON.stringify(out,null,1)); await b.close(); srv.close();
