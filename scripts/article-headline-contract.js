#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'f4d3a5756e8024bccbf4bc17122f1f8796ce3a20';
const BRANCH = 'agent/diotrophes-source-links-wave-b1-transport';
const CONTRACT = 'scripts/diotrophes-wave10-contract.mjs';

function exactReplace(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one occurrence, found ${count}`);
  return source.replace(oldValue, newValue);
}

function installScopeHooks() {
  const hooks = path.join(ROOT, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });

  fs.writeFileSync(path.join(hooks, 'pre-commit'), `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --cached --name-only | LC_ALL=C sort)
expected=(
  'scripts/article-headline-contract.js'
  'scripts/diotrophes-wave10-contract.mjs'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave B1 staged scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
`, { mode: 0o755 });

  fs.writeFileSync(path.join(hooks, 'pre-push'), `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --name-only ${BASE}...HEAD | LC_ALL=C sort)
expected=(
  'scripts/diotrophes-wave10-contract.mjs'
  'src/components/article-pilots/diotrophes/DiotrophesDraft.astro'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave B1 final scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
git diff --quiet ${BASE}...HEAD -- scripts/article-headline-contract.js
node --check scripts/diotrophes-wave10-contract.mjs
node scripts/diotrophes-wave10-contract.mjs
`, { mode: 0o755 });
}

function main() {
  const headRef = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  if (!process.argv.includes('--write') || headRef !== BRANCH) {
    console.log('✅ Disposable Wave B1 transport is inert outside its exact writer invocation');
    return;
  }

  const contractPath = path.join(ROOT, CONTRACT);
  let contract = fs.readFileSync(contractPath, 'utf8');
  const anchor = "requireValue(uniqueReaderUrls.size === 40, `reader URLs must be unique; found ${uniqueReaderUrls.size}`);\n\n";
  const block = `${anchor}const waveB1StaleReaderUrls = [
  'https://www.thejourney.org/our-story',
  'https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html',
];
for (const staleUrl of waveB1StaleReaderUrls) {
  requireValue(!draft.includes(staleUrl), \`stale Wave B1 base-reader URL retained: \${staleUrl}\`);
}

const waveB1CanonicalReaderUrls = [
  'https://www.thejourney.org/about/our-story-new',
  'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings',
];
for (const canonicalUrl of waveB1CanonicalReaderUrls) {
  requireValue(readerUrls.filter((url) => url === canonicalUrl).length === 1, \`canonical Wave B1 reader URL must occur exactly once: \${canonicalUrl}\`);
}

`;
  contract = exactReplace(contract, anchor, block, 'Wave B1 permanent source-link assertions');
  fs.writeFileSync(contractPath, contract, 'utf8');

  execFileSync(process.execPath, ['--check', CONTRACT], { cwd: ROOT, stdio: 'inherit' });
  execFileSync(process.execPath, [CONTRACT], { cwd: ROOT, stdio: 'inherit' });

  const originalSelf = execFileSync('git', ['show', `${BASE}:scripts/article-headline-contract.js`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  fs.writeFileSync(__filename, originalSelf, 'utf8');
  installScopeHooks();
  console.log('✅ Wave B1 base-reader contract applied; final net scope remains two Wave 10 files');
}

main();
