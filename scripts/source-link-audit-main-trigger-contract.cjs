#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github/workflows/source-links.yml');
const workflow = fs.readFileSync(WORKFLOW, 'utf8');

const EXPECTED_PUSH_PATHS = Object.freeze([
  '.github/workflows/source-links.yml',
  'scripts/source-link-audit.js',
  'scripts/source-link-audit-contract-test.cjs',
  'scripts/source-link-audit-source-contract-test.cjs',
  'scripts/source-link-audit-main-trigger-contract.cjs',
  'src/components/article-pilots/antisovetov/AntisovetovBody.astro',
  'src/components/article-pilots/diotrophes/DiotrophesDraft.astro',
  'data/diotrophes-wave11-faithful-witness-sources.json',
]);

function extractBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) return '';
  return source.slice(from, to);
}

function listQuotedPaths(block) {
  return [...block.matchAll(/^\s+- '([^']+)'\s*$/gm)].map((match) => match[1]);
}

function validate(source) {
  const problems = [];
  const pushBlock = extractBlock(source, '  push:\n', '  pull_request:\n');
  const pullRequestBlock = extractBlock(source, '  pull_request:\n', '\npermissions:\n');
  const pushPaths = listQuotedPaths(pushBlock);

  if (!pushBlock) problems.push('missing push trigger');
  if (!/^\s{4}branches:\n\s{6}- main\s*$/m.test(pushBlock)) problems.push('push must target main only');
  const branchBlock = extractBlock(pushBlock, '    branches:\n', '    paths:\n');
  if ((branchBlock.match(/^\s{6}- /gm) || []).length !== 1) problems.push('push branch count drift');
  if (JSON.stringify(pushPaths) !== JSON.stringify(EXPECTED_PUSH_PATHS)) problems.push('governed push path set drift');
  if (/[*?\[]/.test(pushPaths.join('\n'))) problems.push('broad or patterned push path introduced');
  if (!pullRequestBlock.includes("      - 'scripts/source-link-audit-main-trigger-contract.cjs'")) problems.push('PR trigger misses main-trigger contract');
  if (!source.includes('node --check scripts/source-link-audit-main-trigger-contract.cjs')) problems.push('main-trigger syntax check missing');
  if (!source.includes('node scripts/source-link-audit-main-trigger-contract.cjs')) problems.push('main-trigger contract execution missing');
  if (!/source-links:\n\s{4}if: github\.event_name != 'pull_request'/.test(source)) problems.push('network audit event boundary drift');
  if (!source.includes('Network checks also run after governed reader-source changes, never on unrelated pushes.')) problems.push('trigger policy comment drift');

  return problems;
}

assert.deepEqual(validate(workflow), []);

const mutations = [
  ['main branch removed', workflow.replace('      - main\n', '')],
  ['second push branch added', workflow.replace('      - main\n', '      - main\n      - release\n')],
  ['reader owner removed', workflow.replace("      - 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro'\n", '')],
  ['broad source glob introduced', workflow.replace("      - 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro'", "      - 'src/**/*.astro'")],
  ['contract PR trigger removed', workflow.replace("      - 'scripts/source-link-audit-main-trigger-contract.cjs'\n\npermissions:", '\npermissions:')],
  ['contract execution removed', workflow.replace('          node scripts/source-link-audit-main-trigger-contract.cjs\n', '')],
  ['network job narrowed away from push', workflow.replace("if: github.event_name != 'pull_request'", "if: github.event_name == 'schedule'")],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Source-link main trigger contract: PASS (${mutations.length} adversarial mutations rejected).`);
