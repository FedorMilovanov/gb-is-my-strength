#!/usr/bin/env node
'use strict';

/*
 * sources:hygiene — enforces Charter standard S12 (docs/ARTICLE-STANDARD-CHARTER.md):
 * "ссылка ведёт к читателю, а не к диску". Backstage research scaffolding must never
 * ship in article bodies, reader-facing metadata, or source lists — no repo paths,
 * OCR filenames, or working notes. This is a pure string scan (fast, deterministic);
 * it complements audit-pro's base-path-leak check with editorial-apparatus leaks.
 *
 * Scope: published article content only — MDX twins + article/series pilot bodies
 * and their reader-facing PageHead metadata.
 * Usage: node scripts/sources-hygiene.js            (check, exit 1 on any violation)
 *        node scripts/sources-hygiene.js --list      (also print every match)
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LIST = process.argv.includes('--list');

// Backstage markers that must not appear in reader-facing article content/metadata.
// Each: [regex, human label]. Kept surgical — exact scaffolding phrases only.
const FORBIDDEN = [
  [/raw-sources\//, 'internal OCR path (raw-sources/…)'],
  [/research-досье/, 'backstage phrase «research-досье»'],
  [/сохран[её]н[а-я]*\s+локально/i, 'backstage note «сохранён/сохранены локально»'],
  [/в\s+research\b/i, 'internal research workspace reference'],
  [/следующий\s+шаг\s+уже\s+начат/i, 'working note «следующий шаг уже начат»'],
  [/URL\s+зафиксирован/i, 'backstage note «URL зафиксирован…»'],
  [/что\s+нужно\s+исправить\s+в\s+3D/i, 'working note «что нужно исправить в 3D…»'],
  [/очередь\s+правок\s+3D-карты/i, 'working note «очередь правок 3D-карты»'],
  [/Исследовательское\s+досье\s+статьи/i, 'backstage note «Исследовательское досье статьи»'],
  [/\/(baptisty-rossii|articles|hard-texts|nagornaya)\/research\//, 'internal research dir path'],
  [/<code>[^<]*\.(md|txt|csv)<\/code>/i, 'internal source file shown in <code> (.md/.txt/.csv)'],
];

// Regression fixtures for exact leak classes that previously reached public prose
// or reader-facing metadata. They make the scanner fail closed if a later regex
// refactor silently loses ё/е, workspace-note, or 3D edit-queue coverage while the
// repository happens not to contain an example.
const FORBIDDEN_FIXTURES = [
  'Для сверки сохранены локально первые контрольные выпуски.',
  'Для сверки сохранён локально контрольный выпуск.',
  'В research заведён каталог.',
  'После находки PDF-корпуса следующий шаг уже начат: в research заведён каталог.',
  'В справочнике указана очередь правок 3D-карты.',
];

for (const fixture of FORBIDDEN_FIXTURES) {
  const caught = FORBIDDEN.some(([re]) => new RegExp(re.source, re.flags.replace('g', '')).test(fixture));
  if (!caught) {
    console.error(`❌ sources:hygiene regression fixture is no longer caught: ${fixture}`);
    process.exit(1);
  }
}

// Directories whose article bodies / PageHead metadata are reader-facing production.
const SCAN_DIRS = [
  'src/content/articles',
  'src/components/baptisty-rossii',
  'src/components/article-pilots',
  'src/components/pastor-series',
  'src/components/hard-texts',
];

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(rel, out);
    else if (/\.(mdx|astro)$/.test(ent.name) && /(Body|PageHead|\.mdx$)/.test(ent.name)) out.push(rel);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(d => walk(d));
let violations = 0;
const perFile = {};

for (const rel of files) {
  let text;
  try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  for (const [re, label] of FORBIDDEN) {
    const m = text.match(new RegExp(re, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (m) {
      violations += m.length;
      (perFile[rel] ||= []).push(`${label} ×${m.length}`);
      if (LIST) for (const hit of m.slice(0, 3)) console.log(`  ${rel}: …${hit}…`);
    }
  }
}

console.log('=== sources:hygiene (Charter S12) ===');
console.log(`Scanned ${files.length} article/metadata files across ${SCAN_DIRS.length} scopes.`);
if (!violations) {
  console.log('✅ No backstage research scaffolding in reader-facing content/metadata.');
  process.exit(0);
}
for (const [f, labels] of Object.entries(perFile)) console.log(`❌ ${f} — ${labels.join('; ')}`);
console.log(`\n❌ ${violations} backstage-leak marker(s) in ${Object.keys(perFile).length} file(s). Clean before publish (S12).`);
process.exit(1);
