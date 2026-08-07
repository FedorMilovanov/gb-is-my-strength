#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const PUBLIC_ROOT_FILES = ['index.html'];

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, '/');
}

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    ownership: null,
    outJson: null,
    outMd: null,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') args.root = path.resolve(argv[++index]);
    else if (value === '--ownership') args.ownership = path.resolve(argv[++index]);
    else if (value === '--out-json') args.outJson = path.resolve(argv[++index]);
    else if (value === '--out-md') args.outMd = path.resolve(argv[++index]);
    else if (value === '--self-test') args.selfTest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }

  args.ownership ||= path.join(args.root, 'migration', 'page-ownership.json');
  return args;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function routeForIndex(root, filePath) {
  const relative = normalizeSlashes(path.relative(root, filePath));
  if (relative === 'index.html') return '/';
  if (!relative.endsWith('/index.html')) {
    throw new Error(`Expected index.html, received ${relative}`);
  }
  return `/${relative.slice(0, -'index.html'.length)}`.replace(/\/{2,}/g, '/');
}

function walkIndexFiles(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walkIndexFiles(absolute, output);
    else if (entry.isFile() && entry.name === 'index.html') output.push(absolute);
  }
}

function ownershipDiscoveryRoots(routes) {
  const roots = new Set();
  for (const route of Object.keys(routes || {})) {
    const first = String(route).split('/').filter(Boolean)[0];
    if (first) roots.add(first);
  }
  return [...roots].sort((left, right) => left.localeCompare(right, 'en'));
}

function discoverPublicIndexes(root, routes) {
  const files = [];
  for (const relative of PUBLIC_ROOT_FILES) {
    const absolute = path.join(root, relative);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) files.push(absolute);
  }
  for (const relative of ownershipDiscoveryRoots(routes)) {
    walkIndexFiles(path.join(root, relative), files);
  }
  return files.sort((left, right) => normalizeSlashes(left).localeCompare(normalizeSlashes(right), 'en'));
}

function loadOwnership(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Ownership manifest missing: ${filePath}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !parsed.routes || typeof parsed.routes !== 'object') {
    throw new Error('migration/page-ownership.json must contain an object-valued routes field');
  }
  return parsed;
}

function ownerKind(meta) {
  return String(meta?.owner || '').trim();
}

function findContainingIndependentOwner(route, routes) {
  const candidates = Object.entries(routes)
    .filter(([candidateRoute, meta]) => {
      const owner = ownerKind(meta);
      const status = String(meta?.status || '');
      return candidateRoute !== route
        && candidateRoute.endsWith('/')
        && route.startsWith(candidateRoute)
        && (owner === 'built-app' || status === 'copy-as-built-asset');
    })
    .sort(([left], [right]) => right.length - left.length);
  return candidates[0] || null;
}

function classifyIndex(route, routes) {
  const exact = routes[route] || null;
  if (exact) {
    const owner = ownerKind(exact);
    const status = String(exact.status || '');
    if (owner.startsWith('astro')) {
      return { classification: 'native-shadow', ownerRoute: route, owner, status };
    }
    if (owner === 'built-app' || status === 'copy-as-built-asset') {
      return { classification: 'owned-independent', ownerRoute: route, owner, status };
    }
    return { classification: 'owned-legacy-or-static', ownerRoute: route, owner, status };
  }

  const containing = findContainingIndependentOwner(route, routes);
  if (containing) {
    const [ownerRoute, meta] = containing;
    return {
      classification: 'owned-independent-descendant',
      ownerRoute,
      owner: ownerKind(meta),
      status: String(meta.status || ''),
    };
  }

  return { classification: 'unowned-public-index', ownerRoute: null, owner: null, status: null };
}

