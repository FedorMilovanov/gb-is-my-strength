#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const SERIES = [
  ['podrostok-za-kadrom-dvoynaya-zhizn', 32, 'I', 'Двойная жизнь'],
  ['podrostok-za-kadrom-roditelyam-posle-razoblacheniya', 43, 'II', 'После разоблачения'],
  ['podrostok-za-kadrom-chto-delat-tserkvi', 39, 'III', 'Что делает церковь'],
  ['vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie', 37, 'A', 'Ушёл из дома'],
  ['vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya', 36, 'B', 'Дом и деньги'],
  ['sovershennoletie-roditelskaya-vlast-chto-menyaetsya', 35, 'C', 'Власть после 18'],
  ['vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti', 42, 'D', 'Дочь и брак'],
];

function fail(message) {
  console.error(`[teen-series-foundation] FAIL: ${message}`);
  process.exitCode = 1;
}

function scalar(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return undefined;
  return match[1].replace(/^['"]|['"]$/g, '');
}

function bool(frontmatter, key) {
  const value = scalar(frontmatter, key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function number(frontmatter, key) {
  const value = scalar(frontmatter, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---\n')) throw new Error(`${file}: missing opening frontmatter fence`);
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) throw new Error(`${file}: missing closing frontmatter fence`);
  return text.slice(4, end);
}

let total = 0;

for (const [slug, expectedMinutes, displayMark, mobileLabel] of SERIES) {
  const file = path.join(ROOT, 'src', 'content', 'articles', `${slug}.mdx`);
  if (!fs.existsSync(file)) {
    fail(`missing canonical draft: ${path.relative(ROOT, file)}`);
    continue;
  }

  let fm;
  try {
    fm = readFrontmatter(file);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    continue;
  }

  if (scalar(fm, 'slug') !== slug) fail(`${slug}: frontmatter slug mismatch`);
  if (bool(fm, 'draft') !== true) fail(`${slug}: draft must remain true before the atomic publication transaction`);
  if (bool(fm, 'noindex') !== true) fail(`${slug}: noindex must remain true before the atomic publication transaction`);
  if (bool(fm, 'sourcesRequired') !== true) fail(`${slug}: sourcesRequired must remain true`);

  const minutes = number(fm, 'readingTime');
  if (minutes !== expectedMinutes) {
    fail(`${slug}: readingTime=${String(minutes)}, expected ${expectedMinutes}`);
  }
  total += minutes ?? 0;

  const routeDir = path.join(ROOT, 'src', 'pages', 'articles', slug);
  if (fs.existsSync(routeDir)) {
    fail(`${slug}: production route exists during foundation phase (${path.relative(ROOT, routeDir)})`);
  }

  // A-D are presentation marks on first-class core articles. Do not translate
  // these display letters into shared-engine mark.kind='letter', because that
  // semantic means satellite and removes the item from normal prev/next/rail.
  if (['A', 'B', 'C', 'D'].includes(displayMark) && !mobileLabel) {
    fail(`${slug}: companion core item requires an explicit short mobile label`);
  }
}

if (SERIES.length !== 7) fail(`canonical series must contain exactly 7 core items, got ${SERIES.length}`);
if (total !== 264) fail(`canonical total reading time must be 264 min, got ${total}`);

const seriesJsonPath = path.join(ROOT, 'data', 'series.json');
if (fs.existsSync(seriesJsonPath)) {
  const raw = fs.readFileSync(seriesJsonPath, 'utf8');
  const registry = JSON.parse(raw);
  if (registry['teen-double-life']) {
    fail('data/series.json already exposes teen-double-life during foundation phase; registry admission belongs to the atomic release lane');
  }
}

if (!process.exitCode) {
  console.log('[teen-series-foundation] PASS');
  console.log(`  core order: ${SERIES.map(([, , mark]) => mark).join(' -> ')}`);
  console.log(`  articles: ${SERIES.length}`);
  console.log(`  total reading time: ${total} min`);
  console.log('  publication: blocked (draft + noindex + no production routes)');
}
