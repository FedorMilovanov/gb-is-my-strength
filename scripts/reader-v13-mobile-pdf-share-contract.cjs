/**
 * One-site mobile Reader actions contract.
 * Tests true in-browser dispatch, dock ownership, width/accessibility, order,
 * print preflight and Web Share without changing the production site.
 */
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),output=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V13_PDF_SHARE_QA_20261112');
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),rel=decodeURIComponent(u.pathname).slice(1);
 let f=path.resolve(root,rel);if(!path.extname(f))f=path.join(f,'index.html');
 if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404);res.end('not found');return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});
 fs.createReadStream(f).pipe(res);
}catch(e){res.writeHead(500);res.end(String(e))}});
const routes=[
 ['baptists','/baptisty-rossii/noch-na-kure/'],
 ['heart','/articles/chto-bibliya-nazyvaet-serdcem/'],
 ['gill','/articles/dzhon-gill-chast-1-chelovek/'],
 ['herm','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
 ['apostasy','/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/'],
 ['lawson','/articles/steven-lawson-samoobman-i-publichnyy-golos/']
];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port,rows=[],failures=[];
 for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{
   for(const [slug,route] of routes)for(const width of [320,360,390,430]){
    const page=await browser.newPage({viewport:{width,height:width===320?740:844},reducedMotion:'reduce',serviceWorkers:'block'});
    const row={engine:engineName,slug,width},errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      window.__pdfPrintCalls=0;window.__shareCalls=[];
      Object.defineProperty(window,'print',{configurable:true,value:()=>{window.__pdfPrintCalls++}});
      Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{window.__shareCalls.push(payload)}});
    });
    try{
      const res=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:23000});
      if(res.status()!==200)throw Error('HTTP '+res.status());
      await page.waitForFunction(()=>document.querySelector('.reader-mobile-action-cluster #gb-hl-fab'),{timeout:6000});
      await page.waitForTimeout(100);
      const before=await page.evaluate(()=>{
        const bar=document.querySelector('[data-mobile-bottombar]'),cluster=bar?.querySelector('.reader-mobile-action-cluster');
        const elements=cluster?[...cluster.children]:[];
        const bounds=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{
          x:r.x,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height,
          opacity:s.opacity,display:s.display,visibility:s.visibility,position:s.position,
        }};
        const a=elements.map(el=>({name:el.id==='gb-hl-fab'?'library':el.matches('[data-reader-pdf]')?'pdf':el.matches('[data-action="share"]')?'share':el.matches('[data-gill-settings-open],#hmSettingsBtn')?'settings':el.tagName,box:bounds(el)}));
        const context=bar?.querySelector('.mobile-btoc-section,.hmbar-section');
        const share=cluster?.querySelector('[data-action="share"]'),pdf=cluster?.querySelector('[data-reader-pdf]');
        return{order:a.map(x=>x.name),actions:a,bar:bar&&bounds(bar),share:share&&bounds(share),pdf:pdf&&bounds(pdf),pdfSvg:!!pdf?.querySelector('svg path'),pdfLabel:pdf?.getAttribute('aria-label'),context:context&&bounds(context),
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerWidth,
          printEngine:typeof window.GBPrintEngine?.print,shareEngine:typeof window.GBReaderActions?.share,
          pdfCount:document.querySelectorAll('[data-reader-pdf]').length};
      });
      row.before=before;
      const order=before.order.join(',');
      if(order!=='settings,library,pdf,share')throw Error('canonical order is wrong: '+order);
      if(before.pdfCount!==1||!before.pdfSvg||!before.pdfLabel?.includes('PDF'))throw Error('PDF icon/label missing');
      if(before.printEngine!=='function'||before.shareEngine!=='function')throw Error('native Reader action engine not connected');
      if(before.actions.some(x=>x.box.w<43.9||x.box.h<43.9))throw Error('44px touch targets missing: '+JSON.stringify(before.actions));
      if(before.actions.some((x,i)=>i>0&&x.box.x<before.actions[i-1].box.right-.9))throw Error('overlapping actions: '+JSON.stringify(before.actions));
      if(before.context?.w<55)throw Error('toc context overcompressed '+before.context.w);
      if(Math.abs(before.share.right-(before.bar.right-parseFloat(await page.locator('[data-mobile-bottombar]').evaluate(e=>getComputedStyle(e).paddingRight))))>4)throw Error('Share not rightmost at bar edge');
      if(before.overflow>2)throw Error('horizontal overflow '+before.overflow);
      if(engineName==='chromium'&&width===390&&['baptists','heart','gill','herm'].includes(slug)){
        await page.screenshot({path:path.join(output,slug+'-mobile390-pdf-share-v13.png'),animations:'disabled'});
      }
      if(engineName==='chromium'&&width===320&&['baptists','herm'].includes(slug)){
        await page.screenshot({path:path.join(output,slug+'-mobile320-pdf-share-v13.png'),animations:'disabled'});
      }
      await page.locator('.reader-mobile-action--share').click({timeout:4000});
      let shared=await page.evaluate(()=>window.__shareCalls);
      if(shared.length!==1||!shared[0]?.url?.endsWith(route))throw Error('Share was not invoked exactly once '+JSON.stringify(shared));
      await page.locator('.reader-mobile-action--pdf').click({timeout:4000});
      let print=await page.evaluate(()=>({calls:window.__pdfPrintCalls,report:window.GBPrintEngine?.getReport?.(),prepared:document.documentElement.getAttribute('data-gb-print-prepared')}));
      if(print.calls!==1||!print.report?.prepared||print.prepared!=='1')throw Error('PDF action was inert or double-fired: '+JSON.stringify(print));
      row.pass=true;
    }catch(e){row.pass=false;row.error=String(e).slice(0,1000);failures.push(row)}
    finally{rows.push(row);await page.close()}
   }
  }finally{await browser.close()}
 }
 const report={cases:rows.length,passed:rows.length-failures.length,failures,rows};
 fs.writeFileSync(path.join(output,'V13_PDF_SHARE_ENGINES.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({cases:report.cases,passed:report.passed,failed:failures.length,failures:failures.slice(0,18).map(x=>({engine:x.engine,slug:x.slug,width:x.width,error:x.error,before:x.before?.order}))},null,2));
 if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2}).finally(()=>server.close());
