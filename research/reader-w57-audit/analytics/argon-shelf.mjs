// No product hooks; inspect geometry and the published text only after real input.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const base = process.env.READER_URL || 'http://127.0.0.1:19077';
const route = '/articles/dzhon-gill-chast-2-uchenyi/#part-controversy';
const controls = {
  tab: '#gbrMarginaliaTab',
  chip: '.gbr-scripture-ref',
  rail: '.gbr-scripture-rail',
  passage: '.gbr-scripture-passage',
};
async function swipe(p, box, dx, dy) {
  const c = await p.context().newCDPSession(p);
  const x = box.x + box.width * (dx < 0 ? 0.8 : 0.5),
    y = box.y + box.height * (dy < 0 ? 0.8 : 0.5);
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 10; i++) {
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }],
    });
    await p.waitForTimeout(17);
  }
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await c.detach();
  await p.waitForTimeout(350);
}
async function open(p) {
  await p.locator('#mobPartTocBtn').tap();
  await p.locator(controls.tab).tap();
  await group(p);
}
async function group(p) {
  await p
    .locator('.gbr-marginalia-group-head')
    .filter({ hasText: 'Писание' })
    .tap();
  await p.waitForTimeout(300);
}
const visibleBox = (loc) =>
  loc.evaluate((e) => {
    const r = e.getBoundingClientRect(),
      p = document.querySelector('#gbrMarginalia').getBoundingClientRect();
    return {
      x: r.x,
      y: Math.max(p.top, r.top),
      width: r.width,
      height: Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top),
    };
  });
const state = (p) =>
  p.evaluate(() => {
    const rail = document.querySelector('.gbr-scripture-rail'),
      q = (s) => document.querySelector('.gbr-scripture-' + s),
      a = rail.querySelector('[aria-pressed=true]'),
      r = rail.getBoundingClientRect(),
      ar = a.getBoundingClientRect(),
      pa = q('passage'),
      source = q('source').textContent,
      title = q('active-ref').textContent,
      verse = pa.innerText.trim(),
      keys = Object.keys(window.SCRIPTURE_DATA || {}).filter(
        (k) =>
          window.SCRIPTURE_DATA[k] === verse &&
          window.SCRIPTURE_SOURCE_BY_REF[k] === source,
      );
    const range = document.createRange();
    range.selectNodeContents(a);
    const text = range.getBoundingClientRect();
    return {
      title,
      textClippedPx: Math.round(
        Math.max(0, r.left - text.left) + Math.max(0, text.right - r.right),
      ),
      pressed: a.textContent,
      selected: rail.querySelectorAll('[aria-pressed=true]').length,
      count: q('count').textContent,
      focus: document.activeElement.textContent.slice(0, 24),
      pressedVisiblePx: Math.round(
        Math.max(0, Math.min(ar.right, r.right) - Math.max(ar.left, r.left)),
      ),
      chipW: Math.round(ar.width),
      railX: Math.round(rail.scrollLeft),
      railMax: rail.scrollWidth - rail.clientWidth,
      passageTop: pa.scrollTop,
      passageMax: pa.scrollHeight - pa.clientHeight,
      keys,
      reading: document.querySelectorAll('.gbr-scripture-reading').length,
      sheet: document
        .querySelector('#partTocOverlay')
        .classList.contains('is-open'),
      path: location.pathname,
      scope: q('scope').textContent,
    };
  });
try {
  for (const [w, h] of [
    [320, 640],
    [390, 844],
    [740, 360],
  ]) {
    const ctx = await b.newContext({
        viewport: { width: w, height: h },
        hasTouch: true,
        isMobile: true,
        reducedMotion: 'reduce',
      }),
      p = await ctx.newPage(),
      out = { w, h };
    p.setDefaultTimeout(6500);
    try {
      await p.goto(base + route);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(500);
      await open(p);
      out.initial = await state(p);
      const chips = p.locator(controls.chip),
        rail = p.locator(controls.rail),
        n = await chips.count();
      await rail.scrollIntoViewIfNeeded();
      const box = await visibleBox(rail);
      await swipe(p, box, -Math.min(135, box.width * 0.55), 0);
      out.swipe = await state(p);
      await chips.first().tap();
      out.list = [];
      for (let i = 0; i < n; i++) {
        if (i) await p.keyboard.press('ArrowRight');
        await p.waitForTimeout(320);
        const s = await state(p);
        out.list.push({
          label: s.title,
          index: i,
          focus: s.focus,
          selected: s.selected,
          keys: s.keys,
          visible: s.pressedVisiblePx,
          chipW: s.chipW,
          max: s.passageMax,
          clipped: s.textClippedPx,
          count: s.count,
        });
        assert.equal(s.pressed, s.title);
        assert.equal(s.reading, 1);
      }
      await p.keyboard.press('Home');
      out.home = await state(p);
      await p.keyboard.press('End');
      await p.waitForTimeout(350);
      out.last = await state(p);
      if (process.env.SHOTS && w === 390)
        await p.screenshot({ path: process.env.SHOTS + '/selected.jpg' });
      await p.locator('#gbrTocTab').tap();
      await p.locator(controls.tab).tap();
      await group(p);
      out.tabReturn = await state(p);
      if (process.env.SHOTS && w === 390)
        await p.screenshot({ path: process.env.SHOTS + '/reopened.jpg' });
      await p.locator('#partTocOverlay .toc-sheet__handle').tap();
      await p.waitForTimeout(550);
      await open(p);
      out.reopened = await state(p);
      const long = out.list
        .filter((x) => x.max > 15)
        .sort((a, b) => b.max - a.max);
      if (long.length >= 2) {
        await chips.nth(long[0].index).tap();
        const passage = p.locator(controls.passage);
        await passage.scrollIntoViewIfNeeded();
        const rect = await visibleBox(passage);
        out.inputBox = rect;
        await swipe(p, rect, 0, -Math.min(108, rect.height * 0.45));
        out.scrolled = await state(p);
        await chips.nth(long[1].index).tap();
        out.switched = await state(p);
        if (process.env.SHOTS && w === 390) {
          await passage.scrollIntoViewIfNeeded();
          await p.screenshot({ path: process.env.SHOTS + '/inherited.jpg' });
        }
        await chips.first().tap();
        await chips.nth(long[1].index).tap();
        out.viaShort = await state(p);
        if (process.env.SHOTS && w === 390) {
          await passage.scrollIntoViewIfNeeded();
          await p.screenshot({ path: process.env.SHOTS + '/start.jpg' });
        }
      }
      out.pass =
        out.reopened.pressedVisiblePx > 0 &&
        out.tabReturn.pressedVisiblePx > 0 &&
        out.tabReturn.textClippedPx === 0 &&
        out.reopened.textClippedPx === 0 &&
        out.swipe.railX > out.initial.railX &&
        out.swipe.sheet &&
        out.list.every(
          (s) =>
            s.keys.includes(s.label) &&
            s.clipped === 0 &&
            s.visible > 0 &&
            s.selected === 1 &&
            s.label === s.focus,
        ) &&
        (!out.switched ||
          (out.scrolled.passageTop > 0 && out.switched.passageTop === 0));
      if (!out.pass) process.exitCode = 1;
    } catch (e) {
      out.error = e.message;
      process.exitCode = 1;
    } finally {
      console.log(JSON.stringify(out));
      await ctx.close();
    }
  }
} finally {
  await b.close();
}
