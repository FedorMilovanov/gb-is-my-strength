#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const FILES = {
  projection: 'src/runtime/reader-projection.js',
  runtimeOwner: 'src/components/reader-platform/ReaderActionsRuntime.astro',
  tts: 'src/runtime/reader-tts.js',
  print: 'src/runtime/print-pagination-geometry.js',
  hermHead: 'src/components/article-pilots/hermenevtika/HermenevtikaPageHead.astro',
  hermBody: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
  controls: 'src/runtime/reader-controls-a11y.js',
};
const text = {};
for (const [key, relative] of Object.entries(FILES)) {
  const absolute = path.join(ROOT, relative);
  assert.ok(fs.existsSync(absolute), `required projection owner is missing: ${relative}`);
  text[key] = fs.readFileSync(absolute, 'utf8');
}

const checks = [];
function check(id, area, description, pass, evidence = '') {
  checks.push({ id, area, description, pass: Boolean(pass), evidence: String(evidence) });
}
function has(owner, value) {
  return typeof value === 'string' ? owner.includes(value) : value.test(owner);
}
function count(owner, value) {
  return (owner.match(value) || []).length;
}

const projectionImport = "import '../../runtime/reader-projection.js';";
const ttsImport = "import '../../runtime/reader-tts.js';";

check('RP-AUTH-01', 'authority', 'ReaderProjection is a versioned global API', has(text.projection, 'window.GBReaderProjection = Object.freeze'), 'GBReaderProjection');
check('RP-AUTH-02', 'authority', 'Projection version is explicit', has(text.projection, 'const VERSION = 1;'), 'VERSION=1');
check('RP-AUTH-03', 'authority', 'ReaderActionsRuntime imports projection', has(text.runtimeOwner, projectionImport), projectionImport);
check('RP-AUTH-04', 'authority', 'Projection loads before canonical TTS', text.runtimeOwner.indexOf(projectionImport) >= 0 && text.runtimeOwner.indexOf(projectionImport) < text.runtimeOwner.indexOf(ttsImport), 'import order');
check('RP-AUTH-05', 'authority', 'Canonical TTS owner remains present', has(text.runtimeOwner, ttsImport), ttsImport);
check('RP-AUTH-06', 'authority', 'Controls accessibility owner remains present', has(text.runtimeOwner, "import '../../runtime/reader-controls-a11y.js';"), 'controls owner');
check('RP-AUTH-07', 'authority', 'Projection does not own favorites', !/FavoriteStore|GBFavorites|gb-favorites/.test(text.projection), 'no favorites');
check('RP-AUTH-08', 'authority', 'Projection does not own speech engines', !/speechSynthesis|VoskTTSEngine|SpeechSynthesisUtterance/.test(text.projection), 'no engine');
check('RP-AUTH-09', 'authority', 'Projection does not own visual styles', !/style\.setProperty|classList\.(?:add|remove|toggle)/.test(text.projection), 'no visual mutation');
check('RP-AUTH-10', 'authority', 'Projection is the only new symbol in controls owner', !has(text.controls, 'GBReaderProjection'), 'controls isolation');

check('RP-POLICY-01', 'policy', 'Root selector covers explicit reader root', has(text.projection, "'[data-reader-root] article.article-body'"), 'root selector');
check('RP-POLICY-02', 'policy', 'Root selector covers Gill reader', has(text.projection, "'[data-gill-v16] article.article-body'"), 'Gill selector');
check('RP-POLICY-03', 'policy', 'Root selector covers pagefind article', has(text.projection, "'article[data-pagefind-body]'"), 'Pagefind selector');
check('RP-POLICY-04', 'policy', 'Block inventory includes h1-h4 paragraphs and lists', has(text.projection, "const BLOCK_SELECTOR = 'h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd';"), 'block inventory');
check('RP-POLICY-05', 'policy', 'Projection understands data-reader-exclude', has(text.projection, '[data-reader-exclude]'), 'reader exclude');
check('RP-POLICY-06', 'policy', 'Projection understands data-reader-summary', has(text.projection, 'data-reader-summary'), 'reader summary');
check('RP-POLICY-07', 'policy', 'Projection understands data-reader-section', has(text.projection, 'data-reader-section'), 'reader section');
check('RP-POLICY-08', 'policy', 'Projection understands note policy', has(text.projection, 'data-reader-note-policy'), 'note policy');
check('RP-POLICY-09', 'policy', 'Projection understands search policy', has(text.projection, 'data-search-policy'), 'search policy');
check('RP-POLICY-10', 'policy', 'Projection understands speakable policy', has(text.projection, 'data-speakable-policy'), 'speakable policy');
check('RP-POLICY-11', 'policy', 'Projection understands print policy', has(text.projection, 'data-print-policy'), 'print policy');
check('RP-POLICY-12', 'policy', 'Projection publishes exact speakable selector order', has(text.projection, "['h1', '.article-lead', '.summary-card', '[data-speakable]']"), 'speakable selectors');
check('RP-POLICY-13', 'policy', 'Projection strips interactive inline content', has(text.projection, "'script', 'style', 'noscript', 'button', 'svg', 'audio', 'video'"), 'inline strip');
check('RP-POLICY-14', 'policy', 'Projection strips English source text from Russian speech', has(text.projection, "'[lang=\"en\"]', '[lang^=\"en-\"]'"), 'language strip');
check('RP-POLICY-15', 'policy', 'Projection avoids nested list duplication', has(text.projection, "element.matches('li') && element.querySelector(':scope > p, :scope > ul, :scope > ol')"), 'list guard');
check('RP-POLICY-16', 'policy', 'Projection avoids nested blockquote duplication', has(text.projection, "element.matches('blockquote') && element.querySelector(':scope > p')"), 'quote guard');

