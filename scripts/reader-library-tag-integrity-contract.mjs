import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
globalThis.location={origin:'https://gospod-bog.ru'};
const source=fs.readFileSync(path.join(root,'js/reader-library-v3.js'),'utf8');
const {safeTags,boundedTags,safeMerge,validateBackup,atomicImport,serializeCurrent,mutateResearch,appendTag,changeReading,updateProgress,updateRevisit,validateRecovery,serializeRecovery,atomicRecovery}=await import(pathToFileURL(path.join(root,'js/reader-library-v3.js')).href);
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
  if(options.afterWrite)options.afterWrite(raw,k,String(v));
 },removeItem:k=>{raw.delete(k);writes.push(k)}};
 const nav=options.noLock?{}:{locks:{request:(name,opts,fn)=>{
  assert.equal(name,'gb-library:'+keys.notes);
  const run=queue.then(()=>fn({name}));queue=run.catch(()=>{});return run;
 }}};
 const owner=new Function('NOTES_KEY','QUOTES_KEY','LIMIT_NOTES','LIMIT_QUOTES','localStorage','navigator','window','CustomEvent','AbortController','setTimeout','clearTimeout','gbHighlightKey',ownerSource+'return {mutateLibrary,snapshotRaw,restoreRaw};')(keys.notes,keys.quotes,500,200,storage,nav,{dispatchEvent:()=>{},addEventListener:()=>{}},class{},AbortController,()=>1,()=>{},x=>x?.text);
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
assert.doesNotMatch(source+'\n'+fs.readFileSync(path.join(root,'js/reader-library-research-core.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'js/reader-library-navigation.js'),'utf8'),/localStorage\.(?:setItem|removeItem)\s*\(/,'research UI and core have no raw storage writer');

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
const projection=hsrc.slice(hsrc.indexOf('  function visibleRecord('),hsrc.indexOf('  function rememberShareText('));
const rawRows=[{id:42,text:'legacy',url:'/a/'},null,{unknown:true},'invalid',{id:'ok',text:'new'}];
const beforeRows=JSON.stringify(rawRows);
const projected=new Function('read','QUOTES_KEY','NOTES_KEY','FAVORITES_KEY','window','location','MARK_COLORS',projection+'return {quotes,notes,favorites,all};')(()=>rawRows,keys.quotes,keys.notes,keys.favorites,{},location,['amber']);
assert.deepEqual(projected.quotes().map(x=>x.id),[42,'ok']);
assert.deepEqual(projected.notes().map(x=>x.id),[42,'ok']);
assert.equal(projected.all().length,5);
assert.equal(JSON.stringify(rawRows),beforeRows,'read projection never rewrites legacy rows');
console.log('READER LIBRARY TAG, RECORD, IMPORT, METADATA AND EXACT RECOVERY INTEGRITY: PASS');


// W31–W36: new regressions on actual owner, with no legacy rewriting.
const w36pack = data => validateBackup({format:'gospod-bog-reader-library',version:3,data:{...empty,...data}});
let w36cases=0;
async function w36refuse(f, data, pattern) {
  f.install(); const before=f.snapshot();
  await assert.rejects(async()=>atomicImport(w36pack(data)),pattern);
  assert.deepEqual(f.snapshot(),before); assert.deepEqual(f.writes,[]);
  w36cases++;
}
const w36route='/articles/example', w36a={state:'reading',title:'A',anchor:'first',ratio:.3,updatedAt:1000}, w36b={state:'finished',title:'A',anchor:'last',ratio:1,updatedAt:2000};
const w36note={id:'W36-companion',text:'must not commit on refusal'};
for (const reading of [{[w36route]:w36a,[w36route+'/']:w36b},{[w36route+'/']:w36b,[w36route]:w36a},{[w36route]:w36a,['https://gospod-bog.ru'+w36route+'/']:w36b}])
  await w36refuse(fixture(),{reading,notes:[w36note]},/Конфликт адресов статей в резервной копии/);
await w36refuse(fixture({reading:{[w36route+'/']:w36b}}),{reading:{[w36route]:w36a},notes:[w36note]},/Конфликт адресов статей в сохранённой библиотеке/);
assert.deepEqual(Object.keys(w36pack({reading:{[w36route]:w36a,[w36route+'/']:w36a}}).reading),[w36route]);w36cases++;
assert.equal(Object.keys(w36pack({reading:{[w36route]:w36a,'/other/':w36b}}).reading).length,2);w36cases++;
{
 const f=fixture({reading:{[w36route]:w36b}});f.install();await atomicImport(w36pack({reading:{[w36route]:w36a}}));assert.deepEqual(JSON.parse(f.raw.get(keys.reading)),{[w36route]:w36b});assert.ok(!f.writes.includes(keys.reading));w36cases++;
}
{
 const f=fixture({reading:{[w36route+'/']:w36b}});f.install();await atomicImport(w36pack({reading:{'/other/':w36a}}));assert.deepEqual(JSON.parse(f.raw.get(keys.reading)),{[w36route+'/']:w36b,'/other':w36a});w36cases++;
}
{
 const f=fixture({reading:{[w36route+'/']:w36b}});f.install();const before=f.snapshot();await atomicImport(empty);assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.writes,[]);w36cases++;
}
const w36norm=hsrc.slice(hsrc.indexOf('  function normalizeText('),hsrc.indexOf('  let rangeRuntime'));
const w36keySource=hsrc.slice(hsrc.indexOf('  function gbHighlightPath('),hsrc.indexOf('  function gbDedupeHighlights('));
assert.ok(w36norm.includes('function normalizeText('));assert.ok(w36keySource.includes('function gbHighlightKey('));
const w36key=new Function('location',w36norm+w36keySource+'return gbHighlightKey;')(location);
const w36p={id:'W36-A',text:'same exact words',url:'/articles/example/',annotation:{version:1,kind:'marker',color:'amber',anchor:{blockId:'p-1',blockIndex:0,start:2,end:18,exact:'same exact words'},noteId:null}};
const w36d={...w36p,id:'W36-B',url:'/articles/example',annotation:{...w36p.annotation,color:'rose'}};
const w36other={...w36d,id:'W36-C',annotation:{...w36d.annotation,anchor:{...w36d.annotation.anchor,blockId:'p-2',blockIndex:1}}};
assert.equal(w36key(w36p),w36key(w36d));assert.ok(w36key(w36p)!==w36key(w36other));
function w36pos(seed={}){const f=fixture(seed),install=f.install;f.install=()=>{install();window.GBHighlights.highlightKey=w36key;};return f;}
for(const quotes of [[w36p,w36d],[w36d,w36p]])await w36refuse(w36pos(),{quotes,notes:[w36note]},/Конфликт позиций/);
await w36refuse(w36pos({quotes:[w36p]}),{quotes:[w36d],notes:[w36note]},/Конфликт позиций/);
for(const [seed,quotes,expected] of [
 [[w36p,w36d],[w36other],[w36p,w36d,w36other]],
 [[w36p,w36d],[w36p],[w36p,w36d]],
 [[],[w36p,w36other],[w36p,w36other]],
 [[],[w36p,{...w36d,url:'/articles/other/'}],[w36p,{...w36d,url:'/articles/other/'}]],
 [[],[w36p,w36p],[w36p]]
]){const f=w36pos({quotes:seed});f.install();await atomicImport(w36pack({quotes}));assert.deepEqual(JSON.parse(f.raw.get(keys.quotes)),expected);w36cases++;}
await w36refuse(fixture(),{quotes:[w36p]},/Безопасная проверка пометок недоступна/);
await w36refuse(w36pos(),{quotes:[w36p,{...w36p,text:'changed'}]},/Конфликт идентификаторов/);
const w36q=(id,noteId=null)=>({id,text:'quote '+id,annotation:{version:1,noteId}});
const w36n=(id,quoteId)=>({id,text:'note '+id,...(quoteId===undefined?{}:{quoteId})});
const w36qa=w36q('Q','A'),w36na=w36n('A'),w36nb=w36n('B','Q'),w36qb=w36q('R'),w36nx=w36n('A','R');
await w36refuse(fixture({quotes:[w36qa],notes:[w36nb]}),{notes:[w36na]},/Конфликт связей/);
await w36refuse(fixture({quotes:[w36qa],notes:[w36nx]}),{quotes:[w36qb]},/Конфликт связей/);
await w36refuse(fixture({quotes:[w36qa],notes:[w36nb]}),{notes:[w36n('A','Q')]},/Конфликт связей/);
for(const [sq,sn,aq,an] of [
 [[w36qa],[],[],[w36na]], [[],[w36nx],[w36qb],[]], [[],[],[w36qa],[w36n('A','Q')]],
 [[w36qa],[w36na,w36nb],[],[w36n('C')]], [[],[],[],[w36n('A','missing')]],
 [[],[],[w36q('Q','missing')],[]], [[w36qa],[w36na],[],[w36na]]
]){const f=fixture({quotes:sq,notes:sn});f.install();await atomicImport(w36pack({quotes:aq,notes:an}));assert.deepEqual(JSON.parse(f.raw.get(keys.quotes)),sq.concat(aq));assert.deepEqual(JSON.parse(f.raw.get(keys.notes)),sn.concat(an.filter(x=>!sn.some(y=>y.id===x.id))));w36cases++;}
const w36limits=source.slice(source.indexOf('const BACKUP_MAX_BYTES ='),source.indexOf('const MAX ='));
const w36clickStart=source.indexOf('  async function onClick(e) {');
const w36clickEnd=source.indexOf("    if (action === 'import-json')",w36clickStart);
assert.ok(w36clickStart>=0&&w36clickEnd>w36clickStart);
assert.ok(source.includes('input.size>BACKUP_MAX_BYTES'));assert.ok(source.includes('input.size > RECOVERY_MAX_BYTES'));
const w36clickCode=w36limits+source.slice(w36clickStart,w36clickEnd)+'\n  }\nreturn onClick;';
async function w36export(raw,data,{fail=false,forcedSize}={}) {
 let clicks=0,urls=0,notices=[],bytes=0;
 const button={dataset:{researchAction:raw?'export-recovery':'export-json'}};
 class ProbeBlob{constructor(parts,opts){this.size=forcedSize??new Blob(parts,opts).size;bytes=this.size;}}
 const browserURL={createObjectURL(){urls++;return 'blob:fixture';},revokeObjectURL(){}};
 const doc={body:{append(){}},createElement(){return{click(){clicks++;},remove(){}};}};
 const serialize=async()=>{if(fail)throw Error('read failure');return data;};
 const click=new Function('overlay','serializeCurrent','serializeRecovery','FORMAT','Blob','URL','document','setTimeout','notify',w36clickCode)({contains:()=>true},serialize,serialize,'gospod-bog-reader-library',ProbeBlob,browserURL,doc,fn=>fn(),(msg,error)=>notices.push({msg,error:!!error}));
 await click({target:{closest:()=>button}});return{clicks,urls,notices,bytes};
}
const w36notes=Array.from({length:150},(_,i)=>({id:'N'+i,text:'я'.repeat(15000)}));
const w36large={...empty,notes:w36notes};
for(const [raw,data,opts,clicks,error] of [
 [false,w36large,{},0,true],[false,{...empty,notes:w36notes.slice(0,10)},{},1,false],
 [true,{format:'gospod-bog-reader-library-recovery',version:1,raw:{[keys.notes]:JSON.stringify(w36notes)}},{},1,false],
 [true,{raw:{}},{forcedSize:32*1024*1024+1},0,true],
 [false,empty,{fail:true},0,true]
]){const r=await w36export(raw,data,opts);assert.equal(r.clicks,clicks);assert.equal(r.urls,clicks);assert.equal(r.notices.length,1);assert.equal(r.notices[0].error,error);w36cases++;}
assert.equal(w36cases,34);
console.log('W31–W36: 34/34 candidate scenarios PASS');


// W37: external writer changes a completed key or a read-only dependency
// during a later write. Test-only storage hook; not a browser transaction.
const w37oldQ=[{id:'Q',text:'old quote'}],w37oldN=[{id:'N',text:'old note'}];
const w37newQ=[{id:'Q',text:'new quote'}],w37newN=[{id:'N',text:'new note'}],w37external=[{id:'external',text:'external'}];
for (const mode of ['earlier-write','read-dependency']) {
 let fired=false;
 const f=fixture({quotes:w37oldQ,notes:w37oldN},{afterWrite:(raw,key)=>{
   if (!fired && key===keys.notes) {fired=true;raw.set(keys.quotes,JSON.stringify(w37external));}
 }});
 f.install();
 const r=await f.owner.mutateLibrary([keys.quotes,keys.notes],()=>({changes:{
   ...(mode==='earlier-write'?{[keys.quotes]:w37newQ}:{}),[keys.notes]:w37newN
 }}));
 assert.equal(r.ok,false,'W37 '+mode+' must not report success');
 assert.equal(r.reason,mode==='earlier-write'?'partial-write':'storage-write');
 assert.equal(f.raw.get(keys.quotes),JSON.stringify(w37external),'never compensate external bytes');
 assert.equal(f.raw.get(keys.notes),JSON.stringify(w37oldN),'compensate own unchanged write');
}
{
 const f=fixture({quotes:w37oldQ,notes:w37oldN});f.install();
 const r=await f.owner.mutateLibrary([keys.quotes,keys.notes],()=>({changes:{[keys.quotes]:w37newQ,[keys.notes]:w37newN}}));
 assert.equal(r.ok,true);assert.equal(f.raw.get(keys.quotes),JSON.stringify(w37newQ));assert.equal(f.raw.get(keys.notes),JSON.stringify(w37newN));
}
console.log('W37: 3/3 final-commit verification cases PASS');


// W38 — owner capacity must be measured before a synchronous prepare
// mutates its own working copy. Legacy over-limit records are retained.
const w38rows=n=>Array.from({length:n},(_,i)=>({id:String(i),text:'t'}));
const w38map=n=>Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,{x:1}]));
let w38cases=0;
for (const [name,limit,array,envelope] of [
 ['quotes',200,true,false],['notes',500,true,false],['favorites',50,true,true],
 ['tags',800,false,false],['reading',1000,false,false]
]) {
 const items=array?w38rows(limit):w38map(limit), value=envelope?{version:1,custom:'keep',items}:items;
 const f=fixture({[name]:value,revisit:{custom:'untouched'}});f.install();const before=f.snapshot();
 const key=keys[name];
 const r=await f.owner.mutateLibrary([key,keys.revisit],stores=>{
   if(array)stores[key].push({id:'new',text:'new'});else stores[key].new={x:2};
   return{changes:{[key]:stores[key],[keys.revisit]:{changed:true}}};
 });
 assert.equal(r.ok,false,'W38 in-place capacity '+name);
 assert.equal(r.reason,'capacity');assert.deepEqual(r.current,items);
 assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.writes,[]);w38cases++;
}
for(const [initial,copy,allowed] of [[499,false,true],[500,true,false],[501,false,false]]) {
 const f=fixture({notes:w38rows(initial)});f.install();const before=f.snapshot();
 const r=await f.owner.mutateLibrary([keys.notes],stores=>{
  const items=copy?[...stores[keys.notes]]:stores[keys.notes];items.push({id:'new'});
  return{changes:{[keys.notes]:items}};
 });
 assert.equal(r.ok,allowed);
 if(allowed)assert.equal(JSON.parse(f.raw.get(keys.notes)).length,500);
 else {assert.equal(r.reason,'capacity');assert.deepEqual(r.current,w38rows(initial));assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.writes,[]);}
 w38cases++;
}
{
 const f=fixture({notes:w38rows(501)});f.install();
 const a=await f.owner.mutateLibrary([keys.notes],stores=>{stores[keys.notes][0].text='edited';return{changes:{[keys.notes]:stores[keys.notes]}};});
 assert.equal(a.ok,true);assert.equal(JSON.parse(f.raw.get(keys.notes)).length,501);assert.equal(JSON.parse(f.raw.get(keys.notes))[0].text,'edited');w38cases++;
 const b=await f.owner.mutateLibrary([keys.notes],stores=>{stores[keys.notes].pop();return{changes:{[keys.notes]:stores[keys.notes]}};});
 assert.equal(b.ok,true);assert.equal(JSON.parse(f.raw.get(keys.notes)).length,500);w38cases++;
}
{
 const f=fixture({favorites:{version:1,extra:'keep',items:w38rows(49)}});f.install();
 const r=await f.owner.mutateLibrary([keys.favorites],stores=>{stores[keys.favorites].push({id:'new'});return{changes:{[keys.favorites]:stores[keys.favorites]}};});
 assert.equal(r.ok,true);const saved=JSON.parse(f.raw.get(keys.favorites));assert.equal(saved.extra,'keep');assert.equal(saved.items.length,50);w38cases++;
}
{
 const f=fixture({notes:'{broken',quotes:[]});f.install();const before=f.snapshot();let ran=false;
 const r=await f.owner.mutateLibrary([keys.quotes,keys.notes],()=>{ran=true;return{changes:{[keys.quotes]:w38rows(1)}};});
 assert.equal(r.ok,false);assert.equal(ran,false);assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.writes,[]);w38cases++;
}
for(const changes of [JSON.parse('{"__proto__":[]}'),{[keys.quotes]:w38rows(1)}]){
 const f=fixture({notes:[]});f.install();const before=f.snapshot();
 const r=await f.owner.mutateLibrary([keys.notes],()=>({changes}));
 assert.equal(r.ok,false);assert.equal(r.reason,'invalid-mutation');assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.writes,[]);w38cases++;
}
assert.equal(w38cases,14);
console.log('W38: 14/14 capacity and ownership cases PASS');


