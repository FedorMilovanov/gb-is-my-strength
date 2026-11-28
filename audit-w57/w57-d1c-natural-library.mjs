import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const SHOTS = '/tmp/audit-shots';
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

async function lineDrag(pIdx, frac1, frac2) {
  await page.evaluate(({ pIdx }) => {
    const art = document.querySelector('article.article-body');
    const ps = [...art.querySelectorAll('p')]
      .filter((p) => p.textContent.trim().length > 60);
    ps[pIdx]?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, { pIdx });
  let prev = null;
  for (let i = 0; i < 25; i++) {
    const r = await page.evaluate(({ pIdx }) => {
      const art = document.querySelector('article.article-body');
      const ps = [...art.querySelectorAll('p')]
        .filter((p) => p.textContent.trim().length > 60);
      const p = ps[pIdx]; if (!p) return null;
      const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      const first = w.nextNode(); if (!first) return null;
      const rr = document.createRange();
      rr.setStart(first, 0); rr.setEnd(first, 1);
      const lr = rr.getClientRects()[0];
      return lr ? { top: lr.top } : null;
    }, { pIdx });
    if (r && prev && Math.abs(prev.top - r.top) < 1) break;
    prev = r;
    await page.waitForTimeout(100);
  }
  const geo = await page.evaluate(({ pIdx, frac1, frac2 }) => {
    const art = document.querySelector('article.article-body');
    const ps = [...art.querySelectorAll('p')]
      .filter((p) => p.textContent.trim().length > 60);
    const p = ps[pIdx]; if (!p) return { ok: false, why: 'no p' };
    const nodes = [];
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let x; while ((x = w.nextNode())) nodes.push(x);
    const len = nodes.reduce((a, n) => a + n.nodeValue.length, 0);
    const rr0 = document.createRange();
    rr0.setStart(nodes[0], 0); rr0.setEnd(nodes[0], 1);
    const line0 = rr0.getClientRects()[0];
    if (!line0) return { ok: false, why: 'no line rect' };
    const startAt = Math.floor(len * frac1);
    const endAt = Math.floor(len * frac2);
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
    if (!onFirst.length) return { ok: false, why: 'not on first line' };
    return {
      ok: true, x1: line0.left + 2,
      x2: onFirst[onFirst.length - 1].right,
      y: line0.top + line0.height / 2,
      text: r.toString().replace(/\s+/g, ' ').trim().slice(0, 70),
    };
  }, { pIdx, frac1, frac2 });
  if (!geo.ok) return geo;
  await page.mouse.move(geo.x1, geo.y);
  await page.mouse.down();
  await page.mouse.move((geo.x1 + geo.x2) / 2, geo.y, { steps: 6 });
  await page.mouse.move(geo.x2, geo.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  return geo;
}

// paragraph indices, pick two plain prose paragraphs far apart
const prose = await page.evaluate(() => {
  const art = document.querySelector('article.article-body');
  const ps = [...art.querySelectorAll('p')]
    .filter((p) => p.textContent.trim().length > 60);
  return ps.map((p, i) => ({
    i,
    len: p.textContent.trim().length,
    inCard: !!p.closest('.gill-card, .np-u-series-disclosure, details, aside'),
  })).filter((p) => !p.inCard && p.len > 200);
});
const pA = prose[1] ? prose[1].i : prose[0].i;
const pB = prose[Math.min(6, prose.length - 1)].i;
const sel1 = await lineDrag(pA, 0.02, 0.32);
const tb1 = await page.evaluate(() => {
  const t = document.getElementById('npW57SelectionToolbar');
  return t && !t.hidden ? {
    visible: true,
    actions: [...t.querySelectorAll('[data-w57-action]')]
      .map((b) => b.dataset.w57Action),
  } : { visible: false };
});
if (tb1.visible) {
  await page.click('#npW57SelectionToolbar [data-w57-action="quote"]');
  await page.waitForTimeout(900);
}
const sel2 = await lineDrag(pB, 0.5, 0.8);
const tb2 = await page.evaluate(() => {
  const t = document.getElementById('npW57SelectionToolbar');
  return t && !t.hidden ? {
    visible: true,
    actions: [...t.querySelectorAll('[data-w57-action]')]
      .map((b) => b.dataset.w57Action),
  } : { visible: false };
});
if (tb2.visible) {
  const action = tb2.actions.includes('note') ? 'note' : tb2.actions[0];
  await page.click('#npW57SelectionToolbar [data-w57-action="' + action + '"]');
  await page.waitForTimeout(900);
}
const saved = await page.evaluate(() => ({
  quotes: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
  status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
  count: document.getElementById('npW57NotesCount')?.textContent.trim(),
}));
await page.click('#gb-hl-fab');
await page.waitForTimeout(1400);
const open = await page.evaluate(() => {
  const list = document.getElementById('gb-hl-list');
  const lr = list.getBoundingClientRect();
  const cards = [...list.querySelectorAll('.gb-hl-item')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top - lr.top),
      fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1,
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 28),
    };
  });
  const extras = list.querySelector('.gb-hl-research-extras');
  return {
    listViewportH: Math.round(lr.height),
    scrollH: list.scrollHeight,
    extrasH: extras ? Math.round(extras.getBoundingClientRect().height) : 0,
    cards, cardsFullyVisible: cards.filter((c) => c.fullyVisible).length,
    fabLabel: document.getElementById('gb-hl-fab')?.getAttribute('aria-label'),
  };
});
await page.screenshot({ path: SHOTS + '/R2_library_natural.png' });
await page.evaluate(() => {
  const l = document.getElementById('gb-hl-list');
  l.scrollTop = l.scrollHeight;
});
await page.waitForTimeout(700);
const scrolled = await page.evaluate(() => {
  const list = document.getElementById('gb-hl-list');
  const lr = list.getBoundingClientRect();
  return [...list.querySelectorAll('.gb-hl-item')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 28),
      fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1 };
  });
});
await page.screenshot({ path: SHOTS + '/R3_library_scrolled.png' });
console.log(JSON.stringify({
  proseCount: prose.length, pA, pB, sel1, sel2, saved, open, scrolled,
}, null, 1));
await browser.close();
