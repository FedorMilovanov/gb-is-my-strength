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

const fabState = () => page.evaluate(() => {
  const f = document.getElementById('gb-hl-fab');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  const cs = getComputedStyle(f);
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const hit = document.elementFromPoint(cx, cy);
  const overlay = hit && !f.contains(hit) ? {
    tag: hit.tagName + (hit.id ? '#' + hit.id : ''),
    cls: String(hit.className).split(/\s+/).slice(0, 2).join('.'),
    z: getComputedStyle(hit).zIndex,
    pos: getComputedStyle(hit).position,
    bg: getComputedStyle(hit).backgroundColor,
    opacity: getComputedStyle(hit).opacity,
  } : null;
  return {
    box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
    opacity: cs.opacity, visibility: cs.visibility, display: cs.display,
    pointerEvents: cs.pointerEvents,
    label: f.getAttribute('aria-label'),
    hitSelf: hit ? f.contains(hit) || hit === f : null,
    overlay,
    scrollY: Math.round(scrollY),
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
  };
});

const before = await fabState();

// natural drag selection on a prose paragraph
const geo = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  const ps = [...art.querySelectorAll('p')]
    .filter((p) => p.textContent.trim().length > 200
      && !p.closest('.gill-card, details, aside'));
  const p = ps[1] || ps[0];
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  return p ? { ok: true } : { ok: false };
});
await page.waitForTimeout(600);
const g = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  const ps = [...art.querySelectorAll('p')]
    .filter((p) => p.textContent.trim().length > 200
      && !p.closest('.gill-card, details, aside'));
  const p = ps[1] || ps[0];
  const nodes = [];
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let x; while ((x = w.nextNode())) nodes.push(x);
  const len = nodes.reduce((a, n) => a + n.nodeValue.length, 0);
  const rr0 = document.createRange();
  rr0.setStart(nodes[0], 0); rr0.setEnd(nodes[0], 1);
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
  const onFirst = [...r.getClientRects()]
    .filter((q) => q.width > 2 && Math.abs(q.top - line0.top) < 2);
  if (!onFirst.length) return { bad: true, line0Top: line0.top,
    rects: [...r.getClientRects()].map((q) => Math.round(q.top)) };
  return {
    x1: line0.left + 2, x2: onFirst[onFirst.length - 1].right,
    y: line0.top + line0.height / 2,
  };
});
if (!g || g.bad) { console.log('GEOMETRY FAIL', JSON.stringify(g)); }
await page.mouse.move(g.x1, g.y);
await page.mouse.down();
await page.mouse.move((g.x1 + g.x2) / 2, g.y, { steps: 6 });
await page.mouse.move(g.x2, g.y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(600);
const tb = await page.evaluate(() => {
  const t = document.getElementById('npW57SelectionToolbar');
  return t && !t.hidden ? {
    visible: true,
    actions: [...t.querySelectorAll('[data-w57-action]')].map((b) => b.dataset.w57Action),
  } : { visible: false };
});
if (tb.visible) {
  await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
  await page.waitForTimeout(1200);
}
const after = await fabState();
const saved = await page.evaluate(() => ({
  quotes: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
  status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
}));
// try a real click, short timeout, then fall back to JS click
let clicked = null;
try {
  await page.click('#gb-hl-fab', { timeout: 4000 });
  clicked = 'mouse';
} catch (e) {
  await page.evaluate(() => document.getElementById('gb-hl-fab').click());
  clicked = 'js-fallback';
}
await page.waitForTimeout(1500);
const lib = await page.evaluate(() => {
  const list = document.getElementById('gb-hl-list');
  const panel = document.getElementById('gb-hl-panel');
  if (!list) return null;
  const lr = list.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  const cards = [...list.querySelectorAll('.gb-hl-item')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top - lr.top),
      fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1,
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 26),
    };
  });
  const extras = list.querySelector('.gb-hl-research-extras');
  return {
    panel: { y: Math.round(pr.y), h: Math.round(pr.height) },
    listViewportH: Math.round(lr.height),
    listClientH: list.clientHeight,
    scrollH: list.scrollHeight,
    extrasH: extras ? Math.round(extras.getBoundingClientRect().height) : 0,
    cards, cardsFullyVisible: cards.filter((c) => c.fullyVisible).length,
  };
});
await page.screenshot({ path: '/tmp/audit-shots/R5_library_after_annotate.png' });
console.log(JSON.stringify({ before, tb, saved, after, clicked, lib }, null, 1));
await browser.close();
