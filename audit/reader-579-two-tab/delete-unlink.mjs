/* Reader #579 · удаление заметки обязано снимать обратную ссылку.
   До правки: DELETE → { notes:0, annotation.noteId:"n1" } — ссылка на
   несуществующую запись. После: noteId === null, а Undo возвращает и запись,
   и связь. Тест идёт только через реальные кнопки библиотеки. */
import { chromium } from '/tmp/shimmod/pw-esm.mjs';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:19290';
const URL = '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open';
const NID = 'note-579-unlink', QID = 'quote-579-unlink';

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', serviceWorkers: 'block' })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));

await p.goto(BASE + URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.GBHighlights?.libraryVersion === 2, null, { timeout: 20000 });
await p.evaluate(({ nid, qid }) => {
  localStorage.setItem('gb-highlights-v1', JSON.stringify([{ id: qid, text: 'seed', url: location.pathname,
    kind: 'quote', annotation: { version: 1, kind: 'quote', color: 'amber',
      anchor: { prefix: '', suffix: '', exact: 'seed' }, noteId: nid } }]));
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify([{ id: nid, text: 'Заметка со связью',
    quoteId: qid, quoteText: 'seed', articleTitle: document.title, url: location.pathname, savedAt: 1 }]));
}, { nid: NID, qid: QID });
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.GBHighlights?.libraryVersion === 2, null, { timeout: 20000 });

const state = () => p.evaluate((qid) => {
  const notes = JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]');
  const quote = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').find((x) => x.id === qid);
  return { notes: notes.length, quotePresent: Boolean(quote), noteId: quote ? (quote.annotation?.noteId ?? null) : 'NO_QUOTE' };
}, QID);

await p.locator('#npULibraryButton').click();
await p.locator('#gb-hl-panel[role="dialog"]').waitFor({ state: 'visible' });
const before = await state();
await p.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"] [data-library-action="delete"]').click();
await p.waitForTimeout(900);
const afterDelete = await state();

// Undo должен вернуть и запись, и связь.
await p.locator("#gb-hl-status button").first().click();
await p.waitForTimeout(900);
const afterUndo = await state();

await b.close();
const checks = {
  quoteSurvives: afterDelete.quotePresent === true,
  unlinkOnDelete: before.noteId === NID && afterDelete.notes === 0 && afterDelete.noteId === null,
  undoRestoresBoth: afterUndo.notes === 1 && afterUndo.noteId === NID,
};
console.log(JSON.stringify({ before, afterDelete, afterUndo, checks,
  pass: Object.values(checks).every(Boolean), errors: errors.slice(0, 3) }, null, 2));
