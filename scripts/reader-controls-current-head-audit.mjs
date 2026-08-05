#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const FILES = {
  readerRuntime: 'src/components/reader-platform/ReaderActionsRuntime.astro',
  readerTts: 'src/runtime/reader-tts.js',
  readerActions: 'src/runtime/reader-actions.js',
  printGeometry: 'src/runtime/print-pagination-geometry.js',
  legacyController: 'js/floating-cluster-controller.js',
  speedSlot: 'src/components/article-pilots/_shared/speedSlot.ts',
  hermBar: 'src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro',
  gillBar: 'src/components/article-pilots/gill-series/GillSeriesMobileBar.astro',
  playEmber: 'src/components/ui/floating-cluster/PlayEmber.astro',
  saveButton: 'src/components/ui/floating-cluster/SaveButton.astro',
  hermHead: 'src/components/article-pilots/hermenevtika/HermenevtikaPageHead.astro',
  hermBody: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
};

const text = {};
for (const [key, relative] of Object.entries(FILES)) {
  const absolute = path.join(ROOT, relative);
  assert.ok(fs.existsSync(absolute), `required audit owner is missing: ${relative}`);
  text[key] = fs.readFileSync(absolute, 'utf8');
}

const checks = [];
function check(id, area, description, pass, evidence, severity = 'P2') {
  checks.push({ id, area, description, pass: Boolean(pass), evidence: String(evidence || ''), severity });
}
function has(owner, pattern) {
  return typeof pattern === 'string' ? owner.includes(pattern) : pattern.test(owner);
}
function count(owner, pattern) {
  return (owner.match(pattern) || []).length;
}

// A. Authority and owner topology.
check('RC-AUTH-01', 'authority', 'ReaderActionsRuntime is the native reader action owner', has(text.readerRuntime, 'ReaderActionsRuntime'), FILES.readerRuntime);
check('RC-AUTH-02', 'authority', 'ReaderActionsRuntime loads canonical reader-tts.js', has(text.readerRuntime, "import '../../runtime/reader-tts.js'"), 'reader-tts import');
check('RC-AUTH-03', 'authority', 'ReaderActionsRuntime loads print geometry', has(text.readerRuntime, 'print-pagination-geometry.js'), 'print geometry import');
check('RC-AUTH-04', 'authority', 'ReaderActionsRuntime loads reader-actions.js', has(text.readerRuntime, 'reader-actions.js'), 'reader actions import');
check('RC-AUTH-05', 'authority', 'Canonical TTS exposes a versioned GBReaderTTS API', has(text.readerTts, 'window.GBReaderTTS = Object.freeze'), 'GBReaderTTS API');
check('RC-AUTH-06', 'authority', 'Canonical reader actions expose a versioned GBReaderActions API', has(text.readerActions, 'window.GBReaderActions = Object.freeze'), 'GBReaderActions API');
check('RC-AUTH-07', 'authority', 'Hermenevtika mobile bar loads ReaderActionsRuntime', has(text.hermBar, '<ReaderActionsRuntime />'), 'Hermenevtika runtime owner');
check('RC-AUTH-08', 'authority', 'Legacy controller is still shipped as a separate global owner', has(text.legacyController, 'GB Floating Cluster'), FILES.legacyController, 'P1');

