#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {
  currentLegacyReferenceDisposition,
  resolveDeclaredLegacyReference,
  validateLegacyAuthorityProfile,
} = require('./lib/legacy-source-authority.js');

const MANIFEST_REL = 'data/legacy-reference-ledger/manifest.json';
const SHARED_GUARD_REL = '.github/workflows/shared-files-guard.yml';
const SELF_REL = 'scripts/legacy-reference-inventory-audit.mjs';
const ALLOWED_CLASSIFICATIONS = new Set([
  'production-required',
  'migration-reference-only',
  'obsolete',
  'unknown-blocker',
]);
const ALLOWED_ACCESS = new Set([
  'reader',
  'writer',
  'policy-reader',
  'fixture-or-contract',
  'comment-only',
]);
const DISCOVERY_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.astro', '.json', '.yml', '.yaml']);
const DISCOVERY_RE = /legacyPath|legacyStatus|(?:articles|baptisty-rossii|nagornaya)\/[^\n"'` ]+\/index\.html/;
const NON_BLOCKING_FIXTURE_DEPENDENCIES = new Map([
  ['scripts/audit-pro-source-corpus-test.js', 'articles/one/index.html'],
  ['scripts/editorial-metadata-registry-preservation-test.js', 'articles/old-entry/index.html'],
]);
const NON_BLOCKING_DIST_DEPENDENCIES = new Map([
  ['scripts/dist-publication-audit.js', { evidenceToken: 'nagornaya/chast-1/index.html', access: 'reader' }],
  ['scripts/gill-pre-v16-submenu-regression-audit.js', { evidenceToken: 'articles/dzhon-gill-istoricheskiy-kontekst/index.html', access: 'fixture-or-contract' }],
  ['scripts/nagornaya-bar-asset-browser-test.js', { evidenceToken: 'nagornaya/chast-1/index.html', access: 'fixture-or-contract' }],
]);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function normalizeRel(value) {
  return String(value || '').replaceAll('\\', '/').trim().replace(/^\/+/, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
}

function decodeEntities(value) {
  const named = new Map([
    ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' '],
    ['laquo', '«'], ['raquo', '»'], ['ndash', '–'], ['mdash', '—'], ['hellip', '…'],
  ]);
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const raw = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named.get(entity.toLowerCase()) ?? full;
  });
}

