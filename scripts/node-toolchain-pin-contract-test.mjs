#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { spawnNpm, assertNumericStatus, quoteWindowsNpmArg } = require('./lib/npm-spawn.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolchain = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/release-toolchain.json'), 'utf8'));
assert.match(toolchain.node, /^22\.\d+\.\d+$/, 'canonical Node must be an exact Node 22 patch');
assert.match(toolchain.npm, /^10\.\d+\.\d+$/, 'canonical npm must be an exact npm 10 patch');

const workflowDir = path.join(ROOT, '.github', 'workflows');
const declarations = [];
const mismatches = [];
for (const name of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.yml')).sort()) {
  const source = fs.readFileSync(path.join(workflowDir, name), 'utf8');
  for (const match of source.matchAll(/node-version:\s*['\"]?([^'\"\s#]+)['\"]?/g)) {
    const value = match[1];
    declarations.push({ name, value });
    if (value !== toolchain.node) mismatches.push(`${name}: node-version ${value}`);
  }
}
assert.ok(declarations.length >= 35, `expected at least 35 setup-node declarations, found ${declarations.length}`);
assert.deepEqual(mismatches, [], `all workflow Node runtimes must equal ${toolchain.node}:\n${mismatches.join('\n')}`);

const deploy = fs.readFileSync(path.join(workflowDir, 'deploy.yml'), 'utf8');
assert.match(deploy, new RegExp(`RELEASE_NODE_VERSION:\\s*['\"]${toolchain.node.replaceAll('.', '\\.')}['\"]`));
assert.match(deploy, new RegExp(`RELEASE_NPM_VERSION:\\s*['\"]${toolchain.npm.replaceAll('.', '\\.')}['\"]`));
const candidate = fs.readFileSync(path.join(workflowDir, 'deploy-candidate-contract.yml'), 'utf8');
assert.ok(candidate.includes(`npm@${toolchain.npm}`), 'deploy candidate must install canonical npm');

const npmProbe = spawnNpm(['--version'], { cwd: ROOT, encoding: 'utf8' });
assert.equal(npmProbe.status, 0, 'canonical npm helper must return numeric zero status');
assert.equal(String(npmProbe.stdout || '').trim(), toolchain.npm, 'npm helper must execute the pinned npm version');

const syntheticEinval = Object.assign(new Error('synthetic npm launch failure'), { code: 'EINVAL' });
assert.throws(
  () => assertNumericStatus({ status: null, signal: null, error: syntheticEinval }, 'synthetic npm'),
  /launch failed \(EINVAL\)/,
  'npm launch errors must fail closed instead of degrading to status zero',
);
assert.throws(
  () => assertNumericStatus({ status: null, signal: null, error: null }, 'synthetic npm'),
  /without numeric status/,
  'npm results without numeric status must fail closed',
);
assert.throws(
  () => quoteWindowsNpmArg('safe & unsafe'),
  /unsafe Windows npm argument/,
  'Windows npm shell arguments must reject command metacharacters before launch',
);

function walkScripts(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkScripts(full) : [full];
  });
}
const npmHelper = path.join(ROOT, 'scripts', 'lib', 'npm-spawn.js');
const thisContract = fileURLToPath(import.meta.url);
const directNpmSpawn = /(?:spawnSync|spawn|execFileSync|execFile)\s*\(\s*(?:['\"]npm(?:\.cmd)?['\"]|npmCmd|npm)\b/;
const npmCmdLiteral = new RegExp(['npm', 'cmd'].join('\\.'));
const unsafeNpmLaunches = walkScripts(path.join(ROOT, 'scripts'))
  .filter((file) => /\.(?:c?js|mjs)$/.test(file))
  .filter((file) => file !== npmHelper && file !== thisContract)
  .flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const reasons = [];
    if (directNpmSpawn.test(source)) reasons.push('direct npm child-process call');
    if (npmCmdLiteral.test(source)) reasons.push('raw npm.cmd literal');
    return reasons.map((reason) => `${path.relative(ROOT, file)}: ${reason}`);
  });
assert.deepEqual(unsafeNpmLaunches, [], `npm child-process launches must use scripts/lib/npm-spawn.js:\n${unsafeNpmLaunches.join('\n')}`);

console.log(`NODE TOOLCHAIN PIN CONTRACT: PASS (${declarations.length} exact declarations; Node ${toolchain.node}; npm ${toolchain.npm}; portable npm spawn fail-closed)`);
