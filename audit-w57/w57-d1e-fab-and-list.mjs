import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(900);

const fab = () => page.evaluate(() => {
  const f = document.getElementById('gb-hl-fab');
  if (!f) return { present: false };
  const r = f.getBoundingClientRect();
  const cs = getComputedStyle(f);
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
    cls: f.className, scrollY: Math.round(scrollY),
    bodyHideRight: document.body.classList.contains('np-u-hide-right'),
    panelOpen: !!document.querySelector('#npUResearch.open'),
    researchX: document.querySelector('#npUResearch')
      ? Math.round(document.querySelector('#npUResearch').getBoundingClientRect().x) : null,
  };
});
// select + mark a quote naturally (reuse working drag)
await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  const ps = [...art.querySelectorAll('p')].filter((p) => p.textContent.trim().length > 200
    && !p.closest('.gill-card, details, aside'));
  ps[1].scrollIntoView({ block: 'center', behavior: 'instant' });
});
await page.waitForTimeout(700);
const g = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  const ps = [...art.querySelectorAll('p')].filter((p) => p.textContent.trim().length > 200
    && !p.closest('.gill-card, details, aside'));
  const p = ps[1];
  const nodes = [];
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let x; while ((x = w.nextNode())) nodes.push(x);
  const len = nodes.reduce((a, n) => a + n.nodeValue.length, 0);
  const rr0 = document.createRange();
  rr0.setStart(nodes[0], 0); rr0.setEnd(nodes[0], 1);
  const line0 = rr0.getClientRects()[0];
  const s0 = Math.floor(len * 0.03), e0 = Math.floor(len * 0.3);
  let pos = 0, sn, en, so, eo;
  for (const n of nodes) {
    const L = n.nodeValue.length;
    if (sn == null && s0 < pos + L) { sn = n; so = s0 - pos; }
    if (e0 <= pos + L) { en = n; eo = e0 - pos; break; }
    pos += L;
  }
  const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
  const line = [...r.getClientRects()]
    .filter((q) => q.width > 2 && Math.abs(q.top - line0.top) < 2);
  return { x1: line0.left + 2, x2: line[line.length - 1].right,
    y: line0.top + line0.height / 2 };
});
const fabBeforeSel = await fab();
await page.mouse.move(g.x1, g.y);
await page.mouse.down();
await page.mouse.move((g.x1 + g.x2) / 2, g.y, { steps: 6 });
await page.mouse.move(g.x2, g.y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(400);
await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
await page.waitForTimeout(1200);
const fabAfterMark = await fab();

// idle 3s
await page.waitForTimeout(3000);
const fabIdle = await fab();
// scroll up a bit
await page.mouse.wheel(0, -400);
await page.waitForTimeout(900);
const fabScrollUp = await fab();
// scroll down again
await page.mouse.wheel(0, 400);
await page.waitForTimeout(900);
const fabScrollDown = await fab();
// open library by keyboard focus? try Tab-to-fab path: is fab focusable while hidden?
const focusable = await page.evaluate(() => {
  const f = document.getElementById('gb-hl-fab');
  f.focus();
  return { active: document.activeElement === f, tabIndex: f.tabIndex };
});
await page.evaluate(() => document.getElementById('gb-hl-fab').click());
await page.waitForTimeout(1500);
const listInfo = await page.evaluate(() => {
  const list = document.getElementById('gb-hl-list');
  const lr = list.getBoundingClientRect();
  const cards = [...list.querySelectorAll('.gb-hl-item')].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top - lr.top), h: Math.round(r.height),
      fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1 };
  });
  return {
    viewportH: Math.round(lr.height),
    offsetW: list.offsetWidth,
    clientW: list.clientWidth,
    scrollbarPx: list.offsetWidth - list.clientWidth,
    scrollTop: list.scrollTop,
    scrollH: list.scrollHeight,
    cards,
  };
});
// wheel over the list: does the card come into view?
const lb = await page.evaluate(() => {
  const r = document.getElementById('gb-hl-list').getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.move(lb.x, lb.y);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(900);
const afterWheel = await page.evaluate(() => {
  const list = document.getElementById('gb-hl-list');
  const lr = list.getBoundingClientRect();
  return {
    scrollTop: Math.round(list.scrollTop),
    cards: [...list.querySelectorAll('.gb-hl-item')].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 22),
        fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1 };
    }),
  };
});
await page.screenshot({ path: '/tmp/audit-shots/R6_library_wheel.png' });
console.log(JSON.stringify({ fabBeforeSel, fabAfterMark, fabIdle,
  fabScrollUp, fabScrollDown, focusable, listInfo, afterWheel }, null, 1));
await browser.close();
