#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const FILES = {
  store: 'src/runtime/favorite-store.js',
  runtime: 'src/components/reader-platform/ReaderActionsRuntime.astro',
  controller: 'js/floating-cluster-controller.js',
  saveButton: 'src/components/ui/floating-cluster/SaveButton.astro',
  home: 'src/components/home/HomeSections/Favorites.astro',
  favoritesPage: 'src/pages/izbrannoe/index.astro',
  browser: 'scripts/favorite-store-browser-contract.mjs',
  workflow: '.github/workflows/favorite-store.yml',
};

const text = Object.fromEntries(Object.entries(FILES).map(([key, relative]) => {
  const full = path.join(ROOT, relative);
  assert.ok(fs.existsSync(full), `missing ${relative}`);
  return [key, fs.readFileSync(full, 'utf8')];
}));

const checks = [];
function check(id, area, description, pass, evidence = '') {
  checks.push({ id, area, description, pass: Boolean(pass), evidence: String(evidence) });
}
function has(haystack, needle) { return haystack.includes(needle); }
function count(haystack, needle) { return haystack.split(needle).length - 1; }

check('FAV-SRC-01', 'api', 'GBFavoriteStore is the public canonical API', has(text.store, 'window.GBFavoriteStore = api'), 'public API assignment');
check('FAV-SRC-02', 'api', 'API version is exactly 1', /const VERSION = 1;/.test(text.store), 'VERSION=1');
check('FAV-SRC-03', 'schema', 'favorite item schema is versioned', /const SCHEMA_VERSION = 1;/.test(text.store), 'SCHEMA_VERSION=1');
check('FAV-SRC-04', 'storage', 'legacy storage key is retained for zero-loss migration', /const STORAGE_KEY = ['"]gb-favorites['"]/.test(text.store), 'gb-favorites');
check('FAV-SRC-05', 'storage', 'store caps collection at 50', /const MAX_ITEMS = 50;/.test(text.store), 'MAX_ITEMS=50');
check('FAV-SRC-06', 'api', 'store exposes list/get/has/add/remove/toggle/clear', /list,\s*get,\s*has,\s*add,\s*remove,\s*toggle,\s*clear/.test(text.store), 'mutation API');
check('FAV-SRC-07', 'api', 'store exposes subscribe and syncButtons', /subscribe,\s*syncButtons/.test(text.store), 'consumer API');
check('FAV-SRC-08', 'events', 'store publishes versioned ready event', has(text.store, "const READY_EVENT = 'gb:favorite-store-ready'"), 'ready event');
check('FAV-SRC-09', 'events', 'store publishes change event', has(text.store, "const CHANGE_EVENT = 'gb:favorites-changed'"), 'change event');
check('FAV-SRC-10', 'events', 'cross-tab storage synchronization is owned by store', /addEventListener\(['"]storage['"]/.test(text.store) && has(text.store, "event.key !== STORAGE_KEY"), 'storage listener');

check('FAV-META-01', 'metadata', 'canonical page config is the primary metadata source', /const page = config\.page/.test(text.store), 'SITE_CONFIG.page');
check('FAV-META-02', 'metadata', 'canonical category supports route-owned category/section/taxonomy', /page\.favoriteCategory[\s\S]*page\.category[\s\S]*page\.section[\s\S]*page\.taxonomy\?\.primary/.test(text.store), 'canonical category chain');
check('FAV-META-03', 'metadata', 'favorite type is explicit', /favoriteType[\s\S]*page\.type[\s\S]*inferType/.test(text.store), 'type chain');
check('FAV-META-04', 'metadata', 'routeId is explicit', has(text.store, 'routeId:'), 'routeId');
check('FAV-META-05', 'metadata', 'metadata source is explicit', has(text.store, 'metadataSource:'), 'metadataSource');
check('FAV-META-06', 'metadata', 'breadcrumb presentation is not read by store', !/breadcrumb|breadcrumb__link/.test(text.store), 'zero breadcrumb selectors');
check('FAV-META-07', 'metadata', 'OG metadata is only a bounded fallback inside store', count(text.store, 'meta[property="og:') <= 3 && !/metaContent\([^)]*\)\s*\|\|\s*page\./.test(text.store), 'canonical fields precede fallback');
check('FAV-META-08', 'metadata', 'same-origin path normalization rejects foreign origins', has(text.store, 'url.origin !== location.origin'), 'same-origin guard');
check('FAV-META-09', 'metadata', 'image protocol is constrained', /\^https\?:\$/.test(text.store), 'http(s) only');
check('FAV-META-10', 'metadata', 'path aliases are normalized', text.store.includes("replace(/index\\.html$/i, '')") && text.store.includes("path.replace(/\\/+$/, '')"), 'index/trailing slash normalization');

check('FAV-MIG-01', 'migration', 'legacy arrays are accepted', /if \(Array\.isArray\(parsed\)\) return parsed/.test(text.store), 'legacy array');
check('FAV-MIG-02', 'migration', 'future/alternate items envelope is accepted safely', /Array\.isArray\(parsed\.items\)/.test(text.store), 'items envelope');
check('FAV-MIG-03', 'migration', 'legacy current-page metadata is replaced by canonical metadata', /const isCurrent[\s\S]*const canonical = isCurrent \? currentMeta : null/.test(text.store), 'current route canonicalization');
check('FAV-MIG-04', 'migration', 'legacy entries receive schema version', /schemaVersion: SCHEMA_VERSION/.test(text.store), 'schema stamp');
check('FAV-MIG-05', 'migration', 'duplicate paths collapse deterministically', /const byPath = new Map\(\)/.test(text.store), 'dedupe map');
check('FAV-MIG-06', 'migration', 'legacy fc:saved current-page flag migrates', has(text.store, '`fc:saved:${meta.path}`'), 'legacy flag');
check('FAV-MIG-07', 'migration', 'legacy flag is removed after successful migration', /localStorage\.removeItem\(key\)/.test(text.store), 'legacy cleanup');
check('FAV-MIG-08', 'migration', 'invalid records fail closed', /if \(!value \|\| typeof value !== 'object' \|\| Array\.isArray\(value\)\) return null/.test(text.store), 'record guard');

check('FAV-UI-01', 'buttons', 'store synchronizes all save surfaces', has(text.store, '[data-fc-action="save"], .gb-save'), 'shared selector');
check('FAV-UI-02', 'buttons', 'saved class is synchronized', /classList\.toggle\(['"]is-saved['"]/.test(text.store), 'is-saved');
check('FAV-UI-03', 'buttons', 'aria-pressed is synchronized', /setAttribute\(['"]aria-pressed['"]/.test(text.store), 'aria-pressed');
check('FAV-UI-04', 'buttons', 'saved accessible label is truthful', has(text.store, 'Убрать из Избранного'), 'remove label');
check('FAV-UI-05', 'buttons', 'unsaved accessible label is truthful', has(text.store, 'Добавить в Избранное'), 'add label');
check('FAV-UI-06', 'buttons', 'SSR SaveButton label reflects saved prop', /aria-label=\{saved \? ['"]Убрать из Избранного['"] : ['"]Добавить в Избранное['"]\}/.test(text.saveButton), 'saved-aware SSR label');
check('FAV-UI-07', 'buttons', 'store publishes explicit favorite state', has(text.store, 'button.dataset.favoriteState'), 'data state');

check('FAV-OWN-01', 'ownership', 'legacy controller no longer declares FAV_KEY', !/\bFAV_KEY\b/.test(text.controller), 'no FAV_KEY');
check('FAV-OWN-02', 'ownership', 'legacy controller no longer reads/writes gb-favorites directly', !/gb-favorites|localStorage\.(?:getItem|setItem)\([^)]*favorite/i.test(text.controller), 'no direct storage');
check('FAV-OWN-03', 'ownership', 'legacy controller no longer scrapes breadcrumb for favorites', !/getPageMeta[\s\S]*breadcrumb__link/.test(text.controller), 'no breadcrumb metadata');
check('FAV-OWN-04', 'ownership', 'legacy controller delegates mutations to GBFavoriteStore', /GBFavoriteStore[\s\S]*\.toggle\(/.test(text.controller), 'toggle delegate');
check('FAV-OWN-05', 'ownership', 'legacy controller delegates button synchronization', /GBFavoriteStore[\s\S]*\.syncButtons\(/.test(text.controller), 'sync delegate');
check('FAV-OWN-06', 'ownership', 'ReaderActionsRuntime imports store before consumers', text.runtime.indexOf("import '../../runtime/favorite-store.js'") >= 0 && text.runtime.indexOf("import '../../runtime/favorite-store.js'") < text.runtime.indexOf("import '../../runtime/reader-actions.js'"), 'import order');

check('FAV-CONS-01', 'consumers', 'Home imports canonical store', /import ['"]\.\.\/\.\.\/\.\.\/runtime\/favorite-store\.js['"]/.test(text.home), 'Home module import');
check('FAV-CONS-02', 'consumers', 'Home does not access favorite localStorage directly', !/localStorage|FAV_KEY|gb-favorites/.test(text.home), 'Home API-only');
check('FAV-CONS-03', 'consumers', 'Home consumes list API', /GBFavoriteStore[\s\S]*\.list\(/.test(text.home), 'Home list');
check('FAV-CONS-04', 'consumers', 'Home subscribes to changes', /\.subscribe\(/.test(text.home), 'Home subscribe');
check('FAV-CONS-05', 'consumers', '/izbrannoe imports canonical store', /import ['"]\.\.\/\.\.\/runtime\/favorite-store\.js['"]/.test(text.favoritesPage), 'favorites page import');
check('FAV-CONS-06', 'consumers', '/izbrannoe does not access favorite localStorage directly', !/localStorage|FAV_KEY|define:vars=\{\{ FAV_KEY/.test(text.favoritesPage), 'page API-only');
check('FAV-CONS-07', 'consumers', '/izbrannoe delegates remove and clear', /GBFavoriteStore[\s\S]*\.remove\(/.test(text.favoritesPage) && /GBFavoriteStore[\s\S]*\.clear\(/.test(text.favoritesPage), 'page mutations');
check('FAV-CONS-08', 'consumers', '/izbrannoe subscribes to changes', /\.subscribe\(/.test(text.favoritesPage), 'page subscribe');

check('FAV-LIFE-01', 'lifecycle', 'store is idempotent', /window\.GBFavoriteStore\?\.version === VERSION/.test(text.store), 'version guard');
check('FAV-LIFE-02', 'lifecycle', 'store handles Astro navigation lifecycle', has(text.store, "document.addEventListener('astro:page-load'"), 'astro lifecycle');
check('FAV-LIFE-03', 'lifecycle', 'store handles pageshow', has(text.store, "window.addEventListener('pageshow'"), 'pageshow');
check('FAV-LIFE-04', 'lifecycle', 'store marks readiness', has(text.store, 'data-gb-favorite-store-ready') || has(text.store, 'dataset.gbFavoriteStoreReady'), 'readiness marker');

check('FAV-TEST-01', 'tests', 'browser contract covers Hermenevtika', has(text.browser, 'hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki'), 'Herm route');
check('FAV-TEST-02', 'tests', 'browser contract covers Gill', has(text.browser, 'dzhon-gill-chast-1-chelovek'), 'Gill route');
check('FAV-TEST-03', 'tests', 'browser contract covers Antisovetov', has(text.browser, '20-antisovetov-pastoru'), 'Antisovetov route');
check('FAV-TEST-04', 'tests', 'browser contract covers Home consumer', has(text.browser, 'home.goto(`${origin}/`'), 'Home');
check('FAV-TEST-05', 'tests', 'browser contract covers /izbrannoe consumer', has(text.browser, '/izbrannoe/'), 'favorites page');
check('FAV-TEST-06', 'tests', 'browser contract covers cross-tab storage synchronization', /newPage\(|external-sync|storage/.test(text.browser), 'cross-tab');
check('FAV-TEST-07', 'tests', 'browser contract records page errors', /pageerror/.test(text.browser), 'page errors');
check('FAV-TEST-08', 'tests', 'workflow checks exact commit identity', /git rev-parse HEAD/.test(text.workflow), 'exact identity');
check('FAV-TEST-09', 'tests', 'workflow runs source contract', has(text.workflow, 'favorite-store-source-contract.mjs'), 'source gate');
check('FAV-TEST-10', 'tests', 'workflow runs production-like build', has(text.workflow, 'strangler:build:production-like'), 'production-like build');
check('FAV-TEST-11', 'tests', 'workflow runs browser contract', has(text.workflow, 'favorite-store-browser-contract.mjs'), 'browser gate');
check('FAV-TEST-12', 'tests', 'workflow uploads durable evidence', /upload-artifact@[0-9a-f]{40}/.test(text.workflow), 'artifact pin');

const failed = checks.filter((entry) => !entry.pass);
const sha = process.env.GITHUB_SHA || null;
const summary = { sha, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, results: checks };
fs.writeFileSync(path.join(REPORTS, 'favorite-store-source-contract.json'), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(REPORTS, 'favorite-store-source-contract.md'), [
  '# Favorite Store Source Contract',
  '',
  `- SHA: \`${sha || 'local'}\``,
  `- Checks: **${checks.length}**`,
  `- Passed: **${checks.length - failed.length}**`,
  `- Failed: **${failed.length}**`,
  '',
  ...checks.map((entry) => `- ${entry.pass ? 'PASS' : 'FAIL'} \`${entry.id}\` — ${entry.description}${entry.evidence ? ` (${entry.evidence})` : ''}`),
  '',
].join('\n'));

for (const entry of checks) console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${entry.id} ${entry.description}`);
console.log(JSON.stringify({ sha, checks: checks.length, passed: checks.length - failed.length, failed: failed.length }));
if (failed.length) process.exitCode = 1;
