#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  head: read('src/components/search/AppSearchHead.astro'),
  surface: read('src/components/search/AppSearchSurface.astro'),
  search: read('js/search.js'),
  siteUtils: read('js/site-utils.js'),
  commandPalette: read('css/command-palette.css'),
  baseLayout: read('src/layouts/BaseLayout.astro'),
  home: read('src/components/home/HomePageChrome.astro'),
  homeProgressive: read('src/components/home/HomeProgressiveEnhancementHead.astro'),
  notFound: read('404.html'),
  rodosloviye: read('src/components/rodosloviye/RodosloviyeBody.astro'),
  auditPro: read('scripts/audit-pro.js'),
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
const assetHash = (text) => crypto.createHash('md5').update(text).digest('hex').slice(0, 8);

const commandPaletteHash = assetHash(files.commandPalette);
check(files.head.includes(`/css/command-palette.css?v=${commandPaletteHash}`), 'current command-palette revision missing');
const searchHash = assetHash(files.search);
check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');
const siteUtilsHash = assetHash(files.siteUtils);
check(files.head.includes(`/js/site-utils.js?v=${siteUtilsHash}`), 'current SiteUtils revision missing');
check(files.head.indexOf('/js/site-utils.js') < files.head.indexOf('/js/search.js'), 'SiteUtils must load before Search');
check(files.head.includes('defer'), 'search bootstrap must remain deferred');
check(files.surface.includes('id="gbSearchBtn"'), 'canonical trigger id missing');
check(files.surface.includes('aria-haspopup="dialog"'), 'dialog semantics missing');
check(files.surface.includes('min-width: 44px'), '44px width contract missing');
check(files.surface.includes('min-height: 44px'), '44px height contract missing');
check(files.surface.includes('body.has-app-search-map .me-search'), 'MapEngine collision offset missing');
check(files.surface.includes("mode: 'map-engine' | 'atlas' | 'baptizm'"), 'surface mode vocabulary drift');
check(!files.surface.includes("window.addEventListener('keydown'"), 'App route-local shortcut owner survived');
check(!files.surface.includes('stopImmediatePropagation()'), 'App route-local shortcut arbitration survived');
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
check(files.search.includes('function __gbHydratePagefind(e,t){var i=new Array(e.length),n=0,r=Math.min(8,e.length);'), 'Pagefind hydration must remain bounded to eight workers');
check(files.search.includes('t===M&&(i[r]=e)'), 'Pagefind hydration worker must remain generation-guarded');
check(!files.search.includes('Promise.all(n.map(function(e){return e.data()}))'), 'unbounded Pagefind data() hydration survived');
check(files.search.includes('function __gbInvalidateVisibleResults(){__gbClearMore(),j=[],_=0,E.removeAttribute("aria-activedescendant"),S.innerHTML="",T.textContent="",ce()}'), 'query mutation must invalidate stale interactive result state');
check(files.search.includes('function xe(e){__gbInvalidateVisibleResults();if(e&&!(e.length<2))'), 'query execution must invalidate stale interactive state before async search');
check(files.search.includes('E.addEventListener("input",function(){A=E.value.trim(),++M,__gbInvalidateVisibleResults(),L.style.display=A?"":"none"'), 'input mutation must invalidate stale interactive state synchronously');
check(files.search.includes('function __gbSearchExactScripture(e){__gbInvalidateVisibleResults();var t=++M;'), 'exact Scripture must invalidate stale interactive state before async index load');

