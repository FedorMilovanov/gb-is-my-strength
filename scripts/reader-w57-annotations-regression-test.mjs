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
const selectionActionSource=readFileSync(resolve(root,'js/reader-library-selection.js'),'utf8');
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
const ownerSource=sharedStorage.slice(sharedStorage.indexOf('  function libraryFailure('),sharedStorage.indexOf('  window.GBLibraryStorage ='));
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
 const windowFixture={addEventListener(){},dispatchEvent:()=>{if(options.failNotify)throw new Error('notify failed');return true}};
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
  ownerSource+'return {mutateLibrary,libraryFailure};');
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
assert.match(selectionActionSource,/function noteContextForSelection\(selected\)/,
 'Product selection notes need a shared positional association owner');
assert.match(selectionActionSource,/GBReaderAnchors\.sameRange\(exact, stored\)/,
 'notes must compare real source DOM Ranges');
assert.match(selectionActionSource,/if\s*\(matches\.length === 1\)\s*\{\s*context\.quoteId = matches\[0\]\.id;\s*context\.quoteSnapshot = JSON\.stringify\(matches\[0\]\);\s*\}/,
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
 const r=await f.owner.mutateLibrary(['gb-reader-notes-v1'],stores=>{entered=true;return{changes:{'gb-reader-notes-v1':stores['gb-reader-notes-v1']}}});
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
const otherWrite=deletion.owner.mutateLibrary([nKey],stores=>({changes:{[nKey]:[rawB,...stores[nKey]]}}));
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
const markerStart=selectionActionSource.indexOf('  function findMarkerIndex(old,record) {');
const markerEnd=selectionActionSource.indexOf('  // Selection toolbar and popup',markerStart);
const quoteStart=selectionActionSource.indexOf('  async function saveSelectedQuote() {');
const quoteEnd=markerStart;
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
 const windowFixture={addEventListener(){},dispatchEvent:()=>true};
 const keys=new Function('location','normalizeText','LIMIT_QUOTES',keySource+'return {gbHighlightKey,gbAddHighlight,gbHighlightPath,gbFragmentKey,gbContextKey};')(loc,v=>String(v??'').replace(/\s+/g,' ').trim(),200);
 const owner=new Function('NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES','localStorage','navigator','window','CustomEvent','AbortController','setTimeout','clearTimeout','gbHighlightKey',ownerSource+'return {mutateLibrary};')(n,q,500,200,ls,nav,windowFixture,class{},AbortController,()=>1,()=>{},keys.gbHighlightKey);
 windowFixture.GBHighlights={...owner,highlightKey:keys.gbHighlightKey,addHighlight:keys.gbAddHighlight};
 const selection=(text,anchor)=>({text,anchor,positionalAnchor:anchor,before:anchor.prefix,after:anchor.suffix});
 const documentFixture={title:'Article',querySelector:()=>({})};
 const noOp=()=>{};
 const product=(selected)=>{
  const factory=new Function('selection','uid','currentTitle','sourceUrl','transactionCall','QUOTES_KEY','NOTES_KEY','LIMIT_QUOTES','MARK_COLORS','gbHighlightKey','gbAddHighlight','gbHighlightPath','gbFragmentKey','gbContextKey','document','GBReaderAnchors','locate','textIndex','paintMarks','sync','statusMessage','toast','undoQuotes',selectionActionSource.slice(quoteStart,quoteEnd)+selectionActionSource.slice(markerStart,markerEnd)+'return {saveSelectedQuote,saveMarker};');
  return factory(()=>selected,()=> 'product-'+(++id),()=> 'Article',()=>loc.origin+loc.pathname,(method,...args)=>createRecordTransactions({mutateLibrary:owner.mutateLibrary,libraryFailure:reason=>({ok:false,reason}),gbHighlightKey:keys.gbHighlightKey,NOTES_KEY:n,QUOTES_KEY:q,LIMIT_NOTES:500,LIMIT_QUOTES:200})[method](...args),q,n,200,['amber','sage','rose'],keys.gbHighlightKey,keys.gbAddHighlight,keys.gbHighlightPath,keys.gbFragmentKey,keys.gbContextKey,documentFixture,{resolution:()=>a=>a,sameRange:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},()=>null,()=>null,()=>({supported:false}),noOp,m=>messages.push(m),noOp,()=>noOp);
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
assert.match(selectionActionSource,/context\.quoteSnapshot = JSON\.stringify\(matches\[0\]\)/,'selection path captures exact quote');
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
 const from=highlights.indexOf('  function keydown(e) {');
 const to=highlights.indexOf('  function sync()',from);
 assert.ok(from>=0&&to>from,'lazy dialog lifecycle source boundaries');
 const lifecycle=highlights.slice(from,to);
 const mountStart=presenterSource.indexOf('  function createMountedLifecycle('),mountEnd=presenterSource.indexOf('  // The mounted view owns',mountStart);
 assert.ok(mountStart>=0&&mountEnd>mountStart);
 const mounted=presenterSource.slice(mountStart,mountEnd);
 function fixture(){
  let requests=[],opened=false,locked=0,focus=0,paint=0,errors=0,broken=false;
  const attributes=new Map(), triggerAttributes=new Map([['aria-haspopup','dialog']]), returnAttributes=new Map();
  let active, hidden=false;
  function target(attrs,kind,tabIndex=0){return {isConnected:true,tabIndex,getClientRects:()=>[{}],closest:()=>kind==='trigger'&&hidden?{}:null,hasAttribute:k=>attrs.has(k),focus:opts=>{assert.equal(opts.preventScroll,true);active=kind;document.activeElement=kind==='trigger'?trigger:kind==='return'?returnTarget:fab;focus++},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k),addEventListener(){}};}
  const fab=target(attributes,'fab'),trigger=target(triggerAttributes,'trigger'),returnTarget=target(returnAttributes,'return',-1);
  const overlay={classList:{add:()=>{opened=true},remove:()=>{opened=false}},setAttribute(){},removeAttribute(){},querySelector:()=>({focus(){}})};
  const document={activeElement:trigger,getElementById:()=>null,querySelector:()=>null};
  const window={SiteUtils:{lockScroll:()=>{locked++},unlockScroll:()=>{locked--}}};
  const loadPresenter=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
  const render=()=>{paint++;if(broken)throw Error('render failure')};
  const instantiate=new Function('fab','overlay','document','window','loadPresenter','render','isOpen','toast','hideEditor','clearUndo','getComputedStyle',
   mounted+"let opener=null; const view=createMountedLifecycle({overlay,editor:{hidden:true},research:null,editorController:{hideEditor,clearUndo},reset(){},render,close:()=>close()});"+lifecycle+'return {open,close,keydown,pendingFocusChanged};');
  const api=instantiate(fab,overlay,document,window,loadPresenter,render,()=>opened,()=>{errors++},()=>{},()=>{},()=>({visibility:'visible'}));
  return {api,requests,trigger,fab,returnTarget,returnAttributes,attributes,triggerAttributes,hideTrigger:()=>{hidden=true},unrelated:(notify=true)=>{active='unrelated';document.activeElement={isConnected:true,getClientRects:()=>[{}],closest:()=>null};if(notify)api.pendingFocusChanged();},active:()=>active,breakRender:()=>{broken=true},state:()=>({opened,locked,focus,paint,errors})};
 }
 const f=fixture();
 const superseded=f.api.open(f.trigger);
 const pending=f.api.open(f.trigger);
 assert.ok(pending!==superseded,'latest explicit activation owns its continuation');
 assert.equal(f.requests.length,2,'fixture models two callers of the shared real loadPresenter');
 f.requests[0].resolve();assert.equal(await superseded,false);
 assert.equal(f.attributes.get('aria-busy'),'true');
 assert.equal(f.triggerAttributes.get('aria-busy'),'true');
 assert.equal(f.state().locked,0,'pending load must not lock underlying reading');
 f.requests[1].resolve();assert.equal(await pending,true);
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
 for(const kind of ['touch toolbar','native popup']) {
  for(const termination of ['close','cancel','failure']) {
   const scene=fixture();scene.hideTrigger();const task=scene.api.open(scene.trigger,scene.returnTarget);
   if(termination==='close'){scene.requests[0].resolve();assert.equal(await task,true);scene.api.close();}
   else if(termination==='cancel'){scene.api.close();scene.requests[0].resolve();assert.equal(await task,false);}
   else {scene.requests[0].reject(Error('offline'));assert.equal(await task,false);}
   assert.equal(scene.active(),'return',kind+' '+termination+' returns focus to authored text');
   assert.equal(scene.state().locked,0);assert.equal(scene.state().opened,false);
   assert.equal(scene.triggerAttributes.has('aria-busy'),false);
   assert.equal(scene.returnAttributes.get('tabindex'),'-1');
  }
 }
 const race=fixture();race.hideTrigger();const stale=race.api.open(race.trigger,race.returnTarget);race.api.close();
 const fresh=race.api.open(race.trigger,race.returnTarget);const focused=race.state().focus;
 race.requests[0].reject(Error('obsolete'));assert.equal(await stale,false);assert.equal(race.state().focus,focused,'obsolete failure must not restore focus during newer open');
 race.requests[1].resolve();assert.equal(await fresh,true);race.api.close();assert.equal(race.active(),'return');
 for(const action of ['escape','reject','resolve']) {
  for(const notify of [true,false]) {
   const scene=fixture();scene.hideTrigger();const task=scene.api.open(scene.trigger,scene.returnTarget);
   scene.unrelated(notify);let prevented=false;
   if(action==='escape'){scene.api.keydown({key:'Escape',preventDefault(){prevented=true;}});scene.requests[0].resolve();}
   else if(action==='reject')scene.requests[0].reject(Error('offline'));
   else scene.requests[0].resolve();
   assert.equal(await task,false);assert.equal(prevented,false);assert.equal(scene.active(),'unrelated');
   assert.equal(scene.state().focus,0);assert.equal(scene.state().locked,0);assert.equal(scene.state().opened,false);assert.equal(scene.attributes.has('aria-busy'),false);
  }
 }
 const latest=fixture();const a=latest.api.open(latest.trigger,latest.returnTarget);const b=latest.api.open(latest.fab);
 latest.requests[0].resolve();assert.equal(await a,false);assert.equal(latest.state().opened,false);assert.equal(latest.triggerAttributes.has('aria-busy'),false);
 latest.requests[1].resolve();assert.equal(await b,true);latest.api.close();assert.equal(latest.active(),'fab');
}


