import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';

async function run(action) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.clear());
  // pick a prose paragraph and drag on its first line (real pointer)
  const g = await page.evaluate(() => {
    const art = document.querySelector('article.article-body');
    const ps = [...art.querySelectorAll('p')]
      .filter((p) => p.textContent.trim().length > 200 && !p.closest('.gill-card, details, aside'));
    const p = ps[1] || ps[0];
    p.scrollIntoView({ block: 'center', behavior: 'instant' });
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let n; const nodes = []; while ((n = w.nextNode())) nodes.push(n);
    const len = nodes.reduce((a, x) => a + x.nodeValue.length, 0);
    const rr0 = document.createRange(); rr0.setStart(nodes[0], 0); rr0.setEnd(nodes[0], 1);
    const line0 = rr0.getClientRects()[0];
    const startAt = Math.floor(len * 0.03), endAt = Math.floor(len * 0.28);
    let pos = 0, sn, en, so, eo;
    for (const node of nodes) {
      const L = node.nodeValue.length;
      if (sn == null && startAt < pos + L) { sn = node; so = startAt - pos; }
      if (endAt <= pos + L) { en = node; eo = endAt - pos; break; }
      pos += L;
    }
    const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
    const onFirst = [...r.getClientRects()].filter((q) => q.width > 2 && Math.abs(q.top - line0.top) < 2);
    return { x1: line0.left + 2, x2: onFirst[onFirst.length - 1].right, y: line0.top + line0.height / 2 };
  });
  const state = () => page.evaluate(() => {
    const f = document.getElementById('gb-hl-fab');
    const cs = f ? getComputedStyle(f) : null;
    const r = f ? f.getBoundingClientRect() : { width: 0, height: 0 };
    const panel = document.getElementById('npUResearch');
    return {
      visible: !!(cs && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 10),
      display: cs?.display, w: Math.round(r.width),
      hideRight: document.body.classList.contains('np-u-hide-right'),
      researchOpen: !!panel?.classList.contains('open'),
      bodyClasses: [...document.body.classList].filter((c) => c.startsWith('np-')).join(' '),
    };
  });
  const before = await state();
  await page.mouse.move(g.x1, g.y);
  await page.mouse.down();
  await page.mouse.move((g.x1 + g.x2) / 2, g.y, { steps: 6 });
  await page.mouse.move(g.x2, g.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const tbOpen = await page.evaluate(() => {
    const t = document.getElementById('npW57SelectionToolbar');
    return !!(t && !t.hidden);
  });
  if (tbOpen) { await page.click(`#npW57SelectionToolbar [data-w57-action="${action}"]`); }
  await page.waitForTimeout(1300);
  const after = await state();
  const q = await page.evaluate(() => ({
    stored: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
    status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
  }));
  await page.screenshot({ path: `/tmp/audit-shots/R17_fab_after_${action}.png` });
  await page.close();
  return { action, toolbarOpened: tbOpen, before, after, ...q };
}

const rows = [];
for (const a of ['marker', 'underline', 'quote', 'note']) rows.push(await run(a));
console.log(JSON.stringify(rows, null, 1));
await browser.close();
