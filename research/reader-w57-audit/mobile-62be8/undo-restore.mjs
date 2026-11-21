// Local mobile UI only, real export and second-tab file chooser. No storage seeding or clock manipulation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const url=(process.env.READER_URL||'http://127.0.0.1:19069')+'/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1';
const open=async p=>{assert.equal((await p.goto(url)).status(),200);await p.locator('#gb-hl-fab').tap();await p.locator('#gb-hl-manage').waitFor()};
const notes=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')||'[]').map(({id,text})=>({id,text})));
const add=p=>p.locator('#gb-hl-new-note').tap(),field=p=>p.locator('#gb-hl-note-text'),save=p=>p.locator('#gb-hl-editor [type=submit]').tap(),act=(p,id)=>p.locator(`[data-research-action="${id}"]`),card=(p,id)=>p.locator(`[data-type=note] [data-library-action="${id}"]`).first();
try{for(const [width,mode] of [[390,'other-note'],[390,'restore'],[320,'restore'],[390,'older-backup']]){const ctx=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});ctx.setDefaultTimeout(6500);const r={width,mode};try{
 const a=await ctx.newPage(),c=await ctx.newPage();await open(a);await add(a);await field(a).fill('Первая запись');await save(a);r.original=(await notes(a))[0];await open(c);
 if(mode!=='other-note'){
  await c.locator('#gb-hl-manage').tap();const dl=c.waitForEvent('download');await act(c,'export-json').tap();const file=await dl;const buffer=await readFile(await file.path());assert.equal(JSON.parse(buffer).data.notes[0].id,r.original.id);
  const choose=c.waitForEvent('filechooser');await act(c,'import-json').tap();await (await choose).setFiles({name:file.suggestedFilename(),mimeType:'application/json',buffer});await c.locator('#gb-hl-import-confirm').waitFor();
 }else{await add(c);await field(c).fill('Другая запись')}
 await a.bringToFront();if(mode==='older-backup'){await card(a,'edit-note').tap();await field(a).fill('Пересмотренный текст');await save(a);r.beforeDelete=await notes(a)}await card(a,'delete').tap();const t=Date.now();r.deleted=await notes(a);assert.equal(r.deleted.length,0);await c.bringToFront();if(mode!=='other-note')await act(c,'confirm-import').tap();else await save(c);r.beforeUndo=await notes(c);assert.equal(r.beforeUndo.length,1);
 await a.bringToFront();await a.locator('#gb-hl-status button').tap();r.undoMs=Date.now()-t;await open(a);await a.locator('[data-library-tab=note]').tap();r.afterReload=await notes(a);r.cards=await a.locator('#gb-hl-list [data-type=note]').count();
 if(mode!=='other-note'&&r.cards===2){await card(a,'edit-note').tap();await field(a).fill('Изменена одна карточка');await save(a);r.afterEdit=await notes(a);if(process.env.SHOTS)await a.screenshot({path:`${process.env.SHOTS}/undo-${width}-${mode}.jpg`});await card(a,'delete').tap();r.afterDelete=await notes(a)}
 r.pass=r.cards===(mode==='other-note'?2:1)&&new Set(r.afterReload.map(n=>n.id)).size===r.cards;if(!r.pass)process.exitCode=1;
 }catch(e){r.error=e.message;process.exitCode=1}finally{console.log(JSON.stringify(r));await ctx.close()}}
}finally{await b.close()}
