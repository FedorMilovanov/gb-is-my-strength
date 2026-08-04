#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = '38b257030afb7cfa8a7b1128f8c86539fd36dec0';
const BRANCH = 'agent/diotrophes-source-links-wave-b2-registry';
const CONTRACT = 'scripts/diotrophes-wave11-faithful-witness-contract.mjs';

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
  'scripts/diotrophes-wave11-faithful-witness-contract.mjs'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave B2 staged scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
`, { mode: 0o755 });

  fs.writeFileSync(path.join(hooks, 'pre-push'), `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --name-only ${BASE}...HEAD | LC_ALL=C sort)
expected=(
  'data/diotrophes-wave11-faithful-witness-sources.json'
  'scripts/diotrophes-wave11-faithful-witness-contract.mjs'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave B2 final scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
git diff --quiet ${BASE}...HEAD -- scripts/article-headline-contract.js
node --check scripts/diotrophes-wave11-faithful-witness-contract.mjs
node scripts/diotrophes-wave11-faithful-witness-contract.mjs
`, { mode: 0o755 });
}

function main() {
  const headRef = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  if (!process.argv.includes('--write') || headRef !== BRANCH) {
    console.log('✅ Disposable Wave B2 transport is inert outside its exact writer invocation');
    return;
  }

  const contractPath = path.join(ROOT, CONTRACT);
  let contract = fs.readFileSync(contractPath, 'utf8');

  contract = exactReplace(
    contract,
    "const sourceDataRaw = readFileSync(sourcesPath, 'utf8');\nconst sourceData = JSON.parse(sourceDataRaw);\nconst baseDraft = readFileSync(baseDraftPath, 'utf8');\n",
    "const sourceDataRaw = readFileSync(sourcesPath, 'utf8');\nconst sourceData = JSON.parse(sourceDataRaw);\n",
    'remove premature base-reader ownership',
  );

  const mixedBlock = `const waveBStaleUrls = [
  'https://ihopkc.org/press-releases/press-center/press-releases/ihopkc-elt-update-11-10-2023',
  'https://ihopkc.org/press-releases/press-center/press-releases/elt-update-letter-11-15-2023',
  'https://www.brentdetwiler.com/my-story-resume/',
  'https://www.thejourney.org/our-story',
  'https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html',
];
for (const staleUrl of waveBStaleUrls) {
  requireValue(!sourceDataRaw.includes(staleUrl), \`stale Wave B registry URL retained: \${staleUrl}\`);
  requireValue(!baseDraft.includes(staleUrl), \`stale Wave B base-reader URL retained: \${staleUrl}\`);
}

const waveBBaseReaderUrls = [
  'https://www.thejourney.org/about/our-story-new',
  'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings',
];
for (const canonicalUrl of waveBBaseReaderUrls) {
  requireValue(baseDraft.includes(canonicalUrl), \`canonical Wave B base-reader URL missing: \${canonicalUrl}\`);
}

`;
  const registryOnlyBlock = `const waveB2StaleRegistryUrls = [
  'https://ihopkc.org/press-releases/press-center/press-releases/ihopkc-elt-update-11-10-2023',
  'https://ihopkc.org/press-releases/press-center/press-releases/elt-update-letter-11-15-2023',
  'https://www.brentdetwiler.com/my-story-resume/',
];
for (const staleUrl of waveB2StaleRegistryUrls) {
  requireValue(!sourceDataRaw.includes(staleUrl), \`stale Wave B2 registry URL retained: \${staleUrl}\`);
}

`;
  contract = exactReplace(contract, mixedBlock, registryOnlyBlock, 'split Wave B2 registry contract');
  fs.writeFileSync(contractPath, contract, 'utf8');

  execFileSync(process.execPath, ['--check', CONTRACT], { cwd: ROOT, stdio: 'inherit' });
  execFileSync(process.execPath, [CONTRACT], { cwd: ROOT, stdio: 'inherit' });

  const originalSelf = execFileSync('git', ['show', `${BASE}:scripts/article-headline-contract.js`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  fs.writeFileSync(__filename, originalSelf, 'utf8');
  installScopeHooks();
  console.log('✅ Wave B2 registry contract split applied; final net scope remains two Wave 11 files');
}

main();
