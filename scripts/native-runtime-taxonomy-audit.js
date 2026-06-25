#!/usr/bin/env node
/**
 * native-runtime-taxonomy-audit.js
 *
 * Classifies every production Astro-owned route by how much legacy runtime
 * transport remains in its route source + local component/import closure.
 *
 * This is intentionally taxonomy-first: default mode prints a stable summary
 * and exits 0. Use --strict to fail on contract drift against
 * migration/route-migration-matrix.json (e.g. mdx-native route still using
 * full-body shadow) or on forbidden legacy transport inside a strict-native
 * expectation.
 *
 * Categories:
 *   strict-native                    no legacy loader/raw/set:html transport
 *   native-with-legacy-head          only legacy <head>/body attrs remain
 *   native-main-with-legacy-chrome   semantic main is native, chrome/head legacy
 *   hybrid-raw-segments              route/component closure imports ?raw/_legacy
 *   full-body-shadow                 bodyHtml/loadLegacyFullDocument body proxy
 *   legacy-shadow-app-intentional    maps/interactive/built app shadow by design
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');
const MATRIX_FILE = path.join(ROOT, 'migration/route-migration-matrix.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const arg = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const JSON_OUT = flag('--json');
const DETAILS = flag('--details') || JSON_OUT;
const STRICT = flag('--strict');
const ROUTE_FILTER = arg('--route', '').trim();
const MAX_EXAMPLES = Number(arg('--max-examples', '12')) || 12;

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function normalizeRoute(route) {
  if (!route.startsWith('/')) route = `/${route}`;
  if (!route.endsWith('/') && !/\.[a-z0-9]+$/i.test(route)) route += '/';
  return route;
}

function isProductionRoute(info) {
  if (!info) return false;
  if (info.status === 'build-only') return false;
  if (info.owner === 'astro-noindex') return false;
  return true;
}

function isIntentionalApp(route, info, matrixContract) {
  if (info && info.owner === 'built-app') return true;
  if (matrixContract && matrixContract.mode === 'legacy-shadow-app') return true;
  if (route === '/map/' || route === '/rodosloviye/' || route === '/konfessii/russkij-baptizm/') return true;
  if (route.startsWith('/karty/') && route !== '/karty/') return true;
  if (route === '/konfessii/russkij-baptizm/_app/') return true;
  return false;
}

function stripRawSuffix(spec) {
  return spec.replace(/\?raw$/, '');
}

function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('node:') || /^[a-zA-Z@][^/:]*$/.test(spec)) return null;
  if (spec.startsWith('@astrojs/') || spec.startsWith('astro:')) return null;
  if (spec.startsWith('@xyflow/') || spec.startsWith('@dagrejs/')) return null;

  let base;
  const clean = stripRawSuffix(spec);
  if (clean.startsWith('@/')) {
    base = path.join(ROOT, 'src', clean.slice(2));
  } else if (clean.startsWith('./') || clean.startsWith('../')) {
    base = path.resolve(path.dirname(fromFile), clean);
  } else {
    return null;
  }

  const candidates = [];
  candidates.push(base);
  for (const ext of ['.astro', '.mdx', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.html']) {
    candidates.push(base + ext);
  }
  for (const index of ['index.astro', 'index.mdx', 'index.js', 'index.ts']) {
    candidates.push(path.join(base, index));
  }
  for (const candidate of candidates) {
    if (candidate.startsWith(ROOT) && exists(candidate)) return candidate;
  }
  return null;
}

function findImports(source) {
  const imports = [];
  const re = /import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source))) imports.push(m[1]);
  return imports;
}

function collectClosure(entryFile) {
  const files = [];
  const seen = new Set();
  const stack = [entryFile];

  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file) || !file.startsWith(ROOT) || !exists(file)) continue;
    seen.add(file);
    files.push(file);

    const source = readText(file);
    for (const spec of findImports(source)) {
      const resolved = resolveImport(file, spec);
      if (!resolved) continue;
      // Follow only route-local render closure. Do not recurse into generic
      // utilities (especially legacyFullDocument.ts), scripts, or root legacy
      // artifacts; otherwise every route importing the loader would inherit the
      // utility implementation's bodyHtml/headHtml tokens and become a false
      // full-body-shadow.
      const r = rel(resolved);
      if (
        r.startsWith('src/components/') ||
        r.startsWith('src/layouts/') ||
        r.startsWith('src/content/') ||
        r.startsWith('src/pages/')
      ) {
        stack.push(resolved);
      }
    }
  }

  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function scanFiles(files) {
  const flags = {
    loadLegacyFullDocument: [],
    legacyFullDocumentImport: [],
    bodyHtml: [],
    headHtml: [],
    bodyAttributes: [],
    setHtml: [],
    rawImport: [],
    legacyPath: [],
    bodySegment: [],
    rawSection: [],
    importMetaGlobLegacy: [],
    namedMainComponent: [],
    pageHeadComponent: [],
    pageChromeComponent: [],
    pageFooterComponent: [],
  };

  const add = (key, file, note = '') => flags[key].push(note ? `${rel(file)}:${note}` : rel(file));

  for (const file of files) {
    const rawSource = readText(file);
    const source = stripComments(rawSource);
    if (source.includes('loadLegacyFullDocument(')) add('loadLegacyFullDocument', file);
    if (source.includes('legacyFullDocument')) add('legacyFullDocumentImport', file);
    if (/\bbodyHtml\b/.test(source)) add('bodyHtml', file);
    if (/\bheadHtml\b/.test(source)) add('headHtml', file);
    if (/\bbodyAttributes\b/.test(source)) add('bodyAttributes', file);
    if (/<Fragment\s+set:html=/.test(source) || /set:html=/.test(source)) add('setHtml', file);
    if (/\?raw['"]/.test(source) || /\?raw\b/.test(source)) add('rawImport', file);
    if (/_legacy\//.test(source) || /from\s+['"][^'"]*_legacy/.test(source)) add('legacyPath', file);
    if (/body-segment-\d+\.html/.test(source) || /body-before\.html|body-after\.html|body-mid\.html/.test(source)) add('bodySegment', file);
    if (/rawSection|article-sections|import\.meta\.glob\([^)]*_legacy/.test(source)) add('rawSection', file);
    if (/import\.meta\.glob\([^)]*_legacy/.test(source)) add('importMetaGlobLegacy', file);
    if (/(Main|ArticleBody|MainShell)\s+from\s+['"]/.test(source) || /<[A-Z][A-Za-z0-9]*(Main|ArticleBody|MainShell)\b/.test(source)) add('namedMainComponent', file);
    if (/PageHead\s+from\s+['"]|<[A-Z][A-Za-z0-9]*PageHead\b/.test(source)) add('pageHeadComponent', file);
    if (/PageChrome\s+from\s+['"]|<[A-Z][A-Za-z0-9]*PageChrome\b/.test(source)) add('pageChromeComponent', file);
    if (/PageFooter\s+from\s+['"]|<[A-Z][A-Za-z0-9]*PageFooter\b/.test(source)) add('pageFooterComponent', file);
  }

  return flags;
}

function any(flags, keys) {
  return keys.some((key) => flags[key] && flags[key].length > 0);
}

function classify(route, info, matrixContract, flags) {
  if (isIntentionalApp(route, info, matrixContract)) return 'legacy-shadow-app-intentional';
  if (any(flags, ['bodyHtml'])) return 'full-body-shadow';

  const hasLegacyHead = any(flags, ['loadLegacyFullDocument', 'headHtml', 'bodyAttributes']);
  const hasRawTransport = any(flags, ['rawImport', 'legacyPath', 'bodySegment', 'rawSection', 'importMetaGlobLegacy']);
  const hasSetHtml = any(flags, ['setHtml']);
  const hasNamedMain = any(flags, ['namedMainComponent']);

  if (!hasLegacyHead && !hasRawTransport && !hasSetHtml) return 'strict-native';
  if (hasRawTransport) return hasNamedMain ? 'hybrid-raw-segments' : 'native-main-with-legacy-chrome';
  if (hasLegacyHead && hasSetHtml && hasNamedMain) return 'native-with-legacy-head';
  if (hasLegacyHead) return 'native-with-legacy-head';
  if (hasSetHtml) return 'hybrid-raw-segments';
  return 'strict-native';
}

function compactFlags(flags) {
  const out = {};
  for (const [key, values] of Object.entries(flags)) {
    if (values.length) out[key] = Array.from(new Set(values));
  }
  return out;
}

function summarizeCategory(category) {
  return {
    'strict-native': 'no legacy loader/raw/set:html transport in route closure',
    'native-with-legacy-head': 'native body/chrome, but legacy head/body attrs remain',
    'native-main-with-legacy-chrome': 'native semantic main with legacy chrome/head transport',
    'hybrid-raw-segments': '?raw/_legacy/body-segment transport remains in route closure',
    'full-body-shadow': 'legacy bodyHtml emitted into Astro route',
    'legacy-shadow-app-intentional': 'interactive/map/built app intentionally shadowed',
  }[category] || '';
}

const ownership = readJson(OWNERSHIP_FILE);
const matrix = readJson(MATRIX_FILE, { routes: {} });
if (!ownership || !ownership.routes) {
  console.error('❌ migration/page-ownership.json missing or invalid');
  process.exit(1);
}

const categories = {
  'strict-native': [],
  'native-with-legacy-head': [],
  'native-main-with-legacy-chrome': [],
  'hybrid-raw-segments': [],
  'full-body-shadow': [],
  'legacy-shadow-app-intentional': [],
};
const problems = [];
const warnings = [];

for (const [rawRoute, info] of Object.entries(ownership.routes)) {
  const route = normalizeRoute(rawRoute);
  if (ROUTE_FILTER && route !== normalizeRoute(ROUTE_FILTER)) continue;
  if (!isProductionRoute(info)) continue;

  const sourceRel = info.source;
  const sourceFile = sourceRel ? path.join(ROOT, sourceRel) : null;
  const contract = matrix.routes && matrix.routes[route];

  if (!sourceFile || !exists(sourceFile)) {
    const category = isIntentionalApp(route, info, contract) ? 'legacy-shadow-app-intentional' : 'full-body-shadow';
    categories[category].push({
      route,
      source: sourceRel || null,
      owner: info.owner,
      status: info.status,
      mode: contract ? contract.mode : null,
      closureFiles: [],
      flags: {},
      note: 'source file absent from workspace; likely copied/built app or legacy fallback',
    });
    continue;
  }

  const closure = collectClosure(sourceFile);
  const flags = scanFiles(closure);
  const category = classify(route, info, contract, flags);
  const row = {
    route,
    source: rel(sourceFile),
    owner: info.owner,
    status: info.status,
    mode: contract ? contract.mode : null,
    category,
    closureFiles: closure.map(rel).sort(),
    flags: compactFlags(flags),
  };
  categories[category].push(row);

  if (STRICT && contract) {
    if (contract.mode === 'mdx-native-article' && ['full-body-shadow', 'hybrid-raw-segments', 'native-main-with-legacy-chrome', 'native-with-legacy-head'].includes(category)) {
      problems.push(`${route}: matrix says mdx-native-article, taxonomy=${category}`);
    }
    if (contract.mode === 'strict-native' && category !== 'strict-native') {
      problems.push(`${route}: matrix says strict-native, taxonomy=${category}`);
    }
    if (contract.mode === 'native-main-with-legacy-chrome' && category === 'full-body-shadow') {
      problems.push(`${route}: matrix says native-main-with-legacy-chrome, but route is full-body-shadow`);
    }
    if (contract.mode === 'legacy-shadow-app' && category !== 'legacy-shadow-app-intentional') {
      warnings.push(`${route}: matrix says legacy-shadow-app, taxonomy=${category}; verify this was intentional`);
    }
  }
}

for (const list of Object.values(categories)) list.sort((a, b) => a.route.localeCompare(b.route));

const total = Object.values(categories).reduce((sum, list) => sum + list.length, 0);
const report = {
  generatedAt: new Date().toISOString(),
  strict: STRICT,
  totalProductionRoutes: total,
  categories,
  counts: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length])),
  percentages: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, total ? Number(((v.length / total) * 100).toFixed(1)) : 0])),
  warnings,
  problems,
};

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(report, null, 2));
} else {
  console.log('=== Native Runtime Taxonomy Audit ===');
  console.log(`Mode: ${STRICT ? 'STRICT' : 'TAXONOMY/WARN'}`);
  console.log(`Routes: ${total}`);
  console.log('');
  console.log('| Category | Count | % | Meaning |');
  console.log('|---|---:|---:|---|');
  for (const [category, rows] of Object.entries(categories)) {
    const pct = total ? ((rows.length / total) * 100).toFixed(1) : '0.0';
    console.log(`| ${category} | ${rows.length} | ${pct}% | ${summarizeCategory(category)} |`);
  }
  console.log('');

  if (DETAILS) {
    for (const [category, rows] of Object.entries(categories)) {
      console.log(`## ${category}`);
      if (!rows.length) {
        console.log('- —');
        console.log('');
        continue;
      }
      for (const row of rows) {
        const flags = Object.keys(row.flags || {}).join(', ') || 'clean';
        const mode = row.mode ? `; matrix=${row.mode}` : '';
        console.log(`- ${row.route} — ${row.source || 'n/a'}${mode}; flags=${flags}`);
      }
      console.log('');
    }
  } else {
    console.log('Examples (use --details for full route list):');
    for (const [category, rows] of Object.entries(categories)) {
      const sample = rows.slice(0, MAX_EXAMPLES).map((r) => r.route).join(', ') || '—';
      const suffix = rows.length > MAX_EXAMPLES ? ` … +${rows.length - MAX_EXAMPLES}` : '';
      console.log(`- ${category}: ${sample}${suffix}`);
    }
  }

  if (warnings.length) {
    console.log('');
    console.log('⚠️  Warnings:');
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  }

  if (problems.length) {
    console.log('');
    console.log('❌ Problems:');
    for (const p of problems) console.log(`  ❌ ${p}`);
  }

  console.log('');
  if (problems.length && STRICT) {
    console.log(`❌ native runtime taxonomy failed (${problems.length} problem(s))`);
  } else {
    console.log('✅ native runtime taxonomy completed');
  }
}

if (problems.length && STRICT) process.exit(1);
