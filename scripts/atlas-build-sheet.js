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
const FAMILY = (slug) => MED.has(slug) ? 'mediterranean' : slug === 'nachalo' ? 'urheimat' : 'levant';
const BASE_FILE = { levant: ['karty', '_engine', 'base-geo.svg'],
  mediterranean: ['data', 'atlas', 'base', 'base-geo-mediterranean.svg'],
  urheimat: ['data', 'atlas', 'base', 'base-geo-urheimat.svg'] };

const ORDER = ['nachalo','avraam','ishod','shvatim','shoftim','melachim','yeshua','early-church','pavel','revelation','maccabim'];
const TITLES = {};
for (const s2 of ORDER) {
  try { TITLES[s2] = (JSON.parse(fs.readFileSync(path.join(ROOT, 'karty', s2, 'route.json'), 'utf8')).meta || {}).title || s2; } catch (_) { TITLES[s2] = s2; }
}
const args = process.argv.slice(2);
const slugs = args.length ? args :
  fs.readdirSync(path.join(ROOT, 'karty')).filter(d => !d.startsWith('_') && fs.existsSync(path.join(ROOT, 'karty', d, 'route.json'))).sort();

for (const slug of slugs) {
  try {
    const route = JSON.parse(fs.readFileSync(path.join(ROOT, 'karty', slug, 'route.json'), 'utf8'));
    const family = FAMILY(slug);
    const baseSvg = fs.readFileSync(path.join(ROOT, ...BASE_FILE[family]), 'utf8');
    const spine = ORDER.map(s2 => ({
      slug: s2, title: TITLES[s2], current: s2 === slug,
      cover: fs.existsSync(path.join(ROOT, 'images', `atlas-${s2}-scene-600w.webp`)) ? `../../images/atlas-${s2}-scene-600w.webp` : null,
    }));
    const html = buildSheetHtml(route, { family, baseSvg, slug, sheetNo: (route.meta || {}).sheet_no, spine });
    fs.writeFileSync(path.join(OUTDIR, `sheet-${slug}.html`), html);
    console.log(`[sheet] ${slug}: ${route.places.length} мест → sheet-${slug}.html`);
  } catch (e) {
    console.error(`[sheet] ${slug} FAILED: ${e.message}`);
  }
}
