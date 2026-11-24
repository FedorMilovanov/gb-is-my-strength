/* Reader #579 · воскрешение удалённой заметки импортом старой копии.

   Чего ждёт #579: «без воскрешения и смены annotation.noteId».
   Что проверяем: пользователь удалил заметку (вкладка A), затем в той же
   библиотеке восстанавливает старую копию JSON (вкладка B). safeMerge берёт
   `old.concat(next)` по ключу `n.id`, поэтому удалённая запись возвращается
   из бэкапа — она снова видна в списке и снова связана с цитатой.
   Это может быть и осознанной функцией «восстановление из бэкапа», поэтому
   тест фиксирует НАБЛЮДАЕМОЕ поведение, не объявляя его багом заранее. */
import { chromium } from '/tmp/shimmod/pw-esm.mjs';
import { writeFileSync } from 'node:fs';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:19290';
const URL = '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open';
const NID = 'note-579-res', QID = 'quote-579-res';

const backupWith = (text) => JSON.stringify({
  format: 'gospod-bog-reader-library', version: 3, exportedAt: new Date().toISOString(),
  data: {
    quotes: [{ id: QID, text: 'seed', url: URL.split('?')[0], kind: 'quote',
      annotation: { version: 1, kind: 'quote', color: 'amber',
        anchor: { prefix: '', suffix: '', exact: 'seed' }, noteId: NID } }],
    notes: [{ id: NID, text, quoteId: QID, quoteText: 'seed', savedAt: 1 }],
    favorites: [], tags: {}, reading: {}, revisit: {},
  },
}, null, 2);

async function ready(p) { await p.waitForFunction(() => window.GBHighlights?.libraryVersion === 2, null, { timeout: 20000 }); }
async function openLib(p) {
  await p.locator('#npULibraryButton').click();
  await p.locator('#gb-hl-panel[role="dialog"]').waitFor({ state: 'visible' });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', serviceWorkers: 'block' });
const A = await ctx.newPage(), B = await ctx.newPage();
const errors = [];
for (const p of [A, B]) p.on('pageerror', (e) => errors.push(String(e)));

await A.goto(BASE + URL, { waitUntil: 'domcontentloaded' }); await ready(A);
await A.evaluate(({ nid, qid }) => {
  localStorage.setItem('gb-highlights-v1', JSON.stringify([{ id: qid, text: 'seed', url: location.pathname,
    kind: 'quote', annotation: { version: 1, kind: 'quote', color: 'amber',
      anchor: { prefix: '', suffix: '', exact: 'seed' }, noteId: nid } }]));
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify([{ id: nid, text: 'Заметка, которую удалят',
    quoteId: qid, quoteText: 'seed', articleTitle: document.title, url: location.pathname, savedAt: 1 }]));
}, { nid: NID, qid: QID });
await A.reload({ waitUntil: 'domcontentloaded' }); await ready(A);
await B.goto(BASE + URL, { waitUntil: 'domcontentloaded' }); await ready(B);

// A удаляет заметку реальной кнопкой Product Library.
await openLib(A);
await A.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"] [data-library-action="delete"]').click();
await A.waitForFunction(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').length === 0, null, { timeout: 8000 });
const afterDelete = await A.evaluate(() => ({
  notes: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').length,
  link: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]')[0]?.annotation?.noteId ?? null,
}));

// B восстанавливает старую копию, где заметка ещё есть.
await openLib(B);
await B.locator('#gb-hl-manage').click();
await B.locator('#gb-hl-manage-panel').waitFor({ state: 'visible' });
const path = `${process.env.TMPDIR || '/tmp'}/reader-579-res-${Date.now()}.json`;
writeFileSync(path, backupWith('Заметка, которую удалят'));
await B.setInputFiles('input[type="file"]', path);
await B.locator('[data-research-action="confirm-import"]').click();
await B.waitForTimeout(1500);

const afterImport = await A.evaluate(() => ({
  notes: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').map((n) => ({ id: n.id, text: n.text })),
  link: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]')[0]?.annotation?.noteId ?? null,
}));
await browser.close();
console.log(JSON.stringify({
  afterDelete, afterImport,
  resurrected: afterDelete.notes === 0 && afterImport.notes.length > 0,
  linkChanged: afterDelete.link !== afterImport.link,
  errors: errors.slice(0, 3),
}, null, 2));
