import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const VARIANTS = {
  baseline: '',
  // A: list grows to available height (no fixed panel height)
  'A-panel-auto': '@media(min-width:768px){#gb-hl-panel{height:auto!important;max-height:min(88dvh,860px)!important}}',
  // B: same + promo block compressed to one line
  'B-auto+promo-compact': '@media(min-width:768px){#gb-hl-panel{height:auto!important;max-height:min(88dvh,860px)!important}'
    + '.gb-hl-research-extras{max-height:96px!important;overflow:auto!important}'
    + '.gb-hl-revisit-card .gb-hl-daily-quote{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}}',
  // C: promo block out of the scroll area (hidden when records exist)
  'C-promo-below-list': '@media(min-width:768px){#gb-hl-panel{height:auto!important;max-height:min(88dvh,860px)!important}'
    + '#gb-hl-list>.gb-hl-research-extras{order:9!important;max-height:120px!important;overflow:auto!important}'
    + '#gb-hl-list{display:flex!important;flex-direction:column!important}}',
};
for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]]) {
  const out = {};
  for (const [name, css] of Object.entries(VARIANTS)) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('np-w57-ready'), null, { timeout: 25000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => {
      const mk = (i) => ({ id: 'p' + i, text: 'Пробная цитата ' + i + ' для замера геометрии.',
        articleTitle: 't', url: location.href, before: 'a', after: 'b', savedAt: Date.now() - i });
      localStorage.setItem('gb-highlights-v1', JSON.stringify([mk(1), mk(2)]));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('np-w57-ready'), null, { timeout: 25000 });
    await page.waitForTimeout(1100);
    if (css) {
      await page.addStyleTag({ content: css });
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => document.getElementById('gb-hl-fab').click());
    await page.waitForTimeout(1300);
    const m = await page.evaluate(() => {
      const list = document.getElementById('gb-hl-list');
      const lr = list.getBoundingClientRect();
      const card = list.querySelector('.gb-hl-item');
      if (!card) return { none: true };
      const cr = card.getBoundingClientRect();
      const vis = Math.max(0, Math.min(cr.bottom, lr.bottom) - Math.max(cr.top, lr.top));
      return {
        listH: Math.round(lr.height),
        pct: Math.round(vis / cr.height * 100),
      };
    });
    out[name] = m;
    await page.close();
  }
  console.log(w + 'x' + h, JSON.stringify(out));
}
await browser.close();
