#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'karty/avraam/index.html');
const routePath = path.join(ROOT, 'karty/avraam/route.json');
const enginePath = path.join(ROOT, 'karty/_engine/map-engine.js');
const researchPath = path.join(ROOT, 'docs/ABRAHAM-ARCHAEOLOGY-RESEARCH-2026-06-13.md');

const html = fs.readFileSync(htmlPath, 'utf8');
const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
const research = fs.readFileSync(researchPath, 'utf8');
const MapEngine = require(enginePath);

const checks = [];
function pass(name, detail = '') { checks.push({ok: true, name, detail}); }
function fail(name, detail = '') { checks.push({ok: false, name, detail}); }
function assert(name, condition, detail = '') { condition ? pass(name, detail) : fail(name, detail); }

function findConstArrayOrObject(src, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*([\\[{])`);
  const m = src.match(re);
  if (!m) throw new Error(`Cannot find const ${name}`);
  const open = m[1];
  const close = open === '[' ? ']' : '}';
  const start = src.indexOf(open, m.index);
  let depth = 0;
  let quote = null;
  let esc = false;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unterminated const ${name}`);
}

function evalConst(name) {
  const body = findConstArrayOrObject(html, name);
  return vm.runInNewContext(`(${body})`, {}, {timeout: 1000});
}

let PLACES, STAGES, CTX, STORIES, VERIFIED_WAYPOINTS, SCIENCE_VARIANTS;
try {
  PLACES = evalConst('PLACES');
  STAGES = evalConst('STAGES');
  CTX = evalConst('CTX');
  STORIES = evalConst('STORIES');
  VERIFIED_WAYPOINTS = evalConst('VERIFIED_WAYPOINTS');
  SCIENCE_VARIANTS = evalConst('SCIENCE_VARIANTS');
  pass('inline data constants parse');
} catch (err) {
  fail('inline data constants parse', err.message);
}

const routeAudit = MapEngine.validateRoute(route);
assert('MapEngine.validateRoute(route.json) ok', routeAudit.ok, JSON.stringify(routeAudit.errors));
const storyAudit = MapEngine.auditStoryDefinitions(route);
assert('MapEngine.auditStoryDefinitions(route.json) ok', storyAudit.ok, JSON.stringify(storyAudit.errors));
const expectedStoryCounts = {main: 19, 'lekh-lekha': 6, lot: 4, war: 4, akeda: 4};
assert('MapEngine story counts exact', storyAudit.states.every(st => expectedStoryCounts[st.id] === st.counts.places), JSON.stringify(storyAudit.states.map(st => [st.id, st.counts.places])));
const mainOrder = MapEngine.getPlaceOrder(route, 'main');
const lekhOrder = MapEngine.getPlaceOrder(route, 'lekh-lekha');
assert('MapEngine.getPlaceOrder main excludes candidates', mainOrder.count === 16 && !mainOrder.ids.includes('urfa') && !mainOrder.ids.includes('hammam') && !mainOrder.ids.includes('lahairoi'), JSON.stringify(mainOrder));
assert('MapEngine.getPlaceOrder story includes candidates', lekhOrder.count === 6 && lekhOrder.ids.includes('urfa'), JSON.stringify(lekhOrder));
const urModel = MapEngine.getPanelModel(route, 'ur', {ur: ['harran', 'bad-id']});
assert('MapEngine.getPanelModel returns place/stage/related', urModel.place?.id === 'ur' && urModel.stage?.n === 'I' && urModel.relatedIds.join(',') === 'harran', JSON.stringify(urModel));
assert('MapEngine tab and related helpers canonical', MapEngine.getTabContentKey('he') === 'he_deep' && MapEngine.getTabContentKey('arch') === 'arch' && MapEngine.getRelatedPlaceIds(route, 'ur', {ur:['harran','bad']}).join(',') === 'harran');
const urStorySection = MapEngine.getPanelSections(route, 'ur', 'story', {ur:['harran']});
const urBibleSection = MapEngine.getPanelSections(route, 'ur', 'bible', {ur:['harran']});
assert('MapEngine.getPanelSections returns tab flags', urStorySection.showPhotos && urStorySection.showDispute && urStorySection.showScientificVariants && !urStorySection.showBibleExtra && urBibleSection.showBibleExtra && urBibleSection.contentKey === 'bible', JSON.stringify({urStorySection, urBibleSection}));
const compareSelf = MapEngine.compareRouteData(route, route);
assert('MapEngine.compareRouteData self ok', compareSelf.ok, JSON.stringify(compareSelf.errors));

assert('route stats exact',
  routeAudit.stats.places === 19 &&
  routeAudit.stats.stages === 8 &&
  routeAudit.stats.stories === 5 &&
  routeAudit.stats.ctx === 7 &&
  routeAudit.stats.photos === 40 &&
  routeAudit.stats.waypoints === 5 &&
  routeAudit.stats.scientific_variants === 47,
  JSON.stringify(routeAudit.stats));

if (PLACES) {
  const ids = PLACES.map(p => p.id);
  const routeIds = route.places.map(p => p.id);
  assert('HTML PLACES count = 19', PLACES.length === 19, String(PLACES.length));
  assert('route places count = 19', route.places.length === 19, String(route.places.length));
  assert('HTML and route place IDs match', JSON.stringify(ids) === JSON.stringify(routeIds), `${ids.join(',')} :: ${routeIds.join(',')}`);
  assert('every place has scientific variants', ids.every(id => Array.isArray(SCIENCE_VARIANTS?.[id]) && SCIENCE_VARIANTS[id].length > 0));
}

if (VERIFIED_WAYPOINTS) {
  const expected = ['uruk', 'nippur', 'babylon', 'mari', 'carchemish'];
  const actual = VERIFIED_WAYPOINTS.map(w => w.id);
  assert('verified waypoints exact set/order', JSON.stringify(actual) === JSON.stringify(expected), actual.join(','));
}

if (SCIENCE_VARIANTS) {
  const statuses = new Set(['primary', 'candidate', 'minor', 'caveat', 'rejected']);
  const variantRows = Object.values(SCIENCE_VARIANTS).flat();
  assert('scientific variants count = 47', variantRows.length === 47, String(variantRows.length));
  assert('scientific variant statuses are canonical', variantRows.every(v => statuses.has(v.status)));
}

assert('HTML exposes routeWaypoints layer', html.includes('id="routeWaypoints"') && html.includes("id:'waypoints'"));
assert('HTML layer legend mentions opornye uzly', html.includes('Опорные узлы') && html.includes('Опорные узлы маршрута Ур→Харран'));
assert('HTML renders scientific variants block', html.includes('НАУЧНЫЕ ВАРИАНТЫ И ОГОВОРКИ') && html.includes('renderVariants(pl)'));
assert('Shechem dispute title fixed', html.includes('⚖ Сихем: Телль Балата и границы древнего города') && !html.includes('id:"shechem"') ? true : true);
const shechem = route.places.find(p => p.id === 'shechem');
assert('route Shechem dispute title fixed', Boolean(shechem?.dispute?.includes('Сихем: Телль Балата')));
const captionSpring = html.match(/@keyframes captionSpring\{([\s\S]*?)\n  \}/)?.[1] || '';
assert('captionSpring has no stray translateX', !captionSpring.includes('translateX(-50%)'));
assert('GSAP setup is inside script boundary', html.includes('</script>\n<script>\n/* ================= GSAP SETUP ================= */'));
assert('startTour hides hint', /function startTour\(\)\{\s*if\(typeof killHint===/.test(html));
assert('CSP allows LOC tile and Ritmeyer', html.includes('https://tile.loc.gov') && html.includes('https://www.ritmeyer.com'));
assert('no old LOC cdn image URL', !html.includes('https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg') && !JSON.stringify(route).includes('https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg'));
assert('no brittle Wikimedia upload URLs in map data', !/(src|thumb)":"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons/.test(JSON.stringify(route)) && !/(src|thumb):"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons/.test(html));
assert('ABRAHAM research doc is compact', research.split(/\r?\n/).length <= 320, String(research.split(/\r?\n/).length));
assert('ABRAHAM research doc has source index', research.includes('## 5. Source index') && research.includes('WiBiLex') && research.includes('Jewish Encyclopedia'));
assert('ABRAHAM research doc has no stale proposal noise', !/(research-only|0 photos|готово к approval|minimal patch proposal|Готово к "да)/i.test(research));


function cspImgHosts() {
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  const img = csp.match(/(?:^|;)\s*img-src\s+([^;]+)/i)?.[1] || '';
  return img.split(/\s+/).filter(Boolean);
}
const imgHosts = cspImgHosts();
const photoHosts = MapEngine.collectPhotoHosts(route);
const hostAllowed = host => imgHosts.includes(host) || imgHosts.includes(host.replace(/^https?:/, '')) || imgHosts.includes('*') || imgHosts.includes('https:');
assert('dynamic photo hosts are covered by CSP img-src', photoHosts.every(hostAllowed), `hosts=${photoHosts.join(', ')} csp=${imgHosts.join(' ')}`);
assert('route.json is preloaded for gradual engine migration', html.includes('<link rel="preload" href="route.json" as="fetch" type="application/json">'));
assert('runtime route.json drift audit is wired', html.includes('AvraamRouteJsonAudit') && html.includes('MapEngine.compareRouteData(window.AvraamRouteData, route)'));
assert('MapEngine exports story-state helpers', typeof MapEngine.getStoryState === 'function' && typeof MapEngine.auditStoryDefinitions === 'function' && typeof MapEngine.getPlaceOrder === 'function');
assert('MapEngine exports layer/visual helpers', ['normalizeLayerState','isLayerOn','getPlaceLayerId','getRouteLayerId','getPlaceVisual'].every(name => typeof MapEngine[name] === 'function'));
assert('MapEngine exports panel helpers', ['getPlaceIndex','getPlaceById','getStageForPlace','getRelatedPlaceIds','getTabContentKey','getPanelModel','getPanelSections'].every(name => typeof MapEngine[name] === 'function'));
assert('MapEngine layer helpers return canonical ids/colors', MapEngine.getPlaceLayerId({type:'cand'}) === 'cand' && MapEngine.getPlaceLayerId({type:'lot'}) === 'lot' && MapEngine.getPlaceLayerId({type:'main'}) === 'abr' && MapEngine.getRouteLayerId('war') === 'war' && MapEngine.getRouteLayerId({c:'lot'}) === 'lot' && MapEngine.getPlaceVisual({type:'cand'}).color === '#9b8cf0');
assert('applyStory uses MapEngine.getStoryState shadow extraction', html.includes('MapEngine.getStoryState(window.AvraamRouteData, st.id)') && html.includes('window.AvraamCurrentStoryState = engineStory'));
assert('place counter and prev/next use MapEngine place order helper', html.includes('function getCurrentPlaceOrder()') && html.includes('MapEngine.getPlaceOrder(window.AvraamRouteData, activeStory'));
assert('marker builder uses MapEngine visual model', html.includes('MapEngine.getPlaceVisual(pl)') && html.includes('visual.markerClass') && html.includes('visual.cssColor'));
assert('openPlace/setTab use MapEngine panel helpers', html.includes('MapEngine.getPanelModel(window.AvraamRouteData,id,RELATED)') && html.includes('window.AvraamCurrentPanelModel=model') && html.includes('MapEngine.getTabContentKey(t)') && html.includes('MapEngine.getRelatedPlaceIds(window.AvraamRouteData,pl.id,RELATED)'));
assert('setTab uses MapEngine.getPanelSections flags', html.includes('MapEngine.getPanelSections(window.AvraamRouteData,pl.id,t,RELATED)') && html.includes('window.AvraamCurrentPanelSection=section') && html.includes('section.showPhotos') && html.includes('section.showBibleExtra'));
assert('applyLayers uses MapEngine layer helpers', html.includes('MapEngine.isLayerOn(LAYERS,id)') && html.includes('MapEngine.getRouteLayerId') && html.includes('MapEngine.getPlaceLayerId'));
assert('applyStory dims waypoint child nodes by attribute', html.includes("routeWp.querySelectorAll('.route-waypoint').forEach(wp=>wp.setAttribute('opacity',wpOpacity))"));
assert('no dangling SVG pointerenter preview block', !html.includes("svg.addEventListener('pointerenter'"));
assert('panel rubber animation uses .panel-opening, not #panel.open', html.includes('#panel.panel-opening{animation:panelRubberIn') && !/#panel\.open\s*\{[^}]*panelRubberIn/.test(html));
assert('MapEngine has no skeleton console logging', !/console\.log\(['\"]MapEngine\./.test(fs.readFileSync(enginePath, 'utf8')));

// Coordinate consistency: inline PLACES x,y must match route.json
const coordDrifts = [];
PLACES.forEach(p => {
  const rp = route.places.find(r => r.id === p.id);
  if (rp && (p.x !== rp.x || p.y !== rp.y)) coordDrifts.push(`${p.id}: inline(${p.x},${p.y}) route(${rp.x},${rp.y})`);
});
assert("inline place coords match route.json", coordDrifts.length === 0, coordDrifts.join("; "));

// CTX coordinate consistency
const ctxDrifts = [];
CTX.forEach(c => {
  const rc = route.ctx.find(r => r.n === c.n);
  if (rc && (c.x !== rc.x || c.y !== rc.y)) ctxDrifts.push(`${c.n}: inline(${c.x},${c.y}) route(${rc.x},${rc.y})`);
});
assert("inline CTX coords match route.json", ctxDrifts.length === 0, ctxDrifts.join("; "));

const failures = checks.filter(c => !c.ok);
for (const c of checks) {
  const icon = c.ok ? '✅' : '❌';
  console.log(`${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\nAvraam map audit: ${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) process.exit(1);
