import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const runs = [];
for (const attempt of [1, 2, 3]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
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
    return { y, x1: findX(prev, Math.max(0, prev.nodeValue.length - 30)),
      x2: findX(next, Math.min(next.nodeValue.length, 45)),
      termCx: Math.round(t.left + t.width / 2), termCy: Math.round(t.top + t.height / 2), term };
  }, setup);

  // 1) drag across the term
  await page.mouse.move(pts.x1, pts.y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) { await page.mouse.move(pts.x1 + ((pts.x2 - pts.x1) * i) / 40, pts.y); await page.waitForTimeout(8); }
  await page.mouse.up();
  await page.waitForTimeout(300);

  // 2) natural continuation: the hand travels from the selection end toward the toolbar,
  //    i.e. straight back over the highlighted glossary word
  await page.mouse.move(pts.termCx, pts.termCy, { steps: 12 });
  await page.waitForTimeout(1200);

  const snap = await page.evaluate(() => {
    const tb = document.getElementById('npW57SelectionToolbar');
    const tips = [...document.querySelectorAll('.gb-floating-tip.is-open, #gb-tip-1, .gtip-luxury')]
      .map((t) => { const r = t.getBoundingClientRect(); const cs = getComputedStyle(t);
        return { cls: String(t.className).split(' ').slice(0, 3).join('.'), z: cs.zIndex,
          pe: cs.pointerEvents, open: t.classList.contains('is-open'),
          w: Math.round(r.width), h: Math.round(r.height),
          x: Math.round(r.x), y: Math.round(r.y) }; })
      .filter((t) => t.w > 40);
    const acts = tb && !tb.hidden ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { a: b.dataset.w57Action, hitSelf: el === b || b.contains(el),
        blocker: el && !b.contains(el) ? String(el.className).split(' ').slice(0, 2).join('.') : null };
    }) : [];
    const tr = tb && !tb.hidden ? tb.getBoundingClientRect() : null;
    let overlap = 0;
    const open = tips.find((t) => t.open);
    if (open && tr) {
      const ox = Math.max(0, Math.min(tr.x + tr.width, open.x + open.w) - Math.max(tr.x, open.x));
      const oy = Math.max(0, Math.min(tr.y + tr.height, open.y + open.h) - Math.max(tr.y, open.y));
      overlap = Math.round((ox * oy) / (tr.width * tr.height) * 100);
    }
    return { toolbar: tr ? { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height) } : null,
      tips, actions: acts, blocked: acts.filter((a) => !a.hitSelf).length, overlapPct: overlap };
  });

  // 3) user presses «Цитата» with the real pointer
  const q = await page.evaluate(() => {
    const b = document.querySelector('#npW57SelectionToolbar [data-w57-action="quote"]');
    if (!b) return null; const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  let click = null;
  if (q) {
    await page.mouse.move(q.x, q.y, { steps: 10 });
    await page.waitForTimeout(120);
    const before = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? String(el.className || el.tagName).split(' ').slice(0, 2).join('.') : null;
    }, q);
    await page.mouse.click(q.x, q.y);
    await page.waitForTimeout(1300);
    click = { topAtButton: before, ...(await page.evaluate(() => ({
      stored: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
      toolbarStillOpen: !document.getElementById('npW57SelectionToolbar')?.hidden,
      status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
    }))) };
  }
  await page.screenshot({ path: `/tmp/audit-shots/R24_hoverpath_run${attempt}.png` });
  runs.push({ attempt, pts, snap, click });
  await ctx.close();
}
console.log(JSON.stringify(runs, null, 1));
await browser.close();
