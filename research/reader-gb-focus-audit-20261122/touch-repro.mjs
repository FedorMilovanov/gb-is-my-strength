// Supplementary native mobile landscape touch reachability; no resize/storage manipulation.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || path.resolve('package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8476';
const output = process.env.OUTPUT_DIR || '/tmp/reader-gb-touch';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox']
});
const results = [];
try {
  for (const viewport of [{ width:568, height:320 }, { width:640, height:360 }, { width:844, height:390 }]) {
    const context = await browser.newContext({ viewport, isMobile:true, hasTouch:true,
      reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    await page.goto(base + '/articles/dzhon-gill-chast-2-uchenyi/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.locator('#mobPartTocBtn').tap();
    await page.waitForTimeout(500);
    const snapshot = () => page.evaluate(() => {
      const e = document.querySelector('#gbs2PartToc'), r = e.getBoundingClientRect();
      return { rect:r.toJSON(), scrollTop:e.scrollTop, max:e.scrollHeight-e.clientHeight,
        open:document.querySelector('#partTocOverlay').getAttribute('aria-hidden') === 'false' };
    });
    const before = await snapshot();
    const cdp = await context.newCDPSession(page);
    const x = viewport.width * .72, y = before.rect.y + before.rect.height/2;
    await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x,y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x,y:y-i*10 }] });
      await page.waitForTimeout(30);
    }
    await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    await page.waitForTimeout(700);
    const after = await snapshot();
    await page.screenshot({ path:`${output}/touch-${viewport.width}.png` });
    await page.locator('#partTocOverlay .toc-sheet__handle').tap();
    await page.waitForTimeout(450);
    const state = () => page.evaluate(() => ({
      hidden:document.querySelector('#partTocOverlay').getAttribute('aria-hidden'), focus:document.activeElement.id
    }));
    const close = await state();
    await page.locator('#mobPartTocBtn').tap();
    await page.waitForTimeout(450);
    await page.locator('[data-gbat-continue]').tap();
    await page.waitForTimeout(800);
    const continued = await state();
    results.push({ viewport,before,after,close,continued });
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(`${output}/touch.json`, JSON.stringify(results,null,2));
const pass = results.every(r => r.before.max > 0 && r.after.scrollTop > r.before.scrollTop &&
  r.after.open && r.close.hidden === 'true' && r.continued.hidden === 'true');
console.log(JSON.stringify({ pass,results },null,2));
process.exitCode = pass ? 0 : 1;
