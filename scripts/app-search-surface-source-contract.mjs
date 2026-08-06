#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  head: read('src/components/search/AppSearchHead.astro'),
  surface: read('src/components/search/AppSearchSurface.astro'),
  search: read('js/search.js'),
  home: read('src/components/home/HomePageChrome.astro'),
  browser: read('scripts/app-search-surface-browser-contract.mjs'),
  avraamPage: read('src/pages/karty/avraam/index.astro'),
  ishodPage: read('src/pages/karty/ishod/index.astro'),
  avraamHead: read('src/components/karty/avraam/AvraamPageHead.astro'),
  ishodHead: read('src/components/karty/ishod/IshodPageHead.astro'),
  baptismHead: read('src/components/konfessii/russkij-baptizm/Baptizm3DPageHead.astro'),
  baptismBody: read('src/components/konfessii/russkij-baptizm/Baptizm3DBody.astro'),
  mapHead: read('src/components/map/MapPageHead.astro'),
  atlasBody: read('src/components/map/AtlasBody.astro'),
  workflow: read('.github/workflows/search-modal-contract.yml'),
};

let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };
const count = (text, marker) => text.split(marker).length - 1;

check(files.head.includes('/css/command-palette.css?v=c174cedb'), 'current command-palette revision missing');
const searchHash = crypto.createHash('md5').update(files.search).digest('hex').slice(0, 8);
check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');
check(files.head.includes('defer'), 'search bootstrap must remain deferred');
check(files.surface.includes('id="gbSearchBtn"'), 'canonical trigger id missing');
check(files.surface.includes('aria-haspopup="dialog"'), 'dialog semantics missing');
check(files.surface.includes('min-width: 44px'), '44px width contract missing');
check(files.surface.includes('min-height: 44px'), '44px height contract missing');
check(files.surface.includes('body.has-app-search-map .me-search'), 'MapEngine collision offset missing');
check(files.surface.includes("mode: 'map-engine' | 'atlas' | 'baptizm'"), 'surface mode vocabulary drift');
check(files.surface.includes("window.addEventListener('keydown'"), 'route shortcut owner missing');
check(files.surface.includes('event.stopImmediatePropagation()'), 'route shortcut arbitration missing');
check(files.surface.includes('data-search-shortcut-label="Поиск по всему сайту"'), 'App shared label metadata missing');
check(files.surface.includes('aria-label="Поиск по всему сайту"'), 'App neutral initial aria label missing');
check(files.surface.includes('title="Поиск по всему сайту"'), 'App neutral initial title missing');
check(!files.surface.includes("const platform = navigator.userAgentData?.platform"), 'App duplicate platform helper survived');

for (const marker of [
  'function __gbSearchPlatformValue()',
  'function __gbSearchShortcut()',
  'function __gbSyncSearchTriggerLabels(e)',
  'data-search-label-ready',
  'syncTriggerLabels:__gbSyncSearchTriggerLabels',
  'shortcut:__gbSearchShortcut',
]) check(files.search.includes(marker), `shared Search label owner marker missing: ${marker}`);
check(!files.search.includes('Поиск (⌘K)'), 'Mac-only fallback aria label survived');
check(!files.search.includes('Поиск ⌘K'), 'Mac-only fallback title survived');
check(!files.search.includes('<span class="kb">⌘K</span>'), 'Mac-only visible fallback survived');

check(files.home.includes('data-search-shortcut-label="Поиск по всему сайту"'), 'Home shared label metadata missing');
check(files.home.includes('aria-label="Поиск по всему сайту"'), 'Home neutral initial aria label missing');
check(files.home.includes('title="Поиск по всему сайту"'), 'Home neutral initial title missing');
check(!files.home.includes("const platform = navigator.userAgentData?.platform"), 'Home duplicate platform helper survived');

for (const marker of [
  "platform: 'Win32'",
  "platform: 'MacIntel'",
  "expectedShortcut: 'Ctrl+K'",
  "expectedShortcut: '⌘+K'",
  "shortcutPress: 'Control+K'",
  "shortcutPress: 'Meta+K'",
  "data-search-label-ready",
]) check(files.browser.includes(marker), `browser platform-label contract missing: ${marker}`);

for (const [name, text] of Object.entries({
  avraamHead: files.avraamHead,
  ishodHead: files.ishodHead,
  baptismHead: files.baptismHead,
  mapHead: files.mapHead,
})) {
  check(count(text, "import AppSearchHead") === 1, `${name}: AppSearchHead import count`);
  check(count(text, '<AppSearchHead />') === 1, `${name}: AppSearchHead render count`);
}

for (const [name, text] of Object.entries({ avraamPage: files.avraamPage, ishodPage: files.ishodPage })) {
  check(text.includes('class="has-app-search-map"'), `${name}: map body scope missing`);
  check(count(text, '<AppSearchSurface mode="map-engine" />') === 1, `${name}: map search surface count`);
  check(!/href=["'][^"']*\/css\/site\.css/.test(text), `${name}: strict-native site.css boundary changed`);
  check(!/src=["'][^"']*\/js\/site\.js/.test(text), `${name}: strict-native site.js boundary changed`);
}

check(count(files.baptismBody, '<AppSearchSurface mode="baptizm" />') === 1, 'Baptism surface count');
check(files.baptismBody.includes('<iframe id="appframe"'), 'Baptism iframe owner changed');
check(count(files.atlasBody, '<AppSearchSurface mode="atlas" />') === 1, 'Atlas surface count');
check(files.atlasBody.includes('id="atlasSearchInput"'), 'Atlas local search must remain');
check(files.atlasBody.includes('/js/atlas-runtime.js'), 'Atlas runtime owner changed');

const allRouteText = [files.avraamPage, files.ishodPage, files.baptismBody, files.atlasBody].join('\n');
check(count(allRouteText, '<AppSearchSurface mode=') === 4, 'exactly four app search surfaces required');
check(count(allRouteText, 'id="gbSearchBtn"') === 0, 'route owners must not duplicate trigger internals');

for (const marker of [
  'js/search.js',
  'scripts/app-search-surface-source-contract.mjs',
  'scripts/app-search-surface-browser-contract.mjs',
  'src/components/search/AppSearchHead.astro',
  'src/components/search/AppSearchSurface.astro',
  'node scripts/app-search-surface-source-contract.mjs',
  'node scripts/app-search-surface-browser-contract.mjs',
]) check(files.workflow.includes(marker), `workflow marker missing: ${marker}`);

check(!files.workflow.includes('name: App Search'), 'no new permanent workflow may be introduced');
console.log(`APP SEARCH SURFACE SOURCE CONTRACT: ${passed}/${passed} PASS`);
