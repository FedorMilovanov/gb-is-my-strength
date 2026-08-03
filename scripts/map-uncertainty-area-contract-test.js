#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validateArea, validateRouteObject } = require('./map-uncertainty-area-contract.js');

function fixture() {
  return {
    id: 'contested-site',
    label: 'Спорная локализация',
    feature_type: 'uncertainty-area',
    status: 'UNRESOLVED',
    single_authoritative_point: false,
    reader_label: 'Точное место не установлено; показаны исследовательские коридоры.',
    corridors: [
      {
        id: 'north',
        label: 'Северный коридор',
        status: 'ALTERNATIVE',
        confidence: 'LOW',
        geometry: { type: 'polygon', points: [[10, 10], [30, 10], [20, 30]] },
        source_ids: ['SRC-1']
      },
      {
        id: 'south',
        label: 'Южный коридор',
        status: 'CANDIDATE',
        confidence: 'MODERATE_LOW',
        geometry: { type: 'polygon', points: [[40, 40], [70, 40], [55, 65]] },
        source_ids: ['SRC-2']
      }
    ],
    palaeowater: {
      dataset_date: '2026-08-02',
      reconstruction_label: 'Реконструкция древней гидрографии',
      source_ids: ['SRC-3'],
      modern_boundary_distinct: true
    },
    credits: {
      label: 'Research projection',
      source_url: 'https://example.test/research',
      rights: 'Attribution required'
    }
  };
}

function expectFailure(name, mutate, pattern) {
  const value = structuredClone(fixture());
  mutate(value);
  assert.throws(() => validateArea(value, name), pattern, name);
}

validateArea(fixture(), 'valid');

expectFailure('single point', (value) => {
  value.single_authoritative_point = true;
}, /must be false/);

expectFailure('coordinate smuggling', (value) => {
  value.x = 360;
  value.y = 970;
}, /cannot own a single point/);

expectFailure('one corridor', (value) => {
  value.corridors = value.corridors.slice(0, 1);
}, /at least two/);

expectFailure('bad geometry', (value) => {
  value.corridors[0].geometry.points = [[10, 10], [10, 10], [10, 10]];
}, /distinct vertices/);

expectFailure('collinear geometry', (value) => {
  value.corridors[0].geometry.points = [[10, 10], [20, 20], [30, 30]];
}, /area must be non-zero/);

expectFailure('no candidate corridor', (value) => {
  value.corridors.forEach((corridor) => { corridor.status = 'ALTERNATIVE'; });
}, /at least one corridor must be CANDIDATE/);

expectFailure('undated palaeowater', (value) => {
  value.palaeowater.dataset_date = 'current';
}, /YYYY-MM-DD/);

expectFailure('modern boundary ambiguity', (value) => {
  value.palaeowater.modern_boundary_distinct = false;
}, /must be true/);

expectFailure('credits transport', (value) => {
  value.credits.source_url = 'http://example.test/research';
}, /HTTPS/);

assert.equal(validateRouteObject({ places: [], uncertainty_areas: [fixture()] }, 'route'), 1);
assert.throws(
  () => validateRouteObject({ places: [{ id: 'fake', type: 'uncertainty-area' }] }, 'route'),
  /must live in uncertainty_areas/
);
assert.throws(
  () => validateRouteObject({ places: [{ id: 'contested-site', type: 'main' }], uncertainty_areas: [fixture()] }, 'route'),
  /must not also exist in places/
);

console.log('PASS map uncertainty-area mutation contract');
