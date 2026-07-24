#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const BROWSER_NAME = process.env.MAP_AUTHORED_BROWSER || 'chromium';
const EVIDENCE = process.env.MAP_AUTHORED_EVIDENCE || '/tmp/map-authored-evidence';
const browserType = playwright[BROWSER_NAME];
const COLOR_TOKENS = Object.freeze({ gold: '#e8c879', lot: '#e0813f', war: '#cf5b6b' });

if (!browserType) throw new Error(`Unsupported MAP_AUTHORED_BROWSER=${BROWSER_NAME}`);
fs.mkdirSync(EVIDENCE, { recursive: true });

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function normalizeColor(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function toSerializable(value) {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object') {
      if (seen.has(item)) return '[Circular]';
      seen.add(item);
    }
    return item;
  }));
}

async function collectRenderedPaths(page, rootSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) throw new Error(`map root not found: ${selector}`);
    const read = (node) => ({
      d: node.getAttribute('d') || '',
      source: node.getAttribute('data-route-source') || '',
      stage: Number(node.getAttribute('data-stage')),
      stageIndex: Number(node.getAttribute('data-stage-index')),
      pathIndex: Number(node.getAttribute('data-route-path-index')),
      kind: node.getAttribute('data-route-kind') || '',
      colorKey: node.getAttribute('data-route-color-key') || '',
      stroke: node.getAttribute('stroke') || '',
      dashFlag: node.getAttribute('data-route-dash') || '',
      dashArray: node.getAttribute('stroke-dasharray') || '',
      markerEnd: node.getAttribute('marker-end') || '',
      layer: node.getAttribute('data-layer') || '',
      layerAll: node.getAttribute('data-layer-all') || '',
      layerAny: node.getAttribute('data-layer-any') || '',
      className: node.getAttribute('class') || '',
    });
    return {
      main: [...root.querySelectorAll('#me-paths .me-route-main')].map(read),
      under: [...root.querySelectorAll('#me-paths .me-route-underlay')].map(read),
      authoredMarkers: [...root.querySelectorAll('defs marker[id^="me-arrow-authored-"]')].map((marker) => ({
        id: marker.id,
        fill: marker.querySelector('path')?.getAttribute('fill') || '',
      })),
      stageLabels: [...root.querySelectorAll('#me-paths .me-route-label')].map((label) => ({
        stage: Number(label.getAttribute('data-stage')),
        stageIndex: Number(label.getAttribute('data-stage-index')),
        text: label.textContent || '',
        layerAll: label.getAttribute('data-layer-all') || '',
      })),
      hasIntro: Boolean(root.querySelector('.me-intro')),
      hasLoading: Boolean(root.querySelector('.me-loading')),
      hasBaseGeo: Boolean(root.querySelector('#me-base-geo')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, rootSelector);
}

async function mountFixture(page, fixtureId, { routePath = null, routeData = null, baseGeoUrl = null } = {}) {
  return page.evaluate(async ({ id, url, inlineRoute, geoUrl }) => {
    let route = inlineRoute;
    if (!route) {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`route fetch failed: ${response.status} ${response.statusText}`);
      route = await response.json();
    }

    try { window.__mapAuthoredFixture?.destroy?.(); } catch (_) {}
    document.getElementById(id)?.remove();

    const fixture = document.createElement('div');
    fixture.id = id;
    fixture.style.width = '1000px';
    fixture.style.maxWidth = '100%';
    fixture.style.height = '700px';
    fixture.style.margin = '0 auto';
    fixture.style.position = 'relative';
    document.body.appendChild(fixture);

    if (!window.MapEngine?.createMap) throw new Error('shared MapEngine fixture is unavailable');
    const instance = window.MapEngine.createMap(fixture, route, {
      backUrl: '/karty/',
      showIntro: false,
      ...(geoUrl ? { baseGeoUrl: geoUrl } : {}),
    });
    if (!instance) throw new Error('shared MapEngine did not create the fixture');
    window.__mapAuthoredFixture = instance;
    return route;
  }, { id: fixtureId, url: routePath, inlineRoute: routeData, geoUrl: baseGeoUrl });
}

