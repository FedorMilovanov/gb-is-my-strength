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
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${buffer.length}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
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
  const manifest = loadJson(path.join(root, 'data', 'legacy-reference-ledger', 'manifest.json'));
  const entries = [];
  for (const relative of manifest.referenceShards || []) {
    entries.push(...(loadJson(path.join(root, relative)).entries || []));
  }
  return { manifest, entries };
}

function parityPolicy(meta, authority) {
  const owner = String(meta?.owner || '');
  const status = String(meta?.status || '');
  if (owner === 'built-app' || status === 'copy-as-built-asset') return authority.ownerPolicies?.['built-app'];
  if (owner.startsWith('astro')) return authority.ownerPolicies?.astro;
  return null;
}

function auditParity(root, ownership, authority) {
  const problems = [];
  let astro = 0;
  let builtApp = 0;
  for (const [route, meta] of Object.entries(ownership.routes || {})) {
    const policy = parityPolicy(meta, authority);
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

function dependencyClass(dependency) {
  switch (dependency.quarantineImpact) {
    case 'none-fixture-policy-or-comment-only': return 'nonblocking';
    case 'must-update-before-move': return 'mechanical-repoint';
    case 'remove-or-repoint-before-move': return 'obsolete-or-repoint';
    case 'owner-decision-required': return 'owner-decision';
    default: return 'unknown-impact';
  }
}

function groupDependencies(dependencies) {
  return dependencies.reduce((groups, dependency) => {
    const key = dependencyClass(dependency);
    (groups[key] ||= []).push({ ...dependency, retirementClass: key });
    return groups;
  }, {});
}

function buildReport({ root, inventory, manifest, entries, ownership, authority }) {
  const parity = auditParity(root, ownership, authority);
  const byPath = new Map(entries.map((entry) => [normalize(entry.legacyPath), entry]));
  const byRoute = new Map(entries.map((entry) => [entry.route, entry]));
  const nativeItems = (inventory.items || []).filter((item) => item.classification === 'native-shadow');
  const builtApps = (inventory.items || []).filter((item) => item.classification === 'owned-independent');
  const integrityProblems = [];

  const nativeShadows = nativeItems.map((item) => {
    const entry = byPath.get(normalize(item.path)) || byRoute.get(item.route) || null;
    if (!entry) {
      integrityProblems.push(`${item.path}: missing immutable ledger entry`);
      return { route: item.route, path: item.path, bytes: item.bytes, decision: 'missing-ledger' };
    }
    const buffer = fs.readFileSync(path.join(root, item.path));
    if (gitBlobSha1(buffer) !== entry.gitBlobSha1) integrityProblems.push(`${item.path}: Git blob mismatch`);
    if (sha256(buffer) !== entry.byteSha256) integrityProblems.push(`${item.path}: byte SHA-256 mismatch`);
    const decision = entry.classification === 'migration-reference-only'
      ? 'classification-clear'
      : entry.classification === 'unknown-blocker'
        ? 'owner-decision-required'
        : `unexpected-${entry.classification}`;
    return {
      route: item.route,
      path: item.path,
      bytes: item.bytes,
      profile: entry.profile,
      classification: entry.classification,
      declaredLegacyStatus: entry.declaredLegacyStatus,
      gitBlobSha1: entry.gitBlobSha1,
      byteSha256: entry.byteSha256,
      decision,
    };
  });

  const groups = groupDependencies(manifest.dependencies || []);
  const unknownReferences = nativeShadows.filter((row) => row.decision === 'owner-decision-required');
  const classificationClear = nativeShadows.filter((row) => row.decision === 'classification-clear');
  const mechanicalRepoints = groups['mechanical-repoint'] || [];
  const obsoleteOrRepoint = groups['obsolete-or-repoint'] || [];
  const dependencyOwnerDecisions = groups['owner-decision'] || [];
  const unknownDependencyImpacts = groups['unknown-impact'] || [];
  const nonblockingDependencies = groups.nonblocking || [];

  const blockingCounts = {
    referenceOwnerDecisions: unknownReferences.length,
    mechanicalRepoints: mechanicalRepoints.length,
    obsoleteOrRepoint: obsoleteOrRepoint.length,
    dependencyOwnerDecisions: dependencyOwnerDecisions.length,
    unknownDependencyImpacts: unknownDependencyImpacts.length,
    integrityProblems: integrityProblems.length,
    parityProblems: parity.problems.length,
  };
  const blockerTotal = Object.values(blockingCounts).reduce((sum, count) => sum + count, 0);
  const deletionReady = blockerTotal === 0;

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
      publicIndexes: inventory.summary?.publicIndexFiles || 0,
      nativeShadows: nativeItems.length,
      nativeShadowBytes: nativeItems.reduce((sum, item) => sum + item.bytes, 0),
      builtApps: builtApps.length,
      ledgerEntries: entries.length,
      classificationClearReferences: classificationClear.length,
      unknownReferenceDecisions: unknownReferences.length,
      dependencyRecords: (manifest.dependencies || []).length,
      nonblockingDependencies: nonblockingDependencies.length,
      ...blockingCounts,
      blockerTotal,
      parityAuthorityClear: parity.clear,
      deletionReady,
      physicalMoveAuthorized: deletionReady,
    },
    verdict: deletionReady ? 'SAFE_TO_OPEN_ATOMIC_QUARANTINE_MOVE' : 'NOT_YET_SAFE_TO_MOVE_OR_DELETE',
    reason: deletionReady
      ? 'All immutable identities, owner decisions, dependency repoints and parity authority are complete.'
      : 'Parity authority is transferred, but reference decisions and/or direct readers still block physical retirement.',
    parity,
    blockers: {
      unknownReferences,
      mechanicalRepoints,
      obsoleteOrRepoint,
      dependencyOwnerDecisions,
      unknownDependencyImpacts,
      integrityProblems,
    },
    nonblockingDependencies,
    nativeShadows,
    builtApps: builtApps.map((item) => ({ route: item.route, path: item.path, bytes: item.bytes })),
    nextTransaction: {
      order: [
        'resolve missing reference classifications in route profiles and ledger',
        'repoint policy readers through migration/legacy-reference-path.js',
        'remove or repoint obsolete legacy audits',
        'decide the remaining direct-reader contracts',
        'rerun this report until blockerTotal=0',
        'perform one atomic blob-preserving move to migration/legacy-reference/**',
        'prove production-like dist, Pagefind, browser routes and no quarantine publication',
      ],
      deleteBuiltApp: false,
      deleteNativeShadowsNow: deletionReady,
    },
  };
}