check('RP-API-01', 'api', 'Projection exposes TTS segments', has(text.projection, 'getTtsSegments,'), 'TTS API');
check('RP-API-02', 'api', 'Projection exposes speakable selectors', has(text.projection, 'getSpeakableSelectors:'), 'speakable API');
check('RP-API-03', 'api', 'Projection exposes speakable nodes', has(text.projection, 'getSpeakableNodes,'), 'speakable nodes API');
check('RP-API-04', 'api', 'Projection exposes search text', has(text.projection, 'getSearchText,'), 'search API');
check('RP-API-05', 'api', 'Projection exposes print nodes', has(text.projection, 'getPrintNodes,'), 'print API');
check('RP-API-06', 'api', 'Projection exposes current section', has(text.projection, 'getCurrentSection,'), 'section API');
check('RP-API-07', 'api', 'Projection exposes a ledger', has(text.projection, 'getLedger: ledger'), 'ledger API');
check('RP-API-08', 'api', 'TTS segments retain element ownership', has(text.projection, 'element,'), 'element ownership');
check('RP-API-09', 'api', 'TTS segments retain section ID', has(text.projection, 'sectionId: section.id'), 'section ID');
check('RP-API-10', 'api', 'TTS segments retain section label', has(text.projection, 'sectionLabel: section.label'), 'section label');
check('RP-API-11', 'api', 'Projection refresh is evented', has(text.projection, 'gb:reader-projection-ready'), 'ready event');
check('RP-API-12', 'api', 'Projection refreshes before Play capture', has(text.projection, "closest('[data-fc-action=\"play\"]')") && has(text.projection, '}, true);'), 'capture refresh');

check('RP-TTS-01', 'tts-bridge', 'Canonical TTS still excludes data-no-speech', has(text.tts, '[data-no-speech]'), 'marker bridge');
check('RP-TTS-02', 'tts-bridge', 'Canonical TTS block inventory matches projection', has(text.tts, "querySelectorAll('h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd')"), 'inventory parity');
check('RP-TTS-03', 'tts-bridge', 'Canonical TTS retains nested list guard', has(text.tts, "element.matches('li') && element.querySelector(':scope > p, :scope > ul, :scope > ol')"), 'list parity');
check('RP-TTS-04', 'tts-bridge', 'Canonical TTS retains nested quote guard', has(text.tts, "element.matches('blockquote') && element.querySelector(':scope > p')"), 'quote parity');
check('RP-TTS-05', 'tts-bridge', 'Canonical TTS remains versioned', has(text.tts, 'window.GBReaderTTS = Object.freeze'), 'TTS owner');
check('RP-TTS-06', 'tts-bridge', 'Projection marks explicit exclusions as data-no-speech', has(text.projection, "root.querySelectorAll('[data-reader-exclude],[data-speakable-policy=\"exclude\"]')"), 'marker materialization');

check('RP-SPEAK-01', 'speakable', 'Hermenevtika schema publishes SpeakableSpecification', has(text.hermHead, 'SpeakableSpecification'), 'schema');
check('RP-SPEAK-02', 'speakable', 'Hermenevtika schema includes h1', has(text.hermHead, '"h1"'), 'h1');
check('RP-SPEAK-03', 'speakable', 'Hermenevtika schema includes article lead', has(text.hermHead, '".article-lead"'), 'lead');
check('RP-SPEAK-04', 'speakable', 'Hermenevtika schema includes summary card', has(text.hermHead, '".summary-card"'), 'summary');
check('RP-SPEAK-05', 'speakable', 'Hermenevtika schema includes explicit speakable nodes', has(text.hermHead, '"[data-speakable]"'), 'explicit');
check('RP-SPEAK-06', 'speakable', 'Hermenevtika body has explicit reader root', has(text.hermBody, 'data-reader-root'), 'reader root');
check('RP-SPEAK-07', 'speakable', 'Hermenevtika summary is explicit speakable content', /summary-card[^>]*data-speakable/.test(text.hermBody), 'summary marker');
check('RP-SPEAK-08', 'speakable', 'Projection synchronizes JSON-LD selectors', has(text.projection, 'synchronizeSpeakableJsonLd'), 'JSON-LD sync');