async function run() {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|ERR_FAILED|ERR_BLOCKED_BY_CLIENT/.test(text)) return;
    runtimeErrors.push(`console: ${text}`);
  });

  const report = {
    browser: BROWSER_NAME,
    engineVersion: null,
    fallback: null,
    authored: null,
    invalidFallback: null,
    highStageFallback: null,
    visualEvidence: null,
    failures: [],
  };
  try {
    await page.goto(`${BASE}/karty/ishod/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.MapEngine && document.querySelector('#stage #me-paths .me-route-main')), null, { timeout: 20000 });

    report.engineVersion = await page.evaluate(() => window.MapEngine?.version || null);
    assert(report.engineVersion === '0.56.0', 'MapEngine public version is not synchronized with v0.56 renderer', { engineVersion: report.engineVersion });

    const fallback = await collectRenderedPaths(page, '#stage');
    assert(fallback.main.length > 0, 'Ishod generated fallback paths are missing', fallback);
    assert(fallback.main.every((entry) => entry.source === 'generated'), 'Ishod unexpectedly rendered authored paths', fallback);
    assert(fallback.main.every((entry) => /^M[-+.\d]/.test(entry.d) && /\sL[-+.\d]/.test(entry.d) && !/[CQAST]/i.test(entry.d)), 'Ishod fallback is not generated M/L geometry', fallback.main);
    assert(fallback.main.length === fallback.under.length, 'Ishod main/underlay path count drift', fallback);
    assert(fallback.main.every((entry) => entry.className.includes('me-route-main') && entry.kind === 'main'), 'Ishod main compatibility classes/metadata drift', fallback.main);
    assert(fallback.under.every((entry) => entry.className.includes('me-route-underlay') && entry.kind === 'underlay'), 'Ishod underlay compatibility classes/metadata drift', fallback.under);
    assert(fallback.overflow <= 1, 'Ishod fixture has horizontal overflow', fallback);
    report.fallback = { generated: fallback.main.length, stages: fallback.stageLabels.length };

    const fixtureId = 'map-authored-fixture';
    const route = await mountFixture(page, fixtureId, {
      routePath: '/karty/avraam/route.json',
      baseGeoUrl: '/karty/avraam/base.svg',
    });
    await page.waitForFunction((id) => document.querySelectorAll(`#${id} #me-paths .me-route-main[data-route-source="authored"]`).length > 0, fixtureId, { timeout: 10000 });
    await page.waitForFunction((id) => Boolean(document.querySelector(`#${id} #me-base-geo`)), fixtureId, { timeout: 10000 });
    await page.waitForFunction((id) => !document.querySelector(`#${id} .me-loading`), fixtureId, { timeout: 10000 });
    await page.waitForTimeout(180);

    const expected = [];
    (route.stages || []).forEach((stage, stageIndex) => {
      (Array.isArray(stage.paths) ? stage.paths : []).forEach((entry, pathIndex) => {
        expected.push({
          stageIndex,
          pathIndex,
          d: String(entry.d || '').trim(),
          colorKey: String(entry.c || '').trim(),
          dash: Boolean(entry.dash),
        });
      });
    });
    assert(expected.length === 15, 'Avraam source no longer contains the canonical 15 authored paths', { expected: expected.length });
    assert(expected.every((entry) => /\bC[-+.\d]/.test(entry.d)), 'Avraam source contains a non-Bezier authored route', expected);

    const rendered = await collectRenderedPaths(page, `#${fixtureId}`);
    assert(rendered.main.length === expected.length, 'authored main path count drift', { expected: expected.length, actual: rendered.main.length, rendered });
    assert(rendered.under.length === expected.length, 'authored underlay path count drift', { expected: expected.length, actual: rendered.under.length, rendered });
    assert(rendered.main.every((entry) => entry.source === 'authored'), 'Avraam retained generated fallback paths despite authored geometry', rendered.main);
    assert(rendered.under.every((entry) => entry.source === 'authored'), 'Avraam retained generated underlays despite authored geometry', rendered.under);
    assert(rendered.authoredMarkers.length === expected.length, 'authored arrow marker count drift', rendered.authoredMarkers);
    assert(rendered.stageLabels.length === route.stages.length, 'stage labels were duplicated or lost', rendered.stageLabels);
    assert(new Set(rendered.stageLabels.map((entry) => entry.stageIndex)).size === route.stages.length, 'stage label indexes are not unique', rendered.stageLabels);
    assert(!rendered.hasIntro && !rendered.hasLoading && rendered.hasBaseGeo, 'visual evidence surface is not the fully rendered Avraam map', rendered);
    assert(rendered.overflow <= 1, 'Avraam fixture has horizontal overflow', rendered);

    for (let index = 0; index < expected.length; index += 1) {
      const source = expected[index];
      const main = rendered.main[index];
      const shadow = rendered.under[index];
      assert(main.stage === source.stageIndex && main.stageIndex === source.stageIndex && main.pathIndex === source.pathIndex, 'authored main path order/index drift', { index, source, main });
      assert(shadow.stage === source.stageIndex && shadow.stageIndex === source.stageIndex && shadow.pathIndex === source.pathIndex, 'authored underlay order/index drift', { index, source, shadow });
      assert(main.d === source.d && shadow.d === source.d, 'authored SVG d was not preserved exactly', { index, source: source.d, main: main.d, under: shadow.d });
      assert(main.kind === 'main' && shadow.kind === 'underlay', 'route kind compatibility metadata drift', { index, main, shadow });
      assert(main.className.includes('me-route-main') && shadow.className.includes('me-route-underlay'), 'route compatibility class drift', { index, main, shadow });
      assert(main.colorKey === source.colorKey && shadow.colorKey === source.colorKey, 'authored color token drift', { index, source, main, shadow });
      assert(normalizeColor(main.stroke) === normalizeColor(COLOR_TOKENS[source.colorKey]), 'authored path color was not resolved canonically', { index, source, main });
      assert(normalizeColor(shadow.stroke) === normalizeColor(main.stroke), 'authored underlay color does not match main path', { index, main, shadow });
      assert(main.layerAll.split(/\s+/).includes(`stage-${source.stageIndex}`), 'stage layer membership missing from authored main path', { index, source, main });
      assert(shadow.layerAll === main.layerAll && shadow.layerAny === main.layerAny && shadow.layer === main.layer, 'main/underlay layer membership drift', { index, main, shadow });
      assert(main.markerEnd === `url(#me-arrow-authored-${source.stageIndex}-${source.pathIndex})`, 'authored marker binding drift', { index, source, main });
      const marker = rendered.authoredMarkers.find((entry) => entry.id === `me-arrow-authored-${source.stageIndex}-${source.pathIndex}`);
      assert(marker && normalizeColor(marker.fill) === normalizeColor(main.stroke), 'authored arrow color does not match route stroke', { index, source, main, marker });
      assert(main.dashFlag === (source.dash ? '1' : '0') && shadow.dashFlag === (source.dash ? '1' : '0'), 'authored dash metadata drift', { index, source, main, shadow });
      if (source.dash) {
        assert(main.dashArray === '10 8' && shadow.dashArray === '10 8', 'authored dashed route lost its dash contract', { index, source, main, shadow });
      } else {
        assert(main.dashArray !== '10 8' && shadow.dashArray !== '10 8', 'solid authored route was converted to source dash styling', { index, source, main, shadow });
      }
    }

    const invalidRoute = {
      meta: { id: 'invalid-authored-fallback', title: 'Invalid authored fallback', viewport_init: { cx: 200, cy: 120, w: 500 } },
      stories: [{ id: 'main', label: 'Весь путь', places: null, stages: null }],
      places: [
        { id: 'a', name: 'A', x: 100, y: 100, stage: 0 },
        { id: 'b', name: 'B', x: 300, y: 160, stage: 0 },
      ],
      stages: [{ n: 'I', t: 'Fallback', paths: [{ d: 'not-svg-path', c: 'gold' }] }],
    };
    await mountFixture(page, fixtureId, { routeData: invalidRoute });
    await page.waitForFunction((id) => document.querySelectorAll(`#${id} #me-paths .me-route-main`).length === 1, fixtureId, { timeout: 10000 });
    const invalidFallback = await collectRenderedPaths(page, `#${fixtureId}`);
    assert(invalidFallback.main.length === 1 && invalidFallback.main[0].source === 'generated', 'invalid authored geometry did not fail closed to generated fallback', invalidFallback);
    assert(/^M100,100 L300,160$/.test(invalidFallback.main[0].d), 'invalid authored fallback geometry drift', invalidFallback.main[0]);
    assert(invalidFallback.authoredMarkers.length === 0, 'invalid authored geometry created authored markers', invalidFallback.authoredMarkers);
    report.invalidFallback = { generated: invalidFallback.main.length, d: invalidFallback.main[0].d };

    const highStageRoute = {
      meta: { id: 'high-stage-fallback', title: 'High stage fallback', viewport_init: { cx: 200, cy: 120, w: 500 } },
      stories: [{ id: 'main', label: 'Весь путь', places: null, stages: null }],
      places: [
        { id: 'a7', name: 'A7', x: 100, y: 100, stage: 7 },
        { id: 'b7', name: 'B7', x: 300, y: 160, stage: 7 },
      ],
      stages: Array.from({ length: 8 }, (_, index) => ({ n: String(index + 1), t: `Stage ${index + 1}` })),
    };
    await mountFixture(page, fixtureId, { routeData: highStageRoute });
    await page.waitForFunction((id) => document.querySelectorAll(`#${id} #me-paths .me-route-main`).length === 1, fixtureId, { timeout: 10000 });
    const highStageFallback = await collectRenderedPaths(page, `#${fixtureId}`);
    assert(highStageFallback.main[0].stageIndex === 7 && highStageFallback.main[0].source === 'generated', 'high-stage generated fallback metadata drift', highStageFallback);
    assert(normalizeColor(highStageFallback.main[0].stroke) === normalizeColor(COLOR_TOKENS.gold), 'high-stage generated fallback changed legacy gold color', highStageFallback.main[0]);
    assert(highStageFallback.main[0].markerEnd === 'url(#me-arrow-0)', 'high-stage generated fallback arrow is missing or mismatched', highStageFallback.main[0]);
    report.highStageFallback = {
      stage: highStageFallback.main[0].stageIndex,
      stroke: highStageFallback.main[0].stroke,
      markerEnd: highStageFallback.main[0].markerEnd,
    };

    await mountFixture(page, fixtureId, {
      routePath: '/karty/avraam/route.json',
      baseGeoUrl: '/karty/avraam/base.svg',
    });
    await page.waitForFunction((id) => document.querySelectorAll(`#${id} #me-paths .me-route-main[data-route-source="authored"]`).length === 15, fixtureId, { timeout: 10000 });
    await page.waitForFunction((id) => Boolean(document.querySelector(`#${id} #me-base-geo`)) && !document.querySelector(`#${id} .me-loading`), fixtureId, { timeout: 10000 });
    await page.waitForTimeout(250);
    await page.locator(`#${fixtureId}`).screenshot({ path: path.join(EVIDENCE, `${BROWSER_NAME}-avraam-authored-paths.png`) });
    report.visualEvidence = { intro: false, loading: false, baseGeo: true };

    assert(runtimeErrors.length === 0, 'runtime errors detected', { runtimeErrors });
    report.authored = {
      expected: expected.length,
      rendered: rendered.main.length,
      underlays: rendered.under.length,
      markers: rendered.authoredMarkers.length,
      stages: rendered.stageLabels.length,
      dashed: expected.filter((entry) => entry.dash).length,
      colors: [...new Set(expected.map((entry) => entry.colorKey))],
    };
    fs.writeFileSync(path.join(EVIDENCE, `${BROWSER_NAME}-report.json`), JSON.stringify(report, null, 2));
    console.log(`PASS ${BROWSER_NAME}: version=${report.engineVersion}, fallback=${fallback.main.length}, authored=${rendered.main.length}, invalidFallback=${invalidFallback.main.length}, highStage=${highStageFallback.main.length}`);
  } catch (error) {
    report.failures.push({ message: error.message, details: toSerializable(error.details || null), stack: error.stack, runtimeErrors });
    fs.writeFileSync(path.join(EVIDENCE, `${BROWSER_NAME}-report.json`), JSON.stringify(report, null, 2));
    await page.screenshot({ path: path.join(EVIDENCE, `${BROWSER_NAME}-failure.png`), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
