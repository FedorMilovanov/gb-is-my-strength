import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'MANIFEST.json'), 'utf8'));
assert.equal(manifest.files.length, 12, 'W57 source owner count');
for (const file of manifest.files) {
  const bytes = readFileSync(join(root, 'assets', file.name));
  assert.equal(bytes.length, file.bytes, file.name + ' length changed');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256,
    file.name + ' differs from accepted local W57');
}
const require = createRequire(import.meta.url);
const { isDesktopReaderRoute, buildDesktopReaderContract } = require('../../scripts/lib/reader-desktop-contract');
const accepted = { route:'/articles/example/', owner:'astro', status:'production-dist', routeRole:'reading', settingsCapability:'reader-ui' };
assert.equal(isDesktopReaderRoute(accepted), true);
for (const patch of [
  {route:'/nagornaya/example/'},{route:'/journal/example/'},{route:'/updates/example/'},
  {route:'/news/example/'},{route:'/novosti/example/'},{routeRole:'landing'},{routeRole:'reference'},
  {owner:'built-app'},{status:'build-only'},{settingsCapability:'none'},
]) assert.equal(isDesktopReaderRoute({...accepted,...patch}), false, JSON.stringify(patch));
const desktopContract = buildDesktopReaderContract();
assert.equal(desktopContract.routes.filter(route=>route.startsWith('/hard-texts/')).length, 7);
for(const route of ['/hard-texts/','/hard-texts/genesis-6/','/articles/','/baptisty-rossii/','/nagornaya/chast-1/','/journal/dossiers/g3/'])
  assert.ok(!desktopContract.routes.includes(route), 'protected route: '+route);
assert.deepEqual([...desktopContract.styles,...desktopContract.scripts], manifest.files, 'one ordered manifest owner');
assert.deepEqual(desktopContract.styles.map(asset=>asset.name), [
  'reader_universal_preview.css','reader_argon_first.css','reader_editorial_refinement.css',
  'reader_editorial_consolidation.css','reader_editorial_w51.css','reader_w57.css',
], 'approved stylesheet cascade order');
assert.deepEqual(desktopContract.scripts.map(asset=>asset.name), [
  'reader_universal_contract.js','reader_universal_preview.js','reader_editorial_refinement.js',
  'reader_editorial_consolidation.js','reader_w57.js','reader_w57_annotations.js',
], 'approved desktop runtime dependency order');
const css = readFileSync(join(root, 'assets', 'reader_w57.css'), 'utf8');
const js = readFileSync(join(root, 'assets', 'reader_w57.js'), 'utf8');
const annotations = readFileSync(join(root, 'assets', 'reader_w57_annotations.js'), 'utf8');
const shell = readFileSync(join(root, 'preview.py'), 'utf8');
const preview = readFileSync(join(root, 'assets', 'reader_universal_preview.js'), 'utf8');
const semanticContract=readFileSync(join(root,'assets','reader_universal_contract.js'),'utf8');
const argonCss=readFileSync(join(root,'assets','reader_argon_first.css'),'utf8');
assert.ok(semanticContract.includes("version:'1.1.0',articleRoot,inspect"),
 'contract must export single source-article resolver');
