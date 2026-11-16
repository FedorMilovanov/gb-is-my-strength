const fs=require('fs'),path=require('path'),http=require('http'),{chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V14_HISTORIC_PAPER_QA_20261112');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
const routes=[['herm','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],['baptists','/baptisty-rossii/noch-na-kure/'],['gill','/articles/dzhon-gill-chast-1-chelovek/']];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,rows=[];
 for(const[engineName,engine]of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 for(const[slug,url]of routes)for(const width of [390,1593])for(const theme of ['light','dark','sepia']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',serviceWorkers:'block'});
 const row={engineName,slug,width,theme},errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  const resp=await page.goto(base+url,{waitUntil:'domcontentloaded',timeout:18000});if(resp.status()!==200)throw Error('HTTP '+resp.status());
  if(theme==='dark')await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-reader-theme','dark')});
  if(theme==='sepia')await page.evaluate(()=>document.documentElement.setAttribute('data-reader-theme','sepia'));
  await page.waitForTimeout(110);
  const data=await page.evaluate(()=>{
   const el=s=>document.querySelector(s);const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
   const paper=el('.article-main.article-main--hrail,.gbs2-world .page-wrap'),toc=el('.hrail--grok .hrail-scroll,.gbs-rail .gbs2-current,.gbs2-rail .gbs2-current'),progress=el('.gbs-rail .gbs2-rprogress,.gbs2-rail .gbs2-rprogress'),bar=el('[data-mobile-bottombar]'),pdf=el('[data-reader-pdf]');
   const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,right:r.right,w:r.width,h:r.height,shadow:s.boxShadow,radius:s.borderRadius,bg:s.backgroundImage,display:s.display}};
   return{paper:box(paper),toc:box(toc),progress:box(progress),barVisible:vis(bar),pdfVisible:vis(pdf),pdfIconD:pdf?.querySelector('path')?.getAttribute('d'),pdfIconPolyline:pdf?.querySelector('polyline')?.getAttribute('points'),desktopIconD:el('.hrail-bottom [data-action="print"] svg path')?.getAttribute('d'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });row.measure=data;
  if(width===1593){
   if(data.paper?.shadow==='none'||!data.paper?.bg?.includes('linear-gradient'))throw Error('Historical sheet shadow missing');
   if(!data.toc||data.toc.radius!=='0px')throw Error('Boxed TOC remains');
   if(slug!=='herm'&&data.progress?.radius!=='0px')throw Error('Separate progress card remains');
   if(data.barVisible)throw Error('Mobile footer leaked onto desktop');
  }else{
   if(data.paper?.shadow!=='none')throw Error('Paper shadow leaked on mobile');
   if(!data.pdfVisible||data.pdfIconD!=='M12 3v12'||data.pdfIconPolyline!=='7 10 12 15 17 10')throw Error('Old PDF SVG missing mobile');
  }
  if(slug==='herm'&&data.desktopIconD!=='M12 3v12')throw Error('Old desktop PDF SVG missing');
  if(data.overflow>2)throw Error('Horizontal overflow '+data.overflow);
  if(errors.length)throw Error('JS runtime: '+errors.slice(0,2).join(';'));
  if(engineName==='chromium'&&width===1593&&['herm','baptists'].includes(slug))await page.screenshot({path:path.join(out,'V14_'+slug+'_'+theme+'_1593.png'),animations:'disabled'});
  if(engineName==='chromium'&&width===390&&theme==='light'&&['herm','baptists'].includes(slug))await page.screenshot({path:path.join(out,'V14_'+slug+'_mobile_390.png'),animations:'disabled'});
  row.pass=true;
 }catch(e){row.pass=false;row.error=String(e).slice(0,550)}
 rows.push(row);await page.close();
 }
 await browser.close();
 }
 server.close();const bad=rows.filter(x=>!x.pass),report={cases:rows.length,passed:rows.length-bad.length,failed:bad.length,failures:bad,rows};
 fs.writeFileSync(path.join(out,'V14_PAPER_AND_TOC_ENGINES.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({cases:report.cases,passed:report.passed,failed:bad.length,failures:bad.slice(0,20).map(x=>({engine:x.engineName,slug:x.slug,width:x.width,theme:x.theme,error:x.error}))},null,2));
 if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
