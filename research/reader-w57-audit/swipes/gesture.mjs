// Use a local Astro archive with native Reader. No patches, direct event handlers or fake clocks.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const host = process.env.READER_URL || 'http://127.0.0.1:19070',
  path = '/articles/dzhon-gill-chast-2-uchenyi/',
  shot = process.env.SHOTS;
if (shot) await mkdir(shot, { recursive: true });
async function record(w, h, name, fn) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    locale: 'ru-RU',
  });
  const p = await ctx.newPage(),
    r = { w, h, name };
  try {
    assert.equal((await p.goto(host + path + '?reader-pilot=1')).status(), 200);
    await p.evaluate(() => document.fonts.ready);
    await fn(p, r, await ctx.newCDPSession(p));
  } catch (e) {
    r.error = e.message;
    process.exitCode = 1;
  } finally {
    console.log(JSON.stringify(r));
    await ctx.close();
  }
}
const shotNow = async (p, name) => {
  if (shot) await p.screenshot({ path: `${shot}/${name}.jpg`, quality: 88 });
};
async function drag(c, x, y, legs, inspect, cancel = false) {
  const t = Date.now();
  const send = (type, x, y) =>
    c.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: x == null ? [] : [{ x, y }],
    });
  await send('touchStart', x, y);
  let ox = x,
    oy = y;
  for (const [dx, dy, n] of legs) {
    for (let j = 1; j <= n; j++) {
      await send('touchMove', ox + (dx * j) / n, oy + (dy * j) / n);
      await new Promise((r) => setTimeout(r, 10));
    }
    ox += dx;
    oy += dy;
  }
  await inspect();
  const ms = Date.now() - t;
  await send(cancel ? 'touchCancel' : 'touchEnd');
  return ms;
}
const peek = (p) =>
  p.evaluate(() => {
    const el = document.querySelector('.gbs2-peek.gbs2-on');
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return {
      title: el.querySelector('b').textContent,
      hint: el.querySelector('i').textContent,
      visibleWidth: Math.min(box.right, innerWidth) - Math.max(0, box.left),
      cardWidth: box.width,
      cover: getComputedStyle(el.querySelector('.gbs2-peek-img'))
        .backgroundImage,
    };
  });
const routes = {
  next: '/articles/dzhon-gill-chast-4-ekzeget/',
  prev: '/articles/dzhon-gill-chast-1-chelovek/',
  stay: path,
};
async function gesture(p, r, c, legs, intent, isTable = false, cancel = false) {
  const el = isTable
    ? p.locator('article table').first()
    : p.locator('#gill-search-p-068');
  await el.evaluate((e) =>
    e.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await p.waitForTimeout(330);
  const x = legs[0][0] > 0 ? r.w * 0.25 : r.w * 0.74,
    y = r.h * 0.5;
  const before = () =>
    p.evaluate(
      ({ x, y }) => {
        const e = document.elementFromPoint(x, y),
          t = e?.closest('table');
        return {
          path: location.pathname,
          y: scrollY,
          hit: e?.tagName,
          block: e?.closest('p,table')?.id,
          table: t
            ? { left: t.scrollLeft, max: t.scrollWidth - t.clientWidth }
            : null,
        };
      },
      { x, y },
    );
  r.start = await before();
  assert.ok(isTable ? r.start.table : r.start.block === 'gill-search-p-068');
  if (r.name === 'table-at-end') {
    for (let i = 0; i < 4; i++) {
      const s = await before();
      if (s.table.left >= s.table.max - 2) break;
      await drag(c, x, y, [[-140, 0, 8]], async () => {});
      await p.waitForTimeout(350);
    }
    r.atEdge = await before();
    assert.ok(r.atEdge.table.left >= r.atEdge.table.max - 2);
  }
  r.legs = legs;
  r.ms = await drag(
    c,
    x,
    y,
    legs,
    async () => {
      r.peek = await peek(p);
      if (
        r.w === 390 &&
        ['short', 'next', 'slow', 'bent', 'table-at-end', 'reverse'].includes(
          r.name,
        )
      )
        await shotNow(p, r.name);
      if (r.name === 'slow') await p.waitForTimeout(1300);
    },
    cancel,
  );
  await p.waitForTimeout(800);
  r.end = await before();
  r.expected = intent;
  r.match = r.end.path === routes[intent];
  if (!r.match) process.exitCode = 1;
}
const spec = {
  threshold: [[[-90, 0, 8]], 'stay'],
  justOver: [[[-92, 0, 8]], 'next'],
  next: [[[-141, 0, 10]], 'next'],
  prev: [[[141, 0, 10]], 'prev'],
  short: [[[-62, 0, 7]], 'stay'],
  reverse: [
    [
      [-130, 0, 7],
      [105, 0, 6],
    ],
    'stay',
  ],
  cancel: [[[-136, 0, 10]], 'stay', false, true],
  vertical: [[[0, -155, 12]], 'stay'],
  diagonal: [[[-99, -144, 12]], 'stay'],
  bent: [
    [
      [-32, 0, 3],
      [-69, -170, 10],
    ],
    'stay',
  ],
  slow: [[[-135, 0, 9]], 'stay'],
  'table-inside': [[[-140, 0, 9]], 'stay', true],
  'table-at-end': [[[-140, 0, 9]], 'stay', true],
};
const bar = (p) =>
  p
    .locator('#gbs2MobSec')
    .evaluate((e) => ({
      text: e.innerText,
      width: e.clientWidth,
      height: e.clientHeight,
      scrollHeight: e.scrollHeight,
      font: getComputedStyle(e).fontSize,
      label: getComputedStyle(
        document.querySelector('.mobile-btoc-section__label'),
      ).clipPath,
      barHeight: document
        .querySelector('.mobile-bottom-bar')
        .getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
try {
  for (const w of [320, 390])
    for (const name of Object.keys(spec).filter(
      (k) => !process.env.CASES || process.env.CASES.split(',').includes(k),
    ))
      await record(w, w === 320 ? 568 : 844, name, (p, r, c) =>
        gesture(p, r, c, ...spec[name]),
      );
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [568, 320],
  ])
    await record(w, h, 'visual', async (p, r) => {
      r.bar = await bar(p);
      await shotNow(p, `home-${w}`);
      await p.locator('[data-gill-marginalia-open]:visible').tap();
      await p.locator('#gbrMarginalia').waitFor();
      await p.waitForTimeout(350);
      await shotNow(p, `analytics-${w}`);
      await p.keyboard.press('Escape');
      await p.locator('#mobSettingsBtn').tap();
      await p.locator('[data-gill-font=cormorant]').tap();
      await p.locator('#gillSettingsOverlay [data-theme=dark]').tap();
      await p.waitForTimeout(250);
      await shotNow(p, `dark-${w}`);
      await p.locator('#gillSettingsOverlay .gill-settings-done').tap();
      await p.locator('#gb-hl-fab').tap();
      await p.locator('#gb-hl-manage').waitFor();
      await shotNow(p, `library-${w}`);
      r.library = await p
        .locator('#gb-hl-title')
        .evaluate((e) => ({
          width: e.clientWidth,
          height: e.clientHeight,
          title: e.textContent,
          anchor: e.querySelector('.heading-anchor')?.getClientRects().length,
        }));
    });
} finally {
  await b.close();
}
