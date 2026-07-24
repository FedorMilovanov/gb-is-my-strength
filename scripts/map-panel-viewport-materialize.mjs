#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'karty/_engine/map-engine.js');
const write = process.argv.includes('--write');
let source = fs.readFileSync(TARGET, 'utf8');

const installed = [
  'map-engine.js v0.54',
  'max-height:calc(100% - max(8px,env(safe-area-inset-top)))',
  '.me-panel__head,.me-tabs,.me-nav{flex:0 0 auto}',
  'min-height:0;overflow-y:auto;overscroll-behavior:contain',
  'width:420px;max-height:calc(100% - 24px)'
].every((needle) => source.includes(needle));

if (installed) {
  console.log('PASS karty/_engine/map-engine.js already has the viewport-bound panel contract');
  process.exit(0);
}

const replacements = [
  [
    ' * map-engine.js v0.53 — reusable biblical map rendering engine. Signature controls + story focus halo.',
    ' * map-engine.js v0.54 — reusable biblical map rendering engine. Viewport-bound panels + signature controls + story focus halo.'
  ],
  [
    ".me-panel{position:absolute;bottom:0;left:0;right:0;background:rgba(13,17,26,.95);backdrop-filter:blur(16px);border-top:1px solid rgba(232,200,121,.2);z-index:20;transition:transform .35s cubic-bezier(.4,0,.2,1);transform:translateY(105%);display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.4)}",
    ".me-panel{position:absolute;bottom:0;left:0;right:0;box-sizing:border-box;max-height:calc(100% - 8px);max-height:calc(100% - max(8px,env(safe-area-inset-top)));overflow:hidden;background:rgba(13,17,26,.95);backdrop-filter:blur(16px);border-top:1px solid rgba(232,200,121,.2);z-index:20;transition:transform .35s cubic-bezier(.4,0,.2,1);transform:translateY(105%);display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.4)}"
  ],
  [
    ".me-panel__stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}",
    ".me-panel__stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}\n.me-panel__head,.me-tabs,.me-nav{flex:0 0 auto}"
  ],
  [
    ".me-content{padding:12px 16px;overflow-y:auto;flex:1;font-size:13px;line-height:1.65;color:#9aa2ae;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}.me-content *{will-change:auto}",
    ".me-content{padding:12px 16px;min-height:0;overflow-y:auto;overscroll-behavior:contain;flex:1;font-size:13px;line-height:1.65;color:#9aa2ae;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}.me-content *{will-change:auto}"
  ],
  [
    ".me-panel{left:12px;right:auto;bottom:12px;width:420px;border-radius:14px;border:1px solid rgba(232,200,121,.2);transform:translateX(-120%)}",
    ".me-panel{left:12px;right:auto;bottom:12px;width:420px;max-height:calc(100% - 24px);border-radius:14px;border:1px solid rgba(232,200,121,.2);transform:translateX(-120%)}"
  ]
];

for (const [oldText, newText] of replacements) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`map panel materializer guard failed: expected 1 occurrence, found ${count}: ${oldText.slice(0, 120)}`);
  }
  source = source.replace(oldText, newText);
}

if (!source.includes('max-height:calc(100% - max(8px,env(safe-area-inset-top)))')) {
  throw new Error('map panel materializer postcondition failed: safe-area max-height missing');
}
if (!source.includes('.me-panel__head,.me-tabs,.me-nav{flex:0 0 auto}')) {
  throw new Error('map panel materializer postcondition failed: fixed flex regions missing');
}
if (!source.includes('min-height:0;overflow-y:auto;overscroll-behavior:contain')) {
  throw new Error('map panel materializer postcondition failed: scroll container contract missing');
}

if (write) {
  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('UPDATED karty/_engine/map-engine.js — viewport-bound panel contract installed');
} else {
  console.log('PASS map panel viewport materializer guards');
}
