// Same article coordinates before opening. No writes to reader state, history or storage.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const base = process.env.READER_URL || 'http://127.0.0.1:19077',
  prior = !!process.env.PRIOR;
const site = '/articles/dzhon-gill-chast-2-uchenyi/',
  id = 'part-controversy',
  label = '2 Тим. 1:9';
const view = (w) => ({ width: w, height: w === 740 ? 390 : 844 });
const state = (p) =>
  p.evaluate((id) => {
    const q = (s) => document.querySelector(s),
      el = document.activeElement,
      sh = q('#partTocOverlay'),
      hh = q('#' + id).getBoundingClientRect().top;
    const ps = [...document.querySelectorAll('article.article-body p[id]')]
      .map((n) => ({
        id: n.id,
        top: Math.round(n.getBoundingClientRect().top),
        bottom: Math.round(n.getBoundingClientRect().bottom),
        text: n.innerText?.trim().slice(0, 95),
      }))
      .filter(
        (r) => r.bottom > innerHeight * 0.25 && r.top < innerHeight && r.text,
      );
    return {
      width: innerWidth,
      height: innerHeight,
      y: Math.round(scrollY),
      lock: document.body.style.position === 'fixed',
      fixedTop: document.body.style.top,
      sheet: sh.classList.contains('is-open'),
      layer: window.OverlayRuntime?.topLayer()?.ownerId,
      section: q('.gbr-marginalia-lead h3')?.textContent,
      refs: q('.gbr-scripture-rail')?.dataset.count,
      verse:
        q('.gbr-scripture-active-ref')?.textContent ||
        q('.gbr-scripture-entry[open] >summary')?.textContent,
      focus: el.id || el.className || el.tagName,
      focusVisible: el.getClientRects().length > 0 && el.checkVisibility(),
      headingTop: Math.round(hh),
      firstVisible: ps[0],
      pilot: !!window.__NP_UNIVERSAL_PREVIEW__?.ready,
      documentStart: performance.timeOrigin,
    };
  }, id);
async function run(
  name,
  from,
  to,
  {
    sheet = true,
    hash = true,
    pilot = false,
    action = 'escape',
    roundtrip = false,
    toc = false,
  } = {},
) {
  const ctx = await browser.newContext({
      viewport: view(from),
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    }),
    p = await ctx.newPage(),
    r = { name, from, to, sheet, hash, pilot, action };
  p.setDefaultTimeout(5500);
  try {
    assert.equal(
      (
        await p.goto(
          base +
            site +
            (pilot ? '?reader-pilot=1' : '') +
            (hash ? '#' + id : ''),
        )
      ).status(),
      200,
    );
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(450);
    await p
      .locator('#' + id)
      .evaluate((e) =>
        e.scrollIntoView({ block: 'start', behavior: 'instant' }),
      );
    await p.waitForTimeout(400);
    r.initial = await state(p);
    if (sheet) {
      await p.locator('#mobPartTocBtn').tap();
      await p.locator('#partTocOverlay.is-open').waitFor();
      if (!toc) {
        await p.locator('#gbrMarginaliaTab').tap();
        await p
          .locator('.gbr-marginalia-group-head')
          .filter({ hasText: 'Писание' })
          .tap();
        await p
          .locator(
            prior ? '.gbr-scripture-entry >summary' : '.gbr-scripture-ref',
          )
          .filter({ hasText: label })
          .tap();
      }
      r.opened = await state(p);
      assert.ok(r.opened.sheet && r.opened.lock);
    }
    await p.setViewportSize(view(to));
    await p.waitForTimeout(1250);
    r.resized = await state(p);
    if (action === 'retab') {
      await p.locator('#gbrTocTab').tap();
      await p.locator('#gbrMarginaliaTab').tap();
      await p
        .locator('.gbr-marginalia-group-head')
        .filter({ hasText: 'Писание' })
        .tap();
      r.afterTab = await state(p);
    }
    if (roundtrip) {
      await p.setViewportSize(view(from));
      await p.waitForTimeout(900);
    }
    if (sheet && r.resized.sheet) {
      if (action === 'jump')
        await p.locator('.gbr-scripture-return:visible').first().tap();
      else if (action === 'tap')
        await p.locator('#partTocOverlay .toc-sheet__handle').tap();
      else await p.keyboard.press('Escape');
      await p.waitForTimeout(action === 'jump' ? 2500 : 650);
    }
    r.end = await state(p);
    r.reloaded = r.resized.documentStart !== r.initial.documentStart;
    if (action === 'jump') {
      r.source = await p.evaluate(() => ({
        id: document.activeElement.id,
        text: document.activeElement.innerText?.slice(0, 1200),
        top: Math.round(document.activeElement.getBoundingClientRect().top),
      }));
      r.pass =
        !r.end.lock &&
        !r.end.sheet &&
        r.source.text.includes(label) &&
        r.source.top >= 0 &&
        r.source.top < r.end.height;
    } else {
      r.pass =
        !r.end.sheet &&
        !r.end.lock &&
        r.end.headingTop >= 0 &&
        r.end.headingTop < r.end.height;
    }
    if (process.env.SHOTS && ['rotate-open', 'rotate-closed'].includes(name))
      await p.screenshot({
        path: process.env.SHOTS + '/' + name + '.jpg',
        quality: 90,
      });
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
  await run('rotate-open', 390, 740);
  await run('rotate-closed', 390, 740, { sheet: false });
  if (!prior) {
    await run('rotate-toc', 390, 740, { toc: true, action: 'tap' });
    await run('nohash-open', 390, 740, { hash: false, action: 'tap' });
    await run('nohash-closed', 390, 740, { hash: false, sheet: false });
    await run('rotate-back', 390, 740, { roundtrip: true });
    await run('source-after-rotate', 390, 740, { action: 'jump' });
    await run('landscape-to-portrait', 740, 390, { action: 'retab' });
    await run('native-one-pixel', 1120, 1121);
    await run('pilot-one-pixel', 1120, 1121, { pilot: true });
    await run('pilot-one-pixel-closed', 1120, 1121, {
      pilot: true,
      sheet: false,
    });
  }
} finally {
  await browser.close();
}
