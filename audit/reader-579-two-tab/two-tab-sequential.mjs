// W107 — two-tab conflict probe on a VERIFIED product SHA.
// Both tabs = one Chromium profile (one browser context) => shared localStorage.
// Every action is a REAL UI click on the shipped controls; the only
// programmatic writes are the initial fixture and textarea .value (typing).
//
// A: change/change  — both tabs open the same note, A saves, B saves stale.
// B: delete/change  — A types a draft, B deletes the note, A saves.
// After reload: both edits visible to both tabs, draft state, no resurrection.
import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:19224';
const ROUTE = '/articles/dzhon-gill-chast-2-uchenyi/';
const URL_ = BASE + ROUTE + '?reader-pilot=1&paper=space&panel=open';
const OUT = process.env.QA_OUT || 'reports/reader-579-twotab/evidence';
const SHA = process.env.QA_SHA || '02c984111c6c45358da7aad435294baa84c5153e';
const NOTES_KEY = 'gb-reader-notes-v1';
const QUOTES_KEY = 'gb-highlights-v1';
const QID = 'quote-w107-fixture';
const NID = 'note-w107-fixture';
const SRC = 'Исходная заметка — версия 1 (обе вкладки читают её)';

fs.mkdirSync(OUT, { recursive: true });
const result = { sha: SHA, base: BASE, scenarios: [], checks: [], pageErrors: [] };
const fail = [];
const check = (name, ok, detail) => {
  result.checks.push({ name, ok: !!ok, detail });
  if (!ok) fail.push(`${name} :: ${detail}`);
};
const notesOf = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), NOTES_KEY);
const quotesOf = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), QUOTES_KEY);

const browser = await chromium.launch({
  executablePath: process.env.W58_CHROMIUM_PATH || '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', reducedMotion: 'reduce' });
const newTab = async (label) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => result.pageErrors.push(`${label}: ${e.message}`));
  await p.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready), null, { timeout: 30000 });
  await p.waitForTimeout(300);
  return p;
};
// Real Product Library entry: the visible Analytics header action.
const openLibrary = async (p) => {
  if (await p.locator('#gb-hl-panel').isVisible()) return;
  const btn = p.locator('#npULibraryButton');
  if (await btn.isVisible()) await btn.click();
  else await p.locator('#gb-hl-fab').click();
  await p.locator('#gb-hl-panel').waitFor({ state: 'visible', timeout: 15000 });
  await p.waitForTimeout(400);
};
const editorOpen = (p) => p.evaluate(() => { const f = document.querySelector('#gb-hl-editor'); return !!f && !f.hidden; });
// Open W57 note editor for the fixture quote, as a reader does: summary → edit.
const openW57 = async (p) => {
  const det = p.locator('#npW57NotesDetails');
  if (!(await det.evaluate((x) => x.open))) await det.locator('summary').click();
  await p.locator(`#npW57NotesList li[data-id="${QID}"] [data-action="edit"]`).click();
};
const w57Text = (p) => p.locator('#npW57NoteText').inputValue();
const w57Visible = (p) => p.locator('#npW57NoteEditor').isVisible();
const w57Status = (p) => p.locator('#npW57NotesStatus').innerText();
const libStatus = (p) => p.evaluate(() => (document.querySelector('#gb-hl-status')?.textContent || '').trim());

// ---------------- fixture: canonical anchored quote + linked note ----------------
const A = await newTab('seed');
const seeded = await A.evaluate(({ qid, nid, initial }) => {
  const article = window.GBReaderContract?.articleRoot?.(document);
  if (!article || !window.GBReaderAnchors?.capture) throw Error('canonical anchor owner missing');
  let textNode = null, block = null;
  for (const b of window.GBReaderAnchors.blocks(article)) {
    if (!b.getClientRects().length || b.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const o = n.parentElement;
      if (n.nodeValue.trim().length >= 75 && !o?.closest('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"]')) { textNode = n; block = b; break; }
    }
    if (textNode) break;
  }
  if (!textNode) throw Error('no eligible authored block');
  block.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = document.createRange();
  r.setStart(textNode, Math.min(3, textNode.length - 1));
  r.setEnd(textNode, Math.min(textNode.length, 58));
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const g = r.getBoundingClientRect();
  if (g.width < 2 || g.height < 2 || g.bottom < 0 || g.top > innerHeight)
    throw Error('fixture selection not visible: ' + JSON.stringify({ top: g.top, bottom: g.bottom, w: g.width, h: g.height }));
  const src = window.GBReaderAnchors.capture(article);
  sel.removeAllRanges();
  if (!src?.anchor || !src.text || src.text.length < 10) throw Error('capture failed');
  const savedAt = Date.now(), url = location.origin + location.pathname;
  const q = { id: qid, text: src.text, articleTitle: document.title, url, savedAt,
    before: src.anchor.prefix || '', after: src.anchor.suffix || '', kind: 'quote', color: 'amber',
    annotation: { version: 1, kind: 'quote', color: 'amber', anchor: src.anchor, noteId: nid } };
  const n = { id: nid, text: initial, quoteId: qid, quoteText: src.text, articleTitle: document.title, url, savedAt };
  localStorage.setItem('gb-highlights-v1', JSON.stringify([q]));
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify([n]));
  return { textLength: src.text.length, quoteText: src.text };
}, { qid: QID, nid: NID, initial: SRC });
result.fixture = seeded;
check('fixture: canonical anchor captured with visible geometry', seeded.textLength >= 10, `textLength=${seeded.textLength}`);

