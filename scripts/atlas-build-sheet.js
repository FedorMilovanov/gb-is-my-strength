#!/usr/bin/env node
/**
 * atlas-build-sheet.js — тонкая CLI-обёртка над scripts/lib/sheet-engine.js.
 *
 * ЗАКОН РЕФЕРЕНСОВ (§13-бис контракта): витринные листы — светлые, по референсам
 * владельца; весь рендер живёт ТОЛЬКО в sheet-engine (карта = данные, не код);
 * работаем над одной картой до «ДА» владельца.
 *
 * Запуск: node scripts/atlas-build-sheet.js [slug ...]   (по умолчанию — все)
 * Выход:  audit/atlas-preview/sheet-<slug>.html
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildSheetHtml } = require('./lib/sheet-engine');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(ROOT, 'audit', 'atlas-preview');
const MED = new Set(['pavel', 'revelation']);

const args = process.argv.slice(2);
const slugs = args.length ? args :
  fs.readdirSync(path.join(ROOT, 'karty')).filter(d => !d.startsWith('_') && fs.existsSync(path.join(ROOT, 'karty', d, 'route.json'))).sort();

for (const slug of slugs) {
  try {
    const route = JSON.parse(fs.readFileSync(path.join(ROOT, 'karty', slug, 'route.json'), 'utf8'));
    const family = MED.has(slug) ? 'mediterranean' : 'levant';
    const baseSvg = fs.readFileSync(family === 'levant'
      ? path.join(ROOT, 'karty', '_engine', 'base-geo.svg')
      : path.join(ROOT, 'data', 'atlas', 'base', 'base-geo-mediterranean.svg'), 'utf8');
    const html = buildSheetHtml(route, { family, baseSvg, slug });
    fs.writeFileSync(path.join(OUTDIR, `sheet-${slug}.html`), html);
    console.log(`[sheet] ${slug}: ${route.places.length} мест → sheet-${slug}.html`);
  } catch (e) {
    console.error(`[sheet] ${slug} FAILED: ${e.message}`);
  }
}