function audit(root) {
  const inventory = runInventory(root);
  const { manifest, entries } = loadLedger(root);
  return buildReport({
    root,
    inventory,
    manifest,
    entries,
    ownership: loadJson(path.join(root, 'migration', 'page-ownership.json')),
    authority: loadJson(path.join(root, 'data', 'visual-parity-authority.json')),
  });
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
    fs.mkdirSync(path.join(temp, 'articles', 'one'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'guards'), { recursive: true });
    const html = Buffer.from('<!doctype html><h1>one</h1>');
    fs.writeFileSync(path.join(temp, 'articles', 'one', 'index.html'), html);
    for (const name of ['source.js', 'dist.js', 'browser.js']) fs.writeFileSync(path.join(temp, 'guards', name), '');

    const report = buildReport({
      root: temp,
      inventory: {
        summary: { publicIndexFiles: 1 },
        items: [{ route: '/articles/one/', path: 'articles/one/index.html', bytes: html.length, classification: 'native-shadow' }],
      },
      manifest: {
        dependencies: [{ path: 'reader.js', quarantineImpact: 'owner-decision-required', evidenceToken: 'articles/one/index.html' }],
      },
      entries: [{
        route: '/articles/one/',
        legacyPath: 'articles/one/index.html',
        classification: 'unknown-blocker',
        declaredLegacyStatus: null,
        gitBlobSha1: gitBlobSha1(html),
        byteSha256: sha256(html),
        profile: 'profile.json',
      }],
      ownership: { routes: { '/articles/one/': { owner: 'astro', status: 'production-dist' } } },
      authority: { ownerPolicies: { astro: { mode: 'native-contract', requiredGuards: ['guards/source.js', 'guards/dist.js', 'guards/browser.js'] } } },
    });

    if (report.summary.deletionReady !== false || report.summary.referenceOwnerDecisions !== 1 || report.summary.dependencyOwnerDecisions !== 1) {
      throw new Error(`self-test did not fail closed: ${JSON.stringify(report.summary)}`);
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
