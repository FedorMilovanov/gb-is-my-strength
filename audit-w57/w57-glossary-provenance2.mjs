import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1000);

// pick paragraph gill-search-p-012 (has 3 gterms, 6 text nodes)
const info = await page.evaluate(() => {
  const p = document.getElementById('gill-search-p-012');
  if (!p) return { ok: false };
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  const visibleText = p.innerText.replace(/\s+/g, ' ').trim();
  const rawText = p.textContent.replace(/\s+/g, ' ').trim();
  return {
    ok: true,
    visibleLen: visibleText.length,
    rawLen: rawText.length,
    inflatedBy: rawText.length - visibleText.length,
    gtipVisible: (() => {
      const g = p.querySelector('.gtip');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      const cs = getComputedStyle(g);
      return { w: Math.round(r.width), h: Math.round(r.height),
        display: cs.display, visibility: cs.visibility, position: cs.position,
        clip: cs.clipPath || cs.clip };
    })(),
  };
});
await page.waitForTimeout(600);

const geo = await page.evaluate(() => {
  const p = document.getElementById('gill-search-p-012');
  const nodes = [];
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) nodes.push(n);
  // find node index whose text equals the glossary label (Диссентеры)
  const abbr = p.querySelector('abbr.gterm');
  const labelNodeIdx = nodes.findIndex((node) => node.nodeValue.trim() === 'Диссентеры');
  if (labelNodeIdx < 0) return { ok: false, nodeTexts: nodes.map((x) => x.nodeValue.slice(0, 24)) };
  // start ~50 chars before, end inside the label (+3 chars)
  let startIdx = labelNodeIdx - 1;
  while (startIdx > 0 && nodes[startIdx].nodeValue.trim().length < 10) startIdx--;
  const startNode = nodes[startIdx];
  const startOff = Math.max(0, startNode.nodeValue.length - 50);
  const endNode = nodes[labelNodeIdx];
  const endOff = Math.min(endNode.nodeValue.length, 3);
  const r = document.createRange();
  r.setStart(startNode, startOff);
  r.setEnd(endNode, endOff);
  const rects = [...r.getClientRects()].filter((q) => q.width > 2);
  if (!rects.length) return { ok: false, why: 'no rects' };
  const first = rects[0], last = rects[rects.length - 1];
  return {
    ok: true,
    nodeTexts: nodes.map((x) => x.nodeValue.slice(0, 30)),
    startIdx, labelNodeIdx,
    selectionString: r.toString(),
    x1: first.left + 2, y1: first.top + first.height / 2,
    x2: last.right - 2, y2: last.top + last.height / 2,
    multiline: rects.length,
  };
});
if (!geo.ok) { console.log('GEO FAIL', JSON.stringify(geo, null, 1)); await browser.close(); process.exit(0); }

await page.mouse.move(geo.x1, geo.y1);
await page.mouse.down();
await page.mouse.move(geo.x1 + 30, geo.y1, { steps: 4 });
await page.mouse.move(geo.x2, geo.y2, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(600);

const selNow = await page.evaluate(() => ({
  sel: window.getSelection().toString(),
  rectCount: window.getSelection().rangeCount
    ? window.getSelection().getRangeAt(0).getClientRects().length : 0,
}));
const tb = await page.evaluate(() => {
  const t = document.getElementById('npW57SelectionToolbar');
  return t && !t.hidden
    ? { visible: true, actions: [...t.querySelectorAll('[data-w57-action]')]
        .map((b) => b.dataset.w57Action) }
    : { visible: false };
});
if (tb.visible) {
  await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
  await page.waitForTimeout(1200);
}
const stored = await page.evaluate(() => {
  const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
  return arr.map((r) => ({
    text: r.text,
    len: r.text ? r.text.length : 0,
    anchorExact: r.annotation?.anchor?.exact?.slice(0, 160),
    before: (r.before || '').slice(-50),
    after: (r.after || '').slice(0, 50),
    hasGtip: /Английский протестант|Лондонское место|Течение, отрицающее/.test(r.text || ''),
  }));
});
await page.screenshot({ path: '/tmp/audit-shots/R10_glossary_selection.png' });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1600);
const painted = await page.evaluate(() => {
  const out = [];
  if (!window.CSS || !CSS.highlights) return { api: false };
  for (const [name, reg] of CSS.highlights) {
    for (const range of reg) {
      out.push({ name, text: range.toString().replace(/\s+/g, ' ').trim() });
    }
  }
  return { api: true, ranges: out };
});
console.log(JSON.stringify({
  para: info, geo: { startIdx: geo.startIdx, labelNodeIdx: geo.labelNodeIdx,
    selectionString: geo.selectionString.slice(0, 200), multiline: geo.multiline },
  selNow: { len: selNow.sel.length, text: selNow.sel.slice(0, 200) },
  tb, stored, painted,
}, null, 1));
await browser.close();