// B. TTS single-owner and lifecycle boundary.
check('RC-TTS-01', 'tts-owner', 'Canonical TTS claims play clicks in capture phase', has(text.readerTts, "document.addEventListener('click', onClick, true)"), 'capture click listener');
check('RC-TTS-02', 'tts-owner', 'Canonical TTS stops on pagehide', has(text.readerTts, "window.addEventListener('pagehide'"), 'pagehide cleanup');
check('RC-TTS-03', 'tts-owner', 'Canonical TTS stops on beforeunload', has(text.readerTts, "window.addEventListener('beforeunload'"), 'beforeunload cleanup');
check('RC-TTS-04', 'tts-owner', 'Canonical TTS has explicit phase state', has(text.readerTts, "phase: 'idle'"), 'phase state');
check('RC-TTS-05', 'tts-owner', 'Canonical TTS has operation-token invalidation', has(text.readerTts, 'state.token'), 'operation token');
check('RC-TTS-06', 'tts-owner', 'Legacy controller no longer contains a second TTS state machine', !has(text.legacyController, 'var ttsState = {'), 'legacy ttsState must be absent', 'P1');
check('RC-TTS-07', 'tts-owner', 'Legacy controller no longer owns article speech collection', !has(text.legacyController, 'function collectArticleBlocks()'), 'legacy collectArticleBlocks must be absent', 'P1');
check('RC-TTS-08', 'tts-owner', 'Legacy controller no longer resolves a speech engine', !has(text.legacyController, 'function resolveTtsEngine()'), 'legacy resolveTtsEngine must be absent', 'P1');
check('RC-TTS-09', 'tts-owner', 'Legacy controller no longer owns speech rate events', count(text.legacyController, /gb:tts-rate-change/g) <= 2, `legacy rate event references=${count(text.legacyController, /gb:tts-rate-change/g)}`, 'P2');
check('RC-TTS-10', 'tts-owner', 'Canonical owner is explicitly documented before legacy controller execution', has(text.readerRuntime, 'capture-phase owner prevents double handling'), 'owner comment');

// C. ReaderProjection policy source.
check('RC-PROJ-01', 'projection', 'A shared ReaderProjection implementation exists', /ReaderProjection/.test(text.readerTts + text.readerActions + text.readerRuntime), 'ReaderProjection symbol', 'P1');
check('RC-PROJ-02', 'projection', 'TTS consumes data-reader-include', has(text.readerTts, 'data-reader-include'), 'reader include marker', 'P1');
check('RC-PROJ-03', 'projection', 'TTS consumes data-reader-exclude', has(text.readerTts, 'data-reader-exclude'), 'reader exclude marker', 'P1');
check('RC-PROJ-04', 'projection', 'TTS consumes data-reader-section', has(text.readerTts, 'data-reader-section'), 'reader section marker', 'P2');
check('RC-PROJ-05', 'projection', 'TTS consumes data-reader-summary', has(text.readerTts, 'data-reader-summary'), 'reader summary marker', 'P1');
check('RC-PROJ-06', 'projection', 'TTS consumes data-reader-note-policy', has(text.readerTts, 'data-reader-note-policy'), 'note policy marker', 'P2');
check('RC-PROJ-07', 'projection', 'TTS consumes data-search-policy', has(text.readerTts, 'data-search-policy'), 'search policy marker', 'P1');
check('RC-PROJ-08', 'projection', 'TTS consumes data-speakable-policy', has(text.readerTts, 'data-speakable-policy'), 'speakable policy marker', 'P1');
check('RC-PROJ-09', 'projection', 'Projection exposes a reusable segment API', /getSegments|buildSegments|projectReader|readerProjection/i.test(text.readerTts), 'projection API', 'P1');
check('RC-PROJ-10', 'projection', 'Projection exposes a current-section API', /currentSection|sectionLabel|sectionId/.test(text.readerTts), 'section API', 'P2');
check('RC-PROJ-11', 'projection', 'Canonical TTS uses explicit block inventory', has(text.readerTts, "querySelectorAll('h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd')"), 'hard-coded block inventory');
check('RC-PROJ-12', 'projection', 'Canonical TTS excludes pagefind-ignore content', has(text.readerTts, '[data-pagefind-ignore]'), 'Pagefind exclusion');
check('RC-PROJ-13', 'projection', 'Canonical TTS excludes footnotes by class', has(text.readerTts, '.footnote'), 'footnote exclusion');
check('RC-PROJ-14', 'projection', 'Canonical TTS excludes sources blocks', has(text.readerTts, '.sources-block'), 'sources exclusion');
check('RC-PROJ-15', 'projection', 'Canonical TTS strips controls and SVG inline', /'button'.*'svg'/.test(text.readerTts.replace(/\n/g, ' ')), 'inline strip inventory');
check('RC-PROJ-16', 'projection', 'Canonical TTS avoids nested li paragraph duplication', has(text.readerTts, "element.matches('li') && element.querySelector(':scope > p"), 'nested li guard');

