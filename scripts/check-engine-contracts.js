#!/usr/bin/env node
/** Static regression contracts for reader engines, relation compiler and Atlas. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
let fails = 0;
function check(name, ok, hint = '') {
  if (ok) console.log('✅ ' + name);
  else { fails += 1; console.error('❌ ' + name + (hint ? '\n   → ' + hint : '')); }
}
function syntaxCheck(file) {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  check('JS syntax: ' + file, result.status === 0, (result.stderr || result.stdout || '').trim());
}

const css = read('css/floating-cluster.css');
const badOverlay = css.split('\n').filter((line) => /^\s*\.gill-settings-overlay/.test(line) || /,\s*\.gill-settings-overlay/.test(line));
check('CSS: .gill-settings-overlay scoped by [data-gill-v16]', badOverlay.length === 0, badOverlay.slice(0, 3).join(' | '));
const tabIndex = css.indexOf('.gill-tab:focus-visible');
const tabContext = tabIndex === -1 ? '' : css.slice(tabIndex, tabIndex + 200);
check('CSS: no double .gill-tab focus ring', tabIndex === -1 || !/outline-offset/.test(tabContext));
check('CSS: series mobile breadcrumbs hidden', /\[data-gill-v16\]\s*\.page-wrap\s*>\s*nav\.breadcrumb\s*\{[^}]*display:\s*none/.test(css));
check('CSS: idle PLAY outline for series', /\.gbs-theme-corner \.gb-ember__ring-svg\s*\{\s*opacity:\s*1/.test(css));
check('CSS: idle PLAY outline for articles', /\.gb-floater \.gb-ember__ring-svg\s*\{\s*opacity:\s*1/.test(css));
const badgeRules = [
  /\[data-gill-v16\] \.gbs-rail-spdbadge\s*\{[^}]*right:\s*-2px;\s*bottom:\s*-2px/,
  /\.gb-floater \.gbs-rail-spdbadge\s*\{[^}]*right:\s*-2px;\s*bottom:\s*-2px/,
  /\.mobile-spdbadge\s*\{[^}]*right:\s*-2px;\s*bottom:\s*-2px/,
];
check('CSS: speed badge anchored inside PLAY', badgeRules.every((rule) => rule.test(css)));

const controller = read('js/floating-cluster-controller.js');
check('Reader: follow-scroll contract', controller.includes('function buildFollowMap') && controller.includes('function followReading') && controller.includes('followReading(ttsState.spokenChars)'));
check('Reader: Media Session contract', controller.includes('function mediaSessionMeta') && controller.includes('function mediaSessionSet') && controller.includes('function silentWavUrl') && controller.includes("navigator.mediaSession.setActionHandler('play'"));
check('Reader: chunk seek contract', controller.includes('function skipChunk') && controller.includes("setActionHandler('seekforward'"));
check('Reader: shared settings selector', controller.includes('[data-gill-settings-open]'));

const readerActions = read('js/reader-actions.js');
const readerActionsRuntime = read('src/components/reader-platform/ReaderActionsRuntime.astro');
const gillChrome = read('src/components/article-pilots/gill-series/GillSeriesChrome.astro');
const gillResponsive = read('src/components/article-pilots/gill-series/GillSeriesResponsiveStyles.astro');
const nagornayaRuntime = read('src/components/nagornaya/_shared/NagornayaPageFooterRuntime.astro');
const assetVersions = read('src/lib/asset-version.js');
check('Reader actions: print engine is a dedicated singleton',
  readerActions.includes('window.GBPrintEngine = printEngine') &&
  readerActions.includes('const PRINT_ENGINE_VERSION = 2.1') &&
  readerActions.includes("closest('[data-action=\"print\"],[data-action=\"share\"],[data-home-href]')") &&
  readerActions.includes("window.addEventListener('beforeprint'") &&
  readerActions.includes("window.addEventListener('afterprint'"));
check('Reader actions: print delegates pagination and calls window.print once',
  readerActions.includes('window.GBPrintPagination') &&
  readerActions.includes('if (printing) return copyReport(report)') &&
  readerActions.includes('window.print();'));
check('Reader actions: cache-busted native component owns the runtime',
  readerActionsRuntime.includes("assetUrl('js/reader-actions.js')") &&
  assetVersions.includes("'js/reader-actions.js': '5a39eb2a'"));
check('Reader actions: strict-native series use explicit owner without site.js',
  gillChrome.includes('ReaderActionsRuntime') && nagornayaRuntime.includes('ReaderActionsRuntime') &&
  !gillChrome.includes('/js/site.js') && !nagornayaRuntime.includes('/js/site.js'));
check('Gill responsive: mobile table scroll is local, visible and print-reversible',
  gillResponsive.includes('table.manuscript-table') &&
  gillResponsive.includes('overflow-x: auto') &&
  gillResponsive.includes('overscroll-behavior-inline: contain') &&
  gillResponsive.includes('@media print') &&
  gillResponsive.includes('display: table') &&
  !gillResponsive.includes('overflow-x: hidden'));
check('Gill responsive: floating tooltip wraps within safe viewport',
  gillResponsive.includes('body[data-gbs2-series="dzhon-gill"] .tooltip') &&
  gillResponsive.includes('calc(100vw - 24px)') &&
  gillResponsive.includes('overflow-wrap: anywhere') &&
  gillResponsive.includes('white-space: normal !important'));

const readerRail = read('src/components/article-pilots/_shared/ReaderRail.astro');
const readerSettings = read('src/components/article-pilots/_shared/ReaderSettings.astro');
check('Engine isolation: single article does not import gill-series', !/from ['"][^'"]*gill-series\//.test(readerRail) && !/from ['"][^'"]*gill-series\//.test(readerSettings));
check('Engine isolation: Gill settings has no [data-reader-root] fallback', !read('src/components/article-pilots/gill-series/GillReaderSettingsSheet.astro').includes('data-reader-root'));

const registry = read('src/components/article-pilots/_shared/mobileChromeRegistry.ts');
const catalogRoutes = ['/articles/', '/biografii/', '/hard-texts/', '/rodosloviye/', '/karty/', '/konfessii/'];
check('Page engine: six catalogs registered', catalogRoutes.every((route) => registry.includes("'" + route + "'")), catalogRoutes.join(', '));

const seriesBodies = [
  'src/components/baptisty-rossii',
  'src/components/article-pilots/novoe-serdce',
  'src/components/article-pilots/krajne',
  'src/components/article-pilots/rimlyanam7',
  'src/components/article-pilots/serdce-iduh',
  'src/components/article-pilots/serdce-spravochnik',
  'src/components/article-pilots/chto-bibliya-nazyvaet-serdcem',
  'src/components/article-pilots/antisovetov',
];
const missingSeriesChrome = [];
for (const dir of seriesBodies) {
  for (const file of fs.readdirSync(path.join(ROOT, dir)).filter((entry) => entry.endsWith('Body.astro'))) {
    if (file === 'BaptistyRossiiBody.astro') continue;
    if (!read(path.join(dir, file)).includes('SeriesReaderChrome')) missingSeriesChrome.push(path.join(dir, file));
  }
}
check('Series engine: all article bodies use SeriesReaderChrome', missingSeriesChrome.length === 0, missingSeriesChrome.join(', '));
const baptDir = 'src/components/baptisty-rossii';
const staleCounts = fs.readdirSync(path.join(ROOT, baptDir)).filter((file) => file.endsWith('Body.astro') && /из 10</.test(read(path.join(baptDir, file))));
check('Content: Baptist series counters match canonical engine', staleCounts.length === 0, staleCounts.join(', '));

const seriesDir = 'src/components/article-pilots/_shared/series';
const configFiles = fs.readdirSync(path.join(ROOT, seriesDir)).filter((file) => file.endsWith('SeriesConfig.ts'));
const rawConfigs = configFiles.filter((file) => !read(path.join(seriesDir, file)).includes('defineSeriesConfig('));
check('Series configs: all declared through defineSeriesConfig()', rawConfigs.length === 0 && read(path.join(seriesDir, 'seriesConfig.ts')).includes('defineSeriesConfig('), rawConfigs.join(', '));
check('Series guide exists', fs.existsSync(path.join(ROOT, 'docs/SERIES-ENGINE-GUIDE.md')));
const themes = [];
for (const file of configFiles.concat(['seriesConfig.ts'])) {
  for (const match of read(path.join(seriesDir, file)).match(/theme:\s*'([a-z0-9-]+)'/g) || []) themes.push(match.match(/'([a-z0-9-]+)'/)[1]);
}
const missingThemes = themes.filter((theme) => !fs.existsSync(path.join(ROOT, `css/series-${theme}.css`)));
check('Series themes: every declared theme has CSS', missingThemes.length === 0, missingThemes.join(', '));
check('Series satellites rendered by accordion', read('src/components/article-pilots/gill-series/GillPartTocOverlay.astro').includes('satellitesOf('));

const relationFiles = [
  'src/lib/relations/engine.mjs',
  'src/lib/relations/engine.d.ts',
  'src/lib/relations/compiled.ts',
  'data/relations.json',
  'data/relations.schema.json',
  'src/pages/data/relations.compiled.json.ts',
  'scripts/check-relations.mjs',
  'scripts/project-relations-to-dist.mjs',
  'src/runtime/relationship-panel.css',
];
check('Relations: canonical compiler surface complete', relationFiles.every((file) => fs.existsSync(path.join(ROOT, file))), relationFiles.filter((file) => !fs.existsSync(path.join(ROOT, file))).join(', '));
check('Relations: browser assembly runtime removed', !fs.existsSync(path.join(ROOT, 'src/runtime/relationship-panel.js')) && !fs.existsSync(path.join(ROOT, 'js/relationship-panel.js')));

const relationEngine = read('src/lib/relations/engine.mjs');
const relationComposition = read('src/lib/relations/compiled.ts');
const relationEndpoint = read('src/pages/data/relations.compiled.json.ts');
const projector = read('scripts/project-relations-to-dist.mjs');
const relationshipCss = read('src/runtime/relationship-panel.css');
const atlasBody = read('src/components/map/AtlasBody.astro');
const atlasNoScript = read('src/components/map/AtlasNoScriptFallback.astro');
const atlasRuntime = read('src/runtime/atlas-runtime.js');
const atlasStyles = read('src/components/map/MapStyles.astro');
const atlasRoute = read('src/pages/map/index.astro');
const postbuild = read('scripts/astro-cache-bust-postbuild.js');
const baseLayout = read('src/layouts/BaseLayout.astro');

check('Relations: compiler validates catalog, derives series and imports legacy fallback', relationEngine.includes('function compileCatalog') && relationEngine.includes('function compileSeries') && relationEngine.includes('function compileLegacy') && relationEngine.includes('legacy-import'));
check('Relations: compiler creates ranked article projections without series duplication', relationEngine.includes('function buildProjections') && relationEngine.includes('sameSeries') && relationEngine.includes('.slice(0, 4)'));
check('Relations: compiler fails on ambiguous series ownership', relationEngine.includes('seriesOwnerByUrl') && relationEngine.includes('belongs to both'));
check('Relations: compiler validates draft and deprecated endpoints before status handling', relationEngine.indexOf('references invalid endpoints') < relationEngine.indexOf("status === 'draft'"));
check('Relations: composition root compiles and recursively freezes once', relationComposition.includes("import graphData from '../../../data/links-graph.json'") && relationComposition.includes("import seriesData from '../../../data/series.json'") && relationComposition.includes("import catalogData from '../../../data/relations.json'") && relationComposition.includes('function deepFreeze') && (relationComposition.match(/compileRelations\(/g) || []).length === 1);
check('Relations: endpoint serves canonical singleton', relationEndpoint.includes('export const prerender = true') && relationEndpoint.includes("import compiledRelations from '../../lib/relations/compiled'") && !relationEndpoint.includes('compileRelations('));
check('Relations: projector creates semantic static navigation', projector.includes('data-relation-engine="1"') && projector.includes('removeElementsByClass') && projector.includes('compiled.projections.byNode') && projector.includes('relation-projection.json'));
check('Relations: projector is idempotent and removes obsolete runtime', projector.includes("removeElementsByClass(updated, 'gb-relations-panel')") && projector.includes("rm(join(DIST, 'js', 'relationship-panel.js')"));
check('Relations: native article layout excludes legacy site monolith', baseLayout.includes("includeLegacySiteScript = ogType !== 'article'") && baseLayout.includes("...(includeLegacySiteScript ? [assetUrl('js/site.js')] : [])"));
check('Relations: print output hides navigation panel', /@media\s+print[\s\S]*\.gb-relations-panel/.test(relationshipCss));
check('Postbuild: only Atlas browser runtime is materialized', postbuild.includes("source: 'src/runtime/atlas-runtime.js'") && !postbuild.includes("source: 'src/runtime/relationship-panel.js'") && !postbuild.includes('injectRelationshipAssets'));
check('Postbuild: relation projector is a fail-closed phase', postbuild.includes('project-relations-to-dist.mjs') && postbuild.includes('spawnSync') && postbuild.includes('Relation projector failed'));

check('Atlas: SSR, no-JS and endpoint share immutable composition root', atlasBody.includes("import compiledRelations from '../../lib/relations/compiled'") && atlasNoScript.includes("import compiledRelations from '../../lib/relations/compiled'") && relationEndpoint.includes("import compiledRelations from '../../lib/relations/compiled'") && !atlasBody.includes('compileRelations(') && !atlasNoScript.includes('compileRelations('));
check('Atlas: runtime no longer fetches raw graph/series', !atlasRuntime.includes('/data/links-graph.json') && !atlasRuntime.includes('/data/series.json') && atlasRuntime.includes('function assertCompiled'));
check('Atlas: runtime is fail-closed and never sanitizes a damaged graph into partial truth', atlasRuntime.includes('node stats mismatch') && atlasRuntime.includes('edge stats mismatch') && atlasRuntime.includes('duplicate edge semantic') && atlasRuntime.includes('function recover') && !atlasRuntime.includes('.innerHTML'));
check('Atlas: zoom, pan, focus, list and deep links remain', atlasRuntime.includes("svg.addEventListener('wheel'") && atlasRuntime.includes("svg.addEventListener('pointerdown'") && atlasRuntime.includes('function focusNode') && atlasRuntime.includes('function setView') && atlasRuntime.includes("params.get('focus')") && atlasRuntime.includes("window.addEventListener('popstate'"));
check('Atlas: keyboard graph and search navigation are native contracts', atlasRuntime.includes('function nearestNode') && atlasRuntime.includes('function handleNodeKeyboard') && atlasRuntime.includes('function moveSearchCursor') && atlasRuntime.includes("event.key === 'ArrowDown'"));
check('Atlas: deterministic desktop and compact layouts are first-class profiles', atlasRuntime.includes('DESKTOP_WORLD') && atlasRuntime.includes('COMPACT_WORLD') && atlasRuntime.includes('function relayoutForViewport') && atlasRuntime.includes("app.dataset.layoutProfile = profile.id"));
check('Atlas: detail rail consumes desktop grid only during focus', atlasStyles.includes('--atlas-detail-track:0px') && atlasStyles.includes('.atlas-app.has-detail{--atlas-detail-track:var(--atlas-detail)}') && atlasRuntime.includes("app.classList.add('has-detail')") && atlasRuntime.includes("app.classList.remove('has-detail')"));
check('Atlas: strict-native route has no old MapBody or set:html', atlasRoute.includes("import AtlasBody from '@/components/map/AtlasBody.astro'") && !atlasRoute.includes('MapBody') && !atlasBody.includes('set:html') && !fs.existsSync(path.join(ROOT, 'src/components/map/MapBody.astro')));

function relationImportsOutsideComposition(dir) {
  const offenders = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) offenders.push(...relationImportsOutsideComposition(file));
    else if (/\.(astro|ts|tsx)$/.test(entry.name)) {
      const relative = path.relative(ROOT, file).replace(/\\/g, '/');
      if (relative === 'src/lib/relations/compiled.ts') continue;
      if (fs.readFileSync(file, 'utf8').includes('compileRelations(')) offenders.push(relative);
    }
  }
  return offenders;
}
const duplicateAstroCompilers = relationImportsOutsideComposition(path.join(ROOT, 'src'));
check('Relations: no Astro surface recompiles graph outside composition root', duplicateAstroCompilers.length === 0, duplicateAstroCompilers.join(', '));

syntaxCheck('js/reader-actions.js');
syntaxCheck('src/lib/relations/engine.mjs');
syntaxCheck('src/runtime/atlas-runtime.js');
syntaxCheck('scripts/project-relations-to-dist.mjs');
syntaxCheck('scripts/check-relations.mjs');
syntaxCheck('scripts/astro-cache-bust-postbuild.js');
const relationContract = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-relations.mjs')], { encoding: 'utf8' });
if (relationContract.stdout) process.stdout.write(relationContract.stdout);
check('Relations: real data passes compiler contracts', relationContract.status === 0, (relationContract.stderr || '').trim());

try {
  const csstree = require('css-tree');
  for (const file of ['css/site.css', 'css/floating-cluster.css', 'css/mobile-hotfix.css', 'css/series-samizdat.css', 'css/series-manuscript.css', 'css/nagornaya-mobile-toc.css', 'css/home.css', 'src/runtime/relationship-panel.css']) {
    const errors = [];
    csstree.parse(read(file), { onParseError: (error) => errors.push(error.message) });
    check('CSS AST: ' + file, errors.length === 0, errors.slice(0, 2).join(' | '));
  }
} catch (error) {
  check('CSS AST: css-tree available', false, error.message);
}

check('TTS artwork exists', fs.existsSync(path.join(ROOT, 'images/tts-artwork.svg')));
function grepImports(dir) {
  let content = '';
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) content += grepImports(file);
    else if (/\.(astro|ts|tsx)$/.test(entry.name)) content += fs.readFileSync(file, 'utf8');
  }
  return content;
}
const allSource = grepImports(path.join(ROOT, 'src'));
const orphans = fs.readdirSync(path.join(ROOT, 'src/components/article-pilots/_shared'))
  .filter((file) => file.endsWith('.astro'))
  .filter((file) => allSource.split(file.replace('.astro', '')).length - 1 === 0);
check('No orphan shared reader components', orphans.length === 0, orphans.join(', '));

console.log('');
if (fails) {
  console.error(`❌ engine:contracts — ${fails} contract(s) failed. Fix the cause; never weaken the guard.`);
  process.exit(1);
}
console.log('✅ engine:contracts — all reader, relation and Atlas contracts are intact.');
