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
