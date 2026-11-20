// Opt-in preview only. Observe requests and DOM; never inject a mock controller.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base='http://127.0.0.1:19061';
const gill='/articles/dzhon-gill-chast-2-uchenyi/';
const opt='?reader-pilot=1&paper=space&panel=open';
try {
 for (const [width,path,desktop] of [[320,gill+opt,false],[960,gill+opt,false],[1120,gill+opt,false],[1121,gill+opt,true],[1440,gill+opt,true],[1440,gill,false],[1440,'/' + opt,false]]) {
  const ctx=await browser.newContext({viewport:{width,height:900},locale:'ru-RU',reducedMotion:'reduce'});
  try {
   const p=await ctx.newPage();p.setDefaultTimeout(5000);
   const assets=[],errors=[];p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/__reader_w57__/'))assets.push(r.url().split('/').pop())});p.on('pageerror',e=>errors.push(e.message));
   const status=(await p.goto(base+path)).status();assert.equal(status,200);
   const ready=()=>p.evaluate(()=>Boolean(window.__NP_W57_ANNOTATIONS__?.ready));
   if(desktop)await p.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);
   await p.evaluate(()=>document.fonts.ready);
   const count=await p.locator('#npUniversalDemo').count();
   assert.equal(await ready(),desktop);assert.equal(count,desktop?1:0);assert.equal(assets.length,desktop?12:0);assert.equal(new Set(assets).size,assets.length);
   console.log(JSON.stringify({width,path,status,assets:assets.length,shell:count,errors}));assert.deepEqual(errors,[]);
   if(desktop && width===1440){
    // A viewport transition is not a navigation. Replacing the document here loses the draft.
    await p.locator('#npULibraryButton').click();await p.locator('#gb-hl-new-note').click();
    const field=p.locator('#gb-hl-note-text');const draft='Несохранённая мысль перед поворотом';await field.fill(draft);
    const origin=await p.evaluate(()=>performance.timeOrigin);
    await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
    assert.equal(await field.inputValue(),draft);assert.equal(await p.evaluate(()=>performance.timeOrigin),origin);
    const owner=await p.locator('#gb-hl-fab').evaluate(el=>el.parentElement.className);
    console.log(JSON.stringify({transition:'1440 → 390, open editor',sameDocument:true,draftIntact:true,fabParent:owner}));
    await p.setViewportSize({width,height:900});await field.waitFor();await p.locator('#gb-hl-editor [type="submit"]').click();
    await p.locator('#gb-hl-list').getByText(draft,{exact:true}).waitFor();
   }
  }finally{await ctx.close()}
 }
}finally{await browser.close()}
