// Diagnostic request-only CSS, never a product patch.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.BASE_URL || 'http://127.0.0.1:8083';
const output = resolve(process.env.PDF_OUTPUT_DIR || '/tmp/a77-break-probe');
const runs = Number(process.env.RUNS || 2);
if (!Number.isInteger(runs) || runs < 1) throw new Error('RUNS must be a positive integer');
const selector = 'html body .summary-card[data-print-flow="atomic"]';
const css = (rules) => `@media print {${selector}{${rules}}}`;
const before = 'break-before:page!important;page-break-before:always!important;';
const after = 'break-after:page!important;page-break-after:always!important;';
const auto = 'break-inside:auto!important;page-break-inside:auto!important;';
const variants = {
  baseline: '', before: css(before), after: css(after), both: css(before + after),
  cardgap: css('margin-bottom:20mm!important;'), auto: css(auto),
  autoBefore: css(auto + before), autoAfter: css(auto + after), autoBoth: css(auto + before + after),
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
const entries = [];
try {
  for (const width of [320, 390]) for (const [variant, style] of Object.entries(variants)) for (let run = 1; run <= runs; run++) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    try {
      const page = await ctx.newPage();
      await page.goto(`${base}/articles/anatomiya-padeniya-pyat-stadiy/`, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      if (style) await page.addStyleTag({ content: style });
      if (await page.evaluate(() => matchMedia('print').matches)) throw new Error('Print was prematurely emulated');
      for (let copy = 1; copy <= 2; copy++) {
        const name = `${width}-${variant}-${run}-${copy}.pdf`;
        await page.pdf({ path: resolve(output, name), format: 'A4', printBackground: true });
        entries.push({ width, variant, run, copy, name });
      }
      console.log(width, variant, run);
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ base, entries }, null, 2) + '\n');
