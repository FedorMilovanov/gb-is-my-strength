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
const staticContractPath = path.join(ROOT, 'data/karty/avraam-static-content-contract.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const appJsPath = path.join(ROOT, 'karty/avraam/avraam-app.js');
const appJs = fs.existsSync(appJsPath) ? fs.readFileSync(appJsPath, 'utf8') : '';
const allCode = html + '\n' + appJs;
const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
const research = fs.readFileSync(researchPath, 'utf8');
const astro = fs.readFileSync(astroPath, 'utf8');
const fallback = fs.readFileSync(fallbackPath, 'utf8');
const staticContract = JSON.parse(fs.readFileSync(staticContractPath, 'utf8'));
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

function sourceApparatusBody(source, contract) {
  const heading = `<h3>${contract.sectionHeading}</h3>`;
  const headingAt = source.indexOf(heading);
  if (headingAt < 0) return null;
  const listAt = source.indexOf('<ul>', headingAt + heading.length);
  if (listAt < 0) return null;
  const listEnd = source.indexOf('</ul>', listAt + 4);
  if (listEnd < 0) return null;
  return source.slice(listAt + 4, listEnd);
}

function validateStaticContentContract(source, contract) {
  const issues = [];
  if (contract.route !== '/karty/avraam/') issues.push(`contract route mismatch: ${contract.route}`);
  if (contract.owner !== 'src/components/karty/avraam/AvraamMap.astro') issues.push(`contract owner mismatch: ${contract.owner}`);
  if (!Array.isArray(contract.sourceUnits) || contract.sourceUnits.length !== 14) {
    issues.push(`expected 14 source units, got ${Array.isArray(contract.sourceUnits) ? contract.sourceUnits.length : 'non-array'}`);
    return issues;
  }

  const ids = contract.sourceUnits.map(unit => unit.id);
  if (new Set(ids).size !== ids.length) issues.push('source unit IDs are not unique');
  if (contract.sourceUnits.some(unit => !unit.id || !unit.anchor)) issues.push('source unit missing id/anchor');

  const body = sourceApparatusBody(source, contract);
  if (body === null) {
    issues.push('source apparatus section/list not found');
    return issues;
  }

  const listItems = body.match(/<li\b/g) || [];
  if (listItems.length !== contract.sourceUnits.length) {
    issues.push(`source apparatus list items=${listItems.length}, manifest=${contract.sourceUnits.length}`);
  }

  for (const unit of contract.sourceUnits) {
    const count = body.split(unit.anchor).length - 1;
    if (count !== 1) issues.push(`${unit.id}: anchor occurrence=${count}`);
  }

  if (!source.includes(contract.shechem.nativeFallbackAnchor)) {
    issues.push('native fallback lost Shechem archaeology anchor');
  }
  return issues;
}

function hasCanonicalShechemDispute(routeData, contract) {
  const shechem = routeData.places?.find(place => place.id === contract.shechem.placeId);
  return Boolean(shechem?.dispute?.includes(contract.shechem.disputeTitle));
}

const HAMMAM_ROUTE_RETRACTION_MARKERS = [
  'официально ретрагирована Scientific Reports 24.04.2025',
  'отозвана Scientific Reports 24.04.2025',
];
const HAMMAM_NATIVE_RETRACTION_MARKER = 'официально отозвана журналом Scientific Reports 24.04.2025';
const HAMMAM_OLD_POSITIVE_PHRASE = 'со следами мощного разрушительного события';
const HAMMAM_VARIANT_STALE_NOTE = 'Гипотеза строится на видимости долины с Бет-Эля и разрушении города.';
const HAMMAM_VARIANT_RETRACTION_MARKER = 'отозвана 24.04.2025';
const HAMMAM_VARIANT_NO_POSITIVE_EVIDENCE = 'не являются установленным положительным доказательством';

function hasCanonicalHammamRetraction(routeData) {
  const hammam = routeData.places?.find(place => place.id === 'hammam');
  if (!hammam) return false;
  const arch = String(hammam.arch || '');
  const dispute = String(hammam.dispute || '');
  return HAMMAM_ROUTE_RETRACTION_MARKERS.some(marker => arch.includes(marker))
    && HAMMAM_ROUTE_RETRACTION_MARKERS.some(marker => dispute.includes(marker));
}

function hammamVariantRow(container) {
  return container?.hammam?.find(row => row?.title === 'Талл эль-Хаммам как северный Содом') || null;
}

function hasHammamVariantRetraction(container) {
  const row = hammamVariantRow(container);
  if (!row) return false;
  const text = `${String(row.note || '')} ${String(row.sources || '')}`;
  return text.includes(HAMMAM_VARIANT_RETRACTION_MARKER)
    && text.includes(HAMMAM_VARIANT_NO_POSITIVE_EVIDENCE)
    && !text.includes(HAMMAM_VARIANT_STALE_NOTE);
}

function sodomStaticStage(source) {
  const start = source.indexOf('<h3>Этап VI. Катастрофа Содома (Бытие 18–19)</h3>');
  if (start < 0) return '';
  const end = source.indexOf('<h3>Этап VII.', start);
  return source.slice(start, end < 0 ? source.length : end);
}

function hasNativeHammamRetraction(source) {
  const stage = sodomStaticStage(source);
  return stage.includes('Талл эль-Хаммам')
    && stage.includes(HAMMAM_NATIVE_RETRACTION_MARKER)
    && stage.includes('нельзя использовать как установленное положительное доказательство')
    && !stage.includes(HAMMAM_OLD_POSITIVE_PHRASE);
}

function runPositiveContractMutations() {
  const baselineIssues = validateStaticContentContract(astro, staticContract);
  assert('native Avraam positive source apparatus manifest', baselineIssues.length === 0, baselineIssues.join('; '));

  const firstAnchor = staticContract.sourceUnits[0].anchor;
  const missingSourceMutation = astro.replace(firstAnchor, '<b>Текст (mutation):</b>');
  assert(
    'mutation: removing one required source unit is rejected',
    validateStaticContentContract(missingSourceMutation, staticContract).length > 0
  );

  const duplicateAnchor = staticContract.sourceUnits[1].anchor;
  const duplicateSourceMutation = astro.replace(duplicateAnchor, duplicateAnchor + duplicateAnchor);
  assert(
    'mutation: duplicating one source unit identity is rejected',
    validateStaticContentContract(duplicateSourceMutation, staticContract).length > 0
  );

  assert('route Shechem dispute title fixed', hasCanonicalShechemDispute(route, staticContract));
  const mutatedRoute = JSON.parse(JSON.stringify(route));
  const shechem = mutatedRoute.places?.find(place => place.id === staticContract.shechem.placeId);
  if (shechem?.dispute) shechem.dispute = shechem.dispute.replace(staticContract.shechem.disputeTitle, '⚖ Сихем: mutation');
  assert('mutation: corrupted Shechem dispute title is rejected', !hasCanonicalShechemDispute(mutatedRoute, staticContract));

  assert('route Tall el-Hammam keeps 2025 retraction boundary', hasCanonicalHammamRetraction(route));
  const mutatedHammamRoute = JSON.parse(JSON.stringify(route));
  const hammam = mutatedHammamRoute.places?.find(place => place.id === 'hammam');
  if (hammam) {
    hammam.arch = String(hammam.arch || '').replace(/(?:официально ретрагирована|отозвана) Scientific Reports 24\.04\.2025/g, 'airburst claim retained');
    hammam.dispute = String(hammam.dispute || '').replace(/(?:официально ретрагирована|отозвана) Scientific Reports 24\.04\.2025/g, 'airburst claim retained');
  }
  assert('mutation: removing Tall el-Hammam route retraction is rejected', !hasCanonicalHammamRetraction(mutatedHammamRoute));

  assert('route Tall el-Hammam scientific candidate exposes retraction boundary', hasHammamVariantRetraction(route.scientific_variants));
  const mutatedHammamVariants = JSON.parse(JSON.stringify(route.scientific_variants));
  const mutatedHammamVariant = hammamVariantRow(mutatedHammamVariants);
  if (mutatedHammamVariant) {
    mutatedHammamVariant.note = HAMMAM_VARIANT_STALE_NOTE;
    mutatedHammamVariant.sources = String(mutatedHammamVariant.sources || '').replace(HAMMAM_VARIANT_RETRACTION_MARKER, 'airburst claim retained');
  }
  assert('mutation: stale route Tall el-Hammam scientific candidate is rejected', !hasHammamVariantRetraction(mutatedHammamVariants));

  assert('native Tall el-Hammam fallback exposes 2025 retraction boundary', hasNativeHammamRetraction(astro));
  const mutatedHammamAstro = astro
    .replace(HAMMAM_NATIVE_RETRACTION_MARKER, 'статья 2021 года остаётся положительным доказательством')
    .replace('нельзя использовать как установленное положительное доказательство', 'можно использовать как установленное положительное доказательство');
  assert('mutation: weakening native Tall el-Hammam retraction boundary is rejected', !hasNativeHammamRetraction(mutatedHammamAstro));
}

runPositiveContractMutations();

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
  assert('inline Tall el-Hammam scientific candidate exposes retraction boundary', hasHammamVariantRetraction(SCIENCE_VARIANTS));
  const mutatedInlineVariants = JSON.parse(JSON.stringify(SCIENCE_VARIANTS));
  const mutatedInlineHammam = hammamVariantRow(mutatedInlineVariants);
  if (mutatedInlineHammam) {
    mutatedInlineHammam.note = HAMMAM_VARIANT_STALE_NOTE;
    mutatedInlineHammam.sources = String(mutatedInlineHammam.sources || '').replace(HAMMAM_VARIANT_RETRACTION_MARKER, 'airburst claim retained');
  }
  assert('mutation: stale inline Tall el-Hammam scientific candidate is rejected', !hasHammamVariantRetraction(mutatedInlineVariants));
}

