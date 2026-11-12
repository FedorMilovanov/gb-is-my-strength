/* V13 canonical desktop original PlayEmber: visible-mode-only duplication check. */
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist');
const output=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V13_PDF_SHARE_QA_20261112');
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');let file=path.resolve(root,decodeURIComponent(u.pathname).slice(1));if(!path.extname(file))file=path.join(file,'index.html');if(path.relative(root,file).startsWith('..')||!fs.existsSync(file)){res.writeHead(404).end('404');return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}catch(e){res.writeHead(400).end(String(e))}});
const routes=[
 ['herm','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
 ['gill','/articles/dzhon-gill-chast-1-chelovek/'],
 ['baptists','/baptisty-rossii/noch-na-kure/'],
 ['apostasy','/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/'],
 ['lawson','/articles/steven-lawson-samoobman-i-publichnyy-golos/'],
 ['otstupniki','/articles/otstuplenie-chto-govorit-bibliya/']
];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,results=[];
 for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 try{for(const [slug,route] of routes)for(const width of [1200,1440,1680]){
 let row={engineName,slug,width},page=await browser.newPage({viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForTimeout(160);
 let play=page.locator('.gb-ember:visible').first();
 if(!(await play.count()))throw Error('No visible original PlayEmber');
 // Gill/Baptist keep the canonical MOBILE topbar until 1359px. At 1200px
 // that is the correct responsive owner, not a missing desktop Play panel.
 const isMobileOwner=await play.evaluate(el=>!!el.closest('[data-mobile-chrome]'));
 if(isMobileOwner){
   const bar=page.locator('[data-reader-mobile-speed]:visible').first();
   if(!(await bar.count()))throw Error('Tablet has Play but no canonical mobile owner');
   await bar.locator('.reader-mobile-speed-badge').click();
   await page.waitForTimeout(100);
   const rail=bar.locator('.reader-mobile-speedrail');
   const info=await rail.evaluate(el=>({rates:el.querySelectorAll('[data-speed]').length,open:el.closest('[data-reader-mobile-speed]')?.classList.contains('speed-open')}));
   if(!info.open||info.rates!==6)throw Error('Tablet mobile six-rate picker broken');
   await rail.locator('[data-speed="1.75"]').click();
   row.storage=await page.evaluate(()=>localStorage.getItem('gb:audio:rate'));
   if(row.storage!=='1.75')throw Error('Tablet speed did not persist');
   row.mode='canonical-tablet-mobile';
   row.pass=true;
   continue;
 }
 const before=await play.boundingBox();
 await play.focus({timeout:6000});await page.waitForTimeout(150);
 const wrap=play.locator('xpath=..');
 const menu=wrap.locator('.gb-ember-expand').first();
 if(!(await menu.count()))throw Error('No real historical gb-ember-expand');
 const snapshot=await menu.evaluate((m)=>{
 const s=getComputedStyle(m),b=m.getBoundingClientRect(),chips=[...m.querySelectorAll('.gb-ember-expand__btn[data-speed]')].map(e=>{const style=getComputedStyle(e),r=e.getBoundingClientRect();return{rate:e.dataset.speed,x:r.x,y:r.y,w:r.width,h:r.height,background:style.backgroundColor,color:style.color,border:style.borderStyle,active:e.getAttribute('aria-checked')==='true'}});
 return{open:m.classList.contains('is-open'),direction:s.flexDirection,display:s.display,clip:s.clipPath,background:s.backgroundColor,rect:{x:b.x,y:b.y,w:b.width,h:b.height},chips,pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,duplicates:[...document.querySelectorAll('#hmSpeedrail,#mobileSpeedrail')].filter(el=>{
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
 }).length};
 });
 const after=await play.boundingBox();
 row.snapshot=snapshot;
 if(!snapshot.open)throw Error('Historical morph did not open');
 if(snapshot.direction!=='column')throw Error('Not historic vertical flex menu');
 if(snapshot.chips.length!==6||snapshot.chips.some((x,i)=>i>0&&x.y<=snapshot.chips[i-1].y))throw Error('Six rates not stacked');
 if(snapshot.chips.some(x=>x.background!=='rgba(0, 0, 0, 0)'))throw Error('Invented filled circles remain');
 if(snapshot.duplicates)throw Error('Second speed rail still rendered');
 if(snapshot.pageOverflow>2)throw Error('Horizontal scroll introduced');
 if(Math.abs(before.x-after.x)>2||Math.abs(before.y-after.y)>2)throw Error('Play moved');
 if(snapshot.rect.x<0||snapshot.rect.x+snapshot.rect.w>width+3)throw Error('Popover outside viewport');
 if(engineName==='chromium'&&['herm','gill','baptists'].includes(slug))await page.screenshot({path:path.join(output,slug+'-'+width+'-authentic-speed.png'),animations:'disabled'});
 await menu.locator('[data-speed="1.75"]').click({timeout:5000});
 await page.waitForTimeout(100);
 row.storage=await page.evaluate(()=>localStorage.getItem('gb:audio:rate'));
 if(row.storage!=='1.75')throw Error('Speed did not persist');
 if(errors.length)throw Error('Runtime exceptions: '+errors.join('; '));
 row.pass=true;
 }catch(e){row.pass=false;row.error=String(e).slice(0,1400);}
 finally{results.push(row);await page.close();}
 }}finally{await browser.close();}
 }
 const bad=results.filter(x=>!x.pass);
 const report={cases:results.length,passes:results.length-bad.length,failures:bad,results};
 fs.writeFileSync(path.join(output,'V13_DESKTOP_VERTICAL_PLAY.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({cases:report.cases,passes:report.passes,failures:bad.slice(0,20).map(x=>({engineName:x.engineName,slug:x.slug,width:x.width,error:x.error,snapshot:x.snapshot}))},null,2));
 if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2}).finally(()=>server.close());
