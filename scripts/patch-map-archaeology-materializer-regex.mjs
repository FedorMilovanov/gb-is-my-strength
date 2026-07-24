import fs from 'node:fs';

const file = 'scripts/materialize-map-archaeology-engine-p0.mjs';
let source = fs.readFileSync(file, 'utf8');
const replacements = [
  [
    'assert.match(bootstrap,/buildMapArchaeologyProjection\\(mapId/);',
    "assert.ok(bootstrap.includes('buildMapArchaeologyProjection(mapId'));",
  ],
  [
    'assert.doesNotMatch(bootstrap,/map-archaeology-adapter\\.js|set:html|fetch\\(/);',
    "assert.ok(!bootstrap.includes('map-archaeology-adapter.js'));assert.ok(!bootstrap.includes('set:html'));assert.ok(!bootstrap.includes('fetch('));",
  ],
  [
    'assert.match(fallback,/archaeologyMapId\\?: string/);',
    "assert.ok(fallback.includes('archaeologyMapId?: string'));",
  ],
  [
    'assert.match(fallback,/mapId=\\{archaeologyMapId\\}/);',
    "assert.ok(fallback.includes('mapId={archaeologyMapId}'));",
  ],
];
for (const [search, replacement] of replacements) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`expected one generated contract anchor, found ${count}: ${search}`);
  source = source.replace(search, replacement);
}
fs.writeFileSync(file, source);
console.log('PASS replaced fragile generated regex checks with exact string contracts');
