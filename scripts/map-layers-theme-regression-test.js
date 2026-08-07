#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const MapEngine = require('../karty/_engine/map-engine.js');
const { auditGeometry } = require('./atlas-label-audit.js');

const root = path.join(__dirname, '..');
const readRoute = (slug) => JSON.parse(fs.readFileSync(path.join(root, 'karty', slug, 'route.json'), 'utf8'));

const routeSchema = JSON.parse(
  fs.readFileSync(path.join(root, 'karty/_shared/route.schema.json'), 'utf8')
);
const storyIdPatternSource = routeSchema.properties?.stories?.items?.properties?.id?.pattern;
assert.strictEqual(
  storyIdPatternSource,
  '^[a-z0-9_-]+$',
  'story id schema must allow the canonical internal underscore vocabulary'
);
const storyIdPattern = new RegExp(storyIdPatternSource);
const routeSlugs = fs.readdirSync(path.join(root, 'karty'), { withFileTypes: true })
  .filter((entry) =>
    entry.isDirectory() &&
    !entry.name.startsWith('_') &&
    fs.existsSync(path.join(root, 'karty', entry.name, 'route.json'))
  )
  .map((entry) => entry.name)
  .sort();
const allRoutes = routeSlugs.map((slug) => ({ slug, route: readRoute(slug) }));
for (const { slug, route } of allRoutes) {
  for (const story of route.stories || []) {
    assert(
      storyIdPattern.test(story.id || ''),
      `${slug}: invalid story id ${story.id}`
    );
  }
}

assert.strictEqual(MapEngine.version, '0.58.0', 'layers/theme/runtime contract belongs to map-engine v0.58.0');
assert.strictEqual(MapEngine.getStageColor(0), '#e8c879');
assert.strictEqual(MapEngine.getStageColor(6), 'hsl(320 48% 58%)', 'extended stages must receive a deterministic fallback color');
assert.strictEqual(MapEngine.getStageColor(-3), '#e8c879', 'invalid negative stages must normalize to the first stage');
assert.deepStrictEqual(
  MapEngine.clientPointToView({ left: 10, top: 20, width: 400, height: 200 }, { x: 100, y: 200, w: 100, h: 100 }, 210, 120),
  { x: 150, y: 250 },
  'client coordinates must account for centered SVG letterboxing'
);
assert.strictEqual(MapEngine.distanceKm({ x: 0, y: 0 }, { x: 3, y: 4 }, 2), 10);
assert(Math.abs(MapEngine.distanceKm({ x: 0, y: 0 }, { x: 3, y: 4 }, 0) - 4.6) < 1e-9, 'invalid km scale must use the governed default');

const avraam = readRoute('avraam');
const warStage = (avraam.stages || []).findIndex((stage) => stage && stage.cls === 'war');
const warPlace = (avraam.places || []).find((place) => place.stage === warStage);
assert(warPlace, 'avraam fixture must contain a war-stage place');
const warMembership = MapEngine.getPlaceLayerMembership(avraam, warPlace);
assert(warMembership.all.includes('main'));
assert(warMembership.all.includes('war'), 'stage.cls must become a restrictive layer membership');

const candidate = (avraam.places || []).find((place) => place.type === 'cand');
assert(candidate, 'avraam fixture must contain a candidate place');
const candidateMembership = MapEngine.getPlaceLayerMembership(avraam, candidate);
assert(candidateMembership.all.includes('cand'), 'place.type must become a restrictive layer membership');

const authoredSegments = (avraam.stages || []).flatMap((stage, stageIndex) =>
  (Array.isArray(stage?.paths) ? stage.paths : []).map((entry, pathIndex) => ({ stageIndex, pathIndex, entry }))
);
assert.strictEqual(authoredSegments.length, 15, 'Avraam fixture must retain 15 authored route segments');
assert(authoredSegments.every(({ entry }) => /^M/.test(String(entry.d || '')) && /\bC/.test(String(entry.d || ''))), 'Avraam authored routes must remain cubic SVG geometry');
assert.deepStrictEqual([...new Set(authoredSegments.map(({ entry }) => entry.c))].sort(), ['gold', 'lot', 'war']);

const pavel = readRoute('pavel');
const antioch = (pavel.places || []).find((place) => place.id === 'antioch');
assert(antioch, 'pavel fixture must contain Antioch');
const antiochMembership = MapEngine.getPlaceLayerMembership(pavel, antioch);
assert(antiochMembership.any.includes('journey1'));
assert(antiochMembership.any.includes('journey2'), 'shared places must keep all matching story memberships');
assert(!antiochMembership.all.includes('journey1'), 'story memberships must not be restrictive facets');

const firstJourneyPath = MapEngine.getStageLayerMembership(pavel, 0);
assert(firstJourneyPath.any.includes('journey1'));
assert(!firstJourneyPath.any.includes('journey2'), 'stage path membership must follow story.stage_ids');

