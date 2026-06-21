#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'src', 'pages');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && full.endsWith('.astro')) acc.push(full);
  }
  return acc;
}

function routeFromPage(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'index.astro') return '/';
  return '/' + rel.replace(/index\.astro$/, '');
}

function classifyPage(source, file) {
  if (file.includes('/dev/')) return 'dev-native';
  if (/bodyHtml/.test(source)) return 'pure-full-body-shadow';
  if (/\?raw/.test(source) || /bodyBefore|bodyMid|bodyAfter|segBefore|segAfter/.test(source)) {
    return 'hybrid-page-segments';
  }
  return 'hybrid-delegated-component';
}

function importsFromPage(source) {
  return [...source.matchAll(/import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"]([^'"]+)['"]/g)]
    .map((m) => ({ name: m[1], from: m[2] }))
    .filter((x) => x.from.includes('/components/') || x.from.startsWith('@/components/'));
}

function legacyHtmlPath(route, category) {
  if (category === 'dev-native') return null;
  if (route === '/') return 'index.html';
  return `${route.slice(1)}index.html`;
}

function fileSizeKB(relPath) {
  try {
    return +(fs.statSync(path.join(process.cwd(), relPath)).size / 1024).toFixed(1);
  } catch {
    return null;
  }
}

function mdxExists(route) {
  if (route.startsWith('/articles/')) {
    const slug = route.replace(/^\/articles\//, '').replace(/\/$/, '');
    return fs.existsSync(path.join(process.cwd(), 'src/content/articles', `${slug}.mdx`));
  }
  if (route.startsWith('/baptisty-rossii/') && route !== '/baptisty-rossii/') {
    const slug = route.replace(/^\/baptisty-rossii\//, '').replace(/\/$/, '');
    return fs.existsSync(path.join(process.cwd(), 'src/content/articles', `${slug}.mdx`));
  }
  return false;
}

function suggestedLane(route, category, hasMdx) {
  if (category === 'hybrid-page-segments') return 'shell-first';
  if (category === 'hybrid-delegated-component') return 'shell-family';
  if (hasMdx) return 'content-layout-first';
  if (route.startsWith('/karty/') || route === '/rodosloviye/' || route === '/konfessii/russkij-baptizm/' || route === '/map/') {
    return 'parallel-run/high-risk';
  }
  return 'special-case';
}

const pages = walk(ROOT).sort();
const summary = {
  generatedAt: new Date().toISOString(),
  totalAstroPages: pages.length,
  productionRoutes: 0,
  categories: {
    'pure-full-body-shadow': [],
    'hybrid-page-segments': [],
    'hybrid-delegated-component': [],
    'dev-native': [],
  },
};

for (const file of pages) {
  const source = fs.readFileSync(file, 'utf8');
  const route = routeFromPage(file);
  const category = classifyPage(source, file);
  const imports = importsFromPage(source);
  const legacyPath = legacyHtmlPath(route, category);
  const legacyKB = legacyPath ? fileSizeKB(legacyPath) : null;
  const hasMdx = mdxExists(route);
  const lane = suggestedLane(route, category, hasMdx);
  const row = {
    route,
    file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
    imports,
    legacyHtmlPath: legacyPath,
    legacyHtmlKB: legacyKB,
    mdxExists: hasMdx,
    suggestedLane: lane,
  };
  summary.categories[category].push(row);
  if (category !== 'dev-native') summary.productionRoutes += 1;
}

function printMarkdown(data) {
  const cats = data.categories;
  console.log('# Route Shadow Taxonomy');
  console.log('');
  console.log(`Generated: ${data.generatedAt}`);
  console.log('');
  console.log('| Category | Count | Meaning |');
  console.log('|---|---:|---|');
  console.log(`| pure-full-body-shadow | ${cats['pure-full-body-shadow'].length} | loadLegacyFullDocument + bodyHtml verbatim |`);
  console.log(`| hybrid-page-segments | ${cats['hybrid-page-segments'].length} | page assembles body from raw fragments/components |`);
  console.log(`| hybrid-delegated-component | ${cats['hybrid-delegated-component'].length} | page delegates to a component that assembles legacy fragments |`);
  console.log(`| dev-native | ${cats['dev-native'].length} | build/dev helper pages only |`);
  console.log('');
  for (const [category, rows] of Object.entries(cats)) {
    console.log(`## ${category}`);
    console.log('');
    for (const row of rows) {
      const imports = row.imports.map((x) => x.name).join(', ') || '—';
      const legacyPath = row.legacyHtmlPath || 'n/a';
      const legacyKB = row.legacyHtmlKB == null ? 'n/a' : `${row.legacyHtmlKB}KB`;
      console.log(`- ${row.route} — ${row.file} — legacy: ${legacyPath} (${legacyKB}) — mdx: ${row.mdxExists ? 'yes' : 'no'} — lane: ${row.suggestedLane} — imports: ${imports}`);
    }
    console.log('');
  }
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(summary, null, 2));
} else {
  printMarkdown(summary);
}
