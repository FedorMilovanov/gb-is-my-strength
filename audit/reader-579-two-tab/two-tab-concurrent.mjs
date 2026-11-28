// W107b — genuinely CONCURRENT writes on the shared note store, two tabs,
// one browser profile. Sequential guards are covered by twotab.mjs; here the
// two Save presses are dispatched in the same tick from separate renderers.
//
// Case 1 (update/update): both tabs edit the SAME note.
// Case 1b (update/update, Product LIbrary on BOTH sides): the same record is
//        edited through the native Library editor in both tabs.
// Case 1c (Product A vs Product B with DIFFERENT records): unrelated edits.
// Case 2 (create/create): each tab creates its OWN new note — nobody is
//        editing the same record, so a per-record snapshot guard cannot help;
//        this is a whole-array read-modify-write test.
import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:19224';
const ROUTE = '/articles/dzhon-gill-chast-2-uchenyi/';
const URL_ = BASE + ROUTE + '?reader-pilot=1&paper=space&panel=open';
const OUT = process.env.QA_OUT || 'reports/reader-579-twotab/evidence';
const NOTES_KEY = 'gb-reader-notes-v1', QUOTES_KEY = 'gb-highlights-v1';
const QID = 'quote-w107c', NID = 'note-w107c';
const SRC = 'Исходная версия для параллельной записи';
const ROUNDS = Number(process.env.QA_ROUNDS || 10);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/tmp/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
const errors = [];
const open = async (label) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  await p.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready), null, { timeout: 30000 });
  return p;
};
const ready = (p) => p.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready), null, { timeout: 30000 });
const A = await open('A'), B = await open('B');

// --- canonical anchored quote (real Range, real geometry) ---
const capture = (p) => p.evaluate(() => {
  const article = window.GBReaderContract?.articleRoot?.(document);
  if (!article || !window.GBReaderAnchors?.capture) throw Error('canonical anchor owner missing');
  let node = null, block = null;
  for (const b of window.GBReaderAnchors.blocks(article)) {
    if (!b.getClientRects().length || b.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeValue.trim().length >= 75 && !n.parentElement?.closest('.gtip,.btip,.tooltip,[hidden],[inert],[aria-hidden="true"]')) { node = n; block = b; break; }
    }
    if (node) break;
  }
  if (!node) throw Error('no eligible authored block');
  block.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = document.createRange();
  r.setStart(node, 3); r.setEnd(node, Math.min(node.nodeValue.length, 58));
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const src = window.GBReaderAnchors.capture(article);
  sel.removeAllRanges();
  if (!src?.anchor) throw Error('capture failed');
  return { anchor: src.anchor, text: src.text };
});
const anchor = await capture(A);
const seed = (p, notes) => p.evaluate(({ n, a }) => {
  const url = location.origin + location.pathname;
  const q = { id: 'quote-w107c', text: a.text, articleTitle: document.title, url, savedAt: Date.now(),
    kind: 'quote', color: 'amber',
    annotation: { version: 1, kind: 'quote', color: 'amber', anchor: a.anchor, noteId: 'note-w107c' } };
  localStorage.setItem('gb-highlights-v1', JSON.stringify([q]));
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify(n));
  return true;
}, { n: notes, a: anchor });
const openW57 = async (p) => {
  const det = p.locator('#npW57NotesDetails');
  if (!(await det.evaluate((x) => x.open))) await det.locator('summary').click();
  await p.locator(`#npW57NotesList li[data-id="${QID}"] [data-action="edit"]`).click();
};
const sectionStatus = (p) => p.evaluate(() => (document.querySelector('#npW57NotesDetails #npW57NotesStatus')?.textContent || '').trim());
const w57Open = (p) => p.locator('#npW57NoteEditor').isVisible();