const resetFixture = async (p) => {
  await p.evaluate(({ nid, qid, initial }) => {
    const notes = [{ id: nid, quoteId: qid, text: initial, quoteText: 'fixture',
      url: location.origin + location.pathname, articleTitle: document.title, savedAt: Date.now() }];
    localStorage.setItem('gb-reader-notes-v1', JSON.stringify(notes));
  }, { nid: NID, qid: QID, initial: SRC });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready), null, { timeout: 30000 });
  await p.waitForTimeout(400);
};

// =================== A: change / change — W57 ↔ W57 ===================
{
  await resetFixture(A);
  const B = await newTab('A/B');
  await openW57(A);
  await openW57(B);
  const aOpen = await w57Text(A);
  const bOpen = await w57Text(B);
  // Requirement: both tabs must have read the SAME source version.
  check('A: both W57 tabs opened the identical source text', aOpen === SRC && bOpen === SRC, `A=${JSON.stringify(aOpen)} B=${JSON.stringify(bOpen)}`);
  await A.locator('#npW57NoteText').fill('Правка вкладки A — сохраняется первой');
  await A.locator('#npW57SaveNote').click();
  await A.waitForTimeout(500);
  const afterA = await notesOf(A);
  check('A: A persisted its edit', afterA[0]?.text === 'Правка вкладки A — сохраняется первой', JSON.stringify(afterA[0]?.text));
  await B.locator('#npW57NoteText').fill('Правка вкладки B — из устаревшей версии');
  await B.locator('#npW57SaveNote').click();
  await B.waitForTimeout(600);
  const afterB = await notesOf(B);
  const bMsg = await w57Status(B);
  const scen = {
    id: 'A-change-change-W57',
    aSaved: afterA[0]?.text,
    bDraft: 'Правка вкладки B — из устаревшей версии',
    storeAfter: afterB.map((n) => n.text),
    bMessage: bMsg,
    bEditorVisible: await w57Visible(B),
    bDraftKept: await w57Text(B),
    lostText: afterB.some((n) => n.text === 'Правка вкладки B — из устаревшей версии'),
    verdict: afterB[0]?.text === 'Правка вкладки A — сохраняется первой' ? 'B REFUSED (no silent overwrite)' : 'B OVERWROTE A (data loss)',
  };
  result.scenarios.push(scen);
  check('A: stale B must not overwrite A', scen.verdict.startsWith('B REFUSED'), JSON.stringify(scen.storeAfter));
  check('A: B keeps its draft on screen', scen.bEditorVisible === true && scen.bDraftKept === scen.bDraft, `vis=${scen.bEditorVisible} draft=${JSON.stringify(scen.bDraftKept)}`);
  await A.screenshot({ path: path.join(OUT, 'A-w57-a-saved.png') });
  await B.screenshot({ path: path.join(OUT, 'A-w57-b-refused.png') });

  // reload: both must see the same store, A's text survives, B's draft is gone (it was never persisted)
  await A.reload({ waitUntil: 'domcontentloaded' }); await A.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready));
  await B.reload({ waitUntil: 'domcontentloaded' }); await B.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready));
  await A.waitForTimeout(500); await B.waitForTimeout(500);
  const ra = await notesOf(A), rb = await notesOf(B);
  check('A: after reload both tabs read the same store', JSON.stringify(ra) === JSON.stringify(rb), `${JSON.stringify(ra.map((n) => n.text))} vs ${JSON.stringify(rb.map((n) => n.text))}`);
  check('A: after reload A\'s text is the only surviving version', ra.length === 1 && ra[0].text === 'Правка вкладки A — сохраняется первой', JSON.stringify(ra.map((n) => n.text)));
  await B.close();
}

