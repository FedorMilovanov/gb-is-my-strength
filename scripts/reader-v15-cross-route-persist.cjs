const fs=require('fs'),path=require('path'),{chromium,firefox,webkit}=require('playwright');
(async()=>{
 const out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_INTEGRATED_V15_QA_20261112'),results=[];
 for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch(),context=await browser.newContext({viewport:{width:1593,height:900},reducedMotion:'reduce'}),page=await context.newPage();
 const row={engine:name};
 try{
  let r=await page.goto('http://127.0.0.1:8831/baptisty-rossii/',{waitUntil:'domcontentloaded'});
  if(r.status()!==200)throw Error('book unavailable');
  await page.waitForFunction(()=>document.querySelector('[data-reader-integrated-rail]')?.dataset.readerRailFoldReady==='1');
  await page.locator('[data-reader-rail-toggle]').click();
  let state=await page.evaluate(()=>({fold:document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),saved:sessionStorage.getItem('gb:reader-integrated-rail:compact')}));
  if(!state.fold||state.saved!=='1')throw Error('State not persisted on book');
  r=await page.goto('http://127.0.0.1:8831/baptisty-rossii/noch-na-kure/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-reader-integrated-rail]')?.dataset.readerRailFoldReady==='1');
  state=await page.evaluate(()=>({fold:document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),hidden:document.querySelector('[data-reader-fold-content]').inert,corner:!!document.querySelector('.reader-rail-compact-tools>.gbs-theme-corner')}));
  if(!state.fold||!state.hidden||!state.corner)throw Error('Chapter lost fold/controls');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>!document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),{timeout:3000});
  state=await page.evaluate(()=>({fold:document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),hidden:document.querySelector('[data-reader-fold-content]').inert,rail:getComputedStyle(document.querySelector('[data-reader-integrated-rail]')).display,corner:!!document.querySelector('.reader-rail-compact-tools>.gbs-theme-corner')}));
  if(state.fold||state.hidden||state.rail!=='none'||state.corner)throw Error('Mobile did not restore native controls');
  await page.setViewportSize({width:1593,height:900});
  await page.waitForFunction(()=>document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),{timeout:3000});
  state=await page.evaluate(()=>({fold:document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),hidden:document.querySelector('[data-reader-fold-content]').inert,corner:!!document.querySelector('.reader-rail-compact-tools>.gbs-theme-corner')}));
  if(!state.fold||!state.hidden||!state.corner)throw Error('Desktop fold not restored after resize');
  await page.locator('[data-reader-rail-toggle]').focus();
  await page.keyboard.press('Enter');
  state=await page.evaluate(()=>({fold:document.querySelector('[data-reader-integrated-rail]').classList.contains('reader-integrated-rail--compact'),hidden:document.querySelector('[data-reader-fold-content]').inert,saved:sessionStorage.getItem('gb:reader-integrated-rail:compact')}));
  if(state.fold||state.hidden||state.saved!=='0')throw Error('Keyboard reopen failed');
  row.pass=true;
 }catch(e){row.pass=false;row.error=String(e).slice(0,600)}
 results.push(row);await browser.close();
 }
 fs.writeFileSync(path.join(out,'V15_CROSS_ROUTE_RESIZE_KEYBOARD.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 if(results.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});
