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

// find a prose paragraph that CONTAINS an inline glossary term (.gterm)
const target = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  const ps = [...art.querySelectorAll('p')];
  const idx = ps.findIndex((p) => p.querySelector('.gterm, abbr, .gb-gloss')
    && p.textContent.trim().length > 150);
  if (idx < 0) return { ok: false };
  const p = ps[idx];
  const term = p.querySelector('.gterm, abbr, .gb-gloss');
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  const tr = term.getBoundingClientRect();
  return {
    ok: true, idx,
    termText: term.textContent,
    termRect: { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width) },
    blockId: p.id || null,
    blockTextSample: p.textContent.replace(/\s+/g, ' ').trim().slice(0, 200),
  };
});
if (!target.ok) { console.log('NO GLOSSARY PARAGRAPH FOUND'); await browser.close(); process.exit(0); }
await page.waitForTimeout(700);

// drag a selection that STARTS in plain text and ENDS after the glossary term
const geo = await page.evaluate(({ idx, termText }) => {
  const art = document.querySelector('article.article-body');
  const p = art.querySelectorAll('p')[idx];
  const nodes = [];
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) nodes.push(n);
  // locate the text node holding the glossary term
  let termNode = null, termOffset = -1;
  for (const node of nodes) {
    const i = node.nodeValue.indexOf(termText);
    if (i >= 0) { termNode = node; termOffset = i; break; }
  }
  if (!termNode) return { ok: false, why: 'term node not found' };
  const nodeIndex = nodes.indexOf(termNode);
  const startNode = nodes[Math.max(0, nodeIndex - 1)];
  const startOff = Math.max(0, startNode.nodeValue.length - 60);
  const endOff = Math.min(termNode.nodeValue.length, termOffset + termText.length + 40);
  const r = document.createRange();
  r.setStart(startNode, startOff);
  r.setEnd(termNode, endOff);
  const rects = [...r.getClientRects()].filter((q) => q.width > 2);
  const first = rects[0], last = rects[rects.length - 1];
  return {
    ok: true, rectCount: rects.length,
    x1: first.left + 2, y1: first.top + first.height / 2,
    x2: last.right - 2, y2: last.top + last.height / 2,
    intended: r.toString().replace(/\s+/g, ' ').trim(),
  };
}, { idx: target.idx, termText: target.termText });
if (!geo.ok) { console.log('GEO FAIL', JSON.stringify(geo)); await browser.close(); process.exit(0); }

await page.mouse.move(geo.x1, geo.y1);
await page.mouse.down();
await page.mouse.move(geo.x1 + 40, geo.y1, { steps: 5 });
await page.mouse.move(geo.x2, geo.y2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(700);

const tb = await page.evaluate(() => {
  const t = document.getElementById('npW57SelectionToolbar');
  if (!t || t.hidden) return { visible: false };
  return {
    visible: true,
    actions: [...t.querySelectorAll('[data-w57-action]')].map((b) => b.dataset.w57Action),
    selectedNow: window.getSelection().toString().replace(/\s+/g, ' ').trim().slice(0, 300),
  };
});
if (tb.visible) {
  await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
  await page.waitForTimeout(1200);
}
const stored = await page.evaluate(() => {
  const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
  const r = arr[0];
  if (!r) return { none: true };
  return {
    text: r.text,
    exact: r.annotation?.anchor?.exact,
    prefix: (r.annotation?.anchor?.prefix || '').slice(-60),
    suffix: (r.annotation?.anchor?.suffix || '').slice(0, 60),
    before: (r.before || '').slice(-60),
    after: (r.after || '').slice(0, 60),
    blockIndex: r.annotation?.anchor?.blockIndex,
    start: r.annotation?.anchor?.start,
    end: r.annotation?.anchor?.end,
  };
});
// reload and check what actually gets painted
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1500);
const painted = await page.evaluate(() => {
  const out = [];
  const hl = window.CSS && CSS.highlights;
  if (!hl) return { api: false };
  for (const [name, reg] of hl) {
    for (const range of reg) {
      out.push({
        name,
        text: range.toString().replace(/\s+/g, ' ').trim().slice(0, 200),
        inBlock: range.startContainer.parentElement?.closest('p')?.id || null,
      });
    }
  }
  return { api: true, ranges: out };
});
// agent 1 claim: floating "наверх" button over "Источники и материалы"
const upBtn = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role="button"], a')]
    .filter((el) => /наверх/i.test((el.getAttribute('aria-label') || '')
      + el.textContent + (el.getAttribute('data-tip') || '')));
  return cands.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      label: (el.getAttribute('aria-label') || el.textContent).replace(/\s+/g, ' ').trim().slice(0, 40),
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      visible: r.width > 1 && r.height > 1,
    };
  });
});
console.log(JSON.stringify({ target: { blockId: target.blockId, termText: target.termText },
  geo: { rectCount: geo.rectCount, intended: geo.intended }, tb, stored, painted, upBtn }, null, 1));
await page.screenshot({ path: '/tmp/audit-shots/R9_glossary_paint.png' });
await browser.close();
