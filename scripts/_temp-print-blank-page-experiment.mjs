#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'dist');
const OUT = join(process.cwd(), 'reports', 'print-blank-experiment');
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
  } catch {
    res.writeHead(404); res.end('nf');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const variants = [
  ['baseline', ''],
  ['break-auto', '@media print {.article-end-sdg-wrap,.article-end-sdg{break-inside:auto!important;page-break-inside:auto!important}}'],
  ['body-minus-1px', '@media print {body{margin-bottom:-1px!important}}'],
  ['world-minus-1px', '@media print {.gbs2-world{margin-bottom:-1px!important}}'],
  ['wrap-minus-1px', '@media print {.article-end-sdg-wrap{margin-bottom:-1px!important}}'],
  ['hide-signature', '@media print {.article-end-sdg-wrap{display:none!important}}'],
  ['no-svg-filter', '@media print {.article-end-sdg svg{filter:none!important;box-shadow:none!important}}'],
  ['break-auto-body-minus', '@media print {.article-end-sdg-wrap,.article-end-sdg{break-inside:auto!important;page-break-inside:auto!important}body{margin-bottom:-1px!important}}'],
  ['last-child-minus-1px', '@media print {.gbs2-world>:last-child,main>:last-child,body>:last-child{margin-bottom:-1px!important}}'],
  ['page-margin-plus-point-one', '@page{margin-bottom:17.1mm}'],
];

const browser = await chromium.launch();
const results = [];
try {
  for (const [name, css] of variants) {
    const context = await browser.newContext({ viewport: { width: 1240, height: 900 } });
    const page = await context.newPage();
    await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());
    await page.goto(base + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(250);
    const pdfPath = join(OUT, `${name}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
    const geometry = await page.evaluate(() => {
      const end = document.querySelector('.article-end-sdg');
      const wrap = document.querySelector('.article-end-sdg-wrap');
      const pick = (node) => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        return { top:r.top,bottom:r.bottom,height:r.height,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,breakInside:s.breakInside,display:s.display };
      };
      return { doc:document.documentElement.scrollHeight, body:document.body.scrollHeight, end:pick(end), wrap:pick(wrap) };
    });
    execFileSync('pdftoppm', ['-f', String(pages), '-singlefile', '-png', '-r', '72', pdfPath, join(OUT, `${name}-last`)]);
    results.push({ name, pages, geometry });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
