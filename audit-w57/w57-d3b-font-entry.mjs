import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const BASE = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const widths = [1920, 1440, 1280, 1121];
const out = [];
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.body.classList.contains('np-w57-ready'), null,
    { timeout: 25000 });
  await page.waitForTimeout(900);
  const probe = () => {
    const vis = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1
        && cs.display !== 'none' && cs.visibility !== 'hidden'
        && Number(cs.opacity) > 0.05;
    };
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    };
    const settingsEntries = [
      '.np-u-type-open', '.np-u-type-compact', '#railSettingsBtn',
      '#hrailSettingsBtn', '#gbFcSettings',
      '[data-gill-settings-open]:not(#railSettingsBtn)',
      '#npUEdgeToggle',
    ].map((s) => {
      const el = document.querySelector(s);
      return { sel: s, present: !!el, visible: vis(el), box: box(el) };
    });
    const panel = document.getElementById('npUFontPanel');
    return {
      settingsEntries,
      fontPanelHidden: panel ? panel.hidden : 'absent',
      gillSheetPresent: !!document.getElementById('gillSettingsOverlay'),
      gillSheetHidden: document.getElementById('gillSettingsOverlay')
        ? getComputedStyle(document.getElementById('gillSettingsOverlay'))
          .visibility : null,
    };
  };
  const before = await page.evaluate(probe);
  // click the compact font trigger if visible, else the full one
  const clicked = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1
        && getComputedStyle(el).display !== 'none';
    };
    for (const s of ['.np-u-type-compact', '.np-u-type-open']) {
      const el = document.querySelector(s);
      if (vis(el)) { el.click(); return s; }
    }
    return null;
  });
  await page.waitForTimeout(500);
  const afterOpen = await page.evaluate(() => {
    const p = document.getElementById('npUFontPanel');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return {
      hidden: p.hidden,
      inViewport: r.x >= -2 && r.right <= innerWidth + 2
        && r.y >= -2 && r.bottom <= innerHeight + 2,
      rect: {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
      },
      fonts: [...p.querySelectorAll('[data-np-u-type-font]')]
        .map((b) => b.textContent.trim()),
      themeControls: [...p.querySelectorAll('[data-np-u-type-font]')].length,
    };
  });
  let applied = null;
  if (afterOpen && !afterOpen.hidden) {
    const cormorant = page.locator('[data-np-u-type-font="cormorant"]');
    if (await cormorant.count()) {
      await cormorant.first().click();
      await page.waitForTimeout(600);
      applied = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute('data-reader-font-family'),
        bodyAttr: document.body.getAttribute('data-reader-font-family'),
        stored: (() => {
          try {
            return JSON.parse(localStorage.getItem('gb-reader-preferences-v1')
              || '{}').fontFamily;
          } catch (e) { return 'parse-error'; }
        })(),
      }));
    }
  }
  out.push({ width: w, before, clicked, afterOpen, applied });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
