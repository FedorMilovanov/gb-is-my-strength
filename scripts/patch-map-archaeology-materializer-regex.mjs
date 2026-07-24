import fs from 'node:fs';

const file = 'scripts/materialize-map-archaeology-engine-p0.mjs';
const source = fs.readFileSync(file, 'utf8');
const search = 'assert.match(bootstrap,/buildMapArchaeologyProjection\\(mapId/);';
const replacement = 'assert.match(bootstrap,/buildMapArchaeologyProjection\\\\(mapId/);';
const count = source.split(search).length - 1;
if (count !== 1) throw new Error(`expected one projection regex anchor, found ${count}`);
fs.writeFileSync(file, source.replace(search, replacement));
console.log('PASS escaped buildMapArchaeologyProjection regex anchor');
