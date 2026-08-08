#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MANIFEST_REL,
  REFERENCE_STORAGE_ROOT_REL,
  listReferenceRoutes,
  normalizeRepositoryPath,
  normalizeRoute,
  referenceStorageCandidates,
  resolveLogicalReferenceStorage,
  resolveReferenceForRoute,
  resolveReferencePath,
} = require('../migration/legacy-reference-path');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_REL), 'utf8'));

assert.equal(manifest.policy?.explicitReferenceApi, 'migration/legacy-reference-path.js');
assert.equal(manifest.policy?.explicitReferenceApiContract, 'scripts/legacy-reference-path-contract-test.js');
assert.deepEqual(
  [...(manifest.policy?.explicitReferenceApiUsers || [])].sort(),
  [
    'scripts/astro-ishod-pilot-audit.js',
    'scripts/content-source-provenance-audit.js',
    'scripts/lib/legacy-source-authority.js',
  ].sort(),
  'explicit reference API users must match the migrated physical-reference readers'
);

const routes = listReferenceRoutes();
assert.equal(routes.length, manifest.summary?.references, 'resolver must expose all ledger-owned routes');
assert.equal(new Set(routes).size, routes.length, 'resolver routes must be unique');
assert.ok(routes.includes('/karty/ishod/'), 'Ishod route must remain ledger-owned');

const ishod = resolveReferenceForRoute('/karty/ishod/');
assert.equal(ishod.logicalPath, 'karty/ishod/index.html');
assert.equal(ishod.repositoryPath, 'karty/ishod/index.html');
assert.equal(ishod.route, '/karty/ishod/');
assert.equal(path.relative(ROOT, ishod.absolutePath).replaceAll(path.sep, '/'), ishod.repositoryPath);
assert.ok(ishod.exists && fs.statSync(ishod.absolutePath).isFile(), 'Ishod reference must resolve to a regular file');
assert.equal(resolveReferenceForRoute('karty/ishod').absolutePath, ishod.absolutePath, 'route normalization must be stable');
assert.equal(resolveReferencePath('karty/ishod/index.html').absolutePath, ishod.absolutePath, 'logical path lookup must match route lookup');

const home = resolveReferenceForRoute('/');
assert.equal(home.logicalPath, 'index.html');
assert.equal(home.repositoryPath, 'index.html');
assert.equal(normalizeRoute('/karty/ishod'), '/karty/ishod/');
assert.equal(normalizeRepositoryPath('./karty/ishod/index.html'), 'karty/ishod/index.html');
assert.deepEqual(
  referenceStorageCandidates('karty/ishod/index.html'),
  ['karty/ishod/index.html', `${REFERENCE_STORAGE_ROOT_REL}/karty/ishod/index.html`],
  'storage candidates must preserve immutable logical identity while allowing quarantine storage'
);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-reference-path-'));
try {
  const logical = 'articles/example/index.html';
  const quarantined = `${REFERENCE_STORAGE_ROOT_REL}/${logical}`;
  fs.mkdirSync(path.dirname(path.join(tempRoot, quarantined)), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, quarantined), '<!doctype html><title>reference</title>');

  const moved = resolveLogicalReferenceStorage(logical, { root: tempRoot });
  assert.equal(moved.repositoryPath, quarantined, 'quarantined reference must resolve without rewriting ledger identity');
  assert.equal(moved.exists, true);

  fs.mkdirSync(path.dirname(path.join(tempRoot, logical)), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, logical), '<!doctype html><title>duplicate</title>');
  assert.throws(
    () => resolveLogicalReferenceStorage(logical, { root: tempRoot }),
    /storage is ambiguous/,
    'duplicate active + quarantined storage must fail closed'
  );

  fs.rmSync(path.join(tempRoot, logical));
  fs.rmSync(path.join(tempRoot, quarantined));
  const absent = resolveLogicalReferenceStorage(logical, { root: tempRoot, mustExist: false });
  assert.equal(absent.repositoryPath, logical, 'non-existing planning lookup keeps the immutable logical location');
  assert.equal(absent.exists, false);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

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

console.log(`✅ Explicit legacy reference-path contract: ${routes.length} routes; quarantine fallback + ambiguity fail-closed; ${rejected.length} adversarial resolutions rejected`);
