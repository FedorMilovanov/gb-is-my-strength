#!/usr/bin/env node
/*
 * Guard /about/ near-100% Astro visual parity.
 *
 * РЕФАКТОРИНГ 5.0 Phase 6 (AGENTS-r249): /about/ is now a native-shadow pilot
 * — head still comes from loadLegacyFullDocument so SEO/JSON-LD/Metrika stay
 * byte-identical, body chrome stays verbatim through small frame fragments,
 * and two semantic blocks (article.about-page, aside.gb-accuracy-block) are
 * promoted to named Astro components. The audit must therefore:
 *   1. ensure the head is still preserved verbatim;
 *   2. ensure the body is composed from frame fragments + components, not
 *      regenerated via BaseLayout / shadow-wrap or generic Astro stubs;
 *   3. ensure the legacy artifact still carries the premium markers used by
 *      visual:parity:production.
 *
 * Pixel-level proof lives in:
 *   npm run visual:parity:screenshots -- --routes /about/ --threshold 0.5
 *   data/visual-parity-baseline.json /about/ entries
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label){ haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`); }
function mustNot(haystack, needle, label){ !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`); }
function mustExist(rel, label){ exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`); }

const legacy = read('about/index.html');
const astro = read('src/pages/about/index.astro');
const owner = read('docs/OWNER-REQUIREMENTS.md');
const agents = read('AGENTS.md');

// Legacy about/index.html is now only a historical baseline: the live /about/
// is Astro-rendered and has been intentionally redesigned beyond legacy parity
// (about-resources premium icon grid). Check legacy for the markers it still
// carries; check dist for the new design markers.
for (const marker of ['about-page', 'about-contact-card', 'gb-accuracy-block', 'Фёдор Милованов']) {
  must(legacy, marker, `legacy /about/ marker: ${marker}`);
}

// Native-shadow contract for the Astro entrypoint.
must(astro, "loadLegacyFullDocument('about/index.html')", 'Astro /about/ uses shared full-document loader for head');
must(astro, '<!DOCTYPE html>', 'Astro /about/ emits full document');
must(astro, '<Fragment set:html={headHtml}', 'Astro /about/ preserves exact legacy head inner HTML');
must(astro, "AboutArticle", 'Astro /about/ uses extracted AboutArticle component');
must(astro, "AboutAccuracyBlock", 'Astro /about/ uses extracted AboutAccuracyBlock component');
must(astro, "AboutFrameBefore", 'Astro /about/ uses extracted AboutFrameBefore component');
must(astro, "AboutFrameAfter", 'Astro /about/ uses extracted AboutFrameAfter component');
must(read('src/utils/legacyFullDocument.ts'), 'loadLegacyFullDocument', 'shared full-document loader exists');

mustExist('src/components/about/AboutArticle.astro', 'AboutArticle.astro component file');
mustExist('src/components/about/AboutAccuracyBlock.astro', 'AboutAccuracyBlock.astro component file');
mustExist('src/components/about/AboutFrameBefore.astro', 'AboutFrameBefore.astro component file');
mustExist('src/components/about/AboutFrameAfter.astro', 'AboutFrameAfter.astro component file');
mustExist('src/components/about/_legacy/article.html', 'about article.html legacy fragment');
mustExist('src/components/about/_legacy/accuracy-block.html', 'about accuracy-block.html legacy fragment');
mustExist('src/components/about/_legacy/body-before.html', 'about body-before.html legacy baseline fragment');
mustExist('src/components/about/_legacy/body-after.html', 'about body-after.html legacy baseline fragment');

// Forbid the old generic astro-about-shadow regression class and forbid the
// BaseLayout/Header/Footer global chrome that the legacy /about/ does not use.
for (const marker of [
  'import BaseLayout', '<BaseLayout', 'astro-about-shadow', 'astro-shell',
  'class="astro-about"', 'astro-contact-grid', 'astro-accuracy-block',
  '_legacy/body-before.html?raw', '_legacy/body-after.html?raw', '_legacy/body-mid.html?raw',
]) {
  mustNot(astro, marker, `old/generic about wrapper marker: ${marker}`);
}

const frameBefore = read('src/components/about/AboutFrameBefore.astro');
for (const marker of ['skip-link', 'themeToggle', 'breadcrumb__current', '<main id="main-content">']) {
  must(frameBefore, marker, `AboutFrameBefore marker: ${marker}`);
}
const frameAfter = read('src/components/about/AboutFrameAfter.astro');
for (const marker of ['article-end-block', '<footer>', 'site-utils.js', 'search.js']) {
  must(frameAfter, marker, `AboutFrameAfter marker: ${marker}`);
}

// Dist must still carry the premium DOM markers (visual:parity:production
// already enforces this for /about/, but keep the assertion here as a fast
// local check during component edits).
const distAbout = exists('dist/about/index.html') ? read('dist/about/index.html') : '';
if (distAbout) {
  for (const marker of ['about-page', 'about-resources', 'about-contact-card', 'gb-accuracy-block', 'Фёдор Милованов']) {
    must(distAbout, marker, `dist /about/ marker: ${marker}`);
  }
  mustNot(distAbout, 'astro-card-grid', 'dist /about/ generic regression marker absent');
  mustNot(distAbout, 'astro-about-shadow', 'dist /about/ old shadow wrapper class absent');
}

must(owner, '95%+ визуального совпадения', 'owner visual parity doctrine');
must(agents, 'Astro migration — premium visual parity only', 'AGENTS premium Astro doctrine');
must(agents, '`/about/` — first visual-first Astro migration route', 'AGENTS about route doctrine');

console.log('\nABOUT VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /about/ is not ready for 100% visual parity work.`);
  process.exit(1);
}
ok('/about/ Astro migration is visual-parity guarded (Phase 6 native-shadow)');