check('RP-PRINT-01', 'print-search', 'Print owner remains separate', has(text.print, 'window.GBPrintPagination') && !has(text.projection, 'GBPrintPagination ='), 'print ownership');
check('RP-PRINT-02', 'print-search', 'Projection provides print order without geometry', has(text.projection, 'function getPrintNodes') && !has(text.projection, 'getBoundingClientRect'), 'semantic print API');
check('RP-PRINT-03', 'print-search', 'Projection search output is normalized', has(text.projection, "normalizeText(blockElements(root, 'search').map(readableText).join(' '))"), 'search normalization');
check('RP-PRINT-04', 'print-search', 'Pagefind ignore remains a policy exclusion', count(text.projection, /\[data-pagefind-ignore\]/g) >= 1, 'Pagefind exclusion');
check('RP-LIFE-01', 'lifecycle', 'Projection initializes at DOMContentLoaded', has(text.projection, 'DOMContentLoaded'), 'DOMContentLoaded');
check('RP-LIFE-02', 'lifecycle', 'Projection initializes on Astro navigation', has(text.projection, 'astro:page-load'), 'Astro lifecycle');
check('RP-LIFE-03', 'lifecycle', 'Projection initializes on pageshow', has(text.projection, "window.addEventListener('pageshow'"), 'pageshow');
check('RP-LIFE-04', 'lifecycle', 'Projection observes added reader content', has(text.projection, 'new MutationObserver'), 'MutationObserver');
check('RP-LIFE-05', 'lifecycle', 'Projection observer ignores attribute churn', has(text.projection, "observer.observe(root, { childList: true, subtree: true })"), 'child-list boundary');
check('RP-LIFE-06', 'lifecycle', 'Projection refresh is microtask and frame bounded', has(text.projection, 'queueMicrotask(() => requestAnimationFrame'), 'bounded refresh');
check('RP-LIFE-07', 'lifecycle', 'Projection publishes a document readiness marker', has(text.projection, 'data-gb-reader-projection-ready'), 'ready marker');
check('RP-LIFE-08', 'lifecycle', 'Projection API policy is frozen', has(text.projection, 'policy: Object.freeze'), 'frozen policy');
check('RP-LIFE-09', 'lifecycle', 'Projection filters mutations through semantic additions', has(text.projection, 'function hasProjectableAddition') && has(text.projection, 'mutations.some(hasProjectableAddition)'), 'semantic mutation filter');
check('RP-LIFE-10', 'lifecycle', 'Projection ignores non-element placeholder nodes', has(text.projection, 'if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return false;'), 'placeholder guard');
check('RP-LIFE-11', 'lifecycle', 'Projection watches explicit quiz-rendered lifecycle', has(text.projection, "document.addEventListener('gb:quiz-rendered', queueRefresh)"), 'quiz lifecycle');
check('RP-LIFE-12', 'lifecycle', 'Projectable additions remain tied to reader semantics', has(text.projection, 'PROJECTABLE_ADDITION_SELECTOR') && has(text.projection, 'node.matches?.(PROJECTABLE_ADDITION_SELECTOR)'), 'projectable selector');

assert.ok(checks.length >= 68, `reader projection source contract requires at least 68 checks, got ${checks.length}`);
assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'reader projection check IDs must be unique');
const failed = checks.filter((item) => !item.pass);
const summary = {
  sha: process.env.GITHUB_SHA || null,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
};
const report = { summary, files: FILES, checks };
fs.writeFileSync(path.join(REPORTS, 'reader-projection-source-contract.json'), JSON.stringify(report, null, 2));
const markdown = [
  '# ReaderProjection source contract', '',
  `- SHA: \`${summary.sha || 'local'}\``,
  `- Checks: **${summary.checks}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`, '',
  '| ID | Area | Result | Description | Evidence |',
  '|---|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.area} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} | ${item.evidence.replace(/\|/g, '\\|')} |`),
].join('\n');
fs.writeFileSync(path.join(REPORTS, 'reader-projection-source-contract.md'), markdown);
checks.forEach((item) => console.log(`[READER-PROJECTION-SOURCE] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} ${item.area} :: ${item.description}`));
console.log('[READER-PROJECTION-SOURCE-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `ReaderProjection source contract failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('ReaderProjection source contract: PASS');
