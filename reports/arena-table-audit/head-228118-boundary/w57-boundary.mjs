// Narrow independent boundary probe; this is not the full W57 visual QA contract.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const base = process.env.W57_BASE_URL || 'http://127.0.0.1:19061';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
const results = [];
try {
  for (const width of [390, 1120, 1121, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${base}/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space`, { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      const state = await page.evaluate(() => ({
        w57: document.body.classList.contains('np-w57-ready'),
        annotations: !!window.__NP_W57_ANNOTATIONS__?.ready,
        notes: document.querySelectorAll('#npW57NotesDetails').length,
        pilotScripts: [...document.scripts].filter(s => /\/__reader_w57__\/(?:reader_w57|reader_universal_preview)\.js/.test(s.src)).map(s => s.src.split('/').pop()),
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        controls: Object.fromEntries([['toc', '#mobPartTocBtn'], ['settings', '#mobSettingsBtn'], ['play', '.reader-mobile-play'], ['speed', '#mobSpdBadge']].map(([name, selector]) => [name, !!document.querySelector(selector)?.getClientRects().length])),
      }));
      const row = { width, status: response?.status(), ...state, errors };
      assert.equal(row.status, 200);
      assert.equal(row.viewport, width);
      assert.equal(row.scrollWidth, width);
      if (width < 1121) {
        assert.equal(row.w57, false); assert.equal(row.annotations, false); assert.equal(row.notes, 0); assert.equal(row.pilotScripts.length, 0);
        assert.ok(Object.values(row.controls).every(Boolean));
        await page.locator('#mobPartTocBtn').click();
        await page.locator('#partTocOverlay[aria-hidden="false"]').waitFor({ state: 'visible', timeout: 6000 }); row.tocOpened = true;
        await page.keyboard.press('Escape');
        await page.locator('#partTocOverlay[aria-hidden="false"]').waitFor({ state: 'hidden', timeout: 6000 });
        await page.locator('#mobSettingsBtn').click();
        await page.locator('#gillSettingsOverlay[aria-hidden="false"]').waitFor({ state: 'visible', timeout: 6000 }); row.settingsOpened = true;
        await page.keyboard.press('Escape');
        await page.locator('#gillSettingsOverlay[aria-hidden="false"]').waitFor({ state: 'hidden', timeout: 6000 });
        const point = await page.locator('#mobSpdBadge').evaluate(el => {
          const r = el.getBoundingClientRect();
          for (let iy = 1; iy <= 4; iy++) for (let ix = 1; ix <= 4; ix++) {
            const x = r.left + r.width * ix / 5, y = r.top + r.height * iy / 5;
            if (el.contains(document.elementFromPoint(x, y))) return { x, y };
          }
          return null;
        });
        assert.ok(point, 'No exposed speed badge point'); row.speedPoint = point;
        await page.mouse.click(point.x, point.y);
        await page.locator('#mobSpdBadge[aria-expanded="true"]').waitFor({ state: 'visible', timeout: 4000 }); row.speedOpened = true;
        await page.keyboard.press('Escape');
        row.playCenterHit = await page.locator('.reader-mobile-play').evaluate(el => {
          const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        });
        assert.equal(row.playCenterHit, true);
      } else {
        assert.equal(row.w57, true); assert.equal(row.annotations, true); assert.equal(row.notes, 1);
        assert.ok(row.pilotScripts.includes('reader_w57.js') && row.pilotScripts.includes('reader_universal_preview.js'));
      }
      assert.deepEqual(errors, []);
      results.push(row); console.log(JSON.stringify(row));
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
await writeFile(process.env.OUTPUT || '/tmp/228-w57-boundary-verified.json', JSON.stringify(results, null, 2) + '\n');
