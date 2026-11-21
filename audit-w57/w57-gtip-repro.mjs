import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const out = [];
for (let run = 1; run <= 3; run++) {
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
  await page.waitForTimeout(1000);

  const probe = await page.evaluate(() => {
    const tb = document.getElementById('npW57SelectionToolbar');
    if (!tb || tb.hidden) return { toolbar: false };
    const actions = [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
      return { a: b.dataset.w57Action, ok: !!(hit && (hit === b || b.contains(hit))),
        by: hit ? (hit.tagName + (hit.id ? '#' + hit.id : '')) : null };
    });
    const tips = [...document.querySelectorAll('.gb-floating-tip, #gb-tip-1, [role="tooltip"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { cls: String(el.className).slice(0, 40), w: Math.round(r.width),
          h: Math.round(r.height), vis: cs.visibility, z: cs.zIndex,
          open: el.classList.contains('is-open') };
      }).filter((t) => t.w > 1);
    return { toolbar: true, actions, tips };
  });
  // try a real click on the first blocked action (if any) and see what happens
  let clickResult = null;
  if (probe.toolbar) {
    const blocked = probe.actions.find((x) => !x.ok);
    const box = await page.evaluate((act) => {
      const b = document.querySelector('#npW57SelectionToolbar [data-w57-action="' + act + '"]');
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }, (blocked || probe.actions[0]).a).catch(() => null);
    if (box) {
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length);
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        n: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
        status: document.getElementById('npW57NotesStatus')?.textContent.trim() || '',
        toolbarOpen: (() => { const t = document.getElementById('npW57SelectionToolbar'); return !!(t && !t.hidden); })(),
      }));
      clickResult = { action: (blocked || probe.actions[0]).a,
        wasBlocked: !!blocked, storedBefore: before, storedAfter: after.n,
        status: after.status.slice(0, 60), toolbarOpen: after.toolbarOpen };
    }
  }
  out.push({ run, probe, clickResult });
  if (run === 3) await page.screenshot({ path: '/tmp/audit-shots/R12_gtip_run3.png' });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
