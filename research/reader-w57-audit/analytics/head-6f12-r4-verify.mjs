const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

try {
  // 1. Breakpoint asymmetry: kod-da-vinchi (1200px rail) vs dzhon-gill-chast-2 (1360px rail; mobile bar at 1200..1359)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/kod-da-vinchi/');
    await p.evaluate(() => document.fonts.ready);
    emit('hybrid-1280-kod', await p.evaluate(() => {
      const hr = document.querySelector('#hrailToc, .hrail');
      const body = document.querySelector('.article-body');
      const items = [...document.querySelectorAll('#hrailToc a, .hrail a')];
      return {
        hrailVis: !!(hr && getComputedStyle(hr).display !== 'none'),
        hrailRight: hr ? Math.round(hr.getBoundingClientRect().right) : null,
        bodyLeft: body ? Math.round(body.getBoundingClientRect().left) : null,
        itemsClippedBottom: items.filter((a) => a.getBoundingClientRect().bottom > innerHeight).length,
      };
    }));
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    emit('hybrid-1280-gill', await p.evaluate(() => ({
      railVis: getComputedStyle(document.querySelector('#gbsRailMid')).display !== 'none',
      mobBarVis: !!document.querySelector('#mobPartTocBtn')?.offsetParent,
    })));
    await ctx.close();
  }

  // 2. Search without /pagefind/ (404) + "АВТОРЫ" tab clipping at 320px
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    const req404 = [];
    p.on('response', (res) => { if (res.status() >= 400) req404.push({ status: res.status(), url: res.url().replace(BASE, '') }); });
    await p.goto(BASE + '/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#gbSearchBtn').tap();
    await p.waitForTimeout(200);
    await p.locator('.cp-input').fill('Авраам');
    await p.waitForTimeout(350);
    const authorsTab = await p.evaluate(() => {
      const tabs = [...document.querySelectorAll('.cp-tab, [role="tab"]')];
      const last = tabs[tabs.length - 1];
      const r = last ? last.getBoundingClientRect() : null;
      return {

        abrahamItems: document.querySelectorAll('.cp-item').length,
        lastTabText: last?.textContent?.trim(),
        lastTabRight: r ? Math.round(r.right) : null,
        vw: innerWidth,
      };
    });
    emit('search-no-pagefind-and-320-tab', { req404, ...authorsTab });
    await ctx.close();
  }

  // 3. Nagornaya dark mode (#barThemeBtn) + plain textMode ("Простое") on Gill & kod-da-vinchi
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/nagornaya/chast-1/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#barThemeBtn').tap();
    await p.waitForTimeout(200);
    emit('nagornaya-bar-theme-tap', await p.evaluate(() => ({
      htmlClass: document.documentElement.className,
      htmlData: { ...document.documentElement.dataset },
      bodyBg: getComputedStyle(document.body).backgroundColor,
      btocBg: getComputedStyle(document.querySelector('.btoc-panel')).backgroundColor,
      btocLinkFg: getComputedStyle(document.querySelector('.btoc-panel a')).color,
    })));

    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#mobSettingsBtn').tap();
    await p.waitForTimeout(150);
    await p.locator('[data-text-mode="plain"]').tap();
    await p.waitForTimeout(200);
    emit('plain-mode-gill', await p.evaluate(() => ({
      mode: document.documentElement.dataset.readerTextMode,
      fnDisplay: getComputedStyle(document.querySelector('.fn-marker')).display,
      gtBorder: getComputedStyle(document.querySelector('.gterm')).borderBottomStyle,
    })));

    await p.goto(BASE + '/articles/kod-da-vinchi/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#hmSettingsBtn').tap();
    await p.waitForTimeout(150);
    await p.locator('[data-hm-text-mode="plain"]').tap();
    await p.waitForTimeout(200);
    emit('plain-mode-kod', await p.evaluate(() => ({
      mode: document.documentElement.dataset.readerTextMode,
      fnDisplay: getComputedStyle(document.querySelector('.fn-marker')).display,
    })));
    await ctx.close();
  }
} finally {
  await browser.close();
}
