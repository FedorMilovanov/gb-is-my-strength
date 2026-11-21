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
await page.waitForTimeout(700);
await page.evaluate(() => {
  const article = document.querySelector('article.article-body');
  const blocks = [...article.querySelectorAll('p')]
    .filter((p) => p.textContent.trim().length >= 80);
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };
  const mk = (p, i, a, b, kind, extra) => {
    const t = p.textContent;
    const note = extra || {};
    return {
      id: 'probe-' + i,
      text: t.slice(a, b),
      articleTitle: 't',
      url: location.href,
      before: t.slice(0, a),
      after: t.slice(b, b + 80),
      savedAt: Date.now() - i * 1000,
      annotation: Object.assign({
        version: 1, kind: kind, color: 'amber',
        anchor: {
          blockId: p.id || '', blockIndex: i,
          start: a, end: b,
          exact: t.slice(a, b),
          prefix: t.slice(0, a),
          suffix: t.slice(b, b + 80),
          blockHash: hash(norm(t)),
          fingerprint: 'f',
        },
        noteId: note.noteId || null,
      }),
    };
  };
  const r1 = mk(blocks[10], 10, 20, 110, 'marker', { noteId: 'probe-note-1' });
  const r2 = mk(blocks[30], 30, 40, 140, 'quote');
  localStorage.setItem('gb-highlights-v1', JSON.stringify([r1, r2]));
  const noteText = 'Проверить связь с Римлянам 3:23 - аудит W57. '
    + 'Это длинная заметка, чтобы карточка стала выше и нагрузка '
    + 'на список была реальной. Добавлю ещё строку для высоты.';
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify([{
    id: 'probe-note-1',
    text: noteText,
    quoteId: 'probe-1',
    createdAt: Date.now() - 5000,
    updatedAt: Date.now() - 5000,
  }]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1000);
await page.click('#gb-hl-fab');
await page.waitForTimeout(1000);
const lib = await page.evaluate(() => {
  const overlay = document.getElementById('gb-hl-backdrop');
  const panel = document.getElementById('gb-hl-panel');
  const list = document.getElementById('gb-hl-list');
  const r = (el) => {
    if (!el) return null;
    const x = el.getBoundingClientRect();
    return {
      y: Math.round(x.y), h: Math.round(x.height),
      bottom: Math.round(x.bottom),
    };
  };
  const items = list
    ? [...list.children].map((el) => ({
        cls: String(el.className).split(/\s+/)[0],
        rect: r(el),
        text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 36),
      }))
    : [];
  const cs = list ? getComputedStyle(list) : null;
  const libBtn = document.getElementById('npULibraryButton');
  return {
    overlayOpen: overlay ? overlay.classList.contains('is-open') : null,
    panel: r(panel),
    list: r(list),
    listScroll: list ? {
      clientH: list.clientHeight,
      scrollH: list.scrollHeight,
      overflowY: cs.overflowY,
      canScroll: list.scrollHeight > list.clientHeight + 2,
    } : null,
    items: items.slice(0, 10),
    fabLabel: document.getElementById('gb-hl-fab')
      ? document.getElementById('gb-hl-fab').getAttribute('aria-label') : null,
    libBtnLabel: libBtn
      ? (libBtn.getAttribute('aria-label')
        || libBtn.textContent.replace(/\s+/g, ' ').trim())
      : null,
  };
});
console.log(JSON.stringify(lib, null, 1));
await page.screenshot({ path: '/tmp/audit-shots/R1_library_desktop.png' });
await browser.close();
