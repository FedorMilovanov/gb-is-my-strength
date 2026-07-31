#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
console.log(`NODE TOOLCHAIN PIN CONTRACT: PASS (${declarations.length} exact declarations; Node ${toolchain.node}; npm ${toolchain.npm})`);
