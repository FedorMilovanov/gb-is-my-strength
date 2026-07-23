#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'reports');
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.astro', '.html', '.css',
  '.json', '.md', '.mdx', '.yml', '.yaml'
]);
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports',
  'pagefind', '.astro', '.cache'
]);

const PATTERNS = [
  ['glossary', /glossary/gi],
  ['gterm', /\bgterm\b/gi],
  ['gtip', /\bgtip\b/gi],
  ['bible-ref', /bible[-_ ]?ref/gi],
  ['bible-tooltip', /bible[^\n]{0,60}tooltip|tooltip[^\n]{0,60}bible/gi],
  ['btip', /\bbtip\b/gi],
  ['scripture', /scripture/gi],
  ['verse', /\bverse(?:s)?\b/gi],
  ['cassian', /кассиан|cassian/gi],
  ['synodal', /синодальн|synodal/gi],
  ['translation', /перевод(?:а|е|ом|ы)?|translation/gi]
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(abs);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

function compactSnippet(source, index, width = 180) {
  const start = Math.max(0, index - Math.floor(width / 3));
  const end = Math.min(source.length, start + width);
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

function scanFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const matches = [];
  for (const [kind, template] of PATTERNS) {
    const re = new RegExp(template.source, template.flags);
    let match;
    let count = 0;
    while ((match = re.exec(source)) !== null) {
      count += 1;
      if (matches.filter((item) => item.kind === kind).length < 8) {
        matches.push({
          kind,
          line: lineNumberAt(source, match.index),
          snippet: compactSnippet(source, match.index)
        });
      }
      if (match[0].length === 0) re.lastIndex += 1;
    }
    if (count > 8) matches.push({ kind, line: null, snippet: `… ${count - 8} additional match(es)` });
  }
  return matches.length ? { file: rel(file), size: Buffer.byteLength(source), matches } : null;
}

function parseGlossary() {
  const file = path.join(ROOT, 'data/glossary.json');
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const categories = new Map();
  const issues = [];
  const entries = [];
  const aliases = new Map();
  const bibleRefPattern = /(?:[1-3]\s*)?[А-ЯЁA-Z][а-яёa-z.]+\s+\d+:\d+(?:[–—-]\d+)?/g;

  for (const [term, value] of Object.entries(raw)) {
    const entry = value && typeof value === 'object' ? value : {};
    const definition = typeof entry.definition === 'string'
      ? entry.definition
      : entry.definition && typeof entry.definition.definition === 'string'
        ? entry.definition.definition
        : '';
    const detail = typeof entry.detail === 'string'
      ? entry.detail
      : entry.definition && typeof entry.definition.detail === 'string'
        ? entry.definition.detail
        : '';
    const category = entry.category || (entry.definition && entry.definition.category) || '(без категории)';
    const list = Array.isArray(entry.aliases)
      ? entry.aliases
      : entry.definition && Array.isArray(entry.definition.aliases)
        ? entry.definition.aliases
        : [];
    categories.set(category, (categories.get(category) || 0) + 1);
    if (!definition.trim()) issues.push(`${term}: missing definition`);
    if (!detail.trim()) issues.push(`${term}: missing detail`);
    if (!list.length) issues.push(`${term}: missing aliases`);
    if (!entry.categorySlug && !(entry.definition && (entry.definition.categorySlug || entry.definition.category_slug))) {
      issues.push(`${term}: missing categorySlug`);
    }
    for (const alias of [term, ...list]) {
      const key = String(alias).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
      const prior = aliases.get(key);
      if (prior && prior !== term) issues.push(`${term}: alias collision "${alias}" with ${prior}`);
      else aliases.set(key, term);
    }
    entries.push({
      term,
      category,
      categorySlug: entry.categorySlug || entry.category_slug || '',
      definitionLength: definition.length,
      detailLength: detail.length,
      aliasCount: list.length,
      aliases: list,
      bibleReferences: Array.from(new Set((definition + ' ' + detail).match(bibleRefPattern) || [])),
      hasEmphasisHtml: /<\/?(?:em|strong|span|button|svg)\b/i.test(definition + detail),
      autoHydrate: entry.autoHydrate !== false && !(entry.definition && entry.definition.autoHydrate === false)
    });
  }

  return {
    file: 'data/glossary.json',
    termCount: entries.length,
    categories: Object.fromEntries([...categories.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))),
    issues,
    entries
  };
}

function main() {
  const files = walk(ROOT);
  const references = files.map(scanFile).filter(Boolean).sort((a, b) => a.file.localeCompare(b.file));
  const glossary = parseGlossary();
  const inventory = {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    matchedFiles: references.length,
    glossary,
    references
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'reference-system-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');

  const md = [];
  md.push('# Reference system inventory', '');
  md.push(`- Scanned text files: ${inventory.scannedFiles}`);
  md.push(`- Files with glossary/Bible-reference signals: ${inventory.matchedFiles}`);
  if (glossary) {
    md.push(`- Glossary terms: ${glossary.termCount}`);
    md.push(`- Glossary structural issues: ${glossary.issues.length}`, '');
    md.push('## Glossary categories', '');
    for (const [category, count] of Object.entries(glossary.categories)) md.push(`- ${category}: ${count}`);
    md.push('', '## Glossary entries', '');
    for (const entry of glossary.entries) {
      const refs = entry.bibleReferences.length ? `; refs: ${entry.bibleReferences.join(', ')}` : '';
      md.push(`- **${entry.term}** — ${entry.category}; aliases: ${entry.aliasCount}; definition/detail: ${entry.definitionLength}/${entry.detailLength}${refs}`);
    }
  }
  md.push('', '## Matched files', '');
  for (const item of references) {
    const kinds = [...new Set(item.matches.map((match) => match.kind))].join(', ');
    md.push(`- \`${item.file}\` — ${kinds}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'reference-system-inventory.md'), md.join('\n') + '\n');

  console.log(`Reference system inventory: ${files.length} files scanned, ${references.length} matched.`);
  if (glossary) console.log(`Glossary: ${glossary.termCount} terms, ${glossary.issues.length} structural issue(s).`);
}

main();
