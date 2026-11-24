import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentExhibitView, documentCitationId } from '../../src/components/journal/editorial/document-exhibit-model.mjs';
// Synthetic technical fixture, never publication data.
const fixture = () => ({
 input: { id:'test-document',mode:'editorial-paraphrase',title:'Тестовый документ',issuer:'Тестовый издатель',deck:'Синтетические данные',
 documentDate:'2024-02-29',publicationDate:null,captureDate:'2025-01-01',
 sections:[{id:'a',heading:'Раздел',locator:'§ 1',summary:'Пересказ',significance:'Значение',limitation:'Не доказывает причинность',claimId:'fixture-claim',sourceId:'fixture-source'}]},
 authority:{claims:[{id:'fixture-claim',references:[{sourceId:'fixture-source',locator:'§ 1'}]}],sources:[{id:'fixture-source',href:'#source-fixture',label:'Источник'}]}
});
const view = f => documentExhibitView(f.input, f.authority);
test('dates stay distinct and unknown stays null',()=>{const f=fixture();const v=view(f);assert.equal(v.documentDate,'2024-02-29');assert.equal(v.publicationDate,null);assert.equal(v.captureDate,'2025-01-01');assert.equal(v.sections[0].citationId,'cite-13-test-document-document-a');assert.equal(v.sections[0].source.href,'#source-fixture');});
const cases=[
 ['invalid calendar', f=>f.input.documentDate='2023-02-29'],
 ['empty date', f=>f.input.documentDate=''],
 ['missing capture date', f=>delete f.input.captureDate],
 ['invalid id', f=>f.input.id='a b'],
 ['unsupported quote mode', f=>f.input.mode='quote'],
 ['missing source', f=>f.input.sections[0].sourceId='unknown'],
 ['unadmitted claim', f=>f.input.sections[0].claimId='other'],
 ['duplicate section', f=>f.input.sections.push({...f.input.sections[0]})],
 ['missing locator', f=>f.input.sections[0].locator=''],
 ['missing limitation', f=>f.input.sections[0].limitation=''],
 ['empty document', f=>f.input.sections=[]],
 ['duplicate source', f=>f.authority.sources.push({...f.authority.sources[0]})],
 ['duplicate destination', f=>f.authority.sources.push({...f.authority.sources[0],id:'other'})],
 ['unsafe href', f=>f.authority.sources[0].href='javascript:alert(1)'],
 ['wrong but registered source', f=>{f.authority.sources.push({id:'other',href:'#source-other',label:'Other'});f.input.sections[0].sourceId='other'}],
 ['wrong locator for same source', f=>f.input.sections[0].locator='§ 99'],
 ['missing claim references', f=>f.authority.claims[0].references=[]],
 ['duplicate claim reference', f=>f.authority.claims[0].references.push({...f.authority.claims[0].references[0]})],
 ['unregistered authority reference', f=>f.authority.claims[0].references[0].sourceId='other'],
 ['duplicate claim', f=>f.authority.claims.push({...f.authority.claims[0]})],
];
for (const [name, change] of cases) test(name,()=>{const f=fixture();change(f);assert.throws(()=>view(f),/Journal document exhibit/);});
test('two exhibits do not collide when caller supplies unique IDs',()=>{const a=fixture(),b=fixture();b.input.id='other-document';assert.notEqual(view(a).sections[0].citationId,view(b).sections[0].citationId);});
test('hyphenated exhibit and section IDs cannot collide',()=>assert.notEqual(documentCitationId('a-document-b','c'),documentCitationId('a','b-document-c')));

function multiple() {
  const f=fixture();
  f.authority.sources.push({id:'second',href:'#source-second',label:'Second'});
  f.authority.claims[0].references.push({sourceId:'second',locator:'§ 2'},{sourceId:'fixture-source',locator:'§ 3'});
  return f;
}
test('all admitted references survive, including two locators in the same source',()=>{
  const v=view(multiple()).sections[0];
  assert.deepEqual(v.citations.map(c=>[c.source.id,c.locator]),[['fixture-source','§ 1'],['second','§ 2'],['fixture-source','§ 3']]);
  assert.equal(v.citations[0].citationId,v.citationId);
  assert.equal(new Set(v.citations.map(c=>c.citationId)).size,3);
});
test('primary reference may be reordered but cannot drop other references',()=>{
  const f=multiple(); f.input.sections[0].sourceId='second'; f.input.sections[0].locator='§ 2';
  const v=view(f).sections[0];assert.deepEqual(v.citations.map(c=>c.locator),['§ 2','§ 1','§ 3']);
});
test('additional citation cannot collide with another valid row ID',()=>{
  const f=multiple();f.input.sections.push({...f.input.sections[0],id:'a-ref-2'});
  const all=view(f).sections.flatMap(s=>s.citations.map(c=>c.citationId));assert.equal(new Set(all).size,all.length);
});
test('same authority is not mutated by repeated projections',()=>{
  const f=multiple(); const old=JSON.stringify(f.authority);view(f);view(f);assert.equal(JSON.stringify(f.authority),old);
});

