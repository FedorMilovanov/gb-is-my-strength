#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const target = path.join(ROOT, 'dist', 'articles', 'krajne-li-isporcheno-serdce', 'index.html');
const audit = path.join(ROOT, 'scripts', 'schema-rich-results-audit.js');
const imageUrl = 'https://gospod-bog.ru/images/og-krajne-isporcheno.webp';

function runAudit(root) {
  return spawnSync(process.execPath, [audit, '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

function assertAuditPass(result, label) {
  assert.equal(result.status, 0, `${label} failed:\n${result.stdout}\n${result.stderr}`);
}

assertAuditPass(runAudit('.'), 'repository-root schema ownership audit');

assert.ok(fs.existsSync(target), 'built Krajne route missing; build production-like dist first');
const original = fs.readFileSync(target, 'utf8');

const baseline = runAudit('dist');
assertAuditPass(baseline, 'baseline dist schema audit');

const anchor = `"url": "${imageUrl}"`;
const anchorIndex = original.indexOf(anchor);
assert.ok(anchorIndex >= 0, 'Krajne Article ImageObject URL anchor missing');
assert.equal(original.indexOf(anchor, anchorIndex + anchor.length), -1, 'Krajne Article ImageObject URL anchor is not unique');

const widthMarker = '"width": 1200';
const widthIndex = original.indexOf(widthMarker, anchorIndex);
assert.ok(widthIndex > anchorIndex && widthIndex - anchorIndex < 800, 'Krajne ImageObject width=1200 missing near URL anchor');
const mutated = `${original.slice(0, widthIndex)}"width": 1199${original.slice(widthIndex + widthMarker.length)}`;

try {
  fs.writeFileSync(target, mutated);
  const result = runAudit('dist');
  assert.notEqual(result.status, 0, 'schema audit false-greened after declared Krajne width mutation');
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /ImageObject\.width 1199 (?:contradicts og:image:width 1200|does not match local webp width 1200)/,
    `schema audit failed for an unrelated reason:\n${output}`);
} finally {
  fs.writeFileSync(target, original);
}

const restored = runAudit('dist');
assertAuditPass(restored, 'restored dist schema audit');
console.log('Schema root-ownership + image-dimension mutation witness: PASS');
