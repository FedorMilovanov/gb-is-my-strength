#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const TEXT_EXTENSIONS = new Set(['.astro', '.html', '.md', '.mdx', '.js', '.mjs', '.jsx', '.tsx', '.css']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'pagefind', '.astro']);
const DOVE_SIGNALS = /fn-marker--dove|fn-dove-icon|fn-dove-wing/gi;
const CROSS_GLYPHS = /[†‡✝✞✟✠✚✛✜✢✣✤✥✦✧]/gu;

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

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function sourceWindow(source, index, width = 2600) {
  const start = Math.max(0, index - Math.floor(width / 3));
  return {
    start,
    line: lineAt(source, index),
    text: source.slice(start, start + width)
  };
}

function snippet(source, index, width = 520) {
  return sourceWindow(source, index, width).text.replace(/\s+/g, ' ').trim();
}

function classValue(tag) {
  const match = tag.match(/\bclass=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

function stripMarkup(value) {
  return String(value || '')
    .replace(/<span\b[^>]*class=["'][^"']*(?:tooltip|gtip|btip)[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markerKind(classes, visibleText) {
  const isDove = classes.includes('fn-marker--dove');
  const hasNumber = /\d/.test(visibleText);
  if (isDove && hasNumber) return 'invalid-dove-numbered';
  if (isDove) return 'dove-unnumbered';
  if (hasNumber) return 'numbered';
  return 'invalid-unnumbered-without-dove';
}

function auditFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const markers = [];
  const literalGlyphs = [];
  const closeIcons = [];
  const runtimeSnippets = [];

  const markerPattern = /<(span|button|a|sup)\b([^>]*\bclass=["'][^"']*\bfn-marker\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of source.matchAll(markerPattern)) {
    const openingTag = `<${match[1]}${match[2]}>`;
    const classes = classValue(openingTag).split(/\s+/).filter(Boolean);
    const visibleText = stripMarkup(match[3]);
    const kind = markerKind(classes, visibleText);
    markers.push({
      line: lineAt(source, match.index),
      classes,
      visibleText,
      kind,
      isDove: kind === 'dove-unnumbered',
      isNumbered: kind === 'numbered',
      valid: kind === 'dove-unnumbered' || kind === 'numbered',
      snippet: snippet(source, match.index)
    });
  }

  for (const match of source.matchAll(CROSS_GLYPHS)) {
    const local = snippet(source, match.index, 360);
    if (/fn-marker|tooltip|footnote|сноск/i.test(local)) {
      literalGlyphs.push({ glyph: match[0], line: lineAt(source, match.index), snippet: local });
    }
  }

  for (const match of source.matchAll(/M1\s+1L13\s+13M13\s+1L1\s+13/gi)) {
    closeIcons.push({ line: lineAt(source, match.index), snippet: snippet(source, match.index) });
  }

  const doveRe = new RegExp(DOVE_SIGNALS.source, DOVE_SIGNALS.flags);
  let doveMatch;
  let captured = 0;
  while ((doveMatch = doveRe.exec(source)) !== null && captured < 6) {
    runtimeSnippets.push({ signal: doveMatch[0], ...sourceWindow(source, doveMatch.index) });
    captured += 1;
    if (doveMatch[0].length === 0) doveRe.lastIndex += 1;
  }

  if (!markers.length && !literalGlyphs.length && !closeIcons.length && !runtimeSnippets.length) return null;
  return {
    file: rel(file),
    markerCount: markers.length,
    numberedCount: markers.filter((item) => item.kind === 'numbered').length,
    doveCount: markers.filter((item) => item.kind === 'dove-unnumbered').length,
    invalidCount: markers.filter((item) => !item.valid).length,
    markers,
    literalGlyphs,
    closeIcons,
    runtimeSnippets,
    containsDoveRuntime: runtimeSnippets.length > 0
  };
}

function main() {
  const files = walk(ROOT).map(auditFile).filter(Boolean).sort((a, b) => a.file.localeCompare(b.file));
  const totals = files.reduce((acc, file) => {
    acc.markers += file.markerCount;
    acc.numbered += file.numberedCount;
    acc.doves += file.doveCount;
    acc.invalid += file.invalidCount;
    acc.literalGlyphs += file.literalGlyphs.length;
    acc.closeIcons += file.closeIcons.length;
    acc.runtimeSnippets += file.runtimeSnippets.length;
    return acc;
  }, { markers: 0, numbered: 0, doves: 0, invalid: 0, literalGlyphs: 0, closeIcons: 0, runtimeSnippets: 0 });

  const violations = [];
  for (const file of files) {
    for (const marker of file.markers.filter((item) => !item.valid)) {
      violations.push(`${file.file}:${marker.line}: ${marker.kind} (${marker.visibleText || 'empty'})`);
    }
    for (const glyph of file.literalGlyphs) {
      violations.push(`${file.file}:${glyph.line}: cross-like tooltip trigger ${glyph.glyph}`);
    }
  }

  const report = { generatedAt: new Date().toISOString(), totals, violations, files };
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'tooltip-icon-audit.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(REPORTS, 'tooltip-icon-audit.md'), [
    '# Tooltip icon audit', '',
    'Canonical rule: numbered academic/Bible notes retain numeric markers; unnumbered standalone notes use the interactive dove.', '',
    `- Trigger markers: ${totals.markers}`,
    `- Valid numbered markers: ${totals.numbered}`,
    `- Valid unnumbered dove markers: ${totals.doves}`,
    `- Invalid marker semantics: ${totals.invalid}`,
    `- Literal cross-like trigger glyphs: ${totals.literalGlyphs}`,
    `- Close X icons (kept as close controls): ${totals.closeIcons}`,
    `- Dove runtime/CSS extracts: ${totals.runtimeSnippets}`,
    '', '## Violations', '',
    ...(violations.length ? violations.map((item) => `- ${item}`) : ['- none']),
    '', '## Files', '',
    ...files.map((file) => `- \`${file.file}\`: ${file.markerCount} markers (${file.numberedCount} numbered, ${file.doveCount} dove, ${file.invalidCount} invalid), ${file.literalGlyphs.length} cross-like glyphs`)
  ].join('\n') + '\n');

  console.log(`Tooltip icon audit: ${totals.markers} markers, ${totals.numbered} numbered, ${totals.doves} doves, ${totals.invalid} invalid, ${totals.literalGlyphs} cross-like glyphs.`);
  if (violations.length) process.exitCode = 1;
}

main();
