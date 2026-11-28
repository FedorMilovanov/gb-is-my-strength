import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const results = [];

// scenario A: drag starts before the term, ends after it (crosses the whole word)
// scenario B: drag starts INSIDE the term, ends after it
for (const mode of ['cross', 'from-inside', 'term-only']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(200);

  const geo = await page.evaluate((mode) => {
    const art = document.querySelector('article.article-body');
    for (const abbr of art.querySelectorAll('abbr.gterm')) {
      const p = abbr.closest('p'); if (!p) continue;
      abbr.scrollIntoView({ block: 'center', behavior: 'instant' });
      const rects = [...abbr.getClientRects()].filter((r) => r.width > 8);
      if (!rects.length) continue;
      const t = rects[0];
      // need visible prose to the left on the same line
      const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let n, firstNode = null;
      while ((n = w.nextNode())) { if (n.nodeValue.trim().length > 30) { firstNode = n; break; } }
      if (!firstNode) continue;
      const label = (abbr.firstChild.nodeValue || '').trim();
      const at = firstNode.nodeValue.indexOf(label);
      if (at < 30) continue;
      const left = document.createRange();
      left.setStart(firstNode, 0); left.setEnd(firstNode, at);
      const lr = [...left.getClientRects()].filter((r) => Math.abs(r.top - t.top) < 3 && r.right <= t.left + 2);
      if (!lr.length) continue;
      const y = Math.round(t.top + t.height / 2);
      let x1, x2;
      if (mode === 'cross') { x1 = Math.round(Math.max(lr[lr.length - 1].right - 100, t.left - 140)); x2 = Math.round(t.right + 90); }
      else if (mode === 'from-inside') { x1 = Math.round(t.left + t.width * 0.35); x2 = Math.round(t.right + 90); }
      else { x1 = Math.round(t.left - 2); x2 = Math.round(t.right + 2); }
      return { ok: true, blockId: p.id, term: label, x1, x2, y,
        termBox: { left: Math.round(t.left), right: Math.round(t.right) },
        abbrTextLen: abbr.textContent.length,
        gtipLen: abbr.querySelector('.gtip')?.textContent.trim().length || 0 };
    }
    return { ok: false };
  }, mode);
  if (!geo.ok) { results.push({ mode, geo }); await page.close(); continue; }

  await page.mouse.move(geo.x1, geo.y);
  await page.mouse.down();
  const step = (geo.x2 - geo.x1) / 30;
  for (let i = 1; i <= 30; i++) { await page.mouse.move(geo.x1 + step * i, geo.y); await page.waitForTimeout(9); }
  await page.mouse.up();
  await page.waitForTimeout(700);

  const sel = await page.evaluate(() => {
    const s = window.getSelection();
    const tb = document.getElementById('npW57SelectionToolbar');
    return {
      nativeText: s.toString().replace(/\s+/g, ' ').trim(),
      rangeText: s.rangeCount ? s.getRangeAt(0).toString().replace(/\s+/g, ' ').trim() : null,
      toolbarVisible: !!(tb && !tb.hidden),
      toolbar: tb && !tb.hidden ? (() => { const r = tb.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
    };
  });
  const coveringTerm = sel.nativeText.includes(geo.term);
  let saved = null;
  if (sel.toolbarVisible) {
    await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
    await page.waitForTimeout(1300);
    saved = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
      const r = arr[0];
      return r ? { n: arr.length, text: r.text,
        len: (r.text || '').length,
        projection: r.annotation?.anchor?.projection,
        exactEqualsText: r.annotation?.anchor?.exact === r.text,
        containsHidden: r.text !== r.text.replace(/\s+/g, ' ') ? false : undefined,
        status: document.getElementById('npW57NotesStatus')?.textContent.trim() } : { none: true };
    });
  }
  await page.screenshot({ path: `/tmp/audit-shots/R18_drag_${mode}.png` });

  // reload → paint check
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
  await page.waitForTimeout(1700);
  const paint = await page.evaluate(() => {
    const out = [];
    if (window.CSS?.highlights) for (const [n, reg] of CSS.highlights) for (const r of reg)
      out.push({ name: n, text: r.toString().replace(/\s+/g, ' ').trim() });
    return { regs: out, count: document.getElementById('npW57NotesCount')?.textContent,
      orphan: window.__NP_W57_ANNOTATIONS__?.orphanCount?.() };
  });
  results.push({ mode, geo, selection: sel, coveringTerm, saved, paint });
  await page.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
