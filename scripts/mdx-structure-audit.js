#!/usr/bin/env node
/**
 * mdx-structure-audit.js — Publication Purity Gate v1
 *
 * Detects structural defects in MDX source files that indicate
 * failed HTML→MDX conversion: glued footnotes, collapsed tables,
 * layout coordinate leaks, inline blockquotes/headings, etc.
 *
 * Usage:
 *   node scripts/mdx-structure-audit.js
 *   node scripts/mdx-structure-audit.js --strict  (exit 1 on any warning)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content/articles');

const args = process.argv.slice(2);
const strict = args.includes('--strict');

const BAD_PATTERNS = [
  { kind: 'footnote-source-glue', rx: /[.!?»"\)]\d+[A-ZА-ЯЁ]/, desc: 'Footnote marker glued to next sentence' },
  { kind: 'year-glue', rx: /\b(?:1[0-9]{3}|20[0-9]{2})[А-ЯЁ]/, desc: 'Year glued to Cyrillic word (e.g. 2016Франциск)' },
  { kind: 'layout-coordinates-leak', rx: /left=\d+(?:\.\d+)?%,\s*width=/, desc: 'CSS layout coordinates leaked into MDX text' },
  { kind: 'blockquote-inline', rx: /[^\n][ \t]+>[ \t]+\S/, desc: 'Blockquote starting mid-paragraph (collapsed HTML blockquote)' },
  { kind: 'heading-inline', rx: /---[ \t]*##/, desc: 'Heading on same line as frontmatter close' },
  { kind: 'ukrainian-minute', rx: /\bмін\b/, desc: 'Ukrainian "мін" instead of Russian "мин"' },
  { kind: 'spurgeon-typo', rx: /Спердген/, desc: 'Typo: Спердген should be Сперджен' },
  { kind: 'mixed-word-glue', rx: /[а-яё][A-Z][a-z]/, desc: 'Cyrillic-Latin word splice (e.g. труженикаnister)' },
  { kind: 'double-label', rx: /\b([A-Z][a-z]{3,})\s+\1\b/, desc: 'Duplicate label (e.g. Gillism Gillism)' },
];

const errors = [];
const warnings = [];

const mdxFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'));

for (const file of mdxFiles) {
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  for (const { kind, rx, desc } of BAD_PATTERNS) {
    const matches = [...content.matchAll(new RegExp(rx.source, (rx.flags || '') + 'g'))];
    if (matches.length > 0) {
      for (const m of matches) {
        const line = content.substring(0, m.index).split('\n').length;
        const ctx = content.substring(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, '↵');
        const msg = `${file}:${line} [${kind}] ${desc}: ...${ctx}...`;
        if (kind === 'ukrainian-minute' || kind === 'spurgeon-typo') {
          errors.push(msg);
        } else {
          warnings.push(msg);
        }
      }
    }
  }
}

console.log('\n═══ MDX Structure Audit ═══\n');

if (errors.length > 0) {
  console.log('── ERRORS ──');
  for (const e of errors) console.log(`❌ ${e}`);
}

if (warnings.length > 0) {
  console.log('── WARNINGS ──');
  for (const w of warnings) console.log(`⚠️  ${w}`);
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ MDX structure audit passed — 0 errors, 0 warnings');
}

console.log(`\nChecked ${mdxFiles.length} MDX files, ${errors.length} errors, ${warnings.length} warnings`);

if (strict && (errors.length > 0 || warnings.length > 0)) {
  process.exit(1);
}
if (errors.length > 0) {
  process.exit(1);
}
