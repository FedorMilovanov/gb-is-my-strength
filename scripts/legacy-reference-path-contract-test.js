#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  MANIFEST_REL,
  listReferenceRoutes,
  normalizeRepositoryPath,
  normalizeRoute,
  resolveReferenceForRoute,
  resolveReferencePath,
} = require('../migration/legacy-reference-path');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_REL), 'utf8'));

assert.equal(manifest.policy?.explicitReferenceApi, 'migration/legacy-reference-path.js');
assert.equal(manifest.policy?.explicitReferenceApiContract, 'scripts/legacy-reference-path-contract-test.js');
assert.deepEqual(manifest.policy?.explicitReferenceApiUsers, ['scripts/astro-ishod-pilot-audit.js']);

const routes = listReferenceRoutes();
assert.equal(routes.length, 52, 'resolver must expose all ledger-owned routes');
assert.equal(new Set(routes).size, routes.length, 'resolver routes must be unique');
assert.ok(routes.includes('/karty/ishod/'), 'Ishod route must remain ledger-owned');

const ishod = resolveReferenceForRoute('/karty/ishod/');
assert.equal(ishod.repositoryPath, 'karty/ishod/index.html');
assert.equal(ishod.route, '/karty/ishod/');
assert.equal(path.relative(ROOT, ishod.absolutePath).replaceAll(path.sep, '/'), ishod.repositoryPath);
assert.ok(ishod.exists && fs.statSync(ishod.absolutePath).isFile(), 'Ishod reference must resolve to a regular file');
assert.equal(resolveReferenceForRoute('karty/ishod').absolutePath, ishod.absolutePath, 'route normalization must be stable');
assert.equal(resolveReferencePath('karty/ishod/index.html').absolutePath, ishod.absolutePath, 'path lookup must match route lookup');

const home = resolveReferenceForRoute('/');
assert.equal(home.repositoryPath, 'index.html');
assert.equal(normalizeRoute('/karty/ishod'), '/karty/ishod/');
assert.equal(normalizeRepositoryPath('./karty/ishod/index.html'), 'karty/ishod/index.html');

const rejected = [
  () => resolveReferenceForRoute('https://gospod-bog.ru/karty/ishod/'),
  () => resolveReferenceForRoute('///karty/ishod///'),
  () => resolveReferenceForRoute('/missing-ledger-route/'),
  () => resolveReferenceForRoute('/karty/../ishod/'),
  () => resolveReferencePath('../package.json'),
  () => resolveReferencePath('/etc/passwd'),
  () => resolveReferencePath('dist/karty/ishod/index.html'),
  () => resolveReferencePath('public/karty/ishod/index.html'),
  () => resolveReferencePath('package.json'),
];
for (const attempt of rejected) assert.throws(attempt);

console.log(`✅ Explicit legacy reference-path contract: ${routes.length} routes; ${rejected.length} adversarial resolutions rejected`);