// =================== B: delete / change — Product deletes, W57 saves ===================
{
  await resetFixture(A);
  const B = await newTab('B/B');
  await openW57(A);
  await A.locator('#npW57NoteText').fill('Черновик вкладки A для удаляемой заметки');
  await openLibrary(B);
  // Both tabs must have read the same source version before the destructive step.
  const bText = await B.evaluate((k) => (JSON.parse(localStorage.getItem(k) || '[]')[0] || {}).text, NOTES_KEY);
  check('B: tab B read the same source version', bText === SRC, JSON.stringify(bText));
  await B.locator(`#gb-hl-list .gb-hl-item[data-type="note"][data-id="${NID}"] [data-library-action="delete"]`).click();
  await B.waitForTimeout(500);
  const afterDel = await notesOf(B);
  check('B: real Product delete removed the note', afterDel.length === 0, `count=${afterDel.length}`);
  await A.locator('#npW57SaveNote').click();
  await A.waitForTimeout(600);
  const afterStale = await notesOf(A);
  const link = (await quotesOf(A))[0]?.annotation?.noteId ?? null;
  const scen = {
    id: 'B-delete-change',
    storeAfterDelete: afterDel.length,
    storeAfterStaleSave: afterStale.map((n) => n.text),
    quoteLinkAfter: link,
    aMessage: await w57Status(A),
    aEditorVisible: await w57Visible(A),
    aDraftKept: await w57Text(A),
    verdict: afterStale.length === 0 ? 'A REFUSED (no resurrection)' : 'A RESURRECTED the deleted note',
  };
  result.scenarios.push(scen);
  check('B: stale A must not resurrect the deleted note', afterStale.length === 0, JSON.stringify(scen.storeAfterStaleSave));
  check('B: stale A must not rewrite the quote link', link === NID, `annotation.noteId=${link}`);
  check('B: A keeps its draft on screen', scen.aEditorVisible === true && scen.aDraftKept === 'Черновик вкладки A для удаляемой заметки', `vis=${scen.aEditorVisible} draft=${JSON.stringify(scen.aDraftKept)}`);
  await A.screenshot({ path: path.join(OUT, 'B-w57-a-refused.png') });
  await B.screenshot({ path: path.join(OUT, 'B-product-deleted.png') });

  await A.reload({ waitUntil: 'domcontentloaded' }); await A.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready));
  await B.reload({ waitUntil: 'domcontentloaded' }); await B.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready));
  await A.waitForTimeout(600); await B.waitForTimeout(600);
  const ra = await notesOf(A), rb = await notesOf(B);
  check('B: after reload the deleted note did not self-restore (A)', ra.length === 0, JSON.stringify(ra.map((n) => n.text)));
  check('B: after reload the deleted note did not self-restore (B)', rb.length === 0, JSON.stringify(rb.map((n) => n.text)));
  result.scenarios.push({ id: 'B-after-reload', a: ra.length, b: rb.length });
  await B.close();
}

// =================== C: change / change — reverse direction (W57 first, Product stale) ===================
{
  await resetFixture(A);
  const B = await newTab('C/B');
  await openW57(A);
  const aOpen = await w57Text(A);
  await openLibrary(B);
  await B.locator(`#gb-hl-list .gb-hl-item[data-type="note"][data-id="${NID}"] [data-library-action="edit-note"]`).click();
  await B.waitForTimeout(300);
  const bOpened = await B.evaluate(() => document.querySelector('#gb-hl-note-text').value);
  check('C: Product and W57 opened the identical source text', aOpen === SRC && bOpened === SRC, `W57=${JSON.stringify(aOpen)} Product=${JSON.stringify(bOpened)}`);
  await A.locator('#npW57NoteText').fill('Правка W57 — сохраняется первой');
  await A.locator('#npW57SaveNote').click();
  await A.waitForTimeout(500);
  const afterA = await notesOf(A);
  check('C: W57 persisted its edit', afterA[0]?.text === 'Правка W57 — сохраняется первой', JSON.stringify(afterA[0]?.text));
  await B.locator('#gb-hl-note-text').fill('Правка Product Library — из устаревшей версии');
  await B.locator('#gb-hl-editor button[type="submit"]').click();
  await B.waitForTimeout(600);
  const afterB = await notesOf(B);
  const scen = {
    id: 'C-change-change-reverse',
    storeAfter: afterB.map((n) => n.text),
    libMessage: await libStatus(B),
    editorStillOpen: await editorOpen(B),
    draftKept: await B.evaluate(() => document.querySelector('#gb-hl-note-text').value),
    overwrote: afterB[0]?.text !== 'Правка W57 — сохраняется первой',
    verdict: afterB[0]?.text === 'Правка W57 — сохраняется первой' ? 'PRODUCT REFUSED (no silent overwrite)' : 'PRODUCT OVERWROTE W57 (data loss)',
  };
  result.scenarios.push(scen);
  check('C: stale Product save must not overwrite W57', !scen.overwrote, JSON.stringify(scen.storeAfter));
  check('C: Product keeps its draft on screen', scen.editorStillOpen === true, `open=${scen.editorStillOpen} status=${JSON.stringify(scen.libMessage)}`);
  await B.screenshot({ path: path.join(OUT, 'C-product-refused.png') });
  await B.reload({ waitUntil: 'domcontentloaded' });
  await B.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready));
  await B.waitForTimeout(500);
  const rb = await notesOf(B);
  check('C: after reload W57 text is the only surviving version', rb.length === 1 && rb[0].text === 'Правка W57 — сохраняется первой', JSON.stringify(rb.map((n) => n.text)));
  await B.close();
}

result.summary = { total: result.checks.length, passed: result.checks.filter((c) => c.ok).length, failed: fail, pageErrors: result.pageErrors };
fs.writeFileSync(path.join(OUT, 'twotab.json'), JSON.stringify(result, null, 2));
await browser.close();
console.log(JSON.stringify(result.summary, null, 2));
console.log(JSON.stringify(result.scenarios, null, 2));
process.exit(fail.length ? 1 : 0);
