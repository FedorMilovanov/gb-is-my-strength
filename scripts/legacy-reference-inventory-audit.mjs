#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
    const profile = readJson(profileRel);
    if (!profile.legacyPath) continue;
    result.push({
      route: profile.route,
      profile: profileRel,
      legacyPath: normalizeRel(profile.legacyPath),
      declaredLegacyStatus: profile.legacyStatus ?? null,
    });
  }
  return result.sort((a, b) => a.legacyPath.localeCompare(b.legacyPath));
}

function expectedClassification(profile) {
  if (profile.route === '/' && profile.legacyPath === 'index.html') {
    return {
      classification: 'migration-reference-only',
      decisionSource: 'issue-62-comment-5148492562',
    };
  }
  if (profile.declaredLegacyStatus === 'reference-only') {
    return {
      classification: 'migration-reference-only',
      decisionSource: `${profile.profile}:legacyStatus`,
    };
  }
  if (profile.declaredLegacyStatus === 'canonical' || profile.declaredLegacyStatus === 'runtime-required') {
    return {
      classification: 'production-required',
      decisionSource: `${profile.profile}:legacyStatus`,
    };
  }
  return {
    classification: 'unknown-blocker',
    decisionSource: `${profile.profile}:legacyStatus-missing`,
  };
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

function validateLedger(ledger) {
  const problems = [];
  const problem = (message) => problems.push(message);

  if (ledger.schemaVersion !== '1.0.0') problem('schemaVersion must be 1.0.0');
  if (ledger.issue !== 62) problem('issue authority must remain #62');
  if (!/^[0-9a-f]{40}$/.test(ledger.auditedAtCommit || '')) problem('auditedAtCommit must be an exact SHA');
  if (ledger.scope !== 'inventory-and-immutability-only') problem('scope must remain inventory-and-immutability-only');
  if (ledger.policy?.normalValidation !== 'read-only') problem('normal validation must remain read-only');
  if (ledger.policy?.moveAllowedWhenUnknownBlockers !== false) problem('moves must remain blocked while unknown blockers exist');

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
    if ((entry.declaredLegacyStatus ?? null) !== profile.declaredLegacyStatus) problem(`${profile.legacyPath}: declared legacy status mismatch`);
    if (!ALLOWED_CLASSIFICATIONS.has(entry.classification)) problem(`${profile.legacyPath}: invalid classification ${entry.classification}`);
    const expected = expectedClassification(profile);
    if (entry.classification !== expected.classification) problem(`${profile.legacyPath}: classification must be ${expected.classification}`);
    if (entry.decisionSource !== expected.decisionSource) problem(`${profile.legacyPath}: decision source mismatch`);
    if (entry.sourceCommit !== ledger.auditedAtCommit) problem(`${profile.legacyPath}: sourceCommit must equal auditedAtCommit`);

    const full = path.join(ROOT, profile.legacyPath);
    if (!fs.existsSync(full)) {
      problem(`${profile.legacyPath}: reference file missing`);
      continue;
    }
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
    if (dependency.access === 'writer' && dependency.classification !== 'obsolete' && dependency.classification !== 'unknown-blocker') {
      problem(`${dependency.path}: mutable legacy writer cannot be silently classified as safe`);
    }
  }

  const expectedSummary = {
    references: refs.length,
    migrationReferenceOnly: refs.filter((item) => item.classification === 'migration-reference-only').length,
    productionRequired: refs.filter((item) => item.classification === 'production-required').length,
    unknownBlockers: refs.filter((item) => item.classification === 'unknown-blocker').length,
    dependencies: dependencies.length,
    dependencyUnknownBlockers: dependencies.filter((item) => item.classification === 'unknown-blocker').length,
    obsoleteWriters: dependencies.filter((item) => item.classification === 'obsolete' && item.access === 'writer').length,
  };
  if (JSON.stringify(ledger.summary) !== JSON.stringify(expectedSummary)) problem('summary does not match exact ledger contents');

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
  ['unknown blocker laundering', (copy) => {
    const target = copy.references.find((item) => item.classification === 'unknown-blocker');
    target.classification = 'migration-reference-only';
    copy.summary.unknownBlockers--;
    copy.summary.migrationReferenceOnly++;
  }],
  ['unregistered dependency', (copy) => { copy.dependencies.pop(); copy.summary.dependencies--; }],
  ['move enabled with blockers', (copy) => { copy.policy.moveAllowedWhenUnknownBlockers = true; }],
  ['writer laundering', (copy) => {
    const target = copy.dependencies.find((item) => item.access === 'writer');
    target.classification = 'migration-reference-only';
  }],
];
for (const [label, mutate] of mutations) {
  const copy = structuredClone(ledger);
  mutate(copy);
  assert.ok(validateLedger(copy).length > 0, `${label} mutation must fail closed`);
}

console.log(
  `✅ Legacy reference inventory: ${ledger.summary.references} references; `
  + `${ledger.summary.migrationReferenceOnly} migration-only; `
  + `${ledger.summary.unknownBlockers} reference blockers; `
  + `${ledger.summary.dependencies} dependencies; `
  + `${ledger.summary.dependencyUnknownBlockers} dependency blockers; `
  + `${mutations.length} adversarial mutations rejected`,
);
