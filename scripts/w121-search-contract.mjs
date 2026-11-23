import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
// Run against the explicit W57 preview server with a built Pagefind index.
const BASE=process.env.AUDIT_BASE||'http://127.0.0.1:8618',ROUTE='/articles/dzhon-gill-chast-2-uchenyi/';
const checks=[],failures=[];
const ck=(n,good,detail='')=>{checks.push({name:n,ok:!!good,detail});console.log((good?'PASS ':'FAIL ')+n+' '+detail);if(!good)failures.push(n+' '+detail);};
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
const b=await engine.launch({headless:true});
for(const [kind,w] of [['mobile',390],['desktop-W57',1440]]){
const c=await b.newContext({viewport:{width:w,height:900},serviceWorkers:'block',colorScheme:'light',reducedMotion:'reduce'});
await c.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:''}));
const p=await c.newPage(),errors=[];
p.on('pageerror',e=>errors.push(String(e)));
try{
 const start=BASE+ROUTE+(w>1120?'?reader-pilot=1&paper=space&panel=open':'');
 await p.goto(start,{waitUntil:'domcontentloaded',timeout:30000});
 if(kind==='mobile'){
   await p.locator('#mobPartTocBtn').click();
   await p.locator('#gbrMarginaliaTab').click();
   await p.locator('#gbrMarginalia:not([hidden])').waitFor({timeout:8000});
   const action=p.getByRole('button',{name:'Поиск по сайту'});
   ck(name+' mobile Analytics owns search CTA',await action.count()===1);
   await action.click();
 } else {
   const control=p.locator('#gbSearchBtn:visible,[data-fc-action="search"]:visible,.gb-nav-search-icon:visible').first();
   if(await control.count())await control.click();
   else await p.evaluate(()=>window.GBSearch?.open?.());
 }
 await p.locator('.cp-backdrop.is-open').waitFor({timeout:13000});
 ck(name+' '+kind+' search palette opens',true);
 await p.locator('.cp-input').fill('Маришальского');
 await p.waitForFunction(()=>!!window.__pagefindReady__&&document.querySelectorAll('#cp-listbox .cp-item').length>=1,null,{timeout:18000});
 const list=await p.locator('#cp-listbox .cp-item').allTextContents();
 ck(name+' '+kind+' finds paragraph word',list.some(t=>t.includes('Часть II')),list.slice(0,2).map(t=>t.slice(0,90)).join(' | '));
 const target=p.locator('#cp-listbox .cp-item').filter({hasText:'Часть II'}).first();
 await target.click();
 await p.waitForURL(url=>url.pathname===ROUTE,{timeout:10000});
 await p.waitForFunction(()=>document.activeElement?.tagName==='P'||document.activeElement?.tagName==='LI'||document.activeElement?.tagName==='BLOCKQUOTE',null,{timeout:12000});
 // W57 is loaded by a deferred pilot bootstrap; do not classify a still-hydrating page as a desktop rollback.
 if(kind==='desktop-W57')await p.waitForFunction(()=>document.body.classList.contains('np-w57-ready'),null,{timeout:25000});
 const state=await p.evaluate(()=>({
   pathname:location.pathname,href:location.href,w57:document.body.classList.contains('np-w57-ready'),hash:location.hash,focusTag:document.activeElement?.tagName,
   text:document.activeElement?.textContent?.slice(0,140),selected:window.getSelection()?.toString()?.slice(0,75),
   within:document.activeElement?.closest('article.article-body')!==null,
   scrollY:scrollY,
   hasStudy:!!document.getElementById('gbAnalyticsStudy')
 }));
 ck(name+' '+kind+' source occurrence focuses real article paragraph',
   state.within&&state.selected?.toLocaleLowerCase('ru').includes('маришальского'),JSON.stringify(state));
 ck(name+' '+kind+' retains Reader quiz',state.hasStudy);
 if(kind==='desktop-W57'){
   ck(name+' W57 search result preserves pilot desktop',state.w57&&state.href.includes('reader-pilot=1'),state.href);
   // Pagefind uses a direct Enter handler on its combobox; this must follow the
   // same source-word + W57 preservation route as a mouse result click.
   const opener=p.locator('#gbSearchBtn:visible,[data-fc-action="search"]:visible,.gb-nav-search-icon:visible').first();
   await opener.click();
   await p.locator('.cp-input').fill('Маришальского');
   const choices=p.locator('#cp-listbox .cp-item');
   await p.waitForFunction(()=>document.querySelectorAll('#cp-listbox .cp-item').length>=2,null,{timeout:18000});
   const labels=await choices.allTextContents();
   const index=labels.findIndex(s=>s.includes('Часть II'));
   if(index<0)throw Error('keyboard target missing');
   await p.locator('.cp-input').focus();
   for(let i=0;i<=labels.length;i++){
     if(await p.locator('.cp-input').getAttribute('aria-activedescendant')==='cp-option-'+index)break;
     await p.keyboard.press('ArrowDown');
   }
   await p.keyboard.press('Enter');
   await p.waitForFunction(()=>document.body.classList.contains('np-w57-ready')&&new URLSearchParams(location.search).get('reader-pilot')==='1'&&window.getSelection()?.toString().includes('Маришальского'),null,{timeout:25000});
   ck(name+' W57 keyboard Enter preserves Reader and exact paragraph',await p.evaluate(()=>
     document.body.classList.contains('np-w57-ready')&&
     window.getSelection()?.toString().includes('Маришальского')&&
     !!document.querySelector('#gbAnalyticsStudy')));
 }
 ck(name+' '+kind+' no page errors',!errors.length,errors.slice(0,2).join(' | '));
 }catch(e){ck(name+' '+kind+' FATAL',false,String(e).slice(0,420));}
 finally{await c.close()}
}
await b.close();
}
fs.mkdirSync('reports/series-quiz-source-handoff',{recursive:true});
fs.writeFileSync('reports/series-quiz-source-handoff/w121-search-contract.json',JSON.stringify({checks,failures},null,2));
console.log('SEARCH_CONTRACT checks='+checks.length+' failures='+failures.length);
if(failures.length)process.exitCode=1;