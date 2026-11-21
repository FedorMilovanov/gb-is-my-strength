// Read computed colours on the flat button face; use a real note to distinguish data from layout.
import assert from 'node:assert/strict';
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
  ),
  b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
  });
const host = process.env.READER_URL || 'http://127.0.0.1:19070';
const note = 'Сохранённая мысль: сверить аргумент и ссылку на источник.';
async function snap(p) {
  return p.evaluate(() => {
    let e = document.querySelector('#gb-hl-list'),
      r = e.getBoundingClientRect(),
      n = document.querySelector('#gb-hl-new-note'),
      cs = getComputedStyle(n);
    const rect = (el) =>
      el
        ? {
            top: el.getBoundingClientRect().top,
            h: el.getBoundingClientRect().height,
          }
        : null;
    return {
      y: r.y,
      h: r.height,
      listViewport: e.clientHeight,
      total: e.scrollHeight,
      listScroll: e.scrollTop,
      panelScroll: e.parentNode.scrollTop,
      overflow: getComputedStyle(e).overflowY,
      card: rect(e.querySelector('.gb-hl-quote')),
      edit: rect(e.querySelector('[data-library-action=edit-note]')),
      empty: rect(e.querySelector('.gb-hl-empty-title')),
      button: {
        fg: cs.color,
        bg: cs.backgroundColor,
        image: cs.backgroundImage,
        font: cs.fontSize,
        weight: cs.fontWeight,
      },
      panel: getComputedStyle(e.parentElement).backgroundColor,
    };
  });
}
const lum = (rgb) =>
  rgb
    .match(/\d+(?:\.\d+)?/g)
    .slice(0, 3)
    .map((x) => Number(x) / 255)
    .reduce(
      (sum, c, i) =>
        sum +
        [0.2126, 0.7152, 0.0722][i] *
          (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
      0,
    );
try {
  for (const [w, h, dark] of [
    [320, 568, true],
    [320, 568, false],
    [320, 520, true],
    [390, 844, true],
  ]) {
    const ctx = await b.newContext({
        viewport: { width: w, height: h },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      }),
      p = await ctx.newPage(),
      r = { w, h, dark };
    p.setDefaultTimeout(7000);
    try {
      await p.goto(
        host + '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1',
      );
      await p.evaluate(() => document.fonts.ready);
      if (dark) {
        await p.locator('#mobSettingsBtn').tap();
        await p.locator('#gillSettingsOverlay [data-theme=dark]').tap();
        await p.locator('#gillSettingsOverlay .gill-settings-done').tap();
      }
      await p.locator('#gb-hl-fab').tap();
      await p.locator('.gb-hl-empty-title').waitFor();
      await p.waitForTimeout(320);
      r.empty = await snap(p);
      const s = r.empty.button;
      if (s.image === 'none') {
        const v = [lum(s.fg), lum(s.bg)].sort((a, b) => a - b);
        r.ratio = Number(((v[1] + 0.05) / (v[0] + 0.05)).toFixed(2));
      }
      await p.locator('#gb-hl-new-note').tap();
      await p.locator('#gb-hl-note-text').fill(note);
      await p.locator('#gb-hl-editor [type=submit]').tap();
      await p.reload();
      await p.locator('#gb-hl-fab').tap();
      await p.locator('[data-library-tab=note]').tap();
      await p.waitForTimeout(350);
      r.saved = await snap(p);
      const c = await ctx.newCDPSession(p),
        x = w * 0.47,
        y = Math.min(h - 12, r.saved.y + Math.min(r.saved.h / 2, 135));
      if (y >= r.saved.y) {
        await c.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        });
        for (let i = 1; i <= 8; i++) {
          await c.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y - i * 12 }],
          });
          await p.waitForTimeout(20);
        }
        await c.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        await p.waitForTimeout(350);
      }
      r.afterSwipe = await snap(p);
      if (process.env.SHOTS)
        await p.screenshot({
          path: `${process.env.SHOTS}/note-${w}-${h}-${dark}.jpg`,
          quality: 90,
        });
      r.onDisk = await p.evaluate(() =>
        JSON.parse(localStorage.getItem('gb-reader-notes-v1')).map(
          (x) => x.text,
        ),
      );
      assert.deepEqual(r.onDisk, [note]);
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