// Painting must not traverse the entire article on a clean or positional-only page.
{
 const start=highlights.indexOf('  function paintMarks() {');
 const end=highlights.indexOf('  // One deferred repaint per frame',start);
 assert.ok(start>=0&&end>start,'paint source boundaries');
 const source=highlights.slice(start,end);
 function scene(rows,desktop=false,hasScope=true){
  let scans=0,placed=[],removed=[],resolved=0;
  const scope={};
  const CSS={highlights:{set:(key)=>placed.push(key),delete:key=>removed.push(key)}};
  const document={body:{classList:{contains:()=>desktop}},querySelector:()=>hasScope?scope:null};
  const paint=new Function('window','CSS','document','textIndex','quotes','gbHighlightPath','location','MARK_COLORS','GBReaderAnchors','locate','gbHighlightKey','matchMedia','Highlight','cancelScheduledPaint',source+'return paintMarks;')({CSS},CSS,document,()=>{scans++;return{}},()=>rows,x=>x.url,{href:'/a'},['amber','sage'],{resolution:()=>()=>{resolved++;return{}}},()=>({}),x=>x.id,()=>({matches:desktop}),function(){},()=>{});
  const result=paint();return {scans,resolved,placed,removed,painted:result.painted,ids:[...result.placed]};
 }
 const departed=scene([],false,false);assert.equal(departed.scans,0);assert.deepEqual(departed.removed,['gb-hl-amber','gb-hl-sage']);
 const clean=scene([]);
 assert.equal(clean.scans,0);assert.equal(clean.painted,0);assert.deepEqual(clean.removed,['gb-hl-amber','gb-hl-sage']);
 const positional={id:'p',url:'/a',color:'amber',annotation:{version:1,anchor:{}}};
 const native=scene([positional]);assert.equal(native.scans,0);assert.equal(native.resolved,1);assert.deepEqual(native.ids,['p']);
 const w57=scene([positional],true);assert.equal(w57.scans,0);assert.equal(w57.resolved,0);assert.equal(w57.painted,0);
 const legacy=scene([{id:'a',url:'/a',color:'amber'},{id:'b',url:'/a',color:'sage'},{id:'other',url:'/b',color:'sage'}]);assert.equal(legacy.scans,1);assert.equal(legacy.painted,2);assert.deepEqual(legacy.ids,['a','b']);
}


