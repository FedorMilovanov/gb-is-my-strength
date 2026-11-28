#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildReaderSemanticSnapshot,
  normalizeReaderSemanticRoute,
  READER_SEMANTIC_SNAPSHOT_VERSION,
} from '../src/lib/reader-semantic-snapshot.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const index=JSON.parse(fs.readFileSync(path.join(root,'data/scripture-search-index.json'),'utf8'));
const inIndex=(route)=>new Set([route]);
const get=(route)=>buildReaderSemanticSnapshot({route,referenceIndex:index,eligibleRoutes:inIndex(route)});
assert.equal(READER_SEMANTIC_SNAPSHOT_VERSION,1);
assert.equal(normalizeReaderSemanticRoute('/articles/example'),'/articles/example/');
for (const s of ['https://other.test/articles/x/','//other.test/articles/x/','/articles/a/?opt=1','/articles/../x/','/articles/./x/','/articles/x#label',
  '/articles/%2e%2e/nagornaya/chast-1/','/articles/%2E%2E/nagornaya/',
  '/articles/x%2fy/','/articles/x%5Cy/','/articles/%25x/',
  null])
  assert.equal(normalizeReaderSemanticRoute(s),null,'unsafe route: '+s);
for (const route of ['/nagornaya/chast-1/','/novosti/item/','/Novosti/item/',
  '/updates/','/journal/','/news/','/g3/']) {
  const x=get(route);
  assert.equal(x.status,'excluded-owner',route);
  assert.equal(x.mentions.length,0);
}
assert.equal(buildReaderSemanticSnapshot({route:'/articles/x/',referenceIndex:index}).status,'unapproved-route');
// An intentionally overbroad caller allowlist must never override an
// independent NEWS/Journal/Nagornaya owner or an encoded path alias.
for (const alias of ['/novosti/item/','/Novosti/item/']) {
  assert.equal(buildReaderSemanticSnapshot({route:alias,referenceIndex:index,
    eligibleRoutes:new Set([alias])}).status,'excluded-owner',alias);
}
for (const alias of ['/articles/%2e%2e/nagornaya/chast-1/','/articles/a%2fb/']) {
  assert.equal(buildReaderSemanticSnapshot({route:alias,referenceIndex:index,
    eligibleRoutes:new Set([alias])}).status,'invalid-route',alias);
}
assert.equal(buildReaderSemanticSnapshot({route:'/articles/x/',referenceIndex:{},eligibleRoutes:inIndex('/articles/x/')}).status,'index-unavailable');

const cross='/articles/podrostok-za-kadrom-dvoynaya-zhizn/';
const snap=get(cross);
assert.equal(snap.version,1);
assert.equal(snap.route,cross);
assert.equal(snap.domParity,'not-measured');
const crossRefs=snap.mentions.filter(m=>m.provenance.originalRaw==='1 Ин. 1:5–2:2');
assert.equal(crossRefs.length,2,'two source occurrence witnesses must survive');
assert.ok(crossRefs.every(x=>x.canonical.id==='1ioanna:1:5–2:2' && x.canonical.key==='1:5–2:2'));
assert.ok(snap.mentions.some(x=>x.provenance.originalRaw==='1 Ин. 1:7–2:2'&&x.canonical.key==='1:7–2:2'));
assert.ok(snap.mentions.every(x=>x.provenance.sourceOwner&&x.verifiedDomPosition===null&&x.rangeSelector===null&&!x.canNavigateToOccurrence));
assert.ok(snap.counts.sourceWitnesses>=2);
assert.equal(snap.counts.verifiedDomOccurrences,0);
assert.ok(Object.isFrozen(snap)&&Object.isFrozen(snap.counts)&&Object.isFrozen(snap.mentions));
assert.ok(snap.mentions.every(x=>Object.isFrozen(x)&&Object.isFrozen(x.canonical)&&Object.isFrozen(x.provenance)));

const gill=get('/articles/dzhon-gill-chast-4-ekzeget/');
const john=gill.mentions.filter(m=>m.canonical.id==='ioanna:3:16');
assert.ok(john.length>=2,'distinct published Gill source witnesses must not be deduplicated by Bible ID');
assert.ok(new Set(john.map(m=>m.provenance.indexAnchorUnverified)).size>=2,
  'source index may contain different anchors for a repeated verse');
assert.ok(john.every(m=>m.verifiedSection===null),'index anchor alone must not be promoted to verified DOM section');

const fixture={schemaVersion:1,references:[
 {id:'ioanna:3:16',bookId:'ioanna',key:'3:16',kind:'verse',label:'Иоанна 3:16',occurrences:[
  {url:'/articles/fixture/',raw:'Ин. 3:16',sourceOwner:'src/first.mdx',anchor:'sec-first',context:'Свидетельство один'},
  {url:'/articles/fixture/',raw:'Ин. 3:16',sourceOwner:'src/first.mdx',anchor:'sec-second',context:'Свидетельство два'},
  {url:'/articles/fixture/',raw:'Ин. 3:16',sourceOwner:'',context:'Missing owner'},
  {url:'/articles/another/',raw:'Ин. 3:16',sourceOwner:'src/another.mdx'},
 ]},
 {id:'unknown:1',bookId:'unknown',key:'1',occurrences:[
  {url:'/articles/fixture/',raw:'',sourceOwner:'src/first.mdx'}
 ]},
]};
const fixtureBefore=JSON.stringify(fixture);
const f=buildReaderSemanticSnapshot({route:'/articles/fixture/',referenceIndex:fixture,eligibleRoutes:new Set(['/articles/fixture/'])});
assert.equal(JSON.stringify(fixture),fixtureBefore,'pure factory must not mutate the input');
assert.equal(f.counts.sourceWitnesses,2);
assert.equal(f.counts.uniqueCanonicalReferences,1);
assert.equal(f.counts.rejectedIncompleteWitnesses,2);
assert.equal(f.mentions.length,2);
assert.notEqual(f.mentions[0].ordinal,f.mentions[1].ordinal);
assert.ok(f.mentions.every(m=>m.canNavigateToOccurrence===false&&m.rangeSelector===null));
const empty=buildReaderSemanticSnapshot({route:'/articles/fixture/',referenceIndex:{schemaVersion:1,references:[]},eligibleRoutes:new Set(['/articles/fixture/'])});
assert.equal(empty.status,'source-index-empty-unverified','absence of index must not claim article has no Scripture');
const denied=buildReaderSemanticSnapshot({route:'/articles/another/',referenceIndex:fixture,eligibleRoutes:new Set(['/articles/fixture/'])});
assert.equal(denied.status,'unapproved-route');
assert.equal(denied.mentions.length,0);
console.log('Reader Semantic Snapshot W80: source provenance, cross-chapter, duplicates, fail-closed routes, immutable and unverified coordinates PASS.');
