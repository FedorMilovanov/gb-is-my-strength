import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const json=n=>JSON.parse(read(n));
const src='../../src/components/journal/g3-visual/';
const m=json(src+'matrix-data.json'), w=json('catalog-witness.json'), f=json('finance-proposal.json'), h=json('matrix-expansion-hold.json');
const sorted=xs=>[...xs].sort();
const keys=rows=>rows.flatMap(row=>row.years.map(y=>row.id+'/'+y));
const base=keys(m.rows);
const expectedBase=Object.entries(w.years).flatMap(([y,v])=>Object.keys(v.records).map(id=>id+'/'+y));
assert.equal(m.rows.length,15);
assert.equal(new Set(m.rows.map(r=>r.id)).size,15);
assert.deepEqual(m.years,[2013,2014,2015,2016,2017,2019,2020]);
assert.equal(base.length,37);
assert.equal(new Set(base).size,37);
assert.deepEqual(sorted(base),sorted(expectedBase));
// Pinned exact H-T selection, not merely a row count. Research #632 exact 1c51adbf §14/16.
const expectedExtra={
  2018:['lawson','johnson','ascol','baucham','thomas','white','tripp','kruger','challies','miller','buice'],
  2021:['strachan','peace','aniol','coates','buck','thornton','lawson','riccardi','washer','baucham','white','johnson']
};
const wanted=Object.entries(expectedExtra).flatMap(([y,ids])=>ids.map(id=>id+'/'+y));
const extra=h.entries.map(r=>r.id+'/'+r.year);
assert.equal(h.state,'PUBLICATION_HOLD');
assert.equal(extra.length,23);
assert.equal(new Set(extra).size,23);
assert.deepEqual(sorted(extra),sorted(wanted));
const names=new Map(m.rows.map(r=>[r.id,r.name]));
for(const row of h.entries){
  assert(!m.years.includes(row.year));assert(!base.includes(row.id+'/'+row.year));
  assert(typeof row.name==='string'&&row.name.trim());
  if(names.has(row.id))assert.equal(names.get(row.id),row.name);
  else names.set(row.id,row.name);
}
const union=[...base,...extra];
assert.equal(new Set(union).size,60);
assert.equal(names.size,26);
assert.equal(new Set([...m.years,...h.entries.map(r=>r.year)]).size,9);
function checkDom(file,expected){
  const html=read(file);
  const matches=[...html.matchAll(/<a\s+id="cite-g3-matrix-([a-z0-9-]+)-(\d{4})"[^>]*\bhref="#history-source-gnl-(\d{4})"/g)];
  assert(matches.every(x=>x[2]===x[3]));
  const actual=matches.map(x=>x[1]+'/'+x[2]);
  assert.equal(new Set(actual).size,actual.length);
  assert.deepEqual(sorted(actual),sorted(expected));
  assert(html.includes(read(src+'matrix.js')));
  return html;
}
checkDom('matrix-source-return.html',base);
assert(checkDom('matrix-expanded-review.html',union).includes('PUBLICATION_HOLD'));
assert.equal(f.state,'PUBLICATION_HOLD');assert.equal(f.currency,'USD');assert.equal(f.rows.length,7);
for(const [i,r] of f.rows.entries()){
  assert.equal(r.fy,2019+i);
  for(const k of ['revenue','expenses','result','netAssets'])assert(Number.isSafeInteger(r[k]));
  assert.equal(r.revenue-r.expenses,r.result);assert(r.revenue>=0&&r.expenses>=0&&r.netAssets>=0);
}
const annual=read(src+'G3AnnualFinance.astro');
assert(annual.includes("Astro.props.reviewOnly !== true")&&annual.includes("proposal?.state !== 'PUBLICATION_HOLD'"));
assert(!annual.includes("finance-proposal.json"));
assert(annual.includes("заканчивающиеся в декабре"));
assert(!read(src+'G3SpeakerMatrix.astro').includes('matrix-expansion-hold'));
console.log('PASS: 37 base / 23 exact H-T / 60 distinct pairs / 26 names / 9 years / exact fixture IDs / 28 finance values, HOLD preserved');