// W67: one active fallback owner; rollback every partially registered set.
{
 const selectionSource=readFileSync(resolve(root,'js/reader-library-selection.js'),'utf8');
 const make=new Function('document','window','setTimeout','clearTimeout',selectionSource.replace('export function','function')+'return createSelectionController;');
 const scene=(fault=0,after=false)=>{
   let popup=null, next=0, registrations=0, barLookups=0;
   const listeners=new Set(),timers=new Map();
   const target=()=>({
     addEventListener(type,cb,options){
       const fail=++registrations===fault;
       if(fail&&!after)throw Error('injected registration failure');
       listeners.add({owner:this,type,cb,capture:options===true||!!options?.capture});
       if(fail)throw Error('injected registration failure');
     },
     removeEventListener(type,cb,options){for(const l of listeners)if(l.owner===this&&l.type===type&&l.cb===cb&&l.capture===(options===true||!!options?.capture))listeners.delete(l);}
   });
   const document=Object.assign(target(),{getElementById:id=>{if(id==='gb-hl-selbar')barLookups++;return id==='selection-share-popup'?popup:null;}});
   const window=Object.assign(target(),{getSelection:()=>null});
   const api=make(document,window,fn=>{timers.set(++next,fn);return next},id=>timers.delete(id))({});
   return {api,listeners,timers,native:()=>{popup={querySelector:()=>({})};},fallback:()=>{popup=null;},lookups:()=>barLookups};
 };
 const f=scene();
 for(let cycle=0;cycle<3;cycle++){
   f.api.attachSelection();assert.equal(f.listeners.size,8);
   f.api.attachSelection();assert.equal(f.listeners.size,8);
   const old=[...f.listeners].find(l=>l.type==='selectionchange').cb;
   old();assert.equal(f.timers.size,1);
   const late=[...f.timers.values()][0];
   f.native();f.api.attachSelection();
   assert.equal(f.listeners.size,0,'native releases all fallback listeners');
   assert.equal(f.timers.size,0,'native cancels pending placement');
   const before=f.lookups();old();late();
   assert.equal(f.lookups(),before,'obsolete callbacks do not touch DOM');
   assert.equal(f.timers.size,0,'obsolete callbacks cannot requeue');
   f.api.attachSelection();f.api.placeSelectionBar();
   assert.equal(f.listeners.size,0);
   f.fallback();
 }
 for(const after of [false,true])for(let fault=1;fault<=8;fault++){
   const f=scene(fault,after);
   assert.throws(()=>f.api.attachSelection(),/injected registration failure/);
   assert.equal(f.listeners.size,0,'partial registration rolled back');
   assert.equal(f.timers.size,0);
   f.api.attachSelection();assert.equal(f.listeners.size,8,'successful retry owns exactly one set');
   f.native();f.api.attachSelection();assert.equal(f.listeners.size,0);
 }
}

 // W58: actual anchor resolution reuses a projection only inside one synchronous batch.
{
 const from=highlights.indexOf('  const GBReaderAnchors = (() => {');
 const to=highlights.indexOf('  window.GBReaderAnchors = GBReaderAnchors;',from);
 assert.ok(from>=0&&to>from);
 let inventories=0,walks=0,styles=0;
 const leaf={nodeValue:'Alpha beta gamma delta',parentElement:null};
 const inline={matches:()=>false,closest:()=>null,parentElement:null};
 const block={id:'p1',textContent:leaf.nodeValue,matches:()=>false,closest:()=>null};
 inline.parentElement=block;leaf.parentElement=inline;
 const article={querySelectorAll:()=>{inventories++;return[block]},querySelector:()=>block};
 const document={createTreeWalker:()=>{walks++;let n=0;return{nextNode:()=>n++===0?leaf:null}},createRange:()=>({setStart(node,offset){this.start=offset},setEnd(node,offset){this.end=offset}})};
 const api=new Function('document','NodeFilter','CSS','getComputedStyle','normalizeText',highlights.slice(from,to)+'return GBReaderAnchors;')(document,{SHOW_TEXT:4},{escape:x=>x},()=>{styles++;return{display:'inline',visibility:'visible'}},x=>String(x??'').replace(/\\s+/g,' ').trim());
 const anchor={blockId:'p1',blockIndex:0,start:6,end:10,exact:'beta',prefix:'Alpha ',suffix:' gamma'};
 const batch=api.resolution(article);
 assert.deepEqual([batch(anchor).start,batch(anchor).end],[6,10]);
 assert.equal(inventories,1);assert.equal(walks,1);assert.equal(styles,1);
 assert.equal(batch({...anchor,start:0,end:4}).start,6,'relocation reuses same projection');
 assert.equal(walks,1);
 leaf.nodeValue='Alpha zeta gamma delta';block.textContent=leaf.nodeValue;
 assert.equal(api.resolve(article,anchor),null,'new resolution observes changed text');
 assert.equal(inventories,2);assert.equal(walks,2);
}

 // W58: closed FAB must not project/serialize/sort the complete card collection.
{
 const from=highlights.indexOf('  function sync() {'),to=highlights.indexOf('  let dockImpl',from);
 assert.ok(from>=0&&to>from);
 let reads=0,renders=0,aria='',hidden=true,open=false;
 const fab={classList:{add(){}},querySelector:()=>({set hidden(v){hidden=v}}),setAttribute:(k,v)=>{aria=v}};
 const rows=n=>()=>{reads++;return Array(n)};
 const sync=new Function('fab','quotes','notes','favorites','isOpen','render','all',highlights.slice(from,to)+'return sync;')(fab,rows(2),rows(3),rows(1),()=>open,()=>renders++,()=>{throw Error('card projection on closed FAB')});
 sync();assert.equal(reads,3);assert.equal(aria,'Моя библиотека — сохранено 6');assert.equal(hidden,false);assert.equal(renders,0);
 open=true;sync();assert.equal(renders,1);assert.equal(reads,6);
}


 // W59: capture and context share one actual visible projection; dock is not needed.
{
 const from=highlights.indexOf('  const GBReaderAnchors = (() => {');
 const to=highlights.indexOf('  window.GBReaderAnchors = GBReaderAnchors;',from);
 assert.ok(from>=0&&to>from);
 let walks=0;
 const prose='Alpha beta gamma delta';
 const block={id:'p1',nodeType:1,textContent:prose,matches:()=>false,closest:()=>block,getClientRects:()=>[{}],contains:n=>n===leaf};
 const leaf={nodeType:3,nodeValue:prose,parentElement:block};
 const range={startContainer:leaf,endContainer:leaf,startOffset:6,endOffset:16,cloneRange:()=>range,getBoundingClientRect:()=>({width:80,height:18,bottom:50,top:32})};
 const sel={isCollapsed:false,rangeCount:1,getRangeAt:()=>range};
 const article={contains:b=>b===block,querySelectorAll:()=>[block]};
 // Block closest resolves authored paragraph except exclusion checks.
 block.closest=selector=>selector==='p,li,blockquote'||selector==='p,li,blockquote,.manuscript-quote--bilingual'?block:null;
 const doc={createTreeWalker:()=>{walks++;let n=0;return{nextNode:()=>n++===0?leaf:null}},createRange:()=>({setStart(){},collapse(){}})};
 const api=new Function('document','NodeFilter','window','location','innerHeight','normalizeText',highlights.slice(from,to)+'return GBReaderAnchors;')(doc,{SHOW_TEXT:4},{getSelection:()=>sel},{pathname:'/a'},844,x=>String(x??'').replace(/\\s+/g,' ').trim());
 const capture=api.capture(article,'beta gamma');
 assert.equal(capture.text,'beta gamma');assert.equal(capture.anchor.start,6);assert.equal(capture.anchor.end,16);
 assert.deepEqual(capture.context,{before:'Alpha ',after:' delta'});assert.equal(walks,1,'capture and context one tree traversal');
 assert.deepEqual(api.selectionContext(sel,'beta gamma'),capture.context);assert.equal(walks,2,'standalone fallback matches');
 assert.deepEqual(api.selectionContext(sel,'wrong text'),{before:'',after:''});
 const plain=api.capture(article);assert.equal(plain.context,undefined,'existing capture consumers retain result shape');
 assert.deepEqual(plain.anchor,capture.anchor);
 const dockSource=readFileSync(resolve(root,'js/reader-library-dock.js'),'utf8');
 const dock=new Function('window',dockSource.replace(/export function/g,'function')+'return contextFromSelection;')({GBReaderAnchors:api});
 assert.deepEqual(dock(sel,'beta gamma'),capture.context,'dock compatibility delegates to canonical projection');
}

 // W61: coalesce scheduled painting without changing synchronous public API.
{
 const from=highlights.indexOf('  let paintFrame = null;');
 const to=highlights.indexOf('  /* Мобильный вход',from);
 assert.ok(from>=0&&to>from);
 let frames=new Map(),next=0,paints=0,cancelled=0,handlers={};
 const target={addEventListener:(event,fn)=>{handlers[event]=fn}};
 const localStorage={};
 const api=new Function('window','document','requestAnimationFrame','cancelAnimationFrame','paintMarks','QUOTES_KEY','HTMLDetailsElement','localStorage',
  highlights.slice(from,to)+'return {schedulePaint,cancelScheduledPaint};')(target,target,fn=>{frames.set(++next,fn);return next},id=>{cancelled++;frames.delete(id)},()=>paints++,'quotes',class{},localStorage);
 const flush=()=>{const ready=[...frames.values()];frames.clear();ready.forEach(fn=>fn());};
 handlers['gb:library-committed']({detail:{key:'notes'}});assert.equal(frames.size,0);
 handlers['gb:library-committed']({detail:{key:'quotes'}});
 handlers.storage({key:'quotes',storageArea:localStorage});handlers.resize();api.schedulePaint();
 assert.equal(frames.size,1);assert.equal(paints,0);flush();assert.equal(paints,1);
 api.schedulePaint();api.cancelScheduledPaint();assert.equal(cancelled,1);assert.equal(frames.size,0);flush();assert.equal(paints,1);
 api.schedulePaint();flush();assert.equal(paints,2,'new independent invalidation is not lost');
 handlers.storage({key:null,storageArea:{}});assert.equal(frames.size,0,'session clear ignored');
 handlers.storage({key:null,storageArea:localStorage});assert.equal(frames.size,1,'local clear repaints');flush();assert.equal(paints,3);
 assert.match(highlights,/function paintMarks\(\) \{\s*cancelScheduledPaint\(\);/,'immediate painting consumes queued repaint');
}

 // W61: ordinary mouse clicks are not selection intent; touch prewarm stays.
{
 const start=highlights.indexOf('  // Prewarm long-press on touch/pen');
 const end=highlights.indexOf('  const api =',start);
 assert.ok(start>=0&&end>start);
 let handlers={},loads=0,captures=0,attaches=0;
 const doc={addEventListener:(name,fn)=>{handlers[name]=fn}};
 new Function('document','loadSelectionController','rememberSelection','attachSelection','setTimeout',highlights.slice(start,end))(doc,()=>loads++,()=>captures++,()=>attaches++,fn=>fn());
 const target={closest:()=>true};
 handlers.pointerdown({pointerType:'mouse',target});assert.equal(loads,0);
 handlers.pointerdown({pointerType:'touch',target});assert.equal(loads,1);
 handlers.pointerdown({pointerType:'pen',target});assert.equal(loads,2);
 handlers.mouseup();handlers.touchend();handlers.selectionchange();
 assert.equal(captures,3);assert.equal(attaches,3);
}


 // W62: execute the actual mounted view owner with deterministic event nodes.
{
 const start=presenterSource.indexOf('  function createLibraryView(');
 const end=presenterSource.indexOf('export { createLibraryView',start);
 assert.ok(start>=0&&end>start,'mounted view boundaries');
 const lifecycleStart=presenterSource.indexOf('  function createMountedLifecycle(');
 const source=presenterSource.slice(lifecycleStart,end);
 function fixture(fail=false){
   const snapshots=[],nodes=new Map();let removed=0,exported=0,closed=0,shownNote=0,resets=0,actions,editorOptions;
   function node(){return {value:'',listeners:new Map(),addEventListener(type,fn){assert.ok(!this.listeners.has(type),'one event binding per node/type');this.listeners.set(type,fn)},fire(type,e={}){return this.listeners.get(type)(e)}}}
   const overlay=node();overlay.querySelector=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};overlay.remove=()=>removed++;
   const panel=node(),list=node(),titleCount=node(),search=node(),sourceSelect=node(),status=node(),editor=node(),textArea=node();
   const items=[{id:'q'}],research={reconcileTopic(){},resetFilters(){resets++}};
   const factory=new Function('createLibraryPanel','createLibraryEditor','renderList','renderItem','handleLibraryClick','exportMarkdown',source+'return createLibraryView;')(
     ()=>({overlay,panel,list,titleCount,search,sourceSelect,status,editor,textArea}),
     options=>{if(fail==='editor')throw Error('init failed');editorOptions=options;return {showEditor(){shownNote++},hideEditor(){},saveNote(){},deleteItem(){},clearUndo(){}}},
     state=>{snapshots.push({tab:state.tab,filter:state.filter,term:state.searchTerm,shown:state.shown});return state.filter},
     ()=>{},(_,a)=>{actions=a},()=>exported++);
   const deps={all:()=>items,close:()=>closed++,BATCH_SIZE:30,normalizeText:s=>s.trim(),createResearch:()=>{if(fail)throw Error('init failed');return research}};
   return {mount:()=>factory(deps),snapshots,overlay,list,search,sourceSelect,editor,actions:()=>actions,options:()=>editorOptions,stats:()=>({removed,exported,closed,shownNote,resets})};
 }
 const f=fixture(),view=f.mount();
 view.render();assert.deepEqual(f.snapshots.at(-1),{tab:'all',filter:'all',term:'',shown:30});
 f.overlay.querySelector('#gb-hl-tabs').fire('click',{target:{closest:()=>({dataset:{libraryTab:'quote'}})}});
 f.search.value='  ФРАЗА  ';f.search.fire('input');f.sourceSelect.value='source-A';f.sourceSelect.fire('change');
 assert.deepEqual(f.snapshots.at(-1),{tab:'quote',filter:'source-A',term:'фраза',shown:30});
 f.list.fire('click',{});f.actions().more();assert.equal(f.snapshots.at(-1).shown,60);
 f.actions().clearFilters();assert.deepEqual(f.snapshots.at(-1),{tab:'quote',filter:'all',term:'',shown:30});assert.equal(f.stats().resets,1);
 f.options().selectNotes();view.render();assert.equal(f.snapshots.at(-1).tab,'note');
 view.reset();view.render();assert.deepEqual(f.snapshots.at(-1),{tab:'all',filter:'all',term:'',shown:30});
 f.overlay.querySelector('#gb-hl-export').fire('click');f.overlay.querySelector('#gb-hl-new-note').fire('click');f.overlay.querySelector('#gb-hl-close').fire('click');
 assert.deepEqual(f.stats(),{removed:0,exported:1,closed:1,shownNote:1,resets:1});
 for(const mode of ['editor','research']){
 const failed=fixture(mode);let threw=false;try{failed.mount()}catch(e){threw=e.message==='init failed'}
 assert.equal(threw,true);assert.equal(failed.stats().removed,1,'failed '+mode+' mount must not leave orphan overlay');
 }
}

 // W63: shared parallel import, mount after both, retry after rejected import or mount.
{
 const start=highlights.indexOf('  let overlay, fab, view,');
 const end=highlights.indexOf('  const stylesheet',start);
 assert.ok(start>=0&&end>start);
 const source=highlights.slice(start,end).replace(/\bimport\(/g,'load(');
 function fixture(){
   const imports=[],attrs=new Map();let mounts=0,failMount=false;
   const module={createLibraryView(){mounts++;if(failMount)throw Error('mount');return {overlay:{},editorController:{}}}};
   const api=new Function('load','deps',source.replace('function loadPresenter() {','fab=deps.fab; const {penSvg,uid,currentTitle,transactionCall,restoreDeleted,NOTES_KEY,all,quotes,GBReaderAnchors,statusMessage,close,hideToast,hide,sync,normalizeText,BATCH_SIZE,isOpen}=deps; function loadPresenter() {')+'return {loadPresenter,published:()=>presenter};')(
    path=>new Promise((resolve,reject)=>imports.push({path,resolve,reject})),{fab:{setAttribute:(k,v)=>attrs.set(k,v)}});
   return {api,imports,module,mounts:()=>mounts,attrs,setFailure:value=>failMount=value};
 }
 const f=fixture(),p=f.api.loadPresenter(),q=f.api.loadPresenter();
 assert.equal(p,q,'parallel modules share one readiness promise');
 assert.equal(f.imports.length,2);assert.match(f.imports[0].path,/reader-library-presenter\.js/);assert.match(f.imports[1].path,/reader-library-v3\.js/);
 f.imports[1].resolve({});await Promise.resolve();assert.equal(f.mounts(),0);assert.equal(f.api.published(),null);
 f.imports[0].resolve(f.module);assert.equal(await p,f.module);assert.equal(f.mounts(),1);assert.equal(f.attrs.get('aria-controls'),'gb-hl-panel');
 assert.equal(await f.api.loadPresenter(),f.module);assert.equal(f.imports.length,2);
 for(const failure of ['import','mount']){
   const x=fixture(),first=x.api.loadPresenter();
   if(failure==='import'){x.imports[0].reject(Error('offline'));x.imports[1].resolve({});}
   else{x.setFailure(true);x.imports[0].resolve(x.module);x.imports[1].resolve({});}
   let rejected=false;try{await first}catch{rejected=true}
   assert.equal(rejected,true);assert.equal(x.api.published(),null);assert.equal(x.attrs.has('aria-controls'),false);
   x.setFailure(false);const retry=x.api.loadPresenter();assert.equal(x.imports.length,4);
   x.imports[2].resolve(x.module);x.imports[3].resolve({});assert.equal(await retry,x.module);
   assert.equal(x.mounts(),failure==='import'?1:2);
 }
}

 // W65: a failed research factory must leave no live global listener and
 // must not consume the one-time resume intent before successful setup.
 {
  const researchSource=readFileSync(resolve(root,'js/reader-library-v3.js'),'utf8');
  const from=researchSource.indexOf('export function createLibraryResearch(');
  const to=researchSource.indexOf('// Pure fail-closed backup contract functions',from);
  assert.ok(from>=0&&to>from);
  const body=researchSource.slice(from,to).replace('export function','function');
  for(const fault of ['dom:click','dom:change','dom:keydown','global:scroll','global:pagehide','global:load','global:storage',null]){
   const listeners=[];let sessionReads=0,fail=fault;
   const window={addEventListener(type,fn,opts={}){
    if(fail==='global:'+type)throw Error('injected');
    listeners.push({type,fn,opts});
   }};
   class Controller {constructor(){this.signal={aborted:false}} abort(){this.signal.aborted=true}}
   const node=()=>({append(){},after(){},insertBefore(){},setAttribute(){},querySelector(){return node()},
    addEventListener(type){if(fail==='dom:'+type)throw Error('injected')}});
   const document={createElement:node,readyState:'complete'};
   const sessionStorage={getItem(){sessionReads++;return null}};
   const factory=new Function('window','document','sessionStorage','AbortController','KEYS','objectMap','parse','btn','node','Option','location','cleanPath',body+';return createLibraryResearch;')(
    window,document,sessionStorage,Controller,{tags:'tags',reading:'reading',revisit:'revisit'},x=>x,()=>({}),node,node,function(){},{pathname:'/a'},x=>x);
   const mount=()=>factory({overlay:node(),getItems:()=>[],notify(){},refresh(){},isOpen:()=>false,renderItem(){}});
   const live=()=>listeners.filter(x=>!x.opts.signal?.aborted).map(x=>x.type);
   if(fault){
    assert.throws(mount,/injected/,fault);
    assert.deepEqual(live(),[],fault+' leaked global listeners');
    assert.equal(sessionReads,0,fault+' consumed resume read');
    fail=null;
   }
   assert.ok(mount());
   assert.deepEqual(live(),['scroll','pagehide','load','storage'],'one listener per event after success/retry');
   assert.equal(sessionReads,1);
  }
 }

// W68: local clear invalidates a queued writer, but unrelated storage events do not.
// Direct external clear is not serialized by Web Locks; only delivered events
// are covered by this guard, while applyStaged retains its byte-level checks.
{
 const source=readFileSync(resolve(root,'js/reader-library-storage.js'),'utf8');
 const start=source.indexOf('  function libraryFailure('),end=source.indexOf('  function libraryStoreSpec(',start);
 assert.ok(start>=0&&end>start);
 const localStorage={},queue=[];
 const navigator={locks:{request(name,options,fn){return new Promise(resolve=>queue.push(()=>resolve(fn({name}))))}}};
 class AbortController {constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}}
 const api=new Function('localStorage','navigator','AbortController','setTimeout','clearTimeout','NOTES_KEY',source.slice(start,end)+'return {withLibraryLock,onLibraryStorage};')(localStorage,navigator,AbortController,()=>1,()=>{},'notes');
 let writes=0;
 const task=()=>{writes++;return {ok:true}};
 const pending=api.withLibraryLock(task);
 api.onLibraryStorage({key:null,storageArea:localStorage});queue.shift()();
 assert.equal((await pending).reason,'storage-changed');assert.equal(writes,0);
 const fresh=api.withLibraryLock(task);queue.shift()();assert.equal((await fresh).ok,true);assert.equal(writes,1);
 const unrelated=api.withLibraryLock(task);
 api.onLibraryStorage({key:null,storageArea:{}});api.onLibraryStorage({key:'other',storageArea:localStorage});queue.shift()();
 assert.equal((await unrelated).ok,true);assert.equal(writes,2);
}

