import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSourceChronicle as group } from './source-chronicle-model.mjs';
const a=Object.freeze({id:'a',title:'A source',role:'Announcement',boundary:'Plan, not event',url:'https://example.org/a'});
const b=Object.freeze({id:'b',title:'B source',role:'Catalogue',boundary:'Not transcript',url:'https://example.org/b'});
const c=Object.freeze({id:'c',title:'C source',role:'Account',boundary:'Not independent record',url:'https://example.org/c'});
const sel=[{label:'2011–2014',title:'Early sources',rows:[{id:'a',year:2011},{id:'b',year:2014}]},{label:'2018',title:'Later sources',rows:[{id:'c',year:2018}]}];
test('explicit chronological grouping retains exact original source objects',()=>{
 const result=group([c,a,b],sel);
 assert.deepEqual(result.map(x=>x.rows.map(y=>y.source.id)),[['a','b'],['c']]);
 assert.equal(result[0].rows[0].source,a);
 assert.equal(result[1].rows[0].source,c);
 assert.equal(result[0].rows[1].source.boundary,'Not transcript');
});
test('omitted source not silently included',()=>assert.equal(group([a,b,c],sel.slice(0,1)).flatMap(x=>x.rows).length,2));
test('equal source years allowed',()=>assert.equal(group([a,b], [{label:'2011',title:'Two sources',rows:[{id:'a',year:2011},{id:'b',year:2011}]}])[0].rows.length,2));
for(const [name,sources,selection] of [
 ['empty selection',[a,b,c],[]],['duplicate authority',[a,a,b,c],sel],['missing source',[a,b],sel],
 ['missing boundary',[a,b,{...c,boundary:''}],sel],['nonHTTPS',[a,b,{...c,url:'http://example.org'}],sel],
 ['credentials',[a,b,{...c,url:'https://user:pass@example.org'}],sel],
 ['broken url',[a,b,{...c,url:'nope'}],sel],['empty group',[a,b,c],[{label:'x',title:'Empty',rows:[]}]],
 ['duplicate label',[a,b,c],[sel[0],{...sel[1],label:sel[0].label}]],
 ['duplicate selection',[a,b,c],[sel[0],{...sel[1],rows:[{id:'a',year:2018}]}]],
 ['reversed years',[a,b,c],[sel[1],sel[0]]],
 ['invalid year',[a,b,c],[{...sel[0],rows:[{id:'a',year:2011.5}]}]],
 ['empty group title',[a,b,c],[{...sel[0],title:' '}]]
])test(name,()=>assert.throws(()=>group(sources,selection)));
