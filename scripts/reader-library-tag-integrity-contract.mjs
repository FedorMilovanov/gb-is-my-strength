import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
globalThis.location={origin:'https://gospod-bog.ru'};
const source=fs.readFileSync(path.join(root,'js/reader-library-v3.js'),'utf8');
const {safeTags,boundedTags,safeMerge,validateBackup,atomicImport,serializeCurrent,mutateResearch,appendTag,changeReading,updateProgress,updateRevisit,validateRecovery,serializeRecovery,atomicRecovery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const labels=Array.from({length:20},(_,i)=>'Тема '+(i+1));
assert.deepEqual(boundedTags(['Тема 1',...labels]),labels);
assert.deepEqual(safeTags(['Новая','НОВАЯ']),['Новая']);
assert.throws(()=>boundedTags([...labels,'Тема 21']),/20 уникальных/);
const note={id:'N',text:'Заметка',url:'/articles/lot-i-sodom/'};
const old={quotes:[],notes:[note],favorites:[],tags:{'note:N':['Тема 1']},reading:{},revisit:{suppressed:{}}};
const incoming={quotes:[],notes:[note],favorites:[],tags:{'note:N':labels},reading:{},revisit:{suppressed:{}}};
const merged=safeMerge(old,incoming);
assert.deepEqual(merged.tags['note:N'],labels);
assert.equal(merged.notes.length,1);
assert.deepEqual(safeMerge(merged,incoming).tags['note:N'],labels);
const tooMany={...incoming,tags:{'note:N':[...labels,'Тема 21']}};
assert.throws(()=>safeMerge(old,tooMany),/20 уникальных/);
assert.deepEqual(validateBackup({format:'gospod-bog-reader-library',version:3,data:incoming}).tags['note:N'],labels);
assert.throws(()=>validateBackup({format:'gospod-bog-reader-library',version:3,data:tooMany}),/20 уникальных/);

const q1={id:'Q',text:'same',url:'/a/',savedAt:123,extra:{legacy:true}};
const q2={...q1,id:'Q2',extra:{legacy:false}};
const numeric={id:42,text:'legacy note',quoteId:'Q',savedAt:0};
const legacy={...old,quotes:[q1,q2],notes:[numeric,{id:'dup',text:'A'},{id:'dup',text:'B'}],tags:{'note:dup':[' raw ',' raw ']},revisit:{}};
const empty={quotes:[],notes:[],favorites:[],tags:{},reading:{},revisit:{}};
assert.deepEqual(safeMerge(legacy,empty),legacy,'empty backup cannot dedupe or rewrite legacy rows');
assert.deepEqual(safeMerge(legacy,{...empty,quotes:[q1]}),legacy,'identical single record is idempotent');
assert.throws(()=>safeMerge(legacy,{...empty,notes:[{id:'42',text:'other'}]}),/Конфликт идентификаторов/);
assert.throws(()=>safeMerge(legacy,{...empty,notes:[{id:'dup',text:'A'}]}),/Конфликт идентификаторов/);
assert.throws(()=>safeMerge(legacy,{...empty,quotes:[{...q1,text:'different'}]}),/Конфликт идентификаторов/);
const validated=validateBackup({format:'gospod-bog-reader-library',version:3,data:{...empty,quotes:[q1],notes:[numeric]}});
assert.deepEqual(validated.quotes,[q1]);assert.deepEqual(validated.notes,[numeric]);
assert.throws(()=>validateBackup({format:'gospod-bog-reader-library',version:3,data:{...empty,notes:[{id:'X'.repeat(111),text:'x'}]}}),/Некорректная заметка/);
assert.throws(()=>safeMerge(legacy,{...empty,notes:[{id:'new',text:'x',quoteId:'Q'}]}),/Конфликт связей/);
const filled={...empty,quotes:Array.from({length:201},(_,i)=>({id:'q'+i,text:'x'+i}))};
assert.deepEqual(safeMerge(filled,empty),filled);
assert.throws(()=>safeMerge(filled,{...empty,quotes:[{id:'new',text:'new'}]}),/Превышен лимит/);

assert.throws(()=>validateBackup({format:'gospod-bog-reader-library',version:3,data:{...empty,tags:[]}}),/Некорректный раздел/);
assert.throws(()=>validateBackup({format:'gospod-bog-reader-library',version:3,data:{...empty,revisit:{suppressed:[]}}}),/Некорректные исключения/);
const aliasOld={...empty,favorites:[{path:'/a/index.html',title:'legacy'}]};
assert.deepEqual(safeMerge(aliasOld,{...empty,favorites:[{path:'/a/',title:'incoming'}]}),aliasOld);

// Execute actual shared owner plus actual import, not a duplicate planner.
const hsrc=fs.readFileSync(path.join(root,'js/highlights.js'),'utf8');
const sharedStorage=fs.readFileSync(path.join(root,'js/reader-library-storage.js'),'utf8');
const ownerSource=sharedStorage.slice(sharedStorage.indexOf('  function libraryFailure('),sharedStorage.indexOf('  window.GBLibraryStorage ='));
assert.ok(ownerSource.includes('function libraryStoreSpec('));
const keys={quotes:'gb-highlights-v1',notes:'gb-reader-notes-v1',favorites:'gb-favorites',tags:'gb-library-tags-v1',reading:'gb-library-reading-v1',revisit:'gb-library-revisit-v1'};
const fixture=(seed={},options={})=>{
 const raw=new Map(Object.entries(seed).map(([name,value])=>[keys[name],typeof value==='string'?value:JSON.stringify(value)]));
 const writes=[];
 let queue=Promise.resolve();
 const storage={getItem:k=>raw.has(k)?raw.get(k):null,setItem:(k,v)=>{
  if(k===options.failKey) {
   if(options.onFailure)options.onFailure(raw);
   throw Error('QuotaExceededError');
  }
  raw.set(k,String(v));writes.push(k);
 },removeItem:k=>{raw.delete(k);writes.push(k)}};
 const nav=options.noLock?{}:{locks:{request:(name,opts,fn)=>{
  assert.equal(name,'gb-library:'+keys.notes);
  const run=queue.then(()=>fn({name}));queue=run.catch(()=>{});return run;
 }}};
 const owner=new Function('NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES','localStorage','navigator','window','CustomEvent','AbortController','setTimeout','clearTimeout','gbHighlightKey',ownerSource+'return {mutateLibrary,snapshotRaw,restoreRaw};')(keys.notes,keys.quotes,500,200,storage,nav,{dispatchEvent:()=>{}},class{},AbortController,()=>1,()=>{},x=>x?.text);
 const install=()=>{globalThis.window={GBHighlights:owner}};
 const snapshot=()=>Object.fromEntries(Object.values(keys).map(k=>[k,storage.getItem(k)]));
 return {owner,install,raw,writes,snapshot};
};
const envelope={version:1,custom:'preserve',items:[{path:'/a/',title:'old'}]};
const f=fixture({quotes:'[ {"id":"A","text":"a"} ]',notes:[numeric],favorites:envelope,tags:{'note:42':['old']}});
f.install();
const before=f.snapshot();
await atomicImport(empty);
assert.deepEqual(f.snapshot(),before,'empty import preserves exact raw bytes and missing stores');
assert.deepEqual(f.writes,[]);
const extra={...empty,notes:[{id:'B',text:'B'}],favorites:[{path:'/b/',title:'new'}],tags:{'note:B':['new']}};
await Promise.all([
 f.owner.mutateLibrary([keys.notes],s=>({changes:{[keys.notes]:[...s[keys.notes],{id:'C',text:'concurrent'}]}})),
 atomicImport(extra)
]);
assert.deepEqual(JSON.parse(f.raw.get(keys.notes)).map(x=>x.id),[42,'C','B']);
assert.equal(f.raw.get(keys.quotes),before[keys.quotes],'unchanged quote bytes stay exact');
assert.deepEqual(JSON.parse(f.raw.get(keys.favorites)),{...envelope,items:[...envelope.items,extra.favorites[0]]});
const committed=f.snapshot();
await atomicImport(extra);
assert.deepEqual(f.snapshot(),committed,'idempotent repeated import');
await assert.rejects(atomicImport({...empty,notes:[{id:'42',text:'different'}]}),/Конфликт идентификаторов/);
assert.deepEqual(f.snapshot(),committed);
await assert.rejects(atomicImport({...empty,notes:[{id:'D',text:'cancel'}]},()=>false),/Импорт не завершён/);
assert.deepEqual(f.snapshot(),committed);
const corrupt=fixture({quotes:'{broken'});corrupt.install();const corruptBefore=corrupt.snapshot();
await assert.rejects(atomicImport(extra),/Импорт не завершён/);assert.deepEqual(corrupt.snapshot(),corruptBefore);assert.deepEqual(corrupt.writes,[]);
const refused=fixture({notes:[numeric]},{noLock:true});refused.install();const refusedBefore=refused.snapshot();
await assert.rejects(atomicImport(extra),/Импорт не завершён/);assert.deepEqual(refused.snapshot(),refusedBefore);
const backup={...empty,quotes:[q1],notes:[{id:'N',text:'new'}],tags:{'note:N':['tag']}};
const rollback=fixture({notes:[numeric]},{failKey:keys.tags});rollback.install();const rollbackBefore=rollback.snapshot();
await assert.rejects(atomicImport(backup),/Импорт не завершён/);
assert.deepEqual(rollback.snapshot(),rollbackBefore,'failed later key restores exact own previous bytes');
const concurrent=[numeric,{id:'external',text:'newer'}];
const partial=fixture({notes:[numeric]},{failKey:keys.tags,onFailure:raw=>raw.set(keys.notes,JSON.stringify(concurrent))});
partial.install();
await assert.rejects(atomicImport(backup),/Ошибка импорта и отката/);
assert.deepEqual(JSON.parse(partial.raw.get(keys.notes)),concurrent,'rollback must not overwrite intervening external write');
assert.equal(partial.raw.has(keys.quotes),false);

const metadata=fixture({tags:{'note:42':[' raw ',' raw ']},reading:{'/old':{state:'reading',updatedAt:1,extra:'keep'}},revisit:{suppressed:{old:true}}});
metadata.install();
await Promise.all([
 mutateResearch('tags',map=>appendTag(map,'note:42','new-a')),
 mutateResearch('tags',map=>appendTag(map,'note:42','new-b')),
]);
assert.deepEqual(JSON.parse(metadata.raw.get(keys.tags))['note:42'],[' raw ',' raw ','new-a','new-b']);
const tagBefore=metadata.snapshot();
assert.equal((await mutateResearch('tags',map=>appendTag(map,'note:42','NEW-A'))).ok,false);
assert.deepEqual(metadata.snapshot(),tagBefore);
const expected=JSON.parse(metadata.raw.get(keys.reading))['/old'];
await Promise.all([
 mutateResearch('reading',map=>changeReading(map,'/new','reading','new',10)),
 mutateResearch('reading',map=>changeReading(map,'/old','finished','old',11)),
]);
const readingAfter=JSON.parse(metadata.raw.get(keys.reading));
assert.equal(readingAfter['/new'].state,'reading');
assert.equal(readingAfter['/old'].state,'finished');
assert.equal(readingAfter['/old'].extra,'keep');
assert.equal((await mutateResearch('reading',map=>updateProgress(map,'/old',expected,{ratio:.5,updatedAt:12}))).ok,false);
assert.deepEqual(JSON.parse(metadata.raw.get(keys.reading)),readingAfter);
await Promise.all([
 mutateResearch('revisit',map=>updateRevisit(map,'never-quote','A')),
 mutateResearch('revisit',map=>updateRevisit(map,'never-quote','B')),
 mutateResearch('revisit',map=>updateRevisit(map,'hide-today','2026-11-24')),
]);
assert.deepEqual(JSON.parse(metadata.raw.get(keys.revisit)),{suppressed:{old:true,A:true,B:true},hiddenDate:'2026-11-24'});
const exportBefore=metadata.snapshot();
const exported=await serializeCurrent();
assert.deepEqual(exported.tags,JSON.parse(exportBefore[keys.tags]));
assert.deepEqual(exported.reading,readingAfter);
assert.deepEqual(metadata.snapshot(),exportBefore,'export is a read-only snapshot');
corrupt.install();await assert.rejects(serializeCurrent(),/Экспорт отменён/);assert.deepEqual(corrupt.snapshot(),corruptBefore);
refused.install();await assert.rejects(serializeCurrent(),/Экспорт отменён/);assert.deepEqual(refused.snapshot(),refusedBefore);
assert.equal((await mutateResearch('tags',map=>appendTag(map,'note:42','refused'))).ok,false);
assert.deepEqual(refused.snapshot(),refusedBefore);
assert.doesNotMatch(source,/localStorage\.(?:setItem|removeItem)\s*\(/,'v3 has no raw storage writer');

// Exact recovery is separate from merge import. Preserve even invalid legacy
// rows and envelope metadata; refuse different existing sections or bad JSON.
const rawSeed=fixture({quotes:'[ {"id":"Q","text":"old"}, null ]',notes:[numeric],
 favorites:{version:1,custom:'preserve',items:[{path:'/a/',extra:'raw'},null]},tags:{'note:42':[' raw ',' raw ']}});
rawSeed.install();
const archive=await serializeRecovery();
assert.deepEqual(archive.raw,rawSeed.snapshot());
assert.deepEqual(validateRecovery(JSON.parse(JSON.stringify(archive))),archive.raw);
assert.throws(()=>validateRecovery({...archive,raw:{...archive.raw,other:'x'}}),/Некорректная аварийная/);
assert.throws(()=>validateRecovery({...archive,raw:{...archive.raw,[keys.notes]:42}}),/Некорректная аварийная/);
const target=fixture();target.install();
assert.equal(await atomicRecovery(archive.raw),4);
assert.deepEqual(target.snapshot(),archive.raw);
const writesBefore=target.writes.length;
assert.equal(await atomicRecovery(archive.raw),0);
assert.equal(target.writes.length,writesBefore);
const occupied=fixture({notes:[{id:'other',text:'newer'}]});occupied.install();
const occupiedBefore=occupied.snapshot();
await assert.rejects(atomicRecovery(archive.raw),/отличается/);
assert.deepEqual(occupied.snapshot(),occupiedBefore);assert.deepEqual(occupied.writes,[]);
const cancelled=fixture();cancelled.install();
await assert.rejects(atomicRecovery(archive.raw,()=>false),/не завершено/);
assert.deepEqual(cancelled.writes,[]);
const broken=fixture({quotes:'{bad'});broken.install();
const brokenArchive=await serializeRecovery();assert.equal(brokenArchive.raw[keys.quotes],'{bad');
target.install();
const blankTarget=fixture();blankTarget.install();
await assert.rejects(atomicRecovery(brokenArchive.raw),/повреждённый раздел/);
assert.deepEqual(blankTarget.writes,[]);
const recoveryQuota=fixture({},{failKey:keys.tags});recoveryQuota.install();
const recoveryBefore=recoveryQuota.snapshot();
await assert.rejects(atomicRecovery(archive.raw),/не завершено/);
assert.deepEqual(recoveryQuota.snapshot(),recoveryBefore);
const projection=hsrc.slice(hsrc.indexOf('  function visibleRecord('),hsrc.indexOf('  function currentTitle('));
const rawRows=[{id:42,text:'legacy',url:'/a/'},null,{unknown:true},'invalid',{id:'ok',text:'new'}];
const beforeRows=JSON.stringify(rawRows);
const projected=new Function('read','QUOTES_KEY','NOTES_KEY','FAVORITES_KEY','window','location','MARK_COLORS',projection+'return {quotes,notes,favorites,all};')(()=>rawRows,keys.quotes,keys.notes,keys.favorites,{},location,['amber']);
assert.deepEqual(projected.quotes().map(x=>x.id),[42,'ok']);
assert.deepEqual(projected.notes().map(x=>x.id),[42,'ok']);
assert.equal(projected.all().length,5);
assert.equal(JSON.stringify(rawRows),beforeRows,'read projection never rewrites legacy rows');
console.log('READER LIBRARY TAG, RECORD, IMPORT, METADATA AND EXACT RECOVERY INTEGRITY: PASS');