assert('HTML exposes routeWaypoints layer', allCode.includes('id="routeWaypoints"') && allCode.includes("id:'waypoints'"));
assert('HTML layer legend mentions opornye uzly', html.includes('Опорные узлы') && html.includes('Опорные узлы маршрута Ур→Харран'));
assert('HTML renders scientific variants block', allCode.includes('НАУЧНЫЕ ВАРИАНТЫ И ОГОВОРКИ') && allCode.includes('renderVariants(pl)'));
const captionSpring = html.match(/@keyframes captionSpring\{([\s\S]*?)\n  \}/)?.[1] || '';
assert('captionSpring has no stray translateX', !captionSpring.includes('translateX(-50%)'));
assert('GSAP setup is inside script boundary', allCode.includes('GSAP SETUP'));
assert('startTour hides hint', /function startTour\(\)\{\s*if\(typeof killHint===/.test(allCode));
assert('CSP allows LOC tile and Ritmeyer', html.includes('https://tile.loc.gov') && html.includes('https://www.ritmeyer.com'));
assert('no old LOC cdn image URL', !html.includes('https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg') && !JSON.stringify(route).includes('https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg'));
assert('no brittle Wikimedia upload URLs in map data', !/(src|thumb)":"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons/.test(JSON.stringify(route)) && !/(src|thumb):"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons/.test(html));
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

// ── MapEngine lifecycle checks ──
const engineSrc = fs.readFileSync(enginePath, 'utf8');
assert('MapEngine Hebrew repair preserves canonical version contract', MapEngine.version === '0.58.0', MapEngine.version);
assert(
  'MapEngine Hebrew tokens use a Hebrew-capable isolated RTL font stack',
  engineSrc.includes('.me-content .hw{color:#e8c879;font-size:20px;font-family:"Noto Sans Hebrew","Arial Hebrew",Arial,sans-serif;direction:rtl;unicode-bidi:isolate}')
);
assert(
  'MapEngine normalizes rendered Hebrew token language and direction',
  engineSrc.includes("content.querySelectorAll('.hw').forEach(token=>{")
    && engineSrc.includes("if(!token.hasAttribute('lang'))token.setAttribute('lang','he');")
    && engineSrc.includes("token.setAttribute('dir','rtl');")
);
assert(
  'MapEngine Hebrew title boundaries declare lang and dir',
  engineSrc.includes("he.setAttribute('lang','he');he.setAttribute('dir','rtl');")
    && engineSrc.includes('class="me-panel__he" lang="he" dir="rtl"')
    && engineSrc.includes('class="me-intro__he" lang="he" dir="rtl"')
);
assert(
  'MapEngine keeps Russian Hebrew-tab explanations LTR',
  engineSrc.includes('.me-content .he-tr{')
    && engineSrc.includes('.me-content .he-etym{')
    && !/\.me-content \.(?:he-tr|he-etym)\{[^}]*direction:rtl/.test(engineSrc)
);
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
