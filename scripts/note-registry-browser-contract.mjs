#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require('playwright');

const ENGINE = String(process.env.GB_NOTE_BROWSER || 'firefox').toLowerCase();
const BROWSERS = { chromium, firefox, webkit };
if (!BROWSERS[ENGINE]) throw new Error(`Unsupported GB_NOTE_BROWSER=${ENGINE}`);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const STATIC_FOOTNOTES = ['40', '72', '75', '77', '82', '83', '107'];
const MIME = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  if (!clean) return join(DIST, 'index.html');
  return pathname.endsWith('/') ? join(DIST, clean, 'index.html') : join(DIST, clean);
}

async function serveDist() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      let file = routeFile(pathname);
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function annotateFootnotes(expected) {
  function numberOf(marker) {
    return Array.from(marker.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join('')
      .replace(/\s+/g, '')
      .trim();
  }
  const found = {};
  for (const marker of document.querySelectorAll('.fn-marker')) {
    const number = numberOf(marker);
    if (!expected.includes(number)) continue;
    marker.dataset.noteBrowserFootnote = number;
    const tip = marker.querySelector('.tooltip');
    found[number] = {
      tooltip: Boolean(tip),
      nestedInteractive: tip
        ? tip.querySelectorAll('button, a, [tabindex], [role="button"], .bref, [data-ref]').length
        : -1,
    };
  }
  return {
    found,
    nestedInteractive: document.querySelectorAll(
      '.fn-marker .tooltip button, .fn-marker .tooltip a, .fn-marker .tooltip [tabindex], ' +
      '.fn-marker .tooltip [role="button"], .fn-marker .tooltip .bref, .fn-marker .tooltip [data-ref]'
    ).length,
    ordinaryScripture: document.querySelectorAll('article .bref[data-ref]').length,
    markerCount: document.querySelectorAll('.fn-marker').length,
  };
}

function readOpenTip({ markerSelector }) {
  const marker = document.querySelector(markerSelector);
  const tip = document.querySelector('.tooltip.gb-floating-tip.is-open');
  const rect = tip?.getBoundingClientRect();
  const style = tip ? getComputedStyle(tip) : null;
  const controlledId = marker?.getAttribute('aria-controls') || '';
  return {
    markerExpanded: marker?.getAttribute('aria-expanded') === 'true',
    controlledId,
    controlsTargetExists: Boolean(controlledId && document.getElementById(controlledId)),
    tipOpen: Boolean(tip),
    activeElement: document.activeElement?.matches(markerSelector) || false,
    nestedFocusable: tip
      ? tip.querySelectorAll('button, a, [tabindex], [role="button"], .bref, [data-ref]').length
      : -1,
    tip: tip && rect && style ? {
      position: style.position,
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      textLength: (tip.textContent || '').trim().length,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      inViewport:
        rect.left >= -1 && rect.top >= -1 &&
        rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
    } : null,
  };
}

async function findPhysicalHitPoint(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.page().waitForTimeout(120);
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const attempts = [];
    const xFractions = [0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92];
    const yFractions = [0.15, 0.35, 0.5, 0.65, 0.85];
    for (const yFraction of yFractions) {
      for (const xFraction of xFractions) {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const top = document.elementFromPoint(x, y);
        const hit = Boolean(top && (top === node || node.contains(top)));
        attempts.push({
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          hit,
          top: top
            ? `${top.tagName.toLowerCase()}#${top.id || ''}.${String(top.className || '').slice(0, 120)}`
            : null,
        });
        if (hit) {
          return {
            ok: true,
            x,
            y,
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
            attempts,
          };
        }
      }
    }
    return {
      ok: false,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      attempts,
    };
  });
}

