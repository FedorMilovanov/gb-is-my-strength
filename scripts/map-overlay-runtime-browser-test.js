#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const playwright = require('playwright');

const browserName = process.env.PW_BROWSER || 'chromium';
const browserType = playwright[browserName];
if (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);

const siteUtils = fs.readFileSync('js/site-utils.js', 'utf8');
const mapEngine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');

(async () => {
  const browser = await browserType.launch({headless:true});
  const page = await browser.newPage({viewport:{width:844,height:390}});
  page.on('console', message => console.log(`[page:${message.type()}] ${message.text()}`));
  page.on('pageerror', error => console.error('[pageerror]', error));
  try {
    const fixtureHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;min-height:2200px}
      #pre{height:420px} #outside{display:block;margin:0 0 12px 12px}
      #map{height:390px;width:844px;position:relative}
    </style></head><body style="overflow:auto;position:relative;top:4px"><div id="pre"></div><button id="outside">Open map</button><div id="map"></div></body></html>`;
    await page.route('https://fixture.test/**', route => route.fulfill({status:200,contentType:'text/html',body:fixtureHtml}));
    await page.goto('https://fixture.test/map/');
    await page.addScriptTag({content:siteUtils});
    await page.addScriptTag({content:mapEngine});
    await page.evaluate(() => scrollTo(0, 420));
    await page.waitForFunction(() => Math.round(scrollY) === 420);
    await page.evaluate(() => document.getElementById('outside').focus({preventScroll:true}));

    await page.evaluate(() => {
      const route = {
        meta:{id:'runtime-fixture',title:'Runtime fixture',viewport_init:{cx:500,cy:350,w:1000}},
        stages:[{n:'I',t:'Stage'}],
        stories:[{id:'main',label:'Main',places:['p1'],stage_ids:[0],active_by_default:true}],
        places:[{
          id:'p1',name:'Place',stage:0,x:500,y:350,story:'Story text',
          photos:[{thumb:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',src:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',label:'Photo',credit:'Fixture'}]
        }]
      };
      window.fixtureMap = MapEngine.createMap(document.getElementById('map'), route, {showIntro:false,showCompass:false});
      window.fixtureMap.open('p1');
    });

    await page.waitForTimeout(250);
    console.log('panel-precondition', JSON.stringify(await page.evaluate(() => ({
      panelExists:Boolean(document.querySelector('.me-panel')),
      panelOpen:Boolean(document.querySelector('.me-panel--open')),
      runtime:Boolean(window.OverlayRuntime),
      size:window.OverlayRuntime?.size?.(),
      top:window.OverlayRuntime?.topLayer?.()?.ownerId || '',
      active:document.activeElement?.className || document.activeElement?.id || '',
      overlayCount:document.documentElement.getAttribute('data-overlay-count'),
    }))));
    await page.waitForFunction(() => document.querySelector('.me-panel--open') && window.OverlayRuntime.size() === 1);
    let state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      top:window.OverlayRuntime.topLayer()?.ownerId,
      bodyPosition:document.body.style.position,
      active:document.activeElement?.className || '',
    }));
    assert.equal(state.size, 1);
    assert.match(state.top, /special:map:runtime-fixture:\d+:panel$/);
    assert.equal(state.bodyPosition, 'fixed');
    assert.match(state.active, /me-tab/);

    await page.evaluate(() => {
      const photos = document.querySelector('.me-tab[data-tab="photos"]');
      photos.click();
      const image = document.querySelector('.me-clickable-photo');
      image.tabIndex = 0;
      image.focus({preventScroll:true});
      image.click();
    });
    await page.waitForFunction(() => document.querySelector('.me-photo-modal--open') && window.OverlayRuntime.size() === 2);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      top:window.OverlayRuntime.topLayer()?.ownerId,
      panelOpen:document.querySelector('.me-panel').classList.contains('me-panel--open'),
      active:document.activeElement?.className || '',
    }));
    assert.equal(state.size, 2);
    assert.match(state.top, /:photo$/);
    assert.equal(state.panelOpen, true);
    assert.match(state.active, /me-photo-modal__close/);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.me-photo-modal--open') && window.OverlayRuntime.size() === 1);
    await page.waitForFunction(() => document.activeElement?.classList?.contains('me-clickable-photo'));
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      top:window.OverlayRuntime.topLayer()?.ownerId,
      panelOpen:document.querySelector('.me-panel').classList.contains('me-panel--open'),
      bodyPosition:document.body.style.position,
      active:document.activeElement?.className || '',
    }));
    assert.equal(state.size, 1, 'first Escape closes only the photo owner');
    assert.match(state.top, /:panel$/);
    assert.equal(state.panelOpen, true);
    assert.equal(state.bodyPosition, 'fixed');
    assert.match(state.active, /me-clickable-photo/);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    await page.waitForFunction(() => document.activeElement?.id === 'outside');
    await page.waitForFunction(() => Math.round(scrollY) === 420);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      panelOpen:document.querySelector('.me-panel').classList.contains('me-panel--open'),
      overflow:document.body.style.overflow,
      position:document.body.style.position,
      topStyle:document.body.style.top,
      scrollY:Math.round(scrollY),
      active:document.activeElement?.id || '',
    }));
    assert.deepEqual(state, {size:0,panelOpen:false,overflow:'auto',position:'relative',topStyle:'4px',scrollY:420,active:'outside'});

    await page.evaluate(() => {
      document.getElementById('outside').focus({preventScroll:true});
      window.fixtureMap.open('p1');
    });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 1);
    await page.evaluate(() => {
      document.querySelector('.me-tab[data-tab="photos"]').click();
      const image = document.querySelector('.me-clickable-photo');
      image.tabIndex = 0;
      image.focus({preventScroll:true});
      image.click();
    });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 2);
    await page.evaluate(() => window.fixtureMap.destroy());
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    await page.waitForFunction(() => Math.round(scrollY) === 420);
    state = await page.evaluate(() => ({
      size:window.OverlayRuntime.size(),
      position:document.body.style.position,
      scrollY:Math.round(scrollY),
      mapChildren:document.getElementById('map').children.length,
    }));
    assert.deepEqual(state, {size:0,position:'relative',scrollY:420,mapChildren:0});

    console.log(`✅ map-overlay-runtime-browser-test [${browserName}]: nested photo/panel ownership + Escape + exact restore + destroy + landscape`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
