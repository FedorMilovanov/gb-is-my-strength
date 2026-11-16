const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V13_PDF_SHARE_QA_20261112');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404);return res.end('not found')}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
const routes=[['BAPTISTS','/baptisty-rossii/noch-na-kure/'],['HERMENEUTIKA','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],['HEART','/articles/chto-bibliya-nazyvaet-serdcem/']];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await chromium.launch({headless:true}),rows=[];
 for(const [name,route] of routes){
  const page=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block'});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+route,{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForTimeout(200);
   await page.emulateMedia({media:'print'});
   const measure=await page.evaluate(()=>{
    const section=document.querySelector('article,main [data-pagefind-body],main');
    const footer=document.querySelector('[data-mobile-bottombar]');
    const r=section?.getBoundingClientRect(),s=section&&getComputedStyle(section);
    return{printEngine:typeof window.GBPrintEngine?.print,readerWidth:r?.width,readerHeight:r?.height,visibility:s?.visibility,footerDisplay:footer&&getComputedStyle(footer).display,title:document.title,bodyLength:section?.textContent?.length};
   });
   const file=path.join(out,'V13_READER_'+name+'.pdf');
   const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
   fs.writeFileSync(file,bytes);
   const count=[...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
   const rec={name,bytes:bytes.length,pageObjects:count,path:file,measure,pass:bytes.subarray(0,4).toString()==='%PDF'&&bytes.length>20000&&count>=2&&measure.bodyLength>1000&&measure.footerDisplay==='none'};
   rows.push(rec);
   await page.screenshot({path:path.join(out,'V13_READER_'+name+'_PRINT_CSS.png'),animations:'disabled'});
  }catch(e){rows.push({name,pass:false,error:String(e)})}
  await page.close();
 }
 await b.close();server.close();
 fs.writeFileSync(path.join(out,'V13_PDF_RENDER_QA.json'),JSON.stringify(rows,null,2));
 console.log(JSON.stringify(rows.map(x=>({name:x.name,bytes:x.bytes,pages:x.pageObjects,bodyLength:x.measure?.bodyLength,footer:x.measure?.footerDisplay,pass:x.pass,error:x.error})),null,2));
 if(rows.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
