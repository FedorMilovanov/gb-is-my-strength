#!/usr/bin/env node
/**
 * W94b: Real UI two-tab isolation test for the opt-in W57 reader and the
 * canonical Product Library. Both tabs use one browser context/localStorage.
 * No public route is activated and no real user data is touched.
 *
 * This is a sequential conflict acceptance, NOT proof of atomic browser CAS.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, webkit } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'reports/reader-w57-two-tab');
mkdirSync(OUT, {recursive:true});
const ROUTE = '/articles/dzhon-gill-chast-2-uchenyi/';
const QID = 'quote-w94b-fixture';
const NID = 'note-w94b-fixture';
const sourceNote = 'Исходная заметка для двух вкладок';
const results = [];
const failures = [];

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.once('error', fail).listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  await new Promise(ok => server.close(ok));
  return port;
}
const port = await freePort();
const base = 'http://127.0.0.1:' + port;
const url = base + ROUTE + '?reader-pilot=1&paper=space&panel=open';
let server;
async function ready(page) {
  await page.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready), null, {timeout:20000});
}
async function noteState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]'));
}
async function quoteState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]'));
}
async function openW57(page, draft) {
  const section = page.locator('#npW57NotesDetails');
  if (!(await section.evaluate(x => x.open))) await section.locator('summary').click();
  await page.locator('#npW57NotesList li[data-id="' + QID + '"] [data-action="edit"]').click();
  await page.locator('#npW57NoteText').fill(draft);
}
async function openProduct(page) {
  await page.locator('#gb-hl-fab').click();
  await page.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"]').waitFor();
}
async function editProduct(page, draft) {
  await page.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"] [data-library-action="edit-note"]').click();
  await page.locator('#gb-hl-note-text').fill(draft);
}
async function run(engine, name) {
  const browser = await engine.launch({headless:true});
  const context = await browser.newContext({
    viewport:{width:1440,height:900},locale:'ru-RU',
    reducedMotion:'reduce',serviceWorkers:'block'
  });
  const errors = [];
  let A, B;
  const seen = p => p.on('pageerror', e => errors.push(String(e)));
  try {
    A = await context.newPage(); seen(A);
    await A.goto(url, {waitUntil:'domcontentloaded',timeout:30000});
    await ready(A);
    // Prepare an actual anchored quote in a disposable browser profile.
    // Persistent edits below are made by REAL UI controls in the two tabs.
    const seeded = await A.evaluate(({qid,nid,initial}) => {
      const article = window.GBReaderContract?.articleRoot?.(document);
      if (!article || !window.GBReaderAnchors?.capture) throw Error('Canonical anchor owner missing');
      // Use the canonical authored-block list. An arbitrary first paragraph
      // can be below the fold, in which case GBReaderAnchors.capture correctly
      // returns null. Seed a REAL visible selection, never fake coordinates.
      let textNode = null, sourceBlock = null;
      for (const block of window.GBReaderAnchors.blocks(article)) {
        if (!block.getClientRects().length || block.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const owner=node.parentElement;
          if (node.nodeValue.trim().length >= 75 &&
              !owner?.closest('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"]')) {
            textNode = node; sourceBlock = block; break;
          }
        }
        if (textNode) break;
      }
      if (!textNode || !sourceBlock) throw Error('No eligible authored source block');
      sourceBlock.scrollIntoView({block:'center',behavior:'instant'});
      const range = document.createRange();
      range.setStart(textNode, Math.min(3,textNode.length-1));
      range.setEnd(textNode, Math.min(textNode.length,58));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      const geometry=range.getBoundingClientRect();
      if (geometry.width < 2 || geometry.height < 2 ||
          geometry.bottom < 0 || geometry.top > innerHeight)
        throw Error('Fixture selection is not visible to canonical anchor capture: '+JSON.stringify({
          top:geometry.top,bottom:geometry.bottom,height:geometry.height,width:geometry.width
        }));
      const source = window.GBReaderAnchors.capture(article);
      selection.removeAllRanges();
      if (!source?.anchor || !source.text || source.text.length < 10)
        throw Error('Canonical position capture failed');
      const savedAt = Date.now();
      const q = {
        id:qid, text:source.text,articleTitle:document.title,
        url:location.origin+location.pathname,savedAt,
        before:source.anchor.prefix||'',after:source.anchor.suffix||'',
        kind:'quote',color:'amber',
        annotation:{version:1,kind:'quote',color:'amber',anchor:source.anchor,noteId:nid}
      };
      const n = {
        id:nid,text:initial,quoteId:qid,quoteText:source.text,
        articleTitle:document.title,url:q.url,savedAt
      };
      localStorage.setItem('gb-highlights-v1',JSON.stringify([q]));
      localStorage.setItem('gb-reader-notes-v1',JSON.stringify([n]));
      return {textLength:source.text.length,sourceId:qid};
    },{qid:QID,nid:NID,initial:sourceNote});
    await A.reload({waitUntil:'domcontentloaded'}); await ready(A);
    B = await context.newPage(); seen(B);
    await B.goto(url, {waitUntil:'domcontentloaded',timeout:30000}); await ready(B);
    assert.equal(await A.locator('#npW57NotesList li[data-id="' + QID + '"]').count(),1,
      'W57 must render saved quote in the real research rail');
    assert.equal((await noteState(B))[0].text,sourceNote);
    // Update/update: W57 opens first; Product Library saves an edit in tab B.
    await openW57(A,'Черновик вкладки A');
    assert.equal(await A.locator('#npW57NoteText').inputValue(),'Черновик вкладки A');
    await openProduct(B);
    await editProduct(B,'Изменено через Product Library');
    await B.locator('#gb-hl-editor button[type="submit"]').click();
    assert.equal((await noteState(B))[0].text,'Изменено через Product Library');
    await A.locator('#npW57SaveNote').click();
    assert.match(await A.locator('#npW57NotesStatus').innerText(),/изменилась|связь изменилась/);
    assert.equal(await A.locator('#npW57NoteText').inputValue(),'Черновик вкладки A');
    assert.equal(await A.locator('#npW57NoteEditor').isVisible(),true);
    assert.equal((await noteState(A))[0].text,'Изменено через Product Library');
    await A.screenshot({path:resolve(OUT,name+'-update-conflict.png'),animations:'disabled'});
    // Delete/update: a freshly opened W57 draft must not resurrect B's delete.
    await A.locator('#npW57CancelNote').click();
    await openW57(A,'Не воскрешать удалённую заметку');
    await B.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"] [data-library-action="delete"]').click();
    assert.equal((await noteState(B)).length,0,'real Product delete must persist');
    await A.locator('#npW57SaveNote').click();
    assert.equal((await noteState(A)).length,0,'stale W57 must not recreate deleted note');
    assert.equal(await A.locator('#npW57NoteText').inputValue(),'Не воскрешать удалённую заметку');
    assert.equal(await A.locator('#npW57NoteEditor').isVisible(),true);
    assert.equal((await quoteState(A))[0].annotation.noteId,NID,
      'stale write must not alter the positional quote link');
    await A.screenshot({path:resolve(OUT,name+'-delete-conflict.png'),animations:'disabled'});
    // Reverse direction: Product opens, W57 writes, Product must retain draft.
    await A.evaluate(({nid,qid,initial}) => {
      const notes = [{id:nid,quoteId:qid,text:initial,quoteText:'fixture',
        url:location.origin+location.pathname,articleTitle:document.title,savedAt:Date.now()}];
      localStorage.setItem('gb-reader-notes-v1',JSON.stringify(notes));
    },{nid:NID,qid:QID,initial:sourceNote});
    await A.reload({waitUntil:'domcontentloaded'}); await ready(A);
    await B.reload({waitUntil:'domcontentloaded'}); await ready(B);
    await openProduct(B);
    await editProduct(B,'Черновик Product после открытия');
    await openW57(A,'Изменено через W57');
    await A.locator('#npW57SaveNote').click();
    assert.equal((await noteState(A))[0].text,'Изменено через W57');
    await B.locator('#gb-hl-editor button[type="submit"]').click();
    assert.match(await B.locator('#gb-hl-status').innerText(),/изменена в другом редакторе/);
    assert.equal(await B.locator('#gb-hl-note-text').inputValue(),'Черновик Product после открытия');
    assert.equal((await noteState(B))[0].text,'Изменено через W57');
    await B.screenshot({path:resolve(OUT,name+'-reverse-conflict.png'),animations:'disabled'});
    assert.equal(errors.length,0,'uncaught browser errors: '+errors.slice(0,3).join('; '));
    results.push({engine:name,status:'PASS',checks:16,seeded});
  }catch(e) {
    failures.push({engine:name,error:String(e),stack:String(e.stack||'').slice(0,1700),
      errors:errors.slice(0,5)});
    if (A) await A.screenshot({path:resolve(OUT,name+'-failure-A.png')}).catch(()=>{});
    if (B) await B.screenshot({path:resolve(OUT,name+'-failure-B.png')}).catch(()=>{});
  }finally{
    await context.close();await browser.close();
  }
}
try{
  server=spawn('python3',['-u','research/reader-w57-pilot/preview.py'],{
    cwd:ROOT,env:{...process.env,READER_W57_PORT:String(port),READER_W57_DIST:resolve(ROOT,'dist')},
    stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',x=>console.error('W57_PREVIEW_ERROR '+String(x).slice(0,300)));
  let live=false;
  for(let i=0;i<70;i++){
    try{const r=await fetch(base+ROUTE);if(r.ok){live=true;break;}}catch{}
    await delay(250);
  }
  assert.ok(live,'Opt-in W57 preview server not reachable');
  await run(chromium,'chromium');
  await run(webkit,'webkit');
}finally {
  server?.kill('SIGTERM');
  writeFileSync(resolve(OUT,'summary.json'),JSON.stringify({
    exactHead:process.env.GITHUB_SHA||null,results,failures
  },null,2));
}
console.log('W57 TWO-TAB CONTRACT '+JSON.stringify({results,failures}));
assert.equal(failures.length,0,'Real two-tab W57/Product conflict checks failed');
assert.equal(results.length,2,'Both Chromium and WebKit required');
