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
// Include the serialized commit owner the save path now depends on.
const noteSource=excerpt('    // The Product Library owns the same note list','    function locate(id){');
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
 // Node has no Web Locks and no localStorage: the fixture supplies both, so the
 // serialized read -> mutate -> write path under test is the shipped one.
 // A note-store write failure is a real quota error: throw, as the browser does.
 const localStorageFixture={getItem:()=>JSON.stringify(notes),
  setItem:(key,value)=>{
   if(key!=='gb-reader-notes-v1')return;
   if(options.failNote){const error=new Error('QuotaExceededError');error.name='QuotaExceededError';throw error}
   notes=JSON.parse(value).map(x=>({...x}));writes.push('note');
  },removeItem:()=>{}};
 const navigatorFixture={locks:{request:(name,task)=>Promise.resolve().then(task)}};
 const windowFixture={dispatchEvent:()=>true};
 const CustomEventFixture=class{constructor(type,init){this.type=type;this.detail=init&&init.detail}};
 const factory=new Function('read','write','updateRecord','nKey','Date','Math',
  'localStorage','navigator','window','CustomEvent',
  noteSource+'return {linkedNote,captureNoteSnapshot,saveLinkedNote};');
 const api=factory(read,write,updateRecord,'gb-reader-notes-v1',Date,Math,
  localStorageFixture,navigatorFixture,windowFixture,CustomEventFixture);
 return{api,record,notes:()=>notes,writes,
  replaceNotes:(items)=>{notes=items.map(x=>({...x}));}};
};
const newNote=makeFixture();
assert.equal((await newNote.api.saveLinkedNote(newNote.record,'Новая мысль')).ok,true);
assert.equal(newNote.notes().length,1,'create: one note');
const originalId=newNote.notes()[0].id;
assert.equal(originalId,newNote.record.annotation.noteId,'create: linked id matches');
assert.equal((await newNote.api.saveLinkedNote(newNote.record,'Исправленная мысль')).ok,true);
assert.equal(newNote.notes().length,1,'edit must UPDATE, not append another note');
assert.equal(newNote.notes()[0].id,originalId,'edit must keep original note id');
assert.equal(newNote.notes()[0].text,'Исправленная мысль','edit must retain new text');
const rejectQuote=makeFixture({failQuote:true});
assert.equal((await rejectQuote.api.saveLinkedNote(rejectQuote.record,'Текст')).ok,false);
assert.equal(rejectQuote.notes().length,0,'quote write failure must not create orphan note');
assert.equal(rejectQuote.record.annotation.noteId,null,'quote failure leaves link intact');
const rejectNote=makeFixture({failNote:true});
assert.equal((await rejectNote.api.saveLinkedNote(rejectNote.record,'Текст')).ok,false);
assert.equal(rejectNote.record.annotation.noteId,null,'note failure must roll back quote link');
assert.equal(rejectNote.notes().length,0,'note failure does not persist text');
assert.deepEqual(rejectNote.writes,['quote','quote'],'failed note write causes compensating quote write');
const maxNotes=Array.from({length:500},(_,i)=>({id:'n'+i,text:'Старый текст',quoteId:i?'other':'quote-1'}));
const atLimit=makeFixture({notes:maxNotes,record:{id:'quote-1',text:'Фрагмент',articleTitle:'Статья',
 url:'/articles/one/',annotation:{version:1,noteId:'n0'}}});
assert.equal((await atLimit.api.saveLinkedNote(atLimit.record,'Редактирование при лимите')).ok,true);
assert.equal(atLimit.notes().length,500,'editing at quota must not append');
assert.equal(atLimit.notes()[0].text,'Редактирование при лимите');
const orphan=makeFixture({notes:[{id:'legacy-note',quoteId:'quote-1',text:'Старая заметка'}]});
assert.equal((await orphan.api.saveLinkedNote(orphan.record,'Восстановленная ссылка')).ok,true);
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
// Product selection bar and the native popup must both associate notes only
// with an already-saved exact source occurrence, not a repeated text string.
assert.match(highlights,/function noteContextForSelection\(selected\)/,
 'Product selection notes need a shared positional association owner');
assert.match(highlights,/GBReaderAnchors\.sameRange\(exact, stored\)/,
 'notes must compare real source DOM Ranges');
assert.match(highlights,/if \(matches\.length === 1\) context\.quoteId = matches\[0\]\.id/,
 'unknown and ambiguous occurrences must fail closed');
assert.equal((highlights.match(/const context = noteContextForSelection\(s\);/g)||[]).length,2,
 'touch toolbar and native selection popup must share one association rule');

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

