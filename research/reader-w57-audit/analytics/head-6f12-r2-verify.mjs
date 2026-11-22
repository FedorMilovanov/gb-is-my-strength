const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const SHOTS = process.env.SHOTS || '';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

try {
  // 1. Two-tab W57 stale linked-note edit with editor already open (fd9d535d)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p1 = await ctx.newPage();
    const p2 = await ctx.newPage();
    p1.setDefaultTimeout(7000); p2.setDefaultTimeout(7000);
    await p1.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&panel=open');
    await p1.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready);
    await p1.evaluate(() => document.fonts.ready);
    await p1.locator('#npW57NotesDetails summary').click();
    await p1.evaluate(() => {
      const el = document.getElementById('gill-search-p-037');
      const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.data.trim().length > 25);
      const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, 20);
      window.scrollBy({ top: r.getBoundingClientRect().top - 400, behavior: 'instant' });
      getSelection().removeAllRanges(); getSelection().addRange(r);
    });
    await p1.waitForTimeout(200);
    await p1.locator('[data-w57-action="note"]').click();
    await p1.locator('#npW57NoteText').fill('Заметка v1');
    await p1.locator('#npW57SaveNote').click();
    await p1.waitForTimeout(250);

    await p2.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&panel=open');
    await p2.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready);
    await p2.evaluate(() => document.fonts.ready);
    await p2.locator('#npW57NotesDetails summary').click();
    await p2.waitForTimeout(200);
    await p2.locator('#npW57NotesList [data-action="edit"]').first().click();
    await p2.locator('#npW57NoteText').fill('Устаревшая правка из открытого редактора');
    await p1.locator('#npW57NotesList [data-action="delete"]').first().click();
    await p1.waitForTimeout(300);
    await p2.locator('#npW57SaveNote').click();
    await p2.waitForTimeout(300);
    emit('w57-two-tab-open-editor', await p2.evaluate(() => ({
      quotesCount: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
      notesCount: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').length,
      danglingQuoteId: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]')[0]?.quoteId || null,
      status: document.querySelector('#npW57NotesStatus')?.textContent?.trim() || null,
      editorHidden: document.querySelector('#npW57NoteEditor')?.hidden,
    })));
    await ctx.close();
  }

  // 2. Inline mobile resume banner placement & jump (1d4d9554)
  for (const [w, h, theme] of [[320, 640, 'light'], [390, 844, 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate((t) => { if (window.applyGillReaderTheme) window.applyGillReaderTheme(t); }, theme);
    await p.evaluate(() => document.getElementById('sec-whitefield')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await p.waitForTimeout(750);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    const banner = await p.evaluate(() => {
      const el = document.querySelector('.gbs2-resume');
      if (!el) return null;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, bg: cs.backgroundColor, fg: cs.color, text: el.innerText.trim().replace(/\s+/g, ' ') };
    });
    if (SHOTS && w === 320) await p.screenshot({ path: `${SHOTS}/inline-resume-320.jpg`, quality: 86 });
    await p.locator('.gbs2-resume-go').tap();
    await p.waitForTimeout(450);
    emit('inline-resume', { w, h, theme, banner, afterClickY: await p.evaluate(() => Math.round(scrollY)) });
    await ctx.close();
  }

  // 3. Gill Context 701px, Gill Spravochnik 320/390 overflow, and visible-cell word splits
  {
    const ctx = await browser.newContext({ viewport: { width: 701, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/dzhon-gill-istoricheskiy-kontekst/');
    await p.evaluate(() => document.fonts.ready);
    const gillCtx701 = await p.evaluate(() => [...document.querySelectorAll('table')].map((t, i) => ({
      i, caption: t.querySelector('th')?.textContent?.trim()?.slice(0, 30),
      w: Math.round(t.clientWidth), scrollW: Math.round(t.scrollWidth), ov: Math.round(t.scrollWidth - t.clientWidth),
    })));
    emit('gill-context-701', { gillCtx701 });

    await p.setViewportSize({ width: 320, height: 640 });
    await p.goto(BASE + '/articles/dzhon-gill-spravochnik/');
    await p.evaluate(() => document.fonts.ready);
    const sprav320 = await p.evaluate(() => [...document.querySelectorAll('table')].map((t, i) => ({
      i, w: Math.round(t.clientWidth), scrollW: Math.round(t.scrollWidth), ov: Math.round(t.scrollWidth - t.clientWidth),
    })));
    if (SHOTS) {
      await p.locator('table').first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SHOTS}/gill-sprav-320.jpg`, quality: 86 });
    }
    emit('gill-spravochnik-320', { sprav320 });

    for (const route of ['/articles/myslennaya-zhizn-serdca/', '/hard-texts/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit/']) {
      await p.setViewportSize({ width: 320, height: 640 });
      await p.goto(BASE + route);
      await p.evaluate(() => document.fonts.ready);
      const splits = await p.evaluate(() => {
        const out = [];
        for (const t of document.querySelectorAll('table')) {
          for (const c of t.querySelectorAll('th, td')) {
            const r = c.getBoundingClientRect();
            if (r.width <= 4 || r.height <= 4) continue;
            const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = tw.nextNode())) {
              const re = /[А-Яа-яЁёA-Za-z]{5,}/g;
              let m;
              while ((m = re.exec(n.data))) {
                const rng = document.createRange();
                rng.setStart(n, m.index); rng.setEnd(n, m.index + m[0].length);
                const ys = new Set([...rng.getClientRects()].map((x) => Math.round(x.top / 4)));
                if (ys.size > 1) {
                  out.push({ word: m[0], lines: ys.size, cellW: Math.round(r.width) });
                  if (out.length >= 5) return out;
                }
              }
            }
          }
        }
        return out;
      });
      if (SHOTS && route.includes('myslennaya')) {
        await p.locator('table').first().scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${SHOTS}/myslennaya-320.jpg`, quality: 86 });
      }
      emit('visible-word-splits', { route, w: 320, splits });
    }

    // 4. Analytics footnotes, dialog role & reduced-motion, nagornaya .btoc-panel, hrail breakpoint
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(BASE + '/articles/20-antisovetov-pastoru/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#mobPartTocBtn').tap();
    await p.locator('#gbrMarginaliaTab').tap();
    await p.waitForTimeout(250);
    const anti = await p.evaluate(() => ({
      lead: document.querySelector('.gbr-marginalia-section, #gbrMarginalia h3, .gbr-marginalia-lead')?.textContent?.trim(),
      heads: [...document.querySelectorAll('.gbr-marginalia-group-head')].map((x) => x.textContent.trim().replace(/\s+/g, ' ')),
      domFootnotes: document.querySelectorAll('[data-tip]').length,
      dialogRole: document.querySelector('#partTocOverlay .toc-sheet')?.getAttribute('role'),
      reducedTransition: getComputedStyle(document.querySelector('#partTocOverlay .toc-sheet')).transitionDuration,
    }));

    await p.goto(BASE + '/nagornaya/chast-1/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const nag = await p.evaluate(() => ({
      btocPanel: !!document.querySelector('.btoc-panel'),
      btocLinks: document.querySelectorAll('.btoc-panel a').length,
      firstRow: document.querySelector('.btoc-panel a')?.textContent?.trim().replace(/\s+/g, ' ') || null,
    }));

    const hrail = {};
    for (const w of [1121, 1200, 1279]) {
      await p.setViewportSize({ width: w, height: 800 });
      await p.goto(BASE + '/articles/kod-da-vinchi/');
      await p.waitForTimeout(150);
      hrail[w] = await p.evaluate(() => {
        const r = document.querySelector('#hrailToc, .hrail');
        return { railVis: !!(r && getComputedStyle(r).display !== 'none' && r.getBoundingClientRect().width > 0) };
      });
    }
    emit('analytics-toc-hrail', { anti, nag, hrail });
    await ctx.close();
  }
} finally {
  await browser.close();
}
