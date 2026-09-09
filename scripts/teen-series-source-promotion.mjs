#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const DATE = '2026-09-10T00:00:00+03:00';
const OG = '/images/teen-series/series-hero.svg';
const OG_ALT = 'Свет у открытой двери и телефон на пороге — образ скрытой и открытой жизни';
const SLUGS = [
  'podrostok-za-kadrom-dvoynaya-zhizn',
  'podrostok-za-kadrom-roditelyam-posle-razoblacheniya',
  'podrostok-za-kadrom-chto-delat-tserkvi',
  'vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie',
  'vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya',
  'sovershennoletie-roditelskaya-vlast-chto-menyaetsya',
  'vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti',
];

function quoted(value) {
  return JSON.stringify(value);
}

function updateFrontmatter(source, slug) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${slug}: missing frontmatter`);
  let lines = match[1].split('\n').filter((line) =>
    !/^# Контент загружен с опережением:/u.test(line) &&
    !/^# Явный draft для claim\/source-аудита;/u.test(line)
  );

  const set = (key, value) => {
    const index = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
    const next = `${key}: ${value}`;
    if (index >= 0) lines[index] = next;
    else lines.push(next);
  };

  set('contentStatus', quoted('published'));
  set('publishedAt', quoted(DATE));
  set('updatedAt', quoted(DATE));
  set('draft', 'false');
  set('noindex', 'false');
  set('sourcesRequired', 'true');
  set('series', quoted('teen-double-life'));
  set('canonicalOverride', quoted(`https://gospod-bog.ru/articles/${slug}/`));
  set('ogImage', quoted(OG));
  set('ogImageAlt', quoted(OG_ALT));

  return source.replace(match[0], `---\n${lines.join('\n')}\n---\n`);
}

function assertPublished(source, slug) {
  const required = [
    'contentStatus: "published"',
    `publishedAt: "${DATE}"`,
    `updatedAt: "${DATE}"`,
    'draft: false',
    'noindex: false',
    'sourcesRequired: true',
    'series: "teen-double-life"',
    `canonicalOverride: "https://gospod-bog.ru/articles/${slug}/"`,
    `ogImage: "${OG}"`,
    `ogImageAlt: "${OG_ALT}"`,
  ];
  for (const needle of required) {
    if (!source.includes(needle)) throw new Error(`${slug}: missing ${needle}`);
  }
  if (/^# (?:Контент загружен с опережением|Явный draft)/mu.test(source)) {
    throw new Error(`${slug}: prepublication frontmatter comment remains`);
  }
}

let changed = 0;
for (const slug of SLUGS) {
  const file = path.join(ROOT, 'src', 'content', 'articles', `${slug}.mdx`);
  const source = fs.readFileSync(file, 'utf8');
  const normalized = updateFrontmatter(source, slug);
  assertPublished(normalized, slug);
  if (source !== normalized) {
    changed += 1;
    if (WRITE) fs.writeFileSync(file, normalized);
  }
}

if (!WRITE && changed) {
  console.error(`❌ ${changed} teen source file(s) require publication normalization`);
  process.exit(1);
}
console.log(`✅ Teen source publication state ${WRITE ? 'normalized' : 'canonical'} (${SLUGS.length} files${WRITE ? `; changed ${changed}` : ''})`);
