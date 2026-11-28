import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const out = {};
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());
await page.waitForTimeout(300);

// locate a glossary term sitting mid-line with prose on both sides
const geo = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  for (const abbr of art.querySelectorAll('abbr.gterm')) {
    const p = abbr.closest('p'); if (!p) continue;
    abbr.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rects = [...abbr.getClientRects()].filter((r) => r.width > 8);
    if (!rects.length) continue;
    const t = rects[0];
    const y = t.top + t.height / 2;
    // require visible text to the left and right on the same line
    const leftRange = document.createRange();
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let n, firstNode = null;
    while ((n = walker.nextNode())) { if (n.nodeValue.trim()) { firstNode = n; break; } }
    if (!firstNode) continue;
    leftRange.setStart(firstNode, 0);
    const label = abbr.firstChild.nodeValue;
    const at = firstNode.nodeValue.indexOf(label);
    if (at < 20) continue;
    leftRange.setEnd(firstNode, at);           // everything before the term
    const lrects = [...leftRange.getClientRects()].filter((r) => Math.abs(r.top - t.top) < 3 && r.left < t.left - 5);
    if (!lrects.length) continue;
    const startX = Math.max(lrects[lrects.length - 1].right - 120, lrects[0].left + 3);
    return {
      ok: true, blockId: p.id, term: label.trim(),
      x1: Math.round(startX), x2: Math.round(t.right + 110), y: Math.round(y),
      termLeft: Math.round(t.left), termRight: Math.round(t.right),
      visibleBefore: firstNode.nodeValue.slice(0, at).trim().slice(-70),
      visibleAfter: p.innerText.replace(/\s+/g, ' ').slice(
        p.innerText.replace(/\s+/g, ' ').indexOf(label.trim()) + label.trim().length,
        p.innerText.replace(/\s+/g, ' ').indexOf(label.trim()) + label.trim().length + 70),
      abbrTextLen: abbr.textContent.length,
    };
  }
  return { ok: false };
});
out.geo = geo;
if (!geo.ok) { console.log(JSON.stringify(out, null, 1)); await browser.close(); process.exit(0); }

// REAL pointer drag: down before the term, move over it, release after it
await page.mouse.move(geo.x1, geo.y);
await page.mouse.down();
for (let x = geo.x1; x <= geo.x2; x += 12) {
  await page.mouse.move(x, geo.y);
  await page.waitForTimeout(12);
}
await page.mouse.move(geo.x2, geo.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(700);

out.selection = await page.evaluate(() => {
  const s = window.getSelection();
  const tb = document.getElementById('npW57SelectionToolbar');
  const tbr = tb && !tb.hidden ? tb.getBoundingClientRect() : null;
  return {
    nativeText: s.toString().replace(/\s+/g, ' ').trim(),
    nativeLen: s.toString().trim().length,
    toolbarVisible: !!(tb && !tb.hidden),
    toolbarRect: tbr ? { x: Math.round(tbr.x), y: Math.round(tbr.y),
      w: Math.round(tbr.width), h: Math.round(tbr.height) } : null,
    actions: tb && !tb.hidden
      ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => b.dataset.w57Action) : [],
  };
});
await page.screenshot({ path: '/tmp/audit-shots/R15_real_drag_over_term.png' });

// hit-test every toolbar action under the real pointer (MAX asked for hit target check)
out.hitTargets = await page.evaluate(() => {
  const tb = document.getElementById('npW57SelectionToolbar');
  if (!tb || tb.hidden) return [];
  return [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { action: b.dataset.w57Action, self: el === b || b.contains(el),
      top: el ? (el.className || el.tagName) : null,
      w: Math.round(r.width), h: Math.round(r.height) };
  });
});

if (out.selection.toolbarVisible) {
  await page.click('#npW57SelectionToolbar [data-w57-action="marker"]');
  await page.waitForTimeout(1200);
}
out.stored = await page.evaluate(() => {
  const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
  const r = arr[0]; if (!r) return { none: true };
  return { n: arr.length, text: r.text, textLen: (r.text || '').length,
    anchorExact: r.annotation?.anchor?.exact,
    projection: r.annotation?.anchor?.projection,
    hasGtipText: /протестант|Подробнее|диссентер/.test(r.text || '') };
});
// glossary must still open after marking (MAX's follow-up)
out.glossaryAfterMark = await page.evaluate(() => {
  const abbr = document.querySelector('article.article-body abbr.gterm');
  if (!abbr) return { none: true };
  abbr.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  const tip = abbr.querySelector('.gtip');
  const cs = tip ? getComputedStyle(tip) : null;
  return { tipExists: !!tip, display: cs?.display, visibility: cs?.visibility,
    hasOpenClass: abbr.classList.contains('is-open') || !!document.querySelector('.gterm.is-open') };
});
// reload → repaint check
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1800);
out.afterReload = await page.evaluate(() => {
  const names = []; const painted = [];
  if (window.CSS?.highlights) {
    for (const [n, reg] of CSS.highlights) { names.push(n); for (const r of reg) painted.push(r.toString().replace(/\s+/g, ' ').trim()); }
  }
  return { registries: names, painted, count: document.getElementById('npW57NotesCount')?.textContent,
    orphan: window.__NP_W57_ANNOTATIONS__?.orphanCount?.() };
});
await page.screenshot({ path: '/tmp/audit-shots/R16_after_reload_term.png' });

// ---- F1 regression on the new head: FAB after annotating ----
out.fabAfterSave = await page.evaluate(() => {
  const f = document.getElementById('gb-hl-fab');
  if (!f) return { none: true };
  const cs = getComputedStyle(f); const r = f.getBoundingClientRect();
  return { display: cs.display, visibility: cs.visibility,
    w: Math.round(r.width), h: Math.round(r.height),
    ariaLabel: f.getAttribute('aria-label'),
    bodyHideRight: document.body.classList.contains('np-u-hide-right'),
    researchOpen: !!document.getElementById('npUResearch')?.classList.contains('open') };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
