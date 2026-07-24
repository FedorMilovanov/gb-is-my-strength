#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'dist');
const OUT = join(process.cwd(), 'reports', 'print-prepare-diagnostic');
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

function pageCount(pdfPath) {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  return Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1035, height: 851 } });
  const page = await context.newPage();
  await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());
  await page.goto(base + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const snapshot = async (label) => page.evaluate((phase) => {
    if (phase === 'before') {
      [...document.querySelectorAll('*')].forEach((node, index) => node.setAttribute('data-gb-print-diag', String(index)));
    }
    const pick = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        key: node.getAttribute('data-gb-print-diag'),
        tag: node.tagName,
        id: node.id || '',
        cls: String(node.className || '').slice(0, 180),
        text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        top: Math.round(rect.top * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        open: node.hasAttribute('open'),
        hidden: node.hasAttribute('hidden'),
        ariaHidden: node.getAttribute('aria-hidden'),
        contentVisibility: style.contentVisibility,
        overflow: style.overflow,
        breakBefore: style.breakBefore,
        breakAfter: style.breakAfter,
        breakInside: style.breakInside,
      };
    };
    const nodes = [...document.querySelectorAll('*')].map(pick);
    return {
      phase,
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      openDetails: document.querySelectorAll('details[open]').length,
      totalDetails: document.querySelectorAll('details').length,
      flipped: document.querySelectorAll('.flipped,.is-flipped,[aria-expanded="true"]').length,
      nodes,
      report: window.GBPrintEngine?.getReport?.() || null,
    };
  }, label);

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);
  const before = await snapshot('before');
  const beforePdf = join(OUT, 'before-prepare.pdf');
  await page.pdf({ path: beforePdf, format: 'A4', printBackground: true, preferCSSPageSize: true });

  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
  await page.click('.gbs-rail-foot [data-action="print"]');
  await page.waitForFunction(() => window.__printCalls === 1 && window.GBPrintEngine?.getReport?.(), null, { timeout: 10000 });
  await page.waitForTimeout(350);
  const preparedScreen = await snapshot('prepared-screen');
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);
  const prepared = await snapshot('prepared-print');
  const preparedPdf = join(OUT, 'prepared.pdf');
  await page.pdf({ path: preparedPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });

  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.waitForTimeout(400);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);
  const restored = await snapshot('restored-print');
  const restoredPdf = join(OUT, 'restored.pdf');
  await page.pdf({ path: restoredPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });

  const byKey = (snap) => new Map(snap.nodes.map((node) => [node.key, node]));
  const beforeMap = byKey(before);
  const preparedMap = byKey(prepared);
  const restoredMap = byKey(restored);
  const changes = [];
  for (const [key, after] of preparedMap) {
    const prior = beforeMap.get(key);
    if (!prior) continue;
    const newlyVisible = (prior.display === 'none' || prior.visibility === 'hidden' || prior.height === 0) && after.display !== 'none' && after.visibility !== 'hidden' && after.height > 0;
    const growth = after.height - prior.height;
    const stateChange = prior.open !== after.open || prior.hidden !== after.hidden || prior.ariaHidden !== after.ariaHidden || prior.display !== after.display || prior.position !== after.position;
    if (newlyVisible || growth > 4 || stateChange) {
      changes.push({ key, newlyVisible, growth: Math.round(growth * 100) / 100, before: prior, prepared: after, restored: restoredMap.get(key) || null });
    }
  }
  changes.sort((a, b) => (Number(b.newlyVisible) - Number(a.newlyVisible)) || b.growth - a.growth);

  const output = {
    pages: { before: pageCount(beforePdf), prepared: pageCount(preparedPdf), restored: pageCount(restoredPdf) },
    summary: {
      before: { docHeight: before.docHeight, openDetails: before.openDetails, totalDetails: before.totalDetails, flipped: before.flipped },
      preparedScreen: { docHeight: preparedScreen.docHeight, openDetails: preparedScreen.openDetails, totalDetails: preparedScreen.totalDetails, flipped: preparedScreen.flipped, report: preparedScreen.report },
      prepared: { docHeight: prepared.docHeight, openDetails: prepared.openDetails, totalDetails: prepared.totalDetails, flipped: prepared.flipped, report: prepared.report },
      restored: { docHeight: restored.docHeight, openDetails: restored.openDetails, totalDetails: restored.totalDetails, flipped: restored.flipped, report: restored.report },
    },
    changes: changes.slice(0, 250),
  };
  await writeFile(join(OUT, 'prepare-report.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ pages: output.pages, summary: output.summary, topChanges: output.changes.slice(0, 40) }, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
