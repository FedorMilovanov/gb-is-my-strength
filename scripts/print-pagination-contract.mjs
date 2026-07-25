#!/usr/bin/env node
/**
 * Multi-route PDF pagination contract.
 *
 * The browser runtime classifies semantic components, then this audit places
 * non-layout marker nodes at the start/end of each top-level atomic component,
 * prints real A4 PDFs and verifies with pdftotext that no atomic component was
 * fragmented across sheets. The route matrix spans series, book and single
 * article engines; assertions are component-based rather than route-specific.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, process.env.GB_PRINT_PAGINATION_ARTIFACT_DIR || 'reports/print-pagination-contract');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2' };
const ROUTES = [
  ['gill-part1', '/articles/dzhon-gill-chast-1-chelovek/'],
  ['gill-part2', '/articles/dzhon-gill-chast-2-uchenyi/'],
  ['heart-book', '/articles/novoe-serdce/'],
  ['baptist-series', '/baptisty-rossii/podpolnaya-pechat/'],
  ['single-article', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/']
];

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

function pageMap(text) {
  const map = new Map();
  text.split('\f').forEach((page, index) => {
    for (const match of page.matchAll(/GBP_[A-Z0-9_]+/g)) map.set(match[0], index + 1);
  });
  return map;
}

await mkdir(OUT, { recursive: true });
const { server, base } = await serve();
const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
const report = { routes: [], failures: [] };
try {
  for (let routeIndex = 0; routeIndex < ROUTES.length; routeIndex += 1) {
    const [id, url] = ROUTES[routeIndex];
    const context = await browser.newContext({ viewport: { width: 1240, height: 900 } });
    const page = await context.newPage();
    await page.route(/gospod-bog\.ru|mc\.yandex/, (r) => r.abort());
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
    await page.waitForTimeout(250);

    const setup = await page.evaluate((routeIndex) => {
      const api = window.GBPrintPagination;
      if (!api || api.version !== 1) return { error: 'GBPrintPagination v1 missing' };
      const runtime = api.prepare();
      const root = document.querySelector('[data-reader-range], [data-reader-root] article.article-body, [data-gill-v16] article.article-body, article.article-body, article[data-pagefind-body], main article, article');
      if (!root) return { error: 'reader root missing', runtime };
      const scope = root.parentElement || document.body;
      const allAtomic = [...scope.querySelectorAll('[data-print-flow="atomic"]')].filter((node) => {
        const parent = node.parentElement?.closest('[data-print-flow="atomic"]');
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return !parent && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 8 && rect.height > 4;
      });
      const markerStyle = document.createElement('style');
      markerStyle.id = 'gb-print-pagination-audit-markers';
      markerStyle.textContent = `@media print {
        [data-gb-audit-id], .gb-print-audit-host { position: relative !important; }
        .gb-print-audit-marker {
          position: absolute !important;
          left: 1px !important;
          z-index: 2147483647 !important;
          display: block !important;
          width: auto !important;
          height: 4px !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          overflow: visible !important;
          white-space: nowrap !important;
          font: 4px/4px monospace !important;
          letter-spacing: 0 !important;
          color: #fff !important;
          background: transparent !important;
          text-shadow: none !important;
          pointer-events: none !important;
        }
        .gb-print-audit-marker--start { top: 1px !important; }
        .gb-print-audit-marker--end { bottom: 1px !important; }
      }`;
      document.head.appendChild(markerStyle);

      function marker(text, kind) {
        const span = document.createElement('span');
        span.className = `gb-print-audit-marker gb-print-audit-marker--${kind}`;
        span.setAttribute('aria-hidden', 'true');
        span.textContent = text;
        return span;
      }

      const atomic = allAtomic.map((node, index) => {
        const base = `GBP_R${routeIndex}_A${index}`;
        node.setAttribute('data-gb-audit-id', base);
        let startHost = node;
        let endHost = node;
        if (node.matches('table')) {
          const cells = [...node.querySelectorAll('th,td')];
          if (cells.length) {
            startHost = cells[0];
            endHost = cells[cells.length - 1];
          }
        }
        startHost.classList.add('gb-print-audit-host');
        endHost.classList.add('gb-print-audit-host');
        startHost.prepend(marker(`${base}_S`, 'start'));
        endHost.append(marker(`${base}_E`, 'end'));
        const rect = node.getBoundingClientRect();
        return {
          id: base,
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className.slice(0, 120) : '',
          text: String(node.textContent || '').replace(/\s+/g, ' ').trim().replace(/GBP_R\d+_A\d+_[SE]/g, '').slice(0, 120),
          height: Math.round(rect.height),
          breakInside: getComputedStyle(node).breakInside
        };
      });
      const keepers = [...scope.querySelectorAll('[data-print-keep-next]')].filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).map((node) => ({
        tag: node.tagName.toLowerCase(),
        className: typeof node.className === 'string' ? node.className.slice(0, 100) : '',
        text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        breakAfter: getComputedStyle(node).breakAfter
      }));
      return { runtime, atomic, keepers };
    }, routeIndex);

    if (setup.error) {
      report.failures.push(`${id}: ${setup.error}`);
      report.routes.push({ id, url, setup });
      await context.close();
      continue;
    }
    if (!setup.atomic.length) report.failures.push(`${id}: runtime classified no atomic components`);
    const badComputed = setup.atomic.filter((item) => !String(item.breakInside).includes('avoid'));
    if (badComputed.length) report.failures.push(`${id}: atomic computed style is not avoid-page: ${JSON.stringify(badComputed.slice(0, 4))}`);
    const badKeep = setup.keepers.filter((item) => !String(item.breakAfter).includes('avoid'));
    if (badKeep.length) report.failures.push(`${id}: keep-with-next computed style is not avoid-page: ${JSON.stringify(badKeep.slice(0, 4))}`);

    const pdf = join(OUT, `${id}.pdf`);
    const txt = join(OUT, `${id}.txt`);
    await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
    execFileSync('pdftotext', ['-layout', pdf, txt]);
    const pages = pageMap(await readFile(txt, 'utf8'));
    const splits = [];
    const missing = [];
    for (const item of setup.atomic) {
      const start = pages.get(`${item.id}_S`);
      const end = pages.get(`${item.id}_E`);
      if (!start || !end) missing.push({ ...item, start: start || 0, end: end || 0 });
      else if (start !== end) splits.push({ ...item, start, end });
    }
    if (missing.length) report.failures.push(`${id}: ${missing.length} PDF markers missing`);
    if (splits.length) report.failures.push(`${id}: ${splits.length} atomic components split across pages`);
    report.routes.push({
      id, url,
      runtime: setup.runtime,
      atomicCount: setup.atomic.length,
      keepNextCount: setup.keepers.length,
      missing: missing.slice(0, 12),
      splits: splits.slice(0, 12)
    });
    await context.close();
  }
} finally {
  await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
