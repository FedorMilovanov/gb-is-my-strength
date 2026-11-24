import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const repoModel=new URL('../../../src/components/journal/g3-graphics/finance-model.mjs',import.meta.url);
const {financeModel}=await import(existsSync(repoModel)?repoModel.href:new URL('./finance-model.mjs',import.meta.url).href);
const m=financeModel({total:1061800,conferences:817283,advertising:246511});
assert.equal(m.residual,-1994);
assert.equal(m.rows.slice(0,3).reduce((a,b)=>a+b.value,0),m.rows[3].value);
assert.ok(Math.abs(m.rows[2].height-Math.abs(m.rows[2].start-m.rows[2].end)*230/1200000)<1e-10);
for(const [total,conferences,advertising] of [[100,10,10],[100,40,60],[100,70,60]]){const x=financeModel({total,conferences,advertising});assert.equal(x.rows.slice(0,3).reduce((a,b)=>a+b.value,0),total);assert.ok(x.rows.every(r=>r.height>=0&&Number.isFinite(r.height)));}
for(const input of [{total:0,conferences:1,advertising:1},{total:100,conferences:-1,advertising:2},{total:100.5,conferences:1,advertising:1},{total:100,conferences:NaN,advertising:1}])assert.throws(()=>financeModel(input));
console.log('finance model: arithmetic, signed residual, exact-scale tolerance and invalid inputs PASS');
