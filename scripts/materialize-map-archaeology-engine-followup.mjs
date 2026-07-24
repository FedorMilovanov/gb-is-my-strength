import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, content) => fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
function replaceOnce(file, source, search, replacement) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one exact anchor, found ${count}: ${search.slice(0, 120)}`);
  return source.replace(search, replacement);
}

let engine = read('karty/_engine/map-engine.js');
engine = replaceOnce(
  'map-engine.js',
  engine,
  '  // Verified Archaeological References (2024-2026 discoveries)',
  '  // Shared route palette and tab vocabulary.',
);
engine = replaceOnce(
  'map-engine.js',
  engine,
  `    const fallbackOverlayOpeners = new Map();
    const fallbackOverlayOwners = new Set();`,
  `    const fallbackOverlayOpeners = new Map();
    const fallbackOverlayOwners = new Set();
    const fallbackOverlayStates = new Map();`,
);
engine = replaceOnce(
  'map-engine.js',
  engine,
  `    function openSpecialOverlay(ownerId, options = {}) {
      if (overlayRuntime?.open) return overlayRuntime.open(ownerId, options);
      const opener = options.opener || document.activeElement;
      if (opener && opener !== document.body && opener !== document.documentElement) fallbackOverlayOpeners.set(ownerId, opener);
      const wasOpen = fallbackOverlayOwners.has(ownerId);
      fallbackOverlayOwners.add(ownerId);
      if (!wasOpen && options.lockScroll !== false) window.SiteUtils?.lockScroll?.(ownerId);
      setTimeout(() => focusSpecialTarget(options.focusTarget), 0);
      return {ownerId, element:options.element || null};
    }`,
  `    function openSpecialOverlay(ownerId, options = {}) {
      if (overlayRuntime?.open) return overlayRuntime.open(ownerId, options);
      const opener = options.opener || document.activeElement;
      if (opener && opener !== document.body && opener !== document.documentElement) fallbackOverlayOpeners.set(ownerId, opener);
      const wasOpen = fallbackOverlayOwners.has(ownerId);
      fallbackOverlayOwners.add(ownerId);
      if (!wasOpen && options.lockScroll !== false) window.SiteUtils?.lockScroll?.(ownerId);
      const element = options.element || null;
      const inertTargets = Array.isArray(options.inertTargets) ? options.inertTargets.filter(Boolean) : [];
      const targetStates = inertTargets.map(target => ({
        target,
        hadInert: target.hasAttribute('inert'),
        ariaHidden: target.getAttribute('aria-hidden'),
      }));
      targetStates.forEach(({target}) => {
        target.setAttribute('inert', '');
        target.setAttribute('aria-hidden', 'true');
      });
      if (element) {
        element.removeAttribute('inert');
        element.setAttribute('aria-hidden', 'false');
      }
      fallbackOverlayStates.set(ownerId, {element, targetStates});
      setTimeout(() => focusSpecialTarget(options.focusTarget), 0);
      return {ownerId, element};
    }`,
);
engine = replaceOnce(
  'map-engine.js',
  engine,
  `    function closeSpecialOverlay(ownerId, reason = 'close', options = {}) {
      if (overlayRuntime?.close) return overlayRuntime.close(ownerId, reason, options);
      if (!fallbackOverlayOwners.has(ownerId)) return false;
      fallbackOverlayOwners.delete(ownerId);
      window.SiteUtils?.unlockScroll?.(ownerId);
      const opener = fallbackOverlayOpeners.get(ownerId);
      fallbackOverlayOpeners.delete(ownerId);
      if (options.restoreFocus !== false && opener) setTimeout(() => focusSpecialTarget(opener), 0);
      return true;
    }`,
  `    function closeSpecialOverlay(ownerId, reason = 'close', options = {}) {
      if (overlayRuntime?.close) return overlayRuntime.close(ownerId, reason, options);
      if (!fallbackOverlayOwners.has(ownerId)) return false;
      fallbackOverlayOwners.delete(ownerId);
      window.SiteUtils?.unlockScroll?.(ownerId);
      const overlayState = fallbackOverlayStates.get(ownerId);
      fallbackOverlayStates.delete(ownerId);
      if (overlayState?.element) {
        overlayState.element.setAttribute('aria-hidden', 'true');
        overlayState.element.setAttribute('inert', '');
      }
      (overlayState?.targetStates || []).forEach(({target, hadInert, ariaHidden}) => {
        if (hadInert) target.setAttribute('inert', ''); else target.removeAttribute('inert');
        if (ariaHidden === null) target.removeAttribute('aria-hidden'); else target.setAttribute('aria-hidden', ariaHidden);
      });
      const opener = fallbackOverlayOpeners.get(ownerId);
      fallbackOverlayOpeners.delete(ownerId);
      if (options.restoreFocus !== false && opener) setTimeout(() => focusSpecialTarget(opener), 0);
      return true;
    }`,
);
engine = replaceOnce(
  'map-engine.js',
  engine,
  `      verified:'проверено',imported:'очередь проверки',active:'действующий источник',retracted:'отозвано'`,
  `      verified:'проверено',imported:'очередь проверки',active:'действующий источник',retracted:'отозвано',
      general:'академическая рамка',conservative:'консервативная интерпретация',yec:'YEC-интерпретация'`,
);
engine = replaceOnce(
  'map-engine.js',
  engine,
  `        source.perspective==='yec'?'YEC-интерпретация':source.perspective,ARCHAEOLOGY_LABELS[source.status]||source.status,`,
  `        ARCHAEOLOGY_LABELS[source.perspective]||source.perspective,ARCHAEOLOGY_LABELS[source.status]||source.status,`,
);
engine = replaceOnce(
  'map-engine.js',
  engine,
  `        if(ids.length){const sources=document.createElement('div');sources.className='map-arch-sources';ids.forEach(id=>{const source=projection.sourceMeta?.[id];if(!source)return;badges.appendChild(_archBadge(source.evidenceUse));sources.appendChild(_archSourceNode(source))});article.appendChild(sources)}`,
  `        if(ids.length){
          const sources=document.createElement('div');sources.className='map-arch-sources';
          const badgeUses=new Set();
          ids.forEach(id=>{
            const source=projection.sourceMeta?.[id];if(!source)return;
            if(!badgeUses.has(source.evidenceUse)){badgeUses.add(source.evidenceUse);badges.appendChild(_archBadge(source.evidenceUse))}
            sources.appendChild(_archSourceNode(source));
          });
          article.appendChild(sources);
        }`,
);
write('karty/_engine/map-engine.js', engine);

let contract = read('scripts/map-archaeology-projection-contract-test.mjs');
contract = replaceOnce(
  'map-archaeology-projection-contract-test.mjs',
  contract,
  `assert.match(engine,/version:'0.56.0'/);`,
  `assert.match(engine,/version:'0.56.0'/);
