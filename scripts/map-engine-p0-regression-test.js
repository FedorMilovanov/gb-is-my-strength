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

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1 || end <= start) return '';
  return source.slice(start, end);
}

const stateBlock = section('function createMap(container, routeData, opts={})', '// Cleanup tracking');
const searchBlock = section("_on(searchInput,'input',()=>{", 'header.appendChild(searchInput);');
const zoomBlock = section('// Zoom with hold-to-repeat', '// Scale bar');
const stageBlock = section('// Stage paths', 'stagePaths.forEach');

check(
  'Share state helper is scoped to createMap runtime state',
  /function\s+getState\s*\(\)\s*\{\s*return\s*\{\s*place:\s*activePlaceId,\s*story:\s*activeStoryId\s*\};\s*\}/.test(stateBlock) &&
    /const\s+st\s*=\s*getState\(\)/.test(source),
  'MAP-P0-02 would return if getState() is removed, moved outside createMap, or detached from active state.'
);

check(
  'Search highlight recomputes story membership inside delayed callback',
  searchBlock.includes('const markerStillInStory = !placeId || visiblePlaces().some(p => p.id === placeId);') &&
    !/labelEl\.setAttribute\(['"]fill['"],\s*inStory\s*\?/.test(searchBlock),
  'MAP-P0-03 requires the delayed callback to avoid the renderMarkers-only inStory binding.'
);

check(
  'Clearing search restores exact story opacity contract',
  searchBlock.includes('const visibleIds = new Set(visiblePlaces().map(p => p.id));') &&
    searchBlock.includes("g.style.opacity = !placeId || visibleIds.has(placeId) ? '1' : '.15';") &&
    !searchBlock.includes("g.style.opacity = ''"),
  'Markers outside the active story must remain at .15 after search is cleared.'
);

check(
  'Stage path grouping rejects missing and out-of-range stage values',
  stageBlock.includes('if(!Number.isInteger(p.stage)||p.stage<0||p.stage>=stagePaths.length)return;') &&
    stageBlock.includes('stagePaths[p.stage].push(p);'),
  'ASTRO-P0-01/02 would return if stage-less places reach stagePaths[p.stage].push().'
);

check(
  'Zoom buttons support ordinary and programmatic click',
  zoomBlock.includes('function zoomOnce(dir)') &&
    /_on\(btn,\s*['"]click['"],[\s\S]*?zoomOnce\(dir\)/.test(zoomBlock),
  'MAP-P0-08 requires click/keyboard activation in addition to press-and-hold.'
);

if (failures) {
  console.error(`\n❌ map-engine P0 regressions: ${failures} failed check(s)`);
  process.exit(1);
}

console.log('\n✅ map-engine P0 regression guard passed');
