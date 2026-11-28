const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve('dist');
const outfile=path.resolve('reports/article-tooltip-pointer-ownership/report.json');
const route='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const types={'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp'};
const srv=http.createServer((req,res)=>{try{const uri=decodeURIComponent((req.url||'/').split('?')[0]);let f=path.resolve(root,uri.replace(/^\/+/,''));if(!path.extname(f))f=path.join(f,'index.html');if(!f.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('content-type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);}catch(e){res.writeHead(500);res.end(String(e));}});
const results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function proof(engine,name,base){
 const b=await engine.launch({headless:true});let page;
 try{
  page=await b.newPage({viewport:{width:1366,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await page.goto(base+route+'?reader-pilot=0',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.GBArticleTooltips?.owner==='article-inline-tooltip',{timeout:15000});
  const bib=page.locator('.bref[data-ref]').first(), term=page.locator('.gterm').first();
  await bib.scrollIntoViewIfNeeded();
  let r=await bib.boundingBox();
  if(!r)throw Error('No biblical anchor bounds');
  // Real hover must open; moving away must dismiss.
  await page.mouse.move(1,1);
  await bib.hover();
  await page.waitForSelector('.btip.gb-floating-tip.is-open',{state:'visible',timeout:4000});
  const opened=await page.locator('.btip.gb-floating-tip.is-open').count();
  await page.mouse.move(1,1);
  await page.waitForFunction(()=>!document.querySelector('.gb-floating-tip.is-open'),null,{timeout:4000});
  // Focus without pointer motion retains keyboard accessibility.
  await bib.focus();
  await page.waitForSelector('.btip.gb-floating-tip.is-open',{state:'visible',timeout:4000});
  await bib.blur();
  await page.waitForFunction(()=>!document.querySelector('.gb-floating-tip.is-open'),null,{timeout:4000});
  // A pointer placed where an anchor moves during scroll must NOT trigger hover.
  await bib.scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy(0,-65));
  r=await bib.boundingBox();
  const cursor={x:Math.min(1360,Math.max(10,r.x+r.width/2)),y:Math.min(880,Math.max(40,r.y-38))};
  await page.mouse.move(1,1);
  await page.mouse.move(cursor.x,cursor.y);
  await page.waitForTimeout(80);
  const current=await page.evaluate(({x,y})=>({
   at:document.elementFromPoint(x,y)?.className||'',
   biblicalOpen:document.querySelectorAll('.btip.gb-floating-tip.is-open').length
  }),cursor);
  if(current.biblicalOpen!==0)throw Error('Pre-scroll popover open unexpectedly: '+JSON.stringify(current));
  await page.evaluate(()=>window.scrollBy(0,38));
  await page.waitForTimeout(200);
  const scrollState=await page.evaluate(({x,y})=>({
   hit:(()=>{const e=document.elementFromPoint(x,y);return e?.closest?.('.bref')?.className||e?.className||''})(),
   open:document.querySelectorAll('.btip.gb-floating-tip.is-open').length
  }),cursor);
  if(scrollState.open!==0)throw Error('Ghost hover from scroll: '+JSON.stringify(scrollState));
  // Every engine must accept a real physical hover and a normal glossary click.
  await bib.hover();
  await page.waitForSelector('.btip.gb-floating-tip.is-open',{state:'visible',timeout:4000});
  await term.scrollIntoViewIfNeeded();
  await term.click({timeout:4000});
  await page.waitForSelector('.gtip.gb-floating-tip.is-open',{state:'visible',timeout:4000});
  const final=await page.evaluate(()=>({
   biblical:document.querySelectorAll('.btip.gb-floating-tip.is-open').length,
   glossary:document.querySelectorAll('.gtip.gb-floating-tip.is-open').length,
   current:document.documentElement.dataset.gbArticleTooltipsOwner
  }));
  if(final.biblical!==0||final.glossary!==1)throw Error('Cross-tooltip ownership broken: '+JSON.stringify(final));
  const native={opened,current,scrollState,final};
  await page.close();
  page=await b.newPage({viewport:{width:1366,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.body.classList.contains('np-w57-ready')&&window.__NP_UNIVERSAL_PREVIEW__?.ready&&window.__NP_W57_ANNOTATIONS__?.ready);
  const managed=page.locator('article button.bref[data-ref]').first();
  if(!await managed.evaluate(el=>window.__NP_UNIVERSAL_PREVIEW__.ownsScriptureCitation(el)))throw Error('fixture not owned by ARGON');
  await managed.scrollIntoViewIfNeeded();
  await page.mouse.move(1,1);
  await managed.hover();
  await managed.focus();
  const delegated=await managed.evaluate(el=>({
   expanded:el.getAttribute('aria-expanded'),
   hiddenOwner:document.querySelectorAll('body > .btip.gb-floating-tip.is-open').length,
   description:el.getAttribute('aria-describedby')||'',
   focused:document.activeElement===el
  }));
  if(delegated.expanded!=='false'||delegated.hiddenOwner!==0||delegated.description.includes('gb-tip-')||!delegated.focused)
   throw Error('Delegated citation created hidden native owner: '+JSON.stringify(delegated));
  await managed.press('Tab');
  if(await page.evaluate(()=>Boolean(document.activeElement?.closest('.btip'))))
   throw Error('Tab entered hidden native scripture popup');
  const {assertArgonScriptureActivation}=await import('./lib/reader-scripture-owner-browser.mjs');
  const study=await assertArgonScriptureActivation(page,managed);
  // Unmanaged references still reach the native owner rather than being
  // globally hidden by a Reader mode. Use real native markup outside article.
  await managed.evaluate(el=>{
   const outside=document.createElement('div');
   outside.style.cssText='position:fixed;left:24px;top:24px;z-index:25000;background:white;padding:10px';
   const clone=el.cloneNode(true);clone.id='w322-unmanaged-ref';clone.removeAttribute('data-gb-tooltip-ready');clone.removeAttribute('aria-describedby');clone.removeAttribute('aria-expanded');clone.classList.remove('is-open');
   outside.append(clone);document.body.append(outside);
   window.GBArticleTooltips.init();
  });
  const unmanaged=page.locator('#w322-unmanaged-ref');
  if(await unmanaged.evaluate(el=>window.__NP_UNIVERSAL_PREVIEW__.ownsScriptureCitation(el)))throw Error('outside article wrongly claimed');
  await unmanaged.focus();
  await page.waitForSelector('body > .btip.gb-floating-tip.is-open',{state:'visible',timeout:4000});
  await unmanaged.blur();
  await page.waitForFunction(()=>!document.querySelector('body > .btip.gb-floating-tip.is-open'));
  return {engine:name,ok:true,native,delegated,study,unmanaged:true};
 }catch(e){return {engine:name,ok:false,error:String(e.stack||e).slice(0,1400)}}
 finally{await page?.close().catch(()=>{});await b.close();}
}
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;try{
 for(const [engine,name] of [[chromium,'chromium'],[firefox,'firefox'],[webkit,'webkit']]){
 const r=await proof(engine,name,base);results.push(r);console.log(r.ok?'PASS':'FAIL',name,JSON.stringify(r).slice(0,1100));
 }
}finally{await new Promise(r=>srv.close(r));}
fs.mkdirSync(path.dirname(outfile),{recursive:true});
fs.writeFileSync(outfile,JSON.stringify(results,null,2),'utf8');
if(results.some(x=>!x.ok))process.exitCode=1;
})();
