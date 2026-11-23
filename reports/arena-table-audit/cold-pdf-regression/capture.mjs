// Diagnostic only: capture unmodified first and repeated CDP PDFs; never pre-emulate print.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:8083';
const dir = resolve(process.env.PDF_OUTPUT_DIR || '/tmp/reader-cold-pdf');
const widths = (process.env.WIDTHS || '320,390').split(',').map(Number);
const runs = Number(process.env.RUNS || '3');
if (widths.some((w) => !Number.isInteger(w) || w < 1) || !Number.isInteger(runs) || runs < 1) throw new Error('Invalid WIDTHS or RUNS');
await mkdir(dir, { recursive: true });
const executablePath = process.env.CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const results = [];
try {
  for (const width of widths) for (const method of ['direct', 'button']) for (let run = 1; run <= runs; run++) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      if (method === 'button') await page.addInitScript(() => {
        window.__printCalls = 0;
        window.print = () => { window.__printCalls++; window.dispatchEvent(new Event('beforeprint')); };
      });
      await page.goto(`${base}/articles/anatomiya-padeniya-pyat-stadiy/`, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      const initial = await page.evaluate(() => ({
        mediaPrint: matchMedia('print').matches,
        fonts: [...document.fonts].reduce((o, f) => (o[f.status] = (o[f.status] || 0) + 1, o), {}),
        mobileButton: !!document.querySelector('.reader-mobile-action--pdf'),
      }));
      if (initial.mediaPrint || !initial.mobileButton) throw new Error('Unexpected surface or print media already active');
      if (method === 'button') {
        await page.locator('.reader-mobile-action--pdf').first().click();
        await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 });
        await page.waitForTimeout(200);
      }
      const calls = method === 'button' ? await page.evaluate(() => window.__printCalls) : null;
      if (method === 'button' && calls !== 1) throw new Error(`Expected one print invocation, got ${calls}`);
      for (let copy = 1; copy <= 2; copy++) {
        const name = `${width}-${method}-${run}-${copy}.pdf`;
        await page.pdf({ path: resolve(dir, name), format: 'A4', printBackground: true });
        results.push({ width, method, run, copy, file: name, initial, calls });
      }
      console.log(`${width} ${method} #${run} captured`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
await writeFile(resolve(dir, 'manifest.json'), JSON.stringify({ base, results }, null, 2) + '\n');
console.log(`Manifest: ${dir}/manifest.json`);
