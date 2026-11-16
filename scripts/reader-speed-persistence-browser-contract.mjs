#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST=resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml',
  '.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
let server=null;
let base=process.env.AUDIT_BASE;
if(!base){
  server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(String(req.url||'/').split('?')[0]);
      let file=resolve(DIST,'.'+pathname);
      if(file!==DIST&&!file.startsWith(DIST+sep))throw Error('path outside dist');
      if((await stat(file)).isDirectory())file=join(file,'index.html');
      const bytes=await readFile(file);
      res.writeHead(200,{'content-type':MIME[extname(file)]||'application/octet-stream'});
      res.end(bytes);
    }catch{res.writeHead(404);res.end('not found');}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  base='http://127.0.0.1:'+server.address().port;
}
const routes=[
  ['gill','/articles/dzhon-gill-chast-1-chelovek/'],
  ['hermenevtika','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/']
];
const values=[['-1',1],['0',1],['0.8',0.75],['1.1',1],['2.5',1],['100',1],['NaN',1],['broken',1],['0.75',0.75],['1.5',1.5],['2',2]];
let pass=0;
const failures=[];
for (const [engine,launcher] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
  const browser=await launcher.launch({headless:true});
  for (const [label,path] of routes) {
    const scenarios=engine==='chromium'?values:[['0.8',0.75],['1.1',1],['2',2]];
    for (const [raw,expected] of scenarios) {
      const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      await ctx.addInitScript(({value})=>{
        localStorage.setItem('gb:audio:rate',value);
        localStorage.setItem('gbx-tts-rate',value);
      },{value:raw});
      const page=await ctx.newPage();
      try {
        const resp=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
        assert.equal(resp.status(),200);
        await page.waitForFunction(()=>Boolean(window.GBReaderRatePolicy &&
          document.querySelector('[data-reader-mobile-speed][data-reader-speed-bound="1"]')),null,{timeout:12000});
        const actual=await page.evaluate(()=>{
          const bar=document.querySelector('[data-reader-mobile-speed]');
          const chips=[...bar.querySelectorAll('.reader-mobile-speed-rate')];
          const selected=chips.filter(x=>x.getAttribute('aria-checked')==='true');
          return {selected:selected.map(x=>Number(x.dataset.speed)),
            badge:bar.querySelector('.reader-mobile-speed-badge')?.textContent?.trim(),
            tts:window.GBReaderTTS?.getState?.()?.rate ?? null,
            primary:localStorage.getItem('gb:audio:rate'),
            legacy:localStorage.getItem('gbx-tts-rate')};
        });
        assert.deepEqual(actual.selected,[expected]);
        assert.equal(actual.badge,String(expected)+'×');
        assert.equal(Number(actual.primary),expected);
        assert.equal(Number(actual.legacy),expected);
        if(actual.tts!==null)assert.equal(actual.tts,expected);
        // Invalid external events must never clear all six radio selections.
        await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gb:tts-rate-change',{detail:{rate:100}})));
        const valid=await page.locator('.reader-mobile-speed-rate[aria-checked="true"]').count();
        assert.equal(valid,1);
        pass++;
      }catch(e){failures.push({engine,label,raw,error:String(e)});}
      await ctx.close();
    }
    // Independently prove visible TOC opener semantics and focus restoration
    // through the canonical dialog owners (Gill and Hermenevtika).
    const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await ctx.newPage();
    try {
      await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
      const trigger=page.locator('.reader-mobile-menu-trigger').first();
      await page.waitForFunction(()=>document.querySelector('.reader-mobile-menu-trigger')?.hasAttribute('aria-controls'));
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('.reader-mobile-menu-trigger')?.getAttribute('aria-expanded')==='true');
      const controls=await trigger.getAttribute('aria-controls');
      assert.equal(controls,label==='gill'?'partTocOverlay':'hmSheet');
      await page.screenshot({path:'reports/reader-p1-menu-'+engine+'-'+label+'.png'});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('.reader-mobile-menu-trigger')?.getAttribute('aria-expanded')==='false');
      const focus=await trigger.evaluate(el=>document.activeElement===el);
      assert.equal(focus,true,'Escape must restore the visible TOC opener');
      pass++;
      // Real pointer selection updates both legacy keys and the active
      // ReaderTTS state, without a second keyboard/pointer rate controller.
      const badge=page.locator('.reader-mobile-speed-badge').first();
      await badge.click();
      await page.locator('.reader-mobile-speed-rate[data-speed="1.5"]').first().click();
      await page.waitForFunction(()=>window.GBReaderTTS?.getState?.()?.rate===1.5);
      const picked=await page.evaluate(()=>({
        primary:localStorage.getItem('gb:audio:rate'),
        legacy:localStorage.getItem('gbx-tts-rate'),
        checked:[...document.querySelectorAll('.reader-mobile-speed-rate[aria-checked="true"]')].map(x=>x.dataset.speed)
      }));
      assert.deepEqual(picked,{primary:'1.5',legacy:'1.5',checked:['1.5']});
      pass++;
      // Exercise client-navigation teardown/rebind with a preserved bar.
      // A second speed owner would dispatch a duplicate selection event.
      await page.evaluate(()=>{
        document.dispatchEvent(new Event('astro:before-swap'));
        document.dispatchEvent(new Event('astro:page-load'));
      });
      await page.waitForFunction(()=>document.querySelector('[data-reader-mobile-speed]')?.dataset.readerSpeedBound==='1' &&
        window.GBReaderControlsA11y?.getState?.().length===1);
      await page.evaluate(()=>{window.__readerRateEventCount=0;
        window.addEventListener('gb:tts-rate-change',()=>window.__readerRateEventCount++);});
      await badge.click();
      await page.locator('.reader-mobile-speed-rate[data-speed="1.25"]').first().click();
      await page.waitForFunction(()=>window.GBReaderTTS?.getState?.()?.rate===1.25);
      assert.equal(await page.evaluate(()=>window.__readerRateEventCount),1,
        'client navigation must not duplicate the speed event owner');
      pass++;
    }catch(e){failures.push({engine,label,case:'focus/menu/pointer/lifecycle',error:String(e)});}
    await ctx.close();
  }
  await browser.close();
}
if(server)await new Promise(done=>server.close(done));
console.log(JSON.stringify({passed:pass,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
