'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MapEngine = require('../karty/_engine/map-engine.js');

const ROOT = path.resolve(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'karty/_shared/route.schema.json'), 'utf8'));
const schemaCapabilities = schema.properties?.capabilities?.items?.enum || [];
const schemaArchetypes = schema.properties?.archetype?.enum || [];
const routeSlugs = ['avraam','early-church','ishod','maccabim','melachim','nachalo','pavel','revelation','shoftim','shvatim','yeshua'];
const validatorSource = fs.readFileSync(path.join(ROOT, 'scripts/validate-map-routes.js'), 'utf8');

assert.equal(MapEngine.version, '0.60.0', 'capability runtime belongs to MapEngine v0.60.0');
assert.deepEqual(MapEngine.ROUTE_CAPABILITY_VALUES, schemaCapabilities, 'engine capability vocabulary must equal route schema');
assert.deepEqual(MapEngine.ROUTE_ARCHETYPE_VALUES, schemaArchetypes, 'engine archetype vocabulary must equal route schema');

for (const slug of routeSlugs) {
  const file = path.join(ROOT, 'karty', slug, 'route.json');
  const route = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(MapEngine.normalizeRouteArchetype(route), route.archetype, `${slug}: archetype must be runtime-recognized`);
  assert.deepEqual(MapEngine.normalizeRouteCapabilities(route), route.capabilities, `${slug}: capabilities must be canonical and runtime-recognized`);

  const projected = MapEngine.projectRouteCapabilities(route);
  const caps = new Set(route.capabilities);
  assert.deepEqual(projected.capabilities, route.capabilities, `${slug}: projected capabilities drift`);

  if (caps.has('stages')) assert(projected.stages.length > 0, `${slug}: stages capability has no stage data`);
  else assert.equal(projected.stages.length, 0, `${slug}: undeclared stages leaked into runtime`);

  if (caps.has('stories')) assert(projected.stories.length > 0, `${slug}: stories capability has no story data`);
  else assert.equal(projected.stories.length, 0, `${slug}: undeclared stories leaked into runtime`);

  if (caps.has('layers')) assert((projected.layers || []).length > 0, `${slug}: layers capability has no layer data`);
  else assert.equal((projected.layers || []).length, 0, `${slug}: undeclared layers leaked into runtime`);

  if (caps.has('timeline')) assert((projected.timeline || []).length > 0, `${slug}: timeline capability has no timeline data`);
  else assert.equal((projected.timeline || []).length, 0, `${slug}: undeclared timeline leaked into runtime`);

  if (caps.has('signature')) assert(projected.signature && projected.signature.type, `${slug}: signature capability has no signature data`);
  else assert.equal(projected.signature, undefined, `${slug}: undeclared signature leaked into runtime`);

  if (!caps.has('interpretations')) {
    assert.equal(projected.scientific_variants, undefined, `${slug}: undeclared scientific variants leaked`);
    assert.equal(projected.variants, undefined, `${slug}: undeclared variant alias leaked`);
    for (const place of projected.places) {
      assert.equal(place?.arch, undefined, `${slug}: undeclared archaeology body leaked for ${place?.id}`);
      assert.equal(place?.dispute, undefined, `${slug}: undeclared dispute body leaked for ${place?.id}`);
    }
  }
}

const rich = {
  archetype: 'thematic',
  capabilities: ['stages'],
  meta: { id: 'capability-fixture' },
  stages: [{ n: 'I' }],
  stories: [{ id: 'main', label: 'Main' }],
  layers: [{ id: 'x', label: 'X' }],
  timeline: [{ era: '1', label: 'One', stage: 0 }],
  signature: { type: 'lampstands', label: 'Signature' },
  scientific_variants: { p1: [{ title: 'Variant' }] },
  places: [{ id: 'p1', x: 1, y: 2, stage: 0, story: 'Story', arch: 'Arch', dispute: 'Dispute' }],
};
const staged = MapEngine.projectRouteCapabilities(rich);
assert.equal(staged.stages.length, 1, 'declared stages must survive projection');
assert.equal(staged.places[0].stage, 0, 'declared place stage must survive projection');
assert.equal(staged.stories.length, 0, 'undeclared stories must fail closed');
assert.equal((staged.layers || []).length, 0, 'undeclared layers must fail closed');
assert.equal((staged.timeline || []).length, 0, 'undeclared timeline must fail closed');
assert.equal(staged.signature, undefined, 'undeclared signature must fail closed');
assert.equal(staged.places[0].arch, undefined, 'undeclared interpretations must fail closed');
assert.equal(staged.places[0].dispute, undefined, 'undeclared disputes must fail closed');
assert.equal(staged.scientific_variants, undefined, 'undeclared scientific variants must fail closed');
assert.equal(rich.stories.length, 1, 'projection must not mutate source stories');
assert.equal(rich.places[0].arch, 'Arch', 'projection must not mutate source place content');

