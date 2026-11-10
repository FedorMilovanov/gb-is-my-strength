import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadBibleRegistry, normalizeBookAlias } from '../src/lib/bible-reference-core.mjs';
import { createPublicSynodalResolver } from '../src/lib/public-synodal-reference.mjs';
const require=createRequire(import.meta.url);
const corpus=require('../data/bible/public-domain-russyn.json');
const index=require('../data/scripture-search-index.json');
const registry=loadBibleRegistry();
assert.equal(corpus._meta.books,66);
assert.equal(corpus._meta.verses,31169);
assert.equal(corpus._meta.zipSHA256,'acd200046b4a4cb9bca8ca375544bc9d58ae10dc64f1862a2b7b73e225931a77');
const resolver=createPublicSynodalResolver(registry,corpus);
let yes=0,no=0,covered=0,misses=[];
for(const r of index.references){
 const result=resolver.resolve(r.label);
 if(result?.text){
   yes++;
   covered+=(r.occurrences||[]).length;
   assert(!result.text.includes('<script'));
 }else {no++;misses.push({label:r.label,count:(r.occurrences||[]).length})}
}
for(const ref of ['Бытие 1:1','Матфея 6:33','Иоанна 3:16','Луки 24:27','2 Тимофею 2:14–15']){
 const r=resolver.resolve(ref);
 assert(r?.text && r.text.length>=25,ref);
}
assert.equal(resolver.resolve('Матфея 30'),null,'invalid chapter may never receive fabricated verse');
assert(yes>=1300,'expected coverage regression');
assert(covered>=3200,'scripture occurrences should be mostly served inline');
// Verify every resolvable, same-chapter verse range against the public Synodal
// edition. A:B-C must not silently be treated as chapters A through C.
const codeById = new Map(Object.entries(corpus._meta.bookIds || {}).map(([code, id]) => [id, code]));
let checkedVerseRanges = 0;
for (const item of index.references) {
  const sourceRef = String(item.label || '').replace(/[‐-‒–—−]/g, '-');
  const parts = sourceRef.match(/^(.+?)\s+(\d{1,3}):(\d{1,3})-(\d{1,3})$/u);
  if (!parts) continue;
  const id = registry.aliasMap.get(normalizeBookAlias(parts[1]));
  const code = codeById.get(id);
  if (!code) continue;
  const [chapter, start, end] = parts.slice(2).map(Number);
  const book = corpus.books[code] || {};
  if (end < start || !book[chapter + ':' + start] || !book[chapter + ':' + end]) continue;
  const keys = Array.from({ length: end - start + 1 }, (_, i) => chapter + ':' + (start + i));
  if (keys.some(key => !book[key])) continue;
  const projected = resolver.resolve(item.label);
  assert.equal(projected?.verses, end - start + 1,
    item.label + ': incorrect verse range projection');
  checkedVerseRanges += 1;
}
assert(checkedVerseRanges >= 400, 'scripture verse-range regression coverage degraded');
for (const [ref, expected] of [
  ['Матфея 1:1–2', 2], ['Иоанна 3:16–18', 3],
  ['Бытие 1:26–28', 3], ['Иуды 14–15', 2],
  ['Матфея 4:23–5:1', 4], ['Матфея 4:23–5', 51],
]) assert.equal(resolver.resolve(ref)?.verses, expected, ref);
assert.equal(resolver.resolve('Матфея 3:1–28'), null,
  'invalid same-chapter end must not become chapter 28');
const heldCorpus = structuredClone(corpus);
heldCorpus._meta.rightsState = 'RIGHTS_UNKNOWN';
assert.throws(() => createPublicSynodalResolver(registry, heldCorpus),
  /Unapproved public Synodal source/, 'held-rights corpus must remain inaccessible');
const source=fs.readFileSync(new URL('../src/runtime/article-tooltips.js',import.meta.url),'utf8');
assert(!source.includes('biblegateway.com/passage'),'reader must not reintroduce external redirects');
const report={yes,no,coverage:Math.round(100*yes/(yes+no)*100)/100,occurrences:covered,totalOccurrences:index.references.reduce((n,r)=>n+(r.occurrences||[]).length,0),misses};
fs.mkdirSync('reports/public-synodal',{recursive:true});
fs.writeFileSync('reports/public-synodal/coverage.json',JSON.stringify(report,null,2));
console.log('PUBLIC_SYNODAL_CONTRACT',JSON.stringify({...report,misses:misses.slice(0,30)}));
