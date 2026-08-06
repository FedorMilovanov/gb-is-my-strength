#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

function parseArgs(argv) {
  const args = { root: DEFAULT_ROOT, outJson: null, outMd: null, selfTest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') args.root = path.resolve(argv[++index]);
    else if (value === '--out-json') args.outJson = path.resolve(argv[++index]);
    else if (value === '--out-md') args.outMd = path.resolve(argv[++index]);
    else if (value === '--self-test') args.selfTest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function normalize(value) {
  return String(value).replace(/\\/g, '/');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function gitBlobSha1(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function runInventory(root) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-shadow-readiness-'));
  const out = path.join(temp, 'inventory.json');
  try {
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'strangler-duplicate-inventory.mjs'),
      '--root', root,
      '--out-json', out,
    ], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`strangler inventory failed (${result.status}): ${result.stdout}\n${result.stderr}`);
    }
    return loadJson(out);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function loadLedger(root) {
  const manifestPath = path.join(root, 'data', 'legacy-reference-ledger', 'manifest.json');
  const manifest = loadJson(manifestPath);
  const entries = [];
  for (const relative of manifest.referenceShards || []) {
    const shard = loadJson(path.join(root, relative));
    for (const entry of shard.entries || []) entries.push(entry);
  }
  return { manifest, entries };
}

function resolveParity(root, ownership, authority) {
  const policyFor = (meta) => {
    const owner = String(meta?.owner || '');
    const status = String(meta?.status || '');
    if (owner === 'built-app' || status === 'copy-as-built-asset') return authority.ownerPolicies?.['built-app'];
    if (owner.startsWith('astro')) return authority.ownerPolicies?.astro;
    return null;
  };
  const problems = [];
  let astro = 0;
  let builtApp = 0;
  for (const [route, meta] of Object.entries(ownership.routes || {})) {
    const policy = policyFor(meta);
    if (String(meta.owner || '').startsWith('astro')) {
      astro += 1;
      if (policy?.mode !== 'native-contract') problems.push(`${route}: Astro route lacks native-contract authority`);
    }
    if (meta.owner === 'built-app' || meta.status === 'copy-as-built-asset') {
      builtApp += 1;
      if (policy?.mode !== 'built-app-contract') problems.push(`${route}: built app lacks built-app-contract authority`);
    }
    for (const guard of policy?.requiredGuards || []) {
      if (!fs.existsSync(path.join(root, guard))) problems.push(`${route}: required guard missing: ${guard}`);
    }
  }
  return { astro, builtApp, problems, clear: problems.length === 0 };
}

function classifyDependency(dependency) {
  const impact = dependency.quarantineImpact || 'unknown';
  if (impact === 'none-fixture-policy-or-comment-only') return 'nonblocking';
  if (impact === 'must-update-before-move') return 'mechanical-repoint';
  if (impact === 'remove-or-repoint-before-move') return 'obsolete-or-repoint';
  if (impact === 'owner-decision-required') return 'owner-decision';
  return 'unknown-impact';
}

function audit(root) {
  const inventory = runInventory(root);
  const { manifest, entries } = loadLedger(root);
  const ownership = loadJson(path.join(root, 'migration', 'page-ownership.json'));
  const authority = loadJson(path.join(root, 'data', 'visual-parity-authority.json'));
  const parity = resolveParity(root, ownership, authority);
  const byPath = new Map(entries.map((entry) => [normalize(entry.legacyPath), entry]));
  const byRoute = new Map(entries.map((entry) => [entry.route, entry]));
  const nativeShadows = inventory.items.filter((item) => item.classification === 'native-shadow');
  const builtApps = inventory.items.filter((item) => item.classification === 'owned-independent');
  const integrityProblems = [];
  const shadowRows = nativeShadows.map((item) => {
    const entry = byPath.get(normalize(item.path)) || byRoute.get(item.route) || null;
    if (!entry) {
      integrityProblems.push(`${item.path}: missing immutable ledger entry`);
      return { ...item, ledger: null, decision: 'missing-ledger' };
    }
    const absolute = path.join(root, item.path);
    const buffer = fs.readFileSync(absolute);
    const actualBlob = gitBlobSha1(buffer);
    const actualSha256 = sha256(buffer);
    if (actualBlob !== entry.gitBlobSha1) integrityProblems.push(`${item.path}: Git blob mismatch`);
    if (actualSha256 !== entry.byteSha256) integrityProblems.push(`${item.path}: byte SHA-256 mismatch`);
    const decision = entry.classification === 'migration-reference-only'
      ? 'classification-clear'
      : entry.classification === 'unknown-blocker'
        ? 'owner-decision-required'
        : `unexpected-${entry.classification}`;
    return {
      route: item.route,
      path: item.path,
      bytes: item.bytes,
      gitBlobSha1: entry.gitBlobSha1,
      byteSha256: entry.byteSha256,
      classification: entry.classification,
      declaredLegacyStatus: entry.declaredLegacyStatus,
      profile: entry.profile,
      decision,
    };
  });

  const dependencies = (manifest.dependencies || []).map((dependency) => ({
    ...dependency,
    retirementClass: classifyDependency(dependency),
  }));
  const dependencyGroups = Object.groupBy
    ? Object.groupBy(dependencies, (dependency) => dependency.retirementClass)
    : dependencies.reduce((groups, dependency) => {
        (groups[dependency.retirementClass] ||= []).push(dependency);
        return groups;
      }, {});

  const unknownReferenceRows = shadowRows.filter((row) => row.decision === 'owner-decision-required');
  const classificationClearRows = shadowRows.filter((row) => row.decision === 'classification-clear');
  const mechanical = dependencyGroups['mechanical-repoint'] || [];
  const obsolete = dependencyGroups['obsolete-or-repoint'] || [];
  const decisions = dependencyGroups['owner-decision'] || [];
  const unknownImpact = dependencyGroups['unknown-impact'] || [];
  const nonblocking = dependencyGroups.nonblocking || [];
  const blockers = {
    referenceOwnerDecisions: unknownReferenceRows.length,
    mechanicalRepoints: mechanical.length,
    obsoleteOrRepoint: obsolete.length,
    dependencyOwnerDecisions: decisions.length,
    unknownDependencyImpacts: unknownImpact.length,
    integrityProblems: integrityProblems.length,
    parityProblems: parity.problems.length,
  };
  const blockerTotal = Object.values(blockers).reduce((sum, value) => sum + value, 0);

  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: {
      inventory: 'scripts/strangler-duplicate-inventory.mjs',
      ledger: 'data/legacy-reference-ledger/manifest.json',
      ownership: 'migration/page-ownership.json',
      parityAuthority: 'data/visual-parity-authority.json',
    },
    summary: {
      publicIndexes: inventory.summary.publicIndexFiles,
      nativeShadows: nativeShadows.length,
      nativeShadowBytes: nativeShadows.reduce((sum, item) => sum + item.bytes, 0),
      builtApps: builtApps.length,
      ledgerEntries: entries.length,
      classificationClearReferences: classificationClearRows.length,
      unknownReferenceDecisions: unknownReferenceRows.length,
      dependencyRecords: dependencies.length,
      nonblockingDependencies: nonblocking.length,
      ...blockers,
      blockerTotal,
      parityAuthorityClear: parity.clear,
      deletionReady: blockerTotal === 0,
      physicalMoveAuthorized: blockerTotal === 0,
    },
    verdict: blockerTotal === 0
      ? 'SAFE_TO_OPEN_ATOMIC_QUARANTINE_MOVE'
      : 'NOT_YET_SAFE_TO_MOVE_OR_DELETE',
    reason: blockerTotal === 0
      ? 'All immutable identities, owner decisions, dependency repoints and parity authority are complete.'
      : 'Parity authority is transferred, but reference decisions and/or direct readers still block physical retirement.',
    parity,
    blockers: {
      unknownReferences: unknownReferenceRows,
      mechanicalRepoints: mechanical,
      obsoleteOrRepoint: obsolete,
      dependencyOwnerDecisions: decisions,
      unknownDependencyImpacts: unknownImpact,
      integrityProblems,
    },
    nonblockingDependencies: nonblocking,
    nativeShadows: shadowRows,
    builtApps: builtApps.map((item) => ({ route: item.route, path: item.path, bytes: item.bytes })),
    nextTransaction: {
      order: [
        'resolve 30 missing reference classifications in route profiles/ledger',
        'repoint policy readers through migration/legacy-reference-path.js',
        'remove or repoint obsolete legacy audits',
        'decide the remaining direct-reader contracts',
        'rerun this report until blockerTotal=0',
        'perform one atomic blob-preserving move to migration/legacy-reference/**',
        'prove production-like dist, Pagefind, browser routes and no quarantine publication',
      ],
      deleteBuiltApp: false,
      deleteNativeShadowsNow: blockerTotal === 0,
    },
  };
}

