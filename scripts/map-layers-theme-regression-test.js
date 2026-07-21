#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const MapEngine = require('../karty/_engine/map-engine.js');

const root = path.join(__dirname, '..');
const readRoute = (slug) => JSON.parse(fs.readFileSync(path.join(root, 'karty', slug, 'route.json'), 'utf8'));

assert.strictEqual(MapEngine.version, '0.54.0', 'layers/theme contract belongs to map-engine v0.54.0');

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
assert(source.includes("path.setAttribute('data-layer',stageMembership.tokens.join(' '))"));
assert(!source.includes('layer.selector || `[data-layer="${layer.id}"]`'), 'exact-equality layer selector must not return');

console.log('✅ map layer membership/theme palette regression guard passed');
