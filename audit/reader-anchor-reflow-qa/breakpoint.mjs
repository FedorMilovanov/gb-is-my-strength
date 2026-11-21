import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const out=process.env.QA_OUT||'reports/reader-anchor-reflow-qa';
const route='/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const builds=[['a595629f','/tmp/mobile-a595629f',19135],['615eff9a','/tmp/mobile-615eff9a',19136]];
const browser=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const records=[];
try{
 for(const [sha,root,port] of builds){
  const origin=`http://127.0.0.1:${port}`;
  const server=spawn('python3',['-u',`${root}/research/reader-w57-pilot/preview.py`],{env:{...process.env,READER_W57_DIST:`${root}/dist`,READER_W57_PORT:String(port)},stdio:['ignore','pipe','ignore']});
  try{
   await Promise.race([new Promise((r,j)=>{server.stdout.once('data',r);server.once('exit',n=>j(Error('server '+n)));}),new Promise((_,j)=>setTimeout(()=>j(Error('server timeout')),4500))]);
   for(const width of [1120,1121,1440]){
    const c=await browser.newContext({viewport:{width,height:900},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
    try{
     await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
     const p=await c.newPage();p.setDefaultTimeout(6500);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
     assert.equal((await p.goto(origin+route)).status(),200);
     if(width<=1120){
      await p.waitForFunction(()=>window.GBReaderState&&window.SCRIPTURE_DATA);
      await p.locator('#part-controversy').evaluate(e=>scrollBy({top:e.getBoundingClientRect().top-70,behavior:'instant'}));
      await p.waitForTimeout(480);await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();
      await p.locator('details.gbr-marginalia-group').filter({has:p.getByText('Писание',{exact:true})}).locator(':scope > summary').tap();
      await p.locator('.gbr-scripture-step').first().waitFor();
     }else{
      const edge=p.locator('#npUEdgeToggle');await edge.waitFor();if(await edge.getAttribute('aria-expanded')!=='true')await edge.click();
      await p.locator('#npUResearch[aria-hidden=false]').waitFor();
     }
     await p.evaluate(()=>document.fonts.ready);
     const metrics=await p.evaluate(()=>{
      const research=document.querySelector('#npUResearch'),box=e=>{const r=e.getBoundingClientRect();return [r.width,r.height].map(x=>Math.round(x*100)/100);};
      return {research:research&&box(research),researchVisible:research?.getAttribute('aria-hidden')==='false',arrows:[...document.querySelectorAll('.gbr-scripture-step')].filter(e=>e.getBoundingClientRect().width>0).map(box),visibleNative:document.querySelector('#partTocOverlay').classList.contains('is-open')};
     });
     records.push({sha,width,...metrics,errors});assert.deepEqual(errors,[]);
     assert.equal(metrics.researchVisible,width>1120);assert.equal(metrics.visibleNative,width<=1120);
    }finally{await c.close();}
   }
  }finally{server.kill();}
 }
 for(const width of [1121,1440]){
  const [before,after]=records.filter(r=>r.width===width);assert.deepEqual(before.research,after.research);assert.deepEqual(after.arrows,[]);
 }
 const after=records.find(r=>r.sha==='615eff9a'&&r.width===1120);assert.equal(after.arrows.length,2);assert.ok(after.arrows.every(([w,h])=>w>=44&&h>=44));
}finally{await browser.close();await mkdir(out,{recursive:true});await writeFile(`${out}/breakpoint.json`,JSON.stringify(records,null,2));}
