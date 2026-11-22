import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

async function ctxPage(w = 390, h = 844, isMobile = true) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    isMobile,
    hasTouch: isMobile,
    reducedMotion: 'reduce',
    locale: 'ru-RU',
    acceptDownloads: true,
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(7000);
  p.setDefaultNavigationTimeout(20000);
  return { ctx, p };
}

function lum([r, g, b]) {
  return [r, g, b].reduce((acc, c, i) => {
    const v = c / 255;
    const lin = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return acc + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
function contrast(fg, bg) {
  const parse = (s) => (s.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  const a = lum(parse(fg)), b = lum(parse(bg));
  return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
}

try {
  // 1. Note same-page source jump + exact-quote note linking
  for (const w of [320, 390]) {
    const { ctx, p } = await ctxPage(w, 844, true);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForSelector('#gb-hl-fab.visible');
    const selectOcc = async (last) => {
      await p.evaluate((last) => {
        const el = document.getElementById('gill-search-p-033');
        const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.data.includes('Песнь Песней'));
        const off = last ? n.data.lastIndexOf('Песнь Песней') : n.data.indexOf('Песнь Песней');
        const r = document.createRange(); r.setStart(n, off); r.setEnd(n, off + 12);
        window.scrollBy({ top: r.getBoundingClientRect().top - innerHeight * 0.52, behavior: 'instant' });
      }, last);
      await p.waitForTimeout(200);
      await p.evaluate((last) => {
        const el = document.getElementById('gill-search-p-033');
        const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.data.includes('Песнь Песней'));
        const off = last ? n.data.lastIndexOf('Песнь Песней') : n.data.indexOf('Песнь Песней');
        const r = document.createRange(); r.setStart(n, off); r.setEnd(n, off + 12);
        getSelection().removeAllRanges(); getSelection().addRange(r);
      }, last);
      await p.locator('#gb-hl-selbar[data-open=true]').waitFor();
    };
    await selectOcc(false);
    await p.locator('#gb-hl-selbar-quote').tap();
    await selectOcc(true);
    await p.locator('#gb-hl-selbar-note').tap();
    await p.locator('#gb-hl-note-text').fill('Заметка ко второй Песни');
    await p.locator('#gb-hl-editor [type=submit]').tap();
    await p.waitForTimeout(250);
    const saved = await p.evaluate(() => ({
      quotes: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').map((q) => ({ id: q.id, before: q.before?.slice(-20) })),
      notes: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').map((n) => ({ id: n.id, quoteId: n.quoteId || null, quoteText: n.quoteText })),
    }));
    await p.locator('[data-library-tab="note"]').tap();
    const noteLink = p.locator('#gb-hl-list .gb-hl-item[data-type="note"] .gb-hl-meta a[href]').first();
    const href = await noteLink.getAttribute('href');
    await noteLink.tap();
    await p.waitForTimeout(350);
    const afterNoteJump = await p.evaluate(() => ({
      y: Math.round(scrollY),
      hash: location.hash,
      locked: document.body.style.position === 'fixed',
      panelHidden: document.getElementById('gb-hl-backdrop')?.hidden,
    }));
    emit('note-samepage-and-link', { w, saved, href, afterNoteJump });
    await ctx.close();
  }

  // 2. Bilingual quote occurrences on Gill III
  {
    const { ctx, p } = await ctxPage(390, 844, true);
    await p.goto(BASE + '/articles/dzhon-gill-chast-4-ekzeget/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForSelector('#gb-hl-fab.visible');
    const word = await p.evaluate(() => {
      const ru = document.querySelector('.manuscript-quote--bilingual .mq-translation-russian');
      const n = document.createTreeWalker(ru, NodeFilter.SHOW_TEXT).nextNode();
      const w = n.data.trim().split(/\s+/).slice(0, 2).join(' ');
      const off = n.data.indexOf(w);
      const r = document.createRange(); r.setStart(n, off); r.setEnd(n, off + w.length);
      window.scrollBy({ top: r.getBoundingClientRect().top - innerHeight * 0.5, behavior: 'instant' });
      return w;
    });
    await p.waitForTimeout(200);
    await p.evaluate((word) => {
      const ru = document.querySelector('.manuscript-quote--bilingual .mq-translation-russian');
      const n = document.createTreeWalker(ru, NodeFilter.SHOW_TEXT).nextNode();
      const off = n.data.indexOf(word);
      const r = document.createRange(); r.setStart(n, off); r.setEnd(n, off + word.length);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    }, word);
    await p.locator('#gb-hl-selbar[data-open=true]').waitFor();
    await p.locator('[data-hl-color=rose]').tap();
    await p.waitForTimeout(250);
    const paintedBefore = await p.evaluate(() => [...CSS.highlights].flatMap(([, v]) => [...v]).map((r) => r.toString()));
    const toggle = p.locator('.manuscript-quote--bilingual .mq-translation-toggle').first();
    await toggle.tap();
    await p.waitForTimeout(250);
    const paintedFlipped = await p.evaluate(() => [...CSS.highlights].flatMap(([, v]) => [...v]).map((r) => r.toString()));
    const enWord = await p.evaluate(() => {
      const en = document.querySelector('.manuscript-quote--bilingual .mq-translation-original');
      const n = document.createTreeWalker(en, NodeFilter.SHOW_TEXT).nextNode();
      const w = n.data.trim().split(/\s+/).slice(0, 2).join(' ');
      const off = n.data.indexOf(w);
      const r = document.createRange(); r.setStart(n, off); r.setEnd(n, off + w.length);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      return w;
    });
    await p.locator('#gb-hl-selbar[data-open=true]').waitFor();
    await p.locator('#gb-hl-selbar-quote').tap();
    await p.waitForTimeout(250);
    await toggle.tap();
    await p.waitForTimeout(250);
    const paintedRestored = await p.evaluate(() => [...CSS.highlights].flatMap(([, v]) => [...v]).map((r) => r.toString()));
    await p.locator('#gb-hl-fab').tap();
    await p.locator('[data-library-tab="quote"]').tap();
    await p.locator('#gb-hl-list .gb-hl-item[data-type="quote"] .gb-hl-meta a[href]').first().tap();
    await p.waitForTimeout(350);
    const afterJumpToEn = await p.evaluate(() => ({
      y: Math.round(scrollY),
      locked: document.body.style.position === 'fixed',
      detailsOpen: document.querySelector('.manuscript-quote--bilingual .mq-translation-flip')?.open,
      status: document.querySelector('#gb-hl-toast')?.textContent?.trim() || null,
    }));
    emit('bilingual-quote', { word, enWord, paintedBefore, paintedFlipped, paintedRestored, afterJumpToEn });
    await ctx.close();
  }

  // 3. ARGON live mobile analytics marks + 390 tab-return clip + 740x360 landscape clip
  {
    const { ctx, p } = await ctxPage(390, 844, true);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/#part-controversy');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForSelector('#gb-hl-fab.visible');
    await p.locator('#mobPartTocBtn').tap();
    await p.locator('#gbrMarginaliaTab').tap();
    await p.waitForTimeout(250);
    const beforeHeads = await p.evaluate(() => [...document.querySelectorAll('.gbr-marginalia-group-head')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      const el = document.getElementById('gill-search-p-037');
      const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.data.trim().length > 20);
      const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, 18);
      window.scrollBy({ top: r.getBoundingClientRect().top - innerHeight * 0.5, behavior: 'instant' });
    });
    await p.waitForTimeout(200);
    await p.evaluate(() => {
      const el = document.getElementById('gill-search-p-037');
      const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.data.trim().length > 20);
      const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, 18);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    });
    await p.locator('#gb-hl-selbar[data-open=true]').waitFor();
    await p.locator('[data-hl-color=rose]').tap();
    await p.waitForTimeout(250);
    await p.locator('#mobPartTocBtn').tap();
    await p.locator('#gbrMarginaliaTab').tap();
    await p.waitForTimeout(300);
    const afterHeads = await p.evaluate(() => [...document.querySelectorAll('.gbr-marginalia-group-head')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')));
    await p.locator('.gbr-marginalia-group-head').filter({ hasText: 'Писание' }).tap();
    await p.waitForTimeout(250);
    await p.locator('.gbr-scripture-ref').last().tap();
    await p.waitForTimeout(200);
    await p.locator('#gbrTocTab').tap();
    await p.waitForTimeout(150);
    await p.locator('#gbrMarginaliaTab').tap();
    await p.waitForTimeout(250);
    const lastAfterTab390 = await p.evaluate(() => {
      const rail = document.querySelector('.gbr-scripture-rail');
      const rb = rail.getBoundingClientRect();
      const chip = document.querySelector('.gbr-scripture-ref[aria-pressed="true"]');
      const cr = chip.getBoundingClientRect();
      return { label: chip.textContent.trim(), chipW: Math.round(cr.width), visW: Math.round(Math.min(rb.right, cr.right) - Math.max(rb.left, cr.left)) };
    });
    await p.setViewportSize({ width: 740, height: 360 });
    await p.waitForTimeout(300);
    const landscapeRail = await p.evaluate(() => {
      const rail = document.querySelector('.gbr-scripture-rail');
      const rb = rail.getBoundingClientRect();
      const chips = [...document.querySelectorAll('.gbr-scripture-ref')];
      const clipped = chips.map((c) => {
        const cr = c.getBoundingClientRect();
        const vis = Math.round(Math.max(0, Math.min(rb.right, cr.right) - Math.max(rb.left, cr.left)));
        return { label: c.textContent.trim(), w: Math.round(cr.width), vis };
      }).filter((x) => x.vis > 0 && x.vis < x.w);
      return { sheetH: Math.round(document.querySelector('#partTocOverlay .toc-sheet').getBoundingClientRect().height), railW: Math.round(rb.width), scrollW: rail.scrollWidth, clipped };
    });
    emit('argon-live-and-clip', { beforeHeads, afterHeads, lastAfterTab390, landscapeRail });
    await ctx.close();
  }

  // 4. Library export (.md), >20 tags import guard, orphan topic reconciliation
  {
    const { ctx, p } = await ctxPage(320, 568, true);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForSelector('#gb-hl-fab.visible');
    await p.locator('#gb-hl-fab').tap();
    await p.locator('#gb-hl-new-note').tap();
    await p.locator('#gb-hl-note-text').fill('Заметка для экспорта и темы');
    await p.locator('#gb-hl-editor [type=submit]').tap();
    await p.waitForTimeout(250);
    const [dl] = await Promise.all([
      p.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      p.locator('#gb-hl-export').tap(),
    ]);
    const exportFile = dl?.suggestedFilename() || null;
    await p.locator('[data-research-action="edit-tag"]').first().tap();
    await p.waitForTimeout(150);
    await p.locator('#gb-hl-tag-input').fill('РедкаяТема');
    await p.locator('#gb-hl-tag-input').press('Enter');
    await p.waitForTimeout(250);
    const topicBtn = p.locator('[data-research-action="topic"]').filter({ hasText: 'РедкаяТема' }).first();
    const hasTopic = await topicBtn.isVisible().catch(() => false);
    if (hasTopic) await topicBtn.tap();
    await p.waitForTimeout(200);
    await p.locator('[data-library-action="delete"]').first().tap();
    await p.waitForTimeout(250);
    const afterOrphanDelete = await p.evaluate(() => ({
      items: document.querySelectorAll('#gb-hl-list .gb-hl-item').length,
      emptyTitle: document.querySelector('.gb-hl-empty-title')?.textContent?.trim() || null,
      topics: [...document.querySelectorAll('[data-research-action="topic"]')].map((x) => x.textContent.trim()),
    }));
    await p.locator('#gb-hl-manage').tap();
    const over20 = Buffer.from(JSON.stringify({
      format: 'gospod-bog-reader-library', version: 3,
      data: {
        quotes: [], favorites: [],
        notes: [{ id: 'n1', text: 'Note 1', url: '/articles/dzhon-gill-chast-2-uchenyi/' }],
        tags: { 'note:n1': Array.from({ length: 21 }, (_, i) => `Тег${i + 1}`) },
      },
    }));
    const chooser = p.waitForEvent('filechooser');
    await p.locator('[data-research-action="import-json"]').tap();
    await (await chooser).setFiles({ name: 'over20.json', mimeType: 'application/json', buffer: over20 });
    await p.waitForTimeout(300);
    const importOver20Status = await p.locator('#gb-hl-status').innerText().catch(() => '');
    const notesAfterRejected = await p.evaluate(() => localStorage.getItem('gb-reader-notes-v1'));
    emit('library-export-tags-orphan', { exportFile, hasTopic, afterOrphanDelete, importOver20Status, notesAfterRejected });
    await ctx.close();
  }

  // 5. Dark / Sepia theme contrast & non-.article-body route & TOC selection guard
  for (const [route, theme] of [
    ['/articles/dzhon-gill-chast-2-uchenyi/', 'dark'],
    ['/articles/dzhon-gill-chast-2-uchenyi/', 'sepia'],
    ['/articles/podrostok-za-kadrom-dvoynaya-zhizn/', 'dark'],
  ]) {
    const { ctx, p } = await ctxPage(320, 568, true);
    await p.goto(BASE + route);
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate((t) => {
      if (window.applyGillReaderTheme) window.applyGillReaderTheme(t);
      else if (window.GBReaderPreferences?.setTheme) window.GBReaderPreferences.setTheme(t);
      else document.documentElement.classList.toggle('dark', t === 'dark');
    }, theme);
    await p.waitForTimeout(250);
    let tocSelOpen = null;
    if (route.includes('dzhon-gill') && theme === 'dark') {
      await p.locator('#mobPartTocBtn').tap();
      await p.waitForTimeout(250);
      await p.evaluate(() => {
        const el = document.querySelector('#partTocOverlay .toc-sheet__body a, #partTocOverlay h3');
        if (!el?.firstChild) return;
        const r = document.createRange(); r.selectNodeContents(el);
        getSelection().removeAllRanges(); getSelection().addRange(r);
      });
      await p.waitForTimeout(300);
      tocSelOpen = await p.locator('#gb-hl-selbar[data-open=true]').isVisible().catch(() => false);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
    await p.locator('#gb-hl-fab').tap();
    await p.waitForTimeout(250);
    const themeCheck = await p.evaluate(() => {
      const panel = document.querySelector('#gb-hl-panel');
      const btn = document.querySelector('#gb-hl-new-note');
      const cur = document.querySelector('.gb-hl-current');
      const csPanel = panel ? getComputedStyle(panel) : null;
      const csBtn = btn ? getComputedStyle(btn) : null;
      const csCur = cur ? getComputedStyle(cur) : null;
      return {
        hasArticleBody: !!document.querySelector('article.article-body'),
        panelBg: csPanel?.backgroundColor,
        btnFg: csBtn?.color, btnBg: csBtn?.backgroundColor,
        curBg: csCur?.backgroundColor, curFg: csCur?.color,
      };
    });
    emit('theme-library-check', {
      route, theme, tocSelOpen, ...themeCheck,
      btnContrast: contrast(themeCheck.btnFg, themeCheck.btnBg),
      curContrast: contrast(themeCheck.curFg, themeCheck.curBg),
    });
    await ctx.close();
  }

  // 6. Wave 3 spot-check on exact 6f12c171
  {
    const { ctx, p } = await ctxPage(320, 568, true);
    await p.goto(BASE + '/baptisty-rossii/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(350);
    const floaterVisible = await p.evaluate(() => {
      const fl = document.querySelector('.gb-floater');
      return !!(fl && getComputedStyle(fl).display !== 'none' && fl.getBoundingClientRect().height > 0);
    });
    await p.locator('#gbs2Bbar').tap();
    await p.waitForTimeout(250);
    const sheet62 = await p.evaluate(() => {
      const row = document.querySelector('#gbs2Sheet .gbs2-sheet-part');
      const span = row?.querySelector('span');
      return row ? { cols: getComputedStyle(row).gridTemplateColumns, spanW: Math.round(span?.getBoundingClientRect().width || 0), text: span?.textContent?.trim().slice(0, 40) } : null;
    });
    emit('wave3-baptisty', { floaterVisible, sheet62 });
    await ctx.close();
  }
  {
    const { ctx, p } = await ctxPage(568, 320, true);
    await p.goto(BASE + '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#hrailMobBtn, .hrail-mob-btn, [aria-controls="hmSheet"]').first().tap();
    await p.waitForTimeout(250);
    const hm = await p.evaluate(() => {
      const list = document.querySelector('#hmSheetList');
      const save = document.querySelector('.hmsheet-action-btn.gb-save');
      return {
        listH: list ? Math.round(list.getBoundingClientRect().height) : null,
        saveText: save?.textContent?.trim(),
        saveAfter: save ? getComputedStyle(save, '::after').content : null,
      };
    });
    emit('wave3-hermenevtika', hm);
    await ctx.close();
  }
  {
    const { ctx, p } = await ctxPage(320, 568, true);
    await p.goto(BASE + '/');
    await p.evaluate(() => document.fonts.ready);
    const nav = await p.evaluate(() => {
      const logo = document.querySelector('.h-nav-logo');
      return logo ? { text: logo.textContent.trim(), w: Math.round(logo.clientWidth), scrollW: Math.round(logo.scrollWidth) } : null;
    });
    emit('wave3-home', nav);
    await ctx.close();
  }
} finally {
  await browser.close();
}
