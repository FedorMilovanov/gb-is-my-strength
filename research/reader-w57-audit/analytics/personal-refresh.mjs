// Two pages of the same temporary profile; create, edit and delete only via the public UI.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const url =
  (process.env.READER_URL || 'http://127.0.0.1:19074') +
  '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1';
try {
  for (const mode of ['edit', 'delete']) {
    const ctx = await b.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        reducedMotion: 'reduce',
      }),
      a = await ctx.newPage(),
      c = await ctx.newPage(),
      r = { mode };
    ctx.setDefaultTimeout(5500);
    try {
      const first = 'Первая редакция личной заметки',
        second = 'Исправленный текст без первой редакции';
      await c.goto(url);
      await c.locator('#gb-hl-fab').tap();
      await c.locator('#gb-hl-new-note').tap();
      await c.locator('#gb-hl-note-text').fill(first);
      await c.locator('#gb-hl-editor [type=submit]').tap();
      await a.goto(url);
      await a.locator('#mobPartTocBtn').tap();
      await a.locator('#gbrMarginaliaTab').tap();
      const marks = a
        .locator('details.gbr-marginalia-group')
        .filter({
          has: a.locator('summary strong', { hasText: 'Мои пометы' }),
        });
      await marks.locator('summary').tap();
      const state = async () => ({
        cards: await marks
          .locator('.gbr-marginalia-personal p')
          .allTextContents(),
        count: await marks.locator('summary span').innerText(),
        open: await marks.evaluate((e) => e.open),
        disk: await a.evaluate(() =>
          JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').map(
            (n) => n.text,
          ),
        ),
      });
      r.before = await state();
      assert.deepEqual(r.before.cards, [first]);
      await a.evaluate(() =>
        window.addEventListener(
          'storage',
          (e) => {
            if (e.key === 'gb-reader-notes-v1')
              document.documentElement.dataset.testSawNote = '1';
          },
          { once: false },
        ),
      );
      await c.bringToFront();
      if (mode === 'edit') {
        await c.locator('[data-library-action=edit-note]').first().tap();
        await c.locator('#gb-hl-note-text').fill(second);
        await c.locator('#gb-hl-editor [type=submit]').tap();
      } else
        await c
          .locator('[data-type=note] [data-library-action=delete]')
          .first()
          .tap();
      await a.waitForFunction(
        () => document.documentElement.dataset.testSawNote === '1',
      );
      await a.bringToFront();
      await a.waitForTimeout(600);
      r.afterEvent = await state();
      await marks.locator('summary').tap();
      await marks.locator('summary').tap();
      r.afterFold = await state();
      await a.locator('#gbrTocTab').tap();
      await a.locator('#gbrMarginaliaTab').tap();
      await marks.locator('summary').tap();
      r.afterTab = await state();
      const expected = mode === 'edit' ? [second] : [];
      assert.deepEqual(r.afterTab.cards, expected);
      assert.deepEqual(r.afterEvent.disk, expected);
      r.live = JSON.stringify(r.afterEvent.cards) === JSON.stringify(expected);
      if (!r.live) process.exitCode = 1;
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
