// Real Reader/local library actions in clean mobile contexts; no seeds, direct calls to save/restore, or OS keyboard claims.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const host = process.env.READER_URL || 'http://127.0.0.1:19069',
  path = '/articles/dzhon-gill-chast-2-uchenyi/',
  other = '/baptisty-rossii/noch-na-kure/',
  url = host + path + '?reader-pilot=1',
  shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const fab = (p) => p.locator('#gb-hl-fab').tap(),
  close = (p) => p.locator('#gb-hl-close').tap(),
  go = (p) => p.locator('[data-research-action="resume"]').tap();
async function snap(p, id) {
  return p.evaluate(
    ({ id, key }) => {
      const rec = JSON.parse(
          localStorage.getItem('gb-library-reading-v1') || '{}',
        )[key],
        canonical = window.GBReaderState?.getSaved(),
        el = id && document.getElementById(id),
        box = el?.getBoundingClientRect(),
        ov = document.querySelector('#gb-hl-backdrop');
      return {
        path: location.pathname,
        y: Math.round(scrollY),
        heading: el?.textContent.trim().slice(0, 90),
        headingY: box ? Math.round(box.y) : null,
        headingHit:
          !!box &&
          el.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ),
          ),
        library: ov?.getAttribute('aria-hidden') === 'false',
        lock: document.body.style.position,
        record: rec
          ? { state: rec.state, anchor: rec.anchor, ratio: rec.ratio }
          : null,
        canonical: canonical
          ? { anchor: canonical.sectionId, pct: canonical.progress }
          : null,
        focus: document.activeElement?.id || document.activeElement?.tagName,
        toast: document.querySelector('.gbs2-resume.gbs2-on span')?.innerText,
      };
    },
    { id, key: path.slice(0, -1) },
  );
}
const shot = async (p, w, name) => {
  if (shots && w === 390)
    await p.screenshot({ path: `${shots}/${name}.jpg`, quality: 87 });
};
async function visit(p, u) {
  assert.equal((await p.goto(u)).status(), 200);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('#gb-hl-fab').waitFor();
}
const reached = (s) =>
  !s.library &&
  s.path.replace(/\/$/, '') === path.slice(0, -1) &&
  s.y > 1200 &&
  s.headingY !== null &&
  s.headingY >= -150 &&
  s.headingY < 600 &&
  s.headingHit;
async function run(w, mode, plain = false) {
  const article = plain ? host + path : url;
  const ctx = await b.newContext({
    viewport: { width: w, height: 844 },
    locale: 'ru-RU',
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const r = { w, mode, plain };
  try {
    const p = await ctx.newPage();
    p.setDefaultTimeout(7000);
    if (mode === 'leave-open') await visit(p, host + other);
    await visit(p, article + '#part-controversy');
    await p.waitForTimeout(550);
    r.source = await snap(p, 'part-controversy');
    assert.ok(r.source.y > 1200 && Math.abs(r.source.headingY) < 300);
    await fab(p);
    await p.locator('[data-research-action=start-current]').tap();
    r.justMarked = await snap(p, 'part-controversy');
    if (mode !== 'leave-open') {
      await close(p);
      await p.waitForFunction(
        (key) =>
          JSON.parse(localStorage.getItem('gb-library-reading-v1'))[key].ratio >
          0,
        path.slice(0, -1),
      );
    }
    const known = await snap(p);
    const id = known.record.anchor || 'part-controversy';
    r.saved = await snap(p, id);
    if (mode === 'passive-exit') {
      // Cold second visit to top; leave without scrolling and without touching any control.
      await visit(p, host + other);
      await visit(p, article);
      await p.waitForTimeout(1400);
      r.beforePassiveExit = await snap(p, id);
    }
    const same = mode === 'same' || mode === 'toast';
    if (mode === 'leave-open' || mode === 'passive-exit') {
      await p.goBack();
      await p.waitForURL(host + other);
    } else await visit(p, same ? article : host + other);
    await p.waitForTimeout(1100);
    r.arrive = await snap(p, id);
    if (mode === 'toast') {
      await p.locator('.gbs2-resume.gbs2-on .gbs2-resume-go').tap();
    } else {
      await fab(p);
      await go(p);
    }
    await p.waitForTimeout(1250);
    r.afterTap = await snap(p, id);
    if (mode === 'same') {
      await shot(p, w, 'library-after-tap');
      if (r.afterTap.library) {
        await close(p);
        await p.waitForTimeout(900);
        r.manualClose = await snap(p, id);
        await shot(p, w, 'same-after-close');
      }
    }
    if (mode === 'cross') await shot(p, w, 'cross-after-tap');
    r.pass = reached(r.afterTap);
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
  for (const w of [320, 390])
    for (const mode of ['same', 'cross', 'toast', 'leave-open', 'passive-exit'])
      await run(w, mode);
  for (const mode of ['same', 'cross', 'passive-exit'])
    await run(390, mode, true);
} finally {
  await b.close();
}
