#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const cachePath = 'scripts/cache-bust-assets.js';
let cache = fs.readFileSync(cachePath, 'utf8');
if (!cache.includes('const LAZY_NO_PRECACHE = Object.freeze([')) {
  cache = replaceOnce(
    cache,
    `];\n\nmodule.exports = { ASSETS };`,
    `];\n\n// Assets that are version-governed but intentionally fetched only on first use.\n// Keep this policy beside ASSETS so cache revision ownership and SW download\n// strategy cannot drift into contradictory hand-maintained lists.\nconst LAZY_NO_PRECACHE = Object.freeze([\n  'js/search.js',\n  'js/glossary.js',\n  'css/tts-download-notice.css',\n  'js/vosk-tts-engine.js',\n  'manifest.json',\n  'data/search-manifest.json',\n]);\n\nmodule.exports = { ASSETS, LAZY_NO_PRECACHE };`,
    'cache policy export'
  );
}
for (const required of [
  "'css/tts-download-notice.css'",
  "'js/vosk-tts-engine.js'",
  'const LAZY_NO_PRECACHE = Object.freeze([',
  'module.exports = { ASSETS, LAZY_NO_PRECACHE };',
]) {
  if (!cache.includes(required)) throw new Error(`cache policy missing ${required}`);
}
fs.writeFileSync(cachePath, cache, 'utf8');

const auditPath = 'scripts/audit-pro.js';
let audit = fs.readFileSync(auditPath, 'utf8');
const oldImport = `let CACHE_BUST_ASSETS;\ntry { CACHE_BUST_ASSETS = require('./cache-bust-assets').ASSETS; }\ncatch (e) {\n  console.error('FATAL: scripts/cache-bust-assets.js unreadable (' + e.message + ') — audit-pro cannot run without the canonical asset list.');\n  process.exit(1);\n}`;
const newImport = `let CACHE_BUST_ASSETS;\nlet CACHE_BUST_LAZY_NO_PRECACHE;\ntry {\n  const cacheBustPolicy = require('./cache-bust-assets');\n  CACHE_BUST_ASSETS = cacheBustPolicy.ASSETS;\n  CACHE_BUST_LAZY_NO_PRECACHE = cacheBustPolicy.LAZY_NO_PRECACHE;\n  if (!Array.isArray(CACHE_BUST_ASSETS) || !Array.isArray(CACHE_BUST_LAZY_NO_PRECACHE)) {\n    throw new Error('ASSETS and LAZY_NO_PRECACHE must both be arrays');\n  }\n}\ncatch (e) {\n  console.error('FATAL: scripts/cache-bust-assets.js unreadable (' + e.message + ') — audit-pro cannot run without the canonical asset/cache policy.');\n  process.exit(1);\n}`;
if (audit.includes(oldImport)) audit = replaceOnce(audit, oldImport, newImport, 'audit cache policy import');
if (!audit.includes('CACHE_BUST_LAZY_NO_PRECACHE = cacheBustPolicy.LAZY_NO_PRECACHE;')) {
  throw new Error('audit cache policy import missing');
}
const oldLazy = `  const LAZY_NO_PRECACHE = new Set(['/js/search.js', '/js/glossary.js', '/manifest.json', '/data/search-manifest.json']);`;
const newLazy = `  const LAZY_NO_PRECACHE = new Set(CACHE_BUST_LAZY_NO_PRECACHE.map((asset) => '/' + String(asset).replace(/^\\/+/, '')));`;
if (audit.includes(oldLazy)) audit = replaceOnce(audit, oldLazy, newLazy, 'audit lazy policy source');
if (!audit.includes(newLazy)) throw new Error('audit canonical lazy policy usage missing');
fs.writeFileSync(auditPath, audit, 'utf8');

const contractPath = 'scripts/tts-engine-status-contract-test.js';
let contract = fs.readFileSync(contractPath, 'utf8');
const oldChecks = `    ['cache registry owns notice CSS', cacheAssets, /'css\\/tts-download-notice\\.css'/],\n    ['cache registry owns Vosk engine', cacheAssets, /'js\\/vosk-tts-engine\\.js'/],`;
const newChecks = `    ['cache registry owns notice CSS', cacheAssets, /const ASSETS = \\[\\[[\\s\\S]*'css\\/tts-download-notice\\.css'[\\s\\S]*?\\];/],\n    ['cache registry owns Vosk engine', cacheAssets, /const ASSETS = \\[\\[[\\s\\S]*'js\\/vosk-tts-engine\\.js'[\\s\\S]*?\\];/],\n    ['cache policy exports lazy no-precache set', cacheAssets, /const LAZY_NO_PRECACHE = Object\\.freeze\\(\\[[\\s\\S]*?\\]\\);[\\s\\S]*module\\.exports = \\{ ASSETS, LAZY_NO_PRECACHE \\}/],\n    ['notice CSS remains lazy', cacheAssets, /const LAZY_NO_PRECACHE = Object\\.freeze\\(\\[[\\s\\S]*'css\\/tts-download-notice\\.css'[\\s\\S]*?\\]\\);/],\n    ['Vosk engine remains lazy', cacheAssets, /const LAZY_NO_PRECACHE = Object\\.freeze\\(\\[[\\s\\S]*'js\\/vosk-tts-engine\\.js'[\\s\\S]*?\\]\\);/],`;
if (contract.includes(oldChecks)) contract = replaceOnce(contract, oldChecks, newChecks, 'TTS cache policy checks');
if (!contract.includes("['cache policy exports lazy no-precache set'")) throw new Error('TTS lazy policy checks missing');

const oldMutations = `  ['notice CSS cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace("  'css/tts-download-notice.css',\\n", '')],\n  ['Vosk engine cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace("  'js/vosk-tts-engine.js',\\n", '')],`;
const newMutations = `  ['notice CSS cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \\[\\[[\\s\\S]*?)  'css\\/tts-download-notice\\.css',\\n/, '$1')],\n  ['Vosk engine cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \\[\\[[\\s\\S]*?)  'js\\/vosk-tts-engine\\.js',\\n/, '$1')],\n  ['notice CSS lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\\.freeze\\(\\[[\\s\\S]*?)  'css\\/tts-download-notice\\.css',\\n/, '$1')],\n  ['Vosk engine lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\\.freeze\\(\\[[\\s\\S]*?)  'js\\/vosk-tts-engine\\.js',\\n/, '$1')],`;
if (contract.includes(oldMutations)) contract = replaceOnce(contract, oldMutations, newMutations, 'TTS cache policy mutations');
if (!contract.includes("['notice CSS lazy policy entry removed'")) throw new Error('TTS lazy policy mutations missing');
fs.writeFileSync(contractPath, contract, 'utf8');

for (const file of [cachePath, auditPath, contractPath]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
execFileSync(process.execPath, [contractPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/audit-pro.js'], { stdio: 'inherit' });
console.log('TTS lazy-cache policy materialized and verified.');
