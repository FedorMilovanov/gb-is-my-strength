// Browser contract for personal library: real production-like pages and isolated seeded storage.
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist');
const out=path.resolve(__dirname,'../reports/reader-library-premium');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const srv=http.createServer((req,res)=>{
 let f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));
 if(!f.startsWith(root))return res.writeHead(403).end();
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 if(!fs.existsSync(f))return res.writeHead(404).end('not found');
 res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});
 fs.createReadStream(f).pipe(res);
});
const route='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const fixture={
 q:[{id:'qa',text:'Краткая проверочная цитата о доверии Писанию и внимательном чтении.',articleTitle:'Герменевтика и Писание',url:route,savedAt:1781100000000},
    {id:'qb',text:'Богословское рассуждение следует проверять словами Писания. '.repeat(18),articleTitle:'Исследование Писания',url:'/articles/lot-i-sodom/',savedAt:1781200000000}],
 n:[{id:'na',text:'Сравнить толкования, проверить контекст и сформулировать вывод.',articleTitle:'Герменевтика и Писание',url:route,savedAt:1781300000000}],
 f:[{path:'/articles/kod-da-vinchi/',title:'Код да Винчи — исследование',description:'Избранный материал для чтения',addedAt:1781250000000}]
};
const checks=[];
async function check(engine,driver,width,height,base,advanced){
 const browser=await driver.launch();
 const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block',acceptDownloads:true,locale:'ru-RU'});
 await ctx.addInitScript(data=>{
  localStorage.setItem('gb-highlights-v1',JSON.stringify(data.q));
  localStorage.setItem('gb-reader-notes-v1',JSON.stringify(data.n));
  localStorage.setItem('gb-favorites',JSON.stringify(data.f));
 },fixture);
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('#gb-hl-fab').waitFor({state:'visible'});
  await page.locator('#gb-hl-fab').click();
  await page.locator('.gb-hl-item').first().waitFor();
  // Wait for the actual final painted frame, not a wall-clock delay:
  // WebKit on CI can schedule the first animation frame after a busy build.
  await page.waitForFunction(() => {
    const panel = document.querySelector('#gb-hl-panel');
    return panel && getComputedStyle(panel).opacity === '1' &&
      !panel.getAnimations().some((animation) => animation.playState === 'running');
  }, null, { timeout: 7000 });
  await page.evaluate(() => document.fonts.ready);
  const g=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};
   const panel=document.querySelector('#gb-hl-panel'),list=document.querySelector('#gb-hl-list');
   return{scroll:document.documentElement.scrollWidth-innerWidth,rect:rect('#gb-hl-panel'),backdrop:rect('#gb-hl-backdrop'),listScroll:list.scrollHeight>list.clientHeight,
   close:rect('#gb-hl-close'),tabs:[...document.querySelectorAll('#gb-hl-tabs button')].map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),
   panelBackground:getComputedStyle(panel).backgroundColor, panelOpacity:getComputedStyle(panel).opacity, handle:getComputedStyle(document.querySelector('#gb-hl-handle')).display};
  });
  assert(g.scroll<=1,'horizontal overflow '+JSON.stringify(g));
  assert(g.rect.x>=-1&&g.rect.x+g.rect.w<=width+1&&g.rect.bottom<=height+1,'library out of viewport '+JSON.stringify(g));
  assert(g.tabs.every(t=>t.h>=43.5),'library tabs too small '+JSON.stringify(g));
  assert(g.close.w>=43.5&&g.close.h>=43.5,'close touch target too small');
  assert.equal(g.panelOpacity,'1','panel still translucent after opening');
  if(width>=768){assert(g.rect.y>20,'desktop library stuck as bottom sheet');assert(g.rect.bottom<height-20,'desktop library touches bottom');assert.equal(g.handle,'none');}
  else{assert(Math.abs(g.rect.bottom-height)<1.1,'mobile sheet not bottom-docked');}
  if(engine==='chromium')await page.screenshot({path:path.join(out,engine+'-'+width+'-all.png'),animations:'disabled'});
  assert.equal(await page.locator('.gb-hl-item').count(),4,'all four seeded entries');
  for(const [tab,count] of [['quote',2],['note',1],['favorite',1]]){
   await page.locator('[data-library-tab="'+tab+'"]').click();
   assert.equal(await page.locator('.gb-hl-item').count(),count,tab+' filter');
   if(engine==='chromium' && advanced)await page.screenshot({path:path.join(out,engine+'-'+width+'-'+tab+'.png'),animations:'disabled'});
  }
  await page.locator('[data-library-tab="quote"]').click();
  const search=page.locator('#gb-hl-search');
  await search.fill('Богословское рассуждение');
  assert.equal(await page.locator('.gb-hl-item').count(),1,'search in quotes');
  await search.fill('');
  const cardDownload=page.waitForEvent('download');
  await page.locator('[data-library-action="card"]').first().click();
  assert((await cardDownload).suggestedFilename().endsWith('.png'),'quote-card PNG download');
  await page.locator('[data-library-action="expand"]').first().click();
  assert.equal(await page.locator('[data-library-action="expand"]').first().getAttribute('aria-expanded'),'true');
  await page.locator('[data-library-action="note-for-quote"]').first().click();
  assert.equal(await page.locator('#gb-hl-editor').isVisible(),true,'quote-context editor');
  await page.locator('#gb-hl-note-cancel').click();
  await page.locator('#gb-hl-new-note').click();
  assert.equal(await page.locator('#gb-hl-editor').isVisible(),true);
  assert.equal(await page.locator('#gb-hl-foot').isVisible(),false,'new-note action must not duplicate editor controls');
  if(engine==='chromium')await page.screenshot({path:path.join(out,engine+'-'+width+'-editor.png'),animations:'disabled'});
  await page.locator('#gb-hl-note-text').fill('Новая локальная заметка для регрессионного теста');
  await page.locator('#gb-hl-editor button[type=submit]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length),2,'new note storage');
  assert.equal(await page.locator('[data-library-tab="note"]').getAttribute('aria-pressed'),'true','save opens notes tab');
  const first=page.locator('.gb-hl-item').first();
  await first.locator('[data-library-action="edit-note"]').click();
  await page.locator('#gb-hl-note-text').fill('Отредактированная локальная заметка');
  await page.locator('#gb-hl-editor button[type=submit]').click();
  assert((await page.locator('#gb-hl-list').innerText()).includes('Отредактированная локальная заметка'),'edited note visible');
  await page.locator('.gb-hl-item').first().locator('[data-library-action="delete"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length),1,'delete note');
  await page.locator('#gb-hl-status [data-library-action="undo"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length),2,'undo restores note');
  const download=page.waitForEvent('download');
  await page.locator('#gb-hl-export').click();
  const file=await download;
  assert(file.suggestedFilename().endsWith('.md'),'Markdown export file extension');
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  const darkBg=await page.locator('#gb-hl-panel').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(darkBg,'rgb(33, 27, 27)','dark library paper');
  if(engine==='chromium'&&advanced)await page.screenshot({path:path.join(out,engine+'-'+width+'-night.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-reader-theme','sepia')});
  const sepiaBg=await page.locator('#gb-hl-panel').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(sepiaBg,'rgb(247, 239, 223)','sepia library paper');
  const sepiaLink=await page.locator('#gb-hl-panel .gb-hl-meta a').first().evaluate(el=>({link:getComputedStyle(el).color,accent:getComputedStyle(document.querySelector('#gb-hl-panel')).getPropertyValue('--library-accent').trim()}));
  assert.equal(sepiaLink.link,'rgb(133, 89, 66)','sepia source link uses library accent');
  if(engine==='chromium'&&advanced)await page.screenshot({path:path.join(out,engine+'-'+width+'-sepia.png'),animations:'disabled'});
  await page.locator('#gb-hl-close').click();
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('aria-hidden'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'gb-hl-fab','opener focus restored');
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'gb-hl-fab','resize preserves opener focus');
  assert.deepEqual(errors,[],'page errors');
  checks.push(engine+'-'+width+': PASS');
  console.log('PASS '+engine+' '+width+'x'+height+' '+JSON.stringify(g));
 }finally{await ctx.close();await browser.close();}
}
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));try{
 const base='http://127.0.0.1:'+srv.address().port;
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]])
  for(const [width,height] of [[320,640],[390,844],[768,900],[1440,900]])
   await check(engine,driver,width,height,base,width===390||width===1440);
 console.log('READER LIBRARY PREMIUM 8/8 PASS');
}finally{srv.close()}})().catch(e=>{console.error(e);process.exitCode=1;srv.close()});