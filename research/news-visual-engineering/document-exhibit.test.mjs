import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentExhibitView } from '../../src/components/journal/editorial/document-exhibit-model.mjs';
// Synthetic technical fixture, never publication data.
const fixture = () => ({
 input: { id:'test-document',mode:'editorial-paraphrase',title:'Тестовый документ',issuer:'Тестовый издатель',deck:'Синтетические данные',
 documentDate:'2024-02-29',publicationDate:null,captureDate:'2025-01-01',
 sections:[{id:'a',heading:'Раздел',locator:'§ 1',summary:'Пересказ',significance:'Значение',limitation:'Не доказывает причинность',claimId:'fixture-claim',sourceId:'fixture-source'}]},
 authority:{claimIds:['fixture-claim'],sources:[{id:'fixture-source',href:'#source-fixture',label:'Источник'}]}
});
const view = f => documentExhibitView(f.input, f.authority);
test('dates stay distinct and unknown stays null',()=>{const f=fixture();const v=view(f);assert.equal(v.documentDate,'2024-02-29');assert.equal(v.publicationDate,null);assert.equal(v.captureDate,'2025-01-01');assert.equal(v.sections[0].citationId,'cite-test-document-document-a');assert.equal(v.sections[0].source.href,'#source-fixture');});
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
 ['duplicate claim', f=>f.authority.claimIds.push('fixture-claim')],
];
for (const [name, change] of cases) test(name,()=>{const f=fixture();change(f);assert.throws(()=>view(f),/Journal document exhibit/);});
test('two exhibits do not collide when caller supplies unique IDs',()=>{const a=fixture(),b=fixture();b.input.id='other-document';assert.notEqual(view(a).sections[0].citationId,view(b).sections[0].citationId);});
