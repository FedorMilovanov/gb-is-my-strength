#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
const STYLES_DIR = path.join(ROOT, 'src', 'styles');

function fail(message) {
  console.error(`❌ ARTICLE THEME COHERENCE: ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertSharedReaderBridge() {
  const readerHead = read('js/reader-preferences-head.js');
  const required = [
    [/dataset\.readerEffectiveTheme\s*=\s*effectiveTheme/, 'reader effective theme dataset bridge'],
    [/classList\.toggle\(\s*['"]dark['"]\s*,\s*effectiveTheme\s*===\s*['"]dark['"]\s*\)/, 'reader effective theme -> html.dark bridge'],
    [/style\.colorScheme\s*=\s*effectiveTheme/, 'reader effective theme -> color-scheme bridge'],
  ];
  for (const [pattern, label] of required) {
    if (!pattern.test(readerHead)) fail(`shared runtime lost ${label}`);
  }

  const globalCss = read('src/styles/global.css');
  const surfaceContract = [
    [/\.astro-main\s*\{[\s\S]*?background\s*:\s*var\(--astro-color-surface\)/, '.astro-main semantic surface'],
    [/\.astro-main\s+h1\s*\{[\s\S]*?font-family\s*:\s*var\(--astro-font-serif\)/, '.astro-main typography contract'],
    [/\.astro-article__body\s+h2\s*\{[\s\S]*?color\s*:\s*var\(--astro-color-text\)/, 'article body semantic text'],
  ];
  for (const [pattern, label] of surfaceContract) {
    if (!pattern.test(globalCss)) fail(`shared article layer lost ${label}`);
  }
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
  return /var\(\s*--(?:astro-color|color|reading)-/i.test(value);
}

function isThemeScopedSelector(selector) {
  return /(?:\.dark\b|\[data-reader-(?:effective-)?theme\b|\[data-theme\b|prefers-color-scheme)/i.test(selector);
}

function isPageRootSelector(selector) {
  return /(?:^|[\s,>+~])(?:html|body|:root|\.astro-main|\.article-main|\.astro-article|\.astro-article__body)(?=$|[\s,.#:[>+~])/i.test(selector.trim());
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

function auditArticles() {
  const articleFiles = fs.readdirSync(ARTICLES_DIR)
    .filter((name) => name.endsWith('.mdx'))
    .sort();
  const styleOwners = new Map();
  const violations = [];

  for (const file of articleFiles) {
    const source = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    for (const style of importedArticleStyles(source)) {
      const owners = styleOwners.get(style) || [];
      owners.push(file);
      styleOwners.set(style, owners);
    }
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

  console.log(`✅ ARTICLE THEME COHERENCE: scanned ${articleFiles.length} standalone article MDX files; ${styleOwners.size} direct local stylesheet(s); no unscoped literal page-surface overrides.`);
  return { articleFiles, styleOwners };
}

assertSharedReaderBridge();
auditArticles();
if (process.exitCode) process.exit(process.exitCode);