const checks = [];
function record(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

if (!existsSync(DIST)) {
  throw new Error('dist/ missing; run npm run strangler:build:production-like first');
}

const { server, base } = await serveDist();
let browser;
try {
  const launchOptions = ENGINE === 'chromium'
    ? { headless: true, args: ['--disable-dev-shm-usage'] }
    : { headless: true };
  browser = await BROWSERS[ENGINE].launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, locale: 'ru-RU' });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  const response = await page.goto(base + ROUTE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(900);
  record('document:status', response?.status() === 200, response?.status() ?? null);

  const staticState = await page.evaluate(annotateFootnotes, STATIC_FOOTNOTES);
  record('source:all-required-footnotes-found',
    STATIC_FOOTNOTES.every((number) => staticState.found[number]?.tooltip), staticState);
  record('source:no-nested-interactive-footnotes', staticState.nestedInteractive === 0, staticState);
  record('source:ordinary-scripture-remains-interactive', staticState.ordinaryScripture >= 20, staticState);

  const hoverSelector = '[data-note-browser-footnote="40"]';
  const hoverMarker = page.locator(hoverSelector);
  const hoverPoint = await findPhysicalHitPoint(hoverMarker);
  record('desktop:hover-trigger-hit-test', hoverPoint.ok, hoverPoint);
  let hoverState = await page.evaluate(readOpenTip, { markerSelector: hoverSelector });
  if (hoverPoint.ok) {
    await page.mouse.move(hoverPoint.x, hoverPoint.y);
    await page.waitForTimeout(250);
    hoverState = await page.evaluate(readOpenTip, { markerSelector: hoverSelector });
  }
  const hoverOpened = hoverPoint.ok && hoverState.markerExpanded && hoverState.tipOpen &&
    hoverState.controlsTargetExists && hoverState.tip?.position === 'fixed' &&
    hoverState.tip?.display !== 'none' && hoverState.tip?.visibility !== 'hidden' &&
    hoverState.tip?.opacity >= 0.9 && hoverState.tip?.textLength >= 20 &&
    hoverState.tip?.width >= 80 && hoverState.tip?.height >= 20 && hoverState.tip?.inViewport;
  record('desktop:hover-opens-governed-tip', hoverOpened, hoverState);
  if (hoverState.tipOpen && hoverState.tip) {
    await page.mouse.move(hoverState.tip.centerX, hoverState.tip.centerY, { steps: 12 });
    await page.waitForTimeout(300);
    hoverState = await page.evaluate(readOpenTip, { markerSelector: hoverSelector });
  }
  record('desktop:hover-content-keeps-parent-open', hoverState.tipOpen && hoverState.tip?.inViewport, hoverState);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(220);
  record('desktop:hover-escape-closes',
    !(await page.locator('.tooltip.gb-floating-tip.is-open').count()) &&
    (await hoverMarker.getAttribute('aria-expanded')) !== 'true', null);

  const keyboardSelector = '[data-note-browser-footnote="72"]';
  const keyboardMarker = page.locator(keyboardSelector);
  await keyboardMarker.focus();
  await page.waitForTimeout(250);
  const keyboardState = await page.evaluate(readOpenTip, { markerSelector: keyboardSelector });
  record('keyboard:focus-opens-and-links-aria',
    keyboardState.activeElement && keyboardState.markerExpanded && keyboardState.tipOpen &&
    keyboardState.controlsTargetExists && keyboardState.nestedFocusable === 0, keyboardState);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(220);
  record('keyboard:escape-closes',
    !(await page.locator('.tooltip.gb-floating-tip.is-open').count()) &&
    (await keyboardMarker.getAttribute('aria-expanded')) !== 'true', null);

  const scripture = page.locator('article .bref[data-ref]').first();
  await scripture.scrollIntoViewIfNeeded();
  await scripture.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const scriptureState = await page.evaluate(() => ({
    tipOpen: Boolean(document.querySelector('.gb-floating-tip.is-open')),
    expanded: Boolean(document.querySelector('article .bref[data-ref][aria-expanded="true"]')),
  }));
  record('scripture:ordinary-tooltip-still-opens', scriptureState.tipOpen && scriptureState.expanded, scriptureState);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(220);
  record('scripture:escape-closes', !(await page.locator('.gb-floating-tip.is-open').count()), null);
  record('runtime:no-page-errors', pageErrors.length === 0, pageErrors);
  await page.close();
} finally {
  await browser?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

const failures = checks.filter((check) => !check.ok);
const report = {
  generatedAt: new Date().toISOString(),
  engine: ENGINE,
  route: ROUTE,
  requiredFootnotes: STATIC_FOOTNOTES,
  passed: checks.length - failures.length,
  total: checks.length,
  failures,
  checks,
};
await mkdir(REPORTS, { recursive: true });
await writeFile(join(REPORTS, `note-registry-${ENGINE}-contract.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(`NoteRegistry ${ENGINE} contract: ${report.passed}/${report.total} PASS`);
for (const failure of failures) console.error(`FAIL ${failure.name}: ${JSON.stringify(failure.detail)}`);
if (failures.length) process.exitCode = 1;
