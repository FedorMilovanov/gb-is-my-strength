import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const url =
  (process.env.READER_URL || 'http://127.0.0.1:19072') +
  '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1';
try {
  for (const w of [320, 390]) {
    const ctx = await b.newContext({
        viewport: { width: w, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      }),
      p = await ctx.newPage(),
      r = { w };
    try {
      await p.goto(url);
      await p.evaluate(() => document.fonts.ready);
      const rail = p.locator('.shelf-track');
      await rail.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(350);
      const box = await rail.boundingBox();
      const c = await ctx.newCDPSession(p),
        drag = async () => {
          let x = box.x + box.width * 0.82,
            y = Math.max(120, Math.min(650, box.y + box.height * 0.52));
          assert.ok(
            await p.evaluate(
              ({ x, y }) =>
                !!document.elementFromPoint(x, y)?.closest('.shelf-track'),
              { x, y },
            ),
          );
          await c.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y }],
          });
          for (let i = 1; i <= 9; i++) {
            await c.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x: x - (box.width * 0.62 * i) / 9, y }],
            });
            await p.waitForTimeout(20);
          }
          await c.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          });
          await p.waitForTimeout(370);
        };
      const state = () =>
        rail.evaluate((e) => ({
          left: e.scrollLeft,
          max: e.scrollWidth - e.clientWidth,
          path: location.pathname,
        }));
      r.start = await state();
      await drag();
      r.swiped = await state();
      for (let i = 0; i < 8; i++) {
        const now = await state();
        if (now.left >= now.max - 2) break;
        await drag();
      }
      await p.waitForTimeout(250);
      r.limit = await state();
      await drag();
      r.edge = await state();
      r.railOK =
        r.swiped.left > r.start.left &&
        r.limit.left >= r.limit.max - 2 &&
        r.edge.path === r.start.path;
      const original = 'Заметка из единой библиотеки';
      await p.locator('#gb-hl-fab').tap();
      await p.locator('#gb-hl-new-note').tap();
      await p.locator('#gb-hl-note-text').fill(original);
      await p.locator('#gb-hl-editor [type=submit]').tap();
      await p.locator('#gb-hl-close').tap();
      await p.locator('#mobPartTocBtn').tap();
      await p.locator('#gbrMarginaliaTab').tap();
      const marks = p
        .locator('details.gbr-marginalia-group')
        .filter({
          has: p.locator('summary strong', { hasText: 'Мои пометы' }),
        });
      await marks.locator('summary').tap();
      r.personal = await marks
        .locator('.gbr-marginalia-personal p')
        .allTextContents();
      await marks.getByRole('button', { name: 'Открыть библиотеку' }).tap();
      await p.waitForTimeout(450);
      r.handoff = await p.evaluate(() => ({
        sheet: document
          .querySelector('#partTocOverlay')
          .classList.contains('is-open'),
        library: document
          .querySelector('#gb-hl-backdrop')
          .getAttribute('aria-hidden'),
        stored: JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length,
      }));
      assert.ok(r.railOK);
      assert.deepEqual(r.personal, [original]);
      assert.deepEqual(r.handoff, {
        sheet: false,
        library: 'false',
        stored: 1,
      });
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
