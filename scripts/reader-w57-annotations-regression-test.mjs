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
const ownerSource=highlights.slice(highlights.indexOf('  function libraryFailure('),highlights.indexOf('  function quotes() {'));
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
  'localStorage','navigator','window','CustomEvent','AbortController','setTimeout','clearTimeout',
  ownerSource+'return {mutateLibrary,commit};');
 windowFixture.GBHighlights=makeOwner(nKey,qKey,500,200,localStorageFixture,navigatorFixture,
  windowFixture,CustomEventFixture,AbortControllerFixture,timer,cancel);
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
const deleteStart=highlights.indexOf('  async function deleteItem(item) {');
const deleteEnd=highlights.indexOf('    render(); sync();\n    const undoButton',deleteStart);
assert.ok(deleteStart>=0&&deleteEnd>deleteStart,'Product delete source boundaries');
const deleteSource=highlights.slice(deleteStart,deleteEnd)+'return pendingUndo;\n}';
const removeProduct=(f,item)=>new Function('mutateLibrary','NOTES_KEY','QUOTES_KEY',
 'statusMessage','clearUndo','let pendingUndo;\n'+deleteSource+'\nreturn deleteItem;')(
 f.owner.mutateLibrary,nKey,qKey,()=>{},()=>{})(item);
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
const saveStart=highlights.indexOf('  async function saveNote(e) {');
const saveEnd=highlights.indexOf('  function applySavedNote(editing)',saveStart);
assert.ok(saveStart>=0&&saveEnd>saveStart,'Product save source boundaries');
const saveSource=highlights.slice(saveStart,saveEnd);
const saveProduct=async(f,opened,context=null)=>{
 let applied=false;const textArea={value:'edited'};
 const draft={context,editing:opened?{id:String(opened.id),text:opened.text,recordSnapshot:JSON.stringify(opened)}:null};
 const run=new Function('textArea','draft','uid','currentTitle','location','mutateLibrary','NOTES_KEY','QUOTES_KEY',
  'LIMIT_NOTES','statusMessage','applySavedNote',saveSource+'\nreturn saveNote;')(
  textArea,draft,()=>'fresh-id',()=>'Article',{origin:'https://example.test',pathname:'/a'},
  f.owner.mutateLibrary,nKey,qKey,500,()=>{},()=>{applied=true});
 await run({preventDefault(){}});
 return{applied,draftText:textArea.value};
};
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

console.log('Reader W57 notes: anchoring/edit/quota/rollback + W94a concurrent edit guards PASS');
