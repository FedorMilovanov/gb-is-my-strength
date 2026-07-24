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
  { name: 'prepared-baseline' },
  {
    name: 'all-breaks-auto',
    css: '@media print {*{break-before:auto!important;break-after:auto!important;page-break-before:auto!important;page-break-after:auto!important}}',
  },
  {
    name: 'all-breaks-auto-pseudos',
    css: '@media print {*{break-before:auto!important;break-after:auto!important;page-break-before:auto!important;page-break-after:auto!important}*::before,*::after{break-before:auto!important;break-after:auto!important;page-break-before:auto!important;page-break-after:auto!important}}',
  },
  {
    name: 'no-pseudo-content',
    css: '@media print {*::before,*::after{content:none!important;display:none!important}}',
  },
  {
    name: 'page-zero-margins',
    css: '@page{size:A4;margin:0}',
  },
  {
    name: 'prefer-browser-page-size',
    pdf: { preferCSSPageSize: false },
  },
  {
    name: 'body-world-only',
    css: '@media print {body>:not(.gbs2-world):not(script):not(style):not(link){display:none!important}}',
  },
  {
    name: 'remove-after-main',
    action: 'remove-after-main',
  },
  {
    name: 'main-only',
    action: 'main-only',
  },
  {
    name: 'remove-fixed-sticky',
    action: 'remove-fixed-sticky',
  },
  {
    name: 'remove-empty-tail',
    action: 'remove-empty-tail',
  },
];

function countPages(pdfPath) {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  return Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
}

const browser = await chromium.launch();
const results = [];
try {
  for (const variant of variants) {
    const context = await browser.newContext({ viewport: { width: 1035, height: 851 } });
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

    if (variant.action) {
      await page.evaluate((action) => {
        const main = document.querySelector('main');
        if (!main) throw new Error('main missing');
        if (action === 'remove-after-main') {
          let node = main;
          while (node && node !== document.body) {
            let sibling = node.nextSibling;
            while (sibling) {
              const next = sibling.nextSibling;
              sibling.remove();
              sibling = next;
            }
            node = node.parentElement;
          }
        } else if (action === 'main-only') {
          document.body.replaceChildren(main);
        } else if (action === 'remove-fixed-sticky') {
          for (const node of [...document.body.querySelectorAll('*')]) {
            if (node === main || node.contains(main) || main.contains(node)) continue;
            const style = getComputedStyle(node);
            if (style.position === 'fixed' || style.position === 'sticky') node.remove();
          }
        } else if (action === 'remove-empty-tail') {
          const mainRect = main.getBoundingClientRect();
          for (const node of [...document.body.querySelectorAll('*')]) {
            if (node === main || node.contains(main) || main.contains(node)) continue;
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            const empty = !(node.textContent || '').trim() && !node.querySelector('img,svg,canvas,video,iframe');
            if (empty && (rect.top >= mainRect.bottom - 1 || rect.width === 0 || rect.height === 0 || style.opacity === '0' || style.visibility === 'hidden')) node.remove();
          }
        }
      }, variant.action);
    }

    if (variant.css) await page.addStyleTag({ content: variant.css });
    await page.waitForTimeout(200);

    const diagnostics = await page.evaluate(() => {
      const pick = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          tag: node.tagName,
          id: node.id || '',
          cls: String(node.className || '').slice(0, 160),
          text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          top: Math.round(rect.top * 1000) / 1000,
          bottom: Math.round(rect.bottom * 1000) / 1000,
          width: Math.round(rect.width * 1000) / 1000,
          height: Math.round(rect.height * 1000) / 1000,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          position: style.position,
          breakBefore: style.breakBefore,
          breakAfter: style.breakAfter,
          breakInside: style.breakInside,
          pageBreakBefore: style.pageBreakBefore,
          pageBreakAfter: style.pageBreakAfter,
          pageBreakInside: style.pageBreakInside,
        };
      };
      const nodes = [...document.body.querySelectorAll('*')];
      const forcedBreaks = nodes.map(pick).filter((item) =>
        item && [item.breakBefore, item.breakAfter, item.pageBreakBefore, item.pageBreakAfter]
          .some((value) => value && !['auto', 'avoid', 'avoid-page'].includes(value))
      ).slice(0, 100);
      const positioned = nodes.map(pick).filter((item) =>
        item && ['fixed', 'sticky', 'absolute'].includes(item.position) && item.display !== 'none'
      ).slice(-80);
      const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const tail = nodes.map(pick).filter((item) =>
        item && item.display !== 'none' && item.visibility !== 'hidden' && Number(item.opacity) > 0 && item.bottom >= docHeight - 1600
      ).slice(-120);
      const pseudoBreaks = [];
      for (const node of nodes) {
        for (const pseudo of ['::before', '::after']) {
          const style = getComputedStyle(node, pseudo);
          const content = style.content;
          const values = [style.breakBefore, style.breakAfter, style.pageBreakBefore, style.pageBreakAfter];
          if (content && content !== 'none' && content !== 'normal' && values.some((value) => value && value !== 'auto')) {
            pseudoBreaks.push({ host: pick(node), pseudo, content: content.slice(0, 120), breakBefore: style.breakBefore, breakAfter: style.breakAfter, pageBreakBefore: style.pageBreakBefore, pageBreakAfter: style.pageBreakAfter, display: style.display });
          }
        }
      }
      return {
        doc: document.documentElement.scrollHeight,
        body: document.body.scrollHeight,
        bodyChildren: [...document.body.children].map(pick),
        forcedBreaks,
        pseudoBreaks: pseudoBreaks.slice(0, 100),
        positioned,
        tail,
        report: window.GBPrintEngine?.getReport?.() || null,
      };
    });

    const pdfPath = join(OUT, `${variant.name}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: variant.pdf?.preferCSSPageSize ?? true,
    });
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
  forcedBreaks: diagnostics.forcedBreaks.length,
  pseudoBreaks: diagnostics.pseudoBreaks.length,
  bodyChildren: diagnostics.bodyChildren.length,
  tail: diagnostics.tail.length,
})), null, 2));
