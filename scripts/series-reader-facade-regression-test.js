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
const ANALYTICS_STUDY = path.join(ROOT, 'src/components/article-pilots/gill-series/GillAnalyticsStudy.astro');
const SERIES_CONFIG = path.join(ROOT, 'src/components/article-pilots/_shared/series/seriesConfig.ts');
const BAPTIST_SERIES_CONFIG = path.join(ROOT, 'src/components/article-pilots/_shared/series/baptistFlatSeriesConfig.ts');
const DIST = path.join(ROOT, 'dist');
const REQUIRE_DIST = process.argv.includes('--require-dist');
const DIST_ARG = process.argv.find((arg) => arg.startsWith('--dist='));
const REPORT_ARG = process.argv.find((arg) => arg.startsWith('--report='));
const STRICT_DIST = DIST_ARG ? path.resolve(ROOT, DIST_ARG.slice('--dist='.length)) : DIST;
const STRICT_REPORT = REPORT_ARG ? path.resolve(ROOT, REPORT_ARG.slice('--report='.length)) : undefined;
const IMPLEMENTATION_IMPORT = "import GillSeriesRail from '../../gill-series/GillSeriesRail.astro';";
const RETIRED_CHROME = path.join(ROOT, 'src/components/article-pilots/gill-series/GillSeriesChrome.astro');
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
assert.ok(facade.includes(IMPLEMENTATION_IMPORT), 'canonical SeriesReaderChrome owns composition');
assert.ok(facade.includes('<GillSeriesRail pageId={pageId} config={config} />'), 'canonical rail configured');
assert.ok(facade.includes('<GillSeriesMobileBar pageId={pageId} config={config} />'), 'canonical mobile bar configured');
assert.ok(facade.includes('<GillReaderSettingsSheet config={config} />'), 'canonical settings configured');
assert.ok(facade.includes('<ReaderActionsRuntime />'), 'canonical runtime mounted once');
assert.ok(!fs.existsSync(RETIRED_CHROME), 'old GillSeriesChrome is retired');
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
const analyticsStudy = fs.readFileSync(ANALYTICS_STUDY, 'utf8');
const mobileTrigger = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/_shared/ReaderMobileMenuTrigger.astro'), 'utf8');
const mobilePlay = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/_shared/ReaderMobilePlayGroup.astro'), 'utf8');
const mobileRuntime = fs.readFileSync(path.join(ROOT, 'js/floating-cluster-controller.js'), 'utf8');
const sharedSpeedSlot = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/_shared/speedSlot.ts'), 'utf8');
const partOverlay = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/gill-series/GillMobileMarginalia.astro'), 'utf8');
const settingsSheet = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/gill-series/GillReaderSettingsSheet.astro'), 'utf8');
const actionsSource = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/_shared/ReaderMobileActions.astro'), 'utf8');
const settingsTrigger = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/_shared/ReaderMobileSettingsButton.astro'), 'utf8');
// W124: Research remains the only top Analytics entrance, while Site Search
// is a separate SVG between Play and Settings. No duplicate search card may
// appear inside the native Analytics panel.
assert.match(mobileBar, /<ReaderMobileMenuTrigger mode="research"/, 'Gill top must launch canonical Marginalia');
assert.match(mobileBar, /<ReaderMobileSettingsButton engine="series" top/, 'Gill settings trigger must remain in the top bar');
assert.match(mobileBar, /class="gb-icon reader-mobile-top-search"/, 'Gill mobile bar needs exactly one visible Search SVG button');
assert.match(mobileBar, /data-fc-action="search"/, 'Search must delegate to the existing Pagefind controller');
const playPosition = mobileBar.indexOf('<ReaderMobilePlayGroup engine="series" slot="top-playback"');
const searchPosition = mobileBar.indexOf('class="gb-icon reader-mobile-top-search"');
const settingsPosition = mobileBar.indexOf('<ReaderMobileSettingsButton engine="series" top');
assert.ok(playPosition >= 0 && playPosition < searchPosition && searchPosition < settingsPosition,
  'Gill toolbar order must be Play → Search → Settings');
