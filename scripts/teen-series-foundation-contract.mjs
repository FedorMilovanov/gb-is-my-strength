#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const SERIES = [
  ['podrostok-za-kadrom-dvoynaya-zhizn', 32, 'I', 'Двойная жизнь', 'teen-double-life', 0],
  ['podrostok-za-kadrom-roditelyam-posle-razoblacheniya', 43, 'II', 'После разоблачения', 'teen-parents-after-disclosure', 32],
  ['podrostok-za-kadrom-chto-delat-tserkvi', 39, 'III', 'Что делает церковь', 'teen-church-response', 75],
  ['vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie', 37, 'A', 'Ушёл из дома', 'adult-child-left-home', 114],
  ['vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya', 36, 'B', 'Дом и деньги', 'adult-child-home-money', 151],
  ['sovershennoletie-roditelskaya-vlast-chto-menyaetsya', 35, 'C', 'Власть после 18', 'adult-child-authority', 187],
  ['vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti', 42, 'D', 'Дочь и брак', 'adult-daughter-marriage', 222],
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

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function readFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---\n')) throw new Error(`${file}: missing opening frontmatter fence`);
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) throw new Error(`${file}: missing closing frontmatter fence`);
  return text.slice(4, end);
}

function pageBlock(config, pageId) {
  const anchor = `    '${pageId}': {`;
  const start = config.indexOf(anchor);
  if (start < 0) return undefined;
  const nextPage = config.indexOf("\n    '", start + anchor.length);
  const pagesEnd = config.indexOf('\n  },\n});', start + anchor.length);
  const endCandidates = [nextPage, pagesEnd].filter((value) => value >= 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : config.length;
  return config.slice(start, end);
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

  if (['A', 'B', 'C', 'D'].includes(displayMark) && !mobileLabel) {
    fail(`${slug}: companion core item requires an explicit short mobile label`);
  }
}

if (SERIES.length !== 7) fail(`canonical series must contain exactly 7 core items, got ${SERIES.length}`);
if (total !== 264) fail(`canonical total reading time must be 264 min, got ${total}`);

const configPath = path.join(
  ROOT,
  'src',
  'components',
  'article-pilots',
  '_shared',
  'series',
  'teenSeriesConfig.ts',
);

if (!fs.existsSync(configPath)) {
  fail(`missing prepublication series config: ${path.relative(ROOT, configPath)}`);
} else {
  const config = fs.readFileSync(configPath, 'utf8');
  if (!/seriesId:\s*['"]teen-double-life['"]/.test(config)) {
    fail('teenSeriesConfig.ts must declare seriesId teen-double-life');
  }
  if (!/const TOTAL_MIN\s*=\s*264\s*;/.test(config)) {
    fail('teenSeriesConfig.ts must keep the canonical total at 264 min');
  }
  if (!/quiz:\s*\[\s*\]/.test(config)) {
    fail('teenSeriesConfig.ts must keep quiz disabled during initial publication');
  }
  if (/mark:\s*\{\s*kind:\s*['"]letter['"]/.test(config)) {
    fail("teenSeriesConfig.ts must not use mark.kind='letter'; A-D are core labels, not satellites");
  }

  let previousHrefIndex = -1;
  for (const [slug, expectedMinutes, displayMark, mobileLabel, pageId, expectedDone] of SERIES) {
    const hrefToken = `href: '/articles/${slug}/'`;
    const hrefCount = countOccurrences(config, hrefToken);
    const hrefIndex = config.indexOf(hrefToken);
    if (hrefCount !== 1) {
      fail(`teenSeriesConfig.ts must contain exactly one canonical href for ${slug}; got ${hrefCount}`);
    }
    if (hrefIndex <= previousHrefIndex) {
      fail(`teenSeriesConfig.ts canonical item order must be I -> II -> III -> A -> B -> C -> D; ${slug} is out of order`);
    }
    previousHrefIndex = hrefIndex;

    if (!config.includes(`readingTime: '${expectedMinutes} мин'`)) {
      fail(`teenSeriesConfig.ts missing readingTime ${expectedMinutes} мин for ${slug}`);
    }
    if (!config.includes(`mobileSection: '${mobileLabel}'`)) {
      fail(`teenSeriesConfig.ts missing mobile label «${mobileLabel}» for ${slug}`);
    }

    const expectedMark = ['I', 'II', 'III'].includes(displayMark)
      ? `mark: { kind: 'roman', value: '${displayMark}' }`
      : `mark: { kind: 'label', value: '${displayMark}' }`;
    if (!config.includes(expectedMark)) {
      fail(`teenSeriesConfig.ts missing expected core mark ${displayMark} for ${slug}`);
    }

    const block = pageBlock(config, pageId);
    if (!block) {
      fail(`teenSeriesConfig.ts missing page config for ${pageId}`);
      continue;
    }
    if (!block.includes(`readingProgressDoneMin: ${expectedDone}`)) {
      fail(`teenSeriesConfig.ts ${pageId}: readingProgressDoneMin must be ${expectedDone}`);
    }
    if (!block.includes(`readingProgressPartMin: ${expectedMinutes}`)) {
      fail(`teenSeriesConfig.ts ${pageId}: readingProgressPartMin must be ${expectedMinutes}`);
    }
    if (!block.includes('readingProgressTotalMin: TOTAL_MIN')) {
      fail(`teenSeriesConfig.ts ${pageId}: readingProgressTotalMin must use TOTAL_MIN`);
    }
  }

  const totalProgressCount = countOccurrences(config, 'readingProgressTotalMin: TOTAL_MIN');
  if (totalProgressCount !== SERIES.length) {
    fail(`teenSeriesConfig.ts must expose total progress on exactly ${SERIES.length} pages; got ${totalProgressCount}`);
  }

  const registration = 'SERIES_CONFIGS[TEEN_DOUBLE_LIFE_SERIES.seriesId] = TEEN_DOUBLE_LIFE_SERIES;';
  if (countOccurrences(config, registration) !== 1) {
    fail('teenSeriesConfig.ts must register the prepublication config exactly once');
  }
}

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
  console.log('  series config: exact order/progress present, quiz disabled, A-D encoded as core labels');
  console.log('  publication: blocked (draft + noindex + no production routes)');
}