// Host-side font readiness controls (no browser mocks counted as real render).
import {waitForCanonicalFonts} from './wait-for-canonical-fonts.mjs';
const canonicalFamilies=['Lora','Playfair Display','Source Sans 3'];
const loadedState=()=>({status:'loaded',loaded:[...canonicalFamilies]});
test('font readiness accepts all three actually loaded families',async()=>{
  assert.deepEqual(await waitForCanonicalFonts({evaluate:async()=>loadedState()}),loadedState());
});
for(const [label,first] of [['missing family',{status:'loaded',loaded:['Lora','Playfair Display']}],['loading status',{status:'loading',loaded:canonicalFamilies}]]){
  test('font readiness retries '+label,async()=>{
    let calls=0;
    await waitForCanonicalFonts({evaluate:async()=>++calls===1?first:loadedState()});
    assert.equal(calls,2);
  });
}
test('font readiness propagates evaluation failure',async()=>{
  await assert.rejects(waitForCanonicalFonts({evaluate:async()=>{throw Error('evaluation failed')}}),/evaluation failed/);
});
test('font readiness fails closed for permanently missing family and pending evaluation',{timeout:22000},async()=>{
  // Run both real deadline controls concurrently; no fake clock or bypass.
  await Promise.all([
    assert.rejects(waitForCanonicalFonts({evaluate:async()=>({status:'loaded',loaded:['Lora']})}),/did not become ready within 15s/),
    assert.rejects(waitForCanonicalFonts({evaluate:()=>new Promise(()=>{})}),/evaluation timed out/),
  ]);
});

// Real partition rules; synthetic records exercise invalid inputs.
import {groupEvidenceFamilies} from './group-evidence-families.mjs';
const evidenceFixture=()=>{
 const sources=[{id:'a',family:'F1',locator:'1'},{id:'b',family:'F1',locator:'2'},{id:'c',family:'F2',locator:'3'}];
 return {sources,citations:sources.map(source=>({source,locator:source.locator})),groups:[{label:'First',sourceIds:['a','b']},{label:'Second',sourceIds:['c']}]};
};
const partition=f=>groupEvidenceFamilies(f.sources,f.citations,f.groups);
test('evidence partition retains exact source/citation objects and order',()=>{
 const f=evidenceFixture(),before=JSON.stringify(f),result=partition(f);
 assert.deepEqual(result.map(g=>g.rows.map(r=>r.source.id)),[['a','b'],['c']]);
 assert.equal(result[0].rows[0].source,f.sources[0]);assert.equal(result[0].rows[0].citation,f.citations[0]);assert.equal(JSON.stringify(f),before);
});
for(const [name,change] of [
 ['duplicate within group',f=>f.groups[0].sourceIds.push('a')],
 ['duplicate across groups',f=>f.groups[1].sourceIds.push('a')],
 ['missing member',f=>f.groups[0].sourceIds.pop()],
 ['unknown member',f=>f.groups[0].sourceIds[0]='unknown'],
 ['mixed families',f=>{f.groups[0].sourceIds=['a','c'];f.groups[1].sourceIds=['b']}],
 ['empty group',f=>f.groups.push({label:'Empty',sourceIds:[]})],
 ['duplicate trimmed label',f=>f.groups[1].label=' First '],
 ['same family split',f=>{f.groups[0].sourceIds=['a'];f.groups.push({label:'Third',sourceIds:['b']})}],
 ['wrong locator',f=>f.citations[0].locator='wrong'],
 ['duplicate citation',f=>f.citations.push(f.citations[0])],
 ['missing citation',f=>f.citations.pop()],
 ['missing family',f=>f.sources[0].family=''],
 ['duplicate source',f=>f.sources.push(f.sources[0])]
])test('evidence partition rejects '+name,()=>{const f=evidenceFixture();change(f);assert.throws(()=>partition(f),/Evidence family partition/);});
