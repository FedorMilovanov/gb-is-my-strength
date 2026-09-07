#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = 'data/document-authority.json';
const errors = [];

const fail = (message) => errors.push(message);
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let registry;
try {
  registry = JSON.parse(read(REGISTRY_PATH));
} catch (error) {
  console.error(`Document authority: cannot parse ${REGISTRY_PATH}: ${error.message}`);
  process.exit(1);
}

if (registry.schemaVersion !== 1) fail('schemaVersion must be 1');
if (registry.authorityId !== 'GB-DOCUMENT-AUTHORITY-V1') fail('authorityId drift');
if (registry.defaultUnregisteredAuthority !== 'non-normative') {
  fail('unregistered documentation must default to non-normative');
}

const documents = Array.isArray(registry.documents) ? registry.documents : [];
if (!Array.isArray(registry.documents)) fail('documents must be an array');
const statuses = new Set(['current', 'historical', 'superseded', 'draft']);
const authorities = new Set(['normative', 'supporting', 'informational', 'provenance-only']);
const seen = new Set();

for (const [index, doc] of documents.entries()) {
  if (!doc || typeof doc !== 'object') {
    fail(`documents[${index}] must be an object`);
    continue;
  }
  if (typeof doc.path !== 'string' || !doc.path) {
    fail(`documents[${index}].path missing`);
    continue;
  }
  if (seen.has(doc.path)) fail(`duplicate document path: ${doc.path}`);
  seen.add(doc.path);
  if (!exists(doc.path)) fail(`registered document missing: ${doc.path}`);
  if (!statuses.has(doc.status)) fail(`${doc.path}: invalid status ${doc.status}`);
  if (!authorities.has(doc.authority)) fail(`${doc.path}: invalid authority ${doc.authority}`);
  if (doc.status === 'historical' && doc.authority === 'normative') {
    fail(`${doc.path}: historical document cannot be normative`);
  }
  if (doc.status === 'superseded' && doc.authority === 'normative') {
    fail(`${doc.path}: superseded document cannot be normative`);
  }
  if (doc.required === true && doc.status !== 'current') {
    fail(`${doc.path}: required operational document must be current`);
  }
  if (doc.supersededBy) {
    if (!Array.isArray(doc.supersededBy) || !doc.supersededBy.length) {
      fail(`${doc.path}: supersededBy must be a non-empty array when present`);
    } else {
      for (const target of doc.supersededBy) {
        if (!exists(target)) fail(`${doc.path}: supersededBy target missing: ${target}`);
      }
    }
  }
}

const roots = documents.filter((doc) => doc.status === 'current' && doc.role === 'operational-root');
if (roots.length !== 1 || roots[0]?.path !== 'AGENTS.md') {
  fail(`exactly one current operational-root is required and it must be AGENTS.md (found ${roots.map((d) => d.path).join(', ') || 'none'})`);
}

const entrypoints = Array.isArray(registry.operationalEntrypoints) ? registry.operationalEntrypoints : [];
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
  'docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md',
];
for (const rel of expectedHistorical) {
  const doc = documents.find((item) => item.path === rel);
  if (!doc || doc.status !== 'historical') fail(`${rel} must remain explicitly historical`);
}

const readme = read('README.md');
const agents = read('AGENTS.md');
if (!readme.includes('data/document-authority.json')) fail('README must link document authority SSOT');
if (!readme.includes('docs/DOCUMENT_AUTHORITY.md')) fail('README must link human document authority index');
if (/\b\d+\s+(?:production|public) routes\b/i.test(readme)) {
  fail('README must not maintain a manual production/public route count');
}
if (/Sitemap[^\n]*\b\d+\b/i.test(readme)) fail('README must not maintain a manual sitemap count');
if (/Astro 6/i.test(readme) || /Astro 6/i.test(agents)) fail('operational entrypoints must not describe current platform as Astro 6');

const policy = registry.policy || {};
for (const key of [
  'unregisteredDocumentCannotOverrideRegisteredCurrentAuthority',
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

console.log(`Document authority: PASS (${documents.length} managed documents, 1 operational root)`);
