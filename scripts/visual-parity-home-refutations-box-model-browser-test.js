#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'visual-parity', 'home-refutations-box-model');
const REPORT_FILE = path.join(REPORT_DIR, 'report.json');
const SITE_CSS = fs.readFileSync(path.join(ROOT, 'css', 'site.css'), 'utf8');
const VISUAL_WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'visual-parity.yml'), 'utf8');
const DEPLOY_WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const SCRIPT_COMMAND = 'node scripts/visual-parity-home-refutations-box-model-browser-test.js';

fs.mkdirSync(REPORT_DIR, { recursive: true });
assert.match(SITE_CSS, /\*,::after,::before\{box-sizing:border-box\}/, 'global border-box owner is missing from css/site.css');
assert.ok(VISUAL_WORKFLOW.includes(SCRIPT_COMMAND), 'Visual Parity workflow must execute the Refutations box-model browser contract');
assert.ok(DEPLOY_WORKFLOW.includes(SCRIPT_COMMAND), 'immutable release readiness must execute the Refutations box-model browser contract');

function contentType(filePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'dist/index.html is missing — build the production-like candidate first');
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      try {
        let requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
        if (requestPath.endsWith('/')) requestPath += 'index.html';
        const filePath = path.resolve(DIST, `.${requestPath}`);
        const insideDist = filePath === DIST || filePath.startsWith(`${DIST}${path.sep}`);
        if (!insideDist) {
          response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('not found');
          return;
        }
        response.writeHead(200, {
          'content-type': contentType(filePath),
          'cache-control': 'no-store',
        });
        fs.createReadStream(filePath).pipe(response);
      } catch (error) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        response.end(String(error));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      origin: `http://127.0.0.1:${server.address().port}`,
    }));
  });
}

async function inspectViewport(browser, origin, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  const section = page.locator('#razbor');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  const cards = await page.locator('#razbor .h-refutation-card').evaluateAll((elements) => elements.map((card) => {
    const shell = card.closest('.h-refutation-shell');
    const cardStyle = getComputedStyle(card);
    const cardRect = card.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect() || null;
    return {
      href: card.getAttribute('href'),
      boxSizing: cardStyle.boxSizing,
      display: cardStyle.display,
      visibility: cardStyle.visibility,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      shellWidth: shellRect?.width ?? null,
      shellHeight: shellRect?.height ?? null,
      hasShell: Boolean(shell),
    };
  }));
  const pageGeometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  const screenshot = path.join(REPORT_DIR, `${viewport.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  assert.equal(cards.length, 2, `${viewport.name}: expected exactly two canonical Refutations cards, got ${cards.length}`);
  assert.deepEqual(runtimeErrors, [], `${viewport.name}: runtime errors: ${runtimeErrors.join('\n')}`);
  assert.ok(pageGeometry.scrollWidth <= pageGeometry.viewportWidth, `${viewport.name}: horizontal overflow ${pageGeometry.scrollWidth} > ${pageGeometry.viewportWidth}`);
  for (const card of cards) {
    assert.equal(card.hasShell, true, `${viewport.name}: ${card.href} lost its Refutations shell`);
    assert.equal(card.boxSizing, 'border-box', `${viewport.name}: ${card.href} computed box-sizing is ${card.boxSizing}`);
    assert.notEqual(card.display, 'none', `${viewport.name}: ${card.href} is display:none`);
    assert.notEqual(card.visibility, 'hidden', `${viewport.name}: ${card.href} is hidden`);
    assert.ok(card.cardWidth > 0 && card.cardHeight > 0, `${viewport.name}: ${card.href} has zero geometry`);
    assert.ok(Math.abs(card.cardWidth - card.shellWidth) <= 1, `${viewport.name}: ${card.href} width ${card.cardWidth} differs from shell ${card.shellWidth}`);
    assert.ok(Math.abs(card.cardHeight - card.shellHeight) <= 1, `${viewport.name}: ${card.href} height ${card.cardHeight} differs from shell ${card.shellHeight}`);
  }

  return {
    viewport,
    cards,
    pageGeometry,
    runtimeErrors,
    screenshot: path.relative(ROOT, screenshot),
  };
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    origin,
    status: 'running',
    viewports: [],
  };
  try {
    for (const viewport of [
      { name: 'desktop-1440', width: 1440, height: 1000, mobile: false },
      { name: 'mobile-390', width: 390, height: 844, mobile: true },
    ]) {
      report.viewports.push(await inspectViewport(browser, origin, viewport));
    }
    report.status = 'pass';
    console.log('Home Refutations box-model browser contract: PASS (desktop and mobile).');
  } catch (error) {
    report.status = 'failure';
    report.failure = {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack || '',
    };
    throw error;
  } finally {
    fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
