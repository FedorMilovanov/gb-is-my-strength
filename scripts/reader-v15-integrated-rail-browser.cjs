const fs=require('fs'),path=require('path'),http=require('http'),{chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_INTEGRATED_V15_QA_20261112');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
const routes=[['book','/baptisty-rossii/'],['chapter','/baptisty-rossii/noch-na-kure/'],['gill','/articles/dzhon-gill-chast-1-chelovek/']];
const snap=async p=>p.evaluate(()=>{const e=document.querySelector('[data-reader-integrated-rail]'),t=e?.querySelector('[data-reader-rail-toggle]'),content=e?.querySelector('[data-reader-fold-content]'),corner=e?.querySelector('.reader-rail-compact-tools > .gbs-theme-corner'),paper=document.querySelector('.gbs2-world .page-wrap'),s=x=>x?getComputedStyle(x):null,r=e?.getBoundingClientRect();return{ready:e?.dataset.readerRailFoldReady==='1',toggle:!!t,x:r?.x,width:r?.width,height:r?.height,radius:s(e)?.borderRadius,compact:e?.classList.contains('reader-integrated-rail--compact'),expanded:t?.getAttribute('aria-expanded'),ariaLabel:t?.getAttribute('aria-label'),contentInert:content?.hasAttribute('inert'),contentHidden:content?.getAttribute('aria-hidden'),cornerDocked:!!corner,play:e?.querySelectorAll('[data-fc-action="play"]').length??0,paperShadow:s(paper)?.boxShadow,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,display:s(e)?.display,viewport:innerWidth}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const rows=[];
for(const[name,engine]of Object.entries({chromium,firefox,webkit})){const b=await engine.launch({headless:true});
for(const[slug,url]of routes)for(const width of [390,1360,1593,1920]){const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[],row={engine:name,slug,width};p.on('pageerror',e=>errors.push(String(e)));
try{
 let resp=await p.goto(base+url,{waitUntil:'domcontentloaded',timeout:20000});if(resp.status()!==200)throw Error('HTTP '+resp.status());
 await p.waitForSelector('[data-reader-integrated-rail]',{state:'attached',timeout:10000});await p.waitForTimeout(120);
 let start=await snap(p);row.start=start;
 if(width>=1360){
  if(!start.ready)throw Error('Controller not initialized');
  if(start.x!==0||Math.abs(start.height-900)>3||start.radius!=='0px'||start.width<285||start.width>333)throw Error('Not a full-bleed integrated rail: '+JSON.stringify(start));
  if(start.expanded!=='true'||start.contentInert)throw Error('Initial expanded semantics wrong');
  if(start.paperShadow==='none')throw Error('Historical V2 paper shadow lost');
  await p.locator('[data-reader-rail-toggle]').click();
  await p.waitForTimeout(160);
  let collapsed=await snap(p);row.collapsed=collapsed;
  if(Math.abs(collapsed.width-68)>1||!collapsed.compact||collapsed.expanded!=='false'||!collapsed.contentInert||collapsed.contentHidden!=='true')throw Error('Fold failure: '+JSON.stringify(collapsed));
  if(slug!=='book'&&!collapsed.cornerDocked)throw Error('Real Play and utility controls not moved into compact rail');
  if(slug==='book'&&collapsed.play!==1)throw Error('Book existing Play missing in compact rail');
  if(name==='chromium'&&width===1593){await p.screenshot({path:path.join(out,slug+'-collapsed-1593.png'),animations:'disabled'});}
  await p.locator('[data-reader-rail-toggle]').click();
  await p.waitForTimeout(160);
  let reopened=await snap(p);row.reopened=reopened;
  if(reopened.width<285||reopened.expanded!=='true'||reopened.contentInert||reopened.compact)throw Error('Reopen failure: '+JSON.stringify(reopened));
  if(slug!=='book'&&reopened.cornerDocked)throw Error('Play controls did not return to original DOM');
  if(name==='chromium'&&width===1593)await p.screenshot({path:path.join(out,slug+'-expanded-1593.png'),animations:'disabled'});
 }else{
  if(start.display!=='none'||start.width!==0)throw Error('Desktop rail leaked into mobile');
 }
 if(start.overflow>2||row.collapsed?.overflow>2||row.reopened?.overflow>2)throw Error('Horizontal overflow: '+JSON.stringify({s:start.overflow,c:row.collapsed?.overflow,r:row.reopened?.overflow}));
 if(errors.length)throw Error('JS pageerror: '+errors.slice(0,2).join(';'));
 row.pass=true;
}catch(e){row.pass=false;row.error=String(e).slice(0,900)}
rows.push(row);await p.close();}
await b.close();}
server.close();const bad=rows.filter(x=>!x.pass);const result={cases:rows.length,passed:rows.length-bad.length,failed:bad.length,failures:bad,rows};fs.writeFileSync(path.join(out,'V15_INTEGRATED_RAIL_3_ENGINES.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({cases:rows.length,passed:result.passed,failed:bad.length,failures:bad.slice(0,25).map(x=>({engine:x.engine,slug:x.slug,width:x.width,error:x.error}))},null,2));if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
