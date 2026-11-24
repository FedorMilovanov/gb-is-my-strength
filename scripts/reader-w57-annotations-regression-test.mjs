#!/usr/bin/env node
// W57 annotation data-integrity tests: run against actual pilot source.
// No browser storage, published article or user record is modified.
import assert from 'node:assert/strict';
import {createRecordTransactions} from '../js/reader-library-record-transactions.js';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_w57_annotations.js'),'utf8');
const highlights=readFileSync(resolve(root,'js/highlights.js'),'utf8');
const presenterSource=readFileSync(resolve(root,'js/reader-library-presenter.js'),'utf8');
const preview=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_universal_preview.js'),'utf8');
const css=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_w57.css'),'utf8');
const excerpt=(start,end)=>{
 const from=file.indexOf(start),to=file.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,'W57 function owner: '+start);
 return file.slice(from,to);
};
// Include the serialized commit owner the save path now depends on.
const noteSource=excerpt('    // The Product Library owns the same note list','    function locate(id){');
const sharedStorage=readFileSync(resolve(root,'js/reader-library-storage.js'),'utf8');
const ownerSource=sharedStorage.slice(sharedStorage.indexOf('  function libraryFailure('),sharedStorage.indexOf('  window.GBLibraryStorage ='))+
  highlights.slice(highlights.indexOf('  function commit('),highlights.indexOf('  // Restore only the deleted version'));
