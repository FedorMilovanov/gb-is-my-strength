#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/note-registry-core.yml');
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

function assertContract(source) {
  const failures = [];
  const requireText = (needle, label) => {
    if (!source.includes(needle)) failures.push(`missing ${label}`);
  };
  const forbidText = (needle, label) => {
    if (source.includes(needle)) failures.push(`forbidden ${label}`);
  };

  requireText("      - '.github/workflows/note-registry-core.yml'", 'workflow self-trigger');
  requireText("      - 'scripts/note-registry-workflow-contract-test.mjs'", 'workflow-contract path trigger');
  requireText('name: Run NoteRegistry workflow policy contract', 'workflow-contract step');
  requireText('run: node scripts/note-registry-workflow-contract-test.mjs', 'workflow-contract execution');

  forbidText('Enforce A03 closure scope', 'retired whole-PR closure gate');
  forbidText('/tmp/note-registry-files.txt', 'retired temporary scope materializer');
  forbidText('Unexpected files in A03 closure lane', 'retired closure-lane assertion');

  requireText('name: Install dependencies\n        id: dependencies', 'dependency outcome owner');
  requireText('name: Build exact-head production-like dist\n        id: build', 'build outcome owner');
  requireText('name: Install Playwright browser engines\n        id: browsers', 'browser-install outcome owner');

  const prerequisiteGuard = "if: always() && steps.dependencies.outcome == 'success' && steps.build.outcome == 'success' && steps.browsers.outcome == 'success'";
  const guardCount = source.split(prerequisiteGuard).length - 1;
  if (guardCount !== 2) failures.push(`expected two prerequisite browser guards, found ${guardCount}`);

  requireText('name: Verify Hermenevtika NoteRegistry in Firefox', 'Firefox witness');
  requireText('name: Verify Hermenevtika NoteRegistry in WebKit', 'WebKit witness');
  requireText('name: Upload exact-head NoteRegistry evidence\n        if: always()', 'always-upload evidence step');

  return failures;
}

const failures = assertContract(workflow);
if (failures.length) {
  console.error('❌ NoteRegistry workflow policy contract failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

const mutations = [
  {
    name: 'whole-PR closure gate returns',
    source: `${workflow}\n# Enforce A03 closure scope\n`,
  },
  {
    name: 'dependency outcome owner disappears',
    source: workflow.replace('name: Install dependencies\n        id: dependencies', 'name: Install dependencies'),
  },
  {
    name: 'one browser witness becomes unguarded',
    source: workflow.replace(
      "if: always() && steps.dependencies.outcome == 'success' && steps.build.outcome == 'success' && steps.browsers.outcome == 'success'",
      'if: always()',
    ),
  },
  {
    name: 'self-execution disappears',
    source: workflow.replace('run: node scripts/note-registry-workflow-contract-test.mjs', 'run: node --version'),
  },
];

for (const mutation of mutations) {
  const mutationFailures = assertContract(mutation.source);
  if (!mutationFailures.length) {
    console.error(`❌ Mutation was not rejected: ${mutation.name}`);
    process.exit(1);
  }
}

console.log('✅ NoteRegistry workflow policy contract passed: path-trigger ownership, no retired closure gate, prerequisite-gated Firefox/WebKit, fail-closed mutation coverage.');