assert.ok(engine.includes('const fallbackOverlayStates = new Map()'));
assert.ok(engine.includes("element.removeAttribute('inert')"));
assert.ok(engine.includes("overlayState.element.setAttribute('inert', '')"));
assert.ok(engine.includes('const badgeUses=new Set()'));
assert.ok(engine.includes("general:'академическая рамка'"));`,
);
write('scripts/map-archaeology-projection-contract-test.mjs', contract);

const browser = `import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';

const browserName = process.env.MAP_ARCHAEOLOGY_BROWSER || 'chromium';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(\`unsupported browser \${browserName}\`);

const engine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');
const route = {
  meta: { id: 'projection-test', title: 'Projection test', viewport_init: { cx: 500, cy: 400, w: 900 } },
  stages: [{ n: 'I', t: 'Test', ids: ['ur', 'hammam'] }],
  stories: [{ id: 'main', label: 'Main', place_ids: ['ur', 'hammam'], stage_ids: [0], active_by_default: true }],
  places: [
    { id: 'ur', name: 'Ur', x: 420, y: 400, stage: 0, story: 'Story Ur', arch: '<p>Legacy arch body</p>', bible: 'Bible' },
    { id: 'hammam', name: 'Hammam', x: 580, y: 400, stage: 0, story: 'Story Hammam', arch: '<p>Legacy arch body</p>', bible: 'Bible' },
  ],
  scientific_variants: { ur: [{ status: 'consensus', title: 'Ur variant' }], hammam: [{ status: 'rejected', title: 'Hammam variant' }] },
};
const projection = {
  schemaVersion: '1.1.0', mapId: 'test', runtimeCategoryIds: ['exodus_route'], allowedTabs: ['arch', 'sci'],
  mapCards: [{ claimId: 'map-context', category: 'exodus_route', status: 'accepted-context', statement: 'Governed map context.', limitations: 'Context does not prove every event.', evidenceSourceIds: ['field-source', 'field-source-2'], interpretationSourceIds: [] }],
  byPlace: {
    ur: [{ claimId: 'ur-context', category: null, status: 'accepted-context', statement: 'Ur context.', limitations: 'No personal artefact.', evidenceSourceIds: ['field-source'], interpretationSourceIds: ['yec-source'] }],
    hammam: [{ claimId: 'retracted-context', category: null, status: 'rejected', statement: 'Retracted claim rejected.', limitations: 'Negative evidence only.', evidenceSourceIds: ['retracted-source'], interpretationSourceIds: [] }],
  },
  sourceMeta: {
    'field-source': { id: 'field-source', title: 'Excavation report', organization: 'Museum', url: 'https://example.test/report', year: 2025, accessedAt: '2026-07-24', status: 'active', verification: 'verified', evidenceUse: 'high', perspective: 'general' },
    'field-source-2': { id: 'field-source-2', title: 'Second excavation report', organization: 'University', url: 'https://example.test/report-2', year: 2024, accessedAt: '2026-07-24', status: 'active', verification: 'verified', evidenceUse: 'high', perspective: 'general' },
    'yec-source': { id: 'yec-source', title: 'YEC analysis', organization: 'Journal', url: 'https://example.test/interpretation', year: 2012, accessedAt: '2026-07-24', status: 'active', verification: 'verified', evidenceUse: 'interpretation', perspective: 'yec' },
    'retracted-source': { id: 'retracted-source', title: 'Retraction notice', organization: 'Journal', url: 'javascript:alert(1)', year: 2025, accessedAt: '2026-07-24', status: 'retracted', verification: 'verified', evidenceUse: 'negative', perspective: 'general' },
  },
};

const launched = await browserType.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

try {
  await page.route('https://example.test/**', request => request.fulfill({
    status: 200,
    contentType: 'text/html',
    body: \`<!doctype html><html><body><div id="stage" style="width:100vw;height:100vh"></div><script>\${engine}<\\/script><script>window.projectionTest=MapEngine.createMap(document.getElementById('stage'),\${JSON.stringify(route)},{showIntro:false,archaeologyProjection:\${JSON.stringify(projection)}});window.projectionTest.open('ur');<\\/script></body></html>\`,
  }));
  await page.goto('https://example.test/karty/test/?place=ur');
  const panel = page.locator('.me-panel');
  await page.waitForSelector('.me-panel--open');
  assert.equal(await panel.getAttribute('inert'), null, 'standalone open panel must not remain inert');
  assert.equal(await panel.getAttribute('aria-hidden'), 'false');
  assert.equal(await page.locator('[data-archaeology-projection-root]').count(), 0, 'story tab must not render archaeology');

  await page.locator('[data-tab="arch"]').click();
  await page.waitForSelector('[data-claim-id="ur-context"]');
  assert.equal(await page.locator('[data-claim-id="map-context"]').count(), 1);
  assert.equal(await page.locator('[data-runtime-category="exodus_route"]').count(), 1);
  assert.equal(await page.locator('[data-claim-id="map-context"] [data-source-id]').count(), 2);
  assert.equal(await page.locator('[data-claim-id="map-context"] .map-arch-badge--high').count(), 1, 'evidence-use badges must be deduplicated');
  assert.equal(await page.locator('[data-source-id="field-source"][data-evidence-use="high"][data-source-verification="verified"]').count(), 2);
  assert.equal(await page.locator('[data-source-id="yec-source"][data-source-perspective="yec"]').count(), 1);
  assert.equal(await page.locator('[data-source-id="field-source"] a').first().getAttribute('href'), 'https://example.test/report');
  assert.match(await page.locator('[data-source-id="field-source"] .map-arch-source__meta').first().textContent(), /академическая рамка/);

  await page.locator('[data-tab="story"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-archaeology-projection-root]'));
  await page.evaluate(() => window.projectionTest.close());
  await page.waitForFunction(() => !document.querySelector('.me-panel--open'));
  assert.notEqual(await panel.getAttribute('inert'), null, 'closed standalone panel must be inert');
  assert.equal(await panel.getAttribute('aria-hidden'), 'true');

  await page.evaluate(() => window.projectionTest.open('hammam'));
  await page.waitForSelector('.me-panel--open');
  assert.equal(await panel.getAttribute('inert'), null, 'reopened standalone panel must be interactive');
  await page.locator('[data-tab="arch"]').click();
  await page.waitForSelector('[data-claim-id="retracted-context"]');
  assert.equal(await page.locator('[data-source-id="retracted-source"] a').count(), 0);
  assert.equal(await page.locator('[data-source-id="retracted-source"][data-evidence-use="negative"][data-source-status="retracted"]').count(), 1);
  assert.equal(await page.locator('.me-arch-footer').count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: browserName, standaloneOverlay: true, directEngine: true, mapCards: true, placeCards: true, legacyFooters: 0, errors: 0 }, null, 2));
} finally {
  await launched.close();
}
`;
write('scripts/map-archaeology-projection-browser-test.mjs', browser);

console.log(JSON.stringify({ standaloneOverlay: true, localizedPerspective: true, deduplicatedBadges: true }, null, 2));
