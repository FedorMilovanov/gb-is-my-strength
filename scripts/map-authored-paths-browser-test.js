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

async function collectRenderedPaths(page) {
  return page.evaluate(() => {
    const read = (node) => ({
      d: node.getAttribute('d') || '',
      source: node.getAttribute('data-route-source') || '',
      stageIndex: Number(node.getAttribute('data-stage-index')),
      pathIndex: Number(node.getAttribute('data-route-path-index')),
      colorKey: node.getAttribute('data-route-color-key') || '',
      stroke: node.getAttribute('stroke') || '',
      dash: node.getAttribute('stroke-dasharray') || '',
      markerEnd: node.getAttribute('marker-end') || '',
      layerAll: node.getAttribute('data-layer-all') || '',
      layerAny: node.getAttribute('data-layer-any') || '',
    });
    return {
      main: [...document.querySelectorAll('#me-paths .me-route')].map(read),
      under: [...document.querySelectorAll('#me-paths .me-route-under')].map(read),
      authoredMarkers: [...document.querySelectorAll('defs marker[id^="me-arrow-authored-"]')].map((marker) => ({
        id: marker.id,
        fill: marker.querySelector('path')?.getAttribute('fill') || '',
      })),
      stageLabels: [...document.querySelectorAll('#me-paths .me-stage-label')].map((label) => Number(label.getAttribute('data-stage-index'))),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function mountRoute(page, routePath) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`route fetch failed: ${response.status} ${response.statusText}`);
    const route = await response.json();
    const stage = document.querySelector('#stage');
    if (!stage || !window.MapEngine?.createMap) throw new Error('shared MapEngine fixture is unavailable');
    stage.replaceChildren();
    const instance = window.MapEngine.createMap(stage, route, { backUrl: '/karty/' });
    if (!instance) throw new Error('shared MapEngine did not create the fixture');
    window.__mapAuthoredFixture = instance;
    return route;
  }, routePath);
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

  const report = { browser: BROWSER_NAME, fallback: null, authored: null, failures: [] };
  try {
    await page.goto(`${BASE}/karty/ishod/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.MapEngine && document.querySelector('#me-paths .me-route')), null, { timeout: 20000 });

    const fallback = await collectRenderedPaths(page);
    const generated = fallback.main.filter((entry) => entry.source === 'generated');
    assert(generated.length > 0, 'Ishod generated fallback paths are missing', fallback);
    assert(fallback.main.every((entry) => entry.source === 'generated'), 'Ishod unexpectedly rendered authored paths', fallback);
    assert(generated.every((entry) => /^M[-+.\d]/.test(entry.d) && /\sL[-+.\d]/.test(entry.d)), 'Ishod fallback is not generated M/L geometry', generated);
    assert(fallback.overflow <= 1, 'Ishod fixture has horizontal overflow', fallback);
    report.fallback = { generated: generated.length, stages: fallback.stageLabels.length };

    const route = await mountRoute(page, '/karty/avraam/route.json');
    await page.waitForFunction(() => document.querySelectorAll('#me-paths .me-route[data-route-source="authored"]').length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(120);

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

    const rendered = await collectRenderedPaths(page);
    const authored = rendered.main.filter((entry) => entry.source === 'authored');
    const under = rendered.under.filter((entry) => entry.source === 'authored');
    assert(authored.length === expected.length, 'authored main path count drift', { expected: expected.length, actual: authored.length, authored });
    assert(under.length === expected.length, 'authored underlay path count drift', { expected: expected.length, actual: under.length, under });
    assert(rendered.main.every((entry) => entry.source === 'authored'), 'Avraam retained generated fallback paths despite authored geometry', rendered.main);
    assert(rendered.authoredMarkers.length === expected.length, 'authored arrow marker count drift', rendered.authoredMarkers);
    assert(rendered.stageLabels.length === route.stages.length, 'stage labels were duplicated or lost', rendered.stageLabels);
    assert(rendered.overflow <= 1, 'Avraam fixture has horizontal overflow', rendered);

    for (let index = 0; index < expected.length; index += 1) {
      const source = expected[index];
      const main = authored[index];
      const shadow = under[index];
      assert(main.stageIndex === source.stageIndex && main.pathIndex === source.pathIndex, 'authored path order/index drift', { index, source, main });
      assert(main.d === source.d, 'authored SVG d was not preserved exactly', { index, source: source.d, rendered: main.d });
      assert(shadow.d === source.d, 'authored underlay d was not preserved exactly', { index, source: source.d, rendered: shadow.d });
      assert(main.colorKey === source.colorKey, 'authored color token drift', { index, source, main });
      assert(normalizeColor(main.stroke) === normalizeColor(COLOR_TOKENS[source.colorKey]), 'authored path color was not resolved canonically', { index, source, main });
      assert(main.layerAll.split(/\s+/).includes(`stage-${source.stageIndex}`), 'stage layer membership missing from authored path', { index, source, main });
      assert(main.markerEnd === `url(#me-arrow-authored-${source.stageIndex}-${source.pathIndex})`, 'authored marker binding drift', { index, source, main });
      const marker = rendered.authoredMarkers.find((entry) => entry.id === `me-arrow-authored-${source.stageIndex}-${source.pathIndex}`);
      assert(marker && normalizeColor(marker.fill) === normalizeColor(main.stroke), 'authored arrow color does not match route stroke', { index, source, main, marker });
      if (source.dash) {
        assert(main.dash === '10 8' && shadow.dash === '10 8', 'authored dashed route lost its dash contract', { index, source, main, shadow });
      } else {
        assert(main.dash !== '10 8' && shadow.dash !== '10 8', 'solid authored route was converted to source dash styling', { index, source, main, shadow });
      }
    }

    const screenshot = path.join(EVIDENCE, `${BROWSER_NAME}-avraam-authored-paths.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    assert(runtimeErrors.length === 0, 'runtime errors detected', { runtimeErrors });
    report.authored = {
      expected: expected.length,
      rendered: authored.length,
      underlays: under.length,
      markers: rendered.authoredMarkers.length,
      dashed: expected.filter((entry) => entry.dash).length,
      colors: [...new Set(expected.map((entry) => entry.colorKey))],
    };
    fs.writeFileSync(path.join(EVIDENCE, `${BROWSER_NAME}-report.json`), JSON.stringify(report, null, 2));
    console.log(`PASS ${BROWSER_NAME}: fallback=${generated.length}, authored=${authored.length}, dashed=${report.authored.dashed}, markers=${rendered.authoredMarkers.length}`);
  } catch (error) {
    report.failures.push({ message: error.message, details: error.details || null, stack: error.stack, runtimeErrors });
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
