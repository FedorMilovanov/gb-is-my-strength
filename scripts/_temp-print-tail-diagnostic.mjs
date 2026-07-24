#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'dist');
const OUT = join(process.cwd(), 'reports', 'print-tail');
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

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 } });
  await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());
  await page.goto(base + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);

  const report = await page.evaluate(() => {
    const describe = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      const before = getComputedStyle(node, '::before');
      const after = getComputedStyle(node, '::after');
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        id: node.id || '',
        cls: String(node.className || '').slice(0, 180),
        text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        top: Math.round(rect.top * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        display: style.display,
        position: style.position,
        visibility: style.visibility,
        opacity: style.opacity,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        minHeight: style.minHeight,
        heightStyle: style.height,
        overflow: style.overflow,
        overflowY: style.overflowY,
        breakBefore: style.breakBefore,
        breakAfter: style.breakAfter,
        breakInside: style.breakInside,
        pageBreakBefore: style.pageBreakBefore,
        pageBreakAfter: style.pageBreakAfter,
        pageBreakInside: style.pageBreakInside,
        beforeContent: before.content,
        beforeDisplay: before.display,
        afterContent: after.content,
        afterDisplay: after.display,
      };
    };

    const nodes = [...document.body.querySelectorAll('*')]
      .map((node) => ({ node, data: describe(node) }))
      .filter(({ data }) => data.display !== 'none' && data.visibility !== 'hidden' && data.height > 0)
      .sort((a, b) => b.data.bottom - a.data.bottom);
    const end = document.querySelector('.article-end-sdg');
    const article = document.querySelector('article.article-body, .article-body, article');
    const world = document.querySelector('.gbs2-world, [data-gill-v16]');
    const main = document.querySelector('main');
    const endData = describe(end);
    const afterEnd = endData ? nodes.filter(({ data }) => data.bottom > endData.bottom + 0.5).slice(0, 80).map(({ data }) => data) : [];

    const topLevel = [
      ...document.body.children,
      ...(main ? main.children : []),
      ...(world ? world.children : []),
      ...(article ? article.children : []),
    ].map(describe).filter(Boolean).sort((a, b) => b.bottom - a.bottom);

    return {
      html: describe(document.documentElement),
      body: describe(document.body),
      main: describe(main),
      world: describe(world),
      article: describe(article),
      end: endData,
      scroll: {
        htmlScrollHeight: document.documentElement.scrollHeight,
        bodyScrollHeight: document.body.scrollHeight,
        htmlClientHeight: document.documentElement.clientHeight,
        bodyClientHeight: document.body.clientHeight,
      },
      lastVisible: nodes.slice(0, 120).map(({ data }) => data),
      afterEnd,
      topLevel: topLevel.slice(0, 100),
    };
  });

  await writeFile(join(OUT, 'tail-report.json'), JSON.stringify(report, null, 2));
  await page.pdf({ path: join(OUT, 'tail-diagnostic.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log(JSON.stringify({ scroll: report.scroll, end: report.end, afterEndCount: report.afterEnd.length, last: report.lastVisible.slice(0, 12) }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
