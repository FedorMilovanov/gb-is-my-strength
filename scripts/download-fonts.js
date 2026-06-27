#!/usr/bin/env node
/**
 * download-fonts.js — скачивает все .woff2 с Google Fonts CDN в /fonts/.
 * Запуск: npm run fonts:download
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT, 'fonts');

const SPECS = [
  ['Lora', 400, 'normal',  'cyrillic', 'Lora/lora-cyrillic-400'],
  ['Noto Serif Hebrew', 400, 'normal', 'hebrew', 'NotoSerifHebrew/notoserifhebrew-400'],
  ['Noto Serif Hebrew', 500, 'normal', 'hebrew', 'NotoSerifHebrew/notoserifhebrew-500'],
  ['Lora', 500, 'normal',  'cyrillic', 'Lora/lora-cyrillic-500'],
  ['Lora', 600, 'normal',  'cyrillic', 'Lora/lora-cyrillic-600'],
  ['Lora', 400, 'italic',  'cyrillic', 'Lora/lora-cyrillic-400i'],
  ['Lora', 500, 'italic',  'cyrillic', 'Lora/lora-cyrillic-500i'],
  ['Lora', 400, 'normal',  'latin',    'Lora/lora-latin-400'],
  ['Lora', 400, 'italic',  'latin',    'Lora/lora-latin-400i'],
  ['Lora', 600, 'normal',  'latin',    'Lora/lora-latin-600'],
  ['Source Sans 3', 400, 'normal', 'cyrillic', 'SourceSans3/sourcesans3-cyrillic-400'],
  ['Source Sans 3', 500, 'normal', 'cyrillic', 'SourceSans3/sourcesans3-cyrillic-500'],
  ['Source Sans 3', 600, 'normal', 'cyrillic', 'SourceSans3/sourcesans3-cyrillic-600'],
  ['Source Sans 3', 400, 'normal', 'latin',    'SourceSans3/sourcesans3-latin-400'],
  ['Playfair Display', 400, 'normal', 'cyrillic', 'PlayfairDisplay/playfairdisplay-cyrillic-400'],
  ['Playfair Display', 600, 'normal', 'cyrillic', 'PlayfairDisplay/playfairdisplay-cyrillic-600'],
  ['Playfair Display', 700, 'normal', 'cyrillic', 'PlayfairDisplay/playfairdisplay-cyrillic-700'],
  ['Playfair Display', 400, 'italic', 'cyrillic', 'PlayfairDisplay/playfairdisplay-cyrillic-400i'],
  ['Cormorant Garamond', 400, 'normal', 'cyrillic', 'CormorantGaramond/cormorantgaramond-cyrillic-400'],
  ['Cormorant Garamond', 500, 'normal', 'cyrillic', 'CormorantGaramond/cormorantgaramond-cyrillic-500'],
  ['Cormorant Garamond', 400, 'italic', 'cyrillic', 'CormorantGaramond/cormorantgaramond-cyrillic-400i'],
  ['Inter', 300, 'normal', 'cyrillic', 'Inter/inter-cyrillic-300'],
  ['Inter', 400, 'normal', 'cyrillic', 'Inter/inter-cyrillic-400'],
  ['Inter', 500, 'normal', 'cyrillic', 'Inter/inter-cyrillic-500'],
  ['Inter', 600, 'normal', 'cyrillic', 'Inter/inter-cyrillic-600'],
  ['Noto Sans Hebrew', 400, 'normal', 'hebrew', 'NotoSansHebrew/notosanshebrew-400'],
  ['Noto Sans',        400, 'normal', 'greek',  'NotoSansGreek/notosansgreek-400']
];

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0', ...headers } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) return resolve(get(res.headers.location, headers));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function fetchFamily(family, weight, style) {
  const styleQ = style === 'italic' ? `1,${weight}` : `0,${weight}`;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${styleQ}&display=swap`;
  const r = await get(url);
  return r.body.toString('utf8');
}

function pickWoff2(css, subset) {
  const segs = css.split(/\/\*\s*([\w\-]+)\s*\*\//);
  for (let i = 1; i < segs.length; i += 2) {
    if (segs[i].trim() === subset) {
      const m = (segs[i + 1] || '').match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
      if (m) return m[1];
    }
  }
  return null;
}

async function main() {
  for (const [family, weight, style, subset, dest] of SPECS) {
    const out = path.join(FONTS_DIR, `${dest}.woff2`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (fs.existsSync(out)) { console.log('  skip exists:', dest); continue; }
    try {
      const css = await fetchFamily(family, weight, style);
      const url = pickWoff2(css, subset);
      if (!url) { console.log('  ⚠ subset not found:', family, weight, style, subset); continue; }
      const r = await get(url);
      fs.writeFileSync(out, r.body);
      console.log('  ✓', dest, '(' + r.body.length + ' bytes)');
    } catch (e) { console.log('  ✗', dest, e.message); }
  }
  console.log('Готово.');
}
main().catch(e => { console.error(e); process.exit(1); });
