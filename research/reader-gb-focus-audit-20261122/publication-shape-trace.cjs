// Read-only evidence generator: use Product's real config/projection functions.
// Not a second TOC parser, state store or runtime. Run from any working directory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const product=path.resolve(process.env.PRODUCT_ROOT||'.');
const output=path.resolve(process.env.OUTPUT_DIR||'/tmp/publication-shape-trace');
const req=createRequire(path.join(product,'package.json')),ts=req('typescript');
require.extensions['.ts']=(mod,filename)=>{const source=fs.readFileSync(filename,'utf8');const result=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});mod._compile(result.outputText,filename);};
const dir=path.join(product,'src/components/article-pilots/_shared/series');
const core=require(path.join(dir,'seriesConfig.ts'));
const projection=require(path.join(dir,'readerTocProjection.ts'));
const families=[['seriesConfig.ts','GILL_SERIES'],['baptistSeriesConfig.ts','BAPTIST_SERIES'],['hardTextsSeriesConfig.ts','HARD_TEXTS_SERIES'],['genesis6SeriesConfig.ts','GENESIS6_SERIES'],['pastorSeriesConfig.ts','PASTOR_SERIES'],['apostasySeriesConfig.ts','APOSTASY_SERIES'],['teenSeriesConfig.ts','TEEN_DOUBLE_LIFE_SERIES']];
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children)]),rows=[],checks=[];
const check=(label,run)=>{run();checks.push({label,pass:true});};
for(const [file,symbol] of families){
 const cfg=require(path.join(dir,file))[symbol],before=JSON.stringify(cfg);
 for(const pageId of Object.keys(cfg.pages)){
  const tree=projection.projectSeriesReaderToc(cfg,pageId),nodes=flatten(tree.nodes),page=cfg.items.find(x=>x.id===pageId),current=nodes.find(x=>x.key===tree.currentPageKey),chapter=core.chapterOf(cfg,pageId),satellite=page.tier==='satellite';
  check(cfg.seriesId+'/'+pageId+' preserves canonical identity and active-only hydration',()=>{
   assert.equal(tree.actualPageId,pageId);assert.ok(current);assert.equal(tree.activePath.at(-1),current.key);
   assert.equal(nodes.filter(n=>n.kind==='heading').length,satellite?0:cfg.pages[pageId].partToc.length);
   assert.equal(new Set(nodes.map(n=>n.key)).size,nodes.length);
   if(chapter)assert.equal(tree.activePath[0],'series:'+cfg.seriesId+':chapter:'+chapter.id);
   if(satellite){assert.equal(tree.satellitePageId,pageId);assert.equal(current.key,'series:'+cfg.seriesId+':page:'+page.parent);}
  });
  rows.push({seriesId:cfg.seriesId,structure:cfg.shape==='book'?'book':'flat-series',pageId,href:page.href,chapterId:chapter?.id||null,satelliteParent:satellite?page.parent:null,actualPageId:tree.actualPageId,currentPageKey:tree.currentPageKey,activePath:tree.activePath,activeHeadingCount:nodes.filter(n=>n.kind==='heading').length,rootKinds:tree.nodes.map(n=>n.kind),coreStep:core.coreStepMeta(cfg,pageId),previewPath:tree.activePath.map(key=>nodes.find(n=>n.key===key)?.label)});
 }
 check(cfg.seriesId+' source config unchanged',()=>assert.equal(JSON.stringify(cfg),before));
}
const toc=require(path.join(product,'src/components/article-pilots/hermenevtika/hermenevtikaToc.ts')).HERMENEVTIKA_TOC;
const route='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const headings=toc.map(t=>({id:decodeURIComponent(t.href.slice(1)),label:t.label,level:t.level}));
const standalone=projection.projectStandaloneReaderToc(route,headings),standaloneNodes=flatten(standalone);
check('Real standalone authored TOC stays heading-only without invented series/chapter',()=>{assert.equal(standaloneNodes.length,toc.length);assert.ok(standaloneNodes.every(n=>n.kind==='heading'));assert.deepEqual(standaloneNodes.map(n=>n.href),toc.map(n=>route+n.href));});
// Negative guards exercise Product validators; no fixtures are installed in Product.
const book=require(path.join(dir,'baptistSeriesConfig.ts')).BAPTIST_SERIES;
const chapter=book.items.find(x=>x.tier==='chapter');
check('Structural chapter cannot be selected as an invented published article',()=>assert.throws(()=>projection.projectSeriesReaderToc(book,chapter.id),/published series article/));
check('Book cannot silently be flattened by removing shape',()=>assert.throws(()=>core.defineSeriesConfig({...book,shape:undefined}),/shape/));
check('Flat series cannot become book by changing label alone',()=>assert.throws(()=>core.defineSeriesConfig({...core.GILL_SERIES,shape:'book'}),/глав/));
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'publication-trace.json'),JSON.stringify({sha:process.env.PRODUCT_SHA||'unspecified',scope:'source-only real configs + real authored standalone TOC; not rendered/browser/runtime/visual proof',checks,rows,standalone:{route,headings:standaloneNodes}},null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,pass:checks.length,seriesPages:rows.length,standaloneHeadings:standaloneNodes.length,structures:[...new Set(rows.map(r=>r.structure))],families:families.length},null,2));
