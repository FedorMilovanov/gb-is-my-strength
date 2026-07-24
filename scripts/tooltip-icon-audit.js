#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { visibleTrigger } = require('./tooltip-trigger-normalizer.js');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const SOURCE_ROOTS = ['src', 'articles', 'biografii', 'hard-texts', 'konfessii', 'pastor-series', 'baptisty-rossii'];
const EXTENSIONS = new Set(['.astro', '.html', '.md', '.mdx', '.jsx', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'pagefind', '.astro']);
const MARKER_START = /<span\b([^>]*\bclass=["'][^"']*\bfn-marker\b[^"']*["'][^>]*)>([\s\S]*?)(<span\b[^>]*\bclass=["'][^"']*\btooltip\b[^"']*["'][^>]*>)/gi;
const CROSS_GLYPHS = /[†‡✝✞✟✠✚✛✜✢✣✤✥✦✧]/u;

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

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function classValue(attributes) {
  const match = attributes.match(/\bclass=(["'])([^"']*)\1/i);
  return match ? match[2] : '';
}

function snippet(source, index, width = 620) {
  const start = Math.max(0, index - Math.floor(width / 3));
  return source.slice(start, start + width).replace(/\s+/g, ' ').trim();
}

function classifyMarker(attributes, prefix) {
  const classes = classValue(attributes).split(/\s+/).filter(Boolean);
  const trigger = visibleTrigger(prefix);
  const isDove = classes.includes('fn-marker--dove');
  const isNumbered = /\d/u.test(trigger);
  const hasCrossGlyph = CROSS_GLYPHS.test(trigger);
  const hasSvg = /<svg\b/i.test(prefix);

  if (isNumbered && isDove) return { kind: 'invalid-numbered-dove', valid: false, trigger, hasCrossGlyph, hasSvg };
  if (isNumbered) return { kind: 'numbered', valid: true, trigger, hasCrossGlyph, hasSvg };
  if (isDove && !trigger && !hasSvg) return { kind: 'dove-unnumbered', valid: true, trigger, hasCrossGlyph, hasSvg };
  return { kind: 'invalid-unnumbered-trigger', valid: false, trigger, hasCrossGlyph, hasSvg };
}

function scanContentFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const markers = [];
  for (const match of source.matchAll(MARKER_START)) {
    const classification = classifyMarker(match[1], match[2]);
    markers.push({
      line: lineAt(source, match.index),
      classes: classValue(match[1]).split(/\s+/).filter(Boolean),
      ...classification,
      snippet: snippet(source, match.index)
    });
  }
  return markers.length ? { file: rel(file), markers } : null;
}

function runtimeEvidence() {
  const evidence = [];
  for (const relative of ['js/site.js', 'css/site.css']) {
    const file = path.join(ROOT, relative);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    evidence.push({
      file: relative,
      hasDoveSvg: /fn-dove-icon/.test(source),
      hasWingAnimation: /fn-dove-wing/.test(source) && /fn-dove-flap/.test(source),
      hasHoverContract: /fn-marker--dove:hover/.test(source),
      hasCloseControl: /data-tooltip-close/.test(source) || /M1\s+1L13\s+13M13\s+1L1\s+13/.test(source)
    });
  }
  return evidence;
}

function main() {
  const files = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)))
    .map(scanContentFile)
    .filter(Boolean)
    .sort((a, b) => a.file.localeCompare(b.file));

  const markers = files.flatMap((file) => file.markers.map((marker) => ({ file: file.file, ...marker })));
  const totals = {
    markers: markers.length,
    numbered: markers.filter((item) => item.kind === 'numbered').length,
    doves: markers.filter((item) => item.kind === 'dove-unnumbered').length,
    invalid: markers.filter((item) => !item.valid).length,
    crossLikeTriggers: markers.filter((item) => item.hasCrossGlyph || item.hasSvg).length
  };
  const violations = markers.filter((item) => !item.valid).map((item) => (
    `${item.file}:${item.line}: ${item.kind} (${item.trigger || (item.hasSvg ? 'SVG' : 'empty')})`
  ));
  const report = { generatedAt: new Date().toISOString(), totals, violations, runtime: runtimeEvidence(), files };

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'tooltip-icon-audit.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(REPORTS, 'tooltip-icon-audit.md'), [
    '# Tooltip trigger audit', '',
    'Canonical rule: numbered academic/Bible notes retain numeric markers; unnumbered standalone notes use the interactive dove. Cross-like glyphs and SVG triggers are forbidden.', '',
    `- Trigger markers: ${totals.markers}`,
    `- Valid numbered markers: ${totals.numbered}`,
    `- Valid unnumbered dove markers: ${totals.doves}`,
    `- Invalid marker semantics: ${totals.invalid}`,
    `- Cross-like glyph/SVG triggers: ${totals.crossLikeTriggers}`,
    '', '## Violations', '',
    ...(violations.length ? violations.map((item) => `- ${item}`) : ['- none']),
    '', '## Runtime evidence', '',
    ...report.runtime.map((item) => `- \`${item.file}\`: dove SVG=${item.hasDoveSvg}; wing animation=${item.hasWingAnimation}; hover=${item.hasHoverContract}; close control=${item.hasCloseControl}`)
  ].join('\n') + '\n');

  console.log(`Tooltip trigger audit: ${totals.markers} markers, ${totals.numbered} numbered, ${totals.doves} doves, ${totals.invalid} invalid.`);
  if (violations.length) process.exitCode = 1;
}

main();
