#!/usr/bin/env node
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

const legacy = read('biografii/index.html');
const page = read('src/pages/biografii/index.astro');
const main = read('src/components/biografii/BiografiiMain.astro');
const recent = read('src/components/biografii/BiografiiRecentSection.astro');

mustNot(page, "loadLegacyFullDocument", "Astro /biografii/ MUST NOT use loadLegacyFullDocument");
must(page, 'BiografiiPageChrome', 'Astro /biografii/ uses BiografiiPageChrome component');
must(page, 'BiografiiMain', 'Astro /biografii/ uses extracted BiografiiMain component');
must(page, 'BiografiiPageFooter', 'Astro /biografii/ uses BiografiiPageFooter component');

mustExist('src/components/biografii/BiografiiMain.astro', 'BiografiiMain.astro component file');
mustExist('src/components/biografii/BiografiiPageChrome.astro', 'BiografiiPageChrome.astro component file');
mustExist('src/components/biografii/BiografiiPageFooter.astro', 'BiografiiPageFooter.astro component file');

const sectionFiles = [
  'BiografiiRecentSection.astro','BiografiiFocusSection.astro','BiografiiEraStubSection.astro',
  'BiografiiAwakeningSection.astro','BiografiiEpigraphSection.astro','BiografiiArticleEndBlock.astro'
];
for (const rel of sectionFiles) {
  const component = `src/components/biografii/${rel}`;
  mustExist(component, rel);
  if (exists(component)) mustNot(read(component), 'h-reveal', `${rel} cannot delegate SSR visibility to reveal runtime`);
}

must(main, '<main id="main-content">', 'BiografiiMain preserves semantic main wrapper');
must(legacy, 'Последние добавленные материалы', 'legacy evidence retains the biography shelf reference');
must(recent, 'aria-labelledby="biografiiRecentTitle"', 'recent biography shelf is labelled by its semantic heading');
must(recent, '<h2 id="biografiiRecentTitle"', 'recent biography shelf exposes an H2 owner');
mustNot(recent, 'aria-label="Последние добавленные материалы"', 'duplicate recent biography shelf aria-label');
const recentCardHeadings = (recent.match(/<h3 class="h-article-title">/g) || []).length;
recentCardHeadings === 6
  ? ok('recent biography shelf keeps six H3 card titles')
  : bad(`recent biography shelf must keep six H3 card titles, found ${recentCardHeadings}`);

console.log('\nBIOGRAFII VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s).`);
  process.exit(1);
}
ok('/biografii/ Astro migration is 100% native, SSR-visible, and heading hierarchy is guarded');
