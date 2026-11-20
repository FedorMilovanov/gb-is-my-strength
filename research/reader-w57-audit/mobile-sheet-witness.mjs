// Non-mutating mobile owner probe. Local preview on :19061. Separate contexts per route/mode.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const routes={gill:'articles/dzhon-gill-chast-2-uchenyi',article:'articles/kod-da-vinchi',chapter:'baptisty-rossii/noch-na-kure'};
const out=process.env.W57_EVIDENCE_DIR;
const failures=[];
if(out)await mkdir(out,{recursive:true});
try {
 for(const [name,slug] of Object.entries(routes)) for(const width of (name==='article'?[320,360,390,430,768,960]:[390])) for(const pilot of [false,true]){
  const context=await browser.newContext({viewport:{width,height:width<768?844:900},isMobile:true,hasTouch:true,locale:'ru-RU',reducedMotion:'reduce'});
  try{
   const p=await context.newPage();p.setDefaultTimeout(4000);
   assert.equal((await p.goto(`http://127.0.0.1:19061/${slug}/${pilot?'?reader-pilot=1&paper=space':''}`)).status(),200);
   await p.waitForLoadState('load');
   await p.waitForSelector('#gb-hl-fab',{state:'attached'});await p.evaluate(()=>document.fonts.ready);
   const trigger=p.locator('.reader-mobile-menu-trigger').first();
   const sheetId=await trigger.getAttribute('aria-controls'), sheet=p.locator('#'+sheetId);
   const snapshot=()=>p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,
    fabParent:document.querySelector('#gb-hl-fab')?.parentElement?.className,
    speedId:document.querySelector('.reader-mobile-speed-badge')?.id,
    active:document.activeElement.id||document.activeElement.className||document.activeElement.tagName,
    scrollY}));
   const row={name,width,pilot,sheetId,triggerVisible:await trigger.isVisible(),before:await snapshot()};
   if(row.triggerVisible){
    await trigger.tap(); await p.waitForTimeout(300);
    row.sheet={hidden:await sheet.getAttribute('aria-hidden'),dialog:await sheet.locator('[role=dialog]').count(),
     focusInside:await sheet.evaluate(e=>e.contains(document.activeElement)),entry:await sheet.getByRole('button',{name:/на полях/i}).or(sheet.getByRole('tab',{name:/на полях/i})).or(sheet.getByRole('link',{name:/на полях/i})).count(),
     headings:await sheet.getByRole('heading').allTextContents()};
    if(out && width===390)await p.screenshot({path:join(out,`${name}-${pilot?'enhanced':'native'}-sheet.jpg`),quality:85});
    if(sheetId==='hmSheet'){
     row.footer=await sheet.locator('.hmsheet-action-btn').evaluateAll(els=>els.map(el=>{
      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
      return {label:el.getAttribute('aria-label')||el.title||el.innerText,hit:el.contains(hit),target:hit?.closest('button')?.id||hit?.tagName,x,y};
     }));
     // Only tap the PDF centre if the W57 control intercepts it; never trigger OS print/share.
     const hijacked=row.footer.find(b=>b.target==='npUOpenResearch'&&!b.hit);
     if(hijacked){
      await p.touchscreen.tap(hijacked.x,hijacked.y);await p.waitForTimeout(200);
      const layers=()=>p.evaluate(()=>({nativeOpen:document.querySelector('#hmSheet').getAttribute('aria-hidden')==='false',researchOpen:document.querySelector('#npUResearch')?.getAttribute('aria-modal')==='true',focus:document.activeElement.id||document.activeElement.tagName}));
      row.afterIntercept=await layers();await p.keyboard.press('Escape');await p.waitForTimeout(200);row.firstEscape=await layers();
     }
    }
    await p.keyboard.press('Escape');await p.waitForTimeout(200);
    row.escape={hidden:await sheet.getAttribute('aria-hidden'),focusOnInvoker:await trigger.evaluate(e=>document.activeElement===e),...await snapshot()};
   } else if(await p.locator('#npUOpenResearch').isVisible()){
    await p.locator('#npUOpenResearch').tap();await p.locator('#npW57NotesDetails summary').tap();
    row.research={modal:await p.locator('#npUResearch').getAttribute('aria-modal'),visible:await p.locator('#npW57Palette').isVisible(),insideNative:await sheet.locator('#npW57NotesDetails').count()};
    if(out && width===390)await p.screenshot({path:join(out,`${name}-pilot-research.jpg`),quality:85});
    await p.keyboard.press('Escape');await p.waitForTimeout(200);row.afterResearch=await snapshot();
   }
   row.chromeOK=row.triggerVisible && row.before.fabParent?.includes('reader-mobile-action-cluster') && row.before.overflow===0;
   if(!row.chromeOK || row.footer?.some(x=>!x.hit) || !row.escape?.focusOnInvoker || (pilot && row.sheet?.entry!==1)) failures.push([name,width,pilot]);
   console.log(JSON.stringify(row));
  }finally{await context.close();}
 }
}finally{await browser.close();}
if(failures.length){console.error('Native chrome, research entry, footer targets or focus differ:',JSON.stringify(failures));process.exitCode=1;}
