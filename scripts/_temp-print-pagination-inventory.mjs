#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'reports', 'print-pagination-inventory');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2' };

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(req.url.split('?')[0]);
      let file = join(DIST, pathname);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(ROOT, pathname); }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const ROUTES = [
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-4-ekzeget/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/novoe-serdce/',
  '/baptisty-rossii/podpolnaya-pechat/',
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'
];

const ANCHORS = [
  '1716, ноябрь',
  'Первое толкование',
  'Элизабет Гилл',
  'КАРТА СЕРИИ',
  'SOLI DEO GLORIA'
];

await mkdir(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await chromium.launch();
const report = [];
try {
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 1240, height: 900 } });
    const page = await context.newPage();
    await page.route(/gospod-bog\.ru|mc\.yandex/, (r) => r.abort());
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(350);
    const data = await page.evaluate((anchors) => {
      const root = document.querySelector('[data-reader-range], [data-reader-root] article.article-body, [data-gill-v16] article.article-body, article.article-body, article[data-pagefind-body], main article, article');
      const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const descriptor = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: typeof el.className === 'string' ? el.className : '',
          text: norm(el.textContent).slice(0, 150),
          display: cs.display,
          position: cs.position,
          breakInside: cs.breakInside,
          breakBefore: cs.breakBefore,
          breakAfter: cs.breakAfter,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          childCount: el.children.length,
          hasTable: !!el.querySelector('table'),
          hasGrid: cs.display.includes('grid') || !!el.querySelector('.grid, [class*="grid"]')
        };
      };
      const anchorResults = anchors.map((anchor) => {
        const matches = [...document.querySelectorAll(root ? '*' : 'body *')].filter((el) => norm(el.textContent).includes(anchor));
        const target = matches.sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0] || null;
        const chain = [];
        let node = target;
        while (node && node !== root?.parentElement && chain.length < 9) {
          chain.push(descriptor(node));
          if (node === root) break;
          node = node.parentElement;
        }
        return { anchor, chain };
      });
      const directChildren = root ? [...root.children].map(descriptor) : [];
      const candidates = root ? [...root.querySelectorAll('table, figure, blockquote, pre, details, [class*="timeline"], [class*="chronolog"], [class*="milestone"], [class*="event"], [class*="roadmap"], [class*="series"], [class*="map"], [class*="diagram"], [class*="note"], [class*="info"], [class*="warn"], [class*="quote"], [class*="summary"], [class*="callout"], [class*="fact"], [class*="source"], [class*="author"], [class*="sdg"]')]
        .map(descriptor)
        .filter((item) => item && item.height > 12)
        .slice(0, 250) : [];
      return { route: location.pathname, root: descriptor(root), anchorResults, directChildren, candidates };
    }, ANCHORS);
    report.push(data);
    const safe = route.replace(/^\/+|\/+$/g, '').replaceAll('/', '__') || 'root';
    await page.screenshot({ path: join(OUT, `${safe}.png`), fullPage: true });
    await context.close();
  }
  await writeFile(join(OUT, 'inventory.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
