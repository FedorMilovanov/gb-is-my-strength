#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { spawnSync } = require('child_process');
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
const { discoverRoutes: discoverWrapperRoutes } = require('./legacy-shadow-wrapper-audit.js');
const { legacyReferenceStorageExists } = require('./lib/route-source-contract.js');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_REL), 'utf8'));

function runRepoScript(relativePath, args = []) {
  const result = spawnSync(process.execPath, [path.join(ROOT, relativePath), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {
    ...result,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

assert.equal(manifest.policy?.explicitReferenceApi, 'migration/legacy-reference-path.js');
assert.equal(manifest.policy?.explicitReferenceApiContract, 'scripts/legacy-reference-path-contract-test.js');
assert.deepEqual(
  [...(manifest.policy?.explicitReferenceApiUsers || [])].sort(),
  [
    'scripts/astro-ishod-pilot-audit.js',
    'scripts/content-source-provenance-audit.js',
    'scripts/legacy-shadow-retirement-readiness.mjs',
    'scripts/legacy-shadow-wrapper-audit.js',
    'scripts/lib/audit-pro-source-corpus.js',
    'scripts/lib/legacy-source-authority.js',
    'scripts/lib/route-source-contract.js',
    'scripts/nagornaya-visual-parity-audit.js',
    'scripts/visual-parity-contract.js',
  ].sort(),
  'explicit reference API users must match the migrated physical-reference readers'
);
const readinessDependency = (manifest.dependencies || []).find((row) => row.path === 'scripts/legacy-shadow-retirement-readiness.mjs');
assert.deepEqual(
  readinessDependency && {
    access: readinessDependency.access,
    classification: readinessDependency.classification,
    quarantineImpact: readinessDependency.quarantineImpact,
    evidenceToken: readinessDependency.evidenceToken,
  },
  {
    access: 'policy-reader',
    classification: 'migration-reference-only',
    quarantineImpact: 'none-fixture-policy-or-comment-only',
    evidenceToken: 'resolveLogicalReferenceStorage',
  },
  'retirement readiness must be an explicit nonblocking resolver-backed policy reader'
);
const wrapperDependency = (manifest.dependencies || []).find((row) => row.path === 'scripts/legacy-shadow-wrapper-audit.js');
assert.deepEqual(
  wrapperDependency && {
    access: wrapperDependency.access,
    classification: wrapperDependency.classification,
    quarantineImpact: wrapperDependency.quarantineImpact,
    evidenceToken: wrapperDependency.evidenceToken,
  },
  {
    access: 'policy-reader',
    classification: 'migration-reference-only',
    quarantineImpact: 'none-fixture-policy-or-comment-only',
    evidenceToken: 'resolveReferenceForRoute',
  },
  'legacy shadow wrapper audit must be an explicit nonblocking resolver-backed policy reader'
);
const routeSourceDependency = (manifest.dependencies || []).find((row) => row.path === 'scripts/lib/route-source-contract.js');
assert.deepEqual(
  routeSourceDependency && {
    access: routeSourceDependency.access,
    classification: routeSourceDependency.classification,
    quarantineImpact: routeSourceDependency.quarantineImpact,
    evidenceToken: routeSourceDependency.evidenceToken,
  },
  {
    access: 'policy-reader',
    classification: 'migration-reference-only',
    quarantineImpact: 'none-fixture-policy-or-comment-only',
    evidenceToken: 'resolveLogicalReferenceStorage',
  },
  'route source contract must be an explicit nonblocking resolver-backed policy reader'
);
const nagornayaVisualDependency = (manifest.dependencies || []).find((row) => row.path === 'scripts/nagornaya-visual-parity-audit.js');
assert.deepEqual(
  nagornayaVisualDependency && {
    access: nagornayaVisualDependency.access,
    classification: nagornayaVisualDependency.classification,
    quarantineImpact: nagornayaVisualDependency.quarantineImpact,
    evidenceToken: nagornayaVisualDependency.evidenceToken,
  },
  {
    access: 'policy-reader',
    classification: 'migration-reference-only',
    quarantineImpact: 'none-fixture-policy-or-comment-only',
    evidenceToken: 'resolveReferenceForRoute',
  },
  'Nagornaya visual audit must be an explicit nonblocking resolver-backed policy reader'
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
  assert.equal(
    legacyReferenceStorageExists(logical, { root: tempRoot }),
    true,
    'route source contract must accept a quarantine-only retained reference'
  );

  fs.mkdirSync(path.dirname(path.join(tempRoot, logical)), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, logical), '<!doctype html><title>duplicate</title>');
  assert.throws(
    () => resolveLogicalReferenceStorage(logical, { root: tempRoot }),
    /storage is ambiguous/,
    'duplicate active + quarantined storage must fail closed'
  );
  assert.throws(
    () => legacyReferenceStorageExists(logical, { root: tempRoot }),
    /storage is ambiguous/,
    'route source contract must inherit active + quarantine ambiguity rejection'
  );

  fs.rmSync(path.join(tempRoot, logical));
  fs.rmSync(path.join(tempRoot, quarantined));
  const absent = resolveLogicalReferenceStorage(logical, { root: tempRoot, mustExist: false });
  assert.equal(absent.repositoryPath, logical, 'non-existing planning lookup keeps the immutable logical location');
  assert.equal(absent.exists, false);
  assert.equal(
    legacyReferenceStorageExists(logical, { root: tempRoot }),
    false,
    'route source contract must still reject a missing retained reference'
  );

  const ownershipPath = path.join(tempRoot, 'migration', 'page-ownership.json');
  fs.mkdirSync(path.dirname(ownershipPath), { recursive: true });
  fs.writeFileSync(ownershipPath, JSON.stringify({
    routes: {
      '/karty/ishod/': { owner: 'astro', status: 'production-dist' },
      '/not-ledger-owned/': { owner: 'astro', status: 'production-dist' },
    },
  }, null, 2));
  const wrapperQuarantined = `${REFERENCE_STORAGE_ROOT_REL}/${ishod.logicalPath}`;
  fs.mkdirSync(path.dirname(path.join(tempRoot, wrapperQuarantined)), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, wrapperQuarantined), '<!doctype html><title>Ishod retained reference</title>');

  assert.equal(
    fs.existsSync(path.join(tempRoot, ishod.logicalPath)),
    false,
    'wrapper fixture must keep the active-root Ishod reference absent'
  );
  const wrapperRoutes = discoverWrapperRoutes({ root: tempRoot, routeOverrides: {} });
  assert.equal(wrapperRoutes.length, 1, 'wrapper discovery must use ledger membership rather than active-root file existence');
  assert.equal(wrapperRoutes[0].route, '/karty/ishod/');
  assert.equal(wrapperRoutes[0].rel, 'karty/ishod/index.html');
  assert.equal(wrapperRoutes[0].logicalPath, ishod.logicalPath);
  assert.equal(wrapperRoutes[0].storagePath, wrapperQuarantined);
  assert.equal(wrapperRoutes[0].legacyAbsolutePath, path.join(tempRoot, wrapperQuarantined));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

// End-to-end post-zero dry-run: the canonical inventory/source/readiness chain
// must survive one real ledger-owned reference existing only in quarantine,
// while duplicate and missing physical storage remain fail-closed. Restore the
// checkout byte-for-byte regardless of assertion outcome so later Shared steps
// never inherit the mutation.
const inventoryProbe = resolveReferenceForRoute('/articles/kod-da-vinchi/');
const activeProbePath = path.join(ROOT, inventoryProbe.logicalPath);
const quarantineProbePath = path.join(ROOT, REFERENCE_STORAGE_ROOT_REL, inventoryProbe.logicalPath);
const originalActive = fs.existsSync(activeProbePath) ? fs.readFileSync(activeProbePath) : null;
const originalQuarantine = fs.existsSync(quarantineProbePath) ? fs.readFileSync(quarantineProbePath) : null;
assert.notEqual(
  Boolean(originalActive),
  Boolean(originalQuarantine),
  'inventory storage dry-run requires exactly one canonical physical copy before mutation'
);
const originalBytes = originalActive || originalQuarantine;

try {
  fs.rmSync(activeProbePath, { force: true });
  fs.rmSync(quarantineProbePath, { force: true });
  fs.mkdirSync(path.dirname(quarantineProbePath), { recursive: true });
  fs.writeFileSync(quarantineProbePath, originalBytes);

  const quarantineInventory = runRepoScript('scripts/legacy-reference-inventory-audit.mjs');
  assert.equal(
    quarantineInventory.status,
    0,
    `inventory must pass with a quarantine-only retained reference:\n${quarantineInventory.output}`
  );
  const quarantineSource = runRepoScript('scripts/audit-pro-source-corpus-test.js');
  assert.equal(
    quarantineSource.status,
    0,
    `source corpus contract must pass with a quarantine-only retained reference:\n${quarantineSource.output}`
  );
  const quarantineReadiness = runRepoScript('scripts/legacy-shadow-retirement-readiness.mjs');
  assert.equal(
    quarantineReadiness.status,
    0,
    `retirement readiness must pass with a quarantine-only retained reference:\n${quarantineReadiness.output}`
  );

  fs.mkdirSync(path.dirname(activeProbePath), { recursive: true });
  fs.writeFileSync(activeProbePath, originalBytes);
  const ambiguousInventory = runRepoScript('scripts/legacy-reference-inventory-audit.mjs');
  assert.notEqual(ambiguousInventory.status, 0, 'inventory must reject active + quarantine ambiguity');
  assert.match(
    ambiguousInventory.output,
    /storage is ambiguous/,
    'inventory ambiguity failure must come from canonical storage authority'
  );

  fs.rmSync(activeProbePath, { force: true });
  fs.rmSync(quarantineProbePath, { force: true });
  const missingInventory = runRepoScript('scripts/legacy-reference-inventory-audit.mjs');
  assert.notEqual(missingInventory.status, 0, 'inventory must reject missing active + quarantine storage');
  assert.match(
    missingInventory.output,
    /missing from both active and quarantine storage/,
    'inventory missing-storage failure must come from canonical storage authority'
  );
} finally {
  fs.rmSync(activeProbePath, { force: true });
  fs.rmSync(quarantineProbePath, { force: true });
  if (originalActive) {
    fs.mkdirSync(path.dirname(activeProbePath), { recursive: true });
    fs.writeFileSync(activeProbePath, originalActive);
  }
  if (originalQuarantine) {
    fs.mkdirSync(path.dirname(quarantineProbePath), { recursive: true });
    fs.writeFileSync(quarantineProbePath, originalQuarantine);
  }
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

console.log(`✅ Explicit legacy reference-path contract: ${routes.length} routes; quarantine fallback + inventory/source/readiness dry-run + ambiguity fail-closed; ${rejected.length} adversarial resolutions rejected`);