function htmlMetrics(raw, bytes) {
  const h1Count = (raw.match(/<h1\b/gi) || []).length;
  const h2Count = (raw.match(/<h2\b/gi) || []).length;
  const normalizedText = decodeEntities(
    raw
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[^]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[^]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
  const words = normalizedText.match(/[0-9A-Za-zА-Яа-яЁё]+(?:[-'’][0-9A-Za-zА-Яа-яЁё]+)*/g) || [];
  return {
    gitBlobSha1: gitBlobSha1(bytes),
    byteSha256: sha256(bytes),
    normalizedTextSha256: sha256(Buffer.from(normalizedText)),
    bytes: bytes.length,
    wordCount: words.length,
    h1Count,
    h2Count,
  };
}

function collectProfiles() {
  const dir = path.join(ROOT, 'data/route-profiles');
  const result = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const profileRel = `data/route-profiles/${name}`;
    const data = readJson(profileRel);
    if (!data.legacyPath) continue;
    result.push({
      route: data.route,
      profile: profileRel,
      legacyPath: normalizeRel(data.legacyPath),
      data,
      currentDisposition: currentLegacyReferenceDisposition(data, profileRel),
    });
  }
  return result.sort((a, b) => a.legacyPath.localeCompare(b.legacyPath));
}

function walk(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function discoverDependencies() {
  const roots = ['scripts', 'src', '.github/workflows'];
  const found = [];
  for (const rootRel of roots) {
    for (const full of walk(path.join(ROOT, rootRel))) {
      const relative = path.relative(ROOT, full).replaceAll(path.sep, '/');
      if (relative === SELF_REL || !DISCOVERY_EXTENSIONS.has(path.extname(relative).toLowerCase())) continue;
      const source = fs.readFileSync(full, 'utf8');
      const match = source.match(DISCOVERY_RE);
      if (match) found.push({ path: relative, evidenceToken: match[0] });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function validateNonBlockingDependency(dependency, evidenceToken, expectedAccess, label, problem) {
  if (dependency.access !== expectedAccess) problem(`${dependency.path}: reviewed ${label} must remain ${expectedAccess}`);
  if (dependency.classification !== 'production-required') problem(`${dependency.path}: reviewed ${label} must remain non-blocking`);
  if (dependency.quarantineImpact !== 'none-fixture-policy-or-comment-only') problem(`${dependency.path}: reviewed ${label} must have no quarantine impact`);
  if (dependency.evidenceToken !== evidenceToken) problem(`${dependency.path}: reviewed ${label} evidence token drifted`);
}

function validateLedger(ledger) {
  const problems = [];
  const problem = (message) => problems.push(message);

  if (ledger.schemaVersion !== '1.0.0') problem('schemaVersion must be 1.0.0');
  if (ledger.issue !== 62) problem('issue authority must remain #62');
  if (!/^[0-9a-f]{40}$/.test(ledger.auditedAtCommit || '')) problem('auditedAtCommit must be an exact SHA');
  if (ledger.scope !== 'inventory-and-immutability-only') problem('scope must remain inventory-and-immutability-only');
  if (ledger.policy?.normalValidation !== 'read-only') problem('normal validation must remain read-only');
  if (ledger.policy?.moveAllowedWhenUnknownBlockers !== false) problem('moves must remain blocked while unknown blockers exist');
  if (ledger.policy?.obsoleteWritersAllowed !== false) problem('obsolete writers must remain forbidden');
  if (ledger.policy?.currentReferenceAuthority !== 'route-profiles') problem('current reference authority must be route-profiles');
  if (ledger.policy?.referenceEntryAuthorityFields !== 'snapshot-at-auditedAtCommit') {
    problem('reference entry authority fields must be declared historical snapshot metadata');
  }
  const expectedFixtureDependencies = [...NON_BLOCKING_FIXTURE_DEPENDENCIES.keys()];
  if (JSON.stringify(ledger.policy?.nonBlockingFixtureDependencies) !== JSON.stringify(expectedFixtureDependencies)) {
    problem('non-blocking fixture dependency policy drifted');
  }
  const expectedDistDependencies = [...NON_BLOCKING_DIST_DEPENDENCIES.keys()];
  if (JSON.stringify(ledger.policy?.nonBlockingDistDependencies) !== JSON.stringify(expectedDistDependencies)) {
    problem('non-blocking dist dependency policy drifted');
  }

  const profiles = collectProfiles();
  const refs = Array.isArray(ledger.references) ? ledger.references : [];
  const refPaths = refs.map((item) => item.legacyPath);
  if (new Set(refPaths).size !== refPaths.length) problem('duplicate legacyPath entries in ledger');
  if (JSON.stringify([...refPaths].sort()) !== JSON.stringify(refPaths)) problem('references must be sorted by legacyPath');
  if (refs.length !== profiles.length) problem(`reference count mismatch: ledger=${refs.length}, profiles=${profiles.length}`);

  const byPath = new Map(refs.map((item) => [item.legacyPath, item]));
  for (const profile of profiles) {
    const entry = byPath.get(profile.legacyPath);
    if (!entry) {
      problem(`missing ledger reference: ${profile.legacyPath}`);
      continue;
    }
    if (entry.route !== profile.route) problem(`${profile.legacyPath}: route mismatch`);
    if (entry.profile !== profile.profile) problem(`${profile.legacyPath}: profile owner mismatch`);
    if (!ALLOWED_CLASSIFICATIONS.has(entry.classification)) problem(`${profile.legacyPath}: invalid snapshot classification ${entry.classification}`);
    if (entry.sourceCommit !== ledger.auditedAtCommit) problem(`${profile.legacyPath}: sourceCommit must equal auditedAtCommit`);

    const shapeIssues = validateLegacyAuthorityProfile(profile.data, { route: profile.route });
    for (const message of shapeIssues) problem(`${profile.legacyPath}: current authority invalid: ${message}`);
    if (profile.currentDisposition.classification === 'unknown-blocker' || profile.currentDisposition.classification === 'absent') {
      problem(`${profile.legacyPath}: current route-profile authority is unresolved for an existing ledger reference`);
    }

    let resolvedReference;
    try {
      resolvedReference = resolveDeclaredLegacyReference(profile.data, { route: profile.route });
    } catch (error) {
      problem(`${profile.legacyPath}: reference storage invalid: ${error.message}`);
      continue;
    }
    if (!resolvedReference?.absolutePath) {
      problem(`${profile.legacyPath}: reference storage did not resolve`);
      continue;
    }
    const full = resolvedReference.absolutePath;
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      problem(`${profile.legacyPath}: reference must be a regular non-symlink file`);
      continue;
    }
    const bytes = fs.readFileSync(full);
    const actual = htmlMetrics(bytes.toString('utf8'), bytes);
    for (const [key, value] of Object.entries(actual)) {
      if (entry[key] !== value) problem(`${profile.legacyPath}: ${key} drift (ledger=${entry[key]}, actual=${value})`);
    }
  }

  const dependencies = Array.isArray(ledger.dependencies) ? ledger.dependencies : [];
  const dependencyPaths = dependencies.map((item) => item.path);
  if (new Set(dependencyPaths).size !== dependencyPaths.length) problem('duplicate dependency paths');
  if (JSON.stringify([...dependencyPaths].sort()) !== JSON.stringify(dependencyPaths)) problem('dependencies must be sorted by path');
  const discovered = discoverDependencies();
  if (JSON.stringify(discovered.map((item) => item.path)) !== JSON.stringify(dependencyPaths)) {
    const registered = new Set(dependencyPaths);
    const current = new Set(discovered.map((item) => item.path));
    for (const item of discovered) if (!registered.has(item.path)) problem(`unregistered legacy dependency candidate: ${item.path}`);
    for (const item of dependencies) if (!current.has(item.path)) problem(`stale dependency registration: ${item.path}`);
  }
  const discoveredByPath = new Map(discovered.map((item) => [item.path, item]));
  for (const dependency of dependencies) {
    if (!ALLOWED_CLASSIFICATIONS.has(dependency.classification)) problem(`${dependency.path}: invalid dependency classification`);
    if (!ALLOWED_ACCESS.has(dependency.access)) problem(`${dependency.path}: invalid access role`);
    if (dependency.owner !== 'legacy-reference-quarantine') problem(`${dependency.path}: owner must remain legacy-reference-quarantine`);
    const actual = discoveredByPath.get(dependency.path);
    if (!actual) continue;
    const source = read(dependency.path);
    if (!dependency.evidenceToken || !source.includes(dependency.evidenceToken)) problem(`${dependency.path}: evidence token missing from source`);
    if (dependency.classification === 'obsolete' && dependency.quarantineImpact !== 'remove-or-repoint-before-move') {
      problem(`${dependency.path}: obsolete dependency must be removed or repointed before move`);
    }
    if (dependency.classification === 'unknown-blocker' && dependency.quarantineImpact !== 'owner-decision-required') {
      problem(`${dependency.path}: unknown blocker must require owner decision`);
    }
    const fixtureEvidenceToken = NON_BLOCKING_FIXTURE_DEPENDENCIES.get(dependency.path);
    if (fixtureEvidenceToken) validateNonBlockingDependency(dependency, fixtureEvidenceToken, 'fixture-or-contract', 'fixture', problem);
    const distPolicy = NON_BLOCKING_DIST_DEPENDENCIES.get(dependency.path);
    if (distPolicy) validateNonBlockingDependency(dependency, distPolicy.evidenceToken, distPolicy.access, 'dist contract', problem);
    if (dependency.access === 'writer' && dependency.classification !== 'obsolete' && dependency.classification !== 'unknown-blocker') {
      problem(`${dependency.path}: mutable legacy writer cannot be silently classified as safe`);
    }
  }

  const obsoleteWriters = dependencies.filter((item) => item.classification === 'obsolete' && item.access === 'writer');
  if (obsoleteWriters.length > 0) problem(`obsolete writers must be removed: ${obsoleteWriters.map((item) => item.path).join(', ')}`);

  // Manifest summary is the immutable ledger snapshot summary at auditedAtCommit.
  // Current route-profile classifications are intentionally resolved at runtime
  // and are reported by the retirement-readiness owner instead of being copied
  // into every immutable shard entry.
  const expectedSummary = {
    references: refs.length,
    migrationReferenceOnly: refs.filter((item) => item.classification === 'migration-reference-only').length,
    productionRequired: refs.filter((item) => item.classification === 'production-required').length,
    unknownBlockers: refs.filter((item) => item.classification === 'unknown-blocker').length,
    dependencies: dependencies.length,
    dependencyUnknownBlockers: dependencies.filter((item) => item.classification === 'unknown-blocker').length,
    obsoleteWriters: dependencies.filter((item) => item.classification === 'obsolete' && item.access === 'writer').length,
  };
  if (JSON.stringify(ledger.summary) !== JSON.stringify(expectedSummary)) problem('snapshot summary does not match exact immutable ledger contents');

  if (!Array.isArray(ledger.referenceShards) || ledger.referenceShards.length !== 4) problem('exactly four reference shards are required');
  for (const shard of ledger.referenceShards || []) {
    const payload = readJson(shard);
    if (payload.schemaVersion !== '1.0.0' || !Array.isArray(payload.entries)) problem(`${shard}: invalid shard contract`);
  }
  const sharedGuard = read(SHARED_GUARD_REL);
  if (!sharedGuard.includes('node --check scripts/legacy-reference-inventory-audit.mjs')
      || !sharedGuard.includes('node scripts/legacy-reference-inventory-audit.mjs')) {
    problem('Shared Files Guard must run the inventory audit and syntax check');
  }
  const expectedOwners = [MANIFEST_REL, ...(ledger.referenceShards || []), SELF_REL, SHARED_GUARD_REL];
  if (JSON.stringify(ledger.governanceOwners) !== JSON.stringify(expectedOwners)) problem('governance owner set drifted');

  return problems;
}

const manifest = readJson(MANIFEST_REL);
const ledger = {
  ...manifest,
  references: manifest.referenceShards.flatMap((relativePath) => readJson(relativePath).entries),
};
const problems = validateLedger(ledger);
assert.deepEqual(problems, [], `Legacy reference inventory audit failed:\n- ${problems.join('\n- ')}`);

const mutations = [
  ['missing reference', (copy) => { copy.references.pop(); copy.summary.references--; }],
  ['hash drift', (copy) => { copy.references[0].byteSha256 = '0'.repeat(64); }],
  ['invalid snapshot classification', (copy) => { copy.references[0].classification = 'invalid-snapshot'; }],
  ['unregistered dependency', (copy) => { copy.dependencies.pop(); copy.summary.dependencies--; }],
  ['move enabled with blockers', (copy) => { copy.policy.moveAllowedWhenUnknownBlockers = true; }],
  ['reviewed fixture relaundered as blocker', (copy) => {
    const target = copy.dependencies.find((item) => item.path === 'scripts/audit-pro-source-corpus-test.js');
    target.classification = 'unknown-blocker';
    target.quarantineImpact = 'owner-decision-required';
    copy.summary.dependencyUnknownBlockers++;
  }],
  ['reviewed dist contract relaundered as blocker', (copy) => {
    const target = copy.dependencies.find((item) => item.path === 'scripts/dist-publication-audit.js');
    target.classification = 'unknown-blocker';
    target.quarantineImpact = 'owner-decision-required';
    copy.summary.dependencyUnknownBlockers++;
  }],
  ['obsolete writer reintroduction', (copy) => {
    copy.dependencies.push({
      path: 'scripts/legacy-generators/update-meta-git-history-v2.js',
      access: 'writer',
      classification: 'obsolete',
      quarantineImpact: 'remove-or-repoint-before-move',
      evidenceToken: 'articles/${slug}/index.html',
      owner: 'legacy-reference-quarantine',
    });
    copy.dependencies.sort((a, b) => a.path.localeCompare(b.path));
    copy.summary.dependencies++;
    copy.summary.obsoleteWriters++;
  }],
];
for (const [label, mutate] of mutations) {
  const copy = structuredClone(ledger);
  mutate(copy);
  assert.ok(validateLedger(copy).length > 0, `${label} mutation must fail closed`);
}

const current = collectProfiles().map((profile) => profile.currentDisposition);
const currentMigrationOnly = current.filter((item) => item.classification === 'migration-reference-only').length;
const currentProductionRequired = current.filter((item) => item.classification === 'production-required').length;
const currentUnknown = current.filter((item) => item.classification === 'unknown-blocker').length;

console.log(
  `✅ Legacy reference inventory: ${ledger.summary.references} immutable references; `
  + `current authority=${currentMigrationOnly} migration-only/${currentProductionRequired} production-required/${currentUnknown} unresolved; `
  + `${ledger.summary.dependencies} dependencies; `
  + `${ledger.summary.dependencyUnknownBlockers} dependency blockers; `
  + `${mutations.length} adversarial mutations rejected`,
);
