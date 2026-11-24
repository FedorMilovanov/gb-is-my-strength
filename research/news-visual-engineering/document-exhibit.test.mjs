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

import {documentCitationAttributes} from '../../src/components/journal/editorial/document-exhibit-model.mjs';
test('display primitive preserves id, destination, locator and label-in-name',()=>{
 const citation=view(multiple()).sections[0].citations[2];
 assert.deepEqual(documentCitationAttributes(citation,'Воспроизведение','Контекст'),{id:citation.citationId,'data-journal-citation':true,href:citation.source.href,'aria-label':'Воспроизведение · § 3 · Контекст'});
});
for(const [label,mutate] of [
 ['empty label',c=>[c,'']],
 ['invalid destination',c=>[{...c,source:{...c.source,href:'javascript:alert(1)'}},'Источник']],
 ['missing locator',c=>[{...c,locator:''},'Источник']],
 ['missing citation ID',c=>[{...c,citationId:undefined},'Источник']],
 ['invalid citation ID',c=>[{...c,citationId:'bad id'},'Источник']],
 ['invalid context',c=>[c,'Источник',' ']]
])test('display rejects '+label,()=>assert.throws(()=>documentCitationAttributes(...mutate(view(fixture()).sections[0].citations[0])),/Journal document exhibit/));

import {documentRecordDate} from '../../src/components/journal/editorial/document-exhibit-model.mjs';
test('record dates retain differing dates, roles and explicit unknown',()=>{
 const rows=[{role:'publication',value:'2022-09-15'},{role:'modification',value:'2022-10-18'},{role:'capture',value:null}].map(documentRecordDate);
 assert.deepEqual(rows.map(r=>[r.role,r.value]),[['publication','2022-09-15'],['modification','2022-10-18'],['capture',null]]);
 assert.equal(rows[2].display,'Не установлена');assert.notEqual(rows[0].display,rows[1].display);
});
for(const value of [{role:'event',value:'2022-09-15'},{role:'publication',value:'2022-02-30'},{role:'publication'},{role:'publication',value:'2022-09'},{role:'toString',value:null}])test('record date rejects '+JSON.stringify(value),()=>assert.throws(()=>documentRecordDate(value),/Journal document exhibit/));

for(const [label,role] of [['array',['publication']],['coercible object',{toString:()=> 'publication'}]])test('record date rejects non-string '+label,()=>assert.throws(()=>documentRecordDate({role,value:null}),/Journal document exhibit/));

import {validateWordBounds} from './pdf-word-bounds.mjs';
import {assertFocusWitness} from './keyboard-scale-witness.mjs';
const sheet=(words,width=595.28,height=841.89)=>'<page width="'+width+'" height="'+height+'">'+words+'</page>';
const word=(x1=1,y1=2,x2=30,y2=40)=>'<word xMin="'+x1+'" yMin="'+y1+'" xMax="'+x2+'" yMax="'+y2+'">text</word>';
test('paper bounds accepts all physical words across two sheets',()=>assert.equal(validateWordBounds(sheet(word())+sheet(word()+word()),2,'A4'),3));
for(const [label,xml,pages] of [
 ['missing sheet',sheet(word()),2],
 ['blank sheet',sheet(word())+sheet(''),2],
 ['right overflow',sheet(word(1,2,596,40)),1],
 ['bottom overflow',sheet(word(1,2,30,843)),1],
 ['negative coordinate',sheet(word(-1)),1],
 ['inverted bounds',sheet(word(40,2,30,40)),1],
 ['invalid number',sheet(word('NaN')),1],
 ['invalid page size',sheet(word(),0),1],
 ['malformed word',sheet('<word xMin="1">text</word>'),1]
])test('paper bounds rejects '+label,()=>assert.throws(()=>validateWordBounds(xml,pages,'A4')));

test('paper bounds accepts actual Letter dimensions',()=>assert.equal(validateWordBounds(sheet(word(),612,792),1,'Letter'),1));
test('paper bounds tolerates Chromium rounding',()=>assert.equal(validateWordBounds(sheet(word(),596,842),1,'A4'),1));
for(const [label,xml,pages,format] of [
 ['A5 labelled A4',sheet(word(),419.53,595.28),1,'A4'],
 ['Letter labelled A4',sheet(word(),612,792),1,'A4'],
 ['A4 labelled Letter',sheet(word()),1,'Letter'],
 ['mixed formats',sheet(word())+sheet(word(),612,792),2,'A4'],
 ['landscape instead of portrait',sheet(word(),841.89,595.28),1,'A4'],
 ['zero width word',sheet(word(1,2,1,40)),1,'A4'],
 ['zero height word',sheet(word(1,2,30,2)),1,'A4'],
 ['whitespace coordinate',sheet(word(' ')),1,'A4'],
 ['hex coordinate',sheet(word('0x1')),1,'A4'],
 ['non-string format',sheet(word()),1,['A4']],
 ['invalid format',sheet(word()),1,'toString']
])test('paper bounds rejects '+label,()=>assert.throws(()=>validateWordBounds(xml,pages,format)));

const validFocus={active:true,keyboard:true,targetInside:true,boundsInside:true,indicatorVisible:true,outlineWidth:2,outlineStyle:'solid',outline:5,outlineColorVisible:true,unobscured:true,visible:true,scale:2,viewport:{width:320,height:640}};
test('focus witness accepts fully painted and unobscured 2x target',()=>assert.equal(assertFocusWitness(validFocus),validFocus));
for(const [label,change] of [
 ['not native focus',s=>s.active=false],
 ['not keyboard focus',s=>s.keyboard=false],
 ['missing painted indicator',s=>s.indicatorVisible=false],
 ['outline thinner than G3 standard',s=>s.outlineWidth=1],
 ['non-solid focus outline',s=>s.outlineStyle='auto'],
 ['outline offset leaves less than two painted pixels',s=>s.outline=1],
 ['transparent outline color',s=>s.outlineColorVisible=false],
 ['clipped focus bounds',s=>s.boundsInside=false],
 ['overlay obstruction',s=>s.unobscured=false],
 ['partially visible target',s=>s.visible=false]
])test('focus witness rejects '+label,()=>{
 const invalid={...validFocus};change(invalid);
 assert.throws(()=>assertFocusWitness(invalid),/keyboard focus/);
});
