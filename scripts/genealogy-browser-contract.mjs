#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'genealogy-browser-contract');
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.GENEALOGY_BROWSERS || 'chromium,webkit')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
];

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }[extension] || 'application/octet-stream';
}

function resolveRequestPath(urlValue) {
  const url = new URL(urlValue || '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const indexCandidate = path.join(candidate, 'index.html');
  if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) return indexCandidate;
  return null;
}

async function startServer() {
  assert.ok(fs.existsSync(path.join(DIST, 'rodosloviye', 'index.html')), 'dist/rodosloviye/index.html is missing; build production-like dist first');
  const server = http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!filePath) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('Content-Type', contentType(filePath));
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForViewportStable(page) {
  await page.evaluate(async () => {
    const viewport = document.querySelector('.react-flow__viewport');
    if (!viewport) throw new Error('ReactFlow viewport is missing');
    await new Promise((resolve, reject) => {
      let last = '';
      let stableFrames = 0;
      let frames = 0;
      const tick = () => {
        const current = viewport.getAttribute('style') || getComputedStyle(viewport).transform || '';
        stableFrames = current && current === last ? stableFrames + 1 : 0;
        last = current;
        frames += 1;
        if (stableFrames >= 6) return resolve();
        if (frames > 600) return reject(new Error('ReactFlow viewport did not settle'));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

async function measurePersonViewport(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.react-flow');
    if (!canvas) throw new Error('ReactFlow root is missing');
    const canvasRect = canvas.getBoundingClientRect();
    const nodes = [...document.querySelectorAll('.react-flow__node')]
      .filter((node) => node.querySelector('.genealogy-node'));

    const visibleIds = [];
    let visibleArea = 0;
    for (const node of nodes) {
      const style = getComputedStyle(node);
      const card = node.querySelector('.genealogy-node');
      const cardStyle = card ? getComputedStyle(card) : null;
      if (
        style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') <= 0
        || !cardStyle || cardStyle.display === 'none' || cardStyle.visibility === 'hidden'
      ) continue;

      const rect = node.getBoundingClientRect();
      const left = Math.max(rect.left, canvasRect.left);
      const right = Math.min(rect.right, canvasRect.right);
      const top = Math.max(rect.top, canvasRect.top);
      const bottom = Math.min(rect.bottom, canvasRect.bottom);
      const area = Math.max(0, right - left) * Math.max(0, bottom - top);
      if (area > 4) {
        visibleIds.push(node.getAttribute('data-id') || node.textContent?.trim().slice(0, 60) || 'unknown');
        visibleArea += area;
      }
    }

    return {
      mountedPersonNodes: nodes.length,
      visiblePersonCards: visibleIds.length,
      visibleIds,
      visibleArea,
      transform: document.querySelector('.react-flow__viewport')?.getAttribute('style') || '',
    };
  });
}

async function assertSplitLifecycle(page) {
  const opener = page.getByTitle('Сравнить Мф/Лк');
  const tour = page.getByTitle('Тур');

  await opener.focus();
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Две родословные Христа' });
  await dialog.waitFor({ state: 'visible' });

  assert.equal(await page.evaluate(() => {
    const current = document.activeElement;
    const openDialog = document.querySelector('dialog.genealogy-split-dialog[open]');
    return Boolean(openDialog && current && openDialog.contains(current));
  }), true, 'Split View focus did not enter the modal comparison');

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab');
    const focusState = await page.evaluate(() => {
      const current = document.activeElement;
      const openDialog = document.querySelector('dialog.genealogy-split-dialog[open]');
      return {
        inside: Boolean(openDialog && current && openDialog.contains(current)),
        title: current instanceof HTMLElement ? current.getAttribute('title') : null,
      };
    });
    assert.equal(focusState.inside, true, `Split View Tab ${index + 1} escaped to the covered page`);
    assert.notEqual(focusState.title, 'Тур', `Split View Tab ${index + 1} reached the covered Tour control`);
  }
  assert.equal(await tour.evaluate((node) => document.activeElement === node), false, 'covered Tour control became focused');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await opener.evaluate((node) => document.activeElement === node), true, 'Escape did not restore focus to Split View opener');

  await opener.press('Enter');
  const reopened = page.getByRole('dialog', { name: 'Две родословные Христа' });
  await reopened.waitFor({ state: 'visible' });
  await reopened.getByRole('button', { name: 'Закрыть сравнение' }).click();
  await reopened.waitFor({ state: 'detached' });
  assert.equal(await opener.evaluate((node) => document.activeElement === node), true, 'explicit Split View close did not restore focus to opener');
}

async function runViewport(browserName, browserType, baseUrl, viewport) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  let phase = 'navigation';
  page.on('pageerror', (error) => pageErrors.push(`[${phase}] ${String(error?.stack || error)}`));

  try {
    const response = await page.goto(`${baseUrl}/rodosloviye/`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} ${viewport.width}x${viewport.height}: /rodosloviye/ did not load successfully`);

    phase = 'initial-settle';
    await page.locator('.react-flow__node .genealogy-node').first().waitFor({ state: 'attached' });
    await waitForViewportStable(page);

    const initial = await measurePersonViewport(page);
    assert.equal(initial.mountedPersonNodes, 143, `${browserName} ${viewport.width}x${viewport.height}: genealogy dataset mount count changed`);
    assert.ok(initial.visiblePersonCards > 0, `${browserName} ${viewport.width}x${viewport.height}: settled initial viewport contains no visible person cards`);
    assert.ok(initial.visibleArea > 0, `${browserName} ${viewport.width}x${viewport.height}: settled initial viewport has no useful person-card area`);

    phase = 'fit-view';
    const fitButton = page.locator('.react-flow__controls-fitview');
    await fitButton.waitFor({ state: 'visible' });
    await fitButton.click();
    await waitForViewportStable(page);
    const afterFit = await measurePersonViewport(page);
    assert.equal(afterFit.mountedPersonNodes, 143, `${browserName} ${viewport.width}x${viewport.height}: Fit View changed mounted person count`);
    assert.ok(afterFit.visiblePersonCards > 0, `${browserName} ${viewport.width}x${viewport.height}: canonical Fit View contains no visible person cards`);
    assert.ok(afterFit.visibleArea > 0, `${browserName} ${viewport.width}x${viewport.height}: canonical Fit View has no useful person-card area`);

    phase = 'search';
    const search = page.getByRole('textbox', { name: 'Поиск по имени' });
    await search.fill('Адам');
    await waitForViewportStable(page);
    const afterSearch = await measurePersonViewport(page);
    assert.ok(afterSearch.visibleIds.includes('adam'), `${browserName} ${viewport.width}x${viewport.height}: search did not center Adam into the useful viewport`);
    await page.getByText('Все детали', { exact: true }).waitFor({ state: 'visible' });

    phase = 'split-view';
    await assertSplitLifecycle(page);
    phase = 'final';
    assert.deepEqual(pageErrors, [], `${browserName} ${viewport.width}x${viewport.height}: uncaught page errors`);

    return { browser: browserName, viewport, initial, afterFit, afterSearch, pageErrors };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const server = await startServer();
  const results = [];
  try {
    for (const browserName of browserNames) {
      const browserType = BROWSERS[browserName];
      assert.ok(browserType, `unsupported browser: ${browserName}`);
      for (const viewport of VIEWPORTS) {
        const result = await runViewport(browserName, browserType, server.baseUrl, viewport);
        results.push(result);
        console.log(`[genealogy] ${browserName} ${viewport.width}x${viewport.height}: initial=${result.initial.visiblePersonCards}, fit=${result.afterFit.visiblePersonCards}, search=${result.afterSearch.visiblePersonCards}`);
      }
    }
  } finally {
    await server.close();
  }

  const report = {
    schemaVersion: 1,
    conclusion: 'success',
    sha: process.env.SOURCE_SHA || '',
    route: '/rodosloviye/',
    expectedPersonNodes: 143,
    browsers: browserNames,
    viewports: VIEWPORTS,
    results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('Genealogy Chromium/WebKit browser contract: PASS');
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    schemaVersion: 1,
    conclusion: 'failure',
    sha: process.env.SOURCE_SHA || '',
    route: '/rodosloviye/',
    error: String(error?.stack || error),
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
