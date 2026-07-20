#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'karty/_engine/map-engine.js'), 'utf8');
let failures = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`✅ ${name}`);
    return;
  }
  failures += 1;
  console.error(`❌ ${name}${detail ? `\n   → ${detail}` : ''}`);
}

check(
  'Share state helper is defined inside createMap',
  /function\s+getState\s*\(\)\s*\{[\s\S]*?place\s*:\s*activePlaceId[\s\S]*?story\s*:\s*activeStoryId[\s\S]*?\}/.test(source),
  'MAP-P0-02 would return if getState() is removed or detached from active runtime state.'
);

check(
  'Search highlight does not reference an undefined inStory binding',
  !/labelEl\.setAttribute\(['"]fill['"],\s*inStory\s*\?/.test(source) && /markerStillInStory/.test(source),
  'MAP-P0-03 requires the delayed callback to recompute story membership from the marker id.'
);

check(
  'Clearing search restores story opacity instead of blanking inline opacity',
  /if\s*\(!q\)\s*\{[\s\S]*?visiblePlaces\(\)[\s\S]*?g\.style\.opacity\s*=\s*inStory\s*\?\s*['"]1['"]\s*:\s*['"]\.15['"]/.test(source),
  'Markers outside the active story must remain dim after search is cleared.'
);

check(
  'Stage path grouping rejects missing and out-of-range stage values',
  /Number\.isInteger\(p\.stage\)[\s\S]*?p\.stage\s*<\s*0[\s\S]*?p\.stage\s*>=\s*stagePaths\.length[\s\S]*?return/.test(source),
  'ASTRO-P0-01/02 would return if stage-less places reach stagePaths[p.stage].push().' 
);

check(
  'Zoom buttons support ordinary and programmatic click',
  /function\s+zoomOnce\s*\(dir\)/.test(source) && /_on\(btn,\s*['"]click['"][\s\S]*?zoomOnce\(dir\)/.test(source),
  'MAP-P0-08 requires click/keyboard activation in addition to press-and-hold.'
);

if (failures) {
  console.error(`\n❌ map-engine P0 regressions: ${failures} failed check(s)`);
  process.exit(1);
}

console.log('\n✅ map-engine P0 regression guard passed');
