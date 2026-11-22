const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.READER_URL || 'http://127.0.0.1:19078';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const emit = (name, data) => console.log(JSON.stringify({ name, ...data }));

try {
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'ru-RU' });
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    await p.goto(BASE + '/articles/dzhon-gill-chast-2-uchenyi/');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);

    const before = await p.evaluate(() => {
      const box = (sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r ? { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) } : null;
      };
      return { spdBadge: box('#mobSpdBadge'), spdChip: box('.reader-mobile-speed-chip'), play: box('.reader-mobile-play') };
    });

    await p.locator('#mobSpdBadge').tap();
    await p.waitForTimeout(200);
    const speedrail = await p.evaluate(() => {
      const rail = document.querySelector('#mobileSpeedrail');
      const r = rail.getBoundingClientRect();
      return {
        railW: Math.round(r.width),
        railScrollW: Math.round(rail.scrollWidth),
        railOverflow: Math.round(rail.scrollWidth - rail.clientWidth),
        btns: [...rail.querySelectorAll('button')].map((b) => ({
          text: b.textContent.trim(),
          left: Math.round(b.getBoundingClientRect().left),
          right: Math.round(b.getBoundingClientRect().right),
        })),
      };
    });

    await p.locator('#mobPartTocBtn').tap();
    await p.waitForTimeout(200);
    const toc = await p.evaluate(() => ({
      romanNums: [...document.querySelectorAll('#partTocOverlay .gbat-num:not(.gbat-num--label)')].map((n) => ({
        text: n.textContent.trim(),
        fontSize: getComputedStyle(n).fontSize,
        fontStyle: getComputedStyle(n).fontStyle,
      })),
      reducedTransition: getComputedStyle(document.querySelector('#partTocOverlay .toc-sheet')).transitionDuration,
    }));

    await p.goto(BASE + '/articles/dzhon-gill-istoricheskiy-kontekst/');
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#mobPartTocBtn').tap();
    await p.waitForTimeout(200);
    const frontmatter = await p.evaluate(() => ({
      frontmatterFooter: !!document.querySelector('#partTocOverlay .gbat-foot--frontmatter'),
      listenBtns: document.querySelectorAll('#partTocOverlay .gbat-fbtn--listen').length,
      dotsVisible: [...document.querySelectorAll('#partTocOverlay .gbat-part--label .gbat-dot')].filter((d) => getComputedStyle(d).display !== 'none').length,
    }));

    emit('w99-gill-mobile', { w, h, before, speedrail, toc, frontmatter });
    await ctx.close();
  }
} finally {
  await browser.close();
}
