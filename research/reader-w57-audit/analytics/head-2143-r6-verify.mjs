const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

try {
  // 1. W100 mobile speedrail on 320x568 & 390x844
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    await p.locator('#mobSpdBadge').tap();
    await p.waitForTimeout(200);
    emit('w100-speedrail', {
      w,
      h,
      rail: await p.evaluate(() => {
        const rEl = document.querySelector('#mobileSpeedrail');
        const r = rEl.getBoundingClientRect();
        const btns = [...rEl.querySelectorAll('button')].map((b) => {
          const br = b.getBoundingClientRect();
          return { text: b.textContent.trim(), clippedLeft: br.left < r.left - 1, clippedRight: br.right > r.right + 1 };
        });
        return {
          railW: Math.round(r.width),
          railScrollW: Math.round(rEl.scrollWidth),
          railOverflow: Math.round(rEl.scrollWidth - rEl.clientWidth),
          clippedBtns: btns.filter((b) => b.clippedLeft || b.clippedRight).map((b) => b.text),
        };
      }),
    });
    await ctx.close();
  }

  // 2. Keyboard modal focus trap & Escape focus return
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);

    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#mobPartTocBtn').focus();
    await p.locator('#mobPartTocBtn').click();
    await p.waitForTimeout(200);
    let leaked = false;
    for (let i = 0; i < 30; i++) {
      await p.keyboard.press('Tab');
      if (!(await p.evaluate(() => !!document.activeElement?.closest('#partTocOverlay')))) { leaked = true; break; }
    }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    emit('a11y-modal-partTocOverlay', {
      leaked,
      afterEscActiveId: await p.evaluate(() => document.activeElement?.id || null),
    });

    await p.goto(BASE + '/articles/kod-da-vinchi/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#hmSettingsBtn').focus();
    await p.locator('#hmSettingsBtn').click();
    await p.waitForTimeout(200);
    let leakedSet = false;
    for (let i = 0; i < 25; i++) {
      await p.keyboard.press('Tab');
      if (!(await p.evaluate(() => !!document.activeElement?.closest('#hmSettingsSheet, #hmSettingsOverlay, [role="dialog"]')))) { leakedSet = true; break; }
    }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    emit('a11y-modal-hmSettings', {
      leakedSet,
      afterEscActiveId: await p.evaluate(() => document.activeElement?.id || null),
    });
    await ctx.close();
  }
} finally {
  await browser.close();
}
