#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const playwright = require('playwright');

const browserName = process.env.PW_BROWSER || 'chromium';
const browserType = playwright[browserName];
if (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);
const siteUtils = fs.readFileSync('js/site-utils.js','utf8');
const mapEngine = fs.readFileSync('karty/_engine/map-engine.js','utf8');
const builtMindMap = fs.readFileSync('konfessii/russkij-baptizm/_app/index.html','utf8');
const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const route = {meta:{id:'special-witness',title:'Witness',viewport_init:{cx:500,cy:350,w:1000}},stages:[{n:'I',t:'Stage'}],stories:[{id:'main',label:'Main',places:['p1'],stage_ids:[0],active_by_default:true}],places:[{id:'p1',name:'Place',stage:0,x:500,y:350,story:'Story',photos:[{thumb:pixel,src:pixel,label:'Photo',credit:'Fixture'}]}]};

async function builtLauncherWitness(browser) {
  const page = await browser.newPage({viewport:{width:844,height:620}});
  page.on('console', message => console.log(`[built:${browserName}:${message.type()}] ${message.text()}`));
  page.on('pageerror', error => console.error(`[built:${browserName}:pageerror]`, error));
  try {
    await page.route('https://fixture.test/**', async request => {
      const url = new URL(request.request().url());
      if (url.pathname === '/konfessii/russkij-baptizm/_app/index.html') return request.fulfill({status:200,contentType:'text/html',body:builtMindMap});
      if (url.pathname === '/js/site-utils.js') return request.fulfill({status:200,contentType:'application/javascript',body:siteUtils});
      return request.abort();
    });
    await page.goto('https://fixture.test/konfessii/russkij-baptizm/_app/index.html');
    await page.waitForFunction(() => window.OverlayRuntime && document.body.textContent.includes('Войти в 3D-карту'));
    await page.evaluate(() => {
      document.body.style.overflow='auto'; document.body.style.position='relative'; document.body.style.top='4px';
      const button=[...document.querySelectorAll('button')].find(item=>item.textContent.includes('Войти в 3D-карту'));
      button.focus({preventScroll:true});
      window.OverlayRuntime.open('foreign:witness',{lockScroll:true,trapFocus:false,restoreFocus:false});
      window.__launcherOpenedState=null;
      const observer=new MutationObserver(() => {
        const root=document.getElementById('konfessii-mindmap-overlay');
        if (!root || window.OverlayRuntime.size() !== 2) return;
        window.__launcherOpenedState={
          size:window.OverlayRuntime.size(),
          top:window.OverlayRuntime.topLayer()?.ownerId,
          position:document.body.style.position,
        };
        observer.disconnect();
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      });
      observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-overlay-count'],childList:true,subtree:true});
      button.click();
    });
    await page.waitForFunction(() => window.__launcherOpenedState && !document.getElementById('konfessii-mindmap-overlay') && window.OverlayRuntime.size() === 1);
    let state = await page.evaluate(() => window.__launcherOpenedState);
    assert.deepEqual(state,{size:2,top:'special:konfessii-mindmap-launcher',position:'fixed'});
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Войти в 3D-карту'));
    state = await page.evaluate(() => ({size:window.OverlayRuntime.size(),top:window.OverlayRuntime.topLayer()?.ownerId,position:document.body.style.position}));
    assert.deepEqual(state,{size:1,top:'foreign:witness',position:'fixed'});
    await page.evaluate(() => window.OverlayRuntime.close('foreign:witness','test'));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    state = await page.evaluate(() => ({overflow:document.body.style.overflow,position:document.body.style.position,top:document.body.style.top}));
    assert.deepEqual(state,{overflow:'auto',position:'relative',top:'4px'});

    await page.evaluate(() => [...document.querySelectorAll('button')].find(item=>item.textContent.includes('Войти в 3D-карту')).click());
    await page.waitForFunction(() => window.OverlayRuntime.size() === 1);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
  } finally { await page.close(); }
}

