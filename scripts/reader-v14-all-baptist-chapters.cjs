const fs=require('fs'),path=require('path'),http=require('http'),{chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V14_HISTORIC_PAPER_QA_20261112');
const dir=path.join(root,'baptisty-rossii');const urls=fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(dir,e.name,'index.html'))).map(e=>'/baptisty-rossii/'+e.name+'/');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const rows=[];
for(const [name,engine]of Object.entries({chromium,firefox,webkit})){const browser=await engine.launch({headless:true});const page=await browser.newPage({viewport:{width:1593,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
for(const url of urls){const row={engine:name,url};try{
 const resp=await page.goto('http://127.0.0.1:'+server.address().port+url,{waitUntil:'domcontentloaded',timeout:15000});if(resp.status()!==200)throw Error('HTTP '+resp.status());
 const d=await page.evaluate(()=>{
 const s=el=>el&&getComputedStyle(el);
 const p=document.querySelector('.gbs2-world .page-wrap'),progress=document.querySelector('.gbs-rail .gbs2-rprogress,.gbs2-rail .gbs2-rprogress');
 const toc=document.querySelector('.gbs-rail .gbs2-current,.gbs2-rail .gbs2-current');
 return{paper:!!p,shadow:s(p)?.boxShadow,progressRadius:s(progress)?.borderRadius,tocRadius:s(toc)?.borderRadius,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
 });
 row.data=d;if(d.shadow==='none'||!d.shadow||d.progressRadius!=='0px'||d.tocRadius!=='0px')throw Error('Paper or integrated TOC missing');if(d.overflow>2)throw Error('Overflow '+d.overflow);
 row.pass=true;
}catch(e){row.pass=false;row.error=String(e).slice(0,350)}rows.push(row);}
 await page.close();await browser.close();}
server.close();const bad=rows.filter(x=>!x.pass);const rep={chapters:urls.length,cases:rows.length,passed:rows.length-bad.length,failures:bad};fs.writeFileSync(path.join(out,'V14_ALL_BAPTIST_CHAPTERS.json'),JSON.stringify(rep,null,2));console.log(JSON.stringify(rep,null,2));if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
