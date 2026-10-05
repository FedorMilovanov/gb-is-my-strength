#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const STYLES_DIR = path.join(ROOT, 'src', 'styles');
const ARTICLE_LAYOUTS = [
  'src/layouts/ArticleLayout.astro',
  'src/layouts/SeriesArticleLayout.astro',
];

function fail(message) {
  console.error(`❌ ARTICLE THEME COHERENCE: ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertPatterns(source, requirements, prefix) {
  for (const [pattern, label] of requirements) {
    if (!pattern.test(source)) fail(`${prefix} lost ${label}`);
  }
}

function assertSharedReaderBridge() {
  const readerHead = read('js/reader-preferences-head.js');
  assertPatterns(readerHead, [
    [/root\.setAttribute\(\s*['"]data-reader-theme['"]\s*,\s*state\.theme\s*\)/, 'first-paint data-reader-theme bridge'],
    [/root\.classList\.toggle\(\s*['"]dark['"]\s*,\s*state\.theme\s*===\s*['"]dark['"]\s*\)/, 'first-paint html.dark bridge'],
    [/root\.style\.setProperty\(\s*['"]--gb-reader-theme-ready['"]\s*,\s*['"]1['"]\s*\)/, 'first-paint theme-ready marker'],
  ], 'shared reader bootstrap');

  const readerRuntime = read('js/reader-preferences.js');
  assertPatterns(readerRuntime, [
    [/['"]\[data-gbs2-theme\]['"]/, 'series theme control registration'],
    [/root\.setAttribute\(\s*['"]data-reader-theme['"]\s*,\s*state\.theme\s*\)/, 'runtime data-reader-theme bridge'],
    [/root\.classList\.toggle\(\s*['"]dark['"]\s*,\s*state\.theme\s*===\s*['"]dark['"]\s*\)/, 'runtime html.dark bridge'],
    [/root\.style\.setProperty\(\s*['"]--gb-reader-theme-ready['"]\s*,\s*['"]1['"]\s*\)/, 'runtime theme-ready marker'],
  ], 'shared reader runtime');

  const globalCss = read('src/styles/global.css');
  assertPatterns(globalCss, [
    [/\.astro-main\s*\{[\s\S]*?background\s*:\s*var\(--astro-color-surface\)/, '.astro-main semantic surface'],
    [/\.astro-main\s+h1\s*\{[\s\S]*?font-family\s*:\s*var\(--astro-font-serif\)/, '.astro-main typography contract'],
    [/\.astro-article__body\s+h2\s*\{[\s\S]*?color\s*:\s*var\(--astro-color-text\)/, 'article body semantic text'],
  ], 'shared article layer');
}

function assertArticleStacks() {
  const standaloneLayout = read('src/layouts/ArticleLayout.astro');
  assertPatterns(standaloneLayout, [
    [/<BaseLayout[\s\S]*?ogType=['"]article['"]/, 'BaseLayout article ownership'],
    [/<slot\s+name=['"]chrome['"]\s*\/>/, 'reader chrome slot'],
    [/<article\s+class=['"]astro-article['"][^>]*data-pagefind-body/, 'semantic standalone article root'],
  ], 'ArticleLayout');

  const seriesLayout = read('src/layouts/SeriesArticleLayout.astro');
  assertPatterns(seriesLayout, [
    [/<BaseLayout[\s\S]*?ogType=['"]article['"][\s\S]*?bodyClass=['"]gbs-world['"]/, 'series BaseLayout theme scope'],
    [/<aside\s+class=['"]gbs2-rail['"]/, 'desktop series rail'],
    [/data-gbs2-theme/, 'series theme controls'],
    [/class=['"]gbs2-sheet-panel['"]/, 'mobile series sheet'],
    [/data-gbs2-pane=['"]toc['"]/, 'mobile series TOC pane'],
  ], 'SeriesArticleLayout');

  const siteCss = read('css/site.css');
  assertPatterns(siteCss, [
    [/\.gbs2-sheet-panel\s*\{[^}]*background\s*:\s*var\(--color-surface\)/, 'mobile sheet semantic surface'],
    [/\.gbs2-sheet-close\s*\{[^}]*background\s*:\s*var\(--color-surface\)[^}]*color\s*:\s*var\(--color-text\)/, 'mobile sheet close semantic colors'],
    [/\.gbs2-sheet-toclink\s*\{[^}]*color\s*:\s*var\(--color-text\)/, 'mobile TOC semantic text'],
    [/html\.dark\s+\.gbs2-mobile-head\s*\{[^}]*background\s*:/, 'mobile header dark-theme counterpart'],
  ], 'series reader CSS');
}

function importedArticleStyles(source) {
  const imports = new Set();
  const re = /import\s+(?:[^'";]+?\s+from\s+)?['"]@\/styles\/([^'"]+\.css)['"]\s*;?/g;
  let match;
  while ((match = re.exec(source))) imports.add(match[1]);
  return [...imports];
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function literalColor(value) {
  return /(?:#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(|\boklch\s*\(|\boklab\s*\(|\blab\s*\(|\blch\s*\(|\b(?:black|white)\b)/i.test(value);
}

function semanticValue(value) {
  return /var\(\s*--(?:astro-color|color|reading|gbs2|gb-reader)-/i.test(value);
}

function isThemeScopedSelector(selector) {
  return /(?:\.dark\b|\[data-reader-(?:effective-)?theme\b|\[data-theme\b|prefers-color-scheme)/i.test(selector);
}

function isPageRootSelector(selector) {
  return /(?:^|[\s,>+~])(?:html|body|:root|\.astro-main|\.article-main|\.astro-article|\.astro-article__body|\.toc-sidebar|\.hrail|\.mobile-top-bar|\.mobile-bottom-bar|\.toc-overlay|\.btoc-panel|\.gbs2-world|\.gbs2-rail|\.gbs2-mobile-head|\.gbs2-bbar|\.gbs2-sheet-panel|\.gbs2-sheet-body|\.gbs2-sheet-pane|\.gbs2-tocscroll)(?=$|[\s,.#:[>+~])/i.test(selector.trim());
}

function foundationalCustomProperty(property) {
  if (!property.startsWith('--')) return false;
  if (/(?:accent|warning|danger|success|brand|gold|border|shadow|ring|link)/i.test(property)) return false;
  return /(?:surface|canvas|text|prose|muted|panel|foreground|background|\bbg\b)/i.test(property);
}

function auditCss(css, label) {
  const violations = [];
  const clean = stripComments(css);
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let block;
  while ((block = blockRe.exec(clean))) {
    const selector = block[1].trim();
    if (!isPageRootSelector(selector) || isThemeScopedSelector(selector)) continue;

    const declarations = block[2];
    const declarationRe = /(^|;)\s*([\w-]+)\s*:\s*([^;{}]+)/g;
    let declaration;
    while ((declaration = declarationRe.exec(declarations))) {
      const property = declaration[2].trim();
      const value = declaration[3].trim();
      if (!literalColor(value) || semanticValue(value)) continue;

      const directSurface = /^(?:color|background|background-color)$/i.test(property);
      if (directSurface || foundationalCustomProperty(property)) {
        violations.push(`${label}: ${selector} -> ${property}: ${value}`);
      }
    }
  }
  return violations;
}

function walkFiles(dir, extension) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(full, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) found.push(full);
  }
  return found.sort();
}

function collectStyleOwner(styleOwners, style, owner) {
  const owners = styleOwners.get(style) || [];
  if (!owners.includes(owner)) owners.push(owner);
  styleOwners.set(style, owners);
}

function auditArticles() {
  const articleFiles = fs.readdirSync(ARTICLES_DIR)
    .filter((name) => name.endsWith('.mdx'))
    .sort();
  const styleOwners = new Map();
  const violations = [];
  const routeOwners = [];

  for (const file of articleFiles) {
    const source = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    for (const style of importedArticleStyles(source)) collectStyleOwner(styleOwners, style, `content/articles/${file}`);
  }

  for (const relativePath of ARTICLE_LAYOUTS) {
    const source = read(relativePath);
    for (const style of importedArticleStyles(source)) collectStyleOwner(styleOwners, style, relativePath);
  }

  for (const fullPath of walkFiles(PAGES_DIR, '.astro')) {
    const source = fs.readFileSync(fullPath, 'utf8');
    if (!/(?:ArticleLayout|SeriesArticleLayout)/.test(source)) continue;
    const owner = path.relative(ROOT, fullPath).replaceAll(path.sep, '/');
    routeOwners.push(owner);
    for (const style of importedArticleStyles(source)) collectStyleOwner(styleOwners, style, owner);
  }

  for (const [style, owners] of styleOwners) {
    const fullPath = path.join(STYLES_DIR, style);
    if (!fs.existsSync(fullPath)) {
      violations.push(`${style}: imported by ${owners.join(', ')} but file is missing`);
      continue;
    }
    const css = fs.readFileSync(fullPath, 'utf8');
    violations.push(...auditCss(css, `${style} [${owners.join(', ')}]`));
  }

  if (violations.length) {
    for (const violation of violations) fail(`local article stylesheet can force a theme island: ${violation}`);
  }

  console.log(`✅ ARTICLE THEME COHERENCE: scanned ${articleFiles.length} article MDX files, ${ARTICLE_LAYOUTS.length} article layouts and ${routeOwners.length} Astro article route owners; ${styleOwners.size} direct local stylesheet(s); no unscoped literal page/TOC surface overrides.`);
  return { articleFiles, routeOwners, styleOwners };
}

assertSharedReaderBridge();
assertArticleStacks();
auditArticles();
if (process.exitCode) process.exit(process.exitCode);
