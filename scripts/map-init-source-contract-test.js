#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  hasDelegatedMapInit,
  hasFailClosedMapInit,
  inspectMapInitSource,
  inspectSharedMapInitSource,
} = require('./lib/map-init-source-contract');

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
  const runtime = fs.readFileSync(path.join(ROOT, 'src/components/karty/_shared/MapRuntimeFallback.astro'), 'utf8');
  const engine = fs.readFileSync(path.join(ROOT, 'karty/_engine/map-engine.js'), 'utf8');

  for (const [name, source] of [['Ishod', ishod], ['Avraam', avraam]]) {
    const result = inspectSharedMapInitSource(source);
    assert.equal(result.runtimeGuard, true, `${name}: shared runtime guard must precede bootstrap call`);
    assert.equal(result.bootEngineRouteCalled, true, `${name}: route must call shared bootEngineRoute`);
    assert.equal(result.routeUrlConfigured, true, `${name}: routeUrl must remain explicit`);
    assert.equal(result.noLocalLifecycle, true, `${name}: route must not own createMap/ready lifecycle`);
    assert.equal(hasDelegatedMapInit(source), true, `${name}: shared bootstrap contract must pass`);
  }

  assert.match(runtime, /function bootEngineRoute\(config\)/, 'shared runtime must own route bootstrap');
  assert.match(runtime, /typeof engine\.bootRoute === 'function'/, 'shared runtime must guard MapEngine.bootRoute');
  assert.match(runtime, /return engine\.bootRoute\(options\)/, 'shared runtime must delegate to MapEngine.bootRoute');
  assert.match(runtime, /renderFailure\(container,[\s\S]*?MapEngine mount failed/, 'missing engine must render a visible failure');

  const createIndex = engine.indexOf('const instance=createMap(container,route,mapOptions);');
  const afterCreateIndex = engine.indexOf("if(typeof config.afterCreate==='function')");
  const readyIndex = engine.indexOf("container.setAttribute('data-map-state','ready');");
  assert.ok(createIndex >= 0 && afterCreateIndex > createIndex && readyIndex > afterCreateIndex, 'shared engine must create, run post-create hook, then mark ready');
  assert.match(engine, /if\(!instance\)throw new Error\('MapEngine\.mountRoute: createMap returned no instance'\)/, 'shared engine must reject a null map instance');
  assert.match(engine, /if\(typeof instance\.destroy==='function'\)instance\.destroy\(\)/, 'shared engine must destroy partial instance when afterCreate fails');

  console.log('✅ Map init source contract regression: legacy direct init remains fail-closed; live routes delegate to shared fail-visible bootstrap');
}

if (require.main === module) run();

module.exports = { fixture, run };