assert.ok(ownerSource.includes('function mutateLibrary('),'canonical Product writer must exist');
const makeFixture=(options={})=>{
 let notes=(options.notes||[]).map(x=>({...x}));
 const record=options.record||{id:'quote-1',text:'Фрагмент',articleTitle:'Статья',
  url:'/articles/one/',annotation:{version:1,noteId:null}};
 const nKey='gb-reader-notes-v1',qKey='gb-highlights-v1';
 const writes=[];
 let corrupt=options.corrupt;
 const read=key=>key===nKey?JSON.parse(JSON.stringify(notes)):[JSON.parse(JSON.stringify(record))];
 const localStorageFixture={
  getItem:key=>{
   if(corrupt===key)return '{broken';
   if(options.failRead===key)throw new Error('read failed');
   return JSON.stringify(read(key));
  },
  setItem:(key,value)=>{
   if((key===nKey&&options.failNote)||(key===qKey&&options.failQuote))
    throw new Error('QuotaExceededError');
   if(key===nKey){notes=JSON.parse(value);writes.push('note')}
   else{Object.assign(record,JSON.parse(value)[0]);writes.push('quote')}
  },
  removeItem:()=>{throw new Error('unexpected missing fixture key')}
 };
 const navigatorFixture=options.lock==='absent'?{}:{locks:{request:(name,opts,task)=>{
  assert.equal(name,'gb-library:'+nKey,'one shared lock name');
  assert.equal(opts.mode,'exclusive');
  if(options.lock==='rejected')return Promise.reject(new Error('lock rejected'));
  if(options.lock==='null')return Promise.resolve(task(null));
  if(options.lock==='held')return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  return Promise.resolve().then(()=>task({name}));
 }}};
 const windowFixture={dispatchEvent:()=>{if(options.failNotify)throw new Error('notify failed');return true}};
 const CustomEventFixture=class{constructor(type,init){this.type=type;this.detail=init&&init.detail}};
 // Deterministic abort timer, not a claim of native browser-lock acceptance.
 const AbortControllerFixture=class{
  constructor(){const listeners=[];this.signal={aborted:false,addEventListener:(_,fn)=>listeners.push(fn)};this.listeners=listeners}
  abort(){this.signal.aborted=true;for(const fn of this.listeners)fn()}
 };
 const timer=(fn)=>{const token={active:true};if(options.lock==='held')Promise.resolve().then(()=>{if(token.active)fn()});return token};
 const cancel=token=>{token.active=false};
 const makeOwner=new Function('NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES',
  'localStorage','navigator','window','CustomEvent','AbortController','setTimeout','clearTimeout','gbHighlightKey',
  ownerSource+'return {mutateLibrary,commit,libraryFailure};');
 windowFixture.GBHighlights=makeOwner(nKey,qKey,500,200,localStorageFixture,navigatorFixture,
  windowFixture,CustomEventFixture,AbortControllerFixture,timer,cancel,x=>x?.text||'');
 const domain=createRecordTransactions({mutateLibrary:windowFixture.GBHighlights.mutateLibrary,libraryFailure:windowFixture.GBHighlights.libraryFailure,gbHighlightKey:x=>x?.text||'',NOTES_KEY:nKey,QUOTES_KEY:qKey,LIMIT_NOTES:500,LIMIT_QUOTES:200});
 Object.assign(windowFixture.GBHighlights,domain);
 const factory=new Function('read','qKey','nKey','Date','Math','window',
  noteSource+'return {linkedNote,captureNoteSnapshot,saveLinkedNote};');
 const api=factory(read,qKey,nKey,Date,Math,windowFixture);
 return{api,record,notes:()=>notes,writes,owner:windowFixture.GBHighlights,
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
assert.match(highlights,/if\s*\(matches\.length === 1\)\s*\{\s*context\.quoteId = matches\[0\]\.id;\s*context\.quoteSnapshot = JSON\.stringify\(matches\[0\]\);\s*\}/,
 'unknown and ambiguous occurrences must fail closed; unique selection must capture the exact linked record');
assert.equal((readFileSync(resolve(root,'js/reader-library-selection.js'),'utf8').match(/const context = noteContextForSelection\(s\);/g)||[]).length,2,
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
assert.match(file,/next\.some\(x=>x\?\.id===record\.id\)/,
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
assert.match(file,/saveLinkedNote\(record,value,snapshot\)/,
 'UI save must pass the opening version');
assert.match(file,/if\(!result.ok\)\{say\(result.message\);return\}/,
 'failed compare must leave the editor and draft intact');


// Negative witnesses for the actual shared owner and W57 save path.
for(const lock of ['absent','held','rejected','null']){
 const f=makeFixture({lock});
 const before=JSON.stringify([f.record,f.notes()]);
 assert.equal((await f.api.saveLinkedNote(f.record,'Draft',f.api.captureNoteSnapshot(f.record))).ok,false,lock);
 assert.equal(JSON.stringify([f.record,f.notes()]),before,lock+' leaves both arrays unchanged');
 assert.deepEqual(f.writes,[],lock+' must not prewrite quote');
 let entered=false;
 const r=await f.owner.commit('gb-reader-notes-v1',null,current=>{entered=true;return{items:current}});
 assert.equal(r.ok,false,lock+' Product refuses');
 assert.equal(entered,false,lock+' Product mutation not entered');
}
for(const key of ['gb-reader-notes-v1','gb-highlights-v1']){
 const f=makeFixture({corrupt:key});
 assert.equal((await f.api.saveLinkedNote(f.record,'Draft')).ok,false,'corrupt '+key);
 assert.deepEqual(f.writes,[],'corrupt store must not be overwritten');
}
const orphanFailure=makeFixture({failNote:true,notes:[{id:'legacy',quoteId:'quote-1',text:'old'}]});
const oldOrphan=JSON.stringify([orphanFailure.record,orphanFailure.notes()]);
assert.equal((await orphanFailure.api.saveLinkedNote(orphanFailure.record,'Draft')).ok,false);
assert.equal(JSON.stringify([orphanFailure.record,orphanFailure.notes()]),oldOrphan,'failed legacy repair leaves both stores unchanged');
const quoteDrift=makeFixture();
const quoteOpen=quoteDrift.api.captureNoteSnapshot(quoteDrift.record);
quoteDrift.record.annotation.color='rose';
assert.equal((await quoteDrift.api.saveLinkedNote(quoteDrift.record,'Draft',quoteOpen)).ok,false);
assert.deepEqual(quoteDrift.writes,[],'quote snapshot conflict refuses all writes');
const notifyFailure=makeFixture({failNotify:true});
assert.equal((await notifyFailure.api.saveLinkedNote(notifyFailure.record,'Saved')).ok,true,'notification failure is not storage failure');
assert.equal(notifyFailure.notes().length,1);


// Execute the Product save handler and the committed portion of deleteItem
// against the same real mutation owner as W57. UI rendering is stubbed.
const nKey='gb-reader-notes-v1',qKey='gb-highlights-v1';
const deleteStart=presenterSource.indexOf('  async function deleteItem(item) {');
const deleteEnd=presenterSource.indexOf('    render(); sync();\n    const u = pendingUndo;',deleteStart);
assert.ok(deleteStart>=0&&deleteEnd>deleteStart,'Product delete source boundaries');
const deleteSource=presenterSource.slice(deleteStart,deleteEnd)+'return pendingUndo;\n}';
const removeProduct=(f,item)=>new Function('transactionCall',
 'statusMessage','clearUndo','let pendingUndo;\n'+deleteSource+'\nreturn deleteItem;')(
 (method,...args)=>f.owner[method](...args),()=>{},()=>{})(item);
const rawA={id:'A',text:'original',quoteId:'quote-1',legacy:{keep:true}};
const rawB={id:'B',text:'other'};
const rawQ=()=>({id:'quote-1',text:'Quote',annotation:{version:1,noteId:'A',color:'blue',anchor:{keep:true}}});
const itemA={id:'A',type:'note',recordSnapshot:JSON.stringify(rawA)};
const deletion=makeFixture({notes:[rawA],record:rawQ()});
const otherWrite=deletion.owner.commit(nKey,null,current=>({items:[rawB,...current]}));
const removal=removeProduct(deletion,itemA);
assert.equal((await otherWrite).ok,true);
assert.ok(await removal,'delete receipt after a queued unrelated create');
assert.deepEqual(deletion.notes(),[rawB],'fresh-state delete must preserve concurrent create');
assert.equal(deletion.record.annotation.noteId,null,'forward link cleared');
assert.equal(deletion.record.annotation.color,'blue','quote metadata untouched');
const deniedDelete=makeFixture({notes:[rawA],record:rawQ(),lock:'held'});
const beforeDenied=JSON.stringify([deniedDelete.notes(),deniedDelete.record]);
assert.equal(await removeProduct(deniedDelete,itemA),undefined);
assert.equal(JSON.stringify([deniedDelete.notes(),deniedDelete.record]),beforeDenied);
assert.deepEqual(deniedDelete.writes,[]);
const staleDelete=makeFixture({notes:[{...rawA,text:'newer'},rawB],record:rawQ()});
assert.equal(await removeProduct(staleDelete,itemA),undefined);
assert.deepEqual(staleDelete.writes,[],'stale delete writes nothing');
const duplicateDelete=makeFixture({notes:[rawA,{...rawA,text:'second'}],record:rawQ()});
assert.equal(await removeProduct(duplicateDelete,itemA),undefined);
assert.deepEqual(duplicateDelete.writes,[]);
const failedDelete=makeFixture({notes:[rawA,rawB],record:rawQ(),failNote:true});
const beforeFailed=JSON.stringify([failedDelete.notes(),failedDelete.record]);
assert.equal(await removeProduct(failedDelete,itemA),undefined);
assert.equal(JSON.stringify([failedDelete.notes(),failedDelete.record]),beforeFailed,'failed note deletion rolls back exact quote');
const saveStart=presenterSource.indexOf('  async function saveNote(e) {');
const saveEnd=presenterSource.indexOf('  function applySavedNote(editing)',saveStart);
assert.ok(saveStart>=0&&saveEnd>saveStart,'Product save source boundaries');
const saveSource=presenterSource.slice(saveStart,saveEnd);
const saveProduct=async(f,opened,context=null)=>{
 let applied=false;const textArea={value:'edited'};
 const draft={context,editing:opened?{id:String(opened.id),text:opened.text,recordSnapshot:JSON.stringify(opened)}:null};
 const run=new Function('textArea','draft','uid','currentTitle','location','transactionCall','statusMessage','applySavedNote',saveSource+'\nreturn saveNote;')(
  textArea,draft,()=>'fresh-id',()=>'Article',{origin:'https://example.test',pathname:'/a'},
  (method,...args)=>f.owner[method](...args),()=>{},()=>{applied=true});
 await run({preventDefault(){}});
 return{applied,draftText:textArea.value};
};
// Exercise the actual Product editor handler with a delayed storage owner.
let releaseDraft,submitted=0,closedDrafts=0;
const draftGate=new Promise(resolve=>{releaseDraft=resolve});
const area={value:'first',readOnly:false};
const handler=new Function('textArea','uid','currentTitle','location','transactionCall','statusMessage','applySavedNote',
 'let draft=null;'+saveSource+'return {saveNote,setDraft:x=>{draft=x;textArea.readOnly=false;},getDraft:()=>draft};')(
 area,()=> 'race-id',()=> 'Article',{origin:'https://example.test',pathname:'/a'},
 (method,...args)=>createRecordTransactions({mutateLibrary:async()=>{submitted++;await draftGate;return {ok:true};},libraryFailure:reason=>({ok:false,reason}),gbHighlightKey:x=>x?.text||'',NOTES_KEY:nKey,QUOTES_KEY:qKey,LIMIT_NOTES:500,LIMIT_QUOTES:200})[method](...args),()=>{},()=>{closedDrafts++;});
const firstDraft={context:null,editing:null},secondDraft={context:null,editing:null};
handler.setDraft(firstDraft);
const inFlight=handler.saveNote({preventDefault(){}});
assert.equal(area.readOnly,true);
await handler.saveNote({preventDefault(){}});
assert.equal(submitted,1,'double submit cannot create a duplicate note');
handler.setDraft(secondDraft);area.value='new unsaved draft';
releaseDraft();await inFlight;
assert.equal(closedDrafts,0,'late result cannot close newer editor');
assert.equal(handler.getDraft(),secondDraft);
assert.equal(area.value,'new unsaved draft');
assert.equal(area.readOnly,false);
const num={id:42,text:'original',legacy:{keep:true}};
const legacyProduct=makeFixture({notes:[num]});
assert.equal((await saveProduct(legacyProduct,num)).applied,true);
assert.deepEqual(legacyProduct.notes(),[{...num,text:'edited'}],'raw legacy ID and metadata unchanged');
const duplicateProduct=makeFixture({notes:[rawA,{...rawA,text:'second'}]});
assert.equal((await saveProduct(duplicateProduct,rawA)).applied,false);
assert.deepEqual(duplicateProduct.writes,[]);
const driftProduct=makeFixture({notes:[{...rawA,quoteId:'newer'}]});
const driftResult=await saveProduct(driftProduct,rawA);
assert.equal(driftResult.applied,false);
assert.equal(driftResult.draftText,'edited');
assert.deepEqual(driftProduct.writes,[]);
const atCapacity=makeFixture({notes:Array.from({length:500},(_,i)=>({id:'n'+i,text:'old'}))});
assert.equal((await saveProduct(atCapacity,null)).applied,false);
assert.deepEqual(atCapacity.writes,[]);
const successfulProduct=makeFixture({notes:[rawB]});
assert.equal((await saveProduct(successfulProduct,null)).applied,true);
assert.equal(successfulProduct.notes().length,2);
assert.deepEqual(successfulProduct.notes()[1],rawB);


// Undo uses the same lock and exact post-delete quote snapshots.
const undoFixture=makeFixture({notes:[rawA],record:rawQ()});
const receipt=await removeProduct(undoFixture,itemA);
assert.ok(receipt);
assert.equal((await undoFixture.owner.restoreDeleted(receipt)).ok,true);
assert.deepEqual(undoFixture.notes(),[rawA]);
assert.equal(undoFixture.record.annotation.noteId,'A');
const undoConflict=makeFixture({notes:[rawA],record:rawQ()});
const oldReceipt=await removeProduct(undoConflict,itemA);
const newNoteB={id:'B',text:'newer',quoteId:'quote-1'};
undoConflict.replaceNotes([newNoteB]);
undoConflict.record.annotation.noteId='B';
undoConflict.record.annotation.color='rose';
const newState=JSON.stringify([undoConflict.notes(),undoConflict.record]);
assert.equal((await undoConflict.owner.restoreDeleted(oldReceipt)).ok,false,'cannot steal newer link');
assert.equal(JSON.stringify([undoConflict.notes(),undoConflict.record]),newState);
assert.equal((await undoConflict.owner.restoreDeleted(oldReceipt,'copy-A')).ok,true);
assert.equal(undoConflict.record.annotation.noteId,'B');
assert.deepEqual(undoConflict.notes().find(x=>x.id==='B'),newNoteB);
const detached=undoConflict.notes().find(x=>x.id==='copy-A');
assert.equal(detached.quoteId,undefined,'copy cannot claim newer note link');
assert.equal(detached.text,rawA.text);
assert.deepEqual(detached.legacy,rawA.legacy);
const undoDrift=makeFixture({notes:[rawA],record:rawQ()});
const driftReceipt=await removeProduct(undoDrift,itemA);
undoDrift.record.annotation.color='rose';
const driftState=JSON.stringify([undoDrift.notes(),undoDrift.record]);
assert.equal((await undoDrift.owner.restoreDeleted(driftReceipt)).ok,false);
assert.equal(JSON.stringify([undoDrift.notes(),undoDrift.record]),driftState);
const undoHeld=makeFixture({lock:'held',notes:[],record:rawQ()});
assert.equal((await undoHeld.owner.restoreDeleted(receipt)).ok,false);
assert.deepEqual(undoHeld.writes,[]);
const undoQuota=makeFixture({notes:[],record:{...rawQ(),annotation:{...rawQ().annotation,noteId:null}},failNote:true});
const undoQuotaBefore=JSON.stringify([undoQuota.notes(),undoQuota.record]);
assert.equal((await undoQuota.owner.restoreDeleted(receipt)).ok,false);
assert.equal(JSON.stringify([undoQuota.notes(),undoQuota.record]),undoQuotaBefore);


// Actual shared quote mutation paths with multiple quotes and a serialized scheduler.
const markerStart=highlights.indexOf('  function findMarkerIndex(old,record) {');
const markerEnd=highlights.indexOf('  /* mutateLibrary()',markerStart);
const quoteStart=highlights.indexOf('  async function saveSelectedQuote() {');
const quoteEnd=highlights.indexOf('  /* Цветные пометы:',quoteStart);
assert.ok(markerStart>=0&&markerEnd>markerStart&&quoteStart>=0&&quoteEnd>quoteStart);
const keySource=highlights.slice(highlights.indexOf('  function gbHighlightPath('),highlights.indexOf('  const MARK_COLORS'));
const wQuoteSource=excerpt('    async function save(selection,kind){','    // The Product Library owns the same note list');
const qFixture=(initial=[],mode='ok')=>{
 let raw=JSON.stringify(initial),count=0,queue=Promise.resolve(),messages=[],id=0;
 const n='gb-reader-notes-v1',q='gb-highlights-v1',loc={origin:'https://example.test',pathname:'/a'};
 const ls={getItem:k=>k===q?raw:'[]',setItem:(k,v)=>{if(mode==='quota')throw Error('quota');assert.equal(k,q);raw=v;count++},removeItem:()=>{throw Error('unexpected remove')}};
 const nav=mode==='absent'?{}:{locks:{request:(name,opts,fn)=>{
  assert.equal(name,'gb-library:'+n);
  if(mode==='rejected')return Promise.reject(Error('lock refused'));
  const run=queue.then(()=>fn({name}));queue=run.catch(()=>{});return run;
 }}};
 const windowFixture={dispatchEvent:()=>true};
 const keys=new Function('location','normalizeText','LIMIT_QUOTES',keySource+'return {gbHighlightKey,gbAddHighlight,gbHighlightPath,gbFragmentKey,gbContextKey};')(loc,v=>String(v??'').replace(/\s+/g,' ').trim(),200);
 const owner=new Function('NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES','localStorage','navigator','window','CustomEvent','AbortController','setTimeout','clearTimeout','gbHighlightKey',ownerSource+'return {mutateLibrary};')(n,q,500,200,ls,nav,windowFixture,class{},AbortController,()=>1,()=>{},keys.gbHighlightKey);
 windowFixture.GBHighlights={...owner,highlightKey:keys.gbHighlightKey,addHighlight:keys.gbAddHighlight};
 const selection=(text,anchor)=>({text,anchor,positionalAnchor:anchor,before:anchor.prefix,after:anchor.suffix});
 const documentFixture={title:'Article',querySelector:()=>({})};
 const noOp=()=>{};
 const product=(selected)=>{
  const factory=new Function('selection','uid','currentTitle','sourceUrl','transactionCall','QUOTES_KEY','NOTES_KEY','LIMIT_QUOTES','MARK_COLORS','gbHighlightKey','gbAddHighlight','gbHighlightPath','gbFragmentKey','gbContextKey','document','GBReaderAnchors','locate','textIndex','paintMarks','sync','statusMessage','toast','undoQuotes',highlights.slice(quoteStart,quoteEnd)+highlights.slice(markerStart,markerEnd)+'return {saveSelectedQuote,saveMarker};');
  return factory(()=>selected,()=> 'product-'+(++id),()=> 'Article',()=>loc.origin+loc.pathname,(method,...args)=>createRecordTransactions({mutateLibrary:owner.mutateLibrary,libraryFailure:reason=>({ok:false,reason}),gbHighlightKey:keys.gbHighlightKey,NOTES_KEY:n,QUOTES_KEY:q,LIMIT_NOTES:500,LIMIT_QUOTES:200})[method](...args),q,n,200,['amber','sage','rose'],keys.gbHighlightKey,keys.gbAddHighlight,keys.gbHighlightPath,keys.gbFragmentKey,keys.gbContextKey,documentFixture,{resolve:(_,a)=>a,sameRange:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},()=>null,()=>null,()=>({supported:false}),noOp,m=>messages.push(m),noOp,()=>noOp);
 };
 const wapi=new Function('window','qKey','nKey','kinds','currentColor','document','location','normalize','sameId','say','repaint',wQuoteSource+'return {save,updateRecord};')(windowFixture,q,n,['quote','marker','underline'],'amber',documentFixture,loc,v=>String(v), (a,b)=>a!=null&&b!=null&&String(a)===String(b),m=>messages.push(m),noOp);
 return {selection,product,wapi,rows:()=>JSON.parse(raw),raw:()=>raw,writes:()=>count,messages,owner};
};
const anchor1={blockId:'b1',start:0,end:12,exact:'First phrase',prefix:'',suffix:''};
const anchor2={blockId:'b2',start:0,end:13,exact:'Second phrase',prefix:'',suffix:''};
const qRace=qFixture();
const qa=qRace.selection('First phrase',anchor1),qb=qRace.selection('Second phrase',anchor2);
const raceResults=await Promise.all([qRace.product(qa).saveSelectedQuote(),qRace.wapi.save(qb,'marker')]);
assert.equal(raceResults[0],true);assert.ok(raceResults[1]);assert.equal(qRace.rows().length,2,'cross-engine queued inserts retain both');
assert.ok(qRace.rows().some(x=>x.text==='First phrase'));assert.ok(qRace.rows().some(x=>x.text==='Second phrase'));
const oldRaw=qRace.raw();
assert.ok(await qRace.wapi.save(qb,'marker'));assert.equal(qRace.raw(),oldRaw,'same range is idempotent');
const oldMark=qRace.rows().find(x=>x.text==='Second phrase');
assert.ok(await qRace.wapi.updateRecord(oldMark.id,x=>{x.annotation.color='rose'},JSON.stringify(oldMark)));
const roseRaw=qRace.raw();
assert.equal(await qRace.wapi.updateRecord(oldMark.id,x=>{x.annotation.color='sage'},JSON.stringify(oldMark)),null,'stale recolor refused');
assert.equal(qRace.raw(),roseRaw);
assert.equal(await qRace.product(qb).saveMarker('sage'),true);
assert.equal(qRace.rows().find(x=>x.id===oldMark.id).annotation.color,'sage');
assert.equal(qRace.rows().length,2);
const numericMark={...oldMark,id:42,extra:{legacy:true}};
const numeric=qFixture([numericMark]);
assert.ok(await numeric.wapi.updateRecord('42',x=>{x.annotation.kind='underline'},JSON.stringify(numericMark)));
assert.equal(numeric.rows()[0].id,42);
assert.deepEqual(numeric.rows()[0].extra,numericMark.extra);
assert.equal(numeric.rows()[0].annotation.kind,'underline');
const duplicate=qFixture([numericMark,{...numericMark,text:'duplicate'}]);
const dupBefore=duplicate.raw();
assert.equal(await duplicate.wapi.updateRecord('42',x=>{x.annotation.color='sage'},JSON.stringify(numericMark)),null);
assert.equal(duplicate.raw(),dupBefore);
const capQuote=qFixture(Array.from({length:200},(_,i)=>({id:'q'+i,text:'other'+i,url:'/other'})));
const capBefore=capQuote.raw();
assert.equal(await capQuote.product(qa).saveSelectedQuote(),false);
assert.equal(await capQuote.wapi.save(qb,'marker'),null);
assert.equal(capQuote.raw(),capBefore);
for(const mode of ['absent','rejected','quota']){
 const f=qFixture([],mode);
 assert.equal(await f.product(qa).saveSelectedQuote(),false,mode);
 assert.equal(await f.product(qa).saveMarker('rose'),false,mode);
 assert.equal(await f.wapi.save(qb,'marker'),null,mode);
 assert.equal(f.raw(),'[]',mode);
 assert.equal(f.writes(),0,mode);
}
assert.doesNotMatch(highlights,/\bfunction write\(key, items\)/,'Product has no raw array writer');
assert.doesNotMatch(file,/localStorage\.(?:setItem|removeItem)\(/,'W57 has no independent storage writer');

const danglingCopy=makeFixture({notes:[],record:{...rawQ(),annotation:{...rawQ().annotation,noteId:'copy-A'}}});
const danglingBefore=JSON.stringify([danglingCopy.notes(),danglingCopy.record]);
assert.equal((await danglingCopy.owner.restoreDeleted({key:nKey,entry:rawA,index:0},'copy-A')).ok,false);
assert.equal(JSON.stringify([danglingCopy.notes(),danglingCopy.record]),danglingBefore);
assert.deepEqual(danglingCopy.writes,[]);
const danglingQuoteCopy=makeFixture({notes:[{id:'N',text:'old',quoteId:'copy-Q'}],record:rawQ()});
const danglingQuoteBefore=JSON.stringify([danglingQuoteCopy.notes(),danglingQuoteCopy.record]);
assert.equal((await danglingQuoteCopy.owner.restoreDeleted({key:qKey,entry:{id:'old-Q',text:'other quote'},index:0},'copy-Q')).ok,false);
assert.equal(JSON.stringify([danglingQuoteCopy.notes(),danglingQuoteCopy.record]),danglingQuoteBefore);
assert.deepEqual(danglingQuoteCopy.writes,[]);
const danglingNew=makeFixture({notes:[],record:{...rawQ(),annotation:{...rawQ().annotation,noteId:'fresh-id'}}});
assert.equal((await saveProduct(danglingNew,null)).applied,false);
assert.deepEqual(danglingNew.writes,[]);
// W57 handlers themselves, not a rewritten simulation.
const noteHandlerStart=file.indexOf("    section.querySelector('#npW57CancelNote').addEventListener");
const noteHandlerEnd=file.indexOf('    let libraryFrame=',noteHandlerStart);
const wHandlers=file.slice(noteHandlerStart,noteHandlerEnd);
let releaseW, wCalls=0;
const wGate=new Promise(resolve=>{releaseW=resolve});
const actions={},wArea={value:'first',readOnly:false},wEditor={hidden:false},saveButton={disabled:false};
const sectionMock={querySelector:key=>({get disabled(){return saveButton.disabled},set disabled(x){saveButton.disabled=x},addEventListener:(_,fn)=>{actions[key]=fn}})};
const wSession=new Function('section','noteText','editor','entries','sameId','say','saveLinkedNote','repaint',
 'let pendingNoteId="A",pendingNoteSnapshot={id:"A"};const noteSaves=new WeakSet();'+wHandlers+
 'return {open:(id,snapshot)=>{pendingNoteId=id;pendingNoteSnapshot=snapshot;noteText.readOnly=false;editor.hidden=false;section.querySelector("#npW57SaveNote").disabled=false;},snapshot:()=>pendingNoteSnapshot};')(
 sectionMock,wArea,wEditor,()=>[{id:'A'},{id:'B'}],(a,b)=>a===b,()=>{},async()=>{wCalls++;await wGate;return {ok:true,message:'saved'}},()=>{});
const wPending=actions['#npW57SaveNote']();
assert.equal(wArea.readOnly,true);
await actions['#npW57SaveNote']();
assert.equal(wCalls,1);
const wNew={id:'B'};wSession.open('B',wNew);wArea.value='new W57 draft';
releaseW();await wPending;
assert.equal(wSession.snapshot(),wNew);
assert.equal(wArea.value,'new W57 draft');
assert.equal(wEditor.hidden,false);
assert.equal(wArea.readOnly,false);
console.log('Reader W57 notes: anchoring/edit/quota/rollback + W94a concurrent edit guards PASS');


// W39 — a Product-linked draft must bind to the exact source quote opened,
// not merely an ID that could now point to different text or geometry.
const w39quote={id:'Q-W39',text:'original',url:'/article/a',annotation:{version:1,noteId:null,color:'amber'}};
const w39context=q=>({quoteId:q.id,quoteSnapshot:JSON.stringify(q),quoteText:q.text,url:q.url,title:'Article'});
const w39zero={...w39quote,id:0};
for(const [name,opened,current,notes,context,allowed,id] of [
 ['unchanged',w39quote,w39quote,[],w39context(w39quote),true,'Q-W39'],
 ['changed text',w39quote,{...w39quote,text:'changed'},[],w39context(w39quote),false],
 ['changed position',w39quote,{...w39quote,annotation:{...w39quote.annotation,color:'rose'}},[],w39context(w39quote),false],
 ['competing note',w39quote,w39quote,[{id:'other',text:'other',quoteId:'Q-W39'}],w39context(w39quote),false],
 ['no opening snapshot',w39quote,w39quote,[],{quoteId:'Q-W39',quoteText:'original'},false],
 ['standalone',w39quote,w39quote,[],{quoteText:'selection',url:'/article/a'},true,undefined],
 ['legacy zero ID',w39zero,w39zero,[],w39context(w39zero),true,0]
]) {
 const f=makeFixture({record:JSON.parse(JSON.stringify(current)),notes});
 const before=JSON.stringify(f.notes()), result=await saveProduct(f,null,context);
 assert.equal(result.applied,allowed,'W39 '+name);
 if(allowed){assert.equal(f.notes()[0].quoteId,id);assert.equal(f.writes.length,1);}
 else {assert.equal(result.draftText,'edited');assert.equal(JSON.stringify(f.notes()),before);assert.deepEqual(f.writes,[]);}
}
assert.match(highlights,/context\.quoteSnapshot = JSON\.stringify\(matches\[0\]\)/,'selection path captures exact quote');
assert.match(presenterSource,/quoteSnapshot: item\.recordSnapshot/,'library card path captures exact quote');
console.log('W39: 7/7 Product-linked draft cases PASS');


// W40 — Undo must not turn a dangling legacy edge into a conflicting link.
const w40q=(id,noteId=null)=>({id,text:'quote '+id,url:'/a',annotation:{version:1,noteId}});
const w40n=(id,quoteId)=>({id,text:'note '+id,...(quoteId===undefined?{}:{quoteId})});
const w40qa=w40q('Q'),w40qb=w40q('R','A'),w40na=w40n('A','Q');
for(const [name,record,notes,receipt] of [
 ['new forward claim',w40qb,[],{key:nKey,entry:w40n('A'),index:0,clearedLinks:[]}],
 ['reverse target claimed',w40q('Q','B'),[w40n('B')],{key:nKey,entry:w40na,index:0,clearedLinks:[],relatedQuote:JSON.stringify(w40q('Q','B'))}],
 ['reverse-only note already claimed',w40qb,[w40na],{key:qKey,entry:w40qa,index:0}],
 ['explicit note already claimed',w40qb,[w40n('A')],{key:qKey,entry:w40q('Q','A'),index:0}],
 ['duplicate reverse target',w40q('unrelated'),[w40na,w40n('A')],{key:qKey,entry:w40qa,index:0}]
]){
 const f=makeFixture({record:JSON.parse(JSON.stringify(record)),notes});
 const before=JSON.stringify([f.record,f.notes()]);
 const r=await f.owner.restoreDeleted(receipt);
 assert.equal(r.ok,false,'W40 '+name);assert.equal(r.reason,'link-conflict');
 assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([f.record,f.notes()]),before);
}
{
 const f=makeFixture({record:w40qb});
 const receipt={key:nKey,entry:w40n('A'),index:0,clearedLinks:[]};
 const r=await f.owner.restoreDeleted(receipt,'W40-copy');
 assert.equal(r.ok,true);assert.equal(f.notes()[0].id,'W40-copy');assert.equal(f.notes()[0].quoteId,undefined);
 assert.equal(f.record.annotation.noteId,'A');
}
console.log('W40: 6/6 Undo integrity cases PASS');


// Actual lazy dialog lifecycle: deterministic deferred imports, no DOM/browser claims.
{
 const from=highlights.indexOf('  let opening = null, openGeneration = 0, pendingTrigger = null;');
 const to=highlights.indexOf('  function sync()',from);
 assert.ok(from>=0&&to>from,'lazy dialog lifecycle source boundaries');
 const lifecycle=highlights.slice(from,to);
 function fixture(){
  let requests=[],opened=false,locked=0,focus=0,paint=0,errors=0,broken=false;
  const attributes=new Map();
  const fab={setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
  const triggerAttributes=new Map([['aria-haspopup','dialog']]);
  const trigger={isConnected:true,focus:()=>{focus++},setAttribute:(k,v)=>triggerAttributes.set(k,v),removeAttribute:k=>triggerAttributes.delete(k),getAttribute:k=>triggerAttributes.get(k)};
  const overlay={classList:{add:()=>{opened=true},remove:()=>{opened=false}},setAttribute(){},removeAttribute(){},querySelector:()=>({focus(){}})};
  const document={activeElement:trigger};
  const window={SiteUtils:{lockScroll:()=>{locked++},unlockScroll:()=>{locked--}}};
  const loadPresenter=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
  const render=()=>{paint++;if(broken)throw Error('render failure')};
  const instantiate=new Function('fab','overlay','document','window','loadPresenter','render','isOpen','toast','hideEditor','clearUndo',
   "let research=null, opener=null, tab='', filter='', searchTerm='', shown=0; const BATCH_SIZE=30, search={value:''};"+lifecycle+'return {open,close};');
  const api=instantiate(fab,overlay,document,window,loadPresenter,render,()=>opened,()=>{errors++},()=>{},()=>{});
  return {api,requests,trigger,attributes,triggerAttributes,breakRender:()=>{broken=true},state:()=>({opened,locked,focus,paint,errors})};
 }
 const f=fixture();
 const pending=f.api.open(f.trigger);
 assert.equal(f.api.open(f.trigger),pending,'two open requests share one initialization');
 assert.equal(f.requests.length,1);
 assert.equal(f.attributes.get('aria-busy'),'true');
 assert.equal(f.triggerAttributes.get('aria-busy'),'true');
 assert.equal(f.state().locked,0,'pending load must not lock underlying reading');
 f.requests[0].resolve();assert.equal(await pending,true);
 assert.deepEqual(f.state(),{opened:true,locked:1,focus:0,paint:1,errors:0});
 assert.equal(f.attributes.has('aria-busy'),false);
 assert.equal(f.triggerAttributes.has('aria-busy'),false);
 assert.equal(f.triggerAttributes.get('aria-expanded'),'true');
 assert.equal(f.triggerAttributes.get('aria-controls'),'gb-hl-panel');
 f.api.close();assert.deepEqual(f.state(),{opened:false,locked:0,focus:1,paint:1,errors:0});
 assert.equal(f.triggerAttributes.get('aria-expanded'),'false');
 const cancel=fixture(),old=cancel.api.open(cancel.trigger);cancel.api.close();
 assert.equal(cancel.triggerAttributes.has('aria-busy'),false);
 const next=cancel.api.open(cancel.trigger);cancel.requests[0].resolve();
 assert.equal(await old,false);assert.equal(cancel.state().opened,false);
 assert.equal(cancel.attributes.get('aria-busy'),'true','obsolete load cannot clear newer busy state');
 assert.equal(cancel.triggerAttributes.get('aria-busy'),'true');
 cancel.requests[1].resolve();assert.equal(await next,true);assert.equal(cancel.state().locked,1);
 const retry=fixture(),failed=retry.api.open(retry.trigger);retry.requests[0].reject(Error('offline'));
 assert.equal(await failed,false);assert.equal(retry.state().locked,0);assert.equal(retry.state().errors,1);
 assert.equal(retry.attributes.has('aria-busy'),false);
 const again=retry.api.open(retry.trigger);retry.requests[1].resolve();assert.equal(await again,true);
 const broken=fixture(),rendering=broken.api.open(broken.trigger);broken.breakRender();broken.requests[0].resolve();
 assert.equal(await rendering,false);assert.equal(broken.state().locked,0,'failed render must release scroll lock');
 assert.equal(broken.state().opened,false);assert.equal(broken.state().errors,1);
}


// Painting must not traverse the entire article on a clean or positional-only page.
{
 const start=highlights.indexOf('  function paintMarks() {');
 const end=highlights.indexOf('  function findMarkerIndex(',start);
 assert.ok(start>=0&&end>start,'paint source boundaries');
 const source=highlights.slice(start,end);
 function scene(rows,desktop=false){
  let scans=0,placed=[],removed=[],resolved=0;
  const scope={};
  const CSS={highlights:{set:(key)=>placed.push(key),delete:key=>removed.push(key)}};
  const document={body:{classList:{contains:()=>desktop}},querySelector:()=>scope};
  const paint=new Function('window','CSS','document','textIndex','quotes','gbHighlightPath','location','MARK_COLORS','GBReaderAnchors','locate','gbHighlightKey','matchMedia','Highlight',source+'return paintMarks;')({CSS},CSS,document,()=>{scans++;return{}},()=>rows,x=>x.url,{href:'/a'},['amber','sage'],{resolve:()=>{resolved++;return{}}},()=>({}),x=>x.id,()=>({matches:desktop}),function(){});
  const result=paint();return {scans,resolved,placed,removed,painted:result.painted,ids:[...result.placed]};
 }
 const clean=scene([]);
 assert.equal(clean.scans,0);assert.equal(clean.painted,0);assert.deepEqual(clean.removed,['gb-hl-amber','gb-hl-sage']);
 const positional={id:'p',url:'/a',color:'amber',annotation:{version:1,anchor:{}}};
 const native=scene([positional]);assert.equal(native.scans,0);assert.equal(native.resolved,1);assert.deepEqual(native.ids,['p']);
 const w57=scene([positional],true);assert.equal(w57.scans,0);assert.equal(w57.resolved,0);assert.equal(w57.painted,0);
 const legacy=scene([{id:'a',url:'/a',color:'amber'},{id:'b',url:'/a',color:'sage'},{id:'other',url:'/b',color:'sage'}]);assert.equal(legacy.scans,1);assert.equal(legacy.painted,2);assert.deepEqual(legacy.ids,['a','b']);
}


// W55: the native selection surface has exactly one fallback event owner.
{
 const selectionSource=readFileSync(resolve(root,'js/reader-library-selection.js'),'utf8');
 const make=new Function('document','window','setTimeout','clearTimeout',selectionSource.replace('export function','function')+'return createSelectionController;');
 let popup=null, listeners=[], timers=[];
 const document={getElementById:id=>id==='selection-share-popup'?popup:null,addEventListener:(type,cb)=>listeners.push(['document',type,cb])};
 const window={addEventListener:(type,cb)=>listeners.push(['window',type,cb]),getSelection:()=>null};
 const controller=make(document,window,fn=>{timers.push(fn);return timers.length},()=>{})({});
 controller.attachSelection();
 const first=listeners.length;
 assert.ok(first>0,'fallback installs real listeners');
 controller.attachSelection();controller.attachSelection();
 assert.equal(listeners.length,first,'repeated attach must not duplicate fallback listeners');
 popup={querySelector:()=>({})};
 controller.attachSelection();
 assert.equal(listeners.length,first,'existing native popup must not install more fallback listeners');
 controller.placeSelectionBar();
 assert.equal(timers.length,0,'native popup must exclude fallback placement');
}
