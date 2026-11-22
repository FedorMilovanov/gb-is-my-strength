const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

try {
  // 1. /map/ Gill Part III / IV label vs URL mismatch
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/map/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.locator('#atlasSearchInput').fill('Джон Гилл');
    await p.waitForTimeout(200);
    await p.locator('#atlasSearchResults > *').filter({ hasText: 'Часть III' }).first().click();
    await p.waitForTimeout(200);
    const detail3 = await p.evaluate(() => ({
      clickedLabel: 'Часть III: Экзегет',
      href: document.querySelector('#atlasDetail a[href*="dzhon-gill"]')?.getAttribute('href') || null,
    }));
    await p.locator('#atlasSearchInput').fill('Джон Гилл');
    await p.waitForTimeout(200);
    await p.locator('#atlasSearchResults > *').filter({ hasText: 'Часть IV' }).first().click();
    await p.waitForTimeout(200);
    const detail4 = await p.evaluate(() => ({
      clickedLabel: 'Часть IV: Наследие',
      href: document.querySelector('#atlasDetail a[href*="dzhon-gill"]')?.getAttribute('href') || null,
    }));
    emit('map-gill-parts-mismatch', { detail3, detail4 });
    await ctx.close();
  }

  // 2. Mobile 320px checks: /izbrannoe/ header wrap, /app/ overflow, kod-da-vinchi breadcrumb & speed clipping
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);

    await p.goto(BASE + '/izbrannoe/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    emit('izbrannoe-header-320', await p.evaluate(() => {
      const hdr = document.querySelector('header, .h-nav, nav');
      const hr = hdr.getBoundingClientRect();
      const items = [...hdr.querySelectorAll('a, button')].filter((el) => el.offsetParent !== null);
      return { hdrH: Math.round(hr.height), overflowHdr: items.some((el) => el.getBoundingClientRect().bottom > hr.bottom + 2) };
    }));

    await p.goto(BASE + '/app/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    emit('app-320-overflow', await p.evaluate(() => ({
      docOv: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
      flowRight: Math.round(document.querySelector('.app-flow')?.getBoundingClientRect().right || 0),
    })));

    await p.goto(BASE + '/articles/kod-da-vinchi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    emit('kod-da-vinchi-320-topbar', await p.evaluate(() => {
      const bc = document.querySelector('.breadcrumb, nav[aria-label*=Хлеб], .article-breadcrumb, .article-header nav');
      const sp0 = document.querySelector('.hm-spd');
      return {
        bcTop: bc ? Math.round(bc.getBoundingClientRect().top) : null,
        firstSpeedLeft: sp0 ? Math.round(sp0.getBoundingClientRect().left) : null,
        firstSpeedRight: sp0 ? Math.round(sp0.getBoundingClientRect().right) : null,
      };
    }));
    await ctx.close();
  }

  // 3. Analytics Сноски 0 on krajne-li-isporcheno-serdce (40 footnotes) & dzhon-gill-chast-2 (6 footnotes)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    for (const r of ['/articles/krajne-li-isporcheno-serdce/', '/articles/dzhon-gill-chast-2-uchenyi/']) {
      await p.goto(BASE + r);
      await p.waitForTimeout(200);
      await p.locator('#mobPartTocBtn').tap();
      await p.waitForTimeout(150);
      await p.locator('#gbrMarginaliaTab').tap();
      await p.waitForTimeout(150);
      emit('analytics-footnotes-section-scope', {
        route: r,
        domFnMarkers: await p.evaluate(() => document.querySelectorAll('.fn-marker').length),
        heads: await p.evaluate(() => [...document.querySelectorAll('.gbr-marginalia-group-head')].map((x) => x.textContent.trim().replace(/\s+/g, ' '))),
      });
    }

    // 4. Scroll-lock + Resize state drift on dzhon-gill-chast-2-uchenyi
    await p.evaluate(() => localStorage.clear());
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => document.getElementById('sec-whitefield')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await p.waitForTimeout(800);
    await p.locator('#mobPartTocBtn').tap();
    await p.waitForTimeout(250);
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(500);
    await p.locator('#partTocOverlay button:visible').first().tap();
    await p.waitForTimeout(400);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.reload();
    await p.waitForTimeout(400);
    emit('scroll-lock-resize-drift', await p.evaluate(() => ({
      expectedSection: 'sec-whitefield',
      saved: JSON.parse(localStorage.getItem('gb:reader-state:v1:gb-strength:/articles/dzhon-gill-chast-2-uchenyi') || 'null'),
    })));
    await ctx.close();
  }
} finally {
  await browser.close();
}
