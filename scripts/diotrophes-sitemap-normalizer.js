#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'sitemap.xml');
const WRITE = process.argv.includes('--write');
const LOC = 'https://gospod-bog.ru/articles/diotrefy-nashego-vremeni/';
const ENTRY = `  <url>
    <loc>${LOC}</loc>
    <lastmod>2026-08-02T00:00:00+03:00</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.85</priority>
    <image:image><image:loc>https://gospod-bog.ru/images/pastor-series/og-20-antisovetov-pastoru.webp</image:loc></image:image>
  </url>`;

function normalize(source) {
  const locMatches = source.split(`<loc>${LOC}</loc>`).length - 1;
  if (locMatches > 1) throw new Error(`Duplicate canonical sitemap route: ${LOC}`);
  if (locMatches === 1) return { output: source, changes: 0 };
  const marker = '</urlset>';
  const markerMatches = source.split(marker).length - 1;
  if (markerMatches !== 1) throw new Error(`Expected exactly one ${marker}, found ${markerMatches}`);
  return {
    output: source.replace(marker, `\n${ENTRY}\n${marker}`),
    changes: 1,
  };
}

function main() {
  const source = fs.readFileSync(FILE, 'utf8');
  const result = normalize(source);
  console.log(`Diotrophes sitemap normalizer: ${result.changes} change(s); route=${LOC}`);
  if (WRITE && result.output !== source) {
    fs.writeFileSync(FILE, result.output);
    return;
  }
  if (!WRITE && result.output !== source) process.exitCode = 1;
}

if (require.main === module) main();
else module.exports = { normalize, LOC, ENTRY };