// W94a: opener-snapshot guards for both reproducible two-tab conflicts.
// This tests the actual W57 functions, not a reimplementation of the logic.
const linkedRecord=()=>({id:'quote-1',text:'Фрагмент',articleTitle:'Статья',
  url:'/articles/one/',annotation:{version:1,noteId:'same-note'}});
const linkedNotes=()=>[{id:'same-note',text:'Первоначально',quoteId:'quote-1',
  articleTitle:'Статья',url:'/articles/one/',savedAt:100}];
const stableOpen=makeFixture({record:linkedRecord(),notes:linkedNotes()});
const stableSnapshot=stableOpen.api.captureNoteSnapshot(stableOpen.record);
assert.equal((await stableOpen.api.saveLinkedNote(stableOpen.record,'Моя правка',stableSnapshot)).ok,true,
 'W57 must permit editing the exact opened note when no competing write occurs');
assert.equal(stableOpen.notes()[0].text,'Моя правка');
const changedInOtherTab=makeFixture({record:linkedRecord(),notes:linkedNotes()});
const changedSnapshot=changedInOtherTab.api.captureNoteSnapshot(changedInOtherTab.record);
changedInOtherTab.replaceNotes([{...linkedNotes()[0],text:'Правка вкладки Б'}]);
assert.equal((await changedInOtherTab.api.saveLinkedNote(changedInOtherTab.record,'Черновик А',changedSnapshot)).ok,false,
 'changed-after-open must fail closed');
assert.equal(changedInOtherTab.notes()[0].text,'Правка вкладки Б',
 'conflicting save must not overwrite B');
assert.equal(changedInOtherTab.writes.length,0,'conflict must not write either store');
const deletedInOtherTab=makeFixture({record:linkedRecord(),notes:linkedNotes()});
const deletedSnapshot=deletedInOtherTab.api.captureNoteSnapshot(deletedInOtherTab.record);
deletedInOtherTab.replaceNotes([]);
assert.equal((await deletedInOtherTab.api.saveLinkedNote(deletedInOtherTab.record,'Черновик А',deletedSnapshot)).ok,false,
 'deleted-after-open must not recreate a note');
assert.equal(deletedInOtherTab.notes().length,0,'deleted note remains deleted');
assert.equal(deletedInOtherTab.record.annotation.noteId,'same-note',
 'conflict must not rewrite positional quote links');
assert.deepEqual(deletedInOtherTab.writes,[], 'delete/change must write nothing');
const newLinkedInOtherTab=makeFixture();
const newLinkSnapshot=newLinkedInOtherTab.api.captureNoteSnapshot(newLinkedInOtherTab.record);
newLinkedInOtherTab.replaceNotes([{id:'other-note',text:'Создана во вкладке Б',quoteId:'quote-1'}]);
assert.equal((await newLinkedInOtherTab.api.saveLinkedNote(newLinkedInOtherTab.record,'А',newLinkSnapshot)).ok,false,
 'newly-created link after open must not be silently overwritten');
assert.equal(newLinkedInOtherTab.notes().length,1);
const duplicatesInStore=makeFixture({record:linkedRecord(),notes:[
 ...linkedNotes(),{...linkedNotes()[0],text:'Дубликат ID'}]});
const dupSnapshot=duplicatesInStore.api.captureNoteSnapshot(duplicatesInStore.record);
assert.equal((await duplicatesInStore.api.saveLinkedNote(duplicatesInStore.record,'А',dupSnapshot)).ok,false,
 'duplicate ID must fail closed');
assert.equal(duplicatesInStore.writes.length,0);
const unrelatedChange=makeFixture({record:linkedRecord(),notes:[
 ...linkedNotes(),{id:'other-note',text:'Посторонняя заметка'}]});
const unrelatedSnapshot=unrelatedChange.api.captureNoteSnapshot(unrelatedChange.record);
unrelatedChange.replaceNotes([...linkedNotes(),{id:'other-note',text:'Изменено отдельно'}]);
assert.equal((await unrelatedChange.api.saveLinkedNote(unrelatedChange.record,'Обновлена моя',unrelatedSnapshot)).ok,true,
 'editing another note must not block unrelated note save');
assert.equal(unrelatedChange.notes().find(n=>n.id==='other-note').text,'Изменено отдельно',
 'unrelated notes must survive a guarded save');
assert.match(file,/pendingNoteSnapshot=captureNoteSnapshot\(record\)/,
 'UI opening must capture the saved note version');
assert.match(file,/saveLinkedNote\(record,value,pendingNoteSnapshot\)/,
 'UI save must pass the opening version');
assert.match(file,/if\(!result.ok\)\{say\(result.message\);return\}/,
 'failed compare must leave the editor and draft intact');

console.log('Reader W57 notes: anchoring/edit/quota/rollback + W94a concurrent edit guards PASS');
