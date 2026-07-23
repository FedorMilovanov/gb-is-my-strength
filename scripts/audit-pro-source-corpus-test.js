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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pro-source-corpus-'));
function put(rel, content = '<!doctype html>') {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

const home = put('index.html');
const article = put('articles/one/index.html');
const draft = put('draft/index.html');
const orphan = put('orphan/index.html');
const notFound = put('404.html');
const verification = put('google123.html');

const entries = [
  { route: '/', status: 'production-dist', surface: 'page' },
  { route: '/articles/one/', status: 'production-dist', surface: 'article' },
  { route: '/astro-only/', status: 'production-dist', surface: 'page' },
  { route: '/draft/', status: 'shadow-pilot', surface: 'page' },
];
const allHtmlFiles = [home, article, draft, orphan, notFound, verification];
const baseline = buildAuditProSourceCorpus({ root, entries, allHtmlFiles });

assert.strictEqual(routeToRootHtml(root, '/'), home);
assert.strictEqual(routeToRootHtml(root, '/articles/one/'), article);
assert.deepStrictEqual(baseline.sourcePages.map((item) => item.route), ['/', '/articles/one/']);
assert.deepStrictEqual(baseline.distOnly.map((item) => item.route), ['/astro-only/']);
assert.deepStrictEqual(baseline.registeredNonProduction.map((item) => item.route), ['/draft/']);
assert.deepStrictEqual(baseline.unregisteredRootHtml.map((item) => item.relative), ['orphan/index.html']);
assert.deepStrictEqual(baseline.duplicateRootMappings, []);
assert.strictEqual(baseline.productionRoutes, 3);

const synthetic = buildAuditProSourceCorpus({
  root,
  entries: [...entries, { route: '/future-native/', status: 'production-dist', surface: 'series' }],
  allHtmlFiles,
});
assert(synthetic.distOnly.some((item) => item.route === '/future-native/'));
assert(!synthetic.unregisteredRootHtml.some((item) => item.relative === 'future-native/index.html'));

fs.unlinkSync(article);
const removedShadow = buildAuditProSourceCorpus({ root, entries, allHtmlFiles: allHtmlFiles.filter((file) => file !== article) });
assert(removedShadow.distOnly.some((item) => item.route === '/articles/one/'));
assert(!removedShadow.sourcePages.some((item) => item.route === '/articles/one/'));

fs.rmSync(root, { recursive: true, force: true });
console.log('✅ audit-pro source corpus mutations passed');
