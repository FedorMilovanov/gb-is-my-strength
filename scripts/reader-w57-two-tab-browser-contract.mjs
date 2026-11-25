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
// Persisted note writes are serialized through the shared store lock, so the
// commit resolves after the click returns. Wait for the exact stored value the
// contract requires instead of sampling the store synchronously; the expected
// values below are unchanged. No eval: the page CSP forbids Function().
async function waitNoteState(page, expect, label) {
  const matches = (items) => expect.none
    ? items.length === 0
    : items.length === 1 && items[0].text === expect.text;
  try {
    await page.waitForFunction(({text, none}) => {
      const items = JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]');
      return none ? items.length === 0 : (items.length === 1 && items[0].text === text);
    }, expect, {timeout:8000});
  } catch (e) {
    throw new Error(label + ' (stored notes: ' + JSON.stringify(await noteState(page)) + ')');
  }
  return matches(await noteState(page));
}
async function waitStatus(page, selector, pattern, label) {
  try {
    await page.waitForFunction(([sel, src]) => {
      const el = document.querySelector(sel);
      return Boolean(el) && new RegExp(src).test(el.textContent || '');
    }, [selector, pattern.source], {timeout:8000});
  } catch (e) {
    throw new Error(label + ' (status: ' + JSON.stringify(await page.locator(selector).innerText().catch(() => '')) + ')');
  }
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
async function openProduct(page, type = 'note', id = NID) {
  // When ARGON's Analytics panel is open, the genuine Product Library FAB
  // stays in the DOM but is intentionally not visible. A real reader opens
  // Library via the visible Analytics header action (#npULibraryButton).
  // That owner's click handler forwards to the SAME native FAB/controller.
  // Never use force:true or evaluate().click() on a hidden control: doing
  // so would bypass the actual UI interaction under test.
  const trigger = page.locator('#npULibraryButton');
  assert.equal(await trigger.isVisible(), true,
    'ARGON Analytics must expose the real Library entry point');
  await trigger.click();
  await page.locator('#gb-hl-panel[role="dialog"]').waitFor({state:'visible'});
  assert.equal(await page.locator('#gb-hl-fab').getAttribute('aria-expanded'),'true',
    'visible Reader action must open the canonical Product dialog');
  await page.locator('#gb-hl-list .gb-hl-item[data-type="' + type + '"][data-id="' + id + '"]').waitFor();
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
  // Reader data-integrity acceptance is hermetic: third-party Metrika
  // transport is not part of the test. Intercept only the two actual
  // telemetry origins; same-origin requests and page errors remain unmocked.
  await context.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i, route =>
    route.fulfill({
      status: 200,
      contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/plain',
      body: '',
    }));
  const errors = [];
  let A, B;
  const seen = p => p.on('pageerror', e => errors.push(String(e)));
  try {
    A = await context.newPage(); seen(A);
    await A.goto(url, {waitUntil:'domcontentloaded',timeout:30000});
    await ready(A);
    // Prepare an actual anchored quote in a disposable browser profile.
    // Persistent edits below are made by REAL UI controls in the two tabs.
    const seeded = await A.evaluate(async ({qid,nid,initial}) => {
      await window.GBHighlights.ensureRanges();
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
    await waitNoteState(B, {text:sourceNote}, 'seeded note must be visible in both tabs');
    // Update/update: W57 opens first; Product Library saves an edit in tab B.
    await openW57(A,'Черновик вкладки A');
    assert.equal(await A.locator('#npW57NoteText').inputValue(),'Черновик вкладки A');
    await openProduct(B);
    await editProduct(B,'Изменено через Product Library');
    await B.locator('#gb-hl-editor button[type="submit"]').click();
    await waitNoteState(B, {text:'Изменено через Product Library'},
      'Product Library edit must persist');
    await A.locator('#npW57SaveNote').click();
    await waitStatus(A, '#npW57NotesDetails #npW57NotesStatus', /изменилась|связь изменилась/,
      'stale W57 edit must be refused');
    assert.equal(await A.locator('#npW57NoteText').inputValue(),'Черновик вкладки A');
    assert.equal(await A.locator('#npW57NoteEditor').isVisible(),true);
    await waitNoteState(A, {text:'Изменено через Product Library'},
      'refused W57 write must leave the other tab edit intact');
    await A.screenshot({path:resolve(OUT,name+'-update-conflict.png'),animations:'disabled'});
    // Delete/update: a freshly opened W57 draft must not resurrect B's delete.
    await A.locator('#npW57CancelNote').click();
    await openW57(A,'Не воскрешать удалённую заметку');
    await B.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"] [data-library-action="delete"]').click();
    await waitNoteState(B, {none:true}, 'real Product delete must persist');
    await A.locator('#npW57SaveNote').click();
    await waitStatus(A, '#npW57NotesDetails #npW57NotesStatus', /удалена|изменилась/,
      'stale W57 save must be refused after the delete');
    await waitNoteState(A, {none:true}, 'stale W57 must not recreate deleted note');
    assert.equal(await A.locator('#npW57NoteText').inputValue(),'Не воскрешать удалённую заметку');
    assert.equal(await A.locator('#npW57NoteEditor').isVisible(),true);
    // The delete itself clears the reverse link, so the quote must carry no
    // dangling noteId; a stale W57 save must not re-point it at the removed ID.
    assert.equal((await quoteState(A))[0].annotation.noteId,null,
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
    await waitNoteState(A, {text:'Изменено через W57'}, 'W57 edit must persist');
    await B.locator('#gb-hl-editor button[type="submit"]').click();
    await waitStatus(B, '#gb-hl-status', /изменена в другом редакторе/,
      'stale Product edit must be refused');
    assert.equal(await B.locator('#gb-hl-note-text').inputValue(),'Черновик Product после открытия');
    await waitNoteState(B, {text:'Изменено через W57'},
      'refused Product write must leave the W57 edit intact');
    await B.screenshot({path:resolve(OUT,name+'-reverse-conflict.png'),animations:'disabled'});
    // W39: the Product card opens a NEW linked draft. A genuine W57
    // switch mutates the same saved source quote before Product saves.
    await A.evaluate(() => {
      const q = JSON.parse(localStorage.getItem('gb-highlights-v1'))[0];
      q.annotation = {...q.annotation, noteId:null, kind:'quote'};
      localStorage.setItem('gb-highlights-v1',JSON.stringify([q]));
      localStorage.setItem('gb-reader-notes-v1','[]');
    });
    await A.reload({waitUntil:'domcontentloaded'}); await ready(A);
    await B.reload({waitUntil:'domcontentloaded'}); await ready(B);
    await openProduct(B,'quote',QID);
    const linkedCard = B.locator('#gb-hl-list .gb-hl-item[data-type="quote"][data-id="' + QID + '"]');
    await linkedCard.locator('[data-library-action="note-for-quote"]').click();
    await B.locator('#gb-hl-note-text').fill('Черновик к исходной цитате W39');
    const w39section = A.locator('#npW57NotesDetails');
    if (!(await w39section.evaluate(x => x.open))) await w39section.locator('summary').click();
    await A.locator('#npW57NotesList li[data-id="' + QID + '"] [data-action="switch"]').click();
    await A.waitForFunction(qid => JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').some(q=>q.id===qid&&q.annotation.kind==='marker'),QID);
    const afterSwitch = await A.evaluate(() => [localStorage.getItem('gb-highlights-v1'),localStorage.getItem('gb-reader-notes-v1')]);
    await B.locator('#gb-hl-editor button[type="submit"]').click();
    await waitStatus(B,'#gb-hl-status',/Цитата или её связь изменилась/,'W39 stale source must refuse');
    assert.deepEqual(await B.evaluate(() => [localStorage.getItem('gb-highlights-v1'),localStorage.getItem('gb-reader-notes-v1')]),afterSwitch);
    assert.equal(await B.locator('#gb-hl-editor').isVisible(),true);
    assert.equal(await B.locator('#gb-hl-note-text').inputValue(),'Черновик к исходной цитате W39');
    assert.equal(await B.locator('#gb-hl-note-text').evaluate(x=>x.readOnly),false);
    await B.screenshot({path:resolve(OUT,name+'-linked-source-conflict.png'),animations:'disabled'});
    // Positive control: reopen after source change; preserve the valid association.
    await B.locator('#gb-hl-close').click();
    await openProduct(B,'quote',QID);
    await linkedCard.locator('[data-library-action="note-for-quote"]').click();
    await B.locator('#gb-hl-note-text').fill('Актуальная заметка W39');
    await B.locator('#gb-hl-editor button[type="submit"]').click();
    await waitNoteState(A,{text:'Актуальная заметка W39'},'fresh source linked save must succeed');
    assert.equal((await noteState(A))[0].quoteId,QID);
    assert.equal(await B.locator('#gb-hl-editor').isVisible(),false);
    assert.equal(errors.length,0,'uncaught browser errors: '+errors.slice(0,3).join('; '));
    results.push({engine:name,status:'PASS',checks:16,seeded,linkedSourceConflict:true,linkedSourceFreshSave:true});
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
  server=spawn(process.env.GB_READER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),['-u','research/reader-w57-pilot/preview.py'],{
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