// W403: actual replay module + canonical mutation code, simulated lock/session
// boundary. A newer handoff appended after commit preparation must survive.
{
 const {replayNavigation}=await import(pathToFileURL(path.join(root,'js/reader-library-navigation.js')).href);
 const {cleanPath,exact}=await import(pathToFileURL(path.join(root,'js/reader-library-research-core.js')).href);
 const navigationKey='gb-library-progress-navigation-v1';
 const expected={state:'reading',title:'Queue',updatedAt:1,anchor:'start',ratio:.1};
 const intent=(key,anchor,ratio,updatedAt)=>({key,expected,progress:{anchor,ratio,updatedAt}});
 const a=intent('/a','second',.4,2),b=intent('/b','third',.8,3),tail=intent('/a','third',.9,4);
 const deps={navigationKey,cleanPath,exact,mutateResearch,updateProgress};
 let raw=JSON.stringify([a,b]);
 globalThis.sessionStorage={getItem:k=>{assert.equal(k,navigationKey);return raw;},setItem:(k,v)=>{assert.equal(k,navigationKey);raw=v;},removeItem:k=>{assert.equal(k,navigationKey);raw=null;}};
 const f=fixture({reading:{'/a':expected,'/b':expected}});f.install();
 await replayNavigation({...deps,mutateResearch:async(name,prepare)=>{
  const result=await mutateResearch(name,prepare);
  assert.equal(result.ok,true);
  raw=JSON.stringify([a,b,tail]); // append after the actual prepared write
  return result;
 }});
 let saved=JSON.parse(f.raw.get(keys.reading));
 assert.deepEqual(saved['/a'],{...expected,...a.progress});
 assert.deepEqual(saved['/b'],{...expected,...b.progress});
 assert.deepEqual(JSON.parse(raw),{...tail,expected:saved['/a']});
 await replayNavigation(deps);
 saved=JSON.parse(f.raw.get(keys.reading));
 assert.deepEqual(saved['/a'],{...expected,...tail.progress});
 assert.equal(raw,null);

 // A refused lock does not consume any queue bytes.
 raw=JSON.stringify([a,b]);const retained=raw;
 const unavailable=fixture({reading:{'/a':expected,'/b':expected}},{noLock:true});unavailable.install();
 await replayNavigation(deps);assert.equal(raw,retained);assert.deepEqual(unavailable.writes,[]);

 // A stale same-route intent must not resurrect a foreign canonical record.
 const foreign={...expected,title:'Foreign',updatedAt:5};
 const mixed=fixture({reading:{'/a':foreign,'/b':expected}});mixed.install();
 await replayNavigation(deps);saved=JSON.parse(mixed.raw.get(keys.reading));
 assert.deepEqual(saved['/a'],foreign);assert.deepEqual(saved['/b'],{...expected,...b.progress});assert.equal(raw,null);

 // A malformed handoff must not write or poison the next capable document.
 raw='{bad';const invalid=fixture({reading:{'/a':expected}});invalid.install();
 await replayNavigation(deps);assert.equal(raw,null);assert.deepEqual(invalid.writes,[]);
 delete globalThis.sessionStorage;
 console.log('W403 navigation queue: 4/4 acknowledgement, refusal, mixed conflict and malformed cases PASS');
}
