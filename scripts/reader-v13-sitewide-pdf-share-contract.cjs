const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist'),output=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V13_PDF_SHARE_QA_20261112');
fs.mkdirSync(output,{recursive:true});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):x.name==='index.html'?[path.join(dir,x.name)]:[])}
const files=walk(root).filter(file=>{const text=fs.readFileSync(file,'utf8');return text.includes('data-reader-mobile-speed')&&text.includes('gb-ember')});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true}),rows=[];
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 for(const file of files){
 const route='/'+path.relative(root,file).replace(/\\/g,'/').replace(/index.html$/,'');
 const row={route};
 try{
  const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:15000});
  if(response.status()!==200)throw Error('HTTP '+response.status());
  await page.waitForFunction(()=>document.querySelector('.reader-mobile-action-cluster #gb-hl-fab'),{timeout:5000});
  const audit=await page.evaluate(()=>{
   const bar=document.querySelector('[data-mobile-bottombar]'),cluster=bar?.querySelector('.reader-mobile-action-cluster'),els=cluster?[...cluster.children]:[];
   const ids=els.map(el=>el.id==='gb-hl-fab'?'library':el.matches('[data-reader-pdf]')?'pdf':el.matches('[data-action="share"]')?'share':el.matches('[data-gill-settings-open],#hmSettingsBtn')?'settings':'unexpected');
   const bounds=el=>{const r=el.getBoundingClientRect();return{x:r.x,right:r.right,w:r.width,h:r.height}};
   const pdf=cluster?.querySelector('[data-reader-pdf]'),share=cluster?.querySelector('[data-action="share"]'),context=bar?.querySelector('.mobile-btoc-section,.hmbar-section');
   return{ids,actions:els.map(bounds),pdf:pdf&&bounds(pdf),share:share&&bounds(share),bar:bar&&bounds(bar),
     pdfCount:document.querySelectorAll('[data-reader-pdf]').length,icon:!!pdf?.querySelector('svg'),label:pdf?.getAttribute('aria-label'),
     overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,contextWidth:context?.getBoundingClientRect().width,
     libCount:document.querySelectorAll('#gb-hl-fab').length};
  });
  row.audit=audit;
  if(audit.ids.join(',')!=='settings,library,pdf,share')throw Error('wrong order: '+audit.ids.join(','));
  if(audit.pdfCount!==1||audit.libCount!==1||!audit.icon||!audit.label?.includes('PDF'))throw Error('missing accessible controls');
  if(audit.actions.some(x=>x.w<43.9||x.h<43.9))throw Error('undersized control');
  if(audit.actions.some((x,i)=>i&&x.x<audit.actions[i-1].right-.5))throw Error('overlap');
  if(audit.share.right>audit.bar.right+1||audit.bar.right-audit.share.right>16)throw Error('share not edge');
  if(audit.overflow>2||audit.contextWidth<50)throw Error('page overflows or TOC collapsed');
  row.pass=true;
 }catch(e){row.pass=false;row.error=String(e).slice(0,380)}
 rows.push(row);
 }
 await page.close();await browser.close();server.close();
 const fail=rows.filter(x=>!x.pass),report={routes:rows.length,passed:rows.length-fail.length,failures:fail,rows};
 fs.writeFileSync(path.join(output,'V13_ALL_READER_ROUTES.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({routes:report.routes,passed:report.passed,failed:fail.length,failures:fail.slice(0,16).map(x=>({route:x.route,error:x.error}))},null,2));
 if(fail.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
