#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const WRITE = process.argv.includes('--write');
assert.equal(WRITE, true, 'npm-security-lock-writer requires explicit --write');

const packages = [
  'fast-uri',
  'fast-xml-parser',
  'js-yaml',
  'nanoid',
  '@astrojs/language-server',
];
const expectedBlob = '43a85292e04c8374996058f8868467f30808a089';

execFileSync('npm', ['update', ...packages, '--package-lock-only', '--ignore-scripts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

const blob = execFileSync('git', ['hash-object', 'package-lock.json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
}).trim();

assert.equal(blob, expectedBlob, `reviewed package-lock blob mismatch: ${blob}`);
console.log(`NPM SECURITY LOCK WRITER: PASS (${blob})`);
