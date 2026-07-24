import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMapArchaeologyProjection } from '../src/lib/karty/map-archaeology-projection.mjs';

const registry=JSON.parse(fs.readFileSync('karty/_data/archaeology-source-registry.json','utf8'));
const provenance=JSON.parse(fs.readFileSync('karty/_data/archaeology-source-provenance.json','utf8'));
const avraam=buildMapArchaeologyProjection('avraam',registry,provenance);
assert.deepEqual(avraam.allowedTabs,['arch','sci']);
assert.ok(Object.keys(avraam.byPlace).length>=7,'expected governed Avraam place coverage');
assert.ok(avraam.byPlace.ur?.some(card=>card.claimId==='ur-ancient-city-context'));
assert.ok(avraam.byPlace.hammam?.some(card=>card.status==='rejected'));
assert.ok(!avraam.byPlace.bethel?.some(card=>card.claimId==='bethel-beitin-candidate'));

const runtimeScopes=[...new Set((registry.runtimeCategories||[]).flatMap(category=>category.mapScopes||[]))];
for(const mapId of runtimeScopes){
  const projection=buildMapArchaeologyProjection(mapId,registry,provenance);
  assert.ok(projection.runtimeCategoryIds.length>=1,`${mapId}: missing runtime category IDs`);
  assert.ok(projection.mapCards.length>=1,`${mapId}: missing governed map-level cards`);
  for(const card of projection.mapCards){
    assert.ok(card.category,`${mapId}/${card.claimId}: missing category`);
    assert.ok(card.evidenceSourceIds.length>=1,`${mapId}/${card.claimId}: missing governed evidence`);
  }
}
for(const projection of [avraam,...runtimeScopes.map(id=>buildMapArchaeologyProjection(id,registry,provenance))]){
  for(const cards of [...Object.values(projection.byPlace),projection.mapCards])for(const card of cards){
    for(const id of card.evidenceSourceIds){const meta=projection.sourceMeta[id];assert.ok(meta);assert.notEqual(meta.perspective,'yec');assert.ok(['high','supporting','negative'].includes(meta.evidenceUse));if(meta.status==='retracted'){assert.equal(meta.evidenceUse,'negative');assert.equal(card.status,'rejected')}}
    for(const id of card.interpretationSourceIds)assert.equal(projection.sourceMeta[id].evidenceUse,'interpretation');
  }
}

const engine=fs.readFileSync('karty/_engine/map-engine.js','utf8');
assert.match(engine,/cfg.archaeologyProjection/);
assert.match(engine,/dataSourceId|dataset.sourceId/);
assert.match(engine,/dataset.evidenceUse/);
assert.match(engine,/dataset.sourceStatus/);
assert.match(engine,/dataset.sourceVerification/);
assert.match(engine,/dataset.sourcePerspective/);
assert.match(engine,/url.protocol==='https:'/);
assert.match(engine,/textContent/);
assert.match(engine,/version:'0.56.0'/);
assert.ok(engine.includes('const fallbackOverlayStates = new Map()'));
assert.ok(engine.includes("element.removeAttribute('inert')"));
assert.ok(engine.includes("overlayState.element.setAttribute('inert', '')"));
assert.ok(engine.includes('const badgeUses=new Set()'));
assert.ok(engine.includes("general:'академическая рамка'"));
assert.doesNotMatch(engine,/ARCHAEOLOGY_REFERENCES|_classifySource|_sourceBadges|_renderArchaeologyFooter/);
assert.equal(fs.existsSync('karty/_engine/map-archaeology-adapter.js'),false,'transition adapter must be retired');

const bootstrap=fs.readFileSync('src/components/karty/_shared/MapArchaeologyProjectionBootstrap.astro','utf8');
assert.match(bootstrap,/interface Props { mapId: string; }/);
assert.ok(bootstrap.includes('buildMapArchaeologyProjection(mapId'));
assert.match(bootstrap,/data-projection={projectionJson}/);
assert.ok(!bootstrap.includes('map-archaeology-adapter.js'));assert.ok(!bootstrap.includes('set:html'));assert.ok(!bootstrap.includes('fetch('));
const fallback=fs.readFileSync('src/components/karty/_shared/MapRuntimeFallback.astro','utf8');
assert.ok(fallback.includes('archaeologyMapId?: string'));
assert.ok(fallback.includes('mapId={archaeologyMapId}'));
for(const [file,mapId] of [['src/components/karty/ishod/IshodMap.astro','ishod'],['src/components/karty/avraam/AvraamMap.astro','avraam']]){
  const source=fs.readFileSync(file,'utf8');assert.match(source,new RegExp(`archaeologyMapId=\"${mapId}\"`));assert.match(source,/archaeologyProjection: readArchaeologyProjection()/);
}
console.log(JSON.stringify({avraamPlaces:Object.keys(avraam.byPlace).length,runtimeScopes:runtimeScopes.length,runtimeCards:runtimeScopes.reduce((sum,id)=>sum+buildMapArchaeologyProjection(id,registry,provenance).mapCards.length,0),sources:Object.keys(avraam.sourceMeta).length},null,2));
