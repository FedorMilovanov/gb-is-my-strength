import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const steps = {};
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1200);
await page.evaluate(() => localStorage.clear());

async function openNotes() {
  await page.evaluate(() => {
    const d = document.getElementById('npW57NotesDetails');
    if (d && !d.open) d.open = true;
  });
  await page.waitForTimeout(300);
}
async function drag(pIdx, frac1, frac2) {
  const g = await page.evaluate(({ pIdx, frac1, frac2 }) => {
    const art = document.querySelector('article.article-body');
    const ps = [...art.querySelectorAll('p')]
      .filter((p) => p.textContent.trim().length > 220 && !p.closest('.gill-card, details, aside'));
    const p = ps[pIdx]; if (!p) return { ok: false };
    p.scrollIntoView({ block: 'center', behavior: 'instant' });
    const nodes = []; const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) nodes.push(n);
    const len = nodes.reduce((a, x) => a + x.nodeValue.length, 0);
    const rr0 = document.createRange(); rr0.setStart(nodes[0], 0); rr0.setEnd(nodes[0], 1);
    const line0 = rr0.getClientRects()[0];
    const a = Math.floor(len * frac1), b = Math.floor(len * frac2);
    let pos = 0, sn, en, so, eo;
    for (const node of nodes) { const L = node.nodeValue.length;
      if (sn == null && a < pos + L) { sn = node; so = a - pos; }
      if (b <= pos + L) { en = node; eo = b - pos; break; } pos += L; }
    const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
    const onFirst = [...r.getClientRects()].filter((q) => q.width > 2 && Math.abs(q.top - line0.top) < 2);
    if (!onFirst.length) return { ok: false };
    return { ok: true, x1: line0.left + 2, x2: onFirst[onFirst.length - 1].right, y: line0.top + line0.height / 2 };
  }, { pIdx, frac1, frac2 });
  if (!g.ok) return null;
  await page.mouse.move(g.x1, g.y); await page.mouse.down();
  await page.mouse.move((g.x1 + g.x2) / 2, g.y, { steps: 6 });
  await page.mouse.move(g.x2, g.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(600);
  return page.evaluate(() => window.getSelection().toString().replace(/\s+/g, ' ').trim());
}
const clickAction = async (a) => {
  await page.click(`#npW57SelectionToolbar [data-w57-action="${a}"]`);
  await page.waitForTimeout(1100);
};
const state = () => page.evaluate(() => ({
  records: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').map((r) => ({
    id: r.id, kind: r.annotation?.kind, color: r.annotation?.color, len: (r.text || '').length,
    hasNote: !!r.note, noteLen: (r.note || '').length, projection: r.annotation?.anchor?.projection,
  })),
  count: document.getElementById('npW57NotesCount')?.textContent,
  status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
  highlights: (() => { const o = []; if (window.CSS?.highlights) for (const [n, reg] of CSS.highlights) for (const r of reg) o.push(n); return o; })(),
}));

// 1 marker
steps.sel1 = await drag(1, 0.03, 0.20);
await clickAction('marker');
steps.afterMarker = await state();

// 2 colour change on the same record via the palette in the notes list
await openNotes();
const colorResult = await page.evaluate(() => {
  const pal = document.getElementById('npW57Palette');
  const swatches = pal ? [...pal.querySelectorAll('button')] : [];
  const blue = swatches.find((b) => b.getAttribute('aria-label') === 'Голубой');
  if (!blue) return { ok: false, n: swatches.length };
  blue.click();
  return { ok: true, n: swatches.length };
});
await page.waitForTimeout(600);
const recolor = await page.evaluate(() => {
  const item = document.querySelector('#npW57NotesList [data-w57-item], #npW57NotesList li');
  const btns = item ? [...item.querySelectorAll('button')] : [];
  const colorBtn = btns.find((b) => /Цвет/i.test(b.textContent));
  if (colorBtn) { colorBtn.click(); }
  return btns.map((b) => b.textContent.trim().slice(0, 20));
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const item = document.querySelector('#npW57NotesList [data-w57-item], #npW57NotesList li');
  const blueSw = item ? [...item.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Голубой' || b.dataset.color === 'blue') : null;
  if (blueSw) blueSw.click();
});
await page.waitForTimeout(900);
steps.afterColor = await state();

// 3 note: add
await page.evaluate(() => {
  const item = document.querySelector('#npW57NotesList [data-w57-item], #npW57NotesList li');
  const b = item ? [...item.querySelectorAll('button')].find((x) => /заметк/i.test(x.textContent)) : null;
  if (b) b.click();
});
await page.waitForTimeout(700);
const noteInput = await page.$('#npW57NotesList textarea, #npW57NoteEditor textarea, textarea');
if (noteInput) {
  await noteInput.click();
  await noteInput.type('Проверка заметки агента 7 — черновик.');
  await page.waitForTimeout(300);
  const saveBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#npW57NotesList button, #npW57NoteEditor button')];
    const b = btns.find((x) => /Сохранить|Добавить/i.test(x.textContent));
    if (b) { b.click(); return b.textContent.trim(); } return null;
  });
  await page.waitForTimeout(1000);
  steps.noteSaveBtn = saveBtn;
}
steps.afterNote = await state();

// 4 reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1800);
steps.afterReload = await state();
steps.afterReloadOrphans = await page.evaluate(() => window.__NP_W57_ANNOTATIONS__?.orphanCount?.());

// 5 delete with undo
await openNotes();
const del = await page.evaluate(() => {
  const item = document.querySelector('#npW57NotesList [data-w57-item], #npW57NotesList li');
  const b = item ? [...item.querySelectorAll('button')].find((x) => /Удалить/i.test(x.textContent)) : null;
  if (b) { b.click(); return true; } return false;
});
await page.waitForTimeout(800);
const undo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#npW57NotesStatus button, #npW57NotesList button')];
  const b = btns.find((x) => /Отменить/i.test(x.textContent));
  if (b) { b.click(); return true; } return false;
});
await page.waitForTimeout(900);
steps.delete = del; steps.undoClicked = undo;
steps.afterUndo = await state();
console.log(JSON.stringify(steps, null, 1));
await browser.close();
