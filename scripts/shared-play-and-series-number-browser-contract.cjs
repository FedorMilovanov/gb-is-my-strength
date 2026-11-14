/* Permanent shared Play/rate and chapter-number browser regression.
   Runs on exact-head production-like dist; no production traffic. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url||'/', 'http://localhost');
  let name=path.resolve(dist,decodeURIComponent(url.pathname).slice(1));
  if(!path.extname(name))name=path.join(name,'index.html');
  const relative=path.relative(dist,name);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!fs.existsSync(name)||!fs.statSync(name).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':MIME[path.extname(name)]||'application/octet-stream'});fs.createReadStream(name).pipe(res);
 }catch{res.writeHead(400);res.end();}
});
const series=['noch-na-kure','yuzhnaya-shtunda','dva-sezda-1884','peterburgskaya-liniya','goneniya-i-sovest','sovetskaya-noch','vsehib-1944','iniciativnaya-gruppa','podpolnaya-pechat','spravochnik'];
const readers=['/nagornaya/chast-1/','/baptisty-rossii/noch-na-kure/','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/','/articles/kod-da-vinchi/','/articles/dzhon-gill-chast-1-chelovek/'];
let checks=0,passed=0;const failures=[];
function assert(ok,context,evidence){checks++;if(ok){passed++;return;}failures.push({context,evidence});}
async function navigate(page,origin,route){await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});}
if(!fs.existsSync(path.join(dist,'index.html')))throw Error('production-like dist missing');
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await driver.launch({headless:true});
  try{
   for(const width of [390,1366,1600]){
    const page=await browser.newPage({viewport:{width,height:920},serviceWorkers:'block',reducedMotion:'reduce'});
    await page.addInitScript(()=>{try{localStorage.setItem('gb:audio:rate','1.5');localStorage.setItem('gbx-tts-rate','1.5');}catch{}});
    for(const slug of series){
     const route='/baptisty-rossii/'+slug+'/';await navigate(page,origin,route);
     const result=await page.evaluate(()=>{
      const head=document.querySelector('.gbs2-head'),num=head?.querySelector('.gbs2-kinetic');
      if(!head||!num)return {missing:true};
      const visible=getComputedStyle(num).display!=='none'&&num.getBoundingClientRect().width>0;
      let collisions=0;
      if(visible){
       const r=num.getBoundingClientRect();
       for(const text of head.querySelectorAll(':scope > h1,:scope > p')){
        const range=document.createRange();range.selectNodeContents(text);
        collisions+=[...range.getClientRects()].filter(b=>b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top).length;
       }
      }
      return {visible,collisions,cols:getComputedStyle(head).gridTemplateColumns};
     });
     assert(!result.missing&&result.collisions===0&&((width<1360&&!result.visible)||(width>=1360&&result.visible)),engine+' '+width+' '+route+' numeral separated',result);
    }
    for(const route of readers){
     await navigate(page,origin,route);
     await page.waitForTimeout(160);
     const state=await page.evaluate(()=>{
      const embers=[...document.querySelectorAll('.gb-ember')].filter(e=>e.closest('[data-fc-root],[data-fc-controls]')&&!e.closest('[data-gb-speed-custom],[data-fc-speed-mode="inline"]'));
      const badges=embers.map(e=>e.parentElement?.querySelector('.gb-ember-speed-echo')||e.parentElement?.parentElement?.querySelector('.gbs-rail-spdbadge'));
      const panels=embers.map(e=>e.parentElement?.querySelector('.gb-ember-expand'));
      const before=badges.map(b=>b?.textContent?.trim());
      window.dispatchEvent(new CustomEvent('gb:tts-rate-change',{detail:{rate:1.75}}));
      return {embers:embers.length,before,after:badges.map(b=>b?.textContent?.trim()),selected:panels.map(p=>p?.querySelector('[data-speed="1.75"]')?.getAttribute('aria-checked')),uniquePanels:panels.filter(Boolean).length};
     });
     assert(state.embers>0&&state.uniquePanels===state.embers&&state.before.every(v=>v==='1.5×')&&state.after.every(v=>v==='1.75×')&&state.selected.every(v=>v==='true'),engine+' '+width+' '+route+' shared rate',state);
    }
    await page.close();
   }
  }finally{await browser.close();}
 }
 console.log(JSON.stringify({checks,passed,failed:checks-passed,failures:failures.slice(0,25)},null,2));
 if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
