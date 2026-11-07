#!/usr/bin/env node
// Exact Product Grok overlay acceptance: desktop menu and reader settings
// are alternate anchored views, never simultaneous floating cards.
// This test runs against the built Astro dist, not a React mock or production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const htmlPath=path.join(DIST,ROUTE.slice(1),'index.html');
assert.ok(fs.existsSync(htmlPath),'Astro Product candidate required');
assert.match(fs.readFileSync(htmlPath,'utf8'),/hrail--grok/,'Grok flag must be enabled');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const uri=decodeURIComponent((req.url||'/').split('?')[0]);
  const target=path.resolve(DIST,'.'+(uri.endsWith('/')?uri+'index.html':uri));
  const rel=path.relative(DIST,target);
  if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
    res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const checks=[];
function check(engine,width,label,ok,evidence=null){
  checks.push({engine,width,label,ok:!!ok});
  assert.ok(ok,engine+' '+width+' '+label+': '+JSON.stringify(evidence));
}
async function state(page){
  return page.evaluate(()=>{
    const menu=document.getElementById('hMobileNav'),settings=document.getElementById('hmSettings');
    const rail=document.querySelector('.hrail--grok'),icon=document.querySelector('#hrailLayoutToggle svg');
    return {
      menu:!!menu?.classList.contains('open'),
      settings:!!settings?.classList.contains('is-open'),
      menuHidden:!!menu?.hidden,menuInert:!!menu?.inert,
      expanded:document.getElementById('hMobileMenuBtn')?.getAttribute('aria-expanded'),
      layers:window.OverlayRuntime?.snapshot?.()?.map(entry=>entry.ownerId)||[],
      focus:document.activeElement?.id,railW:rail?.getBoundingClientRect().width,
      iconW:icon?.getBoundingClientRect().width,
      iconParts:icon?.querySelectorAll('path').length,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
}
const browsers={chromium,firefox,webkit};
try{
  const requested=(process.env.GB_GROK_OVERLAY_BROWSERS||'chromium,firefox,webkit').split(',').map(x=>x.trim());
  for(const name of requested){
    const driver=browsers[name];assert.ok(driver,'Unsupported browser '+name);
    const browser=await driver.launch({headless:true});
    try{
      for(const width of [1200,1440]){
        const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
        const page=await ctx.newPage(),errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        try{
          const response=await page.goto(origin+ROUTE,{waitUntil:'domcontentloaded'});
          check(name,width,'HTTP',response.status()===200);
          await page.locator('.hrail--grok.grok-ready').waitFor({state:'visible',timeout:15000});
          await page.waitForFunction(()=>document.getElementById('hMobileMenuBtn')?.dataset.gbSiteMenuOwner==='canonical-runtime');
          let x=await state(page);
          check(name,width,'initial overlays closed',!x.menu&&!x.settings&&x.layers.length===0,x);
          await page.locator('#hMobileMenuBtn').click();
          x=await state(page);check(name,width,'menu opens exclusively',x.menu&&!x.settings&&x.layers.length===1&&x.expanded==='true',x);
          await page.mouse.click(width-50,420);
          x=await state(page);check(name,width,'desktop outside click closes menu',!x.menu&&x.menuInert&&x.layers.length===0&&x.expanded==='false',x);
          await page.locator('#hrailSettingsBtn').click();
          x=await state(page);check(name,width,'settings opens exclusively',x.settings&&!x.menu&&x.layers.length===1,x);
          await page.mouse.click(width-50,420);
          x=await state(page);check(name,width,'outside click closes settings',!x.settings&&x.layers.length===0,x);
          await page.locator('#hrailSettingsBtn').click();
          await page.evaluate(()=>document.dispatchEvent(new CustomEvent('hm:open-settings')));
          x=await state(page);check(name,width,'settings native event toggles close',!x.settings&&x.layers.length===0,x);
          await page.locator('#hMobileMenuBtn').click();
          await page.locator('#hrailSettingsBtn').click();
          x=await state(page);check(name,width,'menu-to-settings switch removes menu card',x.settings&&!x.menu&&x.layers.join()==='reader-settings',x);
          // Only a programmatic action can reach the obscured menu trigger
          // while the modal settings sheet occupies its space.
          await page.evaluate(()=>document.getElementById('hMobileMenuBtn').click());
          x=await state(page);check(name,width,'settings-to-menu switch removes settings card',x.menu&&!x.settings&&x.layers.join()==='site-sections-menu',x);
          await page.keyboard.press('Escape');
          x=await state(page);check(name,width,'Escape closes site menu and returns focus',!x.menu&&x.layers.length===0&&x.focus==='hMobileMenuBtn',x);
          await page.locator('#hrailLayoutToggle').click();
          await page.locator('#hMobileMenuBtn').click();
          x=await state(page);check(name,width,'compact mode menu opens',x.menu&&x.layers.length===1&&Math.abs(x.railW-68)<1,x);
          await page.mouse.click(width-50,420);
          x=await state(page);check(name,width,'compact outside click closes',!x.menu&&x.layers.length===0,x);
          await page.locator('#hrailSettingsBtn').click();
          await page.locator('#hmSettingsClose').click();
          x=await state(page);check(name,width,'settings close button works',!x.settings&&x.layers.length===0,x);
          check(name,width,'selected first icon visually enlarged',x.iconW>=22&&x.iconParts===2,x);
          check(name,width,'no overflow',x.overflow<=1,x.overflow);
          check(name,width,'no first-party page errors',errors.length===0,errors);
        }finally{await ctx.close();}
      }
    }finally{await browser.close();}
  }
  console.log('GROK OVERLAY / ICON: '+checks.length+'/'+checks.length+' PASS');
}finally{server.close();}