const authoredWarMembership = MapEngine.getStageLayerMembership(avraam, warStage);
assert(authoredWarMembership.all.includes('main'));
assert(authoredWarMembership.all.includes(`stage-${warStage}`));
assert(authoredWarMembership.all.includes('war'), 'authored paths must use the same restrictive stage membership as generated paths');

const ishod = readRoute('ishod');
const ishodPlace = (ishod.places || [])[0];
assert(ishodPlace);
assert(MapEngine.getPlaceLayerMembership(ishod, ishodPlace).all.includes('main'));
assert.deepStrictEqual(MapEngine.normalizeLayerTokens('main  stage-0,main'), ['main', 'stage-0']);

const dark = MapEngine.getMapThemePalette('dark');
const light = MapEngine.getMapThemePalette('light');
assert.notStrictEqual(dark.bg, light.bg);
assert.notStrictEqual(dark.svgFilter, light.svgFilter);
assert.strictEqual(MapEngine.getMapThemePalette('unknown').id, 'dark');
assert(light.svgFilter && light.svgFilter !== 'none', 'light theme must materially transform the rendered SVG palette');

const source = fs.readFileSync(path.join(root, 'karty/_engine/map-engine.js'), 'utf8');
assert(source.includes("container.setAttribute('data-map-theme',palette.id)"));
assert(source.includes('container.style.backgroundColor=palette.bg;'));
assert(source.includes('applyLayerVisibility();'));
assert(source.includes("g.setAttribute('data-layer-all',membership.all.join(' '))"));
assert(source.includes("g.setAttribute('data-layer-any',membership.any.join(' '))"));
assert(source.includes('function applyRouteLayerMembership(element,membership)'));
assert(source.includes("element.setAttribute('data-layer',membership.tokens.join(' '))"));
assert(source.includes("element.setAttribute('data-layer-all',membership.all.join(' '))"));
assert(source.includes("element.setAttribute('data-layer-any',membership.any.join(' '))"));
assert(source.includes("common(under,'underlay','me-route-underlay')"));
assert(source.includes("common(path,'main','me-route-main')"));
assert(source.includes("element.setAttribute('data-route-source',sourceKind)"));
assert(source.includes("element.setAttribute('data-route-dash',spec.dash?'1':'0')"));
assert(source.includes('function ensureGeneratedArrowMarker(stageIndex,pathIndex,color)'), 'generated routes must own generated marker IDs');
assert(source.includes("const markerId=sourceKind==='authored'"), 'route marker IDs must preserve authored/generated source semantics');
assert(!source.includes('layer.selector || `[data-layer="${layer.id}"]`'), 'exact-equality layer selector must not return');
assert(source.includes('cfg.archaeologyProjection'), 'v0.58 must consume the governed archaeology projection directly');
assert(!source.includes('ARCHAEOLOGY_REFERENCES'), 'hardcoded archaeology corpus must not return to the generic engine');
assert(!source.includes('_classifySource'), 'keyword-based source classification must not return');
assert(!source.includes('_renderArchaeologyFooter'), 'legacy archaeology footer must not return');
assert(source.includes("zoomControls.querySelector('[data-measure]')"), 'one canonical measure control must own the interaction');
assert(source.includes("measureBtn?.setAttribute('aria-pressed',measuring?'true':'false')"), 'measure state must remain exposed to assistive technology');
assert(source.includes("dot.classList.add('me-marker-dot','me-marker-spring')"), 'marker behavior must use a semantic class instead of child order');
assert(source.includes("_on(panel,'click',e=>"), 'photo enlargement must have one cleanup-aware delegated owner');
assert(source.includes('baseCssLeaseCount=Math.max(0,baseCssLeaseCount-1)'), 'shared base CSS must use a bounded lifecycle lease');

const geometryFixture = {
  meta: { canvas: { w: 200, h: 120 } },
  places: [
    { id: 'same-a', name: 'А', x: 80, y: 60, side: 'r' },
    { id: 'same-b', name: 'Б', x: 80, y: 60, side: 'l' },
    { id: 'clipped', name: 'Длинная подпись', x: 2, y: 8, side: 'l' },
    { id: 'safe-edge', name: 'Край', x: 185, y: 100, side: 'l' },
  ],
};
const geometryReport = auditGeometry(geometryFixture, 'map-contract');
assert(
  geometryReport.markerPairs.some((pair) => pair.a === 'same-a' && pair.b === 'same-b' && pair.distance === 0),
  'geometry contract must detect exact marker overlap'
);
assert(geometryReport.clippedLabels.includes('clipped'), 'geometry contract must detect labels outside the canvas');
assert(geometryReport.safeAreaHits.includes('safe-edge'), 'geometry contract must detect edge safe-area intrusion');

console.log(`✅ map layer membership/theme/runtime/authored-route/projection/geometry/story-id regression guard passed (${allRoutes.length} routes)`);
