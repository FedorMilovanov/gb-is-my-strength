#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const require = createRequire(import.meta.url);
const { currentLegacyReferenceDisposition } = require('./lib/legacy-source-authority.js');
const { resolveLogicalReferenceStorage } = require('../migration/legacy-reference-path.js');

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
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
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

function decodeEntities(value) {
  const named = new Map([
    ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' '],
    ['laquo', '«'], ['raquo', '»'], ['ndash', '–'], ['mdash', '—'], ['hellip', '…'],
  ]);
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const raw = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named.get(entity.toLowerCase()) ?? full;
  });
}

function htmlMetrics(buffer) {
  const raw = buffer.toString('utf8');
  const normalizedText = decodeEntities(
    raw
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[^]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[^]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
  const words = normalizedText.match(/[0-9A-Za-zА-Яа-яЁё]+(?:[-'’][0-9A-Za-zА-Яа-яЁё]+)*/g) || [];
  return {
    gitBlobSha1: gitBlobSha1(buffer),
    byteSha256: sha256(buffer),
    normalizedTextSha256: sha256(Buffer.from(normalizedText)),
    bytes: buffer.length,
    wordCount: words.length,
    h1Count: (raw.match(/<h1\b/gi) || []).length,
    h2Count: (raw.match(/<h2\b/gi) || []).length,
  };
}

function findRouteProfile(root, route) {
  const directory = path.join(root, 'data', 'route-profiles');
  if (!fs.existsSync(directory)) return null;
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.endsWith('.json')) continue;
    const relative = `data/route-profiles/${name}`;
    const data = loadJson(path.join(root, relative));
    if (data.route === route) return { path: relative, data };
  }
  return null;
}

function ledgerCandidate(root, manifest, item, buffer = null) {
  const profile = findRouteProfile(root, item.route);
  const sourceBuffer = buffer || fs.readFileSync(path.join(root, item.path));
  const disposition = currentLegacyReferenceDisposition(profile?.data || null, profile?.path || null);
  return {
    route: item.route,
    profile: profile?.path ?? null,
    legacyPath: item.path,
    ...disposition,
    sourceCommit: manifest.auditedAtCommit ?? null,
    ...htmlMetrics(sourceBuffer),
  };
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
  const entries = (manifest.referenceShards || []).flatMap((relative) => (
    loadJson(path.join(root, relative)).entries || []
  ));
  return { manifest, entries };
}

function ownerClassification(meta) {
  const owner = String(meta?.owner || '');
  const status = String(meta?.status || '');
  if (owner === 'built-app' || status === 'copy-as-built-asset') return 'owned-independent';
  if (owner.startsWith('astro')) return 'native-shadow';
  return 'owned-legacy-or-static';
}

function auditParity(root, ownership, authority) {
  const problems = [];
  let astro = 0;
  let builtApp = 0;
  for (const [route, meta] of Object.entries(ownership.routes || {})) {
    const kind = ownerClassification(meta);
    const policy = kind === 'owned-independent'
      ? authority.ownerPolicies?.['built-app']
      : kind === 'native-shadow'
        ? authority.ownerPolicies?.astro
        : null;
    if (kind === 'native-shadow') {
      astro += 1;
      if (policy?.mode !== 'native-contract') problems.push(`${route}: Astro route lacks native-contract authority`);
    }
    if (kind === 'owned-independent') {
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

function effectiveInventory({ root, inventory, entries, ownership }) {
  const inventoryItems = inventory.items || [];
  const inventoryPaths = new Set(inventoryItems.map((item) => normalize(item.path)));
  const items = [...inventoryItems];
  const coverageGaps = [];

  for (const entry of entries) {
    const relative = normalize(entry.legacyPath);
    if (inventoryPaths.has(relative)) continue;
    const storage = resolveLogicalReferenceStorage(relative, { root, mustExist: false });
    const meta = ownership.routes?.[entry.route] || null;
    if (!meta || !storage.exists) continue;
    const classification = ownerClassification(meta);
    const buffer = fs.readFileSync(storage.absolutePath);
    const row = {
      route: entry.route,
      path: relative,
      storagePath: storage.repositoryPath,
      bytes: buffer.length,
      sha256: sha256(buffer),
      classification,
      ownerRoute: entry.route,
      owner: meta.owner || null,
      status: meta.status || null,
      discoveredBy: storage.repositoryPath === relative
        ? 'immutable-ledger-cross-check'
        : 'immutable-ledger-quarantine-fallback',
    };
    items.push(row);
    if (storage.repositoryPath === relative) {
      coverageGaps.push({
        route: entry.route,
        path: relative,
        classification,
        problem: 'current strangler inventory omitted a governed existing active reference',
      });
    }
  }

  items.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  return { items, coverageGaps };
}

function buildReport({ root, inventory, manifest, entries, ownership, authority }) {
  const parity = auditParity(root, ownership, authority);
  const effective = effectiveInventory({ root, inventory, entries, ownership });
  const byPath = new Map(entries.map((entry) => [normalize(entry.legacyPath), entry]));
  const byRoute = new Map(entries.map((entry) => [entry.route, entry]));
  const nativeItems = effective.items.filter((item) => item.classification === 'native-shadow');
  const builtApps = effective.items.filter((item) => item.classification === 'owned-independent');
  const integrityProblems = [];
  const missingLedgerCandidates = [];

  const nativeShadows = nativeItems.map((item) => {
    const itemPath = normalize(item.path);
    const entry = byPath.get(itemPath) || byRoute.get(item.route) || null;
    if (!entry) {
      integrityProblems.push(`${item.path}: missing immutable ledger entry`);
      const candidate = ledgerCandidate(root, manifest, item);
      missingLedgerCandidates.push(candidate);
      return {
        route: item.route,
        path: item.path,
        storagePath: item.path,
        bytes: item.bytes,
        decision: 'missing-ledger',
        ledgerCandidate: candidate,
      };
    }
    if (normalize(entry.legacyPath) !== itemPath) {
      integrityProblems.push(`${item.path}: ledger path mismatch (${entry.legacyPath})`);
    }
    if (entry.route !== item.route) {
      integrityProblems.push(`${item.path}: ledger route mismatch (${entry.route} != ${item.route})`);
    }
    const storage = resolveLogicalReferenceStorage(entry.legacyPath, { root });
    const buffer = fs.readFileSync(storage.absolutePath);
    if (gitBlobSha1(buffer) !== entry.gitBlobSha1) integrityProblems.push(`${item.path}: Git blob mismatch`);
    if (sha256(buffer) !== entry.byteSha256) integrityProblems.push(`${item.path}: byte SHA-256 mismatch`);

    const current = ledgerCandidate(root, manifest, item, buffer);
    const decision = current.classification === 'migration-reference-only'
      ? 'classification-clear'
      : current.classification === 'unknown-blocker'
        ? 'owner-decision-required'
        : `unexpected-${current.classification}`;
    return {
      route: item.route,
      path: item.path,
      storagePath: storage.repositoryPath,
      bytes: buffer.length,
      profile: current.profile,
      classification: current.classification,
      declaredLegacyStatus: current.declaredLegacyStatus,
      decisionSource: current.decisionSource,
      gitBlobSha1: entry.gitBlobSha1,
      byteSha256: entry.byteSha256,
      decision,
      discoveredBy: item.discoveredBy || 'strangler-inventory',
    };
  });

  const groups = groupDependencies(manifest.dependencies || []);
  const unknownReferences = nativeShadows.filter((row) => row.decision === 'owner-decision-required');
  const unexpectedReferences = nativeShadows.filter((row) => row.decision?.startsWith('unexpected-'));
  const classificationClear = nativeShadows.filter((row) => row.decision === 'classification-clear');
  const mechanicalRepoints = groups['mechanical-repoint'] || [];
  const obsoleteOrRepoint = groups['obsolete-or-repoint'] || [];
  const dependencyOwnerDecisions = groups['owner-decision'] || [];
  const unknownDependencyImpacts = groups['unknown-impact'] || [];
  const nonblockingDependencies = groups.nonblocking || [];

  const blockingCounts = {
    referenceOwnerDecisions: unknownReferences.length,
    unexpectedReferenceClassifications: unexpectedReferences.length,
    mechanicalRepoints: mechanicalRepoints.length,
    obsoleteOrRepoint: obsoleteOrRepoint.length,
    dependencyOwnerDecisions: dependencyOwnerDecisions.length,
    unknownDependencyImpacts: unknownDependencyImpacts.length,
    integrityProblems: integrityProblems.length,
    inventoryCoverageProblems: effective.coverageGaps.length,
    parityProblems: parity.problems.length,
  };
  const blockerTotal = Object.values(blockingCounts).reduce((sum, count) => sum + count, 0);
  const deletionReady = blockerTotal === 0;

  return {
    schemaVersion: '1.5.0',
    generatedAt: new Date().toISOString(),
    source: {
      inventory: 'scripts/strangler-duplicate-inventory.mjs',
      immutableLedger: 'data/legacy-reference-ledger/manifest.json',
      currentReferenceAuthority: 'data/route-profiles/*.json',
      ownership: 'migration/page-ownership.json',
      parityAuthority: 'data/visual-parity-authority.json',
      physicalReferenceStorage: 'migration/legacy-reference-path.js',
    },
    summary: {
      inventoryReportedPublicIndexes: inventory.summary?.publicIndexFiles || 0,
      publicIndexes: effective.items.length,
      nativeShadows: nativeItems.length,
      nativeShadowBytes: nativeItems.reduce((sum, item) => sum + item.bytes, 0),
      builtApps: builtApps.length,
      ledgerEntries: entries.length,
      missingLedgerCandidates: missingLedgerCandidates.length,
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
      ? 'All immutable identities, inventory coverage, current route-profile classifications, dependency decisions and parity authority are complete.'
      : 'Parity authority is transferred, but inventory coverage, immutable identity, current route-profile classifications, dependency repoints and/or direct readers still block physical retirement.',
    parity,
    blockers: {
      inventoryCoverageGaps: effective.coverageGaps,
      missingLedgerCandidates,
      unknownReferences,
      unexpectedReferences,
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
        'repair strangler inventory coverage for every governed active legacy path',
        'add immutable ledger identity for every effective native shadow using the emitted exact candidates',
        'resolve missing or unexpected current classifications in route profiles',
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
    `- Inventory-reported public indexes: **${s.inventoryReportedPublicIndexes}**`,
    `- Effective governed public indexes: **${s.publicIndexes}**`,
    `- Astro native shadows: **${s.nativeShadows}** / **${s.nativeShadowBytes} bytes**`,
    `- Independent built apps retained: **${s.builtApps}**`,
    `- Ledger entries: **${s.ledgerEntries}**`,
    `- Missing ledger candidates: **${s.missingLedgerCandidates}**`,
    `- Inventory coverage problems: **${s.inventoryCoverageProblems}**`,
    `- Integrity problems: **${s.integrityProblems}**`,
    `- Classification-clear references: **${s.classificationClearReferences}**`,
    `- Reference owner decisions: **${s.referenceOwnerDecisions}**`,
    `- Unexpected reference classifications: **${s.unexpectedReferenceClassifications}**`,
    `- Mechanical reader repoints: **${s.mechanicalRepoints}**`,
    `- Obsolete readers to remove/repoint: **${s.obsoleteOrRepoint}**`,
    `- Dependency owner decisions: **${s.dependencyOwnerDecisions}**`,
    `- Parity authority problems: **${s.parityProblems}**`,
    `- Total blocking actions: **${s.blockerTotal}**`,
    `- Physical move authorized: **${s.physicalMoveAuthorized ? 'yes' : 'no'}**`,
    '',
    '## Boundary',
    '',
    'Current retirement classification is resolved from route profiles. The immutable ledger owns identity/hash evidence only. Physical bytes for ledger-owned references are resolved through migration/legacy-reference-path.js, so active and quarantine storage share one fail-closed authority. The independent Baptists built app is never part of native-shadow retirement.',
    '',
    '## Inventory coverage gaps',
    '',
  ];
  if (!report.blockers.inventoryCoverageGaps.length) lines.push('- none');
  for (const row of report.blockers.inventoryCoverageGaps) lines.push(`- \`${row.path}\` — ${row.problem}`);
  lines.push('', '## Missing ledger candidates', '');
  if (!report.blockers.missingLedgerCandidates.length) lines.push('- none');
  for (const row of report.blockers.missingLedgerCandidates) {
    lines.push(`### \`${row.legacyPath}\``, '', '```json', JSON.stringify(row, null, 2), '```', '');
  }
  lines.push('## Unexpected reference classifications', '');
  if (!report.blockers.unexpectedReferences.length) lines.push('- none');
  for (const row of report.blockers.unexpectedReferences) lines.push(`- \`${row.path}\` — ${row.classification}`);
  lines.push('', '## Blocking dependencies', '');
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
    for (const relative of ['about', 'unexpected', 'guards', 'data/route-profiles', 'migration/legacy-reference/rodosloviye']) {
      fs.mkdirSync(path.join(temp, relative), { recursive: true });
    }
    const about = Buffer.from('<!doctype html><h1>about</h1>');
    const family = Buffer.from('<!doctype html><h1>family</h1>');
    const unexpected = Buffer.from('<!doctype html><h1>unexpected</h1>');
    fs.writeFileSync(path.join(temp, 'about', 'index.html'), about);
    fs.writeFileSync(path.join(temp, 'migration', 'legacy-reference', 'rodosloviye', 'index.html'), family);
    fs.writeFileSync(path.join(temp, 'unexpected', 'index.html'), unexpected);
    fs.writeFileSync(path.join(temp, 'data', 'route-profiles', 'about.json'), JSON.stringify({
      route: '/about/', legacyStatus: 'reference-only', legacyPath: 'about/index.html',
    }));
    fs.writeFileSync(path.join(temp, 'data', 'route-profiles', 'rodosloviye.json'), JSON.stringify({
      route: '/rodosloviye/', legacyStatus: 'reference-only', legacyPath: 'rodosloviye/index.html',
    }));
    fs.writeFileSync(path.join(temp, 'data', 'route-profiles', 'unexpected.json'), JSON.stringify({
      route: '/unexpected/', legacyStatus: 'runtime-required', legacyPath: 'unexpected/index.html',
    }));
    for (const name of ['source.js', 'dist.js', 'browser.js']) fs.writeFileSync(path.join(temp, 'guards', name), '');

    const fixture = {
      root: temp,
      inventory: {
        summary: { publicIndexFiles: 2 },
        items: [
          { route: '/about/', path: 'about/index.html', bytes: about.length, classification: 'native-shadow' },
          { route: '/unexpected/', path: 'unexpected/index.html', bytes: unexpected.length, classification: 'native-shadow' },
        ],
      },
      manifest: {
        auditedAtCommit: 'a'.repeat(40),
        dependencies: [{ path: 'reader.js', quarantineImpact: 'owner-decision-required', evidenceToken: 'rodosloviye/index.html' }],
      },
      entries: [
        {
          route: '/rodosloviye/',
          legacyPath: 'rodosloviye/index.html',
          classification: 'migration-reference-only',
          declaredLegacyStatus: 'reference-only',
          gitBlobSha1: gitBlobSha1(family),
          byteSha256: sha256(family),
          profile: 'snapshot-profile.json',
        },
        {
          route: '/unexpected/',
          legacyPath: 'unexpected/index.html',
          classification: 'migration-reference-only',
          declaredLegacyStatus: 'reference-only',
          gitBlobSha1: gitBlobSha1(unexpected),
          byteSha256: sha256(unexpected),
          profile: 'snapshot-profile.json',
        },
      ],
      ownership: {
        routes: {
          '/about/': { owner: 'astro', status: 'production-dist' },
          '/rodosloviye/': { owner: 'astro', status: 'production-dist' },
          '/unexpected/': { owner: 'astro', status: 'production-dist' },
        },
      },
      authority: {
        ownerPolicies: {
          astro: { mode: 'native-contract', requiredGuards: ['guards/source.js', 'guards/dist.js', 'guards/browser.js'] },
        },
      },
    };

    const report = buildReport(fixture);
    const candidate = report.blockers.missingLedgerCandidates[0];
    const familyRow = report.nativeShadows.find((row) => row.route === '/rodosloviye/');
    if (report.summary.publicIndexes !== 3
      || report.summary.nativeShadows !== 3
      || report.summary.inventoryCoverageProblems !== 0
      || report.summary.integrityProblems !== 1
      || report.summary.missingLedgerCandidates !== 1
      || candidate?.legacyPath !== 'about/index.html'
      || candidate?.classification !== 'migration-reference-only'
      || candidate?.gitBlobSha1 !== gitBlobSha1(about)
      || candidate?.byteSha256 !== sha256(about)
      || candidate?.sourceCommit !== 'a'.repeat(40)
      || familyRow?.storagePath !== 'migration/legacy-reference/rodosloviye/index.html'
      || familyRow?.gitBlobSha1 !== gitBlobSha1(family)
      || report.summary.referenceOwnerDecisions !== 0
      || report.summary.unexpectedReferenceClassifications !== 1
      || report.summary.dependencyOwnerDecisions !== 1
      || report.summary.deletionReady !== false) {
      throw new Error(`self-test did not fail closed: ${JSON.stringify(report.summary)}`);
    }

    fs.mkdirSync(path.join(temp, 'rodosloviye'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'rodosloviye', 'index.html'), family);
    let ambiguityRejected = false;
    try {
      buildReport(fixture);
    } catch (error) {
      ambiguityRejected = /storage is ambiguous/.test(String(error?.message || error));
    }
    if (!ambiguityRejected) throw new Error('self-test did not reject active + quarantine ambiguity');
    fs.rmSync(path.join(temp, 'rodosloviye'), { recursive: true, force: true });

    console.log('✅ legacy shadow retirement readiness self-test passed (quarantine-aware + ambiguity fail-closed)');
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