// W68: all mounted consumers honor the same native localStorage event,
// ignore sessionStorage and re-read current bytes rather than trust event payload.
{
 const coreSource=readFileSync(resolve(root,'js/highlights.js'),'utf8');
 const favoriteSource=readFileSync(resolve(root,'src/runtime/favorite-store.js'),'utf8');
 const researchSource=readFileSync(resolve(root,'js/reader-library-v3.js'),'utf8');
 const localStorage={},other={};
 const event=(key,storageArea=localStorage)=>({key,storageArea,newValue:'obsolete'});
 const a=coreSource.indexOf("    window.addEventListener('storage', e => {");
 const b=coreSource.indexOf("    document.addEventListener('astro:page-load'",a);
 assert.ok(a>=0&&b>a);
 let coreListener,syncs=0,undo=0,toastHidden=0,toastRemoved=0,timerCancelled=0;
 new Function('window','localStorage','editorController','clearTimeout','toast','hideToast','document','QUOTES_KEY','NOTES_KEY','FAVORITES_KEY','sync',coreSource.slice(a,b))(
  {addEventListener:(_,fn)=>coreListener=fn},localStorage,{clearUndo(){undo++;}},()=>timerCancelled++,{timer:1},()=>toastHidden++,{getElementById:()=>({replaceChildren(){toastRemoved++;}})},'q','n','f',()=>syncs++);
 coreListener(event(null,other));assert.equal(syncs,0);assert.equal(undo,0);
 coreListener(event('unrelated'));assert.equal(syncs,0);
 coreListener(event('q'));assert.equal(syncs,1);assert.equal(undo,0);
 coreListener(event(null));assert.equal(syncs,2);assert.equal(undo,1);assert.equal(toastHidden,1);assert.equal(toastRemoved,1);assert.equal(timerCancelled,1);
 const fa=favoriteSource.indexOf("  window.addEventListener('storage', (event) => {");
 const fb=favoriteSource.indexOf("  document.addEventListener('astro:page-load'",fa);
 assert.ok(fa>=0&&fb>fa);
 let favoriteListener,published=0;
 new Function('window','localStorage','STORAGE_KEY','publish','let clearGeneration=0;'+favoriteSource.slice(fa,fb))({addEventListener:(_,fn)=>favoriteListener=fn},localStorage,'f',()=>published++);
 favoriteListener(event(null,other));favoriteListener(event('q'));assert.equal(published,0);
 favoriteListener(event('f'));favoriteListener(event(null));assert.equal(published,2);
 const ra=researchSource.indexOf('  function onStorage(event) {');
 const rb=researchSource.indexOf('  const controller = Object.freeze({',ra);
 assert.ok(ra>=0&&rb>ra);
 let reads=[],refreshes=0,manager=0,cancels=0,imports=0,focuses=0;
 const tagEditor={hidden:false,contains:()=>true},menu={hidden:false};
 const keys={tags:'t',reading:'r',revisit:'v'},live={t:{new:'tag'},r:{},v:{new:'revisit'}};
 const factory=new Function('localStorage','KEYS','objectMap','parse','refresh','fillManager','clearTimeout','invalidateImport','tagEditor','menu','document','h',
  'let tags={old:1},reading={old:1},revisit={old:1},progressTimer=9,selectedItem={id:"old"};'+researchSource.slice(ra,rb)+'return {onStorage,state:()=>({tags,reading,revisit,progressTimer,selectedItem})};');
 const api=factory(localStorage,keys,x=>x,key=>{reads.push(key);return live[key]},()=>refreshes++,()=>manager++,()=>cancels++,()=>imports++,tagEditor,menu,{},()=>({focus(){focuses++;}}));
 api.onStorage(event(null,other));api.onStorage(event('q'));assert.equal(reads.length,0);
 api.onStorage(event('t'));assert.equal(reads.join(','),'t');assert.equal(refreshes,1);
 reads=[];
 api.onStorage(event(null));assert.equal(reads.join(','),'t,r,v');assert.equal(refreshes,2);assert.equal(manager,2);assert.equal(cancels,1);assert.equal(imports,1);
 assert.equal(api.state().tags.new,'tag');assert.equal(Object.keys(api.state().reading).length,0);assert.equal(api.state().revisit.new,'revisit');
 assert.equal(api.state().progressTimer,null);assert.equal(api.state().selectedItem,null);assert.equal(tagEditor.hidden,true);assert.equal(focuses,1);
}

