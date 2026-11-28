import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
const BASE=process.env.AUDIT_BASE||'http://127.0.0.1:8618';
const route='/articles/dzhon-gill-chast-2-uchenyi/';
const failures=[],checks=[];
function check(label,condition,detail=''){checks.push({label,ok:!!condition,detail});if(!condition)failures.push(label+' '+detail);console.log((condition?'PASS ':'FAIL ')+label+' '+detail);}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block',isMobile:true,hasTouch:true});
  await ctx.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:'',contentType:'text/plain'}));
  const p=await ctx.newPage(), errors=[];
  p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(BASE+route,{waitUntil:'domcontentloaded'});
  await p.locator('#gbAnalyticsStudy > summary').click();
  await p.locator('#gbAnalyticsQuiz .gb-study-options button').first().click();
  const link=p.locator('#gbAnalyticsQuiz .gb-study-feedback a').first();
  const before=p.url();
  try{
    const pop=ctx.waitForEvent('page',{timeout:9000});
    await link.click({modifiers:['Control']});
    const other=await pop;await other.waitForLoadState('domcontentloaded',{timeout:10000});
    check(name+' Ctrl+click opens separate tab',other.url().includes('/articles/dzhon-gill-chast-2-uchenyi/'),other.url());
    check(name+' Ctrl+click leaves original state',p.url()===before && await p.locator('#gbAnalyticsQuiz .gb-study-feedback').count()===1);
    await other.close();
  }catch(e){check(name+' Ctrl+click browser intent',false,String(e).slice(0,280));}
  try{
    const pop=ctx.waitForEvent('page',{timeout:9000});
    await link.focus();await p.keyboard.press('Control+Enter');
    const other=await pop;await other.waitForLoadState('domcontentloaded',{timeout:10000});
    check(name+' Ctrl+Enter opens separate tab',other.url().includes('/articles/dzhon-gill-chast-2-uchenyi/'),other.url());
    check(name+' Ctrl+Enter leaves original state',p.url()===before && await p.locator('#gbAnalyticsQuiz .gb-study-feedback').count()===1);
    await other.close();
  }catch(e){check(name+' Ctrl+Enter browser intent',false,String(e).slice(0,280));}
  // Storage isolation: UI must not silently migrate, clear, or overwrite notes.
  await p.evaluate(()=>{
    localStorage.setItem('gb-reader-notes-v1',JSON.stringify([{id:'w121-temp-text-note',text:'Audit only',url:location.origin+location.pathname}]));
    localStorage.setItem('gb-highlights-v1',JSON.stringify([{id:'w121-temp-quote-note',text:'Existing quote with note',note:'Audit only',url:location.origin+location.pathname}]));
  });
  const beforeStorage=await p.evaluate(()=>[localStorage.getItem('gb-reader-notes-v1'),localStorage.getItem('gb-highlights-v1')]);
  await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('#gbAnalyticsStudy:not([hidden])').waitFor({timeout:15000});
  const afterStorage=await p.evaluate(()=>[localStorage.getItem('gb-reader-notes-v1'),localStorage.getItem('gb-highlights-v1')]);
  check(name+' text note and quote+note intact after reload',JSON.stringify(beforeStorage)===JSON.stringify(afterStorage));
  check(name+' no uncaught errors',errors.length===0,errors.join(' | ').slice(0,150));
  await ctx.close();
  const dc=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await dc.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:''}));
  const d=await dc.newPage();
  await d.goto(BASE+route+'?reader-pilot=1&paper=space&panel=open',{waitUntil:'domcontentloaded'});
  await d.waitForFunction(()=>document.body.classList.contains('np-w57-ready'),null,{timeout:18000});
  await d.waitForFunction(()=>!!document.querySelector('#npUResearch .np-u-right-scroll #gbAnalyticsStudy'),null,{timeout:18000});
  const launcher=d.locator('#quizPlaceholder .gb-study-inline-launch:visible');
  check(name+' W57 end-of-article quiz entry exists',await launcher.count()===1);
  if(await launcher.count()){
    await launcher.click();
    check(name+' W57 end-of-article entry opens same quiz',await d.locator('#npUResearch #gbAnalyticsStudy').evaluate(e=>e.open)&&
       await d.locator('#npUResearch #gbAnalyticsStudy > summary').evaluate(e=>document.activeElement===e));
  }
  const plain=await d.goto(BASE+route,{waitUntil:'domcontentloaded'});
  check(name+' normal desktop inline fallback',plain?.status()===200&&await d.locator('#quizPlaceholder #gbAnalyticsStudy').count()===1);
  await dc.close();
 }catch(e){check(name+' FATAL',false,String(e).slice(0,380));}finally{await browser.close();}
}
fs.mkdirSync('reports/series-quiz-source-handoff',{recursive:true});
fs.writeFileSync('reports/series-quiz-source-handoff/w121-modifier-cta.json',JSON.stringify({checks,failures},null,2));
console.log('W121 MODIFIER/CTA '+checks.length+' checks; failures='+failures.length);
if(failures.length)process.exitCode=1;