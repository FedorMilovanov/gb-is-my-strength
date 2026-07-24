import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const write = (file, content) => {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
};

function replaceOnce(file, source, search, replacement) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one exact anchor, found ${count}: ${search.slice(0, 100)}`);
  return source.replace(search, replacement);
}

function removeBalancedObject(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`map-engine: marker not found: ${marker}`);
  const brace = source.indexOf('{', start + marker.length);
  if (brace < 0) throw new Error('map-engine: archaeology object opening brace missing');
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (/\s/.test(source[end] || '')) end += 1;
        if (source[end] !== ';') throw new Error('map-engine: archaeology object semicolon missing');
        end += 1;
        while (source[end] === '\r' || source[end] === '\n') end += 1;
        return source.slice(0, start) + source.slice(end);
      }
    }
  }
  throw new Error('map-engine: archaeology object did not balance');
}

const builder = `const ACCEPTED_STATUSES = new Set(['accepted-context', 'primary-identification']);
const POSITIVE_EVIDENCE_USES = new Set(['high', 'supporting']);
const INTERPRETATION_USES = new Set(['interpretation']);
const NEGATIVE_EVIDENCE_USES = new Set(['negative']);
const unique = (values) => [...new Set((values || []).filter(Boolean))];

export function buildMapArchaeologyProjection(mapId, registry, provenance) {
  if (!mapId || typeof mapId !== 'string') throw new Error('mapId is required');
  if (!registry || !Array.isArray(registry.sources) || !Array.isArray(registry.claims)) {
    throw new Error('invalid archaeology source registry');
  }
  if (!provenance || !provenance.records || typeof provenance.records !== 'object') {
    throw new Error('invalid archaeology provenance registry');
  }

  const sources = new Map(registry.sources.map((source) => [source.id, source]));
  const sourceMeta = {};
  const byPlace = {};
  const mapCards = [];
  const categories = (registry.runtimeCategories || []).filter((category) =>
    Array.isArray(category.mapScopes) && category.mapScopes.includes(mapId));
  const categoryClaimIds = new Set(categories.flatMap((category) => category.claimIds || []));

  function exposeSource(id) {
    if (sourceMeta[id]) return sourceMeta[id];
    const source = sources.get(id);
    const record = provenance.records[id];
    if (!source || !record) throw new Error(\`missing source/provenance pair: \${id}\`);
    sourceMeta[id] = Object.freeze({
      id,
      title: source.title,
      organization: source.organization,
      url: record.canonicalUrl || source.url || '',
      year: record.publicationYear,
      accessedAt: record.accessedAt || source.accessedAt || source.verifiedAt || null,
      status: source.status,
      verification: source.verification,
      evidenceUse: record.evidenceUse,
      perspective: record.perspective,
      workType: record.workType,
      review: record.review,
    });
    return sourceMeta[id];
  }

  const claims = registry.claims.filter((claim) => claim.map === mapId || categoryClaimIds.has(claim.id));
  for (const claim of claims) {
    const evidenceIds = unique(claim.evidenceSources);
    const interpretationIds = unique(claim.interpretationSources);
    const accepted = ACCEPTED_STATUSES.has(claim.status);

    const governedEvidence = evidenceIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      if (!source || !record) return false;
      if (source.status === 'retracted') return !accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse);
      if (source.status !== 'active' || source.verification !== 'verified') return false;
      return POSITIVE_EVIDENCE_USES.has(record.evidenceUse)
        || (!accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse));
    });

    const governedInterpretation = interpretationIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      return Boolean(source && record && source.status === 'active' && INTERPRETATION_USES.has(record.evidenceUse));
    });

    if (accepted && governedEvidence.length === 0) continue;
    if (claim.status === 'candidate' && governedEvidence.length === 0) continue;
    if (claim.status === 'project-interpretation' && governedInterpretation.length === 0) continue;

    unique([...governedEvidence, ...governedInterpretation]).forEach(exposeSource);
    const card = Object.freeze({
      claimId: claim.id,
      category: claim.category || null,
      status: claim.status,
      statement: claim.statement,
      limitations: claim.limitations || '',
      topics: Object.freeze(unique(claim.topics)),
      evidenceSourceIds: Object.freeze(governedEvidence),
      interpretationSourceIds: Object.freeze(governedInterpretation),
    });

    const places = unique(claim.places);
    if (places.length === 0) mapCards.push(card);
    for (const placeId of places) {
      if (!byPlace[placeId]) byPlace[placeId] = [];
      byPlace[placeId].push(card);
    }
  }

  for (const placeId of Object.keys(byPlace)) Object.freeze(byPlace[placeId]);
  return Object.freeze({
    schemaVersion: '1.1.0',
    mapId,
    runtimeCategoryIds: Object.freeze(categories.map((category) => category.id)),
    allowedTabs: Object.freeze(['arch', 'sci']),
    mapCards: Object.freeze(mapCards),
    byPlace: Object.freeze(byPlace),
    sourceMeta: Object.freeze(sourceMeta),
  });
}
`;
write('src/lib/karty/map-archaeology-projection.mjs', builder);

const bootstrap = `---
import registry from '../../../../karty/_data/archaeology-source-registry.json';
import provenance from '../../../../karty/_data/archaeology-source-provenance.json';
import { buildMapArchaeologyProjection } from '@/lib/karty/map-archaeology-projection.mjs';

interface Props { mapId: string; }
const { mapId } = Astro.props;
const projection = buildMapArchaeologyProjection(mapId, registry, provenance);
const projectionJson = JSON.stringify(projection);
---

<div id="map-archaeology-projection" hidden data-map-id={mapId} data-projection={projectionJson}></div>
`;
write('src/components/karty/_shared/MapArchaeologyProjectionBootstrap.astro', bootstrap);

let fallback = read('src/components/karty/_shared/MapRuntimeFallback.astro');
fallback = replaceOnce('MapRuntimeFallback.astro', fallback,
`interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
const isAvraamRoute = Astro.url.pathname === '/karty/avraam/' || Astro.url.pathname === '/karty/avraam';`,
`interface Props {
  title: string;
  description: string;
  archaeologyMapId?: string;
}

const { title, description, archaeologyMapId } = Astro.props;`);
fallback = replaceOnce('MapRuntimeFallback.astro', fallback,
`{isAvraamRoute && <MapArchaeologyProjectionBootstrap />}`,
`{archaeologyMapId && <MapArchaeologyProjectionBootstrap mapId={archaeologyMapId} />}`);
write('src/components/karty/_shared/MapRuntimeFallback.astro', fallback);

function patchMapComponent(file, mapId, optionAnchor, optionReplacement) {
  let source = read(file);
  const descriptionLine = source.match(/description="[^"]+"\n\s*\/>/);
  if (!descriptionLine) throw new Error(`${file}: MapRuntimeFallback description anchor missing`);
  source = replaceOnce(file, source, descriptionLine[0], descriptionLine[0].replace('\n/>', `\n  archaeologyMapId="${mapId}"\n/>`).replace('\n  />', `\n  archaeologyMapId="${mapId}"\n/>`));
  source = replaceOnce(file, source,
`  function init() {`,
`  function readArchaeologyProjection() {
    var payload = document.getElementById('map-archaeology-projection');
    if (!payload) return null;
    try { return JSON.parse(payload.dataset.projection || 'null'); }
    catch (error) { console.error('[map-archaeology] invalid projection payload:', error); return null; }
  }

  function init() {`);
  source = replaceOnce(file, source, optionAnchor, optionReplacement);
  write(file, source);
}

patchMapComponent(
  'src/components/karty/ishod/IshodMap.astro',
  'ishod',
  `var inst = window.MapEngine.createMap(container, route, {});`,
  `var inst = window.MapEngine.createMap(container, route, { archaeologyProjection: readArchaeologyProjection() });`,
);
patchMapComponent(
  'src/components/karty/avraam/AvraamMap.astro',
  'avraam',
  `var inst = window.MapEngine.createMap(container, route, {
          baseGeoUrl: 'base.svg'
        });`,
  `var inst = window.MapEngine.createMap(container, route, {
          baseGeoUrl: 'base.svg',
          archaeologyProjection: readArchaeologyProjection()
        });`,
);

let engine = read('karty/_engine/map-engine.js');
if (!engine.includes("version:'0.55.0'")) throw new Error('map-engine: expected v0.55.0 base');
engine = removeBalancedObject(engine, '  const ARCHAEOLOGY_REFERENCES = ');
engine = replaceOnce('map-engine.js', engine,
` * map-engine.js v0.55 — reusable biblical map rendering engine. Authored route geometry + viewport-bound panels + signature controls.`,
` * map-engine.js v0.56 — reusable biblical map rendering engine. Provenance projection + authored route geometry + viewport-bound panels.`);
engine = replaceOnce('map-engine.js', engine,
`.me-sci-source{font-size:8px;color:rgba(232,200,121,.65);border:1px solid rgba(232,200,121,.16);border-radius:999px;padding:1px 6px;background:rgba(232,200,121,.04)}

/* Life timeline */`,
`.me-sci-source{font-size:8px;color:rgba(232,200,121,.65);border:1px solid rgba(232,200,121,.16);border-radius:999px;padding:1px 6px;background:rgba(232,200,121,.04)}

/* Governed archaeology projection */
.map-arch-projection{margin-top:18px;padding:14px 0 4px;border-top:1px solid rgba(232,200,121,.2)}
.map-arch-projection__eyebrow{display:flex;align-items:center;gap:7px;color:var(--me-accent,#e8c879);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.map-arch-projection__eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 10px rgba(232,200,121,.55)}
.map-arch-projection__title{margin:7px 0 2px;color:var(--me-text,#e9e4d6);font-family:Georgia,serif;font-size:16px}
.map-arch-projection__note{color:var(--me-muted,#9aa2ae);font-size:10px;line-height:1.5}
.map-arch-card{padding:12px 0;border-top:1px solid rgba(255,255,255,.07)}
.map-arch-card:first-of-type{margin-top:8px}
.map-arch-card__badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px}
.map-arch-badge{padding:2px 7px;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:var(--me-muted,#9aa2ae);font-size:8px;line-height:1.4}
.map-arch-badge--accepted-context,.map-arch-badge--primary-identification,.map-arch-badge--high,.map-arch-badge--supporting{border-color:rgba(74,222,128,.28);color:rgba(134,239,172,.92)}
.map-arch-badge--project-interpretation,.map-arch-badge--interpretation,.map-arch-badge--methodological-guardrail{border-color:rgba(232,200,121,.3);color:var(--me-accent,#e8c879)}
.map-arch-badge--candidate,.map-arch-badge--disputed{border-color:rgba(250,204,21,.3);color:rgba(253,224,71,.9)}
.map-arch-badge--rejected,.map-arch-badge--negative,.map-arch-badge--retracted{border-color:rgba(248,113,113,.3);color:rgba(252,165,165,.94)}
.map-arch-card__statement{color:var(--me-text,#e9e4d6);font-size:12px;line-height:1.55}
.map-arch-card__limitations{margin-top:6px;color:var(--me-muted,#9aa2ae);font-size:10px;line-height:1.5}
.map-arch-sources{display:grid;gap:7px;margin-top:9px}
.map-arch-source{display:block;padding-left:9px;border-left:2px solid rgba(232,200,121,.22)}
.map-arch-source__link{color:var(--me-accent,#e8c879);font-size:10px;line-height:1.4;text-decoration:none}
.map-arch-source__link:hover{text-decoration:underline}
.map-arch-source__meta{display:block;margin-top:2px;color:var(--me-muted,#9aa2ae);font-size:9px;line-height:1.4;overflow-wrap:anywhere}
.map-arch-source__id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:color-mix(in srgb,var(--me-muted,#9aa2ae) 80%,transparent)}

/* Life timeline */`);
engine = replaceOnce('map-engine.js', engine,
`        if(k==='arch')return!!place.arch;`,
`        if(k==='arch')return!!place.arch||_hasArchaeologyProjection(place.id);`);
engine = replaceOnce('map-engine.js', engine,
`      // Add archaeology reference footer for relevant places
      _renderArchaeologyFooter(place);`,
`      _renderArchaeologyProjection(tab, place);`);
const helperStart = engine.indexOf('    function _classifySource(item) {');
const helperEnd = engine.indexOf('    // ── Public API ──', helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error('map-engine: legacy archaeology helper block missing');
const directRenderer = `    const ARCHAEOLOGY_LABELS = Object.freeze({
      'accepted-context':'принятый контекст','primary-identification':'основная идентификация',
      'project-interpretation':'позиция проекта','methodological-guardrail':'методологическая оговорка',
      candidate:'кандидат',disputed:'дискуссионно',rejected:'отвергнуто',high:'сильная опора',
      supporting:'поддерживающая опора',interpretation:'интерпретация',negative:'отрицательное свидетельство',
      verified:'проверено',imported:'очередь проверки',active:'действующий источник',retracted:'отозвано'
    });

    function _archLabel(value){return ARCHAE0LOGY_LABELS_SAFE(value)}
    function ARCHAE0LOGY_LABELS_SAFE(value){return ARCHAE0LOGY_LABELS_SAFE.map?.get?.(value)||ARCHAEOLOGY_LABELS[value]||String(value||'неизвестно')}

    function _archSafeUrl(value){
      try{const url=new URL(String(value||''),location.href);return url.protocol==='https:'?url.href:''}catch(_){return''}
    }
    function _archText(tag,className,value){const node=document.createElement(tag);if(className)node.className=className;node.textContent=String(value||'');return node}
    function _archBadge(value){const normalized=String(value||'unknown').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();return _archText('span',\`map-arch-badge map-arch-badge--\${normalized}\`,ARCHAEOLOGY_LABELS[value]||String(value||'неизвестно'))}
    function _archSourceNode(source){
      const node=document.createElement('div');node.className='map-arch-source';
      node.dataset.sourceId=source.id;node.dataset.evidenceUse=source.evidenceUse;node.dataset.sourceStatus=source.status;
      node.dataset.sourceVerification=source.verification;node.dataset.sourcePerspective=source.perspective;
      const href=_archSafeUrl(source.url);
      if(href){const link=_archText('a','map-arch-source__link',source.title);link.href=href;link.target='_blank';link.rel='noopener noreferrer';node.appendChild(link)}
      else node.appendChild(_archText('span','map-arch-source__link',source.title));
      const details=[source.organization,Number.isInteger(source.year)?String(source.year):'',ARCHAEOLOGY_LABELS[source.evidenceUse]||source.evidenceUse,
        source.perspective==='yec'?'YEC-интерпретация':source.perspective,ARCHAEOLOGY_LABELS[source.status]||source.status,
        ARCHAEOLOGY_LABELS[source.verification]||source.verification,source.accessedAt?\`проверено \${source.accessedAt}\`:''].filter(Boolean).join(' · ');
      node.appendChild(_archText('span','map-arch-source__meta',details));
      node.appendChild(_archText('span','map-arch-source__meta map-arch-source__id',\`source: \${source.id}\`));
      return node;
    }
    function _archProjectionCards(placeId){
      const projection=cfg.archaeologyProjection;
      if(!projection||typeof projection!=='object')return[];
      const cards=[...(Array.isArray(projection.mapCards)?projection.mapCards:[]),...(Array.isArray(projection.byPlace?.[placeId])?projection.byPlace[placeId]:[])];
      const seen=new Set();return cards.filter(card=>card&&card.claimId&&!seen.has(card.claimId)&&seen.add(card.claimId));
    }
    function _hasArchaeologyProjection(placeId){return _archProjectionCards(placeId).length>0}
    function _archProjectionNode(placeId,cards,projection){
      const root=document.createElement('section');root.className='map-arch-projection';root.dataset.archaeologyProjectionRoot='1';
      root.dataset.placeId=placeId;root.dataset.projectionVersion=projection.schemaVersion||'1.0.0';
      root.appendChild(_archText('div','map-arch-projection__eyebrow','Проверенный аппарат источников'));
      root.appendChild(_archText('h3','map-arch-projection__title','Археология и исторический контекст'));
      root.appendChild(_archText('p','map-arch-projection__note','Материальные данные, академическая оценка и YEC-интерпретация показаны раздельно.'));
      cards.forEach(card=>{
        const article=document.createElement('article');article.className='map-arch-card';article.dataset.claimId=card.claimId;article.dataset.claimStatus=card.status;
        if(card.category)article.dataset.runtimeCategory=card.category;
        const badges=document.createElement('div');badges.className='map-arch-card__badges';badges.appendChild(_archBadge(card.status));article.appendChild(badges);
        article.appendChild(_archText('div','map-arch-card__statement',card.statement));
        if(card.limitations)article.appendChild(_archText('div','map-arch-card__limitations',\`Ограничение: \${card.limitations}\`));
        const ids=[...new Set([...(card.evidenceSourceIds||[]),...(card.interpretationSourceIds||[])])];
        if(ids.length){const sources=document.createElement('div');sources.className='map-arch-sources';ids.forEach(id=>{const source=projection.sourceMeta?.[id];if(!source)return;badges.appendChild(_archBadge(source.evidenceUse));sources.appendChild(_archSourceNode(source))});article.appendChild(sources)}
        root.appendChild(article);
      });
      return root;
    }
    function _renderArchaeologyProjection(tab,place){
      const projection=cfg.archaeologyProjection;const content=panel.querySelector('.me-content');if(!content)return;
      content.querySelectorAll('[data-archaeology-projection-root]').forEach(node=>node.remove());
      if(!projection||typeof projection!=='object')return;
      const allowed=Array.isArray(projection.allowedTabs)?projection.allowedTabs:['arch','sci'];if(!allowed.includes(tab))return;
      const cards=_archProjectionCards(place.id);if(!cards.length)return;
      content.appendChild(_archProjectionNode(place.id,cards,projection));
    }

`;
// Remove an accidental helper-name indirection before writing the engine.
const cleanRenderer = directRenderer
  .replace("    function _archLabel(value){return ARCHAE0LOGY_LABELS_SAFE(value)}\n    function ARCHAE0LOGY_LABELS_SAFE(value){return ARCHAE0LOGY_LABELS_SAFE.map?.get?.(value)||ARCHAEOLOGY_LABELS[value]||String(value||'неизвестно')}\n\n", '');
engine = engine.slice(0, helperStart) + cleanRenderer + engine.slice(helperEnd);
engine = replaceOnce('map-engine.js', engine,
`    version:'0.55.0',buildDate:'2026-07-24'`,
`    version:'0.56.0',buildDate:'2026-07-25'`);
if (/ARCHAEOLOGY_REFERENCES|_classifySource|_sourceBadges|_renderArchaeologyFooter/.test(engine)) {
  throw new Error('map-engine: legacy archaeology symbols remain');
}
write('karty/_engine/map-engine.js', engine);

const contract = `import fs from 'node:fs';
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
  assert.ok(projection.runtimeCategoryIds.length>=1,\`\${mapId}: missing runtime category IDs\`);
  assert.ok(projection.mapCards.length>=1,\`\${mapId}: missing governed map-level cards\`);
  for(const card of projection.mapCards){
    assert.ok(card.category,\`\${mapId}/\${card.claimId}: missing category\`);
    assert.ok(card.evidenceSourceIds.length>=1,\`\${mapId}/\${card.claimId}: missing governed evidence\`);
  }
}
for(const projection of [avraam,...runtimeScopes.map(id=>buildMapArchaeologyProjection(id,registry,provenance))]){
  for(const cards of [...Object.values(projection.byPlace),projection.mapCards])for(const card of cards){
    for(const id of card.evidenceSourceIds){const meta=projection.sourceMeta[id];assert.ok(meta);assert.notEqual(meta.perspective,'yec');assert.ok(['high','supporting','negative'].includes(meta.evidenceUse));if(meta.status==='retracted'){assert.equal(meta.evidenceUse,'negative');assert.equal(card.status,'rejected')}}
    for(const id of card.interpretationSourceIds)assert.equal(projection.sourceMeta[id].evidenceUse,'interpretation');
  }
}

const engine=fs.readFileSync('karty/_engine/map-engine.js','utf8');
assert.match(engine,/cfg\.archaeologyProjection/);
assert.match(engine,/dataSourceId|dataset\.sourceId/);
assert.match(engine,/dataset\.evidenceUse/);
assert.match(engine,/dataset\.sourceStatus/);
assert.match(engine,/dataset\.sourceVerification/);
assert.match(engine,/dataset\.sourcePerspective/);
assert.match(engine,/url\.protocol==='https:'/);
assert.match(engine,/textContent/);
assert.match(engine,/version:'0\.56\.0'/);
assert.doesNotMatch(engine,/ARCHAEOLOGY_REFERENCES|_classifySource|_sourceBadges|_renderArchaeologyFooter/);
assert.equal(fs.existsSync('karty/_engine/map-archaeology-adapter.js'),false,'transition adapter must be retired');

const bootstrap=fs.readFileSync('src/components/karty/_shared/MapArchaeologyProjectionBootstrap.astro','utf8');
assert.match(bootstrap,/interface Props \{ mapId: string; \}/);
assert.match(bootstrap,/buildMapArchaeologyProjection\(mapId/);
assert.match(bootstrap,/data-projection=\{projectionJson\}/);
assert.doesNotMatch(bootstrap,/map-archaeology-adapter\.js|set:html|fetch\(/);
const fallback=fs.readFileSync('src/components/karty/_shared/MapRuntimeFallback.astro','utf8');
assert.match(fallback,/archaeologyMapId\?: string/);
assert.match(fallback,/mapId=\{archaeologyMapId\}/);
for(const [file,mapId] of [['src/components/karty/ishod/IshodMap.astro','ishod'],['src/components/karty/avraam/AvraamMap.astro','avraam']]){
  const source=fs.readFileSync(file,'utf8');assert.match(source,new RegExp(\`archaeologyMapId=\\"\${mapId}\\"\`));assert.match(source,/archaeologyProjection: readArchaeologyProjection\(\)/);
}
console.log(JSON.stringify({avraamPlaces:Object.keys(avraam.byPlace).length,runtimeScopes:runtimeScopes.length,runtimeCards:runtimeScopes.reduce((sum,id)=>sum+buildMapArchaeologyProjection(id,registry,provenance).mapCards.length,0),sources:Object.keys(avraam.sourceMeta).length},null,2));
`;
write('scripts/map-archaeology-projection-contract-test.mjs', contract);

const browser = `import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
const browserName=process.env.MAP_ARCHAEOLOGY_BROWSER||'chromium';const browserType={chromium,firefox,webkit}[browserName];if(!browserType)throw new Error(\`unsupported browser \${browserName}\`);
const engine=fs.readFileSync('karty/_engine/map-engine.js','utf8');
const route={meta:{id:'projection-test',title:'Projection test',viewport_init:{cx:500,cy:400,w:900}},stages:[{n:'I',t:'Test',ids:['ur','hammam']}],stories:[{id:'main',label:'Main',place_ids:['ur','hammam'],stage_ids:[0],active_by_default:true}],places:[{id:'ur',name:'Ur',x:420,y:400,stage:0,story:'Story Ur',arch:'<p>Legacy arch body</p>',bible:'Bible'},{id:'hammam',name:'Hammam',x:580,y:400,stage:0,story:'Story Hammam',arch:'<p>Legacy arch body</p>',bible:'Bible'}],scientific_variants:{ur:[{status:'consensus',title:'Ur variant'}],hammam:[{status:'rejected',title:'Hammam variant'}]}};
const projection={schemaVersion:'1.1.0',mapId:'test',runtimeCategoryIds:['exodus_route'],allowedTabs:['arch','sci'],mapCards:[{claimId:'map-context',category:'exodus_route',status:'accepted-context',statement:'Governed map context.',limitations:'Context does not prove every event.',evidenceSourceIds:['field-source'],interpretationSourceIds:[]}],byPlace:{ur:[{claimId:'ur-context',category:null,status:'accepted-context',statement:'Ur context.',limitations:'No personal artefact.',evidenceSourceIds:['field-source'],interpretationSourceIds:['yec-source']}],hammam:[{claimId:'retracted-context',category:null,status:'rejected',statement:'Retracted claim rejected.',limitations:'Negative evidence only.',evidenceSourceIds:['retracted-source'],interpretationSourceIds:[]}]},sourceMeta:{'field-source':{id:'field-source',title:'Excavation report',organization:'Museum',url:'https://example.test/report',year:2025,accessedAt:'2026-07-24',status:'active',verification:'verified',evidenceUse:'high',perspective:'general'},'yec-source':{id:'yec-source',title:'YEC analysis',organization:'Journal',url:'https://example.test/interpretation',year:2012,accessedAt:'2026-07-24',status:'active',verification:'verified',evidenceUse:'interpretation',perspective:'yec'},'retracted-source':{id:'retracted-source',title:'Retraction notice',organization:'Journal',url:'javascript:alert(1)',year:2025,accessedAt:'2026-07-24',status:'retracted',verification:'verified',evidenceUse:'negative',perspective:'general'}}};
const launched=await browserType.launch({headless:true});const page=await launched.newPage({viewport:{width:390,height:844}});const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
await page.route('https://example.test/**',routeRequest=>routeRequest.fulfill({status:200,contentType:'text/html',body:\`<!doctype html><html><body><div id="stage" style="width:100vw;height:100vh"></div><script>\${engine}<\\/script><script>window.projectionTest=MapEngine.createMap(document.getElementById('stage'),\${JSON.stringify(route)},{showIntro:false,archaeologyProjection:\${JSON.stringify(projection)}});window.projectionTest.open('ur');<\\/script></body></html>\`}));
await page.goto('https://example.test/karty/test/?place=ur');await page.waitForSelector('.me-panel--open');
assert.equal(await page.locator('[data-archaeology-projection-root]').count(),0,'story tab must not render archaeology');
await page.locator('[data-tab="arch"]').click();await page.waitForSelector('[data-claim-id="ur-context"]');
assert.equal(await page.locator('[data-claim-id="map-context"]').count(),1);assert.equal(await page.locator('[data-runtime-category="exodus_route"]').count(),1);
assert.equal(await page.locator('[data-source-id="field-source"][data-evidence-use="high"][data-source-verification="verified"]').count(),2);
assert.equal(await page.locator('[data-source-id="yec-source"][data-source-perspective="yec"]').count(),1);assert.equal(await page.locator('[data-source-id="field-source"] a').first().getAttribute('href'),'https://example.test/report');
await page.locator('[data-tab="story"]').click();await page.waitForFunction(()=>!document.querySelector('[data-archaeology-projection-root]'));
await page.evaluate(()=>window.projectionTest.open('hammam'));await page.locator('[data-tab="arch"]').click();await page.waitForSelector('[data-claim-id="retracted-context"]');
assert.equal(await page.locator('[data-source-id="retracted-source"] a').count(),0);assert.equal(await page.locator('[data-source-id="retracted-source"][data-evidence-use="negative"][data-source-status="retracted"]').count(),1);
assert.equal(await page.locator('.me-arch-footer').count(),0);assert.deepEqual(errors,[]);await launched.close();console.log(JSON.stringify({browser:browserName,directEngine:true,mapCards:true,placeCards:true,legacyFooters:0,errors:0},null,2));
`;
write('scripts/map-archaeology-projection-browser-test.mjs', browser);

const workflow = `name: Map Archaeology Projection

on:
  pull_request:
    branches: [main]
    paths:
      - 'karty/_data/archaeology-source-registry.json'
      - 'karty/_data/archaeology-source-provenance.json'
      - 'karty/_engine/map-engine.js'
      - 'src/components/karty/_shared/MapArchaeologyProjectionBootstrap.astro'
      - 'src/components/karty/_shared/MapRuntimeFallback.astro'
      - 'src/components/karty/ishod/IshodMap.astro'
      - 'src/components/karty/avraam/AvraamMap.astro'
      - 'src/lib/karty/map-archaeology-projection.mjs'
      - 'scripts/map-archaeology-projection-contract-test.mjs'
      - 'scripts/map-archaeology-projection-browser-test.mjs'
      - '.github/workflows/map-archaeology-projection.yml'
  push:
    branches: [main]
    paths:
      - 'karty/_data/archaeology-source-registry.json'
      - 'karty/_data/archaeology-source-provenance.json'
      - 'karty/_engine/map-engine.js'
      - 'src/components/karty/_shared/MapArchaeologyProjectionBootstrap.astro'
      - 'src/components/karty/_shared/MapRuntimeFallback.astro'
      - 'src/components/karty/ishod/IshodMap.astro'
      - 'src/components/karty/avraam/AvraamMap.astro'
      - 'src/lib/karty/map-archaeology-projection.mjs'
      - 'scripts/map-archaeology-projection-contract-test.mjs'
      - 'scripts/map-archaeology-projection-browser-test.mjs'
      - '.github/workflows/map-archaeology-projection.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: map-archaeology-projection-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  contract:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout exact head
        uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
      - name: Set up Node 22.12
        uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
      - name: Validate direct engine projection contract
        run: |
          node --check karty/_engine/map-engine.js
          node --check src/lib/karty/map-archaeology-projection.mjs
          node --check scripts/map-archaeology-projection-contract-test.mjs
          node --check scripts/map-archaeology-projection-browser-test.mjs
          node scripts/map-archaeology-source-registry-audit.js
          node scripts/map-archaeology-category-coverage-audit.js
          node scripts/map-archaeology-projection-contract-test.mjs
      - name: Lint workflow
        run: node scripts/run-actionlint.mjs -no-color .github/workflows/map-archaeology-projection.yml
      - name: Ensure proof is read-only
        run: git diff --exit-code

  browser:
    name: Direct projection lifecycle (\${{ matrix.browser }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, webkit, firefox]
    steps:
      - name: Checkout exact head
        uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
      - name: Set up Node 22.12
        uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: npm
      - run: npm ci
      - name: Install browser
        run: npx playwright install --with-deps \${{ matrix.browser }}
      - name: Exercise direct engine tab and source lifecycle
        env:
          MAP_ARCHAEOLOGY_BROWSER: \${{ matrix.browser }}
        run: node scripts/map-archaeology-projection-browser-test.mjs
      - name: Ensure browser proof is read-only
        run: git diff --exit-code
`;
write('.github/workflows/map-archaeology-projection.yml', workflow);

if (fs.existsSync(path.join(ROOT, 'karty/_engine/map-archaeology-adapter.js'))) {
  fs.rmSync(path.join(ROOT, 'karty/_engine/map-archaeology-adapter.js'));
}

console.log(JSON.stringify({
  engineVersion:'0.56.0',
  directProjection:true,
  runtimeCategories:true,
  retired:['ARCHAEOLOGY_REFERENCES','_classifySource','map-archaeology-adapter.js'],
}, null, 2));
