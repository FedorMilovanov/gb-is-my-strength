#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'dist');
const OUT = join(process.cwd(), 'reports', 'print-prepared-blank-experiment');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
await mkdir(OUT, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    let file = join(DIST, pathname);
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const variants = [
  ['prepared-baseline', ''],
  ['break-auto', '@media print {.article-end-sdg-wrap,.article-end-sdg{break-inside:auto!important;page-break-inside:auto!important}}'],
  ['body-minus-1px', '@media print {body{margin-bottom:-1px!important}}'],
  ['body-minus-4px', '@media print {body{margin-bottom:-4px!important}}'],
  ['world-minus-4px', '@media print {.gbs2-world{margin-bottom:-4px!important}}'],
  ['wrap-minus-4px', '@media print {.article-end-sdg-wrap{margin-bottom:-4px!important}}'],
  ['hide-signature', '@media print {.article-end-sdg-wrap{display:none!important}}'],
  ['no-svg-filter', '@media print {.article-end-sdg svg{filter:none!important;box-shadow:none!important}}'],
  ['page-bottom-16-9', '@page{size:A4;margin:15mm 14mm 16.9mm}'],
  ['page-bottom-16-5', '@page{size:A4;margin:15mm 14mm 16.5mm}'],
  ['page-all-14-9-14-16-9', '@page{size:A4;margin:14.9mm 14mm 16.9mm}'],
  ['zoom-9999', '@media print {html{zoom:.9999}}'],
  ['zoom-999', '@media print {html{zoom:.999}}'],
  ['images-230mm', '@media print {figure img,.article-img img,.article-figure img,.article-hero img,.gbs2-hero img{max-height:230mm!important}}'],
  ['body-before-none', '@media print {body::before{display:none!important;content:none!important;margin:0!important;padding:0!important}}'],
];

function countPages(pdfPath) {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  return Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
}

const browser = await chromium.launch();
const results = [];
try {
  for (const [name, css] of variants) {
    const context = await browser.newContext({ viewport: { width: 1035, height: 851 } });
    const page = await context.newPage();
    await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());
    await page.goto(base + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
    await page.click('.gbs-rail-foot [data-action="print"]');
    await page.waitForFunction(() => window.__printCalls === 1 && window.GBPrintEngine?.getReport?.(), null, { timeout: 12000 });
    await page.waitForTimeout(300);
    await page.emulateMedia({ media: 'print' });
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(200);

    const pdfPath = join(OUT, `${name}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = countPages(pdfPath);
    execFileSync('pdftoppm', ['-f', String(pages), '-singlefile', '-png', '-r', '72', pdfPath, join(OUT, `${name}-last`)]);
    const geometry = await page.evaluate(() => {
      const end = document.querySelector('.article-end-sdg');
      const wrap = document.querySelector('.article-end-sdg-wrap');
      const pick = (node) => {
        if (!node) return null;
        const r = node.getBoundingClientRect(); const s = getComputedStyle(node);
        return { top:r.top,bottom:r.bottom,height:r.height,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,breakInside:s.breakInside,display:s.display };
      };
      return {
        doc: document.documentElement.scrollHeight,
        body: document.body.scrollHeight,
        pageSize: getComputedStyle(document.documentElement).getPropertyValue('--unused'),
        end: pick(end), wrap: pick(wrap),
        report: window.GBPrintEngine?.getReport?.() || null,
      };
    });
    results.push({ name, pages, geometry });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