// ============ case 1: update / update, same tick ============
const upd = { rounds: ROUNDS, outcomes: [], torn: 0, silentBothSuccess: 0, oneRefused: 0 };
for (let i = 0; i < ROUNDS; i++) {
  const base = [{ id: NID, text: SRC, quoteId: QID, quoteText: anchor.text, articleTitle: 'fixture', url: 'x', savedAt: Date.now() }];
  await seed(A, base);
  await Promise.all([A.reload({ waitUntil: 'domcontentloaded' }), B.reload({ waitUntil: 'domcontentloaded' })]);
  await Promise.all([ready(A), ready(B)]);
  await Promise.all([openW57(A), openW57(B)]);
  const same = await Promise.all([A.locator('#npW57NoteText').inputValue(), B.locator('#npW57NoteText').inputValue()]);
  await Promise.all([A.locator('#npW57NoteText').fill('A' + i), B.locator('#npW57NoteText').fill('B' + i)]);
  await Promise.all([
    A.evaluate(() => document.querySelector('#npW57SaveNote').click()),
    B.evaluate(() => document.querySelector('#npW57SaveNote').click()),
  ]);
  await A.waitForTimeout(400);
  const store = await A.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), NOTES_KEY);
  const st = await Promise.all([sectionStatus(A), sectionStatus(B)]);
  const state = {
    aOpen: await w57Open(A), bOpen: await w57Open(B),
    aDraft: await A.locator('#npW57NoteText').inputValue().catch(() => ''),
    bDraft: await B.locator('#npW57NoteText').inputValue().catch(() => ''),
  };
  // A writer "refused" when its editor stayed open with the draft intact.
  const aRefused = state.aOpen && state.aDraft === 'A' + i;
  const bRefused = state.bOpen && state.bDraft === 'B' + i;
  const o = {
    round: i, sameSource: same[0] === SRC && same[1] === SRC,
    texts: store.map((n) => n.text), aRefused, bRefused,
    statusA: st[0].slice(0, 90), statusB: st[1].slice(0, 90),
  };
  if (store.length !== 1) upd.torn++;
  if (!aRefused && !bRefused) upd.silentBothSuccess++;
  if (aRefused !== bRefused) upd.oneRefused++;
  upd.outcomes.push(o);
}

// ============ case 1b: update/update through the native Library in BOTH tabs ============
const lib = { rounds: ROUNDS, outcomes: [] };
for (let i = 0; i < lib.rounds; i++) {
  await seed(A, [{ id: NID, text: SRC, quoteId: QID, quoteText: anchor.text, articleTitle: 'fixture', url: 'x', savedAt: Date.now() }]);
  await Promise.all([A.reload({ waitUntil: 'domcontentloaded' }), B.reload({ waitUntil: 'domcontentloaded' })]);
  await Promise.all([ready(A), ready(B)]);
  await Promise.all([
    A.evaluate(() => document.querySelector('#gb-hl-fab').click()),
    B.evaluate(() => document.querySelector('#gb-hl-fab').click()),
  ]);
  await Promise.all([A.locator('#gb-hl-panel').waitFor({ state: 'visible' }), B.locator('#gb-hl-panel').waitFor({ state: 'visible' })]);
  await Promise.all([
    A.locator('#gb-hl-list article.gb-hl-item [data-library-action="edit-note"]').click(),
    B.locator('#gb-hl-list article.gb-hl-item [data-library-action="edit-note"]').click(),
  ]);
  const opened = await Promise.all([A.locator('#gb-hl-note-text').inputValue(), B.locator('#gb-hl-note-text').inputValue()]);
  await Promise.all([A.locator('#gb-hl-note-text').fill('LibA' + i), B.locator('#gb-hl-note-text').fill('LibB' + i)]);
  await A.waitForTimeout(100);
  await Promise.all([
    A.evaluate(() => document.querySelector('#gb-hl-editor button[type="submit"]').click()),
    B.evaluate(() => document.querySelector('#gb-hl-editor button[type="submit"]').click()),
  ]);
  await A.waitForTimeout(500);
  const store = await A.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), 'gb-reader-notes-v1');
  const st = await Promise.all([
    A.evaluate(() => ({ open: !document.querySelector('#gb-hl-editor').hidden, msg: (document.querySelector('#gb-hl-status')?.textContent || '').trim().slice(0, 60) })),
    B.evaluate(() => ({ open: !document.querySelector('#gb-hl-editor').hidden, msg: (document.querySelector('#gb-hl-status')?.textContent || '').trim().slice(0, 60) })),
  ]);
  lib.outcomes.push({ round: i, sameSource: opened[0] === SRC && opened[1] === SRC, texts: store.map((n) => n.text), a: st[0], b: st[1] });
  await Promise.all([
    A.evaluate(() => document.querySelector('#gb-hl-backdrop')?.classList.remove('is-open')),
    B.evaluate(() => document.querySelector('#gb-hl-backdrop')?.classList.remove('is-open')),
  ]);
}

