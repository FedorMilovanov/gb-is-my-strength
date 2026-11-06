#!/usr/bin/env node
'use strict';
// Live DOM contract against current worktree sources; isolation via temporary HTTP server/browser context.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),reports=path.join(root,'reports/reader-library-v3');
fs.mkdirSync(reports,{recursive:true});
const route='/articles/test-reader-v3/';
const html=[
'<!doctype html><html lang="ru"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<title>Размышления о благодати · Господь Бог — Сила Моя</title>',
'<style>body{margin:0;background:#f9f4ed;color:#332726;font:18px/1.6 Georgia,serif}',
'article{max-width:650px;margin:44px auto;padding:25px;} article p{line-height:1.9}',
'.hmbar{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:end;align-items:center;gap:4px;height:54px;background:#291b20;color:#f8d5c6}',
'.hmbar button{min-width:44px;height:44px;border:0;background:none;color:inherit}',
'@media(min-width:1200px){.hmbar{display:none}}</style>',
'</head><body><main><article data-pagefind-body><h1>Размышления о благодати</h1>',
'<p id="first">Начало статьи. Благодать открывает важные истины и требует внимательного чтения.</p>',
'<h2 id="second">Исследование текста</h2>',
'<p>Нужно прочитать весь контекст, прежде чем сделать вывод. Сохранённые цитаты помогают возвращаться к изученному.</p>',
'<p style="min-height:900px">Продолжение статьи для проверки положения прокрутки.</p>',
'</article></main><div class="hmbar"><button id="hmShareBtn">Поделиться</button></div>',
'<script src="/src/runtime/favorite-store.js"></script><script src="/js/highlights.js"></script>',
'</body></html>'].join('');
const serve=http.createServer((req,res)=>{
 let url=new URL(req.url,'http://localhost');
 let full=path.resolve(root,url.pathname.replace(/^\/+/,''));
 if(!full.startsWith(root+path.sep))return res.writeHead(403).end();
 if(url.pathname.startsWith('/js/')||url.pathname.startsWith('/css/')||url.pathname==='/src/runtime/favorite-store.js'){
   if(!fs.existsSync(full))return res.writeHead(404).end('Missing');
   res.writeHead(200,{'Content-Type':full.endsWith('.css')?'text/css;charset=utf-8':'text/javascript;charset=utf-8','Cache-Control':'no-store'});
   return fs.createReadStream(full).pipe(res);
 }
 res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
 res.end(html);
});
const fixture={
 quotes:[
  {id:'q1',text:'Благодать ведёт к благодарности и внимательному чтению.',before:'До цитаты сохраняется важный контекст.',after:'После цитаты следует пояснение.',articleTitle:'Размышления о благодати',url:route+'#:~:text=test',savedAt:1781150000000},
  {id:'q2',text:'Богословские наблюдения нуждаются в проверке контекстом.',articleTitle:'Основы истолкования',url:'/articles/second/',savedAt:1781140000000}
 ],
 notes:[{id:'n1',text:'Отдельная заметка по исследованию Писания',articleTitle:'Размышления о благодати',url:route,savedAt:1781130000000}],
 favorites:[{path:'/articles/second/',title:'Основы истолкования',addedAt:1781140001000}]
};
async function test(engine,driver,width,height,base){
 const browser=await driver.launch();
 const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,locale:'ru-RU',serviceWorkers:'block'});
 await context.addInitScript((d)=>{
   localStorage.setItem('gb-highlights-v1',JSON.stringify(d.quotes));
   localStorage.setItem('gb-reader-notes-v1',JSON.stringify(d.notes));
   localStorage.setItem('gb-favorites',JSON.stringify(d.favorites));
 },fixture);
 const page=await context.newPage(), errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 const action=(v)=>page.locator('[data-research-action="'+v+'"]');
 const state=()=>page.evaluate(()=>({reading:JSON.parse(localStorage.getItem('gb-library-reading-v1')||'{}'),revisit:JSON.parse(localStorage.getItem('gb-library-revisit-v1')||'{}')}));
 try{
 await page.goto(base+route,{waitUntil:'domcontentloaded'});
 await page.locator('#gb-hl-fab').waitFor();
 await page.locator('#gb-hl-fab').click();
 await page.locator('.gb-hl-item').first().waitFor({timeout:15000});
 await page.waitForFunction(()=>{const p=document.getElementById('gb-hl-panel');return p&&getComputedStyle(p).opacity==='1'&&!p.getAnimations().some(a=>a.playState==='running')},{timeout:8000});
 assert.equal(await page.locator('.gb-hl-item').count(),4);
 assert.equal(await page.locator('#gb-hl-daily').count(),0);
 assert.equal(await page.locator('.gb-hl-daily').count(),1,'daily card available');
 assert.equal(await page.locator('#gb-hl-current').count(),0);
 assert.equal(await action('start-current').count(),1,'explicit reading opt-in');
 const geometry=await page.evaluate(()=>{
   const panel=document.getElementById('gb-hl-panel').getBoundingClientRect();
   return {doc:document.documentElement.scrollWidth,viewport:innerWidth,x:panel.x,right:panel.right,y:panel.y,bottom:panel.bottom,viewportHeight:innerHeight,
     tabs:[...document.querySelectorAll('#gb-hl-tabs button')].map(x=>x.getBoundingClientRect().height)};
 });
 assert(geometry.doc<=width+1 && geometry.x>=-1 && geometry.right<=width+1,JSON.stringify(geometry));
 assert(geometry.tabs.every(x=>x>=43.5),'all tabs accessible');
 if(width>=768)assert(geometry.y>10 && geometry.bottom<height-10,'desktop not centered');
 else assert(Math.abs(geometry.bottom-height)<2,'mobile sheet bottom');
 if(engine==='chromium'){
  await page.screenshot({path:path.join(reports,'chromium-'+width+'-all.png'),animations:'disabled'});
 }
 await page.locator('[data-library-tab=source]').click();
 assert.equal(await page.locator('.gb-hl-source-group').count(),2,'grouped canonical sources');
 assert.equal(await page.locator('.gb-hl-item').count(),4,'all items preserved in groups');
 if(engine==='chromium')await page.screenshot({path:path.join(reports,'chromium-'+width+'-sources.png'),animations:'disabled'});
 await page.locator('[data-library-tab=quote]').click();
 await action('context').first().click();
 assert.equal(await page.locator('.gb-hl-context').count(),1,'context visible');
 assert((await page.locator('.gb-hl-context').first().innerText()).includes('До цитаты'));
 await action('edit-tag').first().click();
 await page.locator('#gb-hl-tag-input').fill('Герменевтика');
 await action('save-tag').click();
 assert.equal(await page.locator('.gb-hl-tag').filter({hasText:'Герменевтика'}).count(),1);
 await action('topic').filter({hasText:'Герменевтика'}).click();
 assert.equal(await page.locator('.gb-hl-item').count(),1,'topic filter');
 await page.locator('#gb-hl-search').fill('благодати');
 assert.equal(await page.locator('.gb-hl-item').count(),1,'Russian search');
 await page.locator('#gb-hl-search').fill('невероятная');
 assert.equal(await page.locator('.gb-hl-empty-title').count(),1,'contextual empty');
 await page.locator('[data-library-action=clear-filters]').click();
 assert.equal(await page.locator('.gb-hl-item').count(),2,'clear filters');
 await page.locator('[data-library-tab=all]').click();
 await action('manage').click();
 assert.equal(await page.locator('#gb-hl-manage-panel').isVisible(),true);
 const [download]=await Promise.all([page.waitForEvent('download'),action('export-json').click()]);
 assert(download.suggestedFilename().endsWith('.json'));
 const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(backup.format,'gospod-bog-reader-library');
 assert.equal(backup.version,3);
 assert.equal(backup.data.quotes.length,2);
 assert.equal(backup.data.notes.length,1);
 assert.equal(backup.data.favorites.length,1);
 assert(backup.data.tags['quote:q1']?.includes('Герменевтика'));
 const addition=structuredClone(backup);
 addition.data.quotes.push({id:'q3',text:'Новая цитата после импорта',articleTitle:'Новое исследование',url:'/articles/third/',savedAt:1781100000000});
 addition.data.notes.push({id:'n2',text:'Новая заметка после импорта',articleTitle:'Новое исследование',url:'/articles/third/',savedAt:1781100000000});
 addition.data.favorites.push({path:'/articles/third/',title:'Новое исследование',addedAt:1781100000000});
 await page.locator('#gb-hl-json-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(addition))});
 await action('confirm-import').click();
 const result=await page.evaluate(()=>({
  quotes:JSON.parse(localStorage.getItem('gb-highlights-v1')).length,
  notes:JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length,
  favorite:window.GBFavoriteStore.has('/articles/third/'),
 }));
 assert.deepEqual(result,{quotes:3,notes:2,favorite:true},'merge import');
 await page.locator('#gb-hl-json-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(addition))});
 await action('confirm-import').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length),2,'repeat import idempotent');
 const malicious={...backup,version:123};
 await page.locator('#gb-hl-json-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malicious))});
 assert.equal(await page.locator('#gb-hl-import-confirm').isVisible(),false,'bad backup rejected');
 const failed=structuredClone(addition);
 failed.data.quotes.push({id:'qfail',text:'Эта цитата не должна сохраниться',articleTitle:'Проверка',url:'/articles/fail/',savedAt:1781100000000});
 failed.data.notes.push({id:'nfail',text:'Эта заметка не должна сохраниться',articleTitle:'Проверка',url:'/articles/fail/',savedAt:1781100000000});
 await page.locator('#gb-hl-json-file').setInputFiles({name:'blocked.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(failed))});
 await page.evaluate(()=>{
  window.__save=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k==='gb-reader-notes-v1')throw new DOMException('blocked','QuotaExceededError');return window.__save.call(this,k,v)};
 });
 await action('confirm-import').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-highlights-v1')).length),3,'quotes rolled back');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length),2,'untouched notes retained');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__save;delete window.__save});
 // Return to the normal library, then exercise explicit reading states.
 await action('manage').click();
 await action('start-current').click();
 assert.equal((await state()).reading['/articles/test-reader-v3'].state,'reading');
 assert.equal(await action('resume').count(),1,'continue only active reading');
 await action('finish-current').click();
 assert.equal((await state()).reading['/articles/test-reader-v3'].state,'finished');
 assert.equal(await action('resume').count(),0,'finished disappears from continue');
 await action('manage').click();
 await action('start-reading').first().click();
 assert.equal((await state()).reading['/articles/test-reader-v3'].state,'reading','explicit restore in menu');
 await action('manage').click();
 await action('dismiss-current').click();
 assert.equal((await state()).reading['/articles/test-reader-v3'].state,'dismissed');
 assert.equal(await action('resume').count(),0,'dismissed disappears');
 assert.equal(await page.locator('.gb-hl-daily').count(),1,'daily quote');
 await action('hide-today').click();
 assert.equal(await page.locator('.gb-hl-daily').count(),0,'hidden today');
 await page.locator('#gb-hl-close').click();
 assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('aria-hidden'),'true');
 await page.locator('#gb-hl-fab').click();
 assert.equal(await page.locator('.gb-hl-daily').count(),0,'daily hidden persists');
 assert.equal(await action('resume').count(),0,'dismissed persists across opening');
 await page.locator('#gb-hl-close').click();
 const scroll=await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
 assert(scroll>200,'page scroll exists');
 assert.deepEqual(errors,[],'JS errors '+JSON.stringify(errors));
 console.log('PASS '+engine+' '+width+'x'+height+' V3 backup/tag/context/search/reading/daily/mobile');
 }finally{await context.close();await browser.close();}
}
(async()=>{await new Promise(r=>serve.listen(0,'127.0.0.1',r));
try{const base='http://127.0.0.1:'+serve.address().port;
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]])
 for(const [w,h] of [[320,640],[390,844],[768,900],[1440,900]])await test(name,driver,w,h,base);
console.log('READER LIBRARY V3: 8/8 PASS');}finally{serve.close();}})().catch(e=>{console.error(e);process.exitCode=1;serve.close()});