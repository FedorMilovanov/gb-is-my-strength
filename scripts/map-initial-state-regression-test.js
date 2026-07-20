#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const MapEngine = require('../karty/_engine/map-engine.js');

const route = {
  meta: { id: 'fixture', viewport_init: { cx: 500, cy: 400, w: 1200 } },
  places: [
    { id: 'a', x: 100, y: 120, stage: 0 },
    { id: 'b', x: 700, y: 620, stage: 1 },
    { id: 'c', x: 900, y: 300, stage: 1 },
  ],
  stages: [{}, {}],
  stories: [
    { id: 'main', label: 'Main', active_by_default: true, places: ['a', 'b', 'c'] },
    { id: 'sinai', label: 'Sinai', places: ['b', 'c'], viewport: [800, 460, 700] },
  ],
};

function locationFixture({ search = '', hash = '' } = {}) {
  return {
    origin: 'https://gospod-bog.ru',
    pathname: '/karty/test/',
    search,
    hash,
  };
}

const query = MapEngine.parseMapStateFromLocation(route, locationFixture({
  search: '?story=sinai&place=b&utm_source=test',
  hash: '#story=main&place=a',
}));
assert.deepStrictEqual(
  { story: query.story, place: query.place, source: query.source, hasExplicit: query.hasExplicit },
  { story: 'sinai', place: 'b', source: 'query', hasExplicit: true },
  'query parameters must win over legacy hash values'
);

const legacyHash = MapEngine.parseMapStateFromLocation(route, locationFixture({
  hash: '#story=sinai&place=c',
}));
assert.deepStrictEqual(
  { story: legacyHash.story, place: legacyHash.place, source: legacyHash.source },
  { story: 'sinai', place: 'c', source: 'hash' },
  'legacy hash deep links must remain readable'
);

const inferredStory = MapEngine.parseMapStateFromLocation(route, locationFixture({ search: '?place=b' }));
assert.strictEqual(inferredStory.story, 'sinai', 'a place outside the default story must select a containing story');
assert.strictEqual(inferredStory.place, 'b');

const explicitWins = MapEngine.resolveInitialMapState(
  route,
  locationFixture({ search: '?story=sinai&place=c' }),
  { story: 'main', place: 'a' }
);
assert.strictEqual(explicitWins.source, 'query');
assert.strictEqual(explicitWins.story, 'sinai');
assert.strictEqual(explicitWins.place, 'c');

const savedWins = MapEngine.resolveInitialMapState(
  route,
  locationFixture(),
  { story: 'sinai', place: 'b' }
);
assert.strictEqual(savedWins.source, 'saved');
assert.strictEqual(savedWins.story, 'sinai');
assert.strictEqual(savedWins.place, 'b');

const defaultState = MapEngine.resolveInitialMapState(route, locationFixture(), null);
assert.strictEqual(defaultState.source, 'default');
assert.strictEqual(defaultState.story, 'main');
assert.deepStrictEqual(defaultState.viewport, [500, 400, 1200], 'viewport_init must be the default camera');

const built = MapEngine.buildMapStateUrl(
  locationFixture({ search: '?utm_source=test&story=main', hash: '#story=main&place=a' }),
  { story: 'sinai', place: 'c' }
);
assert.strictEqual(
  built,
  'https://gospod-bog.ru/karty/test/?utm_source=test&story=sinai&place=c',
  'share/runtime URL must use query parameters, preserve unrelated query data and remove legacy map hash'
);

const source = fs.readFileSync(path.join(__dirname, '../karty/_engine/map-engine.js'), 'utf8');
assert(source.includes('const initialState = resolveInitialMapState(route, location, savedInitialState);'));
assert(source.includes('let activeStoryId = initialState.story;'));
assert(!source.includes('function loadFromHash()'), 'split hash-only initialization must be removed');
assert(!source.includes('setTimeout(loadSavedState, 1000)'), 'saved state must not race explicit URL state');
assert(!/const first=\(route\.places\|\|\[\]\)\[0\];[\s\S]{0,120}flyTo\(first\.x/.test(source), 'first-place flyTo must not override viewport_init');
assert(source.includes('const url=buildMapStateUrl(location,st);'), 'Share must use the same URL builder as runtime state sync');

console.log('✅ map initial-state/deep-link regression guard passed');
