/* Reader #579 · потеря правки: «Восстановить из JSON» против одновременного
   сохранения заметки в другой вкладке того же профиля.

   Третий писатель: js/reader-library-v3.js → atomicImport() пишет
   gb-highlights-v1 / gb-reader-notes-v1 ЦЕЛИКОМ из снапшота serializeCurrent(),
   не беря Web-Lock `gb-library:gb-reader-notes-v1`. Заметка, сохранённая в
   другой вкладке после снятия снапшота, затирается без предупреждения.

   Тест идёт через РЕАЛЬНЫЙ UI: «⋯» → «↑ Восстановить» → выбор файла →
   «Добавить без замены». Никаких прямых setItem в проверяемом пути. */
import { chromium, webkit } from '/tmp/shimmod/pw-esm.mjs';
import { writeFileSync } from 'node:fs';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:19290';
const URL = '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open';
const NID = 'note-579-import', QID = 'quote-579-import';
const rounds = Number(process.env.QA_ROUNDS || 6);

const backup = (noteText) => JSON.stringify({
  format: 'gospod-bog-reader-library', version: 3,
  exportedAt: new Date().toISOString(),
  data: {
    quotes: [{ id: QID, text: 'seed', url: URL.split('?')[0], kind: 'quote',
      annotation: { version: 1, kind: 'quote', color: 'amber',
        anchor: { prefix: '', suffix: '', exact: 'seed' }, noteId: NID } }],
    notes: [{ id: NID, text: noteText, quoteId: QID, quoteText: 'seed', savedAt: 1 }],
    favorites: [], tags: {}, reading: {}, revisit: {},
  },
}, null, 2);

async function ready(page) {
  await page.waitForFunction(() => window.GBHighlights?.libraryVersion === 2, null, { timeout: 20000 });
}
async function openLibrary(page) {
  await page.locator('#npULibraryButton').click();
  await page.locator('#gb-hl-panel[role="dialog"]').waitFor({ state: 'visible' });
}
async function runRound(engine, seedText) {
  const browser = await engine.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', serviceWorkers: 'block' });
  const A = await ctx.newPage(), B = await ctx.newPage();
  const errors = [];
  for (const p of [A, B]) p.on('pageerror', (e) => errors.push(String(e)));
  try {
    await A.goto(BASE + URL, { waitUntil: 'domcontentloaded' }); await ready(A);
    // Seed: одна цитата + одна заметка, обе вкладки читают одну версию.
    await A.evaluate(({ nid, qid, seedText }) => {
      localStorage.setItem('gb-highlights-v1', JSON.stringify([{ id: qid, text: 'seed',
        url: location.pathname, kind: 'quote', annotation: { version: 1, kind: 'quote',
          color: 'amber', anchor: { prefix: '', suffix: '', exact: 'seed' }, noteId: nid } }]));
      localStorage.setItem('gb-reader-notes-v1', JSON.stringify([{ id: nid, text: seedText,
        quoteId: qid, quoteText: 'seed', articleTitle: document.title,
        url: location.pathname, savedAt: 1 }]));
    }, { nid: NID, qid: QID, seedText });
    await A.reload({ waitUntil: 'domcontentloaded' }); await ready(A);
    await B.goto(BASE + URL, { waitUntil: 'domcontentloaded' }); await ready(B);

    const before = await A.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1'))[0].text);

    // --- Вкладка B: пользователь открыл управление (снапшот снят здесь) ---
    await openLibrary(B);
    await B.locator('#gb-hl-manage').click();
    await B.locator('#gb-hl-manage-panel').waitFor({ state: 'visible' });

    // --- Вкладка A: ОДНОВРЕМЕННО сохраняет правку заметки штатным путём ---
    await A.evaluate(() => document.querySelector('#gb-hl-fab')?.click());
    await A.locator('#gb-hl-panel[role="dialog"]').waitFor({ state: 'visible' });
    await A.locator('#gb-hl-list .gb-hl-item[data-type="note"][data-id="' + NID + '"] [data-library-action="edit-note"]').click();
    await A.locator('#gb-hl-note-text').fill('Правка вкладки A — не должна потеряться');
    await A.locator('#gb-hl-editor button[type="submit"]').click();
    await A.waitForFunction(() => {
      const n = JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]');
      return n.length === 1 && n[0].text === 'Правка вкладки A — не должна потеряться';
    }, null, { timeout: 8000 });
    const afterEditA = await A.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1'))[0].text);

    // --- Вкладка B: подтверждает импорт из снапшота (сделан до правки A) ---
    const file = backup(seedText);            // бэкап со СТАРЫМ текстом
    const path = `${process.env.TMPDIR || '/tmp'}/reader-579-import-${Date.now()}.json`;
    writeFileSync(path, file);
    await B.setInputFiles('#gb-hl-manage-panel input[type="file"], input[type="file"]', path);
    await B.locator('[data-research-action="confirm-import"]').click();
    await B.waitForFunction(() => {
      const n = JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]');
      return n.length === 1 && n[0].text !== 'Правка вкладки A — не должна потеряться';
    }, null, { timeout: 4000 }).catch(() => {});
    const afterImport = await A.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]')[0].text);
    const lost = afterEditA === 'Правка вкладки A — не должна потеряться' && afterImport !== afterEditA;
    return { engine: 'chromium', before, afterEditA, afterImport, lostSilently: lost, errors: errors.slice(0, 3) };
  } finally { await browser.close(); }
}

const out = [];
for (let i = 0; i < rounds; i++) out.push(await runRound(chromium, `Исходный текст, раунд ${i + 1}`));
console.log(JSON.stringify({
  rounds, lostSilently: out.filter((x) => x.lostSilently).length,
  details: out.slice(0, rounds),
}, null, 2));
