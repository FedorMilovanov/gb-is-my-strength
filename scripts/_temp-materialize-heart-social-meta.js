#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slugs = [
  'chto-bibliya-nazyvaet-serdcem',
  'kak-hranit-serdce',
  'kak-menyaetsya-serdce',
  'myslennaya-zhizn-serdca',
  'novoe-serdce',
  'osvobozhdennoe-serdce',
  'religioznoe-serdce',
  'serdce-hrista-k-nemoshchnym',
  'serdce-i-duh',
  'serdce-i-iskushenie',
  'serdce-i-sokrovishche',
  'serdce-i-telo',
  'serdce-i-yazyk',
  'serdce-ne-v-odinochku',
  'serdce-pod-skorbyu',
  'serdce-spravochnik',
  'skrytye-idoly-serdca',
  'sovest-vnutrenniy-sud',
  'starye-dorozhki-serdca',
  'strah-bozhij-rabskij-ili-synovnij',
  'svoboda-vo-hriste',
  'tma-na-serdce',
];

const importLine = "import HeartSeriesSocialImageMeta from '@/components/seo/HeartSeriesSocialImageMeta.astro';";
let changed = 0;

for (const slug of slugs) {
  const file = path.join(ROOT, 'src', 'pages', 'articles', slug, 'index.astro');
  if (!fs.existsSync(file)) throw new Error(`${slug}: missing Astro entry ${file}`);
  let text = fs.readFileSync(file, 'utf8');

  if (!text.includes(importLine)) {
    const frontmatterEnd = text.indexOf('\n---', 4);
    if (frontmatterEnd < 0) throw new Error(`${slug}: frontmatter end not found`);
    text = text.slice(0, frontmatterEnd) + `\n${importLine}` + text.slice(frontmatterEnd);
  }

  if (!text.includes('<HeartSeriesSocialImageMeta />')) {
    const headOpen = '<head>';
    const openIndex = text.indexOf(headOpen);
    if (openIndex < 0) throw new Error(`${slug}: <head> not found`);
    const pageHeadMatch = text.slice(openIndex).match(/\n\s*<([A-Za-z0-9]+PageHead)\s*\/>/);
    if (!pageHeadMatch) throw new Error(`${slug}: PageHead mount not found`);
    const matchStart = openIndex + pageHeadMatch.index;
    const matchEnd = matchStart + pageHeadMatch[0].length;
    const indent = pageHeadMatch[0].match(/\n(\s*)</)?.[1] || '    ';
    text = text.slice(0, matchEnd) + `\n${indent}<HeartSeriesSocialImageMeta />` + text.slice(matchEnd);
  }

  fs.writeFileSync(file, text);
  changed++;
}

console.log(`Heart social meta materialized in ${changed} Astro entries.`);
