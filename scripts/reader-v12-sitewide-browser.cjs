const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V12_REAL_BROWSER_20261112');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):e.name==='index.html'?[path.join(p,e.name)]:[])}
const routes=walk(root).filter(f=>{const s=fs.readFileSync(f,'utf8');return s.includes('data-reader-mobile-speed') && s.includes('gb-ember')}).map(f=>'/'+path.relative(root,f).replace(/\\/g,'/').replace(/index.html$/,''));
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),rows=[];
for(const route of routes){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 let row={route};
 const pageErrors=[];page.on('pageerror',x=>pageErrors.push(x.message));
 try{
 const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:15000});
 const before=await page.evaluate(()=>{
 const bar=document.querySelector('[data-reader-mobile-speed]'),q=s=>bar?.querySelectorAll(s).length??0;
 if(!bar)return null;
 return{menu:q('.reader-mobile-menu-trigger'),play:q('.reader-mobile-play'),badge:q('.reader-mobile-speed-badge'),home:q('.reader-mobile-home'),save:q('.gb-save'),settings:document.querySelectorAll('.reader-mobile-action-cluster .reader-mobile-action').length,rail:q('.reader-mobile-speedrail'),rates:q('.reader-mobile-speed-rate'),arrows:document.querySelectorAll('.mobile-bottom-bar [data-fc-action="scroll-top"],.hmbar [data-fc-action="scroll-top"]').length,themeButtons:document.querySelectorAll('.mobile-bottom-bar .gb-theme-toggle,.hmbar .gb-theme-toggle').length};
 });
 row.before=before;
 if(!before||response.status()!==200)throw Error('Route or shared chrome missing');
 if(['menu','play','badge','home','save','rail'].some(k=>before[k]!==1)||before.settings!==2||before.rates!==6||before.arrows!==0||before.themeButtons!==0)throw Error('Not canonical mobile controls '+JSON.stringify(before));
 await page.locator('.reader-mobile-speed-badge').click();
 const after=await page.evaluate(()=>{
 const b=document.querySelector('[data-reader-mobile-speed]'),h=b.querySelector('.reader-mobile-home'),e=b.querySelector('.reader-mobile-play'),r=b.querySelector('.reader-mobile-speedrail').getBoundingClientRect(),p=e.getBoundingClientRect();
 return{speedOpen:b.classList.contains('speed-open'),inert:b.querySelector('.reader-mobile-menu-trigger').inert,homeOpacity:getComputedStyle(h).opacity,homePointer:getComputedStyle(h).pointerEvents,homeRect:h.getBoundingClientRect().x,rateRight:r.right,playLeft:p.left,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}
 });
 row.after=after;
 if(!after.speedOpen||!after.inert||parseFloat(after.homeOpacity)<.96||after.homePointer==='none'||after.homeRect<0||after.rateRight>after.playLeft+3||after.overflow>2)throw Error('Layout violation '+JSON.stringify(after));
 if(pageErrors.length)throw Error('Browser exception '+pageErrors.slice(0,3).join(';'));
 row.pass=true;
 }catch(e){row.pass=false;row.error=String(e).slice(0,650)}
 finally{rows.push(row);await page.close()}
}
await browser.close();server.close();
const bad=rows.filter(x=>!x.pass),report={routes:routes.length,passed:rows.length-bad.length,failed:bad.length,failures:bad,rows};
fs.writeFileSync(path.join(out,'V12_SITEWIDE_ALL_READERS.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({routes:report.routes,passed:report.passed,failed:report.failed,failures:bad.slice(0,15).map(x=>({route:x.route,error:x.error}))},null,2));if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
