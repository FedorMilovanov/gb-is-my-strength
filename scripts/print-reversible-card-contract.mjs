#!/usr/bin/env node
/**
 * Physical paged-media proof for reversible cards.
 *
 * The universal print CSS owns all reversible-card families. This focused
 * fixture prints the real Gill card twice (front and flipped back), places
 * non-layout markers inside the active face, and proves through pdftotext that
 * each active face remains wholly on one sheet. Separate clean PDFs and card
 * screenshots are emitted for raster and visual review.
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
const OUT = join(ROOT, process.env.GB_PRINT_REVERSIBLE_CARD_ARTIFACT_DIR || 'reports/print-reversible-card-contract');
const ROUTE = '/articles/dzhon-gill-chast-1-chelovek/';
const CARD_SELECTOR = '.flip-card,.heart-flip-card,.error-flip-card';
const FACE_SELECTOR = '.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2' };

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(req.url.split('?')[0]);
      let file = join(DIST, pathname);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(ROOT, pathname); }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function tokenPage(text, token) {
  const pages = text.split('\f');
  const index = pages.findIndex((page) => page.includes(token));
  return index < 0 ? 0 : index + 1;
}

await mkdir(OUT, { recursive: true });
const { server, base } = await serve();
const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
const report = { route: ROUTE, modes: [], failures: [] };

try {
  const context = await browser.newContext({ viewport: { width: 1240, height: 900 } });
  const page = await context.newPage();
  await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());
  await page.goto(base + ROUTE, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

  const cardCount = await page.locator(CARD_SELECTOR).count();
  if (cardCount !== 1) report.failures.push(`expected one reversible-card fixture, found ${cardCount}`);

  for (const mode of [
    { name: 'front', flipped: false },
    { name: 'back', flipped: true },
  ]) {
    const startToken = `GBCARD_${mode.name.toUpperCase()}_S`;
    const endToken = `GBCARD_${mode.name.toUpperCase()}_E`;
    const snapshot = await page.evaluate(({ cardSelector, faceSelector, flipped, startToken, endToken }) => {
      document.getElementById('gb-card-print-audit-style')?.remove();
      document.querySelectorAll('.gb-card-print-audit-marker').forEach((node) => node.remove());
      document.querySelectorAll('.gb-card-print-audit-host').forEach((node) => node.classList.remove('gb-card-print-audit-host'));

      const card = document.querySelector(cardSelector);
      if (!card) return { error: 'reversible-card fixture missing' };
      card.classList.toggle('flipped', flipped);

      // page.pdf() dispatches afterprint and the production runtime correctly
      // removes generated flow attributes. Every independent print job must
      // therefore prepare the current DOM state again before measuring it.
      const prepared = window.GBPrintPagination?.prepare?.() || null;
      if (!prepared?.prepared) return { error: 'GBPrintPagination did not prepare current card state' };

      const faces = [...card.querySelectorAll(faceSelector)].map((face) => {
        const style = getComputedStyle(face);
        const rect = face.getBoundingClientRect();
        return { face, style, rect };
      });
      const active = faces.filter(({ style, rect }) => style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 8 && rect.height > 4);
      if (active.length !== 1) return { error: `expected one active face, found ${active.length}` };

      const activeFace = active[0].face;
      const activeStyle = active[0].style;
      activeFace.classList.add('gb-card-print-audit-host');
      const style = document.createElement('style');
      style.id = 'gb-card-print-audit-style';
      style.textContent = `@media print {
        .gb-card-print-audit-host { position: relative !important; }
        .gb-card-print-audit-marker {
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
          color: #fff !important;
          background: transparent !important;
          text-shadow: none !important;
          pointer-events: none !important;
        }
        .gb-card-print-audit-marker--start { top: 1px !important; }
        .gb-card-print-audit-marker--end { bottom: 1px !important; }
      }`;
      document.head.appendChild(style);

      const marker = (token, kind) => {
        const node = document.createElement('span');
        node.className = `gb-card-print-audit-marker gb-card-print-audit-marker--${kind}`;
        node.setAttribute('aria-hidden', 'true');
        node.textContent = token;
        return node;
      };
      activeFace.prepend(marker(startToken, 'start'));
      activeFace.append(marker(endToken, 'end'));

      const cardStyle = getComputedStyle(card);
      const inner = card.querySelector('.flip-card-inner,.heart-flip-inner,.error-flip-inner');
      const innerStyle = inner ? getComputedStyle(inner) : null;
      return {
        flipped: card.classList.contains('flipped'),
        cardClass: typeof card.className === 'string' ? card.className : '',
        activeFaceClass: typeof activeFace.className === 'string' ? activeFace.className : '',
        activeFaceText: String(activeFace.textContent || '').replace(/\s+/g, ' ').trim().replace(/GBCARD_[A-Z_]+/g, '').slice(0, 180),
        cardFlow: card.getAttribute('data-print-flow') || '',
        cardBreakInside: cardStyle.breakInside,
        cardHeight: Math.round(card.getBoundingClientRect().height),
        innerPosition: innerStyle?.position || '',
        innerTransform: innerStyle?.transform || '',
        facePosition: activeStyle.position,
        faceTransform: activeStyle.transform,
      };
    }, { cardSelector: CARD_SELECTOR, faceSelector: FACE_SELECTOR, flipped: mode.flipped, startToken, endToken });

    if (snapshot.error) {
      report.failures.push(`${mode.name}: ${snapshot.error}`);
      continue;
    }
    if (snapshot.flipped !== mode.flipped) report.failures.push(`${mode.name}: root flipped state mismatch`);
    if (snapshot.cardFlow !== 'atomic' || !String(snapshot.cardBreakInside).includes('avoid')) report.failures.push(`${mode.name}: card root is not atomic`);
    if (snapshot.innerPosition !== 'static' || snapshot.innerTransform !== 'none') report.failures.push(`${mode.name}: card inner remains in 3D flow`);
    if (['absolute', 'fixed', 'sticky'].includes(snapshot.facePosition) || snapshot.faceTransform !== 'none') report.failures.push(`${mode.name}: active face remains positioned/transformed`);
    if (!snapshot.activeFaceText) report.failures.push(`${mode.name}: active face has no printable text`);

    const pdf = join(OUT, `${mode.name}.pdf`);
    const txt = join(OUT, `${mode.name}.txt`);
    const screenshot = join(OUT, `${mode.name}.png`);
    await page.locator(CARD_SELECTOR).screenshot({ path: screenshot });
    await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
    execFileSync('pdftotext', ['-layout', pdf, txt]);
    const text = await readFile(txt, 'utf8');
    const startPage = tokenPage(text, startToken);
    const endPage = tokenPage(text, endToken);
    if (!startPage || !endPage) report.failures.push(`${mode.name}: active-face PDF markers missing (${startPage}/${endPage})`);
    else if (startPage !== endPage) report.failures.push(`${mode.name}: active face split across pages (${startPage}/${endPage})`);

    report.modes.push({
      ...snapshot,
      startPage,
      endPage,
      pdf: `${mode.name}.pdf`,
      screenshot: `${mode.name}.png`,
    });
  }

  await context.close();
} finally {
  await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