// D. Speakable/summary/search/print convergence.
check('RC-SPEAK-01', 'speakable', 'Hermenevtika publishes SpeakableSpecification', has(text.hermHead, 'SpeakableSpecification'), 'JSON-LD speakable');
check('RC-SPEAK-02', 'speakable', 'Speakable includes h1', has(text.hermHead, '"h1"'), 'h1 selector');
check('RC-SPEAK-03', 'speakable', 'Speakable includes article lead', has(text.hermHead, '.article-lead'), 'lead selector');
check('RC-SPEAK-04', 'speakable', 'Speakable includes summary card', has(text.hermHead, '.summary-card'), 'summary selector');
check('RC-SPEAK-05', 'speakable', 'Speakable includes explicit data-speakable nodes', has(text.hermHead, '[data-speakable]'), 'data-speakable selector');
check('RC-SPEAK-06', 'speakable', 'TTS imports the same speakable selector source', has(text.readerTts, 'SpeakableSpecification') || has(text.readerTts, '[data-speakable]'), 'shared speakable source', 'P1');
check('RC-SPEAK-07', 'speakable', 'TTS summary inclusion is explicit rather than incidental', has(text.readerTts, 'summary-card') || has(text.readerTts, 'data-reader-summary'), 'summary policy', 'P1');
check('RC-SPEAK-08', 'speakable', 'Search boundaries use the same projection policy', has(text.readerTts + text.readerActions, 'data-search-policy'), 'search projection source', 'P1');
check('RC-SPEAK-09', 'speakable', 'Print order uses the same projection policy', has(text.printGeometry, 'ReaderProjection') || has(text.printGeometry, 'data-reader-'), 'print projection source', 'P2');
check('RC-SPEAK-10', 'speakable', 'Hermenevtika body contains an explicit projection marker', /data-reader-|data-speakable/.test(text.hermBody), 'body projection markers', 'P2');

