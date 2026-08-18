#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { auditSeriesFragments } = require('./series-reader-fragment-audit');

const ROOT = path.resolve(__dirname, '..');
const FACADE = path.join(ROOT, 'src/components/article-pilots/_shared/series/SeriesReaderChrome.astro');
const SERIES_LAYOUT = path.join(ROOT, 'src/layouts/SeriesArticleLayout.astro');
const HEART_SERIES_DATA = path.join(ROOT, 'src/components/article-pilots/_shared/heartSeriesData.ts');
const MOBILE_BAR = path.join(ROOT, 'src/components/article-pilots/gill-series/GillSeriesMobileBar.astro');
const LEARNING_SHEET = path.join(ROOT, 'src/components/article-pilots/gill-series/GillLearningSheet.astro');
const SERIES_CONFIG = path.join(ROOT, 'src/components/article-pilots/_shared/series/seriesConfig.ts');
const BAPTIST_SERIES_CONFIG = path.join(ROOT, 'src/components/article-pilots/_shared/series/baptistFlatSeriesConfig.ts');
const DIST = path.join(ROOT, 'dist');
const IMPLEMENTATION_IMPORT = "import GillSeriesChrome from '../../gill-series/GillSeriesChrome.astro';";
const DIRECT_IMPORT_RE = /import\s+[A-Za-z_$][\w$]*\s+from\s+['"][^'"]*GillSeriesChrome\.astro['"]/;
const FACADE_IMPORT_RE = /import\s+SeriesReaderChrome\s+from\s+['"][^'"]*SeriesReaderChrome\.astro['"]/g;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const facade = fs.readFileSync(FACADE, 'utf8');
assert.ok(facade.includes(IMPLEMENTATION_IMPORT), 'façade must be the only implementation importer');
assert.ok(facade.includes('<GillSeriesChrome pageId={pageId} config={config}>'), 'façade must forward pageId/config');
assert.ok(facade.includes('<slot />'), 'façade must forward the default slot');
assert.equal(typeof auditSeriesFragments, 'function', 'series fragment audit must expose its reusable contract');

const seriesLayout = fs.readFileSync(SERIES_LAYOUT, 'utf8');
assert.match(
  seriesLayout,
  /import\s*\{[^}]*\brender\b[^}]*\}\s*from\s*['"]astro:content['"]/,
  'SeriesArticleLayout must import the content-layer render(entry) API',
);
assert.match(seriesLayout, /await\s+render\(entry\)/, 'SeriesArticleLayout must render content-layer entries through render(entry)');
assert.doesNotMatch(seriesLayout, /\bentry\.render\s*\(/, 'SeriesArticleLayout must not call the removed entry.render() API');

const heartSeriesData = fs.readFileSync(HEART_SERIES_DATA, 'utf8');
const heartProgress = heartSeriesData.match(/export function heartProgress\([\s\S]*?\n}\n/);
assert.ok(heartProgress, 'heartProgress implementation must remain present');
assert.match(heartProgress[0], /const item = heartItem\(pageId\);/, 'heartProgress must fail closed through heartItem');
assert.match(heartProgress[0], /partMin:\s*item\.minutes/, 'heartProgress must use the validated item');
assert.doesNotMatch(heartProgress[0], /HEART_SERIES_ITEMS\[idx\]\.minutes/, 'heartProgress must not dereference an unchecked index');

const mobileBar = fs.readFileSync(MOBILE_BAR, 'utf8');
const learningSheet = fs.readFileSync(LEARNING_SHEET, 'utf8');
const seriesConfig = fs.readFileSync(SERIES_CONFIG, 'utf8');
const baptistSeriesConfig = fs.readFileSync(BAPTIST_SERIES_CONFIG, 'utf8');
assert.match(seriesConfig, /railBackHref:\s*string;/, 'SeriesConfig must keep railBackHref as required route authority');
assert.match(mobileBar, /data-home-href=\{config\.railBackHref\}/, 'shared mobile Back must derive its fallback from config.railBackHref');
assert.doesNotMatch(mobileBar, /data-home-href=["']\.\.\/\.\.\/biografii\//, 'shared mobile Back must not hardcode Gill biographies');
assert.match(baptistSeriesConfig, /quiz:\s*\[\]/, 'Baptist no-quiz series must declare the empty quiz authority explicitly');
assert.match(
  learningSheet,
  /\{hasQuiz\s*&&\s*<button[^>]*id="tabQuiz"[^>]*aria-controls="panelQuiz"/,
  'Quiz tab must remain conditional on hasQuiz',
);
assert.match(
  learningSheet,
  /\{hasQuiz\s*&&\s*\(\s*<section[^>]*id="panelQuiz"[^>]*aria-labelledby="tabQuiz"/,
  'Quiz panel must be gated by the same hasQuiz condition as its labelling tab',
);
assert.match(
  learningSheet,
  /<input\b(?=[^>]*\bid="learningSearchInput")(?=[^>]*\btype="search")(?=[^>]*\baria-label="Найти в этой статье")(?=[^>]*\bplaceholder="Найти в этой статье")[^>]*>/,
  'Learning-sheet search must keep a persistent accessible name independent of its placeholder',
);

const sourceFiles = walk(path.join(ROOT, 'src')).filter((file) => /\.(?:astro|ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const illegal = [];
let facadeImports = 0;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (file !== FACADE && DIRECT_IMPORT_RE.test(text)) illegal.push(path.relative(ROOT, file));
  const matches = text.match(FACADE_IMPORT_RE);
  if (matches) facadeImports += matches.length;
}

assert.deepEqual(illegal, [], `direct GillSeriesChrome imports outside façade: ${illegal.join(', ')}`);
assert.ok(facadeImports >= 41, `expected at least 41 SeriesReaderChrome consumers, found ${facadeImports}`);

if (fs.existsSync(DIST)) {
  const report = auditSeriesFragments({ dist: DIST, failOnMissingDist: false });
  assert.equal(report.result, 'PASS', `rendered series fragment contract failed: ${report.errors.join('; ')}`);
}

console.log(`✅ series-reader-facade: ${facadeImports} consumers; implementation import isolated to façade; content-layer rendering uses Astro render(entry); heart progress fail-closed; mobile Back config-owned; no-quiz Learning panel relation guarded; Learning search has persistent accessible name; fragment audit registered`);