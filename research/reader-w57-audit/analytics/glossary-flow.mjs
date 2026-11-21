// Exact mobile UI, real taps/keys and CDP contact sequences. No direct calls to tooltip, swipe or navigation handlers.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const base = process.env.READER_URL || 'http://127.0.0.1:19074',
  path = '/articles/dzhon-gill-chast-2-uchenyi/';
const snap = (p) =>
  p.evaluate(() => {
    const e = document.activeElement,
      t = document.querySelector('.gb-floating-tip.is-open'),
      term = document.querySelector('article .gterm.is-open');
    return {
      path: location.pathname,
      focus:
        e.tagName + ':' + (e.getAttribute('aria-label') || e.id || e.className),
      term: term?.dataset.termTitle,
      tip: !!t,
      role: t?.getAttribute('role'),
      more: t
        ?.querySelector('[data-gtip-expand]')
        ?.getAttribute('aria-expanded'),
      locked: document.body.style.position === 'fixed',
      sheet:
        document
          .querySelector('#partTocOverlay')
          ?.getAttribute('aria-hidden') === 'false',
      y: Math.round(scrollY),
    };
  });
async function gesture(c, x, y, dx, dy) {
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 10; i++) {
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }],
    });
    await new Promise((r) => setTimeout(r, 17));
  }
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
async function run(w, mode) {
  const ctx = await b.newContext({
      viewport: { width: w, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    }),
    p = await ctx.newPage(),
    r = { w, mode };
  p.setDefaultTimeout(5500);
  try {
    assert.equal(
      (await p.goto(base + path + '?reader-pilot=1#part-controversy')).status(),
      200,
    );
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.locator('#mobPartTocBtn').tap();
    await p.locator('#gbrMarginaliaTab').tap();
    await p
      .locator('summary.gbr-marginalia-group-head')
      .filter({ hasText: 'Понятия' })
      .tap();
    const it = p.locator('.gbr-marginalia-term').first();
    await it.locator('summary').tap();
    r.title = await it.locator('summary').textContent();
    await it.getByRole('button', { name: /Показать в статье/ }).tap();
    await p.waitForTimeout(850);
    r.jump = await snap(p);
    const actual = p.locator('article .gterm:focus');
    assert.equal(await actual.getAttribute('data-term-title'), r.title);
    if (mode === 'keyboard') {
      await p.keyboard.press('Shift+Tab');
      await p.keyboard.press('Tab');
      r.tab = await snap(p);
      if (r.tab.tip) {
        r.pass = false;
        process.exitCode = 1;
        return;
      }
      assert.equal(await actual.getAttribute('data-term-title'), r.title);
      await p.keyboard.press('Space');
    } else if (mode === 'arrow') await p.keyboard.press('Enter');
    else await actual.tap();
    await p.waitForTimeout(350);
    r.open = await snap(p);
    assert.ok(r.open.tip);
    if (mode === 'keyboard') {
      const ex = p.locator('.gb-floating-tip.is-open [data-gtip-expand]');
      await ex.tap();
      r.expanded = await snap(p);
      await p.keyboard.press('Escape');
    }
    if (mode === 'arrow' || mode === 'arrow-closed') {
      if (mode === 'arrow-closed') {
        await p.keyboard.press('Escape');
        await p.waitForTimeout(400);
      }
      if (process.env.SHOTS && w === 390 && mode === 'arrow')
        await p.screenshot({
          path: process.env.SHOTS + '/arrow-open.jpg',
          quality: 88,
        });
      await p.keyboard.press('ArrowRight');
    }
    if (['swipe-inside', 'swipe-outside', 'tap-outside'].includes(mode)) {
      const point = await p.evaluate((mode) => {
        const x = innerWidth * 0.76;
        for (
          let y = mode === 'swipe-inside' ? 95 : Math.round(innerHeight * 0.55);
          y < innerHeight - 92;
          y += 3
        ) {
          const e = document.elementFromPoint(x, y);
          if (
            mode === 'swipe-inside'
              ? e?.closest('.gb-floating-tip') && !e.closest('button,a')
              : e && !e.closest('.gb-floating-tip')
          )
            return { x, y, hit: e.tagName, cls: e.className };
        }
      }, mode);
      assert.ok(point);
      r.point = point;
      const c = await ctx.newCDPSession(p);
      if (mode === 'tap-outside') await p.touchscreen.tap(point.x, point.y);
      else {
        if (process.env.SHOTS && w === 390 && mode === 'swipe-outside')
          await p.screenshot({
            path: process.env.SHOTS + '/swipe-start.jpg',
            quality: 88,
          });
        await gesture(c, point.x, point.y, -142, 0);
      }
    }
    await p.waitForTimeout(950);
    r.end = await snap(p);
    if (process.env.SHOTS && w === 390 && mode === 'swipe-outside')
      await p.screenshot({
        path: process.env.SHOTS + '/swipe-end.jpg',
        quality: 88,
      });
    r.pass =
      (mode === 'arrow-closed'
        ? r.end.path.includes('chast-4')
        : r.end.path === path) &&
      (mode !== 'keyboard' ||
        (!r.tab.tip &&
          !r.end.tip &&
          !r.end.locked &&
          r.expanded.more === 'true' &&
          r.end.focus.startsWith('ABBR:') &&
          r.end.y === r.tab.y));
    if (!r.pass) process.exitCode = 1;
  } catch (e) {
    r.error = e.message;
    process.exitCode = 1;
  } finally {
    console.log(JSON.stringify(r));
    await ctx.close();
  }
}
try {
  for (const w of process.env.CONTROL ? [390] : [320, 390])
    for (const mode of process.env.CONTROL
      ? ['keyboard', 'arrow', 'swipe-outside']
      : [
          'keyboard',
          'arrow',
          'arrow-closed',
          'swipe-inside',
          'swipe-outside',
          'tap-outside',
        ])
      await run(w, mode);
} finally {
  await b.close();
}
