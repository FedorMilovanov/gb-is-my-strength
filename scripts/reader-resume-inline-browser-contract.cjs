// Mobile Reader return-to-reading regression: an inline, non-obscuring resume choice.
// Starts its own local dist server. No real user storage or remote requests are modified.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),os=require('node:os'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist');
const route='/articles/dzhon-gill-chast-2-uchenyi/';
const key='gb:reader-state:v1:gb-strength:'+route.slice(0,-1);
const out=path.join(os.tmpdir(),'reader-resume-inline-qa');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg','.jpg':'image/jpeg','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    let file=path.resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end('forbidden');return;}
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(e){res.writeHead(500).end(String(e.message));}
});
async function check(engineName,driver,width,dark,base){
  const browser=await driver.launch();
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,
    serviceWorkers:'block',reducedMotion:'reduce',locale:'ru-RU'});
  await context.addInitScript(({key,dark})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({progress:38,scrollY:2900,savedAt:Date.now()-120000,title:'Гилл часть II',completed:false}));
    if(dark)localStorage.setItem('theme','dark');
  },{key,dark});
  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000});
  const toast=page.locator('.gbs2-resume');
  await toast.waitFor({state:'visible',timeout:9000});
  const mobile=width<768;
  const snapshot=await page.evaluate(()=>{
    const t=document.querySelector('.gbs2-resume'),article=document.querySelector('article.article-body');
    const r=t.getBoundingClientRect(),a=article.getBoundingClientRect(),cs=getComputedStyle(t);
    const go=t.querySelector('.gbs2-resume-go').getBoundingClientRect(),x=t.querySelector('.gbs2-resume-x').getBoundingClientRect();
    const bar=document.querySelector('.mobile-bottom-bar')?.getBoundingClientRect(),label=t.querySelector('span');
    const labelRect=label.getBoundingClientRect();
    const labelRange=document.createRange();labelRange.selectNodeContents(label.lastChild);
    return {barTop:bar?.top ?? null, goBottom:go.bottom, goLeft:go.left,
      labelRight:labelRect.right,textRight:labelRange.getBoundingClientRect().right,labelWidth:label?.clientWidth ?? 0,labelScrollWidth:label?.scrollWidth ?? 0,
      parent:t.parentElement?.tagName,
      position:cs.position,display:cs.display,inFlow:t.classList.contains('gbs2-resume-inline'),
      next:t.nextElementSibling?.tagName,toast:r.toJSON(),article:a.toJSON(),
      goW:go.width,goH:go.height,xW:x.width,xH:x.height,
      bodyOverflow:document.documentElement.scrollWidth-innerWidth,
      overlap:Math.max(0,Math.min(r.bottom,a.bottom)-Math.max(r.top,a.top)),background:cs.backgroundColor,
      htmlDark:document.documentElement.classList.contains('dark')};
  });
  if(mobile){
    assert(snapshot.inFlow,'mobile reader must render inline resume');
    assert.equal(snapshot.parent,'MAIN');
    assert.equal(snapshot.next,'ARTICLE','inline card must directly precede article');
    assert.equal(snapshot.position,'relative');
    assert(snapshot.toast.bottom<=snapshot.article.top+1,'resume card covers article text');
    assert(snapshot.toast.left>=0&&snapshot.toast.right<=width+1,'resume card outside viewport');
    assert(snapshot.toast.width<=snapshot.article.width+1,'resume must fit reading column');
    assert(snapshot.goH>=44&&snapshot.xH>=44&&snapshot.xW>=44,'touch targets must be at least 44px');
    assert(snapshot.barTop!==null && snapshot.goBottom <= snapshot.barTop-3,
      'Continue action must be visible above fixed bottom reader controls');
    assert(snapshot.labelScrollWidth<=snapshot.labelWidth+1,'resume label must not overflow');
    assert(snapshot.labelRight<=snapshot.goLeft-3,'resume label must not overlay Continue action');
    assert(snapshot.textRight<=snapshot.goLeft-3,'visible text glyphs must not enter Continue touch target');
    assert(snapshot.bodyOverflow<=1,'mobile horizontal overflow');
  }else{
    assert(!snapshot.inFlow,'desktop/tablet owner must not be changed');
    assert.equal(snapshot.position,'fixed');
  }
  if(width===390 || width===320){
    fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,engineName+'-'+width+(dark?'-dark':'-light')+'.jpg'),type:'jpeg',quality:68,animations:'disabled'});
  }
  if(engineName==='Chromium'&&width===320&&!dark){
    // This is the former 6.5s disappearance bug. Inline resume must persist.
    await page.waitForTimeout(7050);
    assert(await toast.isVisible(),'inline resume vanished without user action');
  }
  if(mobile){
    if(dark){
      await toast.locator('.gbs2-resume-x').click();
      await page.waitForTimeout(430);
      assert.equal(await toast.count(),0,'dismiss must remove inline card');
      const v=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').dismissedAt,key);
      assert(Number(v)>0,'dismiss-for-day must persist');
    }else{
      await toast.locator('.gbs2-resume-go').click();
      await page.waitForTimeout(800);
      assert((await page.evaluate(()=>scrollY))>1100,'continue must restore saved reading progress');
      assert.equal(await toast.count(),0,'continue must remove inline card');
    }
  }
  assert.deepEqual(pageErrors,[],'JavaScript page errors');
  console.log('W74_PASS',JSON.stringify({browser:engineName,width,dark,...snapshot}));
  await context.close();await browser.close();
}
(async()=>{
  assert(fs.existsSync(path.join(root,'js','floating-cluster-controller.js')),'dist is missing; run strangler:build');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const[name,driver]of[['Chromium',chromium],['WebKit',webkit]]){
      for(const width of[320,390])for(const dark of[false,true])await check(name,driver,width,dark,base);
      await check(name,driver,768,false,base);
    }
    console.log('W74_ALL_PASS=10 | screenshots='+out);
  }finally{server.close();}
})().catch(e=>{console.error('W74_FAIL',e.stack||e);process.exitCode=1;server.close()});
