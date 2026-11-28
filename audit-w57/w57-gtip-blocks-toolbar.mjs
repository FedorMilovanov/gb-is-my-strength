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
  return {
    x1: f.left + 2, y1: f.top + f.height / 2,
    x2: l.right - 2, y2: l.top + l.height / 2,
    intended: r.toString().replace(/\s+/g, ' ').trim(),
  };
});
await page.waitForTimeout(500);
await page.mouse.move(geo.x1, geo.y1);
await page.mouse.down();
await page.mouse.move(geo.x1 + 30, geo.y1, { steps: 4 });
await page.mouse.move(geo.x2, geo.y2, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(900);

const state = await page.evaluate(() => {
  const tb = document.getElementById('npW57SelectionToolbar');
  const tip = document.querySelector('#gb-tip-1, .gb-floating-tip, .gtip-luxury');
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      z: cs.zIndex, position: cs.position, display: cs.display,
      visibility: cs.visibility, pointerEvents: cs.pointerEvents,
      cls: String(el.className).slice(0, 60),
    };
  };
  // hit-test every toolbar action
  const actions = tb ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
    const r = b.getBoundingClientRect();
    const cx = Math.round(r.x + r.width / 2);
    const cy = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return {
      action: b.dataset.w57Action,
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      hitIsSelf: !!(hit && (hit === b || b.contains(hit))),
      hitTag: hit ? (hit.tagName + (hit.id ? '#' + hit.id : '') + '.' + String(hit.className).split(/\s+/)[0]) : null,
    };
  }) : [];
  return {
    toolbar: rect(tb),
    tooltip: rect(tip),
    tooltipOverlapsToolbar: (() => {
      if (!tb || !tip) return null;
      const a = tb.getBoundingClientRect(), b = tip.getBoundingClientRect();
      return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    })(),
    actions,
    selectionLen: window.getSelection().toString().length,
  };
});

// now try clicking each action with a real mouse and see if the action fires
const results = [];
for (const a of state.actions) {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length);
  await page.mouse.click(a.box.x + a.box.w / 2, a.box.y + a.box.h / 2);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({
    n: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
    status: document.getElementById('npW57NotesStatus')?.textContent.trim() || '',
  }));
  results.push({ action: a.action, hitIsSelf: a.hitIsSelf, hitTag: a.hitTag,
    storedBefore: before, storedAfter: after.n, status: after.status.slice(0, 70) });
  // re-select for the next attempt if the toolbar closed
  const stillOpen = await page.evaluate(() => {
    const t = document.getElementById('npW57SelectionToolbar');
    return !!(t && !t.hidden);
  });
  if (!stillOpen) break;
}
await page.screenshot({ path: '/tmp/audit-shots/R11_gtip_blocks_toolbar.png' });
console.log(JSON.stringify({ geo: { intended: geo.intended }, state, results }, null, 1));
await browser.close();
