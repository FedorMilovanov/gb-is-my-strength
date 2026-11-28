import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const BASE = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
for (const w of [1440, 1280, 390]) {
  const page = await browser.newPage({
    viewport: { width: w, height: w === 390 ? 844 : 900 },
    hasTouch: w === 390,
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.body.classList.contains('np-w57-ready'), null,
    { timeout: 25000 });
  await page.waitForTimeout(900);
  const themeOwners = await page.evaluate(() => {
    const re = /тема|темн|ночь|день|сепия|theme|оформлен/i;
    const all = [...document.querySelectorAll(
      'button, [role="button"], a[href], select, input')];
    return all.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = r.width > 1 && r.height > 1
        && cs.display !== 'none' && cs.visibility !== 'hidden'
        && Number(cs.opacity) > 0.05;
      const label = [
        el.getAttribute('aria-label'), el.getAttribute('title'),
        el.getAttribute('data-tip'), el.textContent,
        el.getAttribute('data-gill-theme-btn'), el.getAttribute('data-theme'),
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const isTheme = re.test(label)
        || el.hasAttribute('data-gill-theme-btn')
        || el.hasAttribute('data-theme');
      if (!visible || !isTheme) return null;
      return {
        id: el.id || null,
        cls: String(el.className).split(/\s+/).slice(0, 2).join('.'),
        box: { w: Math.round(r.width), h: Math.round(r.height) },
        label: label.slice(0, 48),
      };
    }).filter(Boolean);
  });
  console.log('=== ' + w + 'px theme owners (visible) ===');
  console.log(JSON.stringify(themeOwners, null, 1));
  await page.close();
}
await browser.close();
