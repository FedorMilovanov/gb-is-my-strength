import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('np-w57-ready'), null, { timeout: 25000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    const mk = (i) => ({ id: 'p' + i, text: 'Пробная цитата ' + i + ' для замера геометрии библиотеки.',
      articleTitle: 't', url: location.href, before: 'a', after: 'b', savedAt: Date.now() - i });
    localStorage.setItem('gb-highlights-v1', JSON.stringify([mk(1), mk(2)]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('np-w57-ready'), null, { timeout: 25000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('gb-hl-fab').click());
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const list = document.getElementById('gb-hl-list');
    const panel = document.getElementById('gb-hl-panel');
    const lr = list.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const card = list.querySelector('.gb-hl-item');
    const extras = list.querySelector('.gb-hl-research-extras');
    const eh = extras ? extras.getBoundingClientRect().height : 0;
    if (!card) return { noCard: true };
    const cr = card.getBoundingClientRect();
    const visiblePx = Math.max(0, Math.min(cr.bottom, lr.bottom) - Math.max(cr.top, lr.top));
    return {
      panelH: Math.round(pr.height), listH: Math.round(lr.height),
      extrasH: Math.round(eh), extrasShare: Math.round(eh / lr.height * 100),
      cardH: Math.round(cr.height),
      firstCardVisiblePx: Math.round(visiblePx),
      firstCardVisiblePct: Math.round(visiblePx / cr.height * 100),
    };
  });
  console.log(w + 'x' + h, JSON.stringify(m));
  await page.screenshot({ path: `/tmp/audit-shots/R8_lib_${w}x${h}.png` });
  await page.close();
}
await browser.close();
