// Print-only CSS diagnostic, not a product patch. Serve an unmodified exact-SHA build.
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.BASE_URL || 'http://127.0.0.1:8083';
const directory = resolve(process.env.PDF_OUTPUT_DIR || '/tmp/reader-summary-auto');
const source = await readFile(process.env.HEAD_SCRIPT || '/tmp/gb-pr2352/js/reader-preferences-head.js', 'utf8');
const served = await fetch(`${base}/js/reader-preferences-head.js`);
if (!served.ok || await served.text() !== source) throw new Error('HEAD_SCRIPT does not match served bootstrap');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
try {
  for (const variant of ['baseline', 'summary-auto']) {
    const dest = resolve(directory, variant);
    await mkdir(dest, { recursive: true });
    const results = [];
    for (const width of [320, 390]) for (const method of ['direct', 'button']) for (let run = 1; run <= 3; run++) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      try {
        const page = await ctx.newPage();
        let bootstrapRequests = 0;
        page.on('requestfinished', request => { if (request.url().includes('/js/reader-preferences-head.js')) bootstrapRequests++; });
        if (method === 'button') await page.addInitScript(() => {
          window.__printCalls = 0;
          window.print = () => { window.__printCalls++; window.dispatchEvent(new Event('beforeprint')); };
        });
        await page.goto(`${base}/articles/anatomiya-padeniya-pyat-stadiy/`, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        if (variant === 'summary-auto') await page.addStyleTag({content: '@media print { html body .summary-card[data-print-flow="atomic"] { break-inside: auto !important; page-break-inside: auto !important; } }'});
        if (bootstrapRequests !== 1) throw new Error(`Expected one head bootstrap request, got ${bootstrapRequests}`);
        if (await page.evaluate(() => matchMedia('print').matches)) throw new Error('Unexpected print emulation');
        if (method === 'button') {
          await page.locator('.reader-mobile-action--pdf').first().click();
          await page.waitForFunction(() => window.__printCalls > 0);
          await page.waitForTimeout(200);
          if (await page.evaluate(() => window.__printCalls) !== 1) throw new Error('Unexpected print invocation count');
        }
        for (let copy = 1; copy <= 2; copy++) {
          const file = `${width}-${method}-${run}-${copy}.pdf`;
          await page.pdf({ path: resolve(dest, file), format: 'A4', printBackground: true });
          results.push({ width, method, run, copy, file });
        }
        console.log(`${variant} ${width} ${method} #${run}`);
      } finally { await ctx.close(); }
    }
    await writeFile(resolve(dest, 'manifest.json'), JSON.stringify({ base, variant, results }, null, 2) + '\n');
  }
} finally { await browser.close(); }
