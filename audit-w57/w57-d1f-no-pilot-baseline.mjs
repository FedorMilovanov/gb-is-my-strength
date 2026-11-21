import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL_NO = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/';
const URL_W57 = URL_NO + '?reader-pilot=1&paper=space';
async function probe(url, label) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.clear());
  // seed two quotes directly into the Product store (same shape for both modes)
  await page.evaluate(() => {
    const mk = (i) => ({ id: 'probe-' + i, text: 'Пробная цитата номер ' + i
      + ' для замера геометрии библиотеки без пилота.',
      articleTitle: 't', url: location.href, before: 'a', after: 'b',
      savedAt: Date.now() - i * 1000 });
    localStorage.setItem('gb-highlights-v1', JSON.stringify([mk(1), mk(2)]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const res = await page.evaluate(() => {
    const f = document.getElementById('gb-hl-fab');
    if (!f) return { fab: false };
    f.click();
    return { fab: true };
  });
  await page.waitForTimeout(1600);
  const m = await page.evaluate(() => {
    const list = document.getElementById('gb-hl-list');
    const panel = document.getElementById('gb-hl-panel');
    if (!list) return null;
    const lr = list.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const extras = list.querySelector('.gb-hl-research-extras');
    const cards = [...list.querySelectorAll('.gb-hl-item')].map((el) => {
      const r = el.getBoundingClientRect();
      return { h: Math.round(r.height), top: Math.round(r.top - lr.top),
        fullyVisible: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1 };
    });
    const cs = getComputedStyle(panel);
    return {
      panelH: Math.round(pr.height), panelCssHeight: cs.height,
      listH: Math.round(lr.height), scrollH: list.scrollHeight,
      extrasH: extras ? Math.round(extras.getBoundingClientRect().height) : 0,
      extrasShare: extras ? Math.round(extras.getBoundingClientRect().height / lr.height * 100) : 0,
      cards, visibleCards: cards.filter((c) => c.fullyVisible).length,
    };
  });
  console.log(label, JSON.stringify(m));
  await page.screenshot({ path: '/tmp/audit-shots/R7_' + label + '.png' });
  await page.close();
}
await probe(URL_NO, 'no-w57');
await probe(URL_W57, 'with-w57');
await browser.close();
