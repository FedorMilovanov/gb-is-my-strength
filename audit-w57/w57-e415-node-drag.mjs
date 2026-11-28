import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const out = [];

for (const mode of ['cross', 'from-inside']) {
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
    return null;
  });
  await page.waitForTimeout(1200);

  // resolve exact pointer X for a (textNode, offset) pair on the term's line
  const pts = await page.evaluate(({ blockId, term, mode }) => {
    const p = document.getElementById(blockId);
    const abbr = [...p.querySelectorAll('abbr.gterm')].find((a) => (a.firstChild.nodeValue || '').trim() === term);
    if (!abbr) return { ok: false, why: 'term' };
    const t = abbr.getClientRects()[0];
    if (!t) return { ok: false, why: 'rect' };
    const y = Math.round(t.top + t.height / 2);
    const labelNode = abbr.firstChild;
    let prev = abbr.previousSibling, next = abbr.nextSibling;
    while (prev && prev.nodeType !== 3) prev = prev.previousSibling;
    while (next && next.nodeType !== 3) next = next.nextSibling;
    if (!prev || !next) return { ok: false, why: 'nodes', prev: !!prev, next: !!next };
    const target = mode === 'cross'
      ? { node: prev, offset: Math.max(0, prev.nodeValue.length - 30) }
      : { node: labelNode, offset: Math.max(1, Math.floor(labelNode.nodeValue.length * 0.5)) };
    const targetEnd = { node: next, offset: Math.min(next.nodeValue.length, 45) };
    const findX = (want) => {
      let best = null;
      for (let x = Math.round(t.left) - 260; x <= t.right + 260; x += 1) {
        const c = document.caretRangeFromPoint(x, y);
        if (!c || c.startContainer !== want.node) continue;
        const d = Math.abs(c.startOffset - want.offset);
        if (!best || d < best.d) best = { x, d, off: c.startOffset };
        if (d === 0) break;
      }
      return best;
    };
    const a = findX(target), b = findX(targetEnd);
    if (!a || !b) return { ok: false, why: 'caret', a, b };
    return { ok: true, y, x1: a.x, x2: b.x, startOff: a.off, endOff: b.off,
      termBox: { left: Math.round(t.left), right: Math.round(t.right) },
      label: term };
  }, { ...setup, mode });
  if (!pts.ok) { out.push({ mode, pts }); await page.close(); continue; }

  await page.mouse.move(pts.x1, pts.y);
  await page.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(pts.x1 + ((pts.x2 - pts.x1) * i) / steps, pts.y);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);

  const sel = await page.evaluate((term) => {
    const s = window.getSelection();
    const tb = document.getElementById('npW57SelectionToolbar');
    const txt = s.toString().replace(/\s+/g, ' ').trim();
    return { nativeText: txt, len: txt.length, coversTerm: txt.includes(term),
      toolbarVisible: !!(tb && !tb.hidden),
      actions: tb && !tb.hidden ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => b.dataset.w57Action) : [] };
  }, setup.term);

  let saved = null;
  if (sel.toolbarVisible) {
    await page.screenshot({ path: `/tmp/audit-shots/R21_sel_${mode}.png` });
    await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
    await page.waitForTimeout(1400);
    saved = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
      const r = arr[0];
      return r ? { text: r.text, len: (r.text || '').length,
        projection: r.annotation?.anchor?.projection,
        exactEqText: r.annotation?.anchor?.exact === r.text,
        status: document.getElementById('npW57NotesStatus')?.textContent.trim() } : { none: true };
    });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
  await page.waitForTimeout(1800);
  const paint = await page.evaluate(() => {
    const regs = [];
    if (window.CSS?.highlights) for (const [n, reg] of CSS.highlights) for (const r of reg)
      regs.push({ n, text: r.toString().replace(/\s+/g, ' ').trim() });
    return { regs, count: document.getElementById('npW57NotesCount')?.textContent,
      orphan: window.__NP_W57_ANNOTATIONS__?.orphanCount?.() };
  });
  await page.screenshot({ path: `/tmp/audit-shots/R22_after_${mode}.png` });
  out.push({ mode, pts, sel, saved, paint });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
