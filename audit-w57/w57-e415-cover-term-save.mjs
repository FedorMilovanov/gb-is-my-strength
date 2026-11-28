import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.clear());
const setup = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  for (const abbr of art.querySelectorAll('abbr.gterm')) {
    const p = abbr.closest('p'); if (!p) continue;
    const label = (abbr.firstChild.nodeValue || '').trim();
    if (label.length < 5) continue;
    abbr.scrollIntoView({ block: 'center', behavior: 'instant' });
    return { blockId: p.id, term: label };
  }
});
await page.waitForTimeout(1200);
const pts = await page.evaluate(({ blockId, term }) => {
  const p = document.getElementById(blockId);
  const abbr = [...p.querySelectorAll('abbr.gterm')].find((a) => (a.firstChild.nodeValue || '').trim() === term);
  const t = abbr.getClientRects()[0];
  const y = Math.round(t.top + t.height / 2);
  let prev = abbr.previousSibling, next = abbr.nextSibling;
  while (prev && prev.nodeType !== 3) prev = prev.previousSibling;
  while (next && next.nodeType !== 3) next = next.nextSibling;
  const findX = (node, offset) => { let best = null;
    for (let x = Math.round(t.left) - 260; x <= t.right + 260; x += 1) {
      const c = document.caretRangeFromPoint(x, y);
      if (!c || c.startContainer !== node) continue;
      const d = Math.abs(c.startOffset - offset);
      if (!best || d < best.d) best = { x, d }; if (!d) break; }
    return best?.x; };
  return { y, x1: findX(prev, Math.max(0, prev.nodeValue.length - 45)),
    x2: findX(next, Math.min(next.nodeValue.length, 60)), term,
    termCx: Math.round(t.left + t.width / 2), termCy: Math.round(t.top + t.height / 2) };
}, setup);

await page.mouse.move(pts.x1, pts.y);
await page.mouse.down();
for (let i = 1; i <= 40; i++) { await page.mouse.move(pts.x1 + ((pts.x2 - pts.x1) * i) / 40, pts.y); await page.waitForTimeout(8); }
await page.mouse.up();
await page.waitForTimeout(400);
const sel = await page.evaluate((term) => {
  const s = window.getSelection(); const txt = s.toString().replace(/\s+/g, ' ').trim();
  const tb = document.getElementById('npW57SelectionToolbar');
  return { nativeText: txt, coversTerm: txt.includes(term), toolbarVisible: !!(tb && !tb.hidden) };
}, pts.term);

// travel to the toolbar WITHOUT parking on the term: go up out of the text column first
await page.mouse.move(pts.termCx, 700, { steps: 8 });
await page.mouse.move(pts.termCx, 60, { steps: 8 });
await page.mouse.move(700, 380, { steps: 8 });
await page.waitForTimeout(300);
// dismiss any open tooltip by moving off it, then confirm it is closed
const tipState = await page.evaluate(() => {
  const open = document.querySelector('.gb-floating-tip.is-open');
  const tb = document.getElementById('npW57SelectionToolbar');
  const acts = tb && !tb.hidden ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { a: b.dataset.w57Action, ok: el === b || b.contains(el) };
  }) : [];
  return { openTip: !!open, actions: acts };
});
const q = await page.evaluate(() => {
  const b = document.querySelector('#npW57SelectionToolbar [data-w57-action="quote"]');
  if (!b) return null; const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
let saved = null;
if (q && tipState.actions.every((a) => a.ok)) {
  await page.mouse.click(q.x, q.y);
  await page.waitForTimeout(1400);
  saved = await page.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
    const r = arr[0];
    return r ? { raw: JSON.stringify(r).slice(0, 600), text: r.text, len: r.text.length, projection: r.annotation?.anchor?.projection,
      exactEqText: r.annotation?.anchor?.exact === r.text,
      status: document.getElementById('npW57NotesStatus')?.textContent.trim() } : { none: true };
  });
}
await page.screenshot({ path: '/tmp/audit-shots/R27_cover_term_saved.png' });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1800);
const paint = await page.evaluate(() => {
  const regs = [];
  if (window.CSS?.highlights) for (const [n, reg] of CSS.highlights) for (const r of reg)
    regs.push({ n, text: r.toString().replace(/\s+/g, ' ').trim() });
  const list = document.getElementById('npW57NotesList');
  return { regs, count: document.getElementById('npW57NotesCount')?.textContent,
    orphan: window.__NP_W57_ANNOTATIONS__?.orphanCount?.(),
    items: list ? [...list.children].map(c => c.textContent.replace(/\s+/g,' ').trim().slice(0,90)) : [],
    unresolvedMark: list ? /не найден/.test(list.textContent) : null };
});
await page.screenshot({ path: '/tmp/audit-shots/R28_cover_term_reload.png' });
console.log(JSON.stringify({ pts, sel, tipState, saved, paint }, null, 1));
await browser.close();