assert.doesNotMatch(partOverlay, /gbr-marginalia-search/, 'Analytics must not include a competing search action');
assert.match(mobileBar, /initGillCompactFavouritePlacement\(\)/, 'compact mobile must preserve one favourite control');
assert.match(mobileBar, /compact\.addEventListener\('change', place\)/, 'Save must return to top when resizing');
// W126: no individual SVG offset is allowed to falsify a uniform 44px grid.
assert.doesNotMatch(mobileBar, /\.mobile-top-save svg\s*\{\s*translate:\s*-4px/, 'Save icon must not be nudged 4px left');
assert.doesNotMatch(mobileBar, /\.reader-mobile-action--top-settings svg[^\{]*\{[^}]*transform:translateX\(-[48]px\)/, 'Settings icon must not receive a hidden nudge');
// W125: do not regress to centring the full flex slot or to a localhost link
// that displays the older desktop unless ?reader-pilot=1 was hand-added.
assert.match(mobileBar, /initGillAnalyticsOpticalAlignment\(\)/, 'painted Analytics alignment must run');
assert.match(mobileBar, /const targetCentre = \(home\.right \+ play\.left\) \/ 2/, 'optical centre uses actual Home and Play ink edges');
assert.match(mobileBar, /--gb-analytics-ink-shift/, 'optical shift must affect ink, not touch target');
const localPreview = fs.readFileSync(path.join(ROOT, 'research/reader-w57-pilot/preview.py'), 'utf8');
assert.match(localPreview, /parse_qs\(req\.query\)\.get\("reader-pilot"\)!=\["0"\]/,
  'ordinary localhost Reader URL must default to W57 desktop; native is an explicit opt-out');
assert.match(localPreview, /matchMedia\('\(min-width:1121px\)'\)/,
  'local W57 bootstrap must retain the native mobile reader');
assert.match(mobileBar, /<ReaderMobileActions engine="series" settingsPlacement="none"/, 'Gill bottom bar must reserve space for the current chapter, not duplicate Settings');
assert.match(actionsSource, /settingsPlacement === 'bottom' && <ReaderMobileSettingsButton engine=\{engine\}/, 'other mobile Reader engines must retain their bottom settings');
assert.match(settingsTrigger, /id=\{isSeries\?'mobSettingsBtn':'hmSettingsBtn'\}/, 'single settings control must preserve original owner IDs');
assert.match(settingsTrigger, /data-gill-settings-open=\{isSeries\?'':undefined\}/, 'Gill settings trigger must delegate to canonical overlay owner');
assert.match(mobileBar, /5vw - 16px/, '320px must preserve full 44px hit areas for top controls');

assert.match(mobileBar, /import ['"]@\/styles\/reader-mobile-canonical\.css['"];/, 'Gill mobile must import its own canonical layout CSS without depending on the retired speed component');
assert.match(mobileBar, /id="mobPartTocBtn"/, 'Gill lower current section must open Part TOC');
assert.match(mobileTrigger, /data-gill-marginalia-open=\{mode === 'research'/, 'shared trigger must expose one research entry');
assert.match(mobileRuntime, /topResearchBtns = qsa\('\[data-gill-marginalia-open\]'\)/, 'native Part TOC owner must open top research');
assert.match(mobileRuntime, /var MOB_SEC_INITIAL = \(function \(\)/, 'series progress must preserve the original SSR chapter caption before its first H2');
assert.match(mobileRuntime, /hasActiveSection \? reader\.sectionTitle : \(MOB_SEC_INITIAL \|\| 'Начало части'\)/, 'before-content placeholder Введение must not overwrite the SSR title');
assert.match(partOverlay, /gb:gill-select-part-panel/, 'research tab must be selected through the native Part TOC sheet');
assert.doesNotMatch(settingsSheet, /mobLearningBtn|gillLearningOverlay|Обучение/, 'Settings must contain reading preferences only');
assert.match(analyticsStudy, /id="gbAnalyticsStudy"/, 'unified Analytics quiz must be mounted once');
assert.match(fs.readFileSync(FACADE, 'utf8'), /<GillAnalyticsStudy pageId=\{pageId\} config=\{config\}/, 'series chrome must own one Analytics study');
// Historical #75 slot-swap: speeds REPLACE the research capsule, never descend
// across the hero. One ReaderSpeedOptions/speedSlot owner serves both readers.
assert.match(mobileBar, /<ReaderMobilePlayGroup engine="series" slot="top-playback"/, 'Gill keeps canonical Play, without bloom opt-in');
assert.match(mobileBar, /<ReaderSpeedOptions id="mobileSpeedrail"[^>]*initiallyInert/, 'Gill mounts shared six-rate horizontal speed rail');
assert.match(mobileBar, /'data-gb-speed-custom': true/, 'Gill TTS controller skips competing vertical speed bloom');
assert.match(mobileBar, /mobile-top-bar\.speed-open \.mobile-top-slot \.reader-mobile-speedrail/, 'Gill speeds live in vacated top slot');
assert.match(mobilePlay, /<ReaderMobileSpeedBadge engine=\{engine\}/, 'shared Play retains selected-rate badge');
assert.match(mobileBar, /reader-mobile-play \.gb-ember__ring-svg/, 'Gill idle circular Play ring remains visible');
assert.match(sharedSpeedSlot, /rateTrigger\.querySelector\('\.reader-mobile-speed-chip'\) \|\| rateTrigger/, 'Hermenevtika shared speed state must remain intact');
const seriesConfig = fs.readFileSync(SERIES_CONFIG, 'utf8');
const baptistSeriesConfig = fs.readFileSync(BAPTIST_SERIES_CONFIG, 'utf8');
assert.match(seriesConfig, /railBackHref:\s*string;/, 'SeriesConfig must keep railBackHref as required route authority');
assert.match(mobileBar, /data-home-href=\{config\.railBackHref\}/, 'shared mobile Back must derive its fallback from config.railBackHref');
assert.doesNotMatch(mobileBar, /data-home-href=["']\.\.\/\.\.\/biografii\//, 'shared mobile Back must not hardcode Gill biographies');
assert.match(baptistSeriesConfig, /quiz:\s*\[\]/, 'Baptist no-quiz series must declare the empty quiz authority explicitly');
assert.match(analyticsStudy, /data-study=\{studyData\}/, 'study must have explicit SeriesConfig data');
assert.doesNotMatch(analyticsStudy, /gillLearningOverlay|mobLearningBtn/, 'study must not own modal Learning');
assert.doesNotMatch(fs.readFileSync(FACADE,'utf8'), /<GillLearningSheet/, 'retired Learning sheet cannot mount');

const sourceFiles = walk(path.join(ROOT, 'src')).filter((file) => /\.(?:astro|ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const illegal = [];
let facadeImports = 0;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (file !== FACADE && DIRECT_IMPORT_RE.test(text)) illegal.push(path.relative(ROOT, file));
  const matches = text.match(FACADE_IMPORT_RE);
  if (matches) facadeImports += matches.length;
}

assert.deepEqual(illegal, [], `retired GillSeriesChrome imports: ${illegal.join(', ')}`);
assert.ok(facadeImports >= 41, `expected at least 41 SeriesReaderChrome consumers, found ${facadeImports}`);

if ((DIST_ARG || REPORT_ARG) && !REQUIRE_DIST) {
  throw new Error('--dist/--report require --require-dist; default facade guard is source-only');
}

let strictFragmentSummary = 'fragment audit registered (source-only mode)';
if (REQUIRE_DIST) {
  const report = auditSeriesFragments({
    dist: STRICT_DIST,
    reportPath: STRICT_REPORT,
    failOnMissingDist: true,
  });
  assert.equal(report.result, 'PASS', `rendered series fragment contract failed: ${report.errors.join('; ')}`);
  strictFragmentSummary = `strict fragment audit passed: ${report.totals.pages} page(s), ${report.totals.uniqueFragments} unique target(s)`;
}


/*
 * Both rail families must use the same presentational TOC heading,
 * with historically stable IDs and the series-collapse native button.
 * This is a composition contract, not a second reader/scroll owner.
 */
const TOC_HEADING = path.join(ROOT, 'src/components/article-pilots/_shared/ReaderTocHeading.astro');
const SINGLE_RAIL = path.join(ROOT, 'src/components/article-pilots/_shared/ReaderRail.astro');
const SERIES_RAIL = path.join(ROOT, 'src/components/article-pilots/gill-series/GillSeriesRail.astro');
const tocHeadingSource = fs.readFileSync(TOC_HEADING, 'utf8');
const singleRailSource = fs.readFileSync(SINGLE_RAIL, 'utf8');
const seriesRailSource = fs.readFileSync(SERIES_RAIL, 'utf8');
assert.match(singleRailSource, /<ReaderTocHeading variant="single"/, 'standalone reader must reuse canonical TOC heading');
assert.match(seriesRailSource, /<ReaderTocHeading variant="series"/, 'series reader must reuse canonical TOC heading');
assert.match(tocHeadingSource, /id="hrailCount"/, 'standalone count ID is stable');
assert.match(tocHeadingSource, /id="gbs2Count"/, 'series count ID is stable');
assert.match(tocHeadingSource, /<slot\s*\/>/, 'series rail native collapse trigger must pass through unchanged');
assert.match(seriesRailSource, /id="gbsTocToggle"/, 'series TOC collapse button remains the native controller target');
assert.match(seriesRailSource, /aria-controls="gbsTocScroll"/, 'series TOC scroll target is preserved');

/* Prevent a zero-height current chapter on short desktop windows. */
const currentCardStyles = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/gill-series/GillSeriesImagePremium.astro'), 'utf8');
assert.ok(currentCardStyles.includes('max-height:640px') && currentCardStyles.includes('.gbs2-rmid > .gbs2-current') && currentCardStyles.includes('flex-shrink: 0;'), 'short viewport current-card flex guard');

/* Gill premium-layout contract (2026-11-19): one responsive owner. */
const gillResponsiveOwner = fs.readFileSync(
  path.join(ROOT, 'src/components/article-pilots/gill-series/GillSeriesResponsiveStyles.astro'), 'utf8');
const gillPart2Header = fs.readFileSync(
  path.join(ROOT, 'src/components/article-pilots/gill-part2/GillPart2HeaderHero.astro'), 'utf8');
const canonicalSpeedCss = fs.readFileSync(
  path.join(ROOT, 'src/styles/reader-mobile-canonical.css'), 'utf8');
assert.match(gillResponsiveOwner, /margin-left:\s*max\([\s\S]*?22vw[\s\S]*?24px/,
  'Gill content centre must preserve a 24px fixed-rail clearance');
assert.match(gillResponsiveOwner, /orientation:\s*landscape[\s\S]*?max-height:\s*500px/,
  'short landscape must receive its own compact reading layout');
assert.match(gillResponsiveOwner, /@media \(min-width: 40em\) and \(max-width: 84\.999em\)/,
  'tablet Gill TOC must stay bounded before the desktop rail breakpoint');
assert.match(gillResponsiveOwner, /height:\s*min\(38dvh,\s*320px\)/,
  'ordinary landscape tablet hero must not dominate the first viewport');
assert.match(gillResponsiveOwner, /@media \(max-width: 60em\)[\s\S]*?mobile-btoc-section\s*\{\s*min-height:\s*44px;/,
  'Gill phone and small-tablet current chapter 44px touch target is mandatory');
assert.match(gillResponsiveOwner, /mobile-bottom-bar\s*\{\s*background:\s*rgba\(25,\s*23,\s*21,\s*\.96\)\s*!important;/,
  'Gill warm dark palette legacy bar override stays scoped to 961–1359px');
assert.match(gillResponsiveOwner, /@media \(min-width: 60\.0625em\) and \(max-width: 84\.999em\)/,
  'mid-width Gill bar must have a scoped bridge between 960px and 1360px');
assert.match(gillResponsiveOwner, /mobile-btoc-section\s*\{[\s\S]*?appearance:\s*none;[\s\S]*?min-height:\s*44px;/,
  'mid-width Gill bar must render a native 44px section button rather than the browser default');
assert.match(gillResponsiveOwner, /max-width:\s*220px/,
  'landscape mobile TOC trigger must not fill the entire header');
assert.match(gillResponsiveOwner, /height:\s*clamp\(116px,\s*34dvh,\s*144px\)/,
  'short landscape hero must let the title into the first viewport');
assert.match(gillResponsiveOwner, /#gb-hl-fab:not\(\.gb-hl-fab--docked\)\s*\{\s*right:\s*calc\(5vw\s*-\s*2px\);/,
  'Gill desktop Library FAB must share the exact x-axis with five floating controls');
assert.match(gillResponsiveOwner, /gbs-theme-corner\s*\{\s*gap:\s*8px;/,
  'Gill desktop action centres stay evenly spaced');
assert.match(gillResponsiveOwner, /\.gb-ember-wrap\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;/,
  'Gill desktop TTS retains its SVG while receiving a regular layout slot');
assert.match(gillResponsiveOwner, /--gb-gill-paper:\s*#141312/,
  'Gill dark surfaces must use the warm editorial paper token');
assert.match(gillResponsiveOwner, /reader-mobile-speed-badge::before/,
  'secondary speed control must retain the reduced-contrast fill');
assert.match(gillPart2Header, /<span class="gill-life-years">\(1697–1771\)<\/span>/,
  'historical life-year range must be an unbreakable inline unit');
assert.match(gillResponsiveOwner, /\.gill-life-years\s*\{\s*white-space:\s*nowrap;/,
  'nowrap is allowed only on the life-year range, not the entire heading');
assert.match(canonicalSpeedCss,
  /min-width:\s*44px;\s*min-height:\s*44px;\s*height:\s*44px;/,
  'canonical mobile speed options retain 44px touch targets');

console.log(`✅ series-reader-facade: ${facadeImports} consumers; canonical composition directly owned; historical implementation retired; content-layer rendering uses Astro render(entry); heart progress fail-closed; mobile Back config-owned; no-quiz Analytics mode conditional; no competing Learning modal; ${strictFragmentSummary}`);