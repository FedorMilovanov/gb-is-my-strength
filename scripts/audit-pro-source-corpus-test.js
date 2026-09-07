#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  routeToRootHtml,
  buildAuditProSourceCorpus,
} = require('./lib/audit-pro-source-corpus');
const {
  collectProductSourceSurfaces,
  auditControlSurfaceCorpus,
} = require('./lib/product-source-surfaces');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pro-source-corpus-'));
function put(rel, content = '<!doctype html>') {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}
function readCorpus(records) {
  return records.map((item) => fs.readFileSync(item.file, 'utf8')).join('\n');
}
function relativeForRoute(route) {
  return path.relative(root, routeToRootHtml(root, route)).replace(/\\/g, '/');
}
function fixtureResolveReference(route, options = {}) {
  const logical = relativeForRoute(route);
  const active = path.join(root, logical);
  const quarantineRel = path.posix.join('migration/legacy-reference', logical);
  const quarantine = path.join(root, quarantineRel);
  const existing = [
    { absolutePath: active, repositoryPath: logical },
    { absolutePath: quarantine, repositoryPath: quarantineRel },
  ].filter((item) => fs.existsSync(item.absolutePath));
  if (existing.length > 1) throw new Error(`fixture reference storage is ambiguous for ${logical}`);
  if (existing.length === 1) return { ...existing[0], logicalPath: logical, route, exists: true };
  if (options.mustExist !== false) throw new Error(`fixture reference missing for ${route}`);
  return { absolutePath: active, repositoryPath: logical, logicalPath: logical, route, exists: false };
}
function corpus(entries, allHtmlFiles) {
  return buildAuditProSourceCorpus({ root, entries, allHtmlFiles, resolveReference: fixtureResolveReference });
}

const home = put('index.html');
const article = put('articles/one/index.html');
const reference = put(
  'articles/reference/index.html',
  '<!doctype html><script>document.addEventListener("keydown",e=>{if(e.ctrlKey&&String(e.key).toLowerCase()==="k")e.preventDefault()})</script><script src="/js/search.js?v=deadbeef"></script>',
);
const absentSnapshot = put('articles/absent/index.html', '<!doctype html><p>retired snapshot</p>');
const draft = put('draft/index.html');
const orphan = put('orphan/index.html');
const notFound = put('404.html');
const verification = put('google123.html');

const entries = [
  { route: '/', status: 'production-dist', surface: 'page', legacyStatus: 'runtime-required' },
  { route: '/articles/one/', status: 'production-dist', surface: 'article', legacyStatus: 'canonical' },
  { route: '/articles/reference/', status: 'production-dist', surface: 'article', legacyStatus: 'reference-only' },
  { route: '/articles/absent/', status: 'production-dist', surface: 'article', legacyStatus: 'absent' },
  { route: '/astro-only/', status: 'production-dist', surface: 'page', legacyStatus: 'absent' },
  { route: '/draft/', status: 'shadow-pilot', surface: 'page', legacyStatus: 'reference-only' },
];
const allHtmlFiles = [home, article, reference, absentSnapshot, draft, orphan, notFound, verification];
const baseline = corpus(entries, allHtmlFiles);

assert.strictEqual(routeToRootHtml(root, '/'), home);
assert.strictEqual(routeToRootHtml(root, '/articles/one/'), article);
assert.deepStrictEqual(
  baseline.sourcePages.map((item) => item.route),
  ['/', '/articles/absent/', '/articles/one/', '/articles/reference/'],
);
assert.deepStrictEqual(baseline.currentRuntimePages.map((item) => item.route), ['/', '/articles/one/']);
assert.deepStrictEqual(baseline.referenceOnly.map((item) => item.route), ['/articles/reference/']);
assert.deepStrictEqual(baseline.distOnly.map((item) => item.route), ['/astro-only/']);
assert.deepStrictEqual(baseline.registeredNonProduction.map((item) => item.route), ['/draft/']);
assert.deepStrictEqual(baseline.unregisteredRootHtml.map((item) => item.relative), ['orphan/index.html']);
assert.deepStrictEqual(baseline.duplicateRootMappings, []);
assert.strictEqual(baseline.productionRoutes, 5);

// Retained/absent snapshots stay visible to broad structural/forensic checks,
// but current-runtime consumers (cache revision + G112) must not see them.
assert(readCorpus(baseline.sourcePages).includes('deadbeef'));
assert(readCorpus(baseline.sourcePages).includes('ctrlKey'));
assert(!readCorpus(baseline.currentRuntimePages).includes('deadbeef'));
assert(!readCorpus(baseline.currentRuntimePages).includes('ctrlKey'));
assert(baseline.sourcePages.some((item) => item.route === '/articles/absent/'));
assert(!baseline.currentRuntimePages.some((item) => item.route === '/articles/absent/'));

// Storage move contract: a production reference can move under the quarantine
// root without changing route identity or the broad forensic corpus.
const quarantineRel = 'migration/legacy-reference/articles/reference/index.html';
const quarantineReference = path.join(root, quarantineRel);
fs.mkdirSync(path.dirname(quarantineReference), { recursive: true });
fs.renameSync(reference, quarantineReference);
const movedFiles = allHtmlFiles.filter((file) => file !== reference);
const moved = corpus(entries, movedFiles);
assert.deepStrictEqual(moved.referenceOnly.map((item) => item.route), ['/articles/reference/']);
assert.strictEqual(moved.referenceOnly[0].file, quarantineReference);
assert(readCorpus(moved.sourcePages).includes('deadbeef'));
assert(!moved.unregisteredRootHtml.some((item) => item.relative === 'articles/reference/index.html'));

const synthetic = corpus(
  [...entries, { route: '/future-native/', status: 'production-dist', surface: 'series', legacyStatus: 'absent' }],
  movedFiles,
);
assert(synthetic.distOnly.some((item) => item.route === '/future-native/'));
assert(!synthetic.unregisteredRootHtml.some((item) => item.relative === 'future-native/index.html'));

// Adversarial authority mutation: the exact same quarantined retained bytes
// become visible to current runtime checks as soon as their route is canonical.
const referenceMutation = corpus(
  entries.map((entry) => entry.route === '/articles/reference/'
    ? { ...entry, legacyStatus: 'canonical' }
    : entry),
  movedFiles,
);
assert(referenceMutation.sourcePages.some((item) => item.route === '/articles/reference/'));
assert(referenceMutation.currentRuntimePages.some((item) => item.route === '/articles/reference/'));
assert(!referenceMutation.referenceOnly.some((item) => item.route === '/articles/reference/'));
assert(readCorpus(referenceMutation.currentRuntimePages).includes('deadbeef'));
assert(readCorpus(referenceMutation.currentRuntimePages).includes('ctrlKey'));

// Duplicate active + quarantine storage must fail closed rather than choosing a
// source nondeterministically.
put('articles/reference/index.html', '<!doctype html><p>duplicate</p>');
assert.throws(() => corpus(entries, [...movedFiles, reference]), /storage is ambiguous/);
fs.unlinkSync(reference);

fs.unlinkSync(article);
const removedShadow = corpus(entries, movedFiles.filter((file) => file !== article));
assert(removedShadow.distOnly.some((item) => item.route === '/articles/one/'));
assert(!removedShadow.sourcePages.some((item) => item.route === '/articles/one/'));
assert(!removedShadow.currentRuntimePages.some((item) => item.route === '/articles/one/'));

fs.rmSync(root, { recursive: true, force: true });

// Repository-level evidence for SOURCE-SURFACE-AUDIT-FALSE-COMPLETENESS.
// Cardinality is derived, never frozen: the regression condition is an omitted
// producer class, not a historical magic count such as 47/49/75.
const repoRoot = path.resolve(__dirname, '..');
const repoSurfaces = collectProductSourceSurfaces(repoRoot);
const repoControls = auditControlSurfaceCorpus(repoRoot, repoSurfaces);
assert.deepStrictEqual(
  repoControls.unclassified,
  [],
  `unclassified DOM/control producer source(s): ${repoControls.unclassified.map((item) => item.relative).join(', ')}`,
);

console.log('✅ audit-pro forensic/current-runtime corpus mutations passed with quarantine-aware storage');
console.log(
  `✅ source-surface DOM census: ${repoControls.totalControls} controls `
  + `(${repoControls.staticButtons} markup + ${repoControls.dynamicButtonFactories} dynamic), `
  + `${repoControls.jsFamilyControls} JS-family, ${repoControls.producerFiles.length} producer files, `
  + `${repoSurfaces.controlFiles.length} declared control-source files`,
);
