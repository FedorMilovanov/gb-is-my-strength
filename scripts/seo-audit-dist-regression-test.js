#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  canonicalUrlForRoute,
  collectProductionHtmlTargets,
} = require('./lib/seo-route-targets');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const AUDIT = path.join(ROOT, 'scripts', 'seo-audit.js');

function runAudit() {
  return spawnSync(process.execPath, [AUDIT, '--root', 'dist', '--registry'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function output(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function expectFailure(label, expectedText) {
  const result = runAudit();
  assert.notEqual(result.status, 0, `${label}: mutation must fail SEO dist audit`);
  assert.match(output(result), expectedText, `${label}: expected diagnostic not found`);
}

function mutateAndRestore(file, mutate, assertion) {
  const original = fs.readFileSync(file, 'utf8');
  const mutated = mutate(original);
  assert.notEqual(mutated, original, `${path.relative(ROOT, file)}: mutation did not change HTML`);
  try {
    fs.writeFileSync(file, mutated);
    assertion();
  } finally {
    fs.writeFileSync(file, original);
  }
}

assert.ok(fs.existsSync(DIST), 'dist/ must exist; run a production-like build first');
const targets = collectProductionHtmlTargets(DIST);
assert.equal(targets.length, 75, 'canonical registry must expose 75 production HTML routes');
assert.deepEqual(
  targets.filter((target) => !target.exists).map((target) => target.route),
  [],
  'production build must materialize every registry route before mutation tests'
);

const baseline = runAudit();
assert.equal(baseline.status, 0, `baseline SEO dist audit failed:\n${output(baseline)}`);

const astroOnly = targets.find((target) => !fs.existsSync(path.join(ROOT, target.htmlRelative)));
assert.ok(astroOnly, 'fixture must contain a production route without committed root HTML');

const backup = `${astroOnly.absolute}.seo-audit-backup`;
assert.ok(!fs.existsSync(backup), `${backup}: stale mutation backup`);
try {
  fs.renameSync(astroOnly.absolute, backup);
  expectFailure('missing Astro-only route', /production HTML missing/);
} finally {
  if (fs.existsSync(backup)) fs.renameSync(backup, astroOnly.absolute);
}

const expectedCanonical = canonicalUrlForRoute(astroOnly.route, 'https://gospod-bog.ru');
mutateAndRestore(
  astroOnly.absolute,
  (html) => html.replace(expectedCanonical, 'https://example.com/mutated-canonical/'),
  () => expectFailure('Astro-only canonical mismatch', /canonical mismatch/)
);

const noindexTarget = targets.find((target) => !target.indexable);
assert.ok(noindexTarget, 'fixture must contain an explicit noindex production route');
mutateAndRestore(
  noindexTarget.absolute,
  (html) => html.replace(/noindex/i, 'index'),
  () => expectFailure('explicit noindex removed', /profile seo\.indexable=false but rendered robots lacks noindex/)
);

const finalPass = runAudit();
assert.equal(finalPass.status, 0, `SEO dist audit did not recover after mutations:\n${output(finalPass)}`);

console.log(
  `✅ SEO dist regression: ${targets.length} routes, Astro-only ${astroOnly.route}, noindex ${noindexTarget.route}`
);
