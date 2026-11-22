const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

try {
  // 1. W101 Gill Play ring + checked box-shadow + speedrail clipping (320x568, 390x844)
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    const ring = await p.evaluate(() => {
      const r = document.querySelector('.reader-mobile-play .gb-ember__ring-svg')?.getBoundingClientRect();
      return { svgW: Math.round(r?.width || 0), svgH: Math.round(r?.height || 0) };
    });
    await p.locator('#mobSpdBadge').tap();
    await p.waitForTimeout(200);
    const rail = await p.evaluate(() => {
      const rEl = document.querySelector('#mobileSpeedrail');
      const r = rEl.getBoundingClientRect();
      const checked = rEl.querySelector('[aria-checked="true"]');
      const btns = [...rEl.querySelectorAll('button')].map((b) => {
        const br = b.getBoundingClientRect();
        return { text: b.textContent.trim(), clipped: br.left < r.left - 1 || br.right > r.right + 1 };
      });
      return {
        railW: Math.round(r.width),
        railOverflow: Math.round(rEl.scrollWidth - rEl.clientWidth),
        checkedShadow: checked ? getComputedStyle(checked).boxShadow : null,
        clippedBtns: btns.filter((b) => b.clipped).map((b) => b.text),
      };
    });
    emit('w101-speedrail', { w, h, ring, rail });
    await ctx.close();
  }

  // 2. Tablet breakpoints (768x1024, 1024x768)
  for (const [w, h] of [[768, 1024], [1024, 768]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    for (const route of ['/', '/articles/', '/articles/dzhon-gill-chast-2-uchenyi/', '/articles/kod-da-vinchi/', '/nagornaya/chast-1/', '/map/', '/baptisty-rossii/vsehib-1944/']) {
      await p.goto(BASE + route);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(150);
      const m = await p.evaluate(() => {
        const docOv = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        let tableOv = 0;
        for (const t of document.querySelectorAll('table')) {
          const ov = Math.round(t.getBoundingClientRect().right - innerWidth);
          if (ov > tableOv) tableOv = ov;
        }
        return { docOv, tableOv };
      });
      emit('tablet-check', { w, h, route, ...m });
    }
    await ctx.close();
  }

  // 3. Gill live font-scale reset bug (#gillSettingsReset updates localStorage but leaves live p fontSize at 17.6px)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    const getFs = () => getComputedStyle([...document.querySelectorAll('.article-body p')].sort((a, b) => b.textContent.length - a.textContent.length)[0]).fontSize;
    const before = await p.evaluate(getFs);
    await p.locator('#mobSettingsBtn').tap();
    await p.waitForTimeout(150);
    await p.locator('.gill-settings-sheet button', { hasText: 'A+' }).tap();
    await p.locator('.gill-settings-sheet button', { hasText: 'A+' }).tap();
    await p.locator('.gill-settings-sheet button', { hasText: 'Ночь' }).tap();
    await p.waitForTimeout(150);
    const scaled = await p.evaluate(getFs);
    await p.locator('#gillSettingsReset').tap();
    await p.waitForTimeout(250);
    const afterReset = await p.evaluate(() => ({
      fs: getComputedStyle([...document.querySelectorAll('.article-body p')].sort((a, b) => b.textContent.length - a.textContent.length)[0]).fontSize,
      dark: document.documentElement.classList.contains('dark'),
      lsScale: localStorage.getItem('gb:font-scale'),
    }));
    emit('gill-reset-bug', { before, scaled, afterReset });
    await ctx.close();
  }

  // 4. Home logo clipping & /nagornaya/chast-1/ bottom-bar text clipping at 320x568
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/');
    await p.evaluate(() => document.fonts.ready);
    emit('home-logo-320', await p.evaluate(() => {
      const el = document.querySelector('.h-nav-logo');
      return { clientW: Math.round(el.clientWidth), scrollW: Math.round(el.scrollWidth), clippedPx: Math.round(el.scrollWidth - el.clientWidth) };
    }));
    await p.goto(BASE + '/nagornaya/chast-1/');
    await p.evaluate(() => document.fonts.ready);
    emit('nagornaya-bar-320', await p.evaluate(() => {
      const now = document.querySelector('[class*="now"], [id*="Now"], .ng-bottom-bar, .ng-readbar') || document.querySelector('nav.fixed, .fixed.bottom-0');
      const pub = [...document.querySelectorAll('span, div')].find((x) => x.textContent.includes('Опубликовано:') && x.children.length <= 2)?.textContent?.trim();
      return { pubText: pub, bodyScrollOv: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
