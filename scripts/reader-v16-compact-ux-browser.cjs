const fs=require('fs'),path=require('path'),http=require('http'),{chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),qa=path.join(process.env.USERPROFILE,'Downloads','GB_READER_V16_COMPACT_UX_QA_20261112');
fs.mkdirSync(qa,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));if(!path.extname(file))file=path.join(file,'index.html');if(path.relative(root,file).startsWith('..')||!fs.existsSync(file)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
const routes=[['book','/baptisty-rossii/'],['chapter','/baptisty-rossii/noch-na-kure/'],['gill','/articles/dzhon-gill-chast-1-chelovek/']];
const measure=()=>{const rail=document.querySelector('[data-reader-integrated-rail]');const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&r.width>=20&&r.height>=20};const within=[...rail.querySelectorAll('button,a')].filter(el=>visible(el)&&el.getBoundingClientRect().x<68&&el.getBoundingClientRect().y>=0).map(el=>({id:el.id,label:el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent.trim().slice(0,20),...rect(el)}));const more=rail.querySelector('[data-reader-rail-more]'),popup=document.getElementById(more.getAttribute('aria-controls'));const speed=rail.querySelector('.gb-ember-expand');return{rail:rect(rail),more:rect(more),moreVisible:visible(more),moreExpanded:more.getAttribute('aria-expanded'),popup:{hidden:popup?.hidden,rect:popup&&!popup.hidden?rect(popup):null,options:popup?.querySelectorAll('[role="menuitem"]').length},visibleActions:within.slice(0,25),visibleCount:within.length,railBefore:getComputedStyle(rail,'::before').content,speed:speed?{rect:rect(speed),opacity:getComputedStyle(speed).opacity}:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}};
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,rows=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){const browser=await engine.launch({headless:true});
for(const [slug,url] of routes)for(const height of [900,560]){
const p=await browser.newPage({viewport:{width:1593,height},reducedMotion:'reduce',serviceWorkers:'block'}),row={engine:engineName,slug,height},errors=[];
p.on('pageerror',e=>errors.push(String(e)));
try{
 const response=await p.goto(base+url,{waitUntil:'domcontentloaded',timeout:20000});if(response.status()!==200)throw Error('HTTP '+response.status());
 await p.waitForFunction(()=>document.querySelector('[data-reader-integrated-rail]')?.dataset.readerRailFoldReady==='1');
 await p.locator('[data-reader-rail-toggle]').click();
 await p.waitForTimeout(110);
 row.fold=await p.evaluate(measure);
 if(Math.abs(row.fold.rail.w-68)>1||row.fold.rail.x!==0||Math.abs(row.fold.rail.h-height)>1)throw Error('rail geometry');
 if(!row.fold.moreVisible||row.fold.more.bottom>height+1||row.fold.more.y<0||row.fold.overflow>2)throw Error('more geometry or overflow '+JSON.stringify(row.fold.more));
 if(row.fold.visibleCount>(slug==='book'?5:9))throw Error('Too many actions still visible '+JSON.stringify(row.fold.visibleActions));
 if(slug!=='book'&&row.fold.railBefore!=='none')throw Error('Decorative clipped title still visible '+row.fold.railBefore);
 await p.locator('[data-reader-rail-more]').click();
 row.menu=await p.evaluate(measure);
 if(row.menu.popup.hidden||row.menu.popup.options!==5||row.menu.popup.rect.x<70||row.menu.popup.rect.bottom>height+1)throw Error('More menu not accessible '+JSON.stringify(row.menu.popup));
 if(engineName==='chromium'&&height===900)await p.screenshot({path:path.join(qa,slug+'-v16-overflow-open.png'),animations:'disabled'});
 await p.keyboard.press('Escape');
 if(await p.locator('[data-reader-rail-more]').getAttribute('aria-expanded')!=='false')throw Error('Escape did not close');
 await p.evaluate(()=>{
   window.__moreSharePayload=null;
   Object.defineProperty(navigator,'share',{
      configurable:true,
      value:async payload=>{window.__moreSharePayload=payload}
   });
 });
 await p.locator('[data-reader-rail-more]').click();
 await p.getByRole('menuitem',{name:'Поделиться'}).click();
 await p.waitForFunction(()=>!!window.__moreSharePayload,{timeout:2000});
 if(!(await p.evaluate(()=>window.__moreSharePayload?.url?.startsWith('http'))))
   throw Error('More menu did not invoke the original Web Share workflow');
 const play=p.locator('[data-reader-integrated-rail] .gb-ember').first();
 await play.hover();
 await p.waitForTimeout(120);
 row.speed=await p.evaluate(()=>{
  const e=document.querySelector('[data-reader-integrated-rail] .gb-ember-expand');const s=getComputedStyle(e),r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,opacity:s.opacity};
 });
 if(row.speed.x<60||row.speed.right>1593||row.speed.y<0||row.speed.bottom>height+2)throw Error('Play speed choices still outside view '+JSON.stringify(row.speed));
 if(engineName==='chromium'&&height===900)await p.screenshot({path:path.join(qa,slug+'-v16-compact.png'),animations:'disabled'});
 await p.locator('[data-reader-rail-toggle]').click();
 await p.waitForTimeout(70);
 if(await p.locator('[data-reader-rail-more]').isVisible())throw Error('More button appears while expanded');
 if(errors.length)throw Error('Runtime exceptions '+errors.slice(0,2).join(';'));
 row.pass=true;
}catch(e){row.pass=false;row.error=String(e).slice(0,900)}
rows.push(row);await p.close();
}
await browser.close();
}
server.close();const fails=rows.filter(x=>!x.pass);const report={cases:rows.length,passed:rows.length-fails.length,failures:fails,rows};fs.writeFileSync(path.join(qa,'V16_COMPACT_UX_3_ENGINES.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases,passed:report.passed,failed:fails.length,failures:fails.slice(0,18).map(x=>({engine:x.engine,slug:x.slug,height:x.height,error:x.error,visible:x.fold?.visibleActions?.map(v=>v.label)}))},null,2));if(fails.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2;server.close()});
