// Source-only owner map. Existing registry resolves routes; snippets are evidence,
// not a replacement import resolver, TOC parser, or browser-readiness detector.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(process.env.PRODUCT_ROOT||'.'),output=path.resolve(process.env.OUTPUT_DIR||'/tmp/panel-owner-map');
process.chdir(root);
const registry=require(path.join(root,'scripts/lib/public-surface-registry.js')).buildPublicSurfaceRegistry();
assert.deepEqual(registry.errors,[]);
const routes=[
 '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
 '/articles/dzhon-gill-chast-2-uchenyi/',
 '/baptisty-rossii/noch-na-kure/',
 '/hard-texts/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom/'
];
const entries=routes.map(route=>{const entry=registry.entries.find(x=>x.route===route);assert.ok(entry,route);return entry;});
const evidence=[];
function anchor(id,file,needle){const bytes=fs.readFileSync(path.join(root,file)),text=bytes.toString('utf8'),at=text.indexOf(needle);assert.ok(at>=0,id+' baseline changed; re-audit');const line=text.slice(0,at).split('\n').length;const lines=text.split('\n');evidence.push({id,file,line,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),excerpt:lines.slice(Math.max(0,line-2),line+3).join('\n')});}
anchor('single-rail-composition','src/components/article-pilots/hermenevtika/HermenevtikaRail.astro','<ReaderRail ');
anchor('single-projection','src/components/article-pilots/hermenevtika/HermenevtikaRail.astro','projectStandaloneReaderToc(');
anchor('series-single-quiz','src/components/article-pilots/_shared/series/SeriesReaderChrome.astro','<GillAnalyticsStudy ');
anchor('series-native-left','src/components/article-pilots/_shared/series/SeriesReaderChrome.astro','<GillSeriesRail ');
anchor('canonical-heading-model','src/components/article-pilots/_shared/series/readerTocProjection.ts','export interface ReaderTocNode');
anchor('satellite-actual-identity','src/components/article-pilots/_shared/series/readerTocProjection.ts','actualPageId: activePageId');
anchor('single-state-subscription','src/components/article-pilots/_shared/ReaderRail.astro','readerState.subscribe(');
anchor('series-state-subscription','js/floating-cluster-controller.js','readerState.subscribe(renderReaderState)');
anchor('reading-key','js/reader-state.js','return STORAGE_PREFIX + getSiteId()');
anchor('native-panel-owners','js/floating-cluster-controller.js',"partTocOverlay: 'gill-part-toc'");
anchor('single-modal-owner','src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro',"OVERLAY_OWNER = 'hermenevtika-toc'");
anchor('single-overlay-api','js/site-utils.js',"Object.defineProperty(window, 'OverlayRuntime'");
anchor('quiz-session-key','src/runtime/reader-analytics-study.js',"const sessionKey='gb-reader-study-v1:'+location.pathname");
anchor('quiz-host-move','src/runtime/reader-analytics-study.js','function moveTo(host)');
anchor('quiz-desktop-host','src/runtime/reader-analytics-study.js',"v.research.querySelector('.np-u-right-scroll')");
anchor('legacy-toc-collapse-key','js/floating-cluster-controller.js',"var TOC_KEY = 'gb:rail:toc-collapsed'");
anchor('preview-model-inspection','research/reader-w57-pilot/assets/reader_universal_preview.js','const model=c.inspect(document)');
anchor('preview-kind-heuristic','research/reader-w57-pilot/assets/reader_universal_contract.js',"if(/^\\/baptisty-rossii\\//.test(path))return 'series-chapter'");
anchor('preview-grouping','research/reader-w57-pilot/assets/reader_universal_contract.js','const groupLimit=');
anchor('preview-research-follow-geometry','research/reader-w57-pilot/assets/reader_universal_preview.js','function currentGroupIndex()');
anchor('preview-follow-scroll-listener','research/reader-w57-pilot/assets/reader_universal_preview.js',"addEventListener('scroll',()=>{if(!browserStore.frame)");
anchor('preview-research-fold','research/reader-w57-pilot/assets/reader_universal_preview.js','const setRightOpen=');
anchor('continue-close-only','src/components/article-pilots/gill-series/GillPartTocOverlay.astro',"cont.addEventListener('click', closeOverlay)");
anchor('listen-native-breakpoint','src/components/article-pilots/gill-series/GillPartTocOverlay.astro',"window.matchMedia('(min-width: 85em)')");
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'owner-map.json'),JSON.stringify({sha:process.env.PRODUCT_SHA||'unspecified',scope:'source/import-graph only; no rendered DOM, state convergence, production W57 or browser proof',routes:entries,evidence},null,2)+'\n');
console.log(JSON.stringify({routes:entries.length,sourceAnchors:evidence.length,registryErrors:registry.errors.length},null,2));
