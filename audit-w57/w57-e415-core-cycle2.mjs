import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const S = {};
const state = () => page.evaluate(() => ({
  records: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').map((r) => ({
    kind: r.annotation?.kind, color: r.annotation?.color, len: (r.text || '').length,
    noteLen: (r.note || '').length, projection: r.annotation?.anchor?.projection })),
  count: document.getElementById('npW57NotesCount')?.textContent,
  status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
  highlights: (() => { const o = new Set(); if (window.CSS?.highlights) for (const [n] of CSS.highlights) o.add(n); return [...o]; })(),
  orphans: window.__NP_W57_ANNOTATIONS__?.orphanCount?.(),
}));
async function openRail() {
  await page.evaluate(() => { if (document.body.classList.contains('np-u-hide-right')) document.getElementById('npUEdgeToggle')?.click(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const d = document.getElementById('npW57NotesDetails'); if (d && !d.open) d.open = true; });
  await page.waitForTimeout(500);
}
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1200);
await page.evaluate(() => localStorage.clear());

// note BEFORE any save: is the FAB visible with the rail open? (F1 context)
await openRail();
S.railOpenFab = await page.evaluate(() => {
  const f = document.getElementById('gb-hl-fab'); const cs = f && getComputedStyle(f);
  return { hideRight: document.body.classList.contains('np-u-hide-right'),
    fab: cs ? { display: cs.display, visibility: cs.visibility } : null };
});
await openRail();
// seed via real drag + marker button
const g = await page.evaluate(() => {
  const p = [...document.querySelectorAll('article.article-body p')]
    .filter((x) => x.textContent.trim().length > 250 && !x.closest('.gill-card,details,aside'))[2];
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  const nodes = []; const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) nodes.push(n);
  const rr = document.createRange(); rr.setStart(nodes[0], 0); rr.setEnd(nodes[0], 1);
  const l0 = rr.getClientRects()[0];
  const len = nodes[0].nodeValue.length;
  const r = document.createRange(); r.setStart(nodes[0], 5); r.setEnd(nodes[0], Math.min(len, 70));
  const rects = [...r.getClientRects()].filter((q) => Math.abs(q.top - l0.top) < 2);
  return { x1: l0.left + 2, x2: rects[rects.length - 1].right, y: l0.top + l0.height / 2 };
});
await page.mouse.move(g.x1, g.y); await page.mouse.down();
await page.mouse.move((g.x1 + g.x2) / 2, g.y, { steps: 5 });
await page.mouse.move(g.x2, g.y, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(600);
await page.click('#npW57SelectionToolbar [data-w57-action="marker"]');
await page.waitForTimeout(1200);
S.afterSave = await state();
await openRail();
S.listBoxes = await page.evaluate(() => {
  const li = document.querySelector('#npW57NotesList li');
  const box = (el) => el ? (({ width, height }) => ({ w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null;
  return { li: box(li), meta: box(li?.querySelector('.np-w57-annotation-meta')),
    buttons: li ? [...li.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), box: box(b) })) : [] };
});

// colour via list
const recolor = await page.evaluate(() => {
  const li = document.querySelector('#npW57NotesList li');
  const b = li && [...li.querySelectorAll('button')].find((x) => x.dataset.action === 'recolor');
  if (!b) return { clicked: false };
  b.click();
  return { clicked: true };
});
await page.waitForTimeout(500);
const swatch = await page.evaluate(() => {
  const li = document.querySelector('#npW57NotesList li');
  const btns = li ? [...li.querySelectorAll('button')] : [];
  const blue = btns.find((b) => (b.getAttribute('aria-label') || '').includes('Голубой'));
  if (blue) { blue.click(); return { ok: true, n: btns.length }; }
  return { ok: false, labels: btns.map((b) => b.getAttribute('aria-label')).filter(Boolean) };
});
await page.waitForTimeout(900);
S.recolor = { ...recolor, swatch };
S.afterRecolor = await state();

// note add
const editClick = await page.evaluate(() => {
  const li = document.querySelector('#npW57NotesList li');
  const b = li && [...li.querySelectorAll('button')].find((x) => x.dataset.action === 'edit');
  if (!b) return false; b.click(); return true;
});
await page.waitForTimeout(600);
const ta = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('#npW57NotesList textarea, #npW57NotesList input[type="text"]')];
  const vis = cands.filter((c) => c.getBoundingClientRect().width > 20);
  return { n: cands.length, vis: vis.length, id: vis[0]?.id || vis[0]?.className || null };
});
S.noteEditor = { editClick, ...ta };
if (ta.vis > 0) {
  const handle = (await page.$$('#npW57NotesList textarea, #npW57NotesList input[type="text"]')).find(async () => true);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('#npW57NotesList textarea, #npW57NotesList input[type="text"]')]
      .find((x) => x.getBoundingClientRect().width > 20);
    if (c) { c.focus(); c.value = 'Заметка агента 7: проверка сохранения.'; c.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#npW57NotesList button')];
    const b = btns.find((x) => /Сохранить|Добавить заметку/i.test(x.textContent) && x.getBoundingClientRect().width > 10);
    if (b) { b.click(); return b.textContent.trim(); } return null;
  });
  await page.waitForTimeout(1000);
  S.noteSavedVia = saved;
}
S.afterNote = await state();

// reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1700);
S.afterReload = await state();
await openRail();
S.afterReloadRail = await state();

// delete + undo
const del = await page.evaluate(() => {
  const li = document.querySelector('#npW57NotesList li');
  const b = li && [...li.querySelectorAll('button')].find((x) => x.dataset.action === 'delete');
  if (!b) return false; b.click(); return true;
});
await page.waitForTimeout(900);
S.deleteClicked = del;
S.afterDelete = await state();
const undo = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#npW57NotesStatus button, #npW57NotesList button')]
    .find((x) => /Отменить/i.test(x.textContent));
  if (b) { b.click(); return true; } return false;
});
await page.waitForTimeout(900);
S.undoClicked = undo;
S.afterUndo = await state();
await page.screenshot({ path: '/tmp/audit-shots/R36_core_cycle.png' });
console.log(JSON.stringify(S, null, 1));
await browser.close();
