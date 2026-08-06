#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { loadJson, resolveRoutePolicy, validateAuthority } = require('./lib/visual-parity-authority.cjs');
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

function parseArgs(argv) {
  const args = {
    root: ROOT,
    ownership: null,
    authority: null,
    baseline: null,
    outJson: null,
    outMd: null,
    selfTest: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') args.root = path.resolve(argv[++index]);
    else if (value === '--ownership') args.ownership = path.resolve(argv[++index]);
    else if (value === '--authority') args.authority = path.resolve(argv[++index]);
    else if (value === '--baseline') args.baseline = path.resolve(argv[++index]);
    else if (value === '--out-json') args.outJson = path.resolve(argv[++index]);
    else if (value === '--out-md') args.outMd = path.resolve(argv[++index]);
    else if (value === '--self-test') args.selfTest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  args.ownership ||= path.join(args.root, 'migration', 'page-ownership.json');
  args.authority ||= path.join(args.root, 'data', 'visual-parity-authority.json');
  args.baseline ||= path.join(args.root, 'data', 'visual-parity-baseline.json');
  return args;
}

function renderMarkdown(report) {
  return `# Visual parity authority transfer\n\n` +
    `- Authority: \`${report.authorityId}\`\n` +
    `- Ownership source: \`${report.ownershipSource}\`\n` +
    `- Governed routes: **${report.summary.routes}**\n` +
    `- Astro native-contract routes: **${report.summary.astro}**\n` +
    `- Built-app contract routes: **${report.summary.builtApp}**\n` +
    `- Remaining legacy-diff route owners: **${report.summary.legacyDiff}**\n` +
    `- Legacy root-vs-dist screenshots: **diagnostic only after this transfer**\n` +
    `- Shadow deletion authorized by this report: **no**\n\n` +
    `## Retirement boundary\n\n` +
    `The 51 retained Astro root HTML files may be considered for deletion only in a later route-bounded lane after every non-parity reader has been removed or repointed and source/dist/browser evidence passes without them.\n`;
}

function runSelfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-authority-'));
  try {
    for (const guard of ['a.js', 'b.js', 'c.js', 'measure.mjs']) {
      fs.writeFileSync(path.join(temp, guard), '');
    }
    const ownership = {
      routes: {
        '/native/': { owner: 'astro', status: 'production-dist', source: 'src/pages/native.astro' },
        '/app/': { owner: 'built-app', status: 'copy-as-built-asset', source: 'app/' },
      },
    };
    const authority = {
      ownershipSource: 'migration/page-ownership.json',
      policy: { legacyHtmlDeletionAuthority: false },
      ownerPolicies: {
        astro: { mode: 'native-contract', requiredGuards: ['a.js', 'b.js', 'c.js'] },
        'built-app': { mode: 'built-app-contract', requiredGuards: ['a.js', 'b.js', 'measure.mjs'] },
      },
    };
    const valid = validateAuthority({ root: temp, ownership, authority });
    if (valid.problems.length || valid.summary.nativeContract !== 1 || valid.summary.builtAppContract !== 1) {
      throw new Error(`valid fixture failed: ${JSON.stringify(valid)}`);
    }
    const broken = structuredClone(authority);
    broken.ownerPolicies.astro.mode = 'legacy-diff';
    const invalid = validateAuthority({ root: temp, ownership, authority: broken });
    if (!invalid.problems.some((problem) => problem.includes('Astro-owned route must resolve'))) {
      throw new Error(`invalid fixture did not fail closed: ${JSON.stringify(invalid)}`);
    }
    console.log('✅ visual parity authority self-test passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.selfTest) {
  runSelfTest();
  process.exit(0);
}

const ownership = loadJson(args.ownership);
const authority = loadJson(args.authority);
const baseline = fs.existsSync(args.baseline) ? loadJson(args.baseline) : null;
const validation = validateAuthority({ root: args.root, ownership, authority, baseline });
const routes = Object.keys(ownership.routes || {}).sort().map((route) => resolveRoutePolicy({ route, ownership, authority, baseline }));
const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  authorityId: authority.authorityId,
  ownershipSource: authority.ownershipSource,
  summary: validation.summary,
  deletionAuthorized: false,
  routes: routes.map((entry) => ({
    route: entry.route,
    mode: entry.mode,
    owner: entry.ownership?.owner || null,
    status: entry.ownership?.status || null,
    source: entry.ownership?.source || null,
    requiredGuards: entry.requiredGuards,
  })),
  problems: validation.problems,
};

if (args.outJson) {
  fs.mkdirSync(path.dirname(args.outJson), { recursive: true });
  fs.writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
}
if (args.outMd) {
  fs.mkdirSync(path.dirname(args.outMd), { recursive: true });
  fs.writeFileSync(args.outMd, renderMarkdown(report));
}

if (validation.problems.length) {
  validation.problems.forEach((problem) => console.error(`❌ ${problem}`));
  process.exit(1);
}
console.log(`✅ visual parity authority transferred: ${validation.summary.astro} Astro route(s), ${validation.summary.builtApp} built app(s), ${validation.summary.legacyDiff} blocking legacy-diff owner(s)`);