// W69: exercise exact bootstrap functions across both lazy boundaries and
// reject expired Undo receipts, including those produced by the ARGON adapter.
{
 const source=readFileSync(resolve(root,'js/highlights.js'),'utf8');
 const start=source.indexOf('  function libraryFailure('),end=source.indexOf('  // Invalid historical rows',start);
 assert.ok(start>=0&&end>start);
 function scene(){
  let listener,loads=[],calls=0,held=null;
  const localStorage={},window={addEventListener:(type,fn)=>{assert.equal(type,'storage');listener=fn}};
  const receipt={key:'q',entry:{id:'q1'}};
  const owner={version:1,mutateLibrary:async()=>{calls++;return held?await held:{ok:true,receipt}}};
  const factory=()=>({createRecordTransactions:({mutateLibrary})=>({saveQuoteRecord:()=>mutateLibrary([],()=>{}),restoreDeleted:()=>mutateLibrary([],()=>{})})});
  const load=path=>new Promise(resolve=>loads.push(()=>{if(path.includes('record-transactions'))resolve(factory());else{window.GBLibraryStorage=owner;resolve({});}}));
  const api=new Function('window','localStorage','load','gbHighlightKey','NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES',source.slice(start,end).replace(/\bimport\(/g,'load(')+'return {mutateLibrary,transactionCall,restoreDeleted};')(window,localStorage,load,()=>'', 'n','q',500,200);
  return {api,loads,owner,window,receipt,calls:()=>calls,clear:()=>listener({key:null,storageArea:localStorage}),session:()=>listener({key:null,storageArea:{}}),hold:p=>held=p};
 }
 const s=scene(),cold=s.api.mutateLibrary([],()=>{});
 s.clear();s.loads.shift()();assert.equal((await cold).reason,'storage-changed');assert.equal(s.calls(),0);
 const t=scene(),tx=t.api.transactionCall('saveQuoteRecord');
 t.clear();t.loads.shift()();assert.equal((await tx).reason,'storage-changed');assert.equal(t.calls(),0);assert.equal(t.loads.length,0);
 const u=scene();u.window.GBLibraryStorage=u.owner;
 const r=await u.api.mutateLibrary([],()=>{});assert.equal(r.ok,true);assert.equal(r.receipt,u.receipt);
 const restore=u.api.restoreDeleted(r.receipt);u.loads.shift()();assert.equal((await restore).ok,true);
 u.clear();assert.equal((await u.api.restoreDeleted(r.receipt)).reason,'storage-changed');assert.equal(u.calls(),2);
 const v=scene();v.window.GBLibraryStorage=v.owner;
 let release;v.hold(new Promise(resolve=>release=resolve));
 const pending=v.api.mutateLibrary([],()=>{});v.clear();release({ok:true,receipt:v.receipt});
 assert.equal((await pending).reason,'storage-changed');assert.equal((await v.api.restoreDeleted(v.receipt)).ok,false);
 const w=scene(),fresh=w.api.mutateLibrary([],()=>{});w.session();w.loads.shift()();assert.equal((await fresh).ok,true);assert.equal(w.calls(),1);
}
// W69: research import acknowledgement never reinstates a stale merged map.
{
 const src=readFileSync(resolve(root,'js/reader-library-v3.js'),'utf8');
 const a=src.indexOf("    if (action === 'confirm-import') {"),b=src.indexOf("    if (action === 'topic')",a);
 assert.ok(a>=0&&b>a);
 for(const recovery of [false,true]){
  let release,notices=0,refreshes=0;
  const live={tags:{fresh:1},reading:{},revisit:{}};
  const deferred=new Promise(resolve=>release=resolve);
  const factory=new Function('atomicImport','atomicRecovery','objectMap','parse','KEYS','notify','refresh','recovery',
   'let pendingImport={recovery,raw:{},data:{}},importGeneration=1,importInFlight=false,confirm={disabled:false},confirmation={hidden:false},tags={},reading={},revisit={};async function run(action){'+src.slice(a,b)+'}return {run,clear(){importGeneration++;pendingImport=null;confirmation.hidden=true},state:()=>({tags,reading,revisit,disabled:confirm.disabled})};');
  const api=factory(()=>deferred,()=>deferred,x=>x,k=>live[k],{tags:'tags',reading:'reading',revisit:'revisit'},()=>notices++,()=>refreshes++,recovery);
  const p=api.run('confirm-import');api.clear();
  release({tags:{old:1},reading:{old:1},revisit:{old:1}});await p;
  assert.equal(api.state().tags.fresh,1);assert.equal(Object.keys(api.state().reading).length,0);assert.equal(Object.keys(api.state().revisit).length,0);assert.equal(notices,0);assert.equal(refreshes,1);assert.equal(api.state().disabled,false);
 }
}

// W69: a committed task can be cleared before the Web Lock result arrives.
// Its stale receipt must not be published as current, and partial errors survive.
{
 const source=readFileSync(resolve(root,'js/reader-library-storage.js'),'utf8');
 const a=source.indexOf('  function libraryFailure('),b=source.indexOf('  function libraryStoreSpec(',a);
 assert.ok(a>=0&&b>a);
 const localStorage={};let grant,ack,writes=0;
 const navigator={locks:{request(name,opts,fn){return new Promise(resolve=>{grant=()=>{const result=fn({name});ack=()=>resolve(result)}})}}};
 class AbortController{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}}
 const api=new Function('localStorage','navigator','AbortController','setTimeout','clearTimeout','NOTES_KEY',source.slice(a,b)+'return {withLibraryLock,onLibraryStorage};')(localStorage,navigator,AbortController,()=>1,()=>{},'notes');
 const run=async(result,clear)=>{const p=api.withLibraryLock(()=>{writes++;return result});grant();if(clear)api.onLibraryStorage({key:null,storageArea:localStorage});ack();return await p;};
 assert.equal((await run({ok:true,receipt:{}},true)).reason,'storage-changed');
 assert.equal((await run({ok:false,reason:'partial-write'},true)).reason,'partial-write');
 assert.equal((await run({ok:true},false)).ok,true);
 assert.equal(writes,3);
}

