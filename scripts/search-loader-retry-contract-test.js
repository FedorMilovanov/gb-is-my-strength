#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ownerPath = path.resolve(
  process.cwd(),
  'src/components/article-pilots/_shared/MobileChromePage.astro',
);
const source = fs.readFileSync(ownerPath, 'utf8');

assert.match(
  source,
  /__gbSearchLoadState\?: 'idle' \| 'loading' \| 'ready' \| 'failed';/,
  'mobile search owner must expose explicit lazy-load terminal state',
);
assert.match(
  source,
  /if \(w\.__gbSearchLoading \|\| w\.__gbSearchBootRequested\) return;/,
  'mobile search owner must deduplicate an in-flight bootstrap',
);
assert.match(
  source,
  /w\.__gbSearchBootRequested = true;[\s\S]*?w\.__gbSearchLoadState = 'loading';/,
  'mobile search owner must enter the loading state before script acquisition',
);

const onloadStart = source.indexOf('s.onload = () => {');
const onerrorStart = source.indexOf('s.onerror = () => {', onloadStart);
const appendStart = source.indexOf('document.head.appendChild(s);', onerrorStart);
assert.ok(onloadStart >= 0 && onerrorStart > onloadStart && appendStart > onerrorStart, 'mobile search script terminal handlers missing');

const onloadBody = source.slice(onloadStart, onerrorStart);
const onerrorBody = source.slice(onerrorStart, appendStart);

for (const [label, body] of [
  ['loaded-without-GBSearch', onloadBody],
  ['network-error', onerrorBody],
]) {
  assert.match(body, /w\.__gbSearchLoading = false;/, `${label}: loading flag must be released`);
  assert.match(body, /w\.__gbSearchBootRequested = false;/, `${label}: retry lock must be released`);
  assert.match(body, /w\.__gbSearchLoadState = 'failed';/, `${label}: terminal state must be failed`);
  assert.match(body, /s\.remove\(\);/, `${label}: failed script node must be removed before retry`);
}

assert.match(
  onloadBody,
  /if \(w\.GBSearch && typeof w\.GBSearch\.open === 'function'\) \{[\s\S]*?w\.__gbSearchLoadState = 'ready';[\s\S]*?w\.GBSearch\.open\(\);[\s\S]*?return;/,
  'successful acquisition must remain ready/open and must not fall through to failure reset',
);

console.log('Mobile search retry source contract: PASS');
