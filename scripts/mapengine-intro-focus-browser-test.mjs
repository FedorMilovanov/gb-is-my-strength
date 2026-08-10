#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'mapengine-intro-focus');
const ROUTE = '/karty/ishod/';
const BROWSERS = { chromium, webkit };
const VIEWPORTS = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 1440, height: 1000, label: 'desktop' },
];

function contentType(file) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveRequest(urlValue) {
  const url = new URL(urlValue || '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, 'index.html');
  return fs.existsSync(index) && fs.statSync(index).isFile() ? index : null;
}

async function startServer() {
  assert.ok(resolveRequest(ROUTE), `built route missing: ${ROUTE}`);
  const server = http.createServer((request, response) => {
    try {
      const file = resolveRequest(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!file) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('Content-Type', contentType(file));
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForIntro(page) {
  const intro = page.locator('.me-intro');
  const button = page.locator('.me-intro__btn');
  await intro.waitFor({ state: 'visible' });
  await button.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.classList?.contains('me-intro__btn'));

  const state = await page.evaluate(() => {
    const introEl = document.querySelector('.me-intro');
    const map = introEl?.parentElement;
    if (!(introEl instanceof HTMLElement) || !(map instanceof HTMLElement)) throw new Error('Intro/map owner missing');
    const focusSelector = 'a[href],button,input,select,textarea,[tabindex]';
    const underlayFocusables = [...map.querySelectorAll(focusSelector)]
      .filter((node) => !node.closest('.me-intro'))
      .map((node) => {
        const style = getComputedStyle(node);
        const rendered = node.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        const disabled = 'disabled' in node && Boolean(node.disabled);
        return {
          tag: node.tagName,
          id: node.id || '',
          className: node.className?.baseVal || node.className || '',
          tabIndex: node.tabIndex,
          rendered,
          disabled,
          inertAncestor: Boolean(node.closest('[inert]')),
        };
      });
    const sequentialUnderlay = underlayFocusables.filter((node) => node.rendered && !node.disabled && node.tabIndex >= 0);
    return {
      activeClass: document.activeElement?.className || '',
      owned: Boolean(introEl.getAttribute('data-overlay-owner')),
      open: introEl.getAttribute('data-overlay-open'),
      underlayFocusables,
      sequentialUnderlay,
    };
  });

  assert.ok(String(state.activeClass).includes('me-intro__btn'), 'Intro primary action does not own initial focus');
  assert.ok(state.sequentialUnderlay.length > 0, 'Map Intro has no rendered focusable underlay controls; fixture invalid');
  assert.ok(
    state.sequentialUnderlay.every((node) => node.inertAncestor),
    `Intro leaves rendered sequential underlay controls outside inert ownership: ${JSON.stringify(state.sequentialUnderlay.filter((node) => !node.inertAncestor))}`,
  );
  return state;
}

async function assertTabTrappedInIntro(page, browserName, viewportLabel) {
  const trace = [];
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press(index % 4 === 3 ? 'Shift+Tab' : 'Tab');
    trace.push(await page.evaluate(() => ({
      tag: document.activeElement?.tagName || '',
      className: document.activeElement?.className || '',
      insideIntro: Boolean(document.activeElement?.closest?.('.me-intro')),
    })));
  }
  assert.ok(trace.every((entry) => entry.insideIntro), `${browserName}/${viewportLabel}: sequential focus escaped visible Intro`);
  return trace;
}

async function assertPostDismissFocus(page, browserName, viewportLabel, mode) {
  await page.locator('.me-intro').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.activeElement?.classList?.contains('me-story-chip--active'));
  const state = await page.evaluate(() => ({
    tag: document.activeElement?.tagName || '',
    className: document.activeElement?.className || '',
    text: (document.activeElement?.textContent || '').trim(),
  }));
  assert.ok(String(state.className).includes('me-story-chip--active'), `${browserName}/${viewportLabel}/${mode}: dismissal did not focus active story owner`);
  return state;
}

async function runDismissal(page, baseUrl, browserName, viewport, mode) {
  const errors = [];
  const onError = (error) => errors.push(String(error?.stack || error));
  page.on('pageerror', onError);
  try {
    const response = await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName}/${viewport.label}/${mode}: route failed to load`);
    const introState = await waitForIntro(page);
    const tabTrace = mode === 'button' ? await assertTabTrappedInIntro(page, browserName, viewport.label) : [];

    if (mode === 'button') await page.locator('.me-intro__btn').click();
    else if (mode === 'escape') await page.keyboard.press('Escape');
    else if (mode === 'backdrop') await page.locator('.me-intro__bg').click({ position: { x: 8, y: 8 } });
    else throw new Error(`unsupported dismissal mode: ${mode}`);

    const postFocus = await assertPostDismissFocus(page, browserName, viewport.label, mode);
    assert.deepEqual(errors, [], `${browserName}/${viewport.label}/${mode}: uncaught page errors`);
    return { browser: browserName, viewport, mode, introState, tabTrace, postFocus, errors };
  } finally {
    page.off('pageerror', onError);
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; run production-like build first');
  const server = await startServer();
  const results = [];
  try {
    for (const [browserName, browserType] of Object.entries(BROWSERS)) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const viewport of VIEWPORTS) {
          const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
          const page = await context.newPage();
          try {
            for (const mode of ['button', 'escape', 'backdrop']) {
              results.push(await runDismissal(page, server.baseUrl, browserName, viewport, mode));
            }
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }

  const report = {
    schemaVersion: 2,
    conclusion: 'success',
    sha: process.env.SOURCE_SHA || '',
    route: ROUTE,
    browsers: Object.keys(BROWSERS),
    viewports: VIEWPORTS,
    dismissalModes: ['button', 'escape', 'backdrop'],
    cases: results.length,
    results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`MapEngine Intro focus contract: PASS (${results.length} cases)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({
    schemaVersion: 2,
    conclusion: 'failure',
    sha: process.env.SOURCE_SHA || '',
    error: String(error?.stack || error),
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
