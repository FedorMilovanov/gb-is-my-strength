#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { hasFailClosedMapInit, inspectMapInitSource } = require('./lib/map-init-source-contract');

const ROOT = path.resolve(__dirname, '..');

function fixture({ variable = 'inst', guard = true, engineGuard = true, engineGuardAfterCreateMap = false, guardAfterReady = false } = {}) {
  const engine = engineGuard
    ? "if (!window.MapEngine || typeof window.MapEngine.createMap !== 'function') { throw new Error('engine missing'); }"
    : '';
  const assignment = `var ${variable} = window.MapEngine.createMap(container, route, {});`;
  const nullGuard = guard ? `if (!${variable}) throw new Error('map missing');` : '';
  const ready = "container.setAttribute('data-map-state', 'ready');";
  const guardedTail = guardAfterReady ? `${ready}\n${nullGuard}` : `${nullGuard}\n${ready}`;
  if (engineGuardAfterCreateMap) return `${assignment}\n${engine}\n${guardedTail}`;
  return `${engine}\n${assignment}\n${guardedTail}`;
}

function run() {
  for (const variable of ['inst', 'instance', 'mapResult']) {
    const result = inspectMapInitSource(fixture({ variable }));
    assert.equal(result.engineGuard, true, `${variable}: engine guard must precede createMap`);
    assert.equal(result.createMapAssigned, true, `${variable}: createMap assignment must be detected`);
    assert.equal(result.resultVariable, variable, `${variable}: createMap result identifier must be captured`);
    assert.equal(result.nullGuardBeforeReady, true, `${variable}: renamed null guard must remain valid`);
    assert.equal(hasFailClosedMapInit(fixture({ variable })), true, `${variable}: semantic contract must pass`);
  }

  const missingNullGuard = inspectMapInitSource(fixture({ guard: false }));
  assert.equal(missingNullGuard.createMapAssigned, true, 'assignment remains visible when null guard is missing');
  assert.equal(missingNullGuard.nullGuardBeforeReady, false, 'missing null guard must fail independently');
  assert.equal(hasFailClosedMapInit(fixture({ guard: false })), false, 'missing null guard must fail contract');
  assert.equal(hasFailClosedMapInit(fixture({ guardAfterReady: true })), false, 'guard after ready must fail');
  assert.equal(hasFailClosedMapInit(fixture({ engineGuard: false })), false, 'missing engine guard must fail');
  assert.equal(hasFailClosedMapInit(fixture({ engineGuardAfterCreateMap: true })), false, 'engine guard after createMap must fail');

  const mismatched = fixture({ variable: 'instance', guard: false })
    .replace("container.setAttribute('data-map-state', 'ready');", "if (!inst) throw new Error('wrong variable');\ncontainer.setAttribute('data-map-state', 'ready');");
  assert.equal(hasFailClosedMapInit(mismatched), false, 'guarding another identifier must fail');

  const ishod = fs.readFileSync(path.join(ROOT, 'src/components/karty/ishod/IshodMap.astro'), 'utf8');
  const avraam = fs.readFileSync(path.join(ROOT, 'src/components/karty/avraam/AvraamMap.astro'), 'utf8');
  const ishodResult = inspectMapInitSource(ishod);
  const avraamResult = inspectMapInitSource(avraam);
  assert.equal(hasFailClosedMapInit(ishod), true, 'current Ishod source must satisfy map init contract');
  assert.equal(hasFailClosedMapInit(avraam), true, 'current Avraam source must satisfy map init contract');
  assert.equal(ishodResult.resultVariable, 'instance', 'Ishod current result identifier must be accepted');
  assert.equal(avraamResult.resultVariable, 'inst', 'Avraam current result identifier must be accepted');

  console.log('✅ Map init source contract regression: ordering/rename-safe and guard-removal fail-closed');
}

if (require.main === module) run();

module.exports = { fixture, run };
