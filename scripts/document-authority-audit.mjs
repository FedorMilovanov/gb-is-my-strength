#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = 'data/document-authority.json';
const errors = [];

const fail = (message) => errors.push(message);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function safeRepoPath(rel) {
  if (typeof rel !== 'string' || !rel) return false;
  if (path.isAbsolute(rel) || rel.includes('\\')) return false;
  const normalized = path.posix.normalize(rel);
  return normalized === rel && normalized !== '..' && !normalized.startsWith('../');
}

function isFile(rel) {
  if (!safeRepoPath(rel)) return false;
  try {
    return fs.statSync(path.join(ROOT, rel)).isFile();
  } catch {
    return false;
  }
}

let registry;
try {
  registry = JSON.parse(read(REGISTRY_PATH));
} catch (error) {
  console.error(`Document authority: cannot parse ${REGISTRY_PATH}: ${error.message}`);
  process.exit(1);
}

if (registry.schemaVersion !== 1) fail('schemaVersion must be 1');
if (registry.authorityId !== 'GB-DOCUMENT-AUTHORITY-V1') fail('authorityId drift');
if (registry.registryScope !== 'repository-wide-and-explicit-high-risk-document-authority') {
  fail('registryScope drift');
}
if (registry.defaultUnregisteredAuthority !== 'surface-local-non-overriding') {
  fail('unregistered documentation must default to surface-local-non-overriding');
}

const documents = Array.isArray(registry.documents) ? registry.documents : [];
if (!Array.isArray(registry.documents)) fail('documents must be an array');
const statuses = new Set(['current', 'historical', 'superseded', 'draft']);
const authorities = new Set(['normative', 'supporting', 'informational', 'provenance-only']);
const seen = new Set();

for (const [index, doc] of documents.entries()) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    fail(`documents[${index}] must be an object`);
    continue;
  }
  if (!safeRepoPath(doc.path)) {
    fail(`documents[${index}].path must be a safe repository-relative path`);
    continue;
  }
  if (seen.has(doc.path)) fail(`duplicate document path: ${doc.path}`);
  seen.add(doc.path);
  if (!isFile(doc.path)) fail(`registered document missing or not a file: ${doc.path}`);
  if (!statuses.has(doc.status)) fail(`${doc.path}: invalid status ${doc.status}`);
  if (!authorities.has(doc.authority)) fail(`${doc.path}: invalid authority ${doc.authority}`);
  if (typeof doc.required !== 'boolean') fail(`${doc.path}: required must be boolean`);
  if ((doc.status === 'historical' || doc.status === 'superseded') && doc.authority === 'normative') {
    fail(`${doc.path}: historical/superseded document cannot be normative`);
  }
  if (doc.status === 'current' && doc.authority === 'provenance-only') {
    fail(`${doc.path}: current document cannot be provenance-only`);
  }
  if (doc.required === true && doc.status !== 'current') {
    fail(`${doc.path}: required operational document must be current`);
  }
  if (doc.supersededBy && (!Array.isArray(doc.supersededBy) || !doc.supersededBy.length)) {
    fail(`${doc.path}: supersededBy must be a non-empty array when present`);
  }
}

for (const doc of documents) {
  if (!doc || !safeRepoPath(doc.path) || !Array.isArray(doc.supersededBy)) continue;
  for (const target of doc.supersededBy) {
    if (!safeRepoPath(target)) {
      fail(`${doc.path}: invalid supersededBy path: ${target}`);
      continue;
    }
    if (!seen.has(target)) fail(`${doc.path}: supersededBy target is not registered: ${target}`);
    if (!isFile(target)) fail(`${doc.path}: supersededBy target missing: ${target}`);
  }
}

const roots = documents.filter((doc) => doc.status === 'current' && doc.role === 'operational-root');
if (roots.length !== 1 || roots[0]?.path !== 'AGENTS.md') {
  fail(`exactly one current operational-root is required and it must be AGENTS.md (found ${roots.map((d) => d.path).join(', ') || 'none'})`);
}

const entrypoints = Array.isArray(registry.operationalEntrypoints) ? registry.operationalEntrypoints : [];
if (!Array.isArray(registry.operationalEntrypoints)) fail('operationalEntrypoints must be an array');
if (new Set(entrypoints).size !== entrypoints.length) fail('operationalEntrypoints must not contain duplicates');
for (const rel of ['AGENTS.md', 'README.md', 'docs/DOCUMENT_AUTHORITY.md']) {
  if (!entrypoints.includes(rel)) fail(`operationalEntrypoints missing ${rel}`);
  const doc = documents.find((item) => item.path === rel);
  if (!doc || doc.status !== 'current') fail(`${rel} must be registered current`);
  if (doc?.authority === 'provenance-only') fail(`${rel} cannot be provenance-only`);
}

const expectedHistorical = [
  'docs/OWNER-REQUIREMENTS.md',
  'docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md',
  'docs/CURRENT_RECHECK_2026-06-22_FIXES.md',
  'docs/dependency-migrations/ASTRO_7_SATTERI.md',
  'docs/RELEASE-LIVE-EVIDENCE-CONTRACT-2026-08-06.md',
  'docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md',
];
for (const rel of expectedHistorical) {
  const doc = documents.find((item) => item.path === rel);
  if (!doc || doc.status !== 'historical') fail(`${rel} must remain explicitly historical`);
}

const releasePolicy = documents.find((item) => item.path === 'docs/RELEASE-LIVE-EVIDENCE.md');
if (!releasePolicy || releasePolicy.status !== 'current' || releasePolicy.authority !== 'normative' || releasePolicy.required !== true) {
  fail('docs/RELEASE-LIVE-EVIDENCE.md must be current normative required authority');
}

const readme = read('README.md');
const agents = read('AGENTS.md');
const authorityDoc = read('docs/DOCUMENT_AUTHORITY.md');
if (!readme.includes('data/document-authority.json')) fail('README must link document authority SSOT');
if (!readme.includes('docs/DOCUMENT_AUTHORITY.md')) fail('README must link human document authority index');
if (!authorityDoc.includes('surface-local-non-overriding')) {
  fail('DOCUMENT_AUTHORITY must explain the surface-local default');
}
if (/\b\d+\s+(?:production|public) routes\b/i.test(readme)) {
  fail('README must not maintain a manual production/public route count');
}
if (/Sitemap[^\n]*\b\d+\b/i.test(readme)) fail('README must not maintain a manual sitemap count');
if (/Astro 6/i.test(readme) || /Astro 6/i.test(agents)) fail('operational entrypoints must not describe current platform as Astro 6');

const policy = registry.policy || {};
for (const key of [
  'unregisteredDocumentCannotOverrideRegisteredCurrentAuthority',
  'unregisteredSurfaceContractRequiresCurrentDelegation',
  'historicalNameDoesNotImplyCurrentStatus',
  'sourceDerivedFactsMustNotUseProseAsSecondSSOT',
  'historicalEvidenceMustBePreserved',
  'massFileMovesRequireReferenceAuditFirst',
]) {
  if (policy[key] !== true) fail(`policy.${key} must be true`);
}

if (errors.length) {
  console.error(`Document authority: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Document authority: PASS (${documents.length} managed documents, 1 operational root; unregistered=surface-local-non-overriding)`);