function renderMarkdown(report) {
  const s = report.summary;
  const lines = [
    '# Legacy shadow retirement readiness',
    '',
    `Verdict: **${report.verdict}**`,
    '',
    `- Public index files: **${s.publicIndexes}**`,
    `- Astro native shadows: **${s.nativeShadows}** / **${s.nativeShadowBytes} bytes**`,
    `- Independent built apps retained: **${s.builtApps}**`,
    `- Ledger entries: **${s.ledgerEntries}**`,
    `- Classification-clear references: **${s.classificationClearReferences}**`,
    `- Reference owner decisions: **${s.referenceOwnerDecisions}**`,
    `- Mechanical reader repoints: **${s.mechanicalRepoints}**`,
    `- Obsolete readers to remove/repoint: **${s.obsoleteOrRepoint}**`,
    `- Dependency owner decisions: **${s.dependencyOwnerDecisions}**`,
    `- Integrity problems: **${s.integrityProblems}**`,
    `- Parity authority problems: **${s.parityProblems}**`,
    `- Total blocking actions: **${s.blockerTotal}**`,
    `- Physical move authorized: **${s.physicalMoveAuthorized ? 'yes' : 'no'}**`,
    '',
    '## Boundary',
    '',
    'The independent Baptists built app is never part of the 51-shadow retirement. A physical move is allowed only after this report reaches zero blocking actions.',
    '',
    '## Blocking dependencies',
    '',
  ];
  for (const [label, rows] of [
    ['Mechanical repoint', report.blockers.mechanicalRepoints],
    ['Remove or repoint', report.blockers.obsoleteOrRepoint],
    ['Owner decision', report.blockers.dependencyOwnerDecisions],
  ]) {
    lines.push(`### ${label}`, '');
    if (!rows.length) lines.push('- none');
    for (const row of rows) lines.push(`- \`${row.path}\` — ${row.evidenceToken}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function runSelfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-shadow-self-test-'));
  try {
    fs.mkdirSync(path.join(temp, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'data', 'legacy-reference-ledger'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'data'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'migration'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'articles', 'one'), { recursive: true });
    const html = Buffer.from('<!doctype html><h1>one</h1>');
    fs.writeFileSync(path.join(temp, 'articles', 'one', 'index.html'), html);
    fs.writeFileSync(path.join(temp, 'scripts', 'strangler-duplicate-inventory.mjs'), `#!/usr/bin/env node\nconst fs=require('fs'); const out=process.argv[process.argv.indexOf('--out-json')+1]; fs.writeFileSync(out, JSON.stringify({summary:{publicIndexFiles:1},items:[{route:'/articles/one/',path:'articles/one/index.html',bytes:${html.length},classification:'native-shadow'}]}));`);
    fs.writeFileSync(path.join(temp, 'data', 'legacy-reference-ledger', 'manifest.json'), JSON.stringify({
      referenceShards: ['data/legacy-reference-ledger/references-1.json'],
      dependencies: [{ path: 'reader.js', quarantineImpact: 'owner-decision-required', evidenceToken: 'articles/one/index.html' }],
    }));
    fs.writeFileSync(path.join(temp, 'data', 'legacy-reference-ledger', 'references-1.json'), JSON.stringify({ entries: [{
      route: '/articles/one/', legacyPath: 'articles/one/index.html', classification: 'unknown-blocker', declaredLegacyStatus: null,
      gitBlobSha1: gitBlobSha1(html), byteSha256: sha256(html), profile: 'profile.json',
    }] }));
    fs.writeFileSync(path.join(temp, 'migration', 'page-ownership.json'), JSON.stringify({ routes: { '/articles/one/': { owner: 'astro', status: 'production-dist' } } }));
    fs.writeFileSync(path.join(temp, 'data', 'visual-parity-authority.json'), JSON.stringify({ ownerPolicies: { astro: { mode: 'native-contract', requiredGuards: [] } } }));
    const result = audit(temp);
    if (result.summary.deletionReady !== false || result.summary.referenceOwnerDecisions !== 1 || result.summary.dependencyOwnerDecisions !== 1) {
      throw new Error(`self-test did not fail closed: ${JSON.stringify(result.summary)}`);
    }
    console.log('✅ legacy shadow retirement readiness self-test passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.selfTest) {
  runSelfTest();
  process.exit(0);
}
const report = audit(args.root);
if (args.outJson) {
  fs.mkdirSync(path.dirname(args.outJson), { recursive: true });
  fs.writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
}
if (args.outMd) {
  fs.mkdirSync(path.dirname(args.outMd), { recursive: true });
  fs.writeFileSync(args.outMd, renderMarkdown(report));
}
console.log(`${report.summary.deletionReady ? '✅' : 'ℹ️'} legacy shadow readiness: ${report.verdict}; blockers=${report.summary.blockerTotal}`);
