// Read-only browser regression probe. No storage mutation or Product JS injection.
// Tested Product: 02c984111c6c45358da7aad435294baa84c5153e.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || path.resolve('package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8475';
const output = process.env.OUTPUT_DIR || '/tmp/reader-gb/repro';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox']
});
const results = [];
async function settle(page) {
  await page.waitForTimeout(350); // let delayed anchor action start
  return page.evaluate(async () => {
    let last = null, equal = 0;
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const y = scrollY;
      equal = last !== null && Math.abs(y - last) < 1 ? equal + 1 : 0;
      last = y;
      if (equal >= 6) return { stable: true, y };
    }
    return { stable: false, y: scrollY };
  });
}
async function tabTo(page, selector) {
  for (let n = 0; n < 80; n++) {
    if (await page.evaluate(s => document.activeElement.matches(s), selector)) return n;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Not reached by Tab: ${selector}`);
}
async function open(page) {
  // Explicit keyboard starting point: focus native opener, activate with Enter.
  await page.locator('#mobPartTocBtn').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}
try {
  for (const viewport of [
    { width: 390, height: 844 }, { width: 568, height: 320 },
    { width: 640, height: 360 }, { width: 844, height: 390 }
  ]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true,
      serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(base + '/articles/dzhon-gill-chast-2-uchenyi/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const row = { viewport, checks: [], sections: [] };
    const check = (name, pass, details) => row.checks.push({ name, pass, details });
    check('Native mobile surface, not W57', await page.evaluate(() =>
      !document.querySelector('.np-w57-ready') &&
      getComputedStyle(document.querySelector('.mobile-top-bar')).display === 'flex'));
    // Two represented H3s and one H2: same series page, different reading sections.
    for (const id of ['sec-canticles', 'sec-ordinances', 'sec-quiz']) {
      await page.evaluate(id => scrollTo({ top: document.getElementById(id).getBoundingClientRect().top + scrollY + 200,
        behavior: 'instant' }), id);
      await settle(page);
      const before = await page.evaluate(() => ({ section: GBReaderState.getSnapshot().sectionId,
        y: scrollY, title: GBReaderState.getSnapshot().sectionTitle }));
      await open(page);
      const projection = await page.evaluate(() => ({
        currentParts: [...document.querySelectorAll('#partTocOverlay .gbat-part.cur .gbat-t')].map(e => e.textContent),
        active: [...document.querySelectorAll('#partTocOverlay a.active')].map(e => e.getAttribute('href')),
        locations: [...document.querySelectorAll('#partTocOverlay [aria-current="location"]')].map(e => e.getAttribute('href'))
      }));
      row.sections.push({ requested: id, before, projection });
      check(`Dynamic section marker matches live ${before.section}`,
        projection.active.includes('#' + before.section), projection);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check(`Escape returns opener after ${id}`, await page.evaluate(() =>
        document.activeElement.id === 'mobPartTocBtn' && document.querySelector('#partTocOverlay').getAttribute('aria-hidden') === 'true'));
    }
    await open(page);
    await page.keyboard.press('Shift+Tab');
    check('Reverse focus trap wraps to PDF', await page.locator('[data-gbat-continue] + button').evaluate(e => e === document.activeElement));
    await page.keyboard.press('Tab');
    check('Forward trap wraps to Close', await page.evaluate(() => document.activeElement.matches('#partTocOverlay .toc-sheet__handle')));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    check('Close with Enter restores opener', await page.evaluate(() => document.activeElement.id === 'mobPartTocBtn'));
    await open(page);
    await tabTo(page, '#backToSeries');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const series = await page.evaluate(() => {
      const e = document.querySelector('#seriesTocOverlay .is-current');
      return { text: e.textContent.trim(), aria: e.getAttribute('aria-current'), href: e.getAttribute('href') };
    });
    check('Current page has aria-current=page', series.aria === 'page', series);
    await tabTo(page, '#seriesTocOverlay .is-current');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    check('Enter current page reopens part dialog', await page.evaluate(() => document.querySelector('#partTocOverlay').getAttribute('aria-hidden') === 'false'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await open(page);
    await tabTo(page, 'a[href="#sec-canticles"]');
    row.focusedRow = await page.evaluate(() => {
      const e = document.activeElement, r = e.getBoundingClientRect();
      const clip = document.querySelector('#gbs2PartToc').getBoundingClientRect();
      return { rect: r.toJSON(), clip: clip.toJSON(),
        paintedHeight: Math.max(0, Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top)) };
    });
    check('Focused list row entirely visible', row.focusedRow.paintedHeight >= row.focusedRow.rect.height - 1, row.focusedRow);
    await page.screenshot({ path: `${output}/focused-${viewport.width}x${viewport.height}.png` });
    await page.keyboard.press('Enter');
    const landing = await settle(page);
    row.anchor = await page.evaluate(() => ({ hash: location.hash,
      top: document.getElementById('sec-canticles').getBoundingClientRect().top,
      focusId: document.activeElement.id, hidden: document.querySelector('#partTocOverlay').getAttribute('aria-hidden') }));
    check('Anchor lands under header', landing.stable && Math.abs(row.anchor.top - 88) < 2 && row.anchor.hidden === 'true', row.anchor);
    await page.keyboard.press('Tab');
    row.nextTab = await page.evaluate(() => ({ id: document.activeElement.id, html: document.activeElement.outerHTML.slice(0,240) }));
    check('Anchor navigation does not return focus to chrome', row.anchor.focusId !== 'mobPartTocBtn', row.nextTab);
    await open(page);
    await tabTo(page, '[data-gbat-continue]');
    row.continueRect = await page.locator('[data-gbat-continue]').boundingBox();
    check('Continue fully inside viewport', row.continueRect.y >= 0 && row.continueRect.y + row.continueRect.height <= viewport.height);
    await page.keyboard.press('Enter');
    await settle(page);
    check('Continue closes and restores opener', await page.evaluate(() => document.querySelector('#partTocOverlay').getAttribute('aria-hidden') === 'true' && document.activeElement.id === 'mobPartTocBtn'));
    results.push(row);
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
const failed = results.flatMap(r => r.checks.filter(x => !x.pass).map(x => ({ viewport: r.viewport, ...x })));
console.log(JSON.stringify({ failed, total: results.reduce((n,r) => n + r.checks.length,0) }, null, 2));
// Nonzero is intentional on the audited Product: this is a reproduction, not a green acceptance claim.
process.exitCode = failed.length ? 1 : 0;
