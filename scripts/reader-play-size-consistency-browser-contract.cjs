'use strict';
/** Reader visual contract: ONE Play ring size for all reader families.
 * Visual palettes and progress types remain page/series-specific.
 * Use READER_LOCAL_URL to run against a standalone owner preview.
 */
const {chromium,firefox,webkit}=require('playwright');
const ORIGIN=(process.env.READER_LOCAL_URL||'http://127.0.0.1:8790').replace(/\/$/,'');
const routes={
 hermeneutics:'/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
 apostasy:'/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/',
 gill:'/articles/dzhon-gill-chast-1-chelovek/',
 baptists:'/baptisty-rossii/dva-sezda-1884/',
};
(async()=>{
 const issues=[],results=[];
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch({headless:true});
  for(const width of [320,390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
   for(const [family,route] of Object.entries(routes)){
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(ORIGIN+route,{waitUntil:'domcontentloaded',timeout:16000});
    await page.waitForTimeout(120);
    const play=page.locator('button.gb-ember').filter({visible:true}).first();
    if(!await play.count()){
     issues.push({engine:engine.name(),width,family,reason:'missing play'});
     await page.close();continue;
    }
    const before=await play.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const s=el.querySelector('.gb-ember__ring-svg')?.getBoundingClientRect();
      const root=getComputedStyle(document.documentElement);
      const badge=document.querySelector('#hmSpdBadge');
      const b=badge?.getBoundingClientRect();
      return {width:r.width,height:r.height,ringWidth:s?.width,badgeGap:b?.width?b.left-r.right:null,
       overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
       expected:parseFloat(root.getPropertyValue(innerWidth<1024?'--reader-play-size-mobile':'--reader-play-size-desktop'))};
    });
    let clickError='';
    try{await play.click({timeout:5000});await page.waitForTimeout(220)}catch(e){clickError=String(e).slice(0,180)}
    const after=await play.evaluate(el=>({width:el.getBoundingClientRect().width,ringWidth:el.querySelector('svg')?.getBoundingClientRect().width}));
    const row={engine:engine.name(),width,family,status:response.status(),before,after,clickError,errors};
    results.push(row);
    const target=width<1024?44:32;
    if(response.status()!==200||Math.abs(before.width-target)>.2||Math.abs(before.height-target)>.2||
       Math.abs(before.ringWidth-target)>.2||Math.abs(after.width-before.width)>.2||
       Math.abs(after.ringWidth-before.ringWidth)>.2||before.overflow>2||
       before.expected!==target||clickError){
      issues.push(row);
    }
    await page.close();
   }
   await ctx.close();
  }
  await browser.close();
  console.log('ENGINE',engine.name(),'verified',results.length,'failures',issues.length);
 }
 console.log('PLAY_GEOMETRY_CONTRACT',JSON.stringify({checks:results.length,failures:issues.length,issues:issues.slice(0,12)}));
 if(issues.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=2});