assert.ok(preview.includes('const readerState=window.ReaderState'), 'pilot must consume canonical ReaderState');
assert.match(preview,/readerState\.subscribe\(updateScroll/, 'pilot follow state must subscribe to core');
assert.doesNotMatch(preview,/innerHeight\s*\*\s*\.3\b|browserStore\.frame/, 'no independent W57 scrollspy');
assert.ok(preview.includes('if(!event.persisted)unsubscribeReadingState()'), 'BFCache keeps the presenter subscription');
assert.ok(preview.includes('const article=c.articleRoot(document)'),
 'preview must use the same source root as annotations');
assert.ok(preview.includes("article.setAttribute('data-reader-projection','')"),
 'pilot must mark its selected actual article');
assert.ok(annotations.includes("GBReaderContract?.articleRoot?.(document)"),
 'annotations must reuse contract source root');
assert.ok(argonCss.includes('article[data-reader-projection]'),
 'typography and geometry must target semantic article projection');
assert.ok(css.includes('article[data-reader-projection]'),
 'W57 measure styles must target semantic article projection');
assert.match(preview, /const initiallyFolded=previewPanel!=='open'/,
  'right research panel must start folded on desktop by default');
assert.match(preview, /const previewPanel=new URLSearchParams\(location\.search\)\.get\('panel'\)/,
  'explicit preview-state deep link owner required');
assert.match(preview, /let manualRightChoice=!isMobile\(\)&&\['open','closed'\]\.includes\(previewPanel\)/,
  'panel=open/closed deep links must override width defaults on desktop');

assert.match(css, /W57 VISUAL CLOSURE 2026-11-20/, 'source alignment wave absent');
assert.match(css, /premium left reading settings/, 'left settings popup missing');
assert.doesNotMatch(js, /npW57ReadingDetails|fontPanel\.addEventListener\('click'/, 'no second settings owner/right card');
assert.doesNotMatch(preview, /fontPanel\.closest\('#npW57ReadingDetails'\)/, 'left Escape/outside close must be operative');
assert.match(preview, /data-np-u-type-width="narrow"/, 'narrow width missing');
assert.match(preview, /data-np-u-scale-range type="range" min="85" max="125" step="5"/, 'exact canonical font scale required');
assert.doesNotMatch(preview, /data-np-u-type-size=/, 'no approximate four-step selector');
assert.match(js, /Math.round\(v.fontScale\*100\)/, 'actual stored font scale must be displayed');
assert.match(preview, /input:not\(\[disabled\]\),summary/, 'range and sample disclosure belong in settings keyboard focus loop');
assert.match(js, /width:v\.measure==='narrow'\?'narrow'/, 'narrow persisted state mismatches');
assert.match(preview, /one top-level right research card at a time/, 'exclusive right cards missing');
assert.match(preview, /openResearchForAnnotation\(\)/,'right research owner must expose opening action');
assert.match(preview, /positionFontPanel\(\)/, 'font popup must have breakpoint-aware modal ownership');
assert.match(preview, /syncFontDialog\(open\)/, 'mobile font settings own their dialog layer');
assert.match(preview, /priorInert=new Map\(\)/, 'restore native controls original inert state on close');
assert.match(css, /#npUFontScrim:not\(\[hidden\]\)/, 'background must be inert and visibly covered');
assert.doesNotMatch(preview, /np-u-argon-reading-v1|applyReaderTypography\(/, 'pilot must not have a second font state owner');
assert.match(preview, /canon\.set\(patch,\{source:'argon-w57-left-settings'\}\)/,
 'settings must commit to the canonical API');
assert.match(preview, /querySelector\('#npUOutline'\):root/, 'mobile TOC dialog must contain its focused popup');
assert.doesNotMatch(preview, /root\.append\(fontPanel\)/, 'no unconditional out-of-modal popup');
assert.match(preview, /closeResearchForAnnotation\(\)/,'right research owner must expose closing action');
assert.match(css, /np-w57-note-actions/, 'note cancel/confirm row missing');
assert.match(css, /np-w57-note-preview-text/, 'linked note preview style missing');
assert.match(annotations, /pendingRecolorId=id/, 'saved-quote palette selection must use a single mode');
assert.match(annotations, /palette\.addEventListener\('keydown'/, 'Escape must cancel pending recolor');
assert.doesNotMatch(annotations, /colors\[\(colors\.indexOf\(/, 'do not silently cycle color on click');
assert.match(annotations, /const existingNote=linkedNote\(record\)/, 'saved notes must be shown next to their excerpts');
assert.ok(annotations.includes('repaint();\n      say(result.message);'), 'successful note changes must refresh immediately');
assert.match(annotations, /Мягкий лаймовый/, 'palette label must describe toned-down citron');
assert.ok(preview.includes('event.preventDefault();event.stopImmediatePropagation();'),
  'Escape must only dismiss the settings popup, without closing mobile TOC');
assert.ok(preview.includes("if(event.key==='Tab'){"),
  'Tab must remain in the active settings popup');
assert.ok(preview.includes('if(isMobile()&&!fontPanel.hidden)setFontOpen(false);'),
  'Mobile panel close must not leave the settings popup visible');
assert.match(css, /right:calc\(5vw - 2px\)!important/,
  'fold SVG and Library use the same right edge as the 40px reading toolbar');
assert.doesNotMatch(css, /left:calc\(var\(--np-w57-axis-x/,
  'do not mix vw-based left position with right-aligned native controls');
assert.doesNotMatch(js, /setProperty\('--np-w57-axis-x'/,
  'no obsolete JS left-axis that ignores classic vertical scrollbar width');
assert.doesNotMatch(js, /ResizeObserver\(schedule\)/, 'avoid per-frame toggle-derived geometry');
assert.match(css, /W57 MOBILE LIBRARY PLAIN SVG 2026-11-20/, 'unframed mobile book required');
assert.match(css, /W57 mobile FAB source specificity: 2026-11-20/, 'two-ID legacy mobile plate must be overridden');
assert.match(css, /W57 SINGLE COLUMN 2026-11-20/, 'fold button and divider must share reading actions axis');
assert.match(css, /W57 SERIES PLAY ON-AXIS 2026-11-20/, 'series Play circle must be centered in 40px rail');
assert.match(css, /gbs-rail-playwrap\s*>\s*\.gb-ember-wrap\s*>\s*\.gb-ember\.gbs-rail-ember\s*\{\s*left:4px!important;/, '32px Play circle should offset 4px inside 40px rail');
assert.match(css, /#npURightEdgeRail::after/, 'fold/reading-tool separator required');
assert.match(css, /#gb-hl-fab:is\(:hover,:active,:focus-visible\)/,
  'no moving or painted library hover');
assert.match(css, /#npUEdgeToggle:is\(:hover,:focus-visible,:active\)/,
  'no giant circular hover on panel fold control');
const deliverySource=readFileSync(join(root,'../../scripts/lib/reader-desktop-delivery.js'),'utf8');
assert.doesNotMatch(shell,/def do_GET|html\.replace|__reader_w57__/, 'preview must serve static Astro bytes');
assert.match(deliverySource,/reader-pilot/, 'Classic comparison is client gated');
assert.ok(deliverySource.includes('(min-width:1121px)'), 'W57 styles must never replace canonical native mobile styles');
assert.ok(deliverySource.includes('window.location.reload()'), 'desktop/mobile mode crossing must rebuild the original Product DOM');
assert.match(shell, /127\.0\.0\.1/, 'preview must bind to localhost');
assert.match(shell, /No production mutation/, 'draft-only safety banner required');
await import(new URL('../../scripts/reader-w57-annotations-regression-test.mjs', import.meta.url));
console.log('Reader W57 source/manifests/axis/pilot and annotation contracts: PASS (12 assets)');
