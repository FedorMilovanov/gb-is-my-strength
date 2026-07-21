#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert/strict');

const siteUtils = fs.readFileSync('js/site-utils.js', 'utf8');
const site = fs.readFileSync('js/site.js', 'utf8');
const reader = fs.readFileSync('src/components/article-pilots/_shared/ReaderSettings.astro', 'utf8');
const hermenevtika = fs.readFileSync('src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro', 'utf8');
const floating = fs.readFileSync('js/floating-cluster-controller.js', 'utf8');
const mapEngine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');
const mindMap3D = fs.readFileSync('_build-tools/konfessii-baptizm/MindMap3D.tsx', 'utf8');
const builtMindMap = fs.readFileSync('konfessii/russkij-baptizm/_app/index.html', 'utf8');

for (const name of ['register', 'open', 'close', 'requestClose', 'destroy', 'lockScroll', 'unlockScroll', 'topLayer', 'forceRecover']) {
  assert.ok(siteUtils.includes(`${name}:`), `OverlayRuntime must expose ${name}`);
}
assert.ok(siteUtils.includes("Object.defineProperty(window, 'OverlayRuntime'"), 'global API must be protected');
assert.ok(siteUtils.includes('captureLockStyles()'), 'canonical lock must snapshot inline styles');
assert.ok(siteUtils.includes('restoreLockStyles(savedLockStyles)'), 'canonical lock must restore snapshot');

const start = site.indexOf('_scrollLockCount:0,_savedScrollY:0,_scrollLockSources:{}');
const end = site.indexOf(',articleEl:function()', start);
assert.ok(start >= 0 && end > start, 'site.js compatibility block must remain identifiable');
const privateBlock = site.slice(start, end);
assert.ok(privateBlock.includes('window.SiteUtils'), 'site.js must delegate to canonical SiteUtils');
assert.ok(!/\.style\.(?:overflow|position|top|left|right|width)\s*=/.test(privateBlock), 'private store must not write lock styles');

const directWriter = /(?:document\.)?body\.style\.(?:overflow|position|top|left|right|width)\s*=/;
assert.ok(!directWriter.test(reader), 'ReaderSettings must not write body lock styles');
assert.ok(!directWriter.test(hermenevtika), 'Hermenevtika TOC must not write body lock styles');
assert.ok(!directWriter.test(floating), 'floating cluster overlays must not write body lock styles');
assert.ok(!directWriter.test(mapEngine), 'map special overlays must not write body lock styles');
const specialDirectWriter = /(?:document\.(?:body|documentElement)|(?:body|html))\.style\.(?:overflow|position|top|left|right|width|overscrollBehavior)\s*=/;
assert.ok(!specialDirectWriter.test(mindMap3D), 'MindMap3D must not write html/body lock styles');
assert.ok(reader.includes("OVERLAY_OWNER = 'reader-settings'"));
assert.ok(reader.includes("unlockScroll?.('hermenevtika-toc')"), 'fallback switch must release the Hermenevtika owner');
assert.ok(hermenevtika.includes("OVERLAY_OWNER = 'hermenevtika-toc'"));
for (const owner of ['gill-series-toc', 'gill-part-toc', 'gill-learning', 'gill-settings', 'gbs2-sheet']) {
  assert.ok(floating.includes(owner), `floating cluster must register ${owner}`);
}
assert.ok(mapEngine.includes('special:map:'), 'map instances must use namespaced special owners');
assert.ok(mapEngine.includes('panelOverlayOwner') && mapEngine.includes('photoOverlayOwner'), 'map panel and photo must have separate owners');
assert.ok(!mapEngine.includes('Focus trap in panel'), 'map panel must use the shared focus trap');
assert.ok(!mapEngine.includes("document.addEventListener('keydown', e => { if (e.key === 'Escape')"), 'photo modal must not own a competing Escape listener');
assert.ok(mindMap3D.includes('special:mindmap3d:fullscreen:'), 'MindMap3D must use a namespaced fullscreen owner');
assert.ok(mindMap3D.includes('runtime.lockScroll(fullscreenOverlayOwner)') && mindMap3D.includes('runtime.unlockScroll(fullscreenOverlayOwner)'), 'MindMap3D must delegate fullscreen lock lifecycle to OverlayRuntime');
assert.ok(!specialDirectWriter.test(site), 'site.js overlays and menu fallbacks must not write html/body lock styles');
assert.ok(!specialDirectWriter.test(builtMindMap), 'committed MindMap launcher must not write html/body lock styles');
assert.ok(site.includes('site-image-viewer'), 'site image viewer must have a canonical owner');
assert.ok(builtMindMap.includes('special:konfessii-mindmap-launcher'), 'built MindMap launcher must have a canonical owner');
assert.ok(builtMindMap.includes('id:"konfessii-mindmap-overlay"'), 'built MindMap launcher must expose its overlay root');
assert.ok(builtMindMap.includes('../../../js/site-utils.js'), 'built MindMap launcher must load canonical runtime');

console.log('✅ overlay-runtime-contract-test: canonical store + protected API + standalone consumers');