// W70: favorite Undo must not recreate an absent collection or use an
// issuer-local receipt after observed clear. Normal transfer still works
// before observed invalidation; this is not a persistent cross-tab epoch.
{
 const src=readFileSync(resolve(root,'src/runtime/favorite-store.js'),'utf8');
 const a=src.indexOf('  // Local Undo receipts'),b=src.indexOf('  function get(',a);
 const c=src.indexOf('  async function restore('),d=src.indexOf('  async function toggle(',c);
 const e=src.indexOf("  window.addEventListener('storage', (event) => {"),f=src.indexOf("  document.addEventListener('astro:page-load'",e);
 assert.ok(a>=0&&b>a&&c>=0&&d>c&&e>=0&&f>e);
 function scene(){
   let listener,raw='[]',writes=0,held=null;
   const localStorage={getItem:()=>raw};
   const receipt={path:'/a',entry:{path:'/a'},index:0};
   const owner={version:1,async mutateLibrary(keys,prepare){
     if(held)await held;
     const result=prepare({f:JSON.parse(raw||'[]')});
     if(result.reason)return {ok:false,reason:result.reason};
     if(result.changes?.f){raw=JSON.stringify(result.changes.f);writes++;}
     return {ok:true,...result.result};
   }};
   const window={GBLibraryStorage:owner,addEventListener:(_,fn)=>listener=fn};
   const api=new Function('window','localStorage','STORAGE_KEY','MAX_ITEMS','rawPath','match','finish','publish',
    src.slice(a,b)+src.slice(c,d)+src.slice(e,f)+'return {transact,restore};')(window,localStorage,'f',50,x=>x?.path,(rows,p)=>rows.filter(x=>x.path===p),result=>({saved:result.ok,error:result.reason,receipt:result.receipt}),()=>{});
   return {api,receipt,issue:()=>api.transact(()=>({changes:{},result:{receipt}})),clear(){raw=null;listener({storageArea:localStorage,key:null,newValue:null})},session(){listener({storageArea:{},key:null,newValue:null})},reset(){raw='[]'},writes:()=>writes,hold:p=>held=p};
 }
 const a1=scene();await a1.issue();assert.equal((await a1.api.restore(a1.receipt)).saved,true);
 const a2=scene();await a2.issue();a2.clear();a2.reset();assert.equal((await a2.api.restore(a2.receipt)).error,'storage-changed');assert.equal(a2.writes(),0);
 const a3=scene();assert.equal((await a3.api.restore({...a3.receipt})).saved,true);
 const a4=scene();a4.clear();a4.reset();assert.equal((await a4.api.restore({...a4.receipt})).error,'storage-changed');assert.equal(a4.writes(),0);
 const a5=scene();await a5.issue();let release;a5.hold(new Promise(resolve=>release=resolve));const p=a5.api.restore(a5.receipt);a5.clear();release();assert.equal((await p).error,'storage-changed');assert.equal(a5.writes(),0);
 const a6=scene();await a6.issue();a6.session();assert.equal((await a6.api.restore(a6.receipt)).saved,true);
 const a7=scene();a7.clear();a7.reset();await a7.issue();assert.equal((await a7.api.restore(a7.receipt)).saved,true);
}
// W70: ARGON invalidates Undo and recolor without touching the active draft.
{
 const src=readFileSync(resolve(root,'research/reader-w57-pilot/assets/reader_w57_annotations.js'),'utf8');
 const a=src.indexOf('    function onExternalLibraryStorage('),b=src.indexOf("    window.addEventListener('gb:library-committed'",a);
 assert.ok(a>=0&&b>a);
 const localStorage={},labels=[],messages=[],commits=[];let listener;
 const api=new Function('window','localStorage','palette','say','onLibraryCommit',
  'let lastUndo={},recolorGeneration=7,pendingRecolorId="q",pendingRecolorSnapshot="old",pendingNoteId="note",noteText={value:"draft"};'+src.slice(a,b)+'return ()=>({lastUndo,recolorGeneration,pendingRecolorId,pendingRecolorSnapshot,pendingNoteId,draft:noteText.value});')(
  {addEventListener:(_,fn)=>listener=fn},localStorage,{setAttribute:(_,v)=>labels.push(v)},x=>messages.push(x),k=>commits.push(k));
 listener({storageArea:{},key:null});assert.equal(commits.length,0);assert.equal(api().recolorGeneration,7);
 listener({storageArea:localStorage,key:'q'});assert.equal(commits.length,1);assert.equal(api().pendingRecolorId,'q');
 listener({storageArea:localStorage,key:null});assert.equal(commits.length,2);assert.equal(api().lastUndo,null);assert.equal(api().recolorGeneration,8);assert.equal(api().pendingRecolorId,null);assert.equal(api().pendingRecolorSnapshot,null);assert.equal(api().pendingNoteId,'note');assert.equal(api().draft,'draft');assert.equal(labels.at(-1),'Цвет выделения');assert.equal(messages.length,1);
}

