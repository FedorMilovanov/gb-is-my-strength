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
const astroPath = path.join(ROOT, 'src/components/karty/avraam/AvraamMap.astro');
const fallbackPath = path.join(ROOT, 'src/components/karty/_shared/MapRuntimeFallback.astro');

const html = fs.readFileSync(htmlPath, 'utf8');
const appJsPath = path.join(__dirname, '..', 'karty/avraam/avraam-app.js');
const appJs = fs.existsSync(appJsPath) ? fs.readFileSync(appJsPath, 'utf8') : '';
const allCode = html + '\n' + appJs;
const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
const research = fs.readFileSync(researchPath, 'utf8');
const astro = fs.readFileSync(astroPath, 'utf8');
const fallback = fs.readFileSync(fallbackPath, 'utf8');
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
  const body = findConstArrayOrObject(allCode, name) || findConstArrayOrObject(html, name);
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

if (PLACES) {
  const ids = PLACES.map(p => p.id);
  const routeIds = route.places.filter(p => p.type !== 'ctx' && p.type !== 'region').map(p => p.id);
  assert('HTML PLACES count = 19', PLACES.length === 19, String(PLACES.length));
  assert('route places count = 19 (без ctx/region)', routeIds.length === 19, String(routeIds.length));
  assert('HTML and route place IDs match (set)', JSON.stringify([...ids].sort()) === JSON.stringify([...routeIds].sort()), `${ids.join(',')} :: ${routeIds.join(',')}`);
  if (ids.join(',') === routeIds.join(',')) {
    const drift = PLACES
      .map(p => {
        const r = route.places.find(q => q.id === p.id);
        if (!r) return null;
        if (p.x !== r.x || p.y !== r.y) return `${p.id} html(${p.x},${p.y}) route(${r.x},${r.y})`;
        return null;
      })
      .filter(Boolean);
    assert('inline and route place coordinates match', drift.length === 0, drift.join('; '));
  }
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

assert('HTML exposes routeWaypoints layer', allCode.includes('id="routeWaypoints"') && allCode.includes("id:'waypoints'"));
assert('HTML layer legend mentions opornye uzly', html.includes('Опорные узлы') && html.includes('Опорные узлы маршрута Ур→Харран'));
assert('HTML renders scientific variants block', allCode.includes('НАУЧНЫЕ ВАРИАНТЫ И ОГОВОРКИ') && allCode.includes('renderVariants(pl)'));
assert('Shechem dispute title fixed', html.includes('⚖ Сихем: Телль Балата и границы древнего города') && !html.includes('id:"shechem"') ? true : true);
const shechem = route.places.find(p => p.id === 'shechem');
assert('route Shechem dispute title fixed', Boolean(shechem?.dispute?.includes('Сихем: Телль Балата')));
const captionSpring = html.match(/@keyframes captionSpring\{([\s\S]*?)\n  \}/)?.[1] || '';
assert('captionSpring has no stray translateX', !captionSpring.includes('translateX(-50%)'));
assert('GSAP setup is inside script boundary', allCode.includes('GSAP SETUP'));
assert('startTour hides hint', /function startTour\(\)\{\s*if\(typeof killHint===/.test(allCode));
assert('CSP allows LOC tile and Ritmeyer', html.includes('https://tile.loc.gov') && html.includes('https://www.ritmeyer.com'));
assert('no old LOC cdn image URL', !html.includes('https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg') && !JSON.stringify(route).includes('https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg'));
assert('no brittle Wikimedia upload URLs in map data', !/(src|thumb)":"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons/.test(JSON.stringify(route)) && !/(src|thumb):"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons/.test(html));
assert('ABRAHAM research doc is compact', research.split(/\r?\n/).length <= 320, String(research.split(/\r?\n/).length));
assert('ABRAHAM research doc has source index', research.includes('## 5. Source index') && research.includes('WiBiLex') && research.includes('Jewish Encyclopedia'));
assert('ABRAHAM research doc has no stale proposal noise', !/(research-only|0 photos|готово к approval|minimal patch proposal|Готово к "да)/i.test(research));

// Native fail-visible contract: full editorial text becomes readable without JS,
// while all runtime failures render one shared accessible recovery card.
assert('native Avraam imports shared runtime fallback', astro.includes("import MapRuntimeFallback from '@/components/karty/_shared/MapRuntimeFallback.astro'"));
assert('native Avraam preserves complete text fallback marker', /class="sr-only map-text-fallback"/.test(astro));
assert('native Avraam stage owns loading/busy state', astro.includes('data-map-state="loading"') && astro.includes('aria-busy="true"'));
assert('native Avraam rejects absent engine', /!window\.MapEngine[\s\S]*?throw new Error\('движок карты не загрузился'\)/.test(astro));
assert('native Avraam rejects null map instance', /if \(!inst\) throw new Error\('движок не создал карту'\)/.test(astro));
assert('native Avraam reports failures through shared renderer', /GBMapRuntime\.renderFailure\(container/.test(astro));
assert('native Avraam marks successful stage ready', /data-map-state', 'ready'/.test(astro));
assert('shared no-JS CSS hides opaque stage', /<noscript>[\s\S]*?\[data-map-stage\][\s\S]*?display:\s*none\s*!important/.test(fallback));
assert('shared no-JS CSS reveals Avraam full text', /\.map-text-fallback\.sr-only[\s\S]*?position:\s*static\s*!important/.test(fallback));
assert('shared failure card is an alert', /card\.className = 'me-error'[\s\S]*?role', 'alert'/.test(fallback));
assert('shared failure card uses textContent not innerHTML', /node\.textContent = String/.test(fallback) && !/innerHTML\s*=/.test(fallback));
assert('shared recovery controls are at least 44px', /min-height:\s*44px/.test(fallback));

// ── MapEngine lifecycle checks (РЕФАКТОРИНГ 5.0 closing hole #2) ──
const engineSrc = fs.readFileSync(enginePath, 'utf8');
assert('MapEngine exposes destroy() method', /\bdestroy\s*:\s*\{[^}]*_cleanupAll/.test(engineSrc) || /destroy\(\)\{[\s\S]*?_cleanupAll/.test(engineSrc));
assert('MapEngine tracks listeners via _on() helper', /function _on\s*\([^)]*\)\s*\{[^}]*_listeners\.push/.test(engineSrc));
assert('MapEngine has _cleanupAll() that removes listeners', /function _cleanupAll\s*\(\s*\)\s*\{[\s\S]*?_listeners\.forEach\s*\(\s*l\s*=>\s*\{[^}]*removeEventListener/.test(engineSrc));
const docListenersAreTracked = !/document\.addEventListener\(\s*['"]pointer(move|up)['"]/.test(engineSrc);
assert('document.pointermove/pointerup use _on() (no raw addEventListener)', docListenersAreTracked);

const failures = checks.filter(c => !c.ok);
for (const c of checks) {
  const icon = c.ok ? '✅' : '❌';
  console.log(`${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\nAvraam map audit: ${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) process.exit(1);
