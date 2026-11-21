#!/usr/bin/env node
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = path.join(ROOT, 'scripts/content-authoring-publication-contract.mjs');

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function mdx({ slug, section = 'articles', draft = false }) {
  return `---\ntitle: Fixture article title\nslug: ${slug}\nsection: ${section}\ndraft: ${draft}\n---\n\nBody.\n`;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-authoring-'));
  write(path.join(root, 'src/content/articles/alpha-one.mdx'), mdx({ slug: 'alpha-one' }));
  write(path.join(root, 'src/pages/articles/alpha-one/index.astro'), '<html></html>');
  write(path.join(root, 'data/series.json'), JSON.stringify({
    'fixture-series': {
      title: 'Fixture',
      baseUrl: '/articles/',
      parts: [{ n: 1, slug: 'alpha-one', title: 'Alpha', status: 'published' }],
    },
  }));
  return root;
}

function run(root, env = {}) {
  return cp.spawnSync(process.execPath, [
    CONTRACT,
    `--content-dir=${path.join(root, 'src/content/articles')}`,
    `--series=${path.join(root, 'data/series.json')}`,
    `--pages-dir=${path.join(root, 'src/pages')}`,
  ], { encoding: 'utf8', env: { ...process.env, ...env } });
}

// 1. Consistent fixture → PASS
let root = fixture();
let result = run(root);
assert.equal(result.status, 0, `consistent fixture must pass: ${result.stderr}`);
assert.match(result.stdout, /PASS/);

// 2. Orphan publishable MDX (no route) → FAIL (negative witness)
root = fixture();
write(path.join(root, 'src/content/articles/beta-orphan.mdx'), mdx({ slug: 'beta-orphan' }));
result = run(root);
assert.equal(result.status, 1, `orphan MDX must fail: ${result.stdout}`);
assert.match(result.stderr, /orphan-content: articles\/beta-orphan/);

// 3. Draft MDX without route → PASS (drafts are not publishable)
root = fixture();
write(path.join(root, 'src/content/articles/gamma-draft.mdx'), mdx({ slug: 'gamma-draft', draft: true }));
result = run(root);
assert.equal(result.status, 0, `draft without route must pass: ${result.stderr}`);
assert.match(result.stdout, /drafts skipped=1/);

// 4. Config-only published series part → FAIL (negative witness: the Pastor defect)
root = fixture();
write(path.join(root, 'data/series.json'), JSON.stringify({
  'fixture-series': {
    title: 'Fixture',
    baseUrl: '/articles/',
    parts: [
      { n: 1, slug: 'alpha-one', title: 'Alpha', status: 'published' },
      { n: 2, slug: 'delta-missing', title: 'Delta', status: 'published' },
    ],
  },
}));
result = run(root);
assert.equal(result.status, 1, `config-only published part must fail: ${result.stdout}`);
assert.match(result.stderr, /config-only-series-item: "fixture-series" part "delta-missing"/);

// 5. Planned (non-published) series part without route → PASS
root = fixture();
write(path.join(root, 'data/series.json'), JSON.stringify({
  'fixture-series': {
    title: 'Fixture',
    baseUrl: '/articles/',
    parts: [
      { n: 1, slug: 'alpha-one', title: 'Alpha', status: 'published' },
      { n: 2, slug: 'epsilon-planned', title: 'Epsilon', status: 'planned' },
    ],
  },
}));
result = run(root);
assert.equal(result.status, 0, `planned part without route must pass: ${result.stderr}`);
assert.match(result.stdout, /non-published skipped=1/);

// 6. Malformed series manifest → usage error exit 2
root = fixture();
write(path.join(root, 'data/series.json'), '{ not json');
result = run(root);
assert.equal(result.status, 2, `malformed series manifest must exit 2: ${result.stdout}`);

// 7. Series part without slug → usage error exit 2
root = fixture();
write(path.join(root, 'data/series.json'), JSON.stringify({
  'fixture-series': { title: 'Fixture', parts: [{ n: 1, title: 'No slug', status: 'published' }] },
}));
result = run(root);
assert.equal(result.status, 2, `part without slug must exit 2: ${result.stdout}`);

console.log('✅ content authoring publication contract test passed (7 cases, incl. 3 negative witnesses)');
