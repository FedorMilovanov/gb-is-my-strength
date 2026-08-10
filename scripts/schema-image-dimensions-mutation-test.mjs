#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const target = path.join(ROOT, 'dist', 'articles', 'krajne-li-isporcheno-serdce', 'index.html');
const audit = path.join(ROOT, 'scripts', 'schema-rich-results-audit.js');
const imageUrl = 'https://gospod-bog.ru/images/og-krajne-isporcheno.webp';

function runAudit() {
  return spawnSync(process.execPath, [audit, '--root', 'dist'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

assert.ok(fs.existsSync(target), 'built Krajne route missing; build production-like dist first');
const original = fs.readFileSync(target, 'utf8');

const baseline = runAudit();
assert.equal(baseline.status, 0, `baseline schema audit failed:\n${baseline.stdout}\n${baseline.stderr}`);

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
  const result = runAudit();
  assert.notEqual(result.status, 0, 'schema audit false-greened after declared Krajne width mutation');
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /ImageObject\.width 1199 (?:contradicts og:image:width 1200|does not match local webp width 1200)/,
    `schema audit failed for an unrelated reason:\n${output}`);
} finally {
  fs.writeFileSync(target, original);
}

const restored = runAudit();
assert.equal(restored.status, 0, `restored schema audit failed:\n${restored.stdout}\n${restored.stderr}`);
console.log('Schema image-dimension mutation witness: PASS');