// E. Hermenevtika speed/search exposure.
check('RC-HSLOT-01', 'herm-speed-slot', 'Hermenevtika speed choices form a radiogroup', has(text.hermBar, 'role="radiogroup"'), 'radiogroup markup');
check('RC-HSLOT-02', 'herm-speed-slot', 'Hermenevtika speed choices use role=radio', count(text.hermBar, /role="radio"/g) >= 5, `radio count=${count(text.hermBar, /role="radio"/g)}`);
check('RC-HSLOT-03', 'herm-speed-slot', 'Inactive Hermenevtika speed rail has aria-hidden', /hm-speedrail[^>]*aria-hidden=/.test(text.hermBar), 'aria-hidden on speed rail', 'P1');
check('RC-HSLOT-04', 'herm-speed-slot', 'Inactive Hermenevtika speed rail is hidden/inert by runtime', /setAttribute\(['"]aria-hidden|\.inert\s*=|setAttribute\(['"]inert/.test(text.speedSlot), 'speedSlot hidden/inert mutation', 'P1');
check('RC-HSLOT-05', 'herm-speed-slot', 'Inactive Hermenevtika search layer is hidden/inert by runtime', /searchInput.*(?:hidden|inert|aria-hidden)/s.test(text.speedSlot), 'search exposure mutation', 'P1');
check('RC-HSLOT-06', 'herm-speed-slot', 'Only one speed radio is tabbable', /tabIndex|tabindex/.test(text.speedSlot), 'roving tabindex implementation', 'P1');
check('RC-HSLOT-07', 'herm-speed-slot', 'ArrowLeft/ArrowRight move radiogroup focus', /ArrowLeft|ArrowRight/.test(text.speedSlot), 'arrow keyboard model', 'P1');
check('RC-HSLOT-08', 'herm-speed-slot', 'Home/End move to radiogroup boundaries', /Home/.test(text.speedSlot) && /End/.test(text.speedSlot), 'Home/End keyboard model', 'P2');
check('RC-HSLOT-09', 'herm-speed-slot', 'Enter/Space activate focused speed', /keydown/.test(text.speedSlot) && /Enter|\s['"] ['"]/.test(text.speedSlot), 'activation keyboard model', 'P1');
check('RC-HSLOT-10', 'herm-speed-slot', 'Auto-close restores focus out of hidden rail', /focus\(\)/.test(text.speedSlot), 'focus restoration', 'P1');
check('RC-HSLOT-11', 'herm-speed-slot', 'Badge exposes aria-controls for the speed rail', /hm-spdbadge[^>]*aria-controls=/.test(text.hermBar), 'badge aria-controls', 'P2');
check('RC-HSLOT-12', 'herm-speed-slot', 'Badge exposes synchronized aria-expanded', /hmSpdBadge[\s\S]{0,300}aria-expanded|aria-expanded[\s\S]{0,300}hmSpdBadge/.test(text.hermBar), 'badge aria-expanded', 'P2');

// F. Gill speed/search exposure.
check('RC-GSLOT-01', 'gill-speed-slot', 'Gill inline speed rail starts aria-hidden', /mobile-speedrail[^>]*aria-hidden="true"/.test(text.gillBar), 'initial aria-hidden');
check('RC-GSLOT-02', 'gill-speed-slot', 'Gill runtime toggles rail aria-hidden', /rail\.setAttribute\(['"]aria-hidden/.test(text.legacyController), 'aria-hidden mutation');
check('RC-GSLOT-03', 'gill-speed-slot', 'Gill inactive radios are removed from Tab order', /btn\.tabIndex\s*=\s*open\s*\?\s*0\s*:\s*-1/.test(text.legacyController), 'inactive tab-order removal');
check('RC-GSLOT-04', 'gill-speed-slot', 'Gill open radiogroup uses one roving tab stop', /speedButtons\.forEach[^;]+tabIndex\s*=\s*open\s*\?\s*0/s.test(text.legacyController) === false, 'all radios must not become tabindex=0', 'P1');
check('RC-GSLOT-05', 'gill-speed-slot', 'Gill radiogroup supports ArrowLeft/ArrowRight', /initGillInlineSpeedRail[\s\S]*ArrowLeft|initGillInlineSpeedRail[\s\S]*ArrowRight/.test(text.legacyController), 'Gill arrow model', 'P1');
check('RC-GSLOT-06', 'gill-speed-slot', 'Gill radiogroup supports Home/End', /initGillInlineSpeedRail[\s\S]*Home[\s\S]*End/.test(text.legacyController), 'Gill Home/End model', 'P2');
check('RC-GSLOT-07', 'gill-speed-slot', 'Gill badge exposes aria-controls', /mobile-spdbadge[^>]*aria-controls=/.test(text.gillBar), 'Gill badge aria-controls', 'P2');
check('RC-GSLOT-08', 'gill-speed-slot', 'Gill badge exposes aria-expanded', /mobile-spdbadge[^>]*aria-expanded=/.test(text.gillBar), 'Gill badge aria-expanded', 'P2');

// G. Popup semantics.
check('RC-POP-01', 'popup-semantics', 'PlayEmber does not unconditionally claim aria-haspopup', !has(text.playEmber, 'aria-haspopup="true"'), 'unconditional popup claim', 'P1');
check('RC-POP-02', 'popup-semantics', 'PlayEmber accepts a popup-mode prop', /popup|hasPopup|speedMode/.test(text.playEmber), 'popup-mode prop', 'P2');
check('RC-POP-03', 'popup-semantics', 'PlayEmber accepts aria-controls for a real popup', /ariaControls|aria-controls=\{/.test(text.playEmber), 'popup ownership prop', 'P2');
check('RC-POP-04', 'popup-semantics', 'PlayEmber expanded state is synchronized by an owner', /setAttribute\(['"]aria-expanded/.test(text.speedSlot + text.legacyController), 'expanded-state mutation');

// H. Save metadata and store.
check('RC-SAVE-01', 'save-store', 'SaveButton uses a common data-fc save action', has(text.saveButton, 'data-fc-action="save"'), 'save action');
check('RC-SAVE-02', 'save-store', 'SaveButton exposes aria-pressed', has(text.saveButton, 'aria-pressed'), 'save state semantics');
check('RC-SAVE-03', 'save-store', 'Legacy controller no longer owns gb-favorites storage', !has(text.legacyController, "var FAV_KEY = 'gb-favorites'"), 'legacy favorite store must be replaced', 'P1');
check('RC-SAVE-04', 'save-store', 'Favorite metadata comes from canonical route metadata', /SITE_CONFIG|routeMetadata|metadataRegistry/.test((text.legacyController.match(/function getPageMeta\(\)[\s\S]*?\n  }/) || [''])[0]), 'canonical metadata source', 'P1');
check('RC-SAVE-05', 'save-store', 'Favorite metadata does not scrape breadcrumb presentation', !has(text.legacyController, ".breadcrumb__link:last-of-type"), 'breadcrumb must not be database API', 'P1');
check('RC-SAVE-06', 'save-store', 'Favorite metadata does not scrape OG tags as primary store data', !/function getPageMeta\([\s\S]*meta\[property="og:/.test(text.legacyController), 'OG scraping must not be primary metadata', 'P2');
check('RC-SAVE-07', 'save-store', 'A versioned canonical favorites API is exposed', /GBFavorites|GBFavoriteStore|FavoriteStore/.test(text.legacyController + text.readerActions), 'favorite store API', 'P1');
check('RC-SAVE-08', 'save-store', 'All save consumers synchronize aria-label as well as aria-pressed', /setSaved[\s\S]*aria-label/.test(text.legacyController), 'label synchronization', 'P2');
check('RC-SAVE-09', 'save-store', 'Store mutations broadcast a synchronization event', /favorite.*CustomEvent|CustomEvent.*favorite/i.test(text.legacyController), 'favorite change event', 'P2');
check('RC-SAVE-10', 'save-store', 'Favorite payload has an explicit schema/version', /schemaVersion|version.*favorite/i.test(text.legacyController), 'payload version', 'P2');
check('RC-SAVE-11', 'save-store', 'Favorite state normalizes route paths', has(text.legacyController, 'function normalizePath'), 'path normalization');
check('RC-SAVE-12', 'save-store', 'Favorite state initializes every save surface', /setSaved\(isFavorite/.test(text.legacyController), 'initial synchronization');

const summary = {
  auditedAt: new Date().toISOString(),
  baseExpectation: process.env.GITHUB_SHA || null,
  checkCount: checks.length,
  pass: checks.filter((item) => item.pass).length,
  findings: checks.filter((item) => !item.pass).length,
  byArea: {},
};
for (const item of checks) {
  summary.byArea[item.area] ||= { checks: 0, pass: 0, findings: 0 };
  summary.byArea[item.area].checks += 1;
  summary.byArea[item.area][item.pass ? 'pass' : 'findings'] += 1;
}

assert.ok(checks.length >= 80, `audit harness must contain at least 80 named checks, got ${checks.length}`);
assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'audit check IDs must be unique');

const report = { summary, files: FILES, checks };
fs.writeFileSync(path.join(REPORTS, 'reader-controls-current-head-audit.json'), JSON.stringify(report, null, 2));

const lines = [
  '# Reader controls current-head audit',
  '',
  `- Checks: **${summary.checkCount}**`,
  `- Pass: **${summary.pass}**`,
  `- Findings: **${summary.findings}**`,
  `- SHA: \`${summary.baseExpectation || 'local'}\``,
  '',
  '## Area summary',
  '',
  '| Area | Checks | Pass | Findings |',
  '|---|---:|---:|---:|',
  ...Object.entries(summary.byArea).map(([area, value]) => `| ${area} | ${value.checks} | ${value.pass} | ${value.findings} |`),
  '',
  '## Named checks',
  '',
  '| ID | Area | Result | Severity | Description | Evidence |',
  '|---|---|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.area} | ${item.pass ? 'PASS' : 'FINDING'} | ${item.severity} | ${item.description.replace(/\|/g, '\\|')} | ${item.evidence.replace(/\|/g, '\\|')} |`),
  '',
  '> Diagnostic policy: product findings are intentionally non-blocking in this audit-only lane. Harness integrity, missing owners and fewer than 80 named checks are blocking.',
];
fs.writeFileSync(path.join(REPORTS, 'reader-controls-current-head-audit.md'), lines.join('\n'));

for (const item of checks) {
  console.log(`[READER-CONTROLS-AUDIT] ${item.pass ? 'PASS' : 'FINDING'} ${item.id} ${item.area} :: ${item.description}`);
}
console.log('[READER-CONTROLS-AUDIT-SUMMARY]', JSON.stringify(summary));
console.log('Reader controls current-head source audit: PASS (diagnostic findings recorded, harness integrity enforced).');