const interpretationsOnly = MapEngine.projectRouteCapabilities({...rich, capabilities: ['interpretations']});
assert.equal(interpretationsOnly.stages.length, 0, 'undeclared stages must be removed');
assert.equal(interpretationsOnly.places[0].stage, undefined, 'undeclared place stage must be removed');
assert.equal(interpretationsOnly.places[0].arch, 'Arch', 'declared interpretations must preserve archaeology');
assert.equal(interpretationsOnly.places[0].dispute, 'Dispute', 'declared interpretations must preserve dispute content');
assert(interpretationsOnly.scientific_variants, 'declared interpretations must preserve scientific variants');

assert.deepEqual(
  MapEngine.normalizeRouteCapabilities({ capabilities: ['uncertainty','bogus','stages','stages'] }),
  ['stages','uncertainty'],
  'capability normalization must be canonical, unique and closed to unknown values',
);
assert.equal(MapEngine.hasRouteCapability({ capabilities: ['uncertainty'] }, 'uncertainty'), true);
assert.equal(MapEngine.hasRouteCapability({ capabilities: ['uncertainty'] }, 'stories'), false);
assert.equal(MapEngine.normalizeRouteArchetype({ archetype: 'bogus' }), null);

const engineSource = fs.readFileSync(path.join(ROOT, 'karty/_engine/map-engine.js'), 'utf8');
assert.match(engineSource, /hasRouteCapability\(route,'interpretations'\)/, 'mount bootstrap must gate archaeology projection by interpretations capability');
assert.match(engineSource, /const route = projectRouteCapabilities\(routeData\)/, 'createMap must consume capability-projected route data');
assert.match(engineSource, /data-map-capabilities/, 'runtime must expose governed capability metadata');

const ishodSource = fs.readFileSync(path.join(ROOT, 'src/components/karty/ishod/IshodMap.astro'), 'utf8');
const capabilityGuard = ishodSource.indexOf("window.MapEngine.hasRouteCapability(route, 'uncertainty')");
const authorityValidation = ishodSource.indexOf('resources.authority = validateAuthority(resources.authority)');
assert(capabilityGuard >= 0 && authorityValidation > capabilityGuard, 'Ishod must gate authority adaptation by shared uncertainty capability');
assert.match(ishodSource, /if \(!window\.MapEngine\.hasRouteCapability\(context\.route, 'uncertainty'\)\) return;/, 'Ishod afterCreate must fail closed without uncertainty capability');

assert(!validatorSource.includes('BASE_LIVE_CAPABILITIES'), 'validator must not force a boilerplate live capability bundle');
for (const witness of [
  "['stages', Array.isArray(route.stages) && route.stages.length > 0]",
  "['stories', Array.isArray(route.stories) && route.stories.length > 0]",
  "['layers', Array.isArray(route.layers) && route.layers.length > 0]",
  "['timeline', Array.isArray(route.timeline) && route.timeline.length > 0]",
  "['signature', Boolean(route.signature && typeof route.signature === 'object')]",
  "['interpretations', Boolean(route.scientific_variants && typeof route.scientific_variants === 'object')]",
  "if (seen.has(capability) !== present)",
]) {
  assert(validatorSource.includes(witness), `validator capability/data equivalence marker missing: ${witness}`);
}

console.log('MAP CAPABILITIES CONTRACT: PASS — 11 governed routes + fail-closed runtime projection');