function inventory(root, ownershipPath) {
  const manifest = loadOwnership(ownershipPath);
  const routes = manifest.routes;
  const seenRoutes = new Set();
  const items = discoverPublicIndexes(root, routes).map((filePath) => {
    const route = routeForIndex(root, filePath);
    if (seenRoutes.has(route)) throw new Error(`Multiple public index.html files resolve to ${route}`);
    seenRoutes.add(route);
    const stat = fs.statSync(filePath);
    return {
      route,
      path: normalizeSlashes(path.relative(root, filePath)),
      bytes: stat.size,
      sha256: sha256File(filePath),
      ...classifyIndex(route, routes),
    };
  });

  const classifications = {};
  const bytesByClassification = {};
  for (const item of items) {
    classifications[item.classification] = (classifications[item.classification] || 0) + 1;
    bytesByClassification[item.classification] = (bytesByClassification[item.classification] || 0) + item.bytes;
  }

  return {
    version: 2,
    source: 'migration/page-ownership.json',
    semantics: {
      advisoryCounts: true,
      discoveryRoots: 'Top-level repository roots are derived from the governed ownership route set, not a hand-maintained directory allowlist.',
      nativeShadow: 'A legacy index.html exists at a route whose current owner is Astro.',
      ownedIndependent: 'The index belongs to an explicit built-app or copy-as-built-asset owner.',
      unownedPublicIndex: 'An index.html under a governed public root has no exact or containing independent owner.',
      retirementRule: 'Inventory is not deletion authority. Retire only in a separate bounded lane with source, dist and browser evidence.',
    },
    summary: {
      publicIndexFiles: items.length,
      totalBytes: items.reduce((sum, item) => sum + item.bytes, 0),
      discoveryRoots: ownershipDiscoveryRoots(routes),
      classifications,
      bytesByClassification,
    },
    items,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Strangler duplicate inventory',
    '',
    '> Advisory inventory only. Counts never authorize deletion and never block unrelated Product work.',
    '',
    '## Summary',
    '',
    `- Public index files: **${report.summary.publicIndexFiles}**`,
    `- Total bytes: **${report.summary.totalBytes}**`,
    `- Ownership-derived discovery roots: **${report.summary.discoveryRoots.join(', ')}**`,
  ];

  for (const name of Object.keys(report.summary.classifications).sort()) {
    lines.push(`- ${name}: **${report.summary.classifications[name]}** files / **${report.summary.bytesByClassification[name]}** bytes`);
  }

  lines.push('', '## Inventory', '', '| Route | Classification | Owner | Bytes | Path |', '|---|---|---|---:|---|');
  for (const item of report.items) {
    lines.push(`| \`${item.route}\` | ${item.classification} | ${item.owner || '—'} | ${item.bytes} | \`${item.path}\` |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'strangler-inventory-'));
  try {
    const mkdirIndex = (relative, body) => {
      const file = path.join(root, relative, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
    };
    mkdirIndex('articles/native', '<!doctype html><title>native shadow</title>');
    mkdirIndex('konfessii/app', '<!doctype html><title>built app</title>');
    mkdirIndex('konfessii/app/nested', '<!doctype html><title>app child</title>');
    mkdirIndex('about/unowned', '<!doctype html><title>unowned</title>');
    mkdirIndex('rodosloviye', '<!doctype html><title>ownership-derived root</title>');
    fs.mkdirSync(path.join(root, 'migration'), { recursive: true });
    fs.writeFileSync(path.join(root, 'migration', 'page-ownership.json'), JSON.stringify({
      version: 2,
      routes: {
        '/about/': { owner: 'astro', status: 'production-dist' },
        '/articles/native/': { owner: 'astro', status: 'production-dist' },
        '/konfessii/app/': { owner: 'built-app', status: 'copy-as-built-asset' },
        '/rodosloviye/': { owner: 'astro', status: 'production-dist' },
      },
    }));

    const report = inventory(root, path.join(root, 'migration', 'page-ownership.json'));
    const byRoute = new Map(report.items.map((item) => [item.route, item.classification]));
    const expected = new Map([
      ['/articles/native/', 'native-shadow'],
      ['/konfessii/app/', 'owned-independent'],
      ['/konfessii/app/nested/', 'owned-independent-descendant'],
      ['/about/unowned/', 'unowned-public-index'],
      ['/rodosloviye/', 'native-shadow'],
    ]);
    for (const [route, classification] of expected) {
      if (byRoute.get(route) !== classification) {
        throw new Error(`Self-test mismatch for ${route}: expected ${classification}, received ${byRoute.get(route)}`);
      }
    }
    if (!report.summary.discoveryRoots.includes('rodosloviye')) {
      throw new Error('Self-test did not derive rodosloviye from ownership routes');
    }
    console.log('✅ strangler duplicate inventory self-test passed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const report = inventory(args.root, args.ownership);
  const markdown = renderMarkdown(report);
  if (args.outJson) writeOutput(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
  if (args.outMd) writeOutput(args.outMd, markdown);

  const counts = Object.entries(report.summary.classifications)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([name, count]) => `${name}=${count}`)
    .join(', ');
  console.log(`✅ strangler duplicate inventory: ${report.summary.publicIndexFiles} index files; ${counts}`);
  const unowned = report.items.filter((item) => item.classification === 'unowned-public-index');
  if (unowned.length) {
    console.warn(`⚠️ advisory: ${unowned.length} public index file(s) have no ownership entry`);
    for (const item of unowned) console.warn(`  - ${item.route} (${item.path})`);
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ strangler duplicate inventory failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
