// Padding-budget A/B experiment only. Not a production CSS patch or visual approval.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||path.resolve('package.json'));
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8482';
const output=process.env.OUTPUT_DIR||'/tmp/reader-gb-landscape';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const results=[];
const cases=[
  {width:390,height:844,dark:false},{width:390,height:844,dark:true},
  {width:568,height:320,dark:false},{width:568,height:320,dark:true},
  {width:640,height:360,dark:false},{width:844,height:390,dark:false},
  {width:568,height:320,dark:false,safeBottom:21}
];
async function geometry(page){return page.evaluate(()=>{
  const root=document.querySelector('#partTocOverlay');
  const info=s=>{const e=root.querySelector(s),c=getComputedStyle(e);return{rect:e.getBoundingClientRect().toJSON(),padding:c.padding,font:c.font,minHeight:c.minHeight}};
  return Object.fromEntries(['.toc-sheet','.toc-sheet__handle','.toc-sheet__head','.toc-sheet__head .back','.toc-sheet__head .lab','.toc-sheet__head h3','.gbr-marginalia-tabs','.gbr-marginalia-tab','#gbs2PartToc','.gbat-foot','[data-gbat-continue]'].map(s=>[s,info(s)]));
});}
try{
for(const profile of cases)for(const mode of ['baseline','compact-trial','compact+focus-inset']){
 const viewport={width:profile.width,height:profile.height};
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce',colorScheme:profile.dark?'dark':'light'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(dark=>{if(dark)localStorage.setItem('theme','dark')},profile.dark);
 const cdp=await context.newCDPSession(page);let safeError=null;
 if(profile.safeBottom)try{await cdp.send('Emulation.setSafeAreaInsets',{insets:{bottom:profile.safeBottom}})}catch(e){safeError=e.message;}
 if(safeError){results.push({profile,mode,skipped:true,reason:safeError});await context.close();continue;}
 await page.goto(base+'/articles/dzhon-gill-chast-2-uchenyi/');
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
 const native=await page.evaluate(()=>!document.body.classList.contains('np-w57-ready')&&getComputedStyle(document.querySelector('.mobile-top-bar')).display==='flex');
 await page.locator('#mobPartTocBtn').tap();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(450);
 const applied=await page.evaluate(mode=>{
  const compact=mode!=='baseline'&&matchMedia('(orientation:landscape) and (max-height:340px)').matches;
  const inset=mode==='compact+focus-inset'&&matchMedia('(orientation:landscape) and (max-height:400px)').matches;
  // Parameter experiment against existing winning padding (some is !important).
  // Do NOT copy these diagnostic inline overrides into a new cascade layer.
  if(compact){
    const head=document.querySelector('#partTocOverlay .toc-sheet__head');
    head.style.setProperty('padding-top','1px','important');head.style.setProperty('padding-bottom','1px','important');
    const tabs=document.querySelector('#partTocOverlay .gbr-marginalia-tabs');tabs.style.paddingTop='1px';tabs.style.paddingBottom='1px';
  }
  if(inset)document.querySelector('#gbs2PartToc').style.scrollPaddingBlock='6px';
  return{compact,inset};
 },mode);
 const toc=await geometry(page);
 // Actual keyboard reachability, not direct element.focus() on the row.
 await page.locator('#partTocOverlay .toc-sheet__handle').focus();
 let reached=false;
 for(let i=0;i<40;i++){
  if(await page.evaluate(()=>document.activeElement.matches('#partTocOverlay a[href="#sec-canticles"]'))){reached=true;break;}
  await page.keyboard.press('Tab');
 }
 const focused=await page.evaluate(()=>{
  const e=document.activeElement,r=e.getBoundingClientRect(),clip=document.querySelector('#gbs2PartToc').getBoundingClientRect(),c=getComputedStyle(e);
  const outset=c.outlineStyle==='none'?0:Math.max(0,parseFloat(c.outlineWidth)+parseFloat(c.outlineOffset));
  return{href:e.getAttribute('href'),rect:r.toJSON(),clip:clip.toJSON(),outline:c.outline,outlineOffset:c.outlineOffset,
    fullRow:r.top>=clip.top-1&&r.bottom<=clip.bottom+1,
    outlineInClip:r.top-outset>=clip.top-1&&r.bottom+outset<=clip.bottom+1};
 });
 const name=`${mode}-${profile.width}x${profile.height}-${profile.dark?'dark':'light'}-safe${profile.safeBottom||0}`;
 await page.screenshot({path:`${output}/${name}.png`});
 await page.locator('#gbrMarginaliaTab').click();await page.waitForTimeout(450);const analytics=await geometry(page);
 await page.locator('#gbrTocTab').click();await page.waitForTimeout(350);
 const list=await page.locator('#gbs2PartToc').boundingBox();
 const start=await page.locator('#gbs2PartToc').evaluate(e=>e.scrollTop);
 const x=viewport.width*.72,y=list.y+list.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*10}]});await page.waitForTimeout(30);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(600);
 const touch=await page.locator('#gbs2PartToc').evaluate(e=>({scrollTop:e.scrollTop,open:document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='false'}));
 await page.keyboard.press('Escape');await page.waitForTimeout(350);
 const escape=await page.evaluate(()=>document.activeElement.id==='mobPartTocBtn'&&document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='true');
 await page.locator('#mobPartTocBtn').tap();await page.waitForTimeout(350);
 await page.locator('#partTocOverlay .toc-sheet__handle').tap();await page.waitForTimeout(350);
 const close=await page.locator('#partTocOverlay').getAttribute('aria-hidden');
 await page.locator('#mobPartTocBtn').tap();await page.waitForTimeout(350);
 await page.locator('[data-gbat-continue]').tap();await page.waitForTimeout(400);
 const continued=await page.locator('#partTocOverlay').getAttribute('aria-hidden');
 results.push({profile,mode,native,applied,safeError,toc,analytics,reached,focused,touch:{before:start,...touch},escape,close,continued,errors});
 await context.close();
}
}finally{await browser.close();}
fs.writeFileSync(`${output}/landscape.json`,JSON.stringify(results,null,2));
for(const r of results)if(r.skipped)console.log(JSON.stringify(r));else console.log(JSON.stringify({profile:r.profile,mode:r.mode,applied:r.applied,listHeight:r.toc['#gbs2PartToc'].rect.height,fullRow:r.focused.fullRow,outlineInClip:r.focused.outlineInClip,safeError:r.safeError,touch:r.touch,escape:r.escape,close:r.close,continued:r.continued,errors:r.errors}));

