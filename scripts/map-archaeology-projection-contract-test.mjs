import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMapArchaeologyProjection } from '../src/lib/karty/map-archaeology-projection.mjs';

const registry = JSON.parse(fs.readFileSync('karty/_data/archaeology-source-registry.json', 'utf8'));
const provenance = JSON.parse(fs.readFileSync('karty/_data/archaeology-source-provenance.json', 'utf8'));
const projection = buildMapArchaeologyProjection('avraam', registry, provenance);

assert.deepEqual(projection.allowedTabs, ['arch', 'sci']);
assert.ok(Object.keys(projection.byPlace).length >= 7, 'expected governed Avraam place coverage');
assert.ok(projection.byPlace.ur?.some((card) => card.claimId === 'ur-ancient-city-context'));
assert.ok(projection.byPlace.hammam?.some((card) => card.status === 'rejected'));
assert.ok(!projection.byPlace.bethel?.some((card) => card.claimId === 'bethel-beitin-candidate'), 'candidate without high evidence must remain out of reader projection');

for (const cards of Object.values(projection.byPlace)) {
  for (const card of cards) {
    for (const id of card.evidenceSourceIds) {
      const meta = projection.sourceMeta[id];
      assert.ok(meta, `missing projected source metadata: ${id}`);
      assert.notEqual(meta.perspective, 'yec', `YEC source leaked into evidence layer: ${id}`);
      assert.ok(['high', 'supporting', 'negative'].includes(meta.evidenceUse));
      if (['accepted-context', 'primary-identification'].includes(card.status)) {
        assert.equal(meta.status, 'active');
        assert.equal(meta.verification, 'verified');
        assert.ok(['high', 'supporting'].includes(meta.evidenceUse));
      }
      if (meta.status === 'retracted') {
        assert.equal(meta.evidenceUse, 'negative');
        assert.equal(card.status, 'rejected');
      }
    }
    for (const id of card.interpretationSourceIds) {
      assert.equal(projection.sourceMeta[id].evidenceUse, 'interpretation');
    }
  }
}

const adapter = fs.readFileSync('karty/_engine/map-archaeology-adapter.js', 'utf8');
assert.match(adapter, /content\.querySelectorAll\('\.me-arch-footer'\)/);
assert.match(adapter, /allowedTabs\.has\(activeTab\)/);
assert.match(adapter, /data-source-id|dataset\.sourceId/);
assert.match(adapter, /dataset\.evidenceUse/);
assert.match(adapter, /dataset\.sourceStatus/);
assert.match(adapter, /dataset\.sourceVerification/);
assert.match(adapter, /dataset\.sourcePerspective/);
assert.match(adapter, /source: \$\{source\.id\}/);
assert.match(adapter, /source\.accessedAt/);
assert.match(adapter, /payload\.dataset\.projection/);
assert.match(adapter, /url\.protocol === 'https:'/);
assert.match(adapter, /textContent/);
assert.doesNotMatch(adapter, /innerHTML\s*=/);
assert.doesNotMatch(adapter, /_classifySource|keyword|regex/i);

const bootstrap = fs.readFileSync('src/components/karty/_shared/MapArchaeologyProjectionBootstrap.astro', 'utf8');
assert.match(bootstrap, /buildMapArchaeologyProjection\('avraam'/);
assert.match(bootstrap, /id="map-archaeology-projection"/);
assert.match(bootstrap, /data-projection=\{projectionJson\}/);
assert.match(bootstrap, /map-archaeology-adapter\.js/);
assert.doesNotMatch(bootstrap, /set:html|type="application\/json"|fetch\(/);

const fallback = fs.readFileSync('src/components/karty/_shared/MapRuntimeFallback.astro', 'utf8');
assert.match(fallback, /isAvraamRoute/);
assert.match(fallback, /MapArchaeologyProjectionBootstrap/);

console.log(JSON.stringify({
  mapId: projection.mapId,
  places: Object.keys(projection.byPlace).length,
  cards: Object.values(projection.byPlace).reduce((sum, cards) => sum + cards.length, 0),
  sources: Object.keys(projection.sourceMeta).length,
  allowedTabs: projection.allowedTabs,
}, null, 2));