// ============ case 2: create / create, two DIFFERENT notes, same tick ============
const cre = { rounds: ROUNDS, outcomes: [], bothSurvived: 0, lostOne: 0 };
for (let i = 0; i < ROUNDS; i++) {
  await seed(A, []);
  await Promise.all([A.reload({ waitUntil: 'domcontentloaded' }), B.reload({ waitUntil: 'domcontentloaded' })]);
  await Promise.all([ready(A), ready(B)]);
  // Both tabs use the real "Новая заметка" flow of the Product Library.
  await Promise.all([A.evaluate(() => document.querySelector('#gb-hl-fab').click()), B.evaluate(() => document.querySelector('#gb-hl-fab').click())]);
  await Promise.all([
    A.locator('#gb-hl-panel').waitFor({ state: 'visible' }), B.locator('#gb-hl-panel').waitFor({ state: 'visible' }),
  ]);
  await Promise.all([
    A.evaluate(() => document.querySelector('#gb-hl-new-note').click()),
    B.evaluate(() => document.querySelector('#gb-hl-new-note').click()),
  ]);
  await Promise.all([
    A.locator('#gb-hl-note-text').fill('Новая A' + i), B.locator('#gb-hl-note-text').fill('Новая B' + i),
  ]);
  await A.waitForTimeout(120);
  // Same-tick dispatch: locator.click() would add protocol latency and make the
  // two writers merely sequential, which is NOT the case under test.
  await Promise.all([
    A.evaluate(() => document.querySelector('#gb-hl-editor button[type="submit"]').click()),
    B.evaluate(() => document.querySelector('#gb-hl-editor button[type="submit"]').click()),
  ]);
  await A.waitForTimeout(400);
  const store = await A.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), NOTES_KEY);
  const texts = store.map((n) => n.text);
  const both = texts.includes('Новая A' + i) && texts.includes('Новая B' + i);
  if (both) cre.bothSurvived++; else cre.lostOne++;
  const aMsg = await A.evaluate(() => (document.querySelector('#gb-hl-status')?.textContent || '').trim());
  const bMsg = await B.evaluate(() => (document.querySelector('#gb-hl-status')?.textContent || '').trim());
  cre.outcomes.push({ round: i, texts, both, aMsg: aMsg.slice(0, 70), bMsg: bMsg.slice(0, 70), uniqueIds: new Set(store.map((n) => n.id)).size });
  await Promise.all([
    A.evaluate(() => document.querySelector('#gb-hl-backdrop')?.classList.remove('is-open')),
    B.evaluate(() => document.querySelector('#gb-hl-backdrop')?.classList.remove('is-open')),
  ]);
}

const summary = {
  // case 1
  update: { rounds: upd.rounds, sameSourceAll: upd.outcomes.every((o) => o.sameSource), tornWrites: upd.torn,
    silentBothSucceeded: upd.silentBothSuccess, exactlyOneRefused: upd.oneRefused, outcomes: upd.outcomes },
  // case 2
  create: { rounds: cre.rounds, bothSurvived: cre.bothSurvived, lostOne: cre.lostOne, outcomes: cre.outcomes },
  library: { rounds: lib.rounds, silentLoss: lib.outcomes.filter((o) => o.texts.length === 1 && !o.a.open && !o.b.open).length, outcomes: lib.outcomes },
  errors: errors.slice(0, 5),
};
fs.writeFileSync(path.join(OUT, 'concurrent.json'), JSON.stringify(summary, null, 2));
await browser.close();
console.log(JSON.stringify({ update: { ...summary.update, outcomes: undefined }, create: { ...summary.create, outcomes: undefined }, library: { ...summary.library, outcomes: undefined }, errors: summary.errors }, null, 2));
