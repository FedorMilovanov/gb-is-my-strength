#!/usr/bin/env node
/**
 * W79 | Read-only Universal Reader semantic/route baseline.
 * Does NOT inject or enable the pilot product in any published route.
 * It only loads the pure W57 DOM inspector in a disposable local browser and
 * measures where the existing source index / markup have differing semantics.
 * Pass != rollout approval. Source-only mentions are not blindly equated with
 * inline button.bref tags.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildReaderSemanticSnapshot} from '../src/lib/reader-semantic-snapshot.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const dist=path.join(root,'dist');
assert(fs.existsSync(dist),'Run production-like dist build first');
const source=JSON.parse(fs.readFileSync(path.join(root,'data/scripture-search-index.json'),'utf8'));
assert(Array.isArray(source.references),'Source index not parseable');
const readerInspector=path.join(root,'research/reader-w57-pilot/assets/reader_universal_contract.js');
const OUT=process.env.READER_COVERAGE_REPORT || path.join(root,'reports/reader-universal-semantic-readiness.json');
const EXCLUDED=/^\/(?:nagornaya|novosti|journal|updates|news|g3)(?:\/|$)/i;
const APP=/^\/(?:app|map|karty|rodosloviye)(?:\/|$)/;
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=path.join(d,e.name);return e.isDirectory()?walk(f):e.isFile()&&e.name==='index.html'?[f]:[];});}
function asRoute(f){const r=path.relative(dist,path.dirname(f)).replaceAll('\\','/');return r==='.'?'/':'/'+r.replace(/^\/|\/$/g,'')+'/';}
const pages=walk(dist).map(file=>{const html=fs.readFileSync(file,'utf8'),route=asRoute(file);return {file,route,excluded:EXCLUDED.test(route),nonArticleApp:APP.test(route),
  seriesReader:/data-reader-engine="series"/.test(html),
  mobileAnalytics:html.includes('id="gbrMarginalia"'),
  semanticShape:/data-reader-shape="(?:flat|book)"/.test(html),
  readerLanding:/data-reader-landing="book"/.test(html),
  articleBody:html.includes('article-body')};});
assert(pages.length>=100,'Unexpected missing published pages');
assert(pages.every(p=>!(p.excluded&&p.seriesReader)),'Excluded route unexpectedly uses shared series reader');
const eligible=pages.filter(p=>p.seriesReader&&!p.excluded);
const eligibleSet=new Set(eligible.map(p=>p.route));
// Long-form routes without this Reader are REVIEW CANDIDATES, not approved
// targets for global injection. Preserve their independently owned layouts.
const standalone=pages.filter(p=>!p.seriesReader&&!p.excluded&&!p.nonArticleApp &&
  /^\/(?:articles|hard-texts)\/[^/]+\/$/.test(p.route));
const inspection=[...eligible.map(p=>({...p,cohort:'shared-reader'})),
  ...standalone.map(p=>({...p,cohort:'standalone-candidate'}))];
assert(eligible.length>=68,'Shared series corpus shrank unexpectedly');
assert(eligible.every(p=>p.semanticShape),'Missing semantic shape on a shared Reader page');
const byRoute=new Map();
for(const ref of source.references)for(const o of ref.occurrences||[]){
  if(!o.url)continue;
  const pathname=new URL(o.url,'http://local').pathname.replace(/\/?$/,'/');
  if(!byRoute.has(pathname))byRoute.set(pathname,{total:0,raw:new Set(),book:new Set(),sourceOwners:new Set()});
  const e=byRoute.get(pathname);e.total++;if(o.raw)e.raw.add(o.raw);if(ref.bookId)e.book.add(ref.bookId);if(o.sourceOwner)e.sourceOwners.add(o.sourceOwner);
}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
 try{const u=new URL(req.url,'http://local');let f=path.resolve(dist,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
 const rel=path.relative(dist,f);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(f)){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res);
 }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const result=[];let cursor=0;
async function worker(){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultNavigationTimeout(20000);
 while(cursor<inspection.length){
  const p=inspection[cursor++],entry=byRoute.get(p.route);
  const snapshot=buildReaderSemanticSnapshot({route:p.route,referenceIndex:source,eligibleRoutes:eligibleSet});
  let witness;
  try{
   const resp=await page.goto(base+p.route,{waitUntil:'domcontentloaded',timeout:20000});
   await page.addScriptTag({path:readerInspector});
   witness=await page.evaluate(()=>{
    const root=window.GBReaderContract.articleRoot(document),m=window.GBReaderContract.inspect(document);
    const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
    const seen=new Set(),duplicates=[];
    ids.forEach(id=>{if(seen.has(id))duplicates.push(id);seen.add(id)});
    const inline=root?[...root.querySelectorAll('button.bref[data-ref]')]:[];
    const headings=root?[...root.querySelectorAll('h2,h3,h4,h5,h6')]:[];
    return {kind:m.kind,role:m.role,supported:m.kind!=='unsupported',rootTag:root?.tagName,rootClass:root?.className||'',headings:headings.length,
     headingsWithoutId:headings.filter(h=>!h.id).length,inspectedGroups:m.groups.length,inspectedRefs:m.counts.scriptureRefs,
     buttonUses:inline.length,buttonUnique:new Set(inline.map(e=>e.dataset.ref)).size,
     duplicateIds:duplicates.slice(0,15),scriptureButtons: inline.slice(0,4).map(x=>x.dataset.ref),
     researchDOM:!!document.getElementById('gbrMarginalia'),
     readerDOM:!!document.querySelector('[data-reader-engine="series"]')};
   });
   witness.status=resp?.status()||0;
  }catch(err){witness={error:String(err).slice(0,260)};}
  result.push({route:p.route,cohort:p.cohort,sourceOccurrences:entry?.total||0,sourceDistinctRaw:entry?.raw.size||0,
    semanticSnapshot:{status:snapshot.status,witnesses:snapshot.counts.sourceWitnesses,
      uniqueCanonicalReferences:snapshot.counts.uniqueCanonicalReferences,
      incomplete:snapshot.counts.rejectedIncompleteWitnesses,domParity:snapshot.domParity,
      navigable:snapshot.mentions.filter(m=>m.canNavigateToOccurrence).length},
    sourceOwners:[...(entry?.sourceOwners||[])].slice(0,5),...witness});
 }
 await context.close();
}
try{await Promise.all(Array.from({length:4},()=>worker()));}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
result.sort((a,b)=>a.route.localeCompare(b.route));
const failed=result.filter(x=>x.error||x.status!==200);
// The published index is a source-only witness. Every indexed mention with
// valid provenance must survive the immutable source snapshot without DOM
// guesswork, while standalone routes must remain explicitly unapproved.
const snapshotMismatch=result.filter(x=>x.cohort==='shared-reader'
  ? x.semanticSnapshot.witnesses+x.semanticSnapshot.incomplete!==x.sourceOccurrences
  : x.semanticSnapshot.status!=='unapproved-route');
const summary={builtPages:pages.length,sharedReaderPages:eligible.length,excludedPages:pages.filter(x=>x.excluded).length,
  indexedRoutesWithCitations:byRoute.size,sourceReferences:source.references.length,sourceOccurrences:source.stats?.occurrences,
  browserChecked:result.length,sharedReaderChecked:eligible.length,standaloneCandidates:standalone.length,browserErrors:failed.length,
  snapshotIndexedWitnesses:result.filter(x=>x.cohort==='shared-reader').reduce((n,x)=>n+x.semanticSnapshot.witnesses,0),
  snapshotProvenanceMismatchPages:snapshotMismatch.length,
  withMobileAnalytics:result.filter(x=>x.cohort==='shared-reader'&&x.researchDOM).length,
  withButtonReferences:result.filter(x=>x.cohort==='shared-reader'&&x.buttonUses>0).length,
  withSourceMentions:result.filter(x=>x.cohort==='shared-reader'&&x.sourceOccurrences>0).length,
  withSourceButNoButtons:result.filter(x=>x.cohort==='shared-reader'&&x.sourceOccurrences>0 && x.buttonUses===0).length,
  duplicateDocumentIds:result.filter(x=>x.duplicateIds?.length).length,
  missingHeadingIdPages:result.filter(x=>x.headingsWithoutId>0).length};
const annotatedRoutes=[...byRoute.keys()].filter(route=>!eligible.some(e=>e.route===route));
const report={schemaVersion:1,contract:'W79-readonly-reader-semantic-readiness',head:process.env.SOURCE_SHA||null,
 intent:'audit-only; not semantic parity acceptance; source mentions and rendered buttons are different reference channels',
 exclusions:['/nagornaya/*','/updates/*','/journal/*'],summary,nonEligibleIndexedRoutes:annotatedRoutes.sort(),errors:[...failed,...snapshotMismatch],results:result};
fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:OUT,summary,errors:failed.slice(0,8),standalone:result.filter(x=>x.cohort==='standalone-candidate').map(x=>({route:x.route,headings:x.headings,refs:x.inspectedRefs,sourceOccurrences:x.sourceOccurrences,hasMobileAnalytics:x.researchDOM})),topSourceWithoutButtons:result.filter(x=>x.cohort==='shared-reader'&&x.sourceOccurrences>0&&x.buttonUses===0).sort((a,b)=>b.sourceOccurrences-a.sourceOccurrences).slice(0,10).map(x=>({route:x.route,sourceOccurrences:x.sourceOccurrences,sourceDistinctRaw:x.sourceDistinctRaw,headings:x.headings})),duplicateIds:result.filter(x=>x.duplicateIds?.length).slice(0,8).map(x=>({route:x.route,ids:x.duplicateIds}))},null,2));
if(failed.length||snapshotMismatch.length)process.exitCode=1;
