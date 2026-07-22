#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../dist/', import.meta.url).pathname;
const evidenceDir = process.env.EVIDENCE_DIR || '';
const port = Number(process.env.PORT || 4179);
const origin = `http://127.0.0.1:${port}`;

if (!existsSync(root)) {
  console.error('dist/ is missing; run the production-like build first');
  process.exit(1);
}

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const expectedLocalhostIconUrls = [
  'https://gospod-bog.ru/apple-touch-icon.png',
  'https://gospod-bog.ru/icons/icon-192.png',
];

function isExpectedLocalhostIconCsp(message) {
  return (
    message.includes('Content Security Policy') &&
    expectedLocalhostIconUrls.some((url) => message.includes(url))
  );
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', origin);
  const decoded = decodeURIComponent(url.pathname);
  const safe = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  let file = join(root, safe);
  if (file.endsWith('/')) file = join(file, 'index.html');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const failures = [];
const routes = [
  { path: '/nagornaya/chast-4/', expected: 2, slug: 'part-4' },
  { path: '/nagornaya/chast-5/', expected: 1, slug: 'part-5' },
];
const viewports = [
  { width: 320, height: 760, name: '320' },
  { width: 390, height: 844, name: '390' },
  { width: 1440, height: 900, name: '1440' },
];

try {
  if (evidenceDir) await mkdir(evidenceDir, { recursive: true });

  for (const route of routes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('console', (message) => {
        const text = message.text();
        if (message.type() === 'error' && !isExpectedLocalhostIconCsp(text)) pageErrors.push(text);
      });

      const response = await page.goto(`${origin}${route.path}`, { waitUntil: 'networkidle' });
      if (!response?.ok()) failures.push(`${route.path} ${viewport.name}: HTTP ${response?.status()}`);

      const result = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('[data-nagornaya-claim-comparison]')];
        const rootScroller = document.scrollingElement;
        return {
          count: blocks.length,
          overflow: rootScroller ? rootScroller.scrollWidth - rootScroller.clientWidth : 0,
          blocks: blocks.map((block) => {
            const alt = [...block.querySelectorAll('h4')].find((node) => node.textContent?.includes('Альтернатива'));
            const position = [...block.querySelectorAll('h4')].find((node) => node.textContent?.includes('Позиция серии'));
            return {
              visible: Boolean(block.getClientRects().length),
              labelled: Boolean(block.getAttribute('aria-labelledby') && document.getElementById(block.getAttribute('aria-labelledby'))),
              activeSteps: block.querySelectorAll('[aria-current="step"]').length,
              alternativeBeforePosition: Boolean(alt && position && (alt.compareDocumentPosition(position) & Node.DOCUMENT_POSITION_FOLLOWING)),
              forbiddenVerdictGlyph: /[✓✗]/.test(block.textContent || ''),
              widthOverflow: block.scrollWidth - block.clientWidth,
            };
          }),
        };
      });

      if (result.count !== route.expected) failures.push(`${route.path} ${viewport.name}: expected ${route.expected} blocks, found ${result.count}`);
      if (result.overflow > 1) failures.push(`${route.path} ${viewport.name}: root overflow ${result.overflow}px`);
      for (const [index, block] of result.blocks.entries()) {
        if (!block.visible) failures.push(`${route.path} ${viewport.name} block ${index}: not visible`);
        if (!block.labelled) failures.push(`${route.path} ${viewport.name} block ${index}: broken aria-labelledby`);
        if (block.activeSteps !== 1) failures.push(`${route.path} ${viewport.name} block ${index}: expected one active epistemic step`);
        if (!block.alternativeBeforePosition) failures.push(`${route.path} ${viewport.name} block ${index}: alternative is not before series position`);
        if (block.forbiddenVerdictGlyph) failures.push(`${route.path} ${viewport.name} block ${index}: answer-key glyph found`);
        if (block.widthOverflow > 1) failures.push(`${route.path} ${viewport.name} block ${index}: internal overflow ${block.widthOverflow}px`);
      }
      if (pageErrors.length) failures.push(`${route.path} ${viewport.name}: ${pageErrors.join(' | ')}`);

      await page.evaluate(() => document.documentElement.setAttribute('data-reader-theme', 'sepia'));
      const sepiaOverflow = await page.evaluate(() => {
        const rootScroller = document.scrollingElement;
        return rootScroller ? rootScroller.scrollWidth - rootScroller.clientWidth : 0;
      });
      if (sepiaOverflow > 1) failures.push(`${route.path} ${viewport.name}: sepia overflow ${sepiaOverflow}px`);

      if (evidenceDir && (viewport.name === '390' || viewport.name === '1440')) {
        await page.screenshot({
          path: join(evidenceDir, `after-${route.slug}-${viewport.name}.png`),
          fullPage: true,
        });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) {
  console.error('Nagornaya neutral comparison browser test FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Nagornaya neutral comparison browser test PASS');
console.log('- 2 Part IV and 1 Part V registry/projection blocks');
console.log('- 320/390/1440 overflow, reduced motion, Sepia, ARIA and DOM order verified');