// Compare only executed cases; unsupported safe-area experiments never count as passes.
const executed=results.filter(r=>!r.skipped),comparisons=[];
for(const r of executed){
 const baseline=executed.find(b=>JSON.stringify(b.profile)===JSON.stringify(r.profile)&&b.mode==='baseline');
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 comparisons.push({profile:r.profile,mode:r.mode,
  protectedRectanglesEqualBaseline:Object.fromEntries(['.toc-sheet','.toc-sheet__handle','.gbat-foot','[data-gbat-continue]'].map(s=>[s,same(r.toc[s].rect,baseline.toc[s].rect)])),
  sameTOCandAnalyticsRectangles:Object.fromEntries(['.toc-sheet','.toc-sheet__head','.gbr-marginalia-tabs','.gbat-foot'].map(s=>[s,same(r.toc[s].rect,r.analytics[s].rect)])),
  sameTitleFont:r.toc['.toc-sheet__head h3'].font===baseline.toc['.toc-sheet__head h3'].font,
  sameTabTargetHeight:r.toc['.gbr-marginalia-tab'].rect.height===baseline.toc['.gbr-marginalia-tab'].rect.height});
}
const portraitPngComparison=['light','dark'].map(theme=>{
 const a=fs.readFileSync(`${output}/baseline-390x844-${theme}-safe0.png`);
 const b=fs.readFileSync(`${output}/compact+focus-inset-390x844-${theme}-safe0.png`);
 const sha=data=>createHash('sha256').update(data).digest('hex');
 return{theme,viewport:'390x844',pngBytesIdentical:a.equals(b),baselineSha256:sha(a),trialSha256:sha(b)};
});
fs.writeFileSync(`${output}/comparison.json`,JSON.stringify({checks:comparisons,portraitPngComparison},null,2));
// Exit0 means the diagnostic completed, not that baseline defects or all rows passed.
