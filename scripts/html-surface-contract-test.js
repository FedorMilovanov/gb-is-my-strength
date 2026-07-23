#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  auditHtmlDocument,
  auditProductionSurfaces,
  routeToHtmlFile,
} = require('./lib/html-surface-contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-surface-contract-'));
function put(rel, content = '') {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
put('images/ok.webp', 'x');
put('docs/file.pdf', 'x');
put('target/index.html', '<h1>Target</h1>');

const entry = { route: '/article/', surface: 'series', routeRole: 'reading', status: 'production-dist', section: 'Богословие' };
const knownRoutes = new Set(['/article/', '/target/']);
const valid = `<!doctype html><html><head>
<title>Article — Господь Бог — Сила Моя</title>
<link rel="canonical" href="https://gospod-bog.ru/article/">
<meta property="og:title" content="Article"><meta property="og:type" content="article">
<meta property="article:modified_time" content="2026-07-23"><meta property="article:section" content="Богословие">
<script>window.ok = true;</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>
</head><body><h1>Article</h1><div class="article-byline"></div>
<img src="/images/ok.webp" alt="ok"><a href="/target/">Target</a><a href="/docs/file.pdf">PDF</a>
</body></html>`;

assert.deepStrictEqual(auditHtmlDocument({ html: valid, route: '/article/', entry, root, knownRoutes }).filter((x) => x.severity === 'error'), []);
assert.strictEqual(routeToHtmlFile(root, '/article/'), path.join(root, 'article', 'index.html'));

function contracts(html) {
  return new Set(auditHtmlDocument({ html, route: '/article/', entry, root, knownRoutes }).map((x) => x.contract));
}
assert(contracts(valid.replace(' alt="ok"', '')).has('img-alt'));
assert(contracts(valid.replace('/images/ok.webp', '/images/missing.webp')).has('media-target'));
assert(contracts(valid.replace('/target/', '/missing/')).has('link-target'));
assert(contracts(valid.replace('<h1>Article</h1>', '')).has('document-h1'));
assert(contracts(valid.replace('<script>window.ok = true;</script>', '<script>const = ;</script>')).has('inline-script-syntax'));
assert(contracts(valid.replace('<div class="article-byline"></div>', '<div id="dup"></div><div id="dup"></div>')).has('duplicate-id'));
assert(contracts(valid.replace('{"@context":"https://schema.org","@type":"Article"}', '{bad json')).has('jsonld-parse'));

put('article/index.html', valid);
const registry = { entries: [entry] };
assert.deepStrictEqual(auditProductionSurfaces({ root, registry }).issues.filter((x) => x.severity === 'error'), []);
fs.unlinkSync(path.join(root, 'article/index.html'));
assert(auditProductionSurfaces({ root, registry }).issues.some((x) => x.contract === 'dist-html'));

fs.rmSync(root, { recursive: true, force: true });
console.log('✅ html surface contract mutations passed');
