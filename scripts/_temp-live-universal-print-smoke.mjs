#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const LIVE_URL = 'https://gospod-bog.ru/articles/dzhon-gill-chast-1-chelovek/';
const OUT = path.resolve('reports/live-universal-print');
const POLL_MS = Number(process.env.LIVE_POLL_MS || 15000);
const MAX_POLLS = Number(process.env.LIVE_MAX_POLLS || 100);
const MANAGED = [
  'css/site.css',
  'css/reader-preferences.css',
  'js/site.js',
  'js/reader-preferences-head.js',
  'js/reader-preferences.js',
  'js/reader-state.js',
];

await fs.mkdir(OUT, { recursive: true });

const assetSource = await fs.readFile('src/lib/asset-version.js', 'utf8');
const expected = Object.fromEntries(MANAGED.map((asset) => {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = assetSource.match(new RegExp(`['"]${escaped}['"]\\s*:\\s*['"]([a-f0-9]+)['"]`));
  if (!match) throw new Error(`Missing expected asset revision for ${asset}`);
  return [asset, match[1]];
}));

function extract(html, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`(?:/|\\.\\./)+${escaped}\\?v=([a-f0-9]+)`, 'i'));
  return match?.[1] || null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'GB-Live-Universal-Print-Smoke/1.0',
    },
    redirect: 'follow',
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    headers: Object.fromEntries(response.headers.entries()),
    text,
  };
}

let live = null;
const attempts = [];
for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
  const response = await fetchText(`${LIVE_URL}?production-smoke=${Date.now()}`);
  const actual = Object.fromEntries(MANAGED.map((asset) => [asset, extract(response.text, asset)]));
  const matches = MANAGED.every((asset) => actual[asset] === expected[asset]);
  const standalonePaginationTag = /<script\b[^>]*\bsrc=["'][^"']*js\/print-pagination\.js/i.test(response.text);
  const snapshot = {
    attempt,
    checkedAt: new Date().toISOString(),
    status: response.status,
    finalUrl: response.finalUrl,
    actual,
    expected,
    matches,
    standalonePaginationTag,
  };
  attempts.push(snapshot);
  console.log(JSON.stringify(snapshot));
  if (response.ok && matches && !standalonePaginationTag) {
    live = { ...response, actual, attempt };
    break;
  }
  if (attempt < MAX_POLLS) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}

await fs.writeFile(path.join(OUT, 'poll-attempts.json'), JSON.stringify(attempts, null, 2));
if (!live) throw new Error(`Production did not publish the exact integrated runtime after ${MAX_POLLS} polls`);
await fs.writeFile(path.join(OUT, 'live.html'), live.text);

const headRevision = expected['js/reader-preferences-head.js'];
const headResponse = await fetchText(`https://gospod-bog.ru/js/reader-preferences-head.js?v=${headRevision}&production-smoke=${Date.now()}`);
await fs.writeFile(path.join(OUT, 'live-reader-preferences-head.js'), headResponse.text);
if (!headResponse.ok) throw new Error(`Live reader-preferences-head.js returned ${headResponse.status}`);
const runtimeAssertions = {
  embeddedPaginationBanner: headResponse.text.includes('GB Print Pagination v1'),
  semanticRuntime: headResponse.text.includes('window.GBPrintPagination'),
  terminalSemanticBoundary: headResponse.text.includes('data-print-terminal-follower'),
  reversibleClosingGroup: headResponse.text.includes('restoreClosingGroups'),
};
if (Object.values(runtimeAssertions).some((value) => !value)) {
  throw new Error(`Published reader head is missing integrated pagination assertions: ${JSON.stringify(runtimeAssertions)}`);
}

const standaloneResponse = await fetchText(`https://gospod-bog.ru/js/print-pagination.js?production-smoke=${Date.now()}`);
await fs.writeFile(path.join(OUT, 'standalone-print-pagination-response.txt'), standaloneResponse.text);
if (standaloneResponse.status !== 404) {
  throw new Error(`Standalone print-pagination.js unexpectedly exists in production: HTTP ${standaloneResponse.status}`);
}

