import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(900);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1000);

const geo = await page.evaluate(() => {
  const p = document.getElementById('gill-search-p-012');
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  const nodes = [];
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) nodes.push(n);
  const labelIdx = nodes.findIndex((x) => x.nodeValue.trim() === 'Диссентеры');
  const startNode = nodes[labelIdx - 1];
  const r = document.createRange();
  r.setStart(startNode, Math.max(0, startNode.nodeValue.length - 40));
  r.setEnd(nodes[labelIdx], 3);
  const rects = [...r.getClientRects()].filter((q) => q.width > 2);
  const f = rects[0], l = rects[rects.length - 1];
  return { x1: f.left + 2, y1: f.top + f.height / 2,
    x2: l.right - 2, y2: l.top + l.height / 2 };
});
await page.waitForTimeout(500);
await page.mouse.move(geo.x1, geo.y1);
await page.mouse.down();
await page.mouse.move(geo.x1 + 30, geo.y1, { steps: 4 });
await page.mouse.move(geo.x2, geo.y2, { steps: 14 });
await page.mouse.up();
// mouse stays resting on the glossary term, exactly as a user would leave it
const snapshots = [];
for (const wait of [200, 600, 1200, 2000, 3000]) {
  await page.waitForTimeout(wait === 200 ? 200 : wait - (snapshots.length ? [200, 600, 1200, 2000][snapshots.length - 1] : 0));
  const s = await page.evaluate(() => {
    const tb = document.getElementById('npW57SelectionToolbar');
    const tips = [...document.querySelectorAll('.gb-floating-tip, [role="tooltip"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { id: el.id, cls: String(el.className).slice(0, 50),
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          vis: cs.visibility, op: cs.opacity, z: cs.zIndex, pe: cs.pointerEvents };
      }).filter((t) => t.w > 1 && t.h > 1);
    const actions = tb && !tb.hidden ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
      const tbRect = tb.getBoundingClientRect();
      const tipEl = tips[0];
      const covers = tipEl
        ? !(tbRect.right < tipEl.x || tipEl.x + tipEl.w < tbRect.left
            || tbRect.bottom < tipEl.y || tipEl.y + tipEl.h < tbRect.top)
        : null;
      return { a: b.dataset.w57Action, clickable: !!(hit && (hit === b || b.contains(hit))),
        blockedBy: hit && !(hit === b || b.contains(hit)) ? (hit.tagName + (hit.id ? '#' + hit.id : '')) : null,
        tooltipCoversToolbar: covers };
    }) : [];
    return { toolbarOpen: !!(tb && !tb.hidden), tips, actions };
  });
  snapshots.push({ atMs: wait, ...s });
}
// attempt a real click on the action that is blocked (if any)
const blocked = snapshots[snapshots.length - 1].actions.find((a) => !a.clickable);
let clickOutcome = null;
if (blocked) {
  const box = await page.evaluate((act) => {
    const b = document.querySelector('#npW57SelectionToolbar [data-w57-action="' + act + '"]');
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, blocked.a);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length);
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1000);
  clickOutcome = await page.evaluate((n) => ({
    storedBefore: n,
    storedAfter: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
    status: document.getElementById('npW57NotesStatus')?.textContent.trim() || '',
    toolbarStillOpen: (() => { const t = document.getElementById('npW57SelectionToolbar'); return !!(t && !t.hidden); })(),
    selectionKept: window.getSelection().toString().length > 0,
  }), before);
}
await page.screenshot({ path: '/tmp/audit-shots/R13_gtip_intercept.png' });
console.log(JSON.stringify({ snapshots, blockedAction: blocked || null, clickOutcome }, null, 1));
await browser.close();