async function mapOwnershipWitness(browser) {
  const html='<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;min-height:1800px}#map{height:390px;width:844px;position:relative}</style></head><body style="overflow:auto;position:relative;top:4px"><button id="outside">Open</button><div id="map"></div></body></html>';
  const page = await browser.newPage({viewport:{width:844,height:390}});
  try {
    await page.route('https://fixture.test/map/**', request => request.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://fixture.test/map/ownership/');
    await page.addScriptTag({content:siteUtils});
    await page.addScriptTag({content:mapEngine});
    await page.evaluate(route => {
      document.getElementById('outside').focus({preventScroll:true});
      window.OverlayRuntime.open('foreign:map',{lockScroll:true,trapFocus:false,restoreFocus:false});
      window.mapWitness=MapEngine.createMap(document.getElementById('map'),route,{showIntro:false,showCompass:false});
      window.mapWitness.open('p1');
    }, route);
    await page.waitForFunction(() => window.OverlayRuntime.size() === 2);
    await page.evaluate(() => {
      document.querySelector('.me-tab[data-tab="photos"]').click();
      const image=document.querySelector('.me-clickable-photo'); image.tabIndex=0; image.focus({preventScroll:true}); image.click();
    });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 3);
    await page.evaluate(() => { window.mapWitness.destroy(); window.mapWitness.destroy(); });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 1);
    let state = await page.evaluate(() => ({top:window.OverlayRuntime.topLayer()?.ownerId,position:document.body.style.position,children:document.getElementById('map').children.length}));
    assert.deepEqual(state,{top:'foreign:map',position:'fixed',children:0});
    await page.evaluate(() => window.OverlayRuntime.close('foreign:map','test'));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    state = await page.evaluate(() => ({overflow:document.body.style.overflow,position:document.body.style.position,top:document.body.style.top}));
    assert.deepEqual(state,{overflow:'auto',position:'relative',top:'4px'});
  } finally { await page.close(); }
}

async function mapFallbackWitness(browser) {
  const page = await browser.newPage({viewport:{width:844,height:390}});
  try {
    const html='<!doctype html><html><body><button id="outside">Open</button><div id="map" style="height:390px;width:844px;position:relative"></div></body></html>';
    await page.route('https://fixture.test/fallback/**', request => request.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://fixture.test/fallback/map/');
    await page.evaluate(() => { window.SiteUtils={locks:[],unlocks:[],lockScroll(id){this.locks.push(id)},unlockScroll(id){this.unlocks.push(id)}}; });
    await page.addScriptTag({content:mapEngine});
    await page.evaluate(route => { document.getElementById('outside').focus(); window.fallbackMap=MapEngine.createMap(document.getElementById('map'),route,{showIntro:false,showCompass:false}); window.fallbackMap.open('p1'); }, route);
    await page.waitForFunction(() => window.SiteUtils.locks.length === 1);
    await page.evaluate(() => { document.querySelector('.me-tab[data-tab="photos"]').click(); const image=document.querySelector('.me-clickable-photo'); image.tabIndex=0; image.focus(); image.click(); });
    await page.waitForFunction(() => window.SiteUtils.locks.length === 2);
    await page.evaluate(() => document.querySelector('.me-photo-modal__close').click());
    await page.waitForFunction(() => window.SiteUtils.unlocks.length === 1);
    await page.evaluate(() => document.querySelector('.me-panel__close').click());
    await page.waitForFunction(() => window.SiteUtils.unlocks.length === 2);
    const state=await page.evaluate(() => ({locks:window.SiteUtils.locks,unlocks:window.SiteUtils.unlocks}));
    assert.equal(state.locks.length,2); assert.equal(state.unlocks.length,2);
    assert.match(state.locks[0],/:panel$/); assert.match(state.locks[1],/:photo$/);
  } finally { await page.close(); }
}

(async()=>{
  const browser=await browserType.launch({headless:true});
  try {
    await builtLauncherWitness(browser);
    await mapOwnershipWitness(browser);
    await mapFallbackWitness(browser);
    console.log(`✅ special-overlay-runtime-browser-test [${browserName}]: built launcher + foreign owner + double destroy + fallback`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
