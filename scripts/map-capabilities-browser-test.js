'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const engine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');
const baseRoute = {
  archetype: 'thematic',
  meta: { id: 'capability-browser-fixture', title: 'Capability fixture', viewport_init: { cx: 500, cy: 350, w: 1000 } },
  stages: [{ n: 'I', t: 'Stage' }],
  stories: [{ id: 'main', label: 'Main', places: ['p1'], stage_ids: [0], active_by_default: true }],
  layers: [{ id: 'fixture-layer', label: 'Fixture layer', color: '#999', on: true }],
  timeline: [{ era: '1', label: 'One', stage: 0 }],
  signature: { type: 'lampstands', label: 'Signature', place_ids: ['p1'] },
  scientific_variants: { p1: [{ status: 'candidate', title: 'Variant', detail: 'Variant detail' }] },
  places: [{
    id: 'p1', name: 'Place', x: 500, y: 350, stage: 0,
    story: '<p>Story</p>', bible: '<p>Bible</p>', arch: '<p>Arch</p>', dispute: '<p>Dispute</p>',
  }],
};

async function mount(page, capabilities) {
  await page.evaluate(({ route, caps }) => {
    try { window.__capMap?.destroy?.(); } catch (_) {}
    const container = document.getElementById('map');
    container.replaceChildren();
    const data = JSON.parse(JSON.stringify(route));
    data.capabilities = caps;
    window.__capMap = window.MapEngine.createMap(container, data, {
      showIntro: false,
      showCompass: false,
      archaeologyProjection: {
        schemaVersion: 'fixture',
        allowedTabs: ['arch', 'sci'],
        mapCards: [{ claimId: 'fixture-claim', placeId: 'p1', statement: 'Projection', status: 'candidate' }],
        byPlace: {},
        sourceMeta: {},
      },
    });
    if (!window.__capMap) throw new Error('MapEngine fixture failed to mount');
  }, { route: baseRoute, caps: capabilities });
  await page.waitForTimeout(80);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const container = document.getElementById('map');
    window.__capMap.open('p1');
    return {
      archetype: container.getAttribute('data-map-archetype'),
      capabilitiesAttr: container.getAttribute('data-map-capabilities'),
      instanceCapabilities: window.__capMap.capabilities,
      stories: Boolean(container.querySelector('.me-stories')),
      stages: Boolean(container.querySelector('.me-stages')),
      layers: Boolean(container.querySelector('.me-layers')),
      life: Boolean(container.querySelector('.me-life')),
      signatureNodes: container.querySelectorAll('#me-signature [data-signature]').length,
      tabs: [...container.querySelectorAll('.me-tab')].map(node => node.dataset.tab),
      routeData: {
        stories: window.__capMap.routeData.stories.length,
        stages: window.__capMap.routeData.stages.length,
        layers: (window.__capMap.routeData.layers || []).length,
        timeline: (window.__capMap.routeData.timeline || []).length,
        signature: Boolean(window.__capMap.routeData.signature),
        arch: window.__capMap.routeData.places[0]?.arch,
        dispute: window.__capMap.routeData.places[0]?.dispute,
        scientific: Boolean(window.__capMap.routeData.scientific_variants),
      },
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });

  try {
    await page.setContent('<!doctype html><html><body><div id="map" style="width:1200px;height:800px"></div></body></html>');
    await page.addScriptTag({ content: engine });

    await mount(page, ['stages']);
    const stageOnly = await snapshot(page);
    assert.equal(stageOnly.archetype, 'thematic');
    assert.equal(stageOnly.capabilitiesAttr, 'stages');
    assert.deepEqual(stageOnly.instanceCapabilities, ['stages']);
    assert.equal(stageOnly.stages, true, 'declared stages surface must exist');
    assert.equal(stageOnly.stories, false, 'undeclared stories surface must not exist');
    assert.equal(stageOnly.layers, false, 'undeclared layers surface must not exist');
    assert.equal(stageOnly.life, false, 'undeclared timeline surface must not exist');
    assert.equal(stageOnly.signatureNodes, 0, 'undeclared signature surface must not render');
    assert.deepEqual(stageOnly.tabs, ['story','bible'], 'undeclared interpretation tabs must not render');
    assert.equal(stageOnly.routeData.stories, 0);
    assert.equal(stageOnly.routeData.layers, 0);
    assert.equal(stageOnly.routeData.timeline, 0);
    assert.equal(stageOnly.routeData.signature, false);
    assert.equal(stageOnly.routeData.arch, undefined);
    assert.equal(stageOnly.routeData.dispute, undefined);
    assert.equal(stageOnly.routeData.scientific, false);

    const fullCaps = ['stages','stories','layers','timeline','signature','interpretations'];
    await mount(page, fullCaps);
    const full = await snapshot(page);
    assert.equal(full.capabilitiesAttr, fullCaps.join(' '));
    assert.deepEqual(full.instanceCapabilities, fullCaps);
    assert.equal(full.stories, true);
    assert.equal(full.stages, true);
    assert.equal(full.layers, true);
    assert.equal(full.life, true);
    assert(full.signatureNodes > 0, 'declared signature must render');
    for (const tab of ['arch','dispute','sci']) assert(full.tabs.includes(tab), `declared interpretation tab missing: ${tab}`);
    assert.equal(full.routeData.stories, 1);
    assert.equal(full.routeData.layers, 1);
    assert.equal(full.routeData.timeline, 1);
    assert.equal(full.routeData.signature, true);
    assert.equal(typeof full.routeData.arch, 'string');
    assert.equal(typeof full.routeData.dispute, 'string');
    assert.equal(full.routeData.scientific, true);

    assert.deepEqual(runtimeErrors, [], `runtime console/page errors: ${runtimeErrors.join(' | ')}`);
    console.log('MAP CAPABILITIES BROWSER CONTRACT: PASS — fail-closed and declared DOM surfaces');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
