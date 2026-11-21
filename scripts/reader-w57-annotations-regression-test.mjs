#!/usr/bin/env node
// W57 annotation data-integrity tests: run against actual pilot source.
// No browser storage, published article or user record is modified.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_w57_annotations.js'),'utf8');
const highlights=readFileSync(resolve(root,'js/highlights.js'),'utf8');
const preview=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_universal_preview.js'),'utf8');
const css=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_w57.css'),'utf8');
const excerpt=(start,end)=>{
 const from=file.indexOf(start),to=file.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,'W57 function owner: '+start);
 return file.slice(from,to);
};
const noteSource=excerpt('    function linkedNote(record){','    function locate(id){');
const makeFixture=(options={})=>{
 let notes=(options.notes||[]).map(x=>({...x}));
 const record=options.record||{id:'quote-1',text:'Фрагмент',articleTitle:'Статья',
  url:'/articles/one/',annotation:{version:1,noteId:null}};
 const writes=[];
 const read=()=>notes.map(x=>({...x}));
 const updateRecord=(id,apply)=>{
  if(options.failQuote||id!==record.id)return null;
  apply(record);writes.push('quote');return record;
 };
 const write=(key,items)=>{
  if(options.failNote)return false;
  assert.equal(key,'gb-reader-notes-v1');
  notes=items.map(x=>({...x}));writes.push('note');return true;
 };
 const factory=new Function('read','write','updateRecord','nKey','Date','Math',
  noteSource+'return {linkedNote,saveLinkedNote};');
 const api=factory(read,write,updateRecord,'gb-reader-notes-v1',Date,Math);
 return{api,record,notes:()=>notes,writes};
};
const newNote=makeFixture();
assert.equal(newNote.api.saveLinkedNote(newNote.record,'Новая мысль').ok,true);
assert.equal(newNote.notes().length,1,'create: one note');
const originalId=newNote.notes()[0].id;
assert.equal(originalId,newNote.record.annotation.noteId,'create: linked id matches');
assert.equal(newNote.api.saveLinkedNote(newNote.record,'Исправленная мысль').ok,true);
assert.equal(newNote.notes().length,1,'edit must UPDATE, not append another note');
assert.equal(newNote.notes()[0].id,originalId,'edit must keep original note id');
assert.equal(newNote.notes()[0].text,'Исправленная мысль','edit must retain new text');
const rejectQuote=makeFixture({failQuote:true});
assert.equal(rejectQuote.api.saveLinkedNote(rejectQuote.record,'Текст').ok,false);
assert.equal(rejectQuote.notes().length,0,'quote write failure must not create orphan note');
assert.equal(rejectQuote.record.annotation.noteId,null,'quote failure leaves link intact');
const rejectNote=makeFixture({failNote:true});
assert.equal(rejectNote.api.saveLinkedNote(rejectNote.record,'Текст').ok,false);
assert.equal(rejectNote.record.annotation.noteId,null,'note failure must roll back quote link');
assert.equal(rejectNote.notes().length,0,'note failure does not persist text');
assert.deepEqual(rejectNote.writes,['quote','quote'],'failed note write causes compensating quote write');
const maxNotes=Array.from({length:500},(_,i)=>({id:'n'+i,text:'Старый текст',quoteId:i?'other':'quote-1'}));
const atLimit=makeFixture({notes:maxNotes,record:{id:'quote-1',text:'Фрагмент',articleTitle:'Статья',
 url:'/articles/one/',annotation:{version:1,noteId:'n0'}}});
assert.equal(atLimit.api.saveLinkedNote(atLimit.record,'Редактирование при лимите').ok,true);
assert.equal(atLimit.notes().length,500,'editing at quota must not append');
assert.equal(atLimit.notes()[0].text,'Редактирование при лимите');
const orphan=makeFixture({notes:[{id:'legacy-note',quoteId:'quote-1',text:'Старая заметка'}]});
assert.equal(orphan.api.saveLinkedNote(orphan.record,'Восстановленная ссылка').ok,true);
assert.equal(orphan.record.annotation.noteId,'legacy-note','one-way legacy association repaired');
assert.equal(orphan.notes().length,1,'repair does not duplicate note');
const ambiguous=makeFixture({notes:[
 {id:'orphan-a',quoteId:'quote-1',text:'Первый текст'},
 {id:'orphan-b',quoteId:'quote-1',text:'Второй текст'}]});
assert.equal(ambiguous.api.linkedNote(ambiguous.record),null,
 'multiple legacy notes must not be silently assigned to one quote');
assert.match(highlights,/function resolve\(article,anchor\)/,
 'the Product shared Reader owns the only positional range resolver');
assert.match(file,/const \{capture,resolve\}\s*=\s*window\.GBReaderAnchors\s*\|\|\s*\{\}/,
 'W57 annotations consume the shared positional anchor API');
assert.doesNotMatch(file,/function resolve\(article,anchor\)/,
 'W57 must not fork a stale second copy of the resolver');
// Persist the same DOM-author-visible offset mapping on capture and resolve.
assert.match(highlights,/function visibleProjection\(block\)/,
 'single visible-author-text projection owner is required');
assert.match(highlights,/projection:'reader-visible-v1'/,
 'new anchored quotes must record their coordinate system');
assert.match(highlights,/\.gtip,\.btip,\.tooltip/,
 'glossary/tooltip prose must not be included in saved citations');
assert.doesNotMatch(highlights,/const source=block\.textContent\|\|''/,
 'raw block textContent must never become the quoted text');
assert.match(file,/next\.some\(x=>x\.id===record\.id\)/,
 'insertion success must be tested by identity, not list length');
assert.doesNotMatch(file,/next\.length===old\.length/,
 'list length must not decide whether a quote was inserted');
assert.match(file,/npW57CancelNote/,'user must be able to cancel note edit');
assert.match(file,/status\.replaceChildren\(document\.createTextNode\('Восстановление не удалось/,
 'failed undo write must not delete its own retry button');
assert.match(file,/addEventListener\('gb:library-committed'/,
 'same-tab native Library commits must repaint W57 annotations');
assert.match(file,/key!==qKey&&key!==nKey/, 'both Library stores must invalidate W57');
assert.match(file,/typeof CSS!=='undefined'&&CSS\.highlights/,
 'unsupported highlight API must be safely detected');
assert.match(file,/closeResearchForAnnotation/,'source navigation must close mobile rail');
assert.match(file,/openResearchForAnnotation/,'new note must open the existing rail');
assert.match(preview,/openResearchForAnnotation\(\)/,'preview exposes proper rail opener');
assert.match(preview,/closeResearchForAnnotation\(\)/,'preview exposes mobile close');
assert.match(css,/np-w57-annotation-meta button[\s\S]*?min-height:36px/,
 'desktop note actions have usable hitbox');
assert.match(css,/#npUniversalDemo \.np-w57-annotation-meta button,[\s\S]*?min-height:44px/,
 'mobile note actions have 44px target');
console.log('Reader W57 notes: anchoring/edit/quota/rollback/undo UI/rail contracts PASS');
