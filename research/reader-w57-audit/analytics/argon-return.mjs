import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const base = process.env.READER_URL || 'http://127.0.0.1:19077';
try {
  for (const [anchor, label, count] of [
    ['sec-method', 'Рим 12:6', 2],
    ['sec-quiz', '1 Тим 2:4', 3],
  ]) {
    const dest = new Set();
    for (let i = 0; i < count; i++) {
      const p = await b.newPage({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
          reducedMotion: 'reduce',
        }),
        r = { anchor, label, i };
      p.setDefaultTimeout(5500);
      try {
        await p.goto(base + '/articles/dzhon-gill-chast-4-ekzeget/#' + anchor);
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(400);
        await p.locator('#mobPartTocBtn').tap();
        await p.locator('#gbrMarginaliaTab').tap();
        await p
          .locator('.gbr-marginalia-group-head')
          .filter({ hasText: 'Писание' })
          .tap();
        const chips = p.locator('.gbr-scripture-ref');
        r.keys = await chips.allTextContents();
        const target = chips.filter({
          hasText: new RegExp('^' + label.replace(' ', '\\.?\\s+') + '$'),
        });
        assert.equal(await target.count(), 1);
        await target.tap();
        const links = p.locator('.gbr-scripture-return');
        r.occurrences = await links.count();
        assert.equal(r.occurrences, count);
        await links.nth(i).tap();
        await p.waitForTimeout(2450);
        r.landed = await p.evaluate(() => {
          const e = document.activeElement;
          return {
            id: e.id,
            tag: e.tagName,
            text: e.innerText.slice(0, 1500),
            top: Math.round(e.getBoundingClientRect().top),
            sheet: document
              .querySelector('#partTocOverlay')
              .classList.contains('is-open'),
          };
        });
        assert.ok(
          !r.landed.sheet &&
            r.landed.top >= 0 &&
            r.landed.top < 844 &&
            ['P', 'LI', 'BLOCKQUOTE'].includes(r.landed.tag) &&
            r.landed.text.replaceAll('.', '').includes(label) &&
            !dest.has(r.landed.id),
        );
        dest.add(r.landed.id);
        r.pass = true;
      } catch (e) {
        r.error = e.message;
        process.exitCode = 1;
      } finally {
        console.log(JSON.stringify(r));
        await p.close();
      }
    }
  }
} finally {
  await b.close();
}
