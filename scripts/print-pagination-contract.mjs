#!/usr/bin/env node
/**
 * Multi-route PDF pagination contract.
 *
 * The browser runtime classifies semantic components, then this audit places
 * non-layout marker nodes at the start/end of every top-level atomic component
 * and around every keep-with-next pair. Marker PDFs prove pagination through
 * pdftotext; separate clean PDFs are emitted for raster and visual inspection
 * so diagnostic markers can never create false trailing pages.
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
const MARKERS = join(OUT, 'markers');
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
await mkdir(MARKERS, { recursive: true });
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
    await page.evaluate(() => {
      const root = document.querySelector('[data-reader-range], [data-reader-root] article.article-body, [data-gill-v16] article.article-body, article.article-body, article[data-pagefind-body], main article, article');
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const target = absoluteTop + Math.min(Math.max(rect.height * 0.32, 500), Math.max(500, rect.height - window.innerHeight));
      window.scrollTo(0, Math.max(0, target));
    });
    await page.waitForTimeout(120);
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
      const visible = (node) => {
        if (!node || !node.getBoundingClientRect) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 8 && rect.height > 4;
      };
      const after = (node, reference) => {
        if (!node || !reference || node === reference || node.contains(reference) || reference.contains(node)) return false;
        return !!(reference.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
      };
      const allAtomic = [...scope.querySelectorAll('[data-print-flow="atomic"]')].filter((node) => {
        const parent = node.parentElement?.closest('[data-print-flow="atomic"]');
        return !parent && visible(node);
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

      function hosts(node) {
        if (node.matches?.('.gb-print-closing-group')) {
          return { start: node.firstElementChild || node, end: node.lastElementChild || node };
        }
        if (node.matches?.('table')) {
          const cells = [...node.querySelectorAll('th,td')];
          if (cells.length) return { start: cells[0], end: cells[cells.length - 1] };
        }
        return { start: node, end: node };
      }

      function attach(node, token, kind) {
        const pair = hosts(node);
        const host = kind === 'start' ? pair.start : pair.end;
        host.classList.add('gb-print-audit-host');
        if (kind === 'start') host.prepend(marker(token, kind));
        else host.append(marker(token, kind));
      }

      const atomic = allAtomic.map((node, index) => {
        const base = `GBP_R${routeIndex}_A${index}`;
        node.setAttribute('data-gb-audit-id', base);
        attach(node, `${base}_S`, 'start');
        attach(node, `${base}_E`, 'end');
        const rect = node.getBoundingClientRect();
        return {
          id: base,
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className.slice(0, 120) : '',
          text: String(node.textContent || '').replace(/\s+/g, ' ').trim().replace(/GBP_R\d+_[AK]\d+_[SE]/g, '').slice(0, 120),
          height: Math.round(rect.height),
          breakInside: getComputedStyle(node).breakInside
        };
      });

      function nextVisibleSibling(node) {
        let next = node.nextElementSibling;
        while (next && !visible(next)) next = next.nextElementSibling;
        return next;
      }

      function firstFollowingTail(node) {
        return [...scope.querySelectorAll('[data-print-tail]')].find((candidate) => visible(candidate) && after(candidate, node)) || null;
      }

      const keeperNodes = [...scope.querySelectorAll('[data-print-keep-next]')].filter(visible);
      const keepers = [];
      for (let index = 0; index < keeperNodes.length; index += 1) {
        const node = keeperNodes[index];
        let target = nextVisibleSibling(node);
        if (!target && node.getAttribute('data-print-keep-next') === 'tail') target = firstFollowingTail(node);
        if (!target) continue;
        const base = `GBP_R${routeIndex}_K${index}`;
        attach(node, `${base}_S`, 'end');
        attach(target, `${base}_E`, 'start');
        keepers.push({
          id: base,
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className.slice(0, 100) : '',
          text: String(node.textContent || '').replace(/\s+/g, ' ').trim().replace(/GBP_R\d+_[AK]\d+_[SE]/g, '').slice(0, 100),
          targetTag: target.tagName.toLowerCase(),
          targetClassName: typeof target.className === 'string' ? target.className.slice(0, 100) : '',
          targetText: String(target.textContent || '').replace(/\s+/g, ' ').trim().replace(/GBP_R\d+_[AK]\d+_[SE]/g, '').slice(0, 100),
          breakAfter: getComputedStyle(node).breakAfter
        });
      }
      const bodyBefore = getComputedStyle(document.body, '::before');
      const printBranding = {
        content: bodyBefore.content,
        display: bodyBefore.display,
        position: bodyBefore.position,
        borderBottomWidth: bodyBefore.borderBottomWidth,
        height: bodyBefore.height
      };
      const progressChrome = [...document.querySelectorAll('#reading-progress,.h-reading-progress')].map((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          selector: node.id ? '#' + node.id : '.' + [...node.classList].join('.'),
          display: style.display,
          visibility: style.visibility,
          position: style.position,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          opacity: style.opacity
        };
      });
      const flipCards = [...scope.querySelectorAll('.flip-card,.heart-flip-card,.error-flip-card')].filter(visible).map((node) => {
        const inner = node.querySelector('.flip-card-inner,.heart-flip-inner,.error-flip-inner');
        const faces = [...node.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')];
        const snapshot = () => {
          const innerState = inner ? getComputedStyle(inner) : null;
          const faceStates = faces.map((face) => {
            const style = getComputedStyle(face);
            const rect = face.getBoundingClientRect();
            return {
              className: typeof face.className === 'string' ? face.className.slice(0, 120) : '',
              display: style.display,
              visibility: style.visibility,
              position: style.position,
              transform: style.transform,
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          });
          return {
            flipped: node.classList.contains('flipped'),
            innerPosition: innerState?.position || '',
            innerTransform: innerState?.transform || '',
            visibleFaces: faceStates.filter((face) => face.display !== 'none' && face.visibility !== 'hidden' && face.width > 8 && face.height > 4),
            faces: faceStates
          };
        };
        const initial = snapshot();
        const wasFlipped = node.classList.contains('flipped');
        node.classList.toggle('flipped', !wasFlipped);
        const toggled = snapshot();
        node.classList.toggle('flipped', wasFlipped);
        const style = getComputedStyle(node);
        return {
          className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',
          flow: node.getAttribute('data-print-flow') || '',
          breakInside: style.breakInside,
          height: Math.round(node.getBoundingClientRect().height),
          initial,
          toggled
        };
      });
      return { runtime, atomic, keepers, printBranding, progressChrome, flipCards };
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
    const brandingContent = String(setup.printBranding?.content || '');
    if (!brandingContent.includes('ГОСПОДЬ БОГ') || setup.printBranding?.display === 'none' || setup.printBranding?.position !== 'static') {
      report.failures.push(`${id}: legitimate print branding was lost: ${JSON.stringify(setup.printBranding)}`);
    }
    const visibleProgress = (setup.progressChrome || []).filter((item) => item.display !== 'none' && item.visibility !== 'hidden' && item.opacity !== '0' && item.width > 0 && item.height > 0);
    if (visibleProgress.length) report.failures.push(`${id}: screen progress chrome remains printable: ${JSON.stringify(visibleProgress)}`);
    if (id === 'gill-part1' && !(setup.flipCards || []).length) report.failures.push(`${id}: reversible-card fixture missing`);
    const badCards = (setup.flipCards || []).filter((item) => {
      const modes = [item.initial, item.toggled];
      return item.flow !== 'atomic'
        || !String(item.breakInside).includes('avoid')
        || modes.some((mode) => mode.innerPosition !== 'static'
          || mode.innerTransform !== 'none'
          || mode.visibleFaces.length !== 1
          || mode.visibleFaces[0].position !== 'static'
          || mode.visibleFaces[0].transform !== 'none');
    });
    if (badCards.length) report.failures.push(`${id}: reversible-card print flow is not atomic/single-face: ${JSON.stringify(badCards.slice(0, 4))}`);

    const markerPdf = join(MARKERS, `${id}.pdf`);
    const markerTxt = join(MARKERS, `${id}.txt`);
    await page.pdf({ path: markerPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
    execFileSync('pdftotext', ['-layout', markerPdf, markerTxt]);
    const pages = pageMap(await readFile(markerTxt, 'utf8'));
    const atomicSplits = [];
    const atomicMissing = [];
    for (const item of setup.atomic) {
      const start = pages.get(`${item.id}_S`);
      const end = pages.get(`${item.id}_E`);
      if (!start || !end) atomicMissing.push({ ...item, start: start || 0, end: end || 0 });
      else if (start !== end) atomicSplits.push({ ...item, start, end });
    }
    const pairSplits = [];
    const pairMissing = [];
    for (const item of setup.keepers) {
      const source = pages.get(`${item.id}_S`);
      const target = pages.get(`${item.id}_E`);
      if (!source || !target) pairMissing.push({ ...item, source: source || 0, target: target || 0 });
      else if (source !== target) pairSplits.push({ ...item, source, target });
    }
    if (atomicMissing.length) report.failures.push(`${id}: ${atomicMissing.length} atomic PDF markers missing`);
    if (atomicSplits.length) report.failures.push(`${id}: ${atomicSplits.length} atomic components split across pages`);
    if (pairMissing.length) report.failures.push(`${id}: ${pairMissing.length} keep-pair PDF markers missing`);
    if (pairSplits.length) report.failures.push(`${id}: ${pairSplits.length} keep-with-next pairs split across pages`);

    await page.evaluate(() => {
      document.querySelectorAll('.gb-print-audit-marker').forEach((node) => node.remove());
      document.querySelectorAll('[data-gb-audit-id]').forEach((node) => node.removeAttribute('data-gb-audit-id'));
      document.querySelectorAll('.gb-print-audit-host').forEach((node) => node.classList.remove('gb-print-audit-host'));
      document.getElementById('gb-print-pagination-audit-markers')?.remove();
    });
    const cleanPdf = join(OUT, `${id}.pdf`);
    await page.pdf({ path: cleanPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });

    report.routes.push({
      id, url,
      runtime: setup.runtime,
      atomicCount: setup.atomic.length,
      keepNextCount: setup.keepers.length,
      printBranding: setup.printBranding,
      progressChrome: setup.progressChrome,
      flipCards: setup.flipCards,
      markerPdf: `markers/${id}.pdf`,
      cleanPdf: `${id}.pdf`,
      atomicMissing: atomicMissing.slice(0, 12),
      atomicSplits: atomicSplits.slice(0, 12),
      pairMissing: pairMissing.slice(0, 12),
      pairSplits: pairSplits.slice(0, 12)
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
