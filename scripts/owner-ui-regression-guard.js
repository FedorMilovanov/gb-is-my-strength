#!/usr/bin/env node

/*
 * owner-ui-regression-guard.js — owner-facing UI contract for root production.
 *
 * This is not an SEO/content parity test. It protects the visible premium
 * legacy experience while Astro is not yet visually approved for production.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function ok(msg) { console.log('✅ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function mustContain(rel, marker, label = marker) {
  const html = read(rel);
  if (html.includes(marker)) ok(`${rel}: ${label}`);
  else bad(`${rel}: missing owner UI marker: ${label}`);
}
function mustNotContain(rel, marker, label = marker) {
  const html = read(rel);
  if (!html.includes(marker)) ok(`${rel}: no ${label}`);
  else bad(`${rel}: forbidden owner UI regression marker present: ${label}`);
}

// Home: owner rejected the extra entry strip and homepage TTS prompt.
mustContain('index.html', 'home-v20', 'legacy premium home shell');
mustContain('index.html', 'h-hero-title', 'legacy home hero');
mustNotContain('index.html', 'h-home-entry-strip', 'rejected “Основные входы” strip');
const siteJs = read('js/site.js');
if (/path===['"]\/['"]/.test(siteJs) && /home-v20/.test(siteJs) && /gbx-tts/.test(siteJs)) ok('js/site.js: TTS has homepage guard');
else bad('js/site.js: TTS homepage guard missing or not obvious');

// Production root must remain legacy/premium until Astro visual parity is approved.
for (const [rel, markers] of Object.entries({
  'articles/index.html': ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card'],
  'biografii/index.html': ['home-v20', 'h-hero-title', 'h-article-card'],
  'nagornaya/seriya/index.html': ['nagornaya-page nagornaya-series-page', 'home-v20', 'h-hero-title', 'h-article-card'],
  'articles/dzhon-gill-chast-1-chelovek/index.html': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail', 'gbs2-hero'],
  'articles/dzhon-gill-chast-2-uchenyi/index.html': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail', 'gbs2-hero'],
  'articles/dzhon-gill-chast-3-nasledie/index.html': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail', 'gbs2-hero'],
  'articles/dzhon-gill-chast-4-ekzeget/index.html': ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs-rail', 'gbs2-hero'],
})) {
  for (const marker of markers) mustContain(rel, marker);
  mustNotContain(rel, 'astro-page', 'generic Astro page shell');
  mustNotContain(rel, 'astro-card-grid', 'generic Astro card grid');
}

// Maps: unfinished maps must not be presented as finished interactive maps.
mustContain('karty/index.html', 'Путь Авраама', 'Avraam remains on map shelf');
mustContain('karty/index.html', 'Премиальная витрина карт', 'premium map shelf hero');
mustContain('karty/index.html', 'Остальные карты временно не на витрине', 'unfinished map shelf warning');
mustContain('karty/index.html', '0</b><span>черновиков на витрине', 'no unfinished demos on map shelf');

// karty/ishod/ is a LIVE map (shared map-engine.js + route.json), promoted in
// 8ff89285 (astro-ishod-pilot-audit already treats it as live, not holding).
// Verified functional 2026-06-21: renders the full Exodus route (Raamses →
// Sinai → Kadesh-Barnea → Plains of Moab), 11 waypoints / 6 stages, Hebrew
// title, 0 page errors. Assert the live-map contract instead of the old
// holding-page marker so this guard does not false-positive on a real map.
mustContain('karty/ishod/index.html', '../_engine/map-engine.js', 'ishod loads shared live map engine');
mustNotContain('karty/ishod/index.html', 'Визуальный аудит карт', 'ishod is a live map, not a holding page');
for (const slug of ['pavel','shoftim','melachim','shvatim','yeshua','maccabim','early-church','revelation']) {
  mustContain(`karty/${slug}/index.html`, 'Визуальный аудит карт', `${slug} holding page`);
  mustNotContain(`karty/${slug}/index.html`, 'id="mapRoot"', `${slug} unfinished live MapEngine root`);
}

// Russian Baptists: owner called out incomplete/ugly series presentation.
mustContain('baptisty-rossii/index.html', 'data-gbs2-series="russian-baptism"', 'Russian Baptists GBS2 series shell');
mustContain('baptisty-rossii/index.html', '10 частей · живая исследовательская серия', 'Russian Baptists complete series count');
mustContain('css/site.css', 'Russian Baptists series landing', 'Russian Baptists premium landing CSS guard');
mustContain('css/site.css', 'grid-template-columns:repeat(3,minmax(0,1fr))', 'Russian Baptists desktop compact card grid');

// Doctrine: operational AGENTS.md is intentionally concise; detailed owner
// invariants are preserved byte-for-byte in AGENTS-REFERENCE.md.
mustContain('docs/OWNER-REQUIREMENTS.md', '95%+ визуального совпадения', 'Astro 95% visual parity doctrine');
mustContain('docs/OWNER-REQUIREMENTS.md', 'H1/H2/SEO/word-count не считаются визуальным переносом', 'SEO is not visual parity doctrine');
mustContain('docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md', 'Astro — не самоцель', 'premium Astro roadmap exists');
mustContain('docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md', '95%+ визуального совпадения legacy → Astro', 'roadmap visual parity target');
mustContain('AGENTS-REFERENCE.md', 'Astro migration — premium visual parity only', 'reference visual parity doctrine');

// PremiumControls protected subsystem guard (PC-001..PC-007)
mustContain('src/components/ui/premium-controls/PremiumControlAnchor.astro', 'data-pc-anchor', 'PremiumControlAnchor component exists');
mustContain('src/components/ui/floating-cluster/RomanNumeral.astro', 'gb-roman', 'RomanNumeral component exists');
mustContain('AGENTS-REFERENCE.md', '3.10 PremiumControls / Floating Cluster', 'reference PremiumControls protected status');

console.log('\nOWNER UI REGRESSION GUARD');
if (problems.length) {
  console.log(`❌ ${problems.length} issue(s). Do not deploy.`);
  process.exit(1);
}
console.log('✅ Owner UI regression guard passed');
