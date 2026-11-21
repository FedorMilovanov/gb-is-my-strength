// Deterministic Selection on published prose; actual tap for every product action.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const url = new URL(
    '/articles/dzhon-gill-chast-2-uchenyi/',
    process.env.READER_URL || 'http://127.0.0.1:19075',
  ).href,
  block = 'gill-search-p-033',
  phrase = 'Песнь Песней';
async function select(p, word, last) {
  const args = { block, word, last };
  const make = ({ block, word, last, scroll }) => {
    const n = [...document.getElementById(block).childNodes].find(
      (n) => n.nodeType === 3 && n.data.includes(word),
    );
    const offset = last ? n.data.lastIndexOf(word) : n.data.indexOf(word);
    const r = document.createRange();
    r.setStart(n, offset);
    r.setEnd(n, offset + word.length);
    if (scroll)
      window.scrollBy({
        top: r.getBoundingClientRect().top - innerHeight * 0.52,
        behavior: 'instant',
      });
    else {
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    }
    return offset;
  };
  await p.evaluate(make, { ...args, scroll: true });
  await p.waitForTimeout(220);
  const offset = await p.evaluate(make, args);
  await p.locator('#gb-hl-selbar[data-open=true]').waitFor();
  return offset;
}
const snap = (p) =>
  p.evaluate(() => ({
    quotes: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').map(
      ({ id, text, color, before, after }) => ({
        id,
        text,
        color,
        before: before?.slice(-25),
        after: after?.slice(0, 25),
      }),
    ),
    notes: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').map(
      ({ text, quoteText }) => ({ text, quoteText }),
    ),
    paint: [...CSS.highlights]
      .filter(([name]) => name.startsWith('gb-hl-'))
      .flatMap(([name, h]) =>
        [...h].map((r) => ({
          name,
          text: r.toString(),
          block: r.startContainer.parentElement.closest('p')?.id,
          offset: r.startOffset,
        })),
      ),
    toast: document.querySelector('#gb-hl-toast')?.innerText,
  }));
async function marks(p) {
  await p.locator('#mobPartTocBtn').tap();
  await p.locator('#gbrMarginaliaTab').tap();
  const m = p
    .locator('.gbr-marginalia-group')
    .filter({ has: p.locator('summary strong', { hasText: 'Мои пометы' }) });
  await m.locator('summary').tap();
  return m;
}
async function run(width, mode) {
  const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    }),
    p = await ctx.newPage(),
    r = { width, mode };
  ctx.setDefaultTimeout(5500);
  try {
    assert.equal(
      (
        await p.goto(mode === 'quote-cross' ? url + '?reader-pilot=1' : url)
      ).status(),
      200,
    );
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(550);
    if (mode === 'repeat' || mode === 'unique') {
      const text = mode === 'repeat' ? phrase : 'последовательная';
      r.second = await select(p, text, true);
      if (process.env.SHOTS && mode === 'repeat' && width === 390)
        await p.screenshot({
          path: process.env.SHOTS + '/before.jpg',
          quality: 90,
        });
      await p.locator('[data-hl-color=rose]').tap();
      r.saved = await snap(p);
      if (process.env.SHOTS && mode === 'repeat' && width === 390)
        await p.screenshot({
          path: process.env.SHOTS + '/after.jpg',
          quality: 90,
        });
      r.toastBox = await p.locator('#gb-hl-toast').evaluate((e) => {
        const q = e.getBoundingClientRect(),
          b = e.querySelector('button').getBoundingClientRect();
        return {
          x: q.x,
          width: q.width,
          height: q.height,
          undoHit: e
            .querySelector('button')
            .contains(
              document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
            ),
        };
      });
      r.first = await select(p, text, false);
      await p.locator('[data-hl-color=blue]').tap();
      r.both = await snap(p);
      await p.locator('#gb-hl-toast button').tap();
      r.undo = await snap(p);
      await p.reload();
      await p.waitForTimeout(1550);
      r.reloaded = await snap(p);
      const m = await marks(p);
      r.cards = await m.locator('.gbr-marginalia-personal').allInnerTexts();
      r.pass =
        r.saved.paint.some((x) => x.offset === r.second && x.block === block) &&
        r.both.quotes.length === (mode === 'repeat' ? 2 : 1) &&
        r.reloaded.paint.some(
          (x) => x.offset === r.second && x.block === block,
        );
    } else {
      r.first = await select(p, phrase, false);
      const sel = p.locator(
        '#gb-hl-selbar-' + (mode === 'quote-cross' ? 'quote' : mode),
      );
      await sel.tap();
      if (mode === 'note') {
        await p.locator('#gb-hl-note-text').fill('Заметка о Песни');
        await p.locator('#gb-hl-editor [type=submit]').tap();
      }
      r.saved = await snap(p);
      await p.goto(mode === 'quote-cross' ? url + '?reader-pilot=1' : url);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await p.waitForTimeout(650);
      const m = await marks(p);
      r.cards = await m.locator('.gbr-marginalia-personal').allInnerTexts();
      await m.getByRole('button', { name: 'Открыть библиотеку' }).tap();
      const link = p.locator('.gb-hl-item .gb-hl-meta a').first();
      r.href = await link.getAttribute('href');
      await link.tap();
      await p.locator('#' + block).waitFor({ state: 'attached' });
      await p.waitForTimeout(1400);
      const destination = () =>
        p.evaluate(
          (id) => ({
            hash: location.hash,
            locked: document.body.style.position === 'fixed',
            panel: document
              .querySelector('#gb-hl-backdrop')
              ?.getAttribute('aria-hidden'),
            sourceBottom: Math.round(
              document.getElementById(id).getBoundingClientRect().bottom,
            ),
            sourceTop: Math.round(
              document.getElementById(id).getBoundingClientRect().top,
            ),
            y: scrollY,
          }),
          block,
        );
      r.dest = await destination();
      if (r.dest.panel === 'false') {
        await p.locator('#gb-hl-close').tap();
        await p.waitForTimeout(700);
        r.afterManualClose = await destination();
      }
      r.pass =
        r.cards.length === 1 &&
        r.dest.panel !== 'false' &&
        !r.dest.locked &&
        r.dest.sourceTop < 844 &&
        r.dest.sourceBottom > 0;
    }
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
  for (const w of (process.env.WIDTHS || '320,390').split(',').map(Number))
    for (const mode of (
      process.env.MODES || 'repeat,unique,quote,note,quote-cross'
    ).split(','))
      await run(w, mode);
} finally {
  await browser.close();
}