const browser = await chromium.launch();
let browserReport;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  const page = await context.newPage();
  await page.goto(`${LIVE_URL}?production-smoke=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForTimeout(1000);

  const browserAssets = await page.evaluate((managed) => {
    const values = [...document.querySelectorAll('link[href],script[src]')]
      .map((node) => node.href || node.src)
      .filter(Boolean);
    const result = {};
    for (const asset of managed) {
      const found = values.find((value) => value.includes(`/${asset}?v=`));
      result[asset] = found ? new URL(found).searchParams.get('v') : null;
    }
    return result;
  }, MANAGED);
  for (const asset of MANAGED) {
    if (browserAssets[asset] !== expected[asset]) {
      throw new Error(`Browser loaded ${asset}@${browserAssets[asset]}, expected ${expected[asset]}`);
    }
  }

  const screenState = await page.evaluate(() => ({
    paginationVersion: window.GBPrintPagination?.version || 0,
    closingGroups: document.querySelectorAll('.gb-print-closing-group').length,
    generatedNodes: document.querySelectorAll('[data-gb-print-generated]').length,
  }));
  if (screenState.paginationVersion !== 1) throw new Error(`GBPrintPagination v1 missing on live page: ${JSON.stringify(screenState)}`);
  if (screenState.closingGroups !== 0 || screenState.generatedNodes !== 0) {
    throw new Error(`Screen DOM was mutated before print: ${JSON.stringify(screenState)}`);
  }
  await page.screenshot({ path: path.join(OUT, 'live-screen-1440.png'), fullPage: false });

  await page.emulateMedia({ media: 'print' });
  const paginationReport = await page.evaluate(() => window.GBPrintPagination?.prepare?.() || null);
  if (!paginationReport?.prepared || paginationReport.version !== 1) {
    throw new Error(`Live semantic pagination did not prepare: ${JSON.stringify(paginationReport)}`);
  }
  if ((paginationReport.stats?.atomic || 0) < 1 || paginationReport.stats?.terminalAnchors !== 1) {
    throw new Error(`Live semantic pagination classified an invalid document: ${JSON.stringify(paginationReport)}`);
  }

  const printState = await page.evaluate(() => ({
    atomic: document.querySelectorAll('[data-print-flow="atomic"]').length,
    keepNext: document.querySelectorAll('[data-print-keep-next]').length,
    terminalAnchors: document.querySelectorAll('[data-print-terminal-root]').length,
    closingGroups: document.querySelectorAll('.gb-print-closing-group').length,
  }));
  await page.screenshot({ path: path.join(OUT, 'live-print-preview.png'), fullPage: false });
  await page.pdf({
    path: path.join(OUT, 'live-reader-print-a4.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.GBPrintPagination?.reset?.());
  const resetState = await page.evaluate(() => ({
    closingGroups: document.querySelectorAll('.gb-print-closing-group').length,
    generatedNodes: document.querySelectorAll('[data-gb-print-generated]').length,
  }));
  if (resetState.closingGroups !== 0 || resetState.generatedNodes !== 0) {
    throw new Error(`Live DOM did not restore after print: ${JSON.stringify(resetState)}`);
  }

  browserReport = {
    checkedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    browserAssets,
    screenState,
    paginationReport,
    printState,
    resetState,
  };
  await context.close();
} finally {
  await browser.close();
}

const report = {
  liveUrl: LIVE_URL,
  deployedAfterPoll: live.attempt,
  expected,
  actual: live.actual,
  htmlStatus: live.status,
  headStatus: headResponse.status,
  standaloneStatus: standaloneResponse.status,
  runtimeAssertions,
  browser: browserReport,
};
await fs.writeFile(path.join(OUT, 'live-production-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
