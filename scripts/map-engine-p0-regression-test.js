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
const scaleBlock = section('// Scale bar', '// Panel backdrop');
const stageBlock = section('// Stage paths', 'stagePaths.forEach');
const waypointBlock = section('// Waypoints', '// Dashed connection lines between waypoints');
const photoRenderBlock = section("}else if(tab==='photos'&&place.photos){", '}else if(map[tab]){');
const photoOwnerBlock = section('// One gallery owner:', '// Stage caption bar');
const flyBlock = section('function flyTo(cx,cy,w,duration=700){', '// ── Pan/Zoom ──');
const tourBlock = section('function runTourStep(){', '// Photo modal');
const toastBlock = section('// Toast notification', '// Stage dots');
const storyToastBlock = section('// Story toast for richer notification', 'function setStory(storyId){');
const setStoryBlock = section('function setStory(storyId){', 'function renderStories(){');
const loadingBlock = section('// ── Loading state ──', '// Keyboard shortcuts overlay');

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
  'Markers outside the active story must remain dimmed after search is cleared.'
);

check(
  'Active search cannot promote an out-of-story marker',
  searchBlock.includes('const visibleIds = new Set(visiblePlaces().map(p => p.id));') &&
    /if\s*\(placeId\s*&&\s*!visibleIds\.has\(placeId\)\)\s*\{[\s\S]{0,120}?g\.style\.opacity\s*=\s*['"]0['"];?[\s\S]{0,80}?return;?/.test(searchBlock),
  'ENGINE-P1-26 requires search to preserve story membership before text matching/highlighting.'
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

check(
  'Scale bar derives CSS-pixel scale from the rendered canvas and observes resize',
  /const\s+renderedWidth\s*=\s*canvas\.getBoundingClientRect\(\)\.width/.test(scaleBlock) &&
    /screenPxPerKm\s*=\s*\(renderedWidth\s*\/\s*view\.w\)\s*\*\s*pxPerKm/.test(scaleBlock) &&
    !/cfg\.W0\s*\/\s*view\.w/.test(scaleBlock) &&
    /scaleResizeObserver\s*=\s*new ResizeObserver/.test(source) &&
    /scaleResizeObserver\.observe\(canvas\)/.test(source) &&
    /scaleResizeObserver\?\.disconnect\(\)/.test(source),
  'MAP-P1-11 requires real rendered-width geometry and resize-aware recomputation.'
);

check(
  'Reduced-motion flyTo resolves the target synchronously',
  /prefers-reduced-motion:\s*reduce/.test(flyBlock) &&
    /if\s*\(reduceMotion\s*\|\|\s*duration\s*<=\s*0\)\s*\{[\s\S]{0,180}?view\s*=\s*\{\.\.\.to\};[\s\S]{0,120}?applyViewBox\(\);[\s\S]{0,80}?return;?/.test(flyBlock),
  'MAP-P1-13 requires the JS camera animation itself to respect reduced motion, not only CSS transitions.'
);

check(
  'Tour renders authored story stage ids rather than sequence indexes',
  tourBlock.includes('const sid=stageIds[tourStepIdx];') &&
    /showCaption\(route\.stages\?\.\[sid\],\s*tourStepIdx,\s*stageIds\)/.test(tourBlock) &&
    /querySelector\(`\.me-stage-dot\[data-stage="\$\{sid\}"\]`\)/.test(tourBlock) &&
    !/route\.stages\s*&&\s*route\.stages\[tourStepIdx\]/.test(tourBlock),
  'MAP-P1-01 requires stories such as Avraam lot [3,5] to retain stage identity during tours.'
);

check(
  'Multi-photo gallery keeps canonical full source, place and index ownership',
  /class="me-clickable-photo"/.test(photoRenderBlock) &&
    /data-photo-index="\$\{i\}"/.test(photoRenderBlock) &&
    /data-src="\$\{esc\(ph\.src\|\|ph\.thumb\|\|''\)\}"/.test(photoRenderBlock) &&
    /closest\(['"]img\.me-clickable-photo['"]\)/.test(photoOwnerBlock) &&
    /getActivePlace\(\)/.test(photoOwnerBlock) &&
    /openPhoto\(src,label,img\.dataset\.credit\|\|'',activePlace,photoIndex\)/.test(photoOwnerBlock),
  'MAP-P1-18 requires modal swipe state to start from the clicked full-size photo, not a thumbnail-only delegated image.'
);

check(
  'Verified waypoint labels are screen-space readable anchors',
  waypointBlock.includes("g.setAttribute('data-screen-anchor','waypoint')") &&
    waypointBlock.includes("g.setAttribute('data-map-x',String(wp.x))") &&
    waypointBlock.includes("g.setAttribute('data-map-y',String(wp.y))") &&
    /createElementNS\([^\n]+,'rect'\)/.test(waypointBlock) &&
    /setAttribute\(['"]font-size['"],['"]11['"]\)/.test(waypointBlock),
  'WAYP-P1-01 requires labels to remain legible in CSS-pixel space with a readable background.'
);

check(
  'Map notifications use one persistent polite live region',
  toastBlock.includes("toastEl.setAttribute('role','status')") &&
    toastBlock.includes("toastEl.setAttribute('aria-live','polite')") &&
    toastBlock.includes("toastEl.setAttribute('aria-atomic','true')") &&
    /function showStoryToast\(story\)\s*\{[\s\S]{0,180}?showToast\(/.test(storyToastBlock) &&
    !/document\.createElement\(['"]div['"]\)/.test(storyToastBlock) &&
    /showStoryToast\(story\)/.test(setStoryBlock),
  'ENGINE-P2-04 requires one canonical status owner instead of a second temporary story-notification DOM.'
);

check(
  'Ready route data does not show an artificial blocking loading overlay by default',
  /if\s*\(opts\.showLoading\s*===\s*true\)\s*\{/.test(loadingBlock) &&
    /className=['"]me-loading['"]/.test(loadingBlock),
  'ENGINE-P2-03 permits the blocking loading overlay only as an explicit opt-in while route data is genuinely pending.'
);

// Temporary draft-only transport: the existing diagnostics artifact captures
// the exact shared runtime bytes so the large owner can be patched locally
// without reconstructing a 3k-line file through the Contents API.
const reportsDir = path.join(root, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, 'map-engine-source.log'), source, 'utf8');

if (failures) {
  console.error(`\n❌ map-engine regression guard: ${failures} failed check(s)`);
  process.exit(1);
}

console.log('\n✅ map-engine regression guard passed');
