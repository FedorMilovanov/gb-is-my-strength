import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSourceChronicle as group } from './source-chronicle-model.mjs';
const a=Object.freeze({id:'a',title:'A source',role:'Announcement',boundary:'Plan, not event',url:'https://example.org/a'});
const b=Object.freeze({id:'b',title:'B source',role:'Catalogue',boundary:'Not transcript',url:'https://example.org/b'});
const c=Object.freeze({id:'c',title:'C source',role:'Account',boundary:'Not independent record',url:'https://example.org/c'});
const sel=[{years:[2011,2014],title:'Early sources',rows:[{id:'a',year:2011},{id:'b',year:2014}]},{years:[2018],title:'Later sources',rows:[{id:'c',year:2018}]}];
test('explicit chronological grouping retains exact original source objects',()=>{
 const result=group([c,a,b],sel);
 assert.deepEqual(result.map(x=>x.rows.map(y=>y.source.id)),[['a','b'],['c']]);
 assert.equal(result[0].rows[0].source,a);
 assert.equal(result[1].rows[0].source,c);
 assert.equal(result[0].rows[1].source.boundary,'Not transcript');
 assert.equal(result[0].label,'2011, 2014');
});
test('omitted source not silently included',()=>assert.equal(group([a,b,c],sel.slice(0,1)).flatMap(x=>x.rows).length,2));
test('equal source years allowed',()=>assert.equal(group([a,b], [{years:[2011],title:'Two sources',rows:[{id:'a',year:2011},{id:'b',year:2011}]}])[0].rows.length,2));
for(const [name,sources,selection] of [
 ['empty selection',[a,b,c],[]],['duplicate authority',[a,a,b,c],sel],['missing source',[a,b],sel],
 ['missing boundary',[a,b,{...c,boundary:''}],sel],['nonHTTPS',[a,b,{...c,url:'http://example.org'}],sel],
 ['credentials',[a,b,{...c,url:'https://user:pass@example.org'}],sel],
 ['broken url',[a,b,{...c,url:'nope'}],sel],['empty group',[a,b,c],[{years:[2011],title:'Empty',rows:[]}]],
 ['overlap',[a,b,c],[sel[0],{...sel[1],years:[2014,2018]}]],
 ['duplicate selection',[a,b,c],[sel[0],{...sel[1],rows:[{id:'a',year:2018}]}]],
 ['reversed years',[a,b,c],[sel[1],sel[0]]],
 ['invalid year',[a,b,c],[{...sel[0],rows:[{id:'a',year:2011.5}]}]],
 ['empty group title',[a,b,c],[{...sel[0],title:' '}]]
])test(name,()=>assert.throws(()=>group(sources,selection)));
test('reject caller-provided misleading label',()=>assert.throws(()=>group([a,b,c],[{...sel[0],label:'2011–2014'}])));
test('reject out-of-period 2021',()=>assert.throws(()=>group([a,b,c],[{...sel[0],rows:[{id:'a',year:2021}]}])));
test('reject out-of-period 9999',()=>assert.throws(()=>group([a,b,c],[{...sel[0],rows:[{id:'a',year:9999}]}])));
test('reject unrepresented declared year',()=>assert.throws(()=>group([a,b,c],[{...sel[0],years:[2011,2012,2014]}])));
test('reject reversed declared years',()=>assert.throws(()=>group([a,b,c],[{...sel[0],years:[2014,2011]}])));
test('reject duplicate declared years',()=>assert.throws(()=>group([a,b,c],[{...sel[0],years:[2011,2011,2014]}])));

// Missing array entries must not disappear through sparse Array.map/some.
test('reject entirely sparse selection',()=>assert.throws(()=>group([a,b,c],Array(1))));
test('reject missing group after valid group',()=>assert.throws(()=>group([a,b,c],[sel[0],,])));
test('reject missing row after valid row',()=>assert.throws(()=>group([a,b,c],[{...sel[0],rows:[...sel[0].rows,,]}])));
test('reject missing selected year',()=>assert.throws(()=>group([a,b,c],[{...sel[0],years:[...sel[0].years,,]}])));
