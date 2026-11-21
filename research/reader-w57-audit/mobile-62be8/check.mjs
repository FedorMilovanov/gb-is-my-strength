// Run on an isolated dist preview; fresh profile per case, no writes to production.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const path='/articles/dzhon-gill-chast-2-uchenyi/',url=(process.env.READER_URL||'http://127.0.0.1:19069')+path+'?reader-pilot=1';
const shots=process.env.SHOTS;
async function run(test,width,height,fn){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const p=await ctx.newPage(),row={test,width,height,errors:[]};p.on('pageerror',e=>row.errors.push(e.message));p.setDefaultTimeout(7000);p.setDefaultNavigationTimeout(20000);
 try{assert.equal((await p.goto(url)).status(),200);await p.evaluate(()=>document.fonts.ready);await fn(p,row);row.pass=true}catch(e){row.pass=false;row.failure=e.message.split('\n').slice(0,7).join(' ');if(shots)await p.screenshot({path:`${shots}/${test}-${width}-${height}.jpg`});process.exitCode=1}finally{console.log(JSON.stringify(row));await ctx.close()}
}
const fab=p=>p.locator('#gb-hl-fab').tap();
const rect=el=>el.evaluate(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}});
async function library(p,row,shrink){
 await fab(p);const panel=p.locator('#gb-hl-panel'),add=p.locator('#gb-hl-new-note'),field=p.locator('#gb-hl-note-text');
 await p.waitForTimeout(400);row.panel=await panel.evaluate(el=>({height:el.clientHeight,extent:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));row.add=await rect(add);if(shots&&row.height===521)await p.screenshot({path:`${shots}/boundary.jpg`});row.step='new-note';await add.tap();await field.fill('Проверка сохранения');if(shrink)await p.setViewportSize({width:row.width,height:350});row.step='save';await p.locator('#gb-hl-editor [type=submit]').tap();await p.reload();await fab(p);row.step='reopen';await p.locator('[data-library-tab=note]').tap();await p.locator('[data-library-action=edit-note]').first().tap();assert.equal(await field.inputValue(),'Проверка сохранения');row.step='verified';
}
async function fonts(p,row){
 const state=()=>p.evaluate(()=>{const p=document.querySelector('.article-body p[id]')||document.querySelector('.article-body p');return {id:p.id,paragraph:p.textContent.slice(0,45),family:getComputedStyle(p).fontFamily,pref:document.documentElement.dataset.readerFontFamily,selected:document.querySelector('[data-gill-font][aria-pressed=true]')?.dataset.gillFont}});
 await p.locator('#mobSettingsBtn').tap();row.before=await state();await p.locator('[data-gill-font=cormorant]').tap();row.after=await state();if(shots&&row.width===390)await p.screenshot({path:`${shots}/settings.jpg`});await p.reload();row.reload=await state();assert.match(row.after.family,/cormorant/i);assert.equal(row.after.selected,'cormorant');assert.match(row.reload.family,/cormorant/i);assert.equal(row.reload.selected,'cormorant');
}
async function imports(p,row,anchored){
 await fab(p);await p.locator('#gb-hl-manage').tap();const act=name=>p.locator(`[data-research-action="${name}"]`),confirm=p.locator('#gb-hl-import-confirm');
 async function file(name,buffer){const choose=p.waitForEvent('filechooser');await act('import-json').tap();await (await choose).setFiles({name,mimeType:'application/json',buffer})}
 const backup=Buffer.from(JSON.stringify({format:'gospod-bog-reader-library',version:3,data:{quotes:['first','second'].map((id,i)=>({id,text:'Одинаковый текст',url:path,before:'Контекст '+i,...(anchored?{annotation:{version:1,kind:'marker',anchor:{blockId:'p-'+i,blockIndex:i,start:0,end:16,exact:'Одинаковый текст'}}}:{})})),notes:[{id:'note',text:'Связана со второй',quoteId:'second',url:path}],favorites:[]}}));
 await file('A.json',backup);await confirm.waitFor();await file('B.json',Buffer.alloc(4194305));await confirm.waitFor({state:'hidden'});row.afterB=await p.locator('#gb-hl-status').innerText();assert.match(row.afterB,/4 МБ/);assert.equal(await p.evaluate(()=>localStorage.getItem('gb-highlights-v1')),null);
 for(let i=0;i<2;i++){await file('A.json',backup);await confirm.waitFor();const start=Date.now();await act('confirm-import').tap({timeout:9000});(row.tapMs??=[]).push(Date.now()-start);await confirm.waitFor({state:'hidden'})}await p.reload();await fab(p);
 row.storageGuard=await p.evaluate(()=>!!Storage.prototype.__gbHighlightDedupe);row.stored=await p.evaluate(()=>({ids:JSON.parse(localStorage.getItem('gb-highlights-v1')).map(q=>q.id),links:JSON.parse(localStorage.getItem('gb-reader-notes-v1')).map(n=>n.quoteId)}));assert.deepEqual(row.stored,{ids:['first','second'],links:['second']});
}
try{for(const [w,h] of [[568,320],[844,390],[390,450],[320,500],[320,520],[320,521],[390,530],[320,568],[390,844]])await run('library',w,h,(p,r)=>library(p,r,false));await run('shrink',320,844,(p,r)=>library(p,r,true));for(const w of [320,390])await run('font',w,844,fonts);for(const h of [450,844])for(const anchored of [false,true])await run(anchored?'range-import':'plain-import',390,h,(p,r)=>imports(p,r,anchored))}finally{await browser.close()}
