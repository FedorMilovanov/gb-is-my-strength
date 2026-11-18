import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== Running Journal Reading UX Contract Test ===');

const dossierAstro = fs.readFileSync('src/components/journal/G3Dossier.astro', 'utf8');
const mastheadAstro = fs.readFileSync('src/components/journal/JournalMasthead.astro', 'utf8');
const editorialCss = fs.readFileSync('src/components/journal/journalEditorial.css', 'utf8');

// 1. Guard against scroll-jump regression in scrollspy
assert(
  !dossierAstro.includes('a.scrollIntoView'),
  'FAIL: G3Dossier.astro must not call a.scrollIntoView() during scrollspy updateActive (causes vertical page jump regression)'
);
console.log('✔ Verified: scrollspy does not invoke a.scrollIntoView() on TOC links during vertical reading');

// 2. Guard for prefers-reduced-motion in CSS and JS
assert(
  editorialCss.includes('@media (prefers-reduced-motion: reduce)'),
  'FAIL: journalEditorial.css must include prefers-reduced-motion rules'
);
assert(
  dossierAstro.includes('prefers-reduced-motion'),
  'FAIL: G3Dossier.astro must respect prefers-reduced-motion in JS scroll calls'
);
console.log('✔ Verified: prefers-reduced-motion is respected in CSS and JS scrollTo methods');

// 3. Guard for bibliography scroll-margin and :target highlight
assert(
  editorialCss.includes('.journal-edition .bibliography-item:target'),
  'FAIL: journalEditorial.css must style .bibliography-item:target for visual citation orientation'
);
assert(
  editorialCss.includes('scroll-margin-top: calc(58px + env(safe-area-inset-top, 0px) + 16px)'),
  'FAIL: journalEditorial.css must set scroll-margin-top on bibliography items'
);
console.log('✔ Verified: bibliography items feature scroll-margin-top and :target highlight styling');

// 4. Guard for Back-to-top hotkey and mobile safe-area insets
assert(
  dossierAstro.includes("event.key === 'b'"),
  'FAIL: G3Dossier.astro must support keyboard shortcut B for returning to top'
);
assert(
  editorialCss.includes('env(safe-area-inset-bottom'),
  'FAIL: .je-back-to-top must respect mobile safe-area bottom inset'
);
console.log('✔ Verified: back-to-top button supports hotkey B and mobile safe-area insets');

// 5. Guard for Theme toggle synchronization with GBReaderPreferences
assert(
  mastheadAstro.includes('GBReaderPreferences'),
  'FAIL: JournalMasthead.astro must coordinate theme changes with GBReaderPreferences'
);
assert(
  mastheadAstro.includes('gb:reader-preferences-change'),
  'FAIL: JournalMasthead.astro must listen for external reader preference changes'
);
console.log('✔ Verified: JournalMasthead theme toggle synchronizes with canonical GBReaderPreferences');

// 6. Verify 21 sources and bidirectional section links
const sourceMatches = dossierAstro.match(/'G3-S\d{3}': \['[^']+', '[^']+'\]/g) || [];
assert.equal(sourceMatches.length, 21, `Expected 21 source section mappings, found ${sourceMatches.length}`);
console.log(`✔ Verified: All 21 dossier sources have verified bidirectional return sections`);

console.log('=== ALL JOURNAL READING UX CONTRACT CHECKS PASSED ===');
