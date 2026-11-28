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

// natural selection with a real mouse drag across a paragraph
const para = await page.evaluate(() => {
  const p = [...document.querySelectorAll('article.article-body p')]
    .find((el) => el.textContent.trim().length > 160);
  p.scrollIntoView({ block: 'center' });
  const r = p.getBoundingClientRect();
  return { y: Math.round(r.y), h: Math.round(r.height) };
});
await page.waitForTimeout(400);
await page.mouse.move(260, para.y + 18);
await page.mouse.down();
await page.mouse.move(700, para.y + 18, { steps: 18 });
await page.mouse.up();
await page.waitForTimeout(900);
const toolbar = await page.evaluate(() => {
  const t = document.getElementById('npW57SelectionToolbar');
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return {
    visible: r.width > 0 && r.height > 0,
    buttons: [...t.querySelectorAll('button')]
      .map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
  };
});
let marked = null;
if (toolbar && toolbar.visible) {
  const quoteBtn = page.locator('#npW57SelectionToolbar button', {
    hasText: /Цитата/i,
  });
  if (await quoteBtn.count()) {
    await quoteBtn.first().click();
    await page.waitForTimeout(900);
    marked = await page.evaluate(() => ({
      count: localStorage.getItem('gb-highlights-v1')
        ? JSON.parse(localStorage.getItem('gb-highlights-v1')).length : 0,
      status: document.getElementById('npW57NotesStatus')?.textContent.trim(),
    }));
  }
}
// open the library the way a user would: the FAB
await page.click('#gb-hl-fab');
await page.waitForTimeout(1200);
const open = await page.evaluate(() => {
  const list = document.getElementById('gb-hl-list');
  const lr = list.getBoundingClientRect();
  const cards = [...list.querySelectorAll('.gb-hl-item')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top - lr.top),
      bottom: Math.round(r.bottom - lr.top),
      fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1,
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 30),
    };
  });
  const extras = list.querySelector('.gb-hl-research-extras');
  return {
    listViewportH: Math.round(lr.height),
    scrollH: list.scrollHeight,
    scrollTop: list.scrollTop,
    extrasH: extras ? Math.round(extras.getBoundingClientRect().height) : 0,
    cards,
    cardsFullyVisible: cards.filter((c) => c.fullyVisible).length,
    fabLabel: document.getElementById('gb-hl-fab')?.getAttribute('aria-label'),
  };
});
await page.screenshot({ path: '/tmp/audit-shots/R2_library_natural.png' });
await page.evaluate(() => {
  const l = document.getElementById('gb-hl-list');
  l.scrollTop = l.scrollHeight;
});
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/audit-shots/R3_library_scrolled.png' });
console.log(JSON.stringify({ toolbar, marked, open }, null, 1));
await browser.close();
