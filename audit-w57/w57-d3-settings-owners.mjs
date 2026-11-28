import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const BASE = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const widths = [1920, 1440, 1280, 1121];
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__NP_W57_ANNOTATIONS__?.ready === true, null,
    { timeout: 25000 });
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => {
    const bodyCls = document.body.className;
    const typeOpen = document.querySelector('.np-u-type-open');
    const rail = document.getElementById('railSettingsBtn');
    const r = (el) => {
      if (!el) return null;
      const x = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: Math.round(x.width), h: Math.round(x.height),
        x: Math.round(x.x),
        display: cs.display,
        visible: x.width > 0 && x.height > 0
          && cs.display !== 'none' && cs.visibility !== 'hidden',
      };
    };
    let fontOpts = null;
    if (typeOpen && r(typeOpen).visible) {
      typeOpen.click();
      fontOpts = 'clicked-wait';
    }
    return { bodyCls, typeOpen: r(typeOpen), rail: r(rail), fontOpts };
  });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const dlg = document.querySelector(
      '.np-u-type-panel, [class*="type-panel"], #npUTypePanel');
    if (!dlg) return null;
    const x = dlg.getBoundingClientRect();
    const fonts = [...dlg.querySelectorAll('button, label')]
      .map((e) => e.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean).slice(0, 12);
    return {
      visible: x.width > 0 && x.height > 0,
      rect: {
        x: Math.round(x.x), y: Math.round(x.y),
        w: Math.round(x.width), h: Math.round(x.height),
      },
      fonts,
    };
  });
  const railAfter = await page.evaluate(() => {
    if (!document.getElementById('railSettingsBtn')) return null;
    const b = document.getElementById('railSettingsBtn');
    if (!b.getBoundingClientRect().width) return { visible: false };
    b.click();
    return { clicked: true };
  });
  await page.waitForTimeout(500);
  const railPanel = await page.evaluate(() => {
    const cands = [
      document.getElementById('railSettingsPanel'),
      document.querySelector('[class*="rail-settings"]'),
      document.querySelector('#npUResearch [class*="settings"]'),
    ];
    for (const el of cands) {
      if (!el) continue;
      const x = el.getBoundingClientRect();
      if (x.width > 0 && x.height > 0) {
        const texts = [...el.querySelectorAll('button, label, .np-u-type-row')]
          .map((e) => e.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean).slice(0, 14);
        return {
          sel: el.id || String(el.className).split(/\s+/)[0],
          rect: {
            x: Math.round(x.x), y: Math.round(x.y),
            w: Math.round(x.width), h: Math.round(x.height),
          },
          texts,
        };
      }
    }
    return null;
  });
  const h1 = await page.evaluate(() => {
    const h = document.querySelector('article h1');
    if (!h) return null;
    const x = h.getBoundingClientRect();
    return { y: Math.round(x.y), h: Math.round(x.height) };
  });
  console.log('=== width ' + w + ' ===');
  console.log(JSON.stringify({
    bodyCls: st.bodyCls, typeOpen: st.typeOpen, rail: st.rail,
    typePanel: after, railPanel, h1,
  }, null, 1));
  await page.close();
}
await browser.close();
