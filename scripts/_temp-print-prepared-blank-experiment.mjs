#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'dist');
const OUT = join(process.cwd(), 'reports', 'print-prepared-blank-experiment');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2', '.jpg':'image/jpeg', '.jpeg':'image/jpeg' };
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
    res.writeHead(404);
    res.end('nf');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const variants = [
  { name: 'a4-baseline' },
  { name: 'body-reset', css: '@media print {html,body{margin:0!important;padding:0!important;min-height:0!important;height:auto!important}}' },
  { name: 'all-shells-reset', css: '@media print {html,body,.gbs2-world,.gbs2-scope,[data-gill-v16],[data-reader-root],main,article,.article-body{margin-bottom:0!important;padding-bottom:0!important;min-height:0!important;height:auto!important}}' },
  { name: 'world-main-only', action: 'world-main-only' },
  { name: 'world-display-contents', css: '@media print {.gbs2-world{display:contents!important}}' },
  { name: 'page-14-14', css: '@page{size:A4;margin:14mm}' },
  { name: 'page-12-14-14', css: '@page{size:A4;margin:12mm 14mm 14mm}' },
  { name: 'page-12-14-12', css: '@page{size:A4;margin:12mm 14mm}' },
  { name: 'page-10-14-12', css: '@page{size:A4;margin:10mm 14mm 12mm}' },
  { name: 'compact-media', css: '@media print {figure,.article-img,.article-figure,.article-hero,.gbs2-hero{margin:4mm 0!important}.article-end-sdg{margin-top:6mm!important}}' },
];

function countPages(pdfPath) {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  return Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
}

const browser = await chromium.launch();
const results = [];
try {
  for (const variant of variants) {
    const context = await browser.newContext({ viewport: { width: 794, height: 1123 } });
    const page = await context.newPage();
    await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());
    await page.goto(base + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.print = () => {
        window.__printCalls = (window.__printCalls || 0) + 1;
      };
    });
    await page.click('.gbs-rail-foot [data-action="print"]');
    await page.waitForFunction(() => window.__printCalls === 1 && window.GBPrintEngine?.getReport?.(), null, { timeout: 12000 });
    await page.waitForTimeout(300);
    await page.emulateMedia({ media: 'print' });

    if (variant.action === 'world-main-only') {
      await page.evaluate(() => {
        const world = document.querySelector('.gbs2-world');
        const main = world?.querySelector('main');
        if (!world || !main) throw new Error('world/main missing');
        for (const child of [...world.children]) {
          if (child !== main && !child.contains(main)) child.remove();
        }
      });
    }
    if (variant.css) await page.addStyleTag({ content: variant.css });
    await page.waitForTimeout(200);

    const diagnostics = await page.evaluate(() => {
      const describe = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          tag: node.tagName,
          id: node.id || '',
          cls: String(node.className || '').slice(0, 160),
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          display: style.display,
          position: style.position,
          margin: style.margin,
          padding: style.padding,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          overflow: style.overflow,
          breakBefore: style.breakBefore,
          breakAfter: style.breakAfter,
          breakInside: style.breakInside,
        };
      };
      const main = document.querySelector('main');
      const world = document.querySelector('.gbs2-world');
      const ancestors = [];
      for (let node = main; node; node = node.parentElement) ancestors.push(describe(node));
      const mainChildren = main ? [...main.children].map(describe) : [];
      const worldChildren = world ? [...world.children].map(describe) : [];
      return {
        viewport: { width: innerWidth, height: innerHeight },
        doc: document.documentElement.scrollHeight,
        body: document.body.scrollHeight,
        htmlStyle: describe(document.documentElement),
        bodyStyle: describe(document.body),
        ancestors,
        worldChildren,
        mainChildren,
        report: window.GBPrintEngine?.getReport?.() || null,
      };
    });

    const pdfPath = join(OUT, `${variant.name}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = countPages(pdfPath);
    execFileSync('pdftoppm', ['-f', String(pages), '-singlefile', '-png', '-r', '72', pdfPath, join(OUT, `${variant.name}-last`)]);
    results.push({ name: variant.name, pages, diagnostics });
    await writeFile(join(OUT, `${variant.name}-diagnostics.json`), JSON.stringify(diagnostics, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ name, pages, diagnostics }) => ({
  name,
  pages,
  doc: diagnostics.doc,
  body: diagnostics.body,
  bodyPadding: diagnostics.bodyStyle?.padding,
  bodyMinHeight: diagnostics.bodyStyle?.minHeight,
  worldChildren: diagnostics.worldChildren.length,
  mainChildren: diagnostics.mainChildren.length,
})), null, 2));
