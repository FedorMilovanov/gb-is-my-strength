#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workflowDir = path.join(process.cwd(), '.github', 'workflows');
const declarations = [];
const violations = [];
for (const name of fs.readdirSync(workflowDir).filter((entry) => /\.ya?ml$/.test(entry)).sort()) {
  const source = fs.readFileSync(path.join(workflowDir, name), 'utf8');
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
    if (!match) continue;
    const value = match[1].replace(/^['"]|['"]$/g, '');
    declarations.push({ name, line: index + 1, value });
    if (value.startsWith('./')) continue;
    if (value.startsWith('docker://')) {
      if (!/^docker:\/\/[^@]+@sha256:[0-9a-f]{64}$/i.test(value)) {
        violations.push(`${name}:${index + 1}: mutable Docker action ${value}`);
      }
      continue;
    }
    const separator = value.lastIndexOf('@');
    const ref = separator >= 0 ? value.slice(separator + 1) : '';
    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      violations.push(`${name}:${index + 1}: external action is not pinned to a 40-hex commit: ${value}`);
    }
  }
}
assert.ok(declarations.length >= 100, `expected at least 100 action declarations, found ${declarations.length}`);
assert.deepEqual(violations, [], `all external actions must be immutable:
${violations.join('\n')}`);
console.log(`GLOBAL GITHUB ACTIONS PIN CONTRACT: PASS (${declarations.length} declarations)`);
