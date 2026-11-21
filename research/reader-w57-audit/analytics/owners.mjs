// Cold loads, no injection into the product. Open the same anchor in the same built article.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const host = process.env.READER_URL || 'http://127.0.0.1:19071',
  out = process.env.SHOTS;
if (out) await mkdir(out, { recursive: true });
const gill = '/articles/dzhon-gill-chast-2-uchenyi/',
  noch = '/baptisty-rossii/noch-na-kure/',
  kod = '/articles/kod-da-vinchi/';
const shoot = async (p, name) => {
  if (out) await p.screenshot({ path: `${out}/${name}.jpg`, quality: 87 });
};
async function row(w, path, id, pilot) {
  const ctx = await b.newContext({
      viewport: { width: w, height: 844 },
      isMobile: w <= 1120,
      hasTouch: w <= 1120,
      reducedMotion: 'reduce',
    }),
    r = { w, path, id, pilot };
  try {
    const p = await ctx.newPage();
    p.setDefaultTimeout(5000);
    assert.equal(
      (
        await p.goto(
          host +
            path +
            (pilot ? '?reader-pilot=1&panel=open' : '') +
            (id ? '#' + id : ''),
        )
      ).status(),
      200,
    );
    await p.evaluate(() => document.fonts.ready);
    if (pilot && w > 1120)
      await p.waitForFunction(() => window.__NP_UNIVERSAL_PREVIEW__?.ready);
    await p.waitForTimeout(500);
    if (id)
      await p
        .locator('#' + id)
        .evaluate((el) =>
          el.scrollIntoView({ block: 'start', behavior: 'instant' }),
        );
    await p.waitForTimeout(450);
    r.runtime = await p.evaluate(() => ({
      contract: window.GBReaderContract?.version || null,
      w57: !!window.__NP_UNIVERSAL_PREVIEW__?.ready,
      scripts: [...document.scripts].filter(
        (s) =>
          s.src.includes('/__reader_w57__/') && !s.src.endsWith('bootstrap.js'),
      ).length,
      nativeBound:
        document.querySelector('#partTocOverlay')?.dataset.gbrMarginaliaBound ||
        null,
      desktopRoot: !!document.querySelector('#npUResearch'),
      nativeRoot: !!document.querySelector('#gbrMarginalia'),
      nativeVisibleTrigger: [
        ...document.querySelectorAll('[data-gill-marginalia-open]'),
      ].some(
        (el) => el.checkVisibility() && el.getBoundingClientRect().width > 0,
      ),
      y: scrollY,
    }));
    if (r.runtime.w57) {
      r.owner = 'pilot';
      await p.locator('#npUSectionHost').waitFor({ state: 'attached' });
      r.material = await p.evaluate(() => {
        const host = document.querySelector('#npUResearch'),
          text = (s) => host.querySelector(s)?.textContent.trim(),
          texts = (s) =>
            Array.from(host.querySelectorAll(s), (e) => e.textContent.trim());
        const root =
          document.querySelector('article.article-body') ||
          document.querySelector('main article');
        const paras = [...root.querySelectorAll('p,blockquote')];
        return {
          heading: text('.np-u-argument-intro strong'),
          modules: texts('.np-u-research-module > details > summary strong'),
          terms: texts('#npULexiconPick option'),
          refs: texts('#npUScripturePick option'),
          evidence: [
            ...host.querySelectorAll(
              '.np-u-argument-nodes [data-np-u-evidence-index]',
            ),
          ].map((btn) => {
            const el = paras[Number(btn.dataset.npUEvidenceIndex)];
            return { id: el?.id, lead: el?.textContent.trim().slice(0, 60) };
          }),
          personal: !!host.querySelector('#npW57NotesDetails'),
          articleGroups: window.__NP_UNIVERSAL_PREVIEW__.groups.map(
            (g) => g.id,
          ),
        };
      });
      if (w === 1440 && id === 'part-controversy') await shoot(p, 'desktop');
    } else if (
      w <= 1120 &&
      (await p.locator('#mobPartTocBtn:visible').count()) &&
      r.runtime.nativeRoot
    ) {
      await p.locator('#mobPartTocBtn').tap();
      await p.locator('#gbrMarginaliaTab').tap();
      r.owner = 'native-sheet';
      r.material = await p.evaluate(() => {
        const host = document.querySelector('#gbrMarginalia'),
          texts = (s) =>
            Array.from(host.querySelectorAll(s), (e) => e.textContent.trim());
        const root =
          document.querySelector('article.article-body') ||
          document.querySelector('main article');
        return {
          heading: host.querySelector('h3').textContent.trim(),
          modules: texts('.gbr-marginalia-group-head > :first-child'),
          terms: texts('.gbr-marginalia-term summary'),
          refs: texts('.gbr-marginalia-chips button'),
          evidence: texts('.gbr-marginalia-evidence p').map((t) => {
            const lead = t.slice(0, 40);
            return {
              id: [...root.querySelectorAll('p,blockquote')].find((e) =>
                e.textContent.replace(/\s+/g, ' ').trim().startsWith(lead),
              )?.id,
              lead,
            };
          }),
          personal: texts('.gbr-marginalia-group-head strong').includes(
            'Мои пометы',
          ),
        };
      });
      if (w === 390 && id === 'part-controversy' && pilot)
        await shoot(p, 'mobile');
    } else r.owner = 'no pilot rail or tested mobile sheet opened';
  } catch (e) {
    r.error = e.message;
    process.exitCode = 1;
  } finally {
    console.log(JSON.stringify(r));
    await ctx.close();
  }
}
try {
  for (const w of [390, 1120, 1121, 1440])
    await row(w, gill, 'part-controversy', true);
  for (const w of [390, 1440]) {
    await row(w, gill, 'part-controversy', false);
    await row(w, noch, 'the-baptism', true);
    await row(w, kod, '', true);
  }
} finally {
  await b.close();
}
