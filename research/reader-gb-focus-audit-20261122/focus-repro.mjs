// Native anchor navigation focus vs dismissal, without replacing scrolling or Product JS.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || path.resolve('package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8480';
const output = process.env.OUTPUT_DIR || '/tmp/reader-gb-focus-test';
const route = process.env.ROUTE || '/articles/dzhon-gill-chast-2-uchenyi/';
const anchorIds = (process.env.ANCHOR_IDS || 'sec-canticles,sec-quiz').split(',');
fs.mkdirSync(output,{recursive:true});
const browser = await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const results=[];
async function settle(page) {
  await page.waitForTimeout(350);
  return page.evaluate(async()=>{
    let last=null,n=0;
    for(let i=0;i<60;i++){
      await new Promise(r=>setTimeout(r,100));
      const y=scrollY;n=last!==null&&Math.abs(y-last)<1?n+1:0;last=y;
      if(n>=6)return true;
    }
    return false;
  });
}
async function open(page){await page.locator('#mobPartTocBtn').focus();await page.keyboard.press('Enter');await page.waitForTimeout(450);}
async function tabTo(page,selector){
  for(let i=0;i<80;i++){
    if(await page.evaluate(s=>document.activeElement.matches(s),selector))return;
    await page.keyboard.press('Tab');
  }
  throw Error('Not reached by Tab: '+selector);
}
try{
  for(const viewport of [{width:390,height:844},{width:568,height:320},{width:640,height:360},{width:844,height:390}]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();
    await page.goto(base+route);
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
    const row={route,viewport,checks:[],anchors:[]};
    const check=(name,pass,details)=>row.checks.push({name,pass,details});
    for(const id of anchorIds){
      const original=await page.locator('#'+id).getAttribute('tabindex');
      await open(page);await tabTo(page,`#partTocOverlay a[href="#${id}"]`);
      await page.evaluate(()=>{
        window.__focusProbe=[];window.__closeProbe=[];
        if(!window.__focusProbeBound){
          window.__focusProbeBound=true;
          document.addEventListener('focusin',e=>window.__focusProbe.push(e.target.id||e.target.tagName));
          document.addEventListener('gb:overlay-close',e=>window.__closeProbe.push(e.detail));
        }
      });
      await page.keyboard.press('Enter');const stable=await settle(page);
      const after=await page.evaluate(id=>({hash:location.hash,focus:document.activeElement.id,
        top:document.getElementById(id).getBoundingClientRect().top,
        tag:document.getElementById(id).tagName,focusTrace:window.__focusProbe,closeTrace:window.__closeProbe,
        hidden:document.querySelector('#partTocOverlay').getAttribute('aria-hidden')}),id);
      row.anchors.push({id,original,after});
      check(`${id}: native hash/visible settled target`,stable&&after.hash==='#'+id&&after.top>=0&&after.top<viewport.height&&after.hidden==='true',after);
      check(`${id}: exact destination owns focus`,after.focus===id,after.focus);
      check(`${id}: no transient opener focus`,!after.focusTrace.includes('mobPartTocBtn'),after.focusTrace);
      check(`${id}: canonical owner close reason navigate`,after.closeTrace.some(e=>e.ownerId==='gill-part-toc'&&e.reason==='navigate'),after.closeTrace);
      await page.keyboard.press('Tab');
      check(`${id}: temporary tabindex removed on blur`,await page.locator('#'+id).getAttribute('tabindex')===original);
    }
    await open(page);await page.keyboard.press('Escape');await page.waitForTimeout(400);
    check('Escape restores opener',await page.evaluate(()=>document.activeElement.id==='mobPartTocBtn'&&document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='true'));
    await open(page);await page.keyboard.press('Enter');await page.waitForTimeout(400);
    check('Initial Close Enter restores opener',await page.evaluate(()=>document.activeElement.id==='mobPartTocBtn'&&document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='true'));
    await open(page);await tabTo(page,'[data-gbat-continue]');await page.keyboard.press('Enter');await settle(page);
    check('Continue keeps existing opener-return policy',await page.evaluate(()=>document.activeElement.id==='mobPartTocBtn'&&document.getElementById('partTocOverlay').getAttribute('aria-hidden')==='true'));
    results.push(row);await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(`${output}/focus.json`,JSON.stringify(results,null,2));
const checks=results.flatMap(r=>r.checks);console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));
process.exitCode=checks.every(c=>c.pass)?0:1;