for (const marker of [
  "String(event && event.key || '').toLowerCase() === 'k'",
  'modifierCount === 1',
  '!event.altKey',
  '!event.shiftKey',
  '!event.isComposing',
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
  "window.dispatchEvent(new CustomEvent('gb:openSearch'",
  "document.addEventListener('keydown', handleSearchShortcut, true)",
]) check(files.siteUtils.includes(marker), `SiteUtils canonical shortcut marker missing: ${marker}`);
check(!/\b(?:ctrlKey|metaKey)\b/.test(files.search), 'Search must not parse the global keyboard chord');
check(files.search.includes('window.addEventListener("gb:openSearch",function(){ne()})'), 'loaded Search gb:openSearch transport missing');
check(files.search.includes('window.addEventListener("gb:openSearch",function(){__gbLoadSearch(true)})'), 'bootstrap Search gb:openSearch transport missing');
check(files.search.includes('we(),ie())'), 'Search open path must only warm Pagefind');
check(!files.search.includes('ie(function(){E.value.trim()&&xe(E.value.trim())})'), 'Search open path must not re-run the current query');
check(!files.baseLayout.includes('ctrlKey') && !files.baseLayout.includes('metaKey'), 'BaseLayout raw shortcut parser survived');
check(files.baseLayout.includes('window.addEventListener("gb:openSearch"'), 'BaseLayout gb:openSearch loader missing');
check(!files.home.includes('const onShortcut'), 'Home route-local shortcut parser survived');
check(files.home.includes("window.addEventListener('gb:openSearch'"), 'Home gb:openSearch orchestration missing');
check(!files.homeProgressive.includes('stopImmediatePropagation'), 'Home progressive shortcut capture gate survived');
check(!files.notFound.includes('function key(e)') && files.notFound.includes('gb:openSearch'), '404 raw keyboard owner survived');
check(files.rodosloviye.includes('/js/site-utils.js') && files.rodosloviye.indexOf('/js/site-utils.js') < files.rodosloviye.indexOf('/js/site.js'), 'Rodosloviye shared runtime order missing');

const walkSource = (dir, predicate, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'reports', 'audit'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
};
const hasRawSearchShortcut = (text) => {
  const keydown = /addEventListener\s*\(\s*['"]keydown['"]/.test(text);
  const modifier = /\b(?:ctrlKey|metaKey)\b/.test(text);
  const keyK = /(?:String\s*\([^)]*\.key[^)]*\)\.toLowerCase\s*\(\)|\.key)\s*(?:===|==)\s*['"]k['"]/i.test(text)
    || /['"]k['"]\s*(?:===|==)\s*(?:String\s*\([^)]*\.key[^)]*\)\.toLowerCase\s*\(\)|[^;\n]{0,80}\.key)/i.test(text)
    || /toLowerCase\s*\(\)[\s\S]{0,80}['"]k['"]/i.test(text);
  return keydown && modifier && keyK;
};
const ownerCandidates = [
  ...walkSource('js', (file) => file.endsWith('.js')),
  ...walkSource('src', (file) => file.endsWith('.astro')),
  path.resolve('404.html'),
];
const rawOwners = ownerCandidates.filter((file) => hasRawSearchShortcut(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(process.cwd(), file).replace(/\\/g, '/')).sort();
check(JSON.stringify(rawOwners) === JSON.stringify(['js/site-utils.js']), `sole raw Search keyboard owner drifted: ${rawOwners.join(', ')}`);
check(files.auditPro.includes('raw Ctrl/Meta+K owner'), 'audit-pro G112 semantic owner guard missing');

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
  'js/**',
  '**/*.html',
  'src/**/*.astro',
  'src/lib/asset-version.js',
  'data/route-profiles/**',
  'scripts/audit-pro.js',
  'scripts/audit-pro-source-corpus-test.js',
  'scripts/lib/audit-pro-source-corpus.js',
  'scripts/lib/legacy-source-authority.js',
  'scripts/lib/public-surface-registry.js',
  'scripts/lib/route-source-contract.js',
  'scripts/home-browser-contract.mjs',
  'scripts/app-search-surface-source-contract.mjs',
  'scripts/app-search-surface-browser-contract.mjs',
  'node scripts/audit-pro-source-corpus-test.js',
  'node scripts/app-search-surface-source-contract.mjs',
  'node scripts/app-search-surface-browser-contract.mjs',
]) check(files.workflow.includes(marker), `workflow marker missing: ${marker}`);

check(!files.workflow.includes('name: App Search'), 'no new permanent workflow may be introduced');
console.log(`APP SEARCH SURFACE SOURCE CONTRACT: ${passed}/${passed} PASS`);
