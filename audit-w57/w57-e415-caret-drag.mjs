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

  // 1. bring a glossary term into a stable viewport position and let fonts settle
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
  await page.waitForTimeout(1200);   // layout must settle AFTER scrolling

  // 2. find exact pointer X positions via caretRangeFromPoint (immune to stale rects)
  const pts = await page.evaluate(({ blockId, term }) => {
    const p = document.getElementById(blockId);
    const abbr = [...p.querySelectorAll('abbr.gterm')].find(
      (a) => (a.firstChild.nodeValue || '').trim() === term);
    if (!abbr) return { ok: false, why: 'term gone' };
    const t = abbr.getClientRects()[0];
    if (!t || t.top < 40 || t.bottom > innerHeight - 40) return { ok: false, why: 'term offscreen', top: t && t.top };
    const y = Math.round(t.top + t.height / 2);
    const scan = [];
    for (let x = Math.round(t.left) - 200; x <= Math.round(t.right) + 200; x += 2) {
      const c = document.caretRangeFromPoint(x, y);
      if (!c) continue;
      const r = document.createRange();
      r.setStart(p, 0); r.endContainer && r.setEnd(c.startContainer, c.startOffset);
      scan.push({ x, off: r.toString().length });
    }
    if (!scan.length) return { ok: false, why: 'no carets' };
    // visible-label boundaries in projected text: locate label occurrence in p.innerText
    const near = scan.find((s) => s.x >= Math.round(t.left))?.off ?? scan[0].off;
    const before = scan.filter((s) => s.off <= near - 25).pop();
    const after = scan.filter((s) => s.off >= near + 40)[0];
    const inside = scan.find((s) => s.x > t.left + t.width * 0.4 && s.x < t.right);
    return { ok: true, y, termBox: { left: Math.round(t.left), right: Math.round(t.right) },
      beforeX: before?.x, beforeOff: before?.off, afterX: after?.x, afterOff: after?.off,
      insideX: inside?.x, insideOff: inside?.off, lineOffsets: scan.length };
  }, setup);
  if (!pts.ok) { out.push({ mode, pts }); await page.close(); continue; }

  const x1 = mode === 'cross' ? pts.beforeX : pts.insideX;
  const x2 = pts.afterX;
  await page.mouse.move(x1, pts.y);
  await page.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x1 + ((x2 - x1) * i) / steps, pts.y);
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
      toolbarBox: tb && !tb.hidden ? (() => { const r = tb.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null };
  }, setup.term);

  let saved = null, hits = [];
  if (sel.toolbarVisible) {
    hits = await page.evaluate(() => {
      const tb = document.getElementById('npW57SelectionToolbar');
      return [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
        const r = b.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { a: b.dataset.w57Action, hitSelf: el === b || b.contains(el), top: el?.className || el?.tagName };
      });
    });
    await page.screenshot({ path: `/tmp/audit-shots/R19_sel_${mode}.png` });
    await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
    await page.waitForTimeout(1400);
    saved = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
      const r = arr[0];
      return r ? { text: r.text, len: (r.text || '').length,
        projection: r.annotation?.anchor?.projection,
        exactEqText: r.annotation?.anchor?.exact === r.text,
        prefix: (r.annotation?.anchor?.prefix || '').slice(-40),
        suffix: (r.annotation?.anchor?.suffix || '').slice(0, 40),
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
  await page.screenshot({ path: `/tmp/audit-shots/R20_after_${mode}.png` });
  out.push({ mode, pts, sel, hits, saved, paint });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
