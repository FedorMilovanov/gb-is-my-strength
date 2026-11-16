const fs=require('fs'),path=require('path'),http=require('http'),{chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V14_HISTORIC_PAPER_QA_20261112');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const rows=[];
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){const browser=await engine.launch();
for(const width of [390,1593])for(const theme of ['light','dark','sepia']){const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),row={engine:name,width,theme};
try{const resp=await page.goto('http://127.0.0.1:'+server.address().port+'/baptisty-rossii/',{waitUntil:'domcontentloaded'});if(resp.status()!==200)throw Error('HTTP '+resp.status());
if(theme==='dark')await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-reader-theme','dark')});
if(theme==='sepia')await page.evaluate(()=>document.documentElement.setAttribute('data-reader-theme','sepia'));
const d=await page.evaluate(()=>{const s=e=>e?getComputedStyle(e):null;const p=document.querySelector('.gbs2-world .page-wrap'),toc=document.querySelector('.gbs2-rail .gbs2-current'),pr=document.querySelector('.gbs2-rail .gbs2-rprogress');return{shadow:s(p)?.boxShadow,radius:s(toc)?.borderRadius,progressRadius:s(pr)?.borderRadius,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
row.data=d;if(width===1593&&(d.shadow==='none'||d.radius!=='0px'||d.progressRadius!=='0px'))throw Error('Book landing lacks original V2 or seamless TOC');
if(width===390&&d.shadow!=='none')throw Error('Mobile paper overflow risk');if(d.overflow>2)throw Error('Horizontal overflow');row.pass=true;
if(name==='chromium'&&width===1593&&theme==='light')await page.screenshot({path:path.join(out,'V14_baptist_landing_light_1593.png'),animations:'disabled'});
}catch(e){row.pass=false;row.error=String(e)}rows.push(row);await page.close()}await browser.close()}
server.close();const bad=rows.filter(x=>!x.pass);fs.writeFileSync(path.join(out,'V14_BAPTIST_LANDING.json'),JSON.stringify({cases:rows.length,passed:rows.length-bad.length,failures:bad,rows},null,2));console.log(JSON.stringify({cases:rows.length,passed:rows.length-bad.length,failures:bad.slice(0,12)},null,2));if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
