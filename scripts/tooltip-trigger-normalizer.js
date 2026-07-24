#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeTooltipStyles } = require('./tooltip-style-normalizer.js');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SOURCE_ROOTS = [
  'src',
  'articles',
  'biografii',
  'hard-texts',
  'konfessii',
  'pastor-series',
  'baptisty-rossii'
];
const EXTENSIONS = new Set(['.astro', '.html', '.md', '.mdx', '.jsx', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'pagefind', '.astro']);
const MARKER_START = /<span\b([^>]*\bclass=["'][^"']*\bfn-marker\b[^"']*["'][^>]*)>([\s\S]*?)(<span\b[^>]*\bclass=["'][^"']*\btooltip\b[^"']*["'][^>]*>)/gi;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(abs);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&dagger;|&#8224;|&#x2020;/gi, '†')
    .replace(/&Dagger;|&#8225;|&#x2021;/gi, '‡')
    .replace(/&ast;|&#42;|&#x2a;/gi, '*')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&zwj;|&#8205;|&#x200d;/gi, '')
    .replace(/&zwnj;|&#8204;|&#x200c;/gi, '')
    .replace(/&NoBreak;|&#8288;|&#x2060;/gi, '');
}

function visibleTrigger(prefix) {
  return decodeEntities(prefix)
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classValue(attributes) {
  const match = attributes.match(/\bclass=(["'])([^"']*)\1/i);
  return match ? match[2] : '';
}

function replaceClass(attributes, classes) {
  if (/\bclass=(["'])/i.test(attributes)) {
    return attributes.replace(/\bclass=(["'])([^"']*)\1/i, (_, quote) => `class=${quote}${classes}${quote}`);
  }
  return `${attributes} class="${classes}"`;
}

function ensureDoveClass(attributes) {
  const classes = classValue(attributes).split(/\s+/).filter(Boolean);
  if (!classes.includes('fn-marker')) classes.unshift('fn-marker');
  if (!classes.includes('fn-marker--dove')) classes.push('fn-marker--dove');
  return replaceClass(attributes, classes.join(' '));
}

function ensureAccessibility(attributes) {
  let next = attributes;
  if (!/\brole=/i.test(next)) next += ' role="button"';
  if (!/\btabindex=/i.test(next)) next += ' tabindex="0"';
  if (!/\baria-label=/i.test(next)) next += ' aria-label="Показать пояснение"';
  return next;
}

function normalizeSource(source) {
  let changes = 0;
  const output = source.replace(MARKER_START, (full, attributes, prefix, tooltipStart) => {
    const trigger = visibleTrigger(prefix);
    const classes = classValue(attributes).split(/\s+/).filter(Boolean);
    const isDove = classes.includes('fn-marker--dove');
    const isNumbered = /\d/u.test(trigger);

    if (isNumbered) {
      // Numbered academic/Bible notes keep their numeric marker and never become doves.
      if (isDove) {
        const filtered = classes.filter((name) => name !== 'fn-marker--dove');
        changes += 1;
        return `<span${replaceClass(attributes, filtered.join(' '))}>${prefix}${tooltipStart}`;
      }
      return full;
    }

    // Any standalone, unnumbered note uses the dove. Remove dagger/star/SVG trigger content.
    const nextAttributes = ensureAccessibility(ensureDoveClass(attributes));
    if (!isDove || trigger || /<svg\b/i.test(prefix)) changes += 1;
    return `<span${nextAttributes}>${tooltipStart}`;
  });

  return { output, changes };
}

function normalizeSharedStyles() {
  const file = path.join(ROOT, 'css/site.css');
  const source = fs.readFileSync(file, 'utf8');
  const result = normalizeTooltipStyles(source);
  if (result.output !== source && WRITE) fs.writeFileSync(file, result.output);
  if (result.output !== source) {
    console.log(`${WRITE ? 'WRITE' : 'WOULD WRITE'} ${rel(file)} (${result.changes} marker style change(s))`);
  }
  return result;
}

function main() {
  const files = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));
  let changedFiles = 0;
  let changes = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const result = normalizeSource(source);
    if (!result.changes || result.output === source) continue;
    changedFiles += 1;
    changes += result.changes;
    console.log(`${WRITE ? 'WRITE' : 'WOULD WRITE'} ${rel(file)} (${result.changes} marker change(s))`);
    if (WRITE) fs.writeFileSync(file, result.output);
  }

  const styleResult = normalizeSharedStyles();
  changes += styleResult.changes;
  if (styleResult.changes) changedFiles += 1;

  console.log(`Tooltip contract normalizer: ${changes} change(s) in ${changedFiles} file(s).`);
  if (!WRITE && changes) process.exitCode = 1;
}

if (require.main === module) main();
else module.exports = { normalizeSource, visibleTrigger, normalizeSharedStyles };