// W70: obsolete favorite Undo promises and timers cannot reinstall a button
// or write a status into a newer presentation intent.
{
 const src=readFileSync(resolve(root,'js/reader-library-presenter.js'),'utf8');
 const a=src.indexOf('  let favoriteUndoTimer'),b=src.indexOf('  function exportMarkdown(',a);
 assert.ok(a>=0&&b>a);
 function scene(){
   const children=[],messages=[],timers=new Map(),buttons=[];
   let next=0,removeResolve,restoreResolve,restoreCalls=0,hidden=0;
   const host={append(node){if(node.parentNode)node.remove();children.push(node);node.parentNode=this},classList:{remove(){hidden++}}};
   const button=()=>{const node={disabled:false,parentNode:null,focus(){},remove(){const i=children.indexOf(this);if(i>=0)children.splice(i,1);this.parentNode=null},get isConnected(){return !!this.parentNode},addEventListener(_,fn){this.click=fn}};buttons.push(node);return node;};
   const status=message=>{while(children.length)children[0].remove();messages.push(message)};
   const store={get:()=>({}),remove:()=>new Promise(resolve=>removeResolve=resolve),restore:()=>{restoreCalls++;return new Promise(resolve=>restoreResolve=resolve)}};
   const api=new Function('window','document','button','setTimeout','clearTimeout',src.slice(a,b)+'return {removeFavorite,clearFavoriteUndo};')(
    {GBFavoriteStore:store},{querySelector:id=>id==='#gb-hl-status'?host:{focus(){}}},button,fn=>{timers.set(++next,fn);return next},id=>timers.delete(id));
   return {api,children,messages,timers,buttons,hidden:()=>hidden,restoreCalls:()=>restoreCalls,
    start:()=>api.removeFavorite({id:'/a'},status),finish:()=>removeResolve({saved:false,receipt:{}}),settle:result=>restoreResolve(result),status};
 }
 const a1=scene(),p=a1.start();a1.api.clearFavoriteUndo();a1.finish();await p;
 assert.equal(a1.buttons.length,0);assert.equal(a1.messages.length,0);
 const a2=scene(),q=a2.start();a2.finish();await q;
 const undo=a2.buttons[0],oldTimer=[...a2.timers.values()][0];assert.equal(undo.isConnected,true);
 const pending=undo.click();a2.api.clearFavoriteUndo();a2.status('new');a2.settle({saved:false,error:'storage-changed'});await pending;
 assert.equal(a2.children.length,0);assert.equal(a2.messages.at(-1),'new');oldTimer();assert.equal(a2.hidden(),0);
 await undo.click();assert.equal(a2.restoreCalls(),1);
 const a3=scene(),r=a3.start();a3.finish();await r;
 const active=a3.buttons[0],save=active.click();a3.settle({saved:true});await save;
 assert.equal(a3.messages.at(-1),'Статья восстановлена.');assert.equal(active.isConnected,false);
 const a4=scene(),s=a4.start();a4.finish();await s;
 const expired=a4.buttons[0];[...a4.timers.values()][0]();assert.equal(expired.isConnected,false);assert.equal(a4.hidden(),1);
 await expired.click();assert.equal(a4.restoreCalls(),0);
 const a5=scene(),t=a5.start();a5.finish();await t;
 a5.status('newer status');[...a5.timers.values()][0]();assert.equal(a5.hidden(),0);assert.equal(a5.messages.at(-1),'newer status');
}

