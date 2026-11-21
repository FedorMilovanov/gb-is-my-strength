// Native Gill sheet on the exact candidate; no scroll or click dispatch via product APIs.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const url =
  (process.env.READER_URL || 'http://127.0.0.1:19071') +
  '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1#part-controversy';
const snapshot = (p) =>
  p.evaluate(() => ({
    path: location.pathname,
    y: scrollY,
    sheet: document
      .querySelector('#partTocOverlay')
      .classList.contains('is-open'),
    top: document.querySelector('#gbrMarginalia').scrollTop,
    focus: document.activeElement.id,
    lock: document.body.style.position,
  }));
async function swipe(c, x, y, dx, dy) {
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 9; i++) {
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 9, y: y + (dy * i) / 9 }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
try {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [568, 320],
  ])
    for (const mode of [
      'tap',
      'scroll-then-header',
      'vertical',
      'diagonal',
      'horizontal',
    ]) {
      const ctx = await b.newContext({
          viewport: { width: w, height: h },
          isMobile: true,
          hasTouch: true,
          reducedMotion: 'reduce',
        }),
        p = await ctx.newPage(),
        r = { w, h, mode };
      try {
        assert.equal((await p.goto(url)).status(), 200);
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(400);
        r.initial = await snapshot(p);
        await p.locator('#mobPartTocBtn').tap();
        await p.locator('#gbrMarginaliaTab').tap();
        await p.waitForTimeout(300);
        const c = await ctx.newCDPSession(p);
        const handle = p.locator('#partTocOverlay .toc-sheet__handle');
        const hb = await handle.boundingBox();
        r.handle = {
          w: hb.width,
          h: hb.height,
          hit: await handle.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
        };
        const start = await p
          .locator('#partTocOverlay .toc-sheet__head')
          .boundingBox();
        if (mode === 'scroll-then-header') {
          const terms = p
            .locator('summary.gbr-marginalia-group-head')
            .filter({ hasText: 'Понятия' });
          if (await terms.count()) await terms.tap();
          const body = await p.locator('#gbrMarginalia').boundingBox();
          const dy = Math.min(160, body.height * 0.65);
          await swipe(c, w / 2, body.y + body.height * 0.84, 0, -dy);
          await p.waitForTimeout(350);
        }
        r.before = await snapshot(p);
        if (mode === 'tap')
          await p.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
        else
          await swipe(
            c,
            Math.round(w * 0.24),
            start.y + start.height * 0.45,
            mode === 'diagonal' || mode === 'horizontal'
              ? Math.round(w * 0.5)
              : 0,
            mode === 'horizontal' ? 0 : mode === 'diagonal' ? 90 : 105,
          );
        await p.waitForTimeout(400);
        r.after = await snapshot(p);
        if (r.after.sheet && mode === 'scroll-then-header') {
          await handle.tap();
          await p.waitForTimeout(350);
          r.fallback = await snapshot(p);
        }
        r.pass =
          r.after.sheet === ['horizontal', 'diagonal'].includes(mode) &&
          r.after.path === r.initial.path;
        if (!r.pass) process.exitCode = 1;
      } catch (e) {
        r.error = e.message;
        process.exitCode = 1;
      } finally {
        console.log(JSON.stringify(r));
        await ctx.close();
      }
    }
} finally {
  await b.close();
}