// W71: prewarming fetches the module, not a DOM/event owner. Live selection
// is checked again after import; failed attach can retry without another fetch.
{
 const src=readFileSync(resolve(root,'js/highlights.js'),'utf8');
 const a=src.indexOf('  let selectionController, selectionLoad;'),b=src.indexOf('  // Prewarm long-press',a);
 assert.ok(a>=0&&b>a);
 function scene(){
   let pending=[],live=false,loads=0,creates=0,attaches=0,places=0,failAttach=false;
   const window={getSelection:()=>live?{isCollapsed:false,rangeCount:1,toString:()=> 'long selected text'}:null};
   const names='MARK_COLORS,penSvg,rememberSelection,selection,open,showEditor,hideToast,element,uid,currentTitle,normalizeText,transactionCall,gbHighlightKey,gbAddHighlight,gbHighlightPath,gbFragmentKey,gbContextKey,GBReaderAnchors,locate,textIndex,paintMarks,sync,statusMessage,toast,quotes'.split(',');
   const deps=names.map(n=>n==='normalizeText'?s=>s:()=>{});
   const load=()=>{loads++;return new Promise((resolve,reject)=>pending.push({resolve,reject}))};
   const module={createSelectionController(){creates++;return {attachSelection(){attaches++;if(failAttach)throw Error('mount');},placeSelectionBar(){places++}}}};
   const api=new Function('window','load',...names,src.slice(a,b).replace(/\bimport\(/g,'load(')+'return {attachSelection,loadSelectionController};')(window,load,...deps);
   return {api,pending,module,live:v=>live=v,fail:v=>failAttach=v,stats:()=>[loads,creates,attaches,places]};
 }
 const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
 const s=scene(),pre=s.api.loadSelectionController();
 s.pending[0].resolve(s.module);await pre;await flush();assert.deepEqual(s.stats(),[1,0,0,0]);
 s.live(true);s.api.attachSelection();s.api.attachSelection();await flush();assert.deepEqual(s.stats(),[1,1,1,1]);
 s.api.attachSelection();assert.deepEqual(s.stats(),[1,1,2,1]);
 const t=scene();t.live(true);t.api.attachSelection();t.live(false);t.pending[0].resolve(t.module);await flush();assert.deepEqual(t.stats(),[1,0,0,0]);
 t.live(true);t.api.attachSelection();await flush();assert.deepEqual(t.stats(),[1,1,1,1]);
 const f=scene();f.live(true);f.api.attachSelection();f.pending[0].reject(Error('offline'));await flush();assert.deepEqual(f.stats(),[1,0,0,0]);
 f.api.attachSelection();f.fail(true);f.pending[1].resolve(f.module);await flush();assert.deepEqual(f.stats(),[2,1,1,0]);
 f.fail(false);f.api.attachSelection();await flush();assert.deepEqual(f.stats(),[2,2,2,1]);
}
// W71: text fragment construction is only owned by the lazy selection module.
{
 const src=readFileSync(resolve(root,'js/reader-library-selection.js'),'utf8');
 const a=src.indexOf('  function fragment(text)'),b=src.indexOf('  // Both touch selection-bar notes',a);
 assert.ok(a>=0&&b>a);
 const fn=new Function('location','normalizeText',src.slice(a,b)+'return sourceUrl;')({origin:'https://example.test',pathname:'/article'},s=>String(s).replace(/\s+/g,' ').trim());
 assert.equal(fn({anchor:'a b',text:'short text'}),'https://example.test/article#a%20b:~:text=short%20text');
 const words=Array.from({length:15},(_,i)=>'word'+(i+1)).join(' ');
 assert.equal(fn({anchor:'',text:words}),'https://example.test/article#:~:text=word1%20word2%20word3%20word4%20word5%20word6,word10%20word11%20word12%20word13%20word14%20word15');
}

// W72: a successful Undo consumes its local receipt; concurrent retries
// cannot queue the same receipt, while a failed attempt may be retried.
{
 const src=readFileSync(resolve(root,'src/runtime/favorite-store.js'),'utf8');
 const a=src.indexOf('  // Local Undo receipts'),b=src.indexOf('  function get(',a);
 const c=src.indexOf('  async function restore('),d=src.indexOf('  async function toggle(',c);
 assert.ok(a>=0&&b>a&&c>=0&&d>c);
 function scene(){
   let rows=[],writes=0,held=null,fail=false;
   const localStorage={getItem:()=>JSON.stringify(rows)};
   const receipt={path:'/a',entry:{path:'/a'},index:0};
   const owner={version:1,async mutateLibrary(keys,prepare){
     if(held)await held;
     if(fail)return {ok:false,reason:'capacity'};
     const result=prepare({f:rows});
     if(result.reason)return {ok:false,reason:result.reason};
     if(result.changes?.f){rows=result.changes.f;writes++;}
     return {ok:true,...result.result};
   }};
   const api=new Function('window','localStorage','STORAGE_KEY','MAX_ITEMS','rawPath','match','finish',
    src.slice(a,b)+src.slice(c,d)+'return {transact,restore};')({GBLibraryStorage:owner},localStorage,'f',50,x=>x?.path,(rows,p)=>rows.filter(x=>x.path===p),result=>({saved:result.ok,error:result.reason,receipt:result.receipt}));
   return {api,receipt,issue:()=>api.transact(()=>({changes:{},result:{receipt}})),remove:()=>{rows=[];},writes:()=>writes,hold:p=>held=p,fail:v=>fail=v};
 }
 const f=scene();await f.issue();assert.equal((await f.api.restore(f.receipt)).saved,true);
 f.remove();assert.equal((await f.api.restore(f.receipt)).error,'storage-changed');assert.equal(f.writes(),1);
 const t=scene();const transferred={...t.receipt};assert.equal((await t.api.restore(transferred)).saved,true);
 t.remove();assert.equal((await t.api.restore(transferred)).error,'storage-changed');assert.equal(t.writes(),1);
 const p=scene();await p.issue();let release;p.hold(new Promise(resolve=>release=resolve));
 const pending=p.api.restore(p.receipt);assert.equal((await p.api.restore(p.receipt)).error,'restore-pending');release();
 assert.equal((await pending).saved,true);assert.equal(p.writes(),1);
 const r=scene();await r.issue();r.fail(true);assert.equal((await r.api.restore(r.receipt)).error,'capacity');
 r.fail(false);assert.equal((await r.api.restore(r.receipt)).saved,true);assert.equal(r.writes(),1);
}
// W72: main library consumes only its own successfully restored receipt.
{
 const src=readFileSync(resolve(root,'js/highlights.js'),'utf8');
 const a=src.indexOf('  function libraryFailure('),b=src.indexOf('  // Invalid historical rows',a);
 assert.ok(a>=0&&b>a);
 let result={ok:true},writes=0,release,held=null;
 const receipt={key:'q',entry:{id:'a'}};
 const owner={version:1,mutateLibrary:async()=>({ok:true,receipt})};
 const win={GBLibraryStorage:owner,addEventListener(){}};
 const domain={restoreDeleted:async()=>{writes++;if(held)await held;return result}};
 const api=new Function('window','localStorage','load','gbHighlightKey','NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES',
  src.slice(a,b).replace(/\bimport\(/g,'load(')+'return {mutateLibrary,restoreDeleted};')(win,{},async()=>({createRecordTransactions:()=>domain}),()=>'', 'n','q',500,200);
 await api.mutateLibrary([],()=>{});
 result={ok:false,reason:'capacity'};assert.equal((await api.restoreDeleted(receipt)).reason,'capacity');
 result={ok:true};held=new Promise(resolve=>release=resolve);
 const pending=api.restoreDeleted(receipt);
 assert.equal((await api.restoreDeleted(receipt)).reason,'restore-pending');release();assert.equal((await pending).ok,true);
 assert.equal((await api.restoreDeleted(receipt)).reason,'storage-changed');assert.equal(writes,2);
}
