#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const LIVE_URL = 'https://gospod-bog.ru/articles/dzhon-gill-chast-1-chelovek/';
const OUT = path.resolve('reports/live-reader-production');
const POLL_MS = Number(process.env.LIVE_POLL_MS || 15000);
const MAX_POLLS = Number(process.env.LIVE_MAX_POLLS || 80);
const MANAGED = [
  'css/site.css',
  'css/reader-preferences.css',
  'js/site.js',
  'js/reader-preferences.js',
  'js/reader-state.js',
];

await fs.mkdir(OUT, { recursive: true });

const assetSource = await fs.readFile('src/lib/asset-version.js', 'utf8');
const expected = Object.fromEntries(MANAGED.map((asset) => {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = assetSource.match(new RegExp(`['\"]${escaped}['\"]\\s*:\\s*['\"]([a-f0-9]+)['\"]`));
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
      'user-agent': 'GB-Live-Reader-Smoke/1.0',
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
  const stamp = Date.now();
  const response = await fetchText(`${LIVE_URL}?production-smoke=${stamp}`);
  const actual = Object.fromEntries(MANAGED.map((asset) => [asset, extract(response.text, asset)]));
  const matches = MANAGED.every((asset) => actual[asset] === expected[asset]);
  const snapshot = {
    attempt,
    checkedAt: new Date().toISOString(),
    status: response.status,
    finalUrl: response.finalUrl,
    actual,
    expected,
    matches,
  };
  attempts.push(snapshot);
  console.log(JSON.stringify(snapshot));
  if (response.ok && matches) {
    live = { ...response, actual, attempt };
    break;
  }
  if (attempt < MAX_POLLS) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}

await fs.writeFile(path.join(OUT, 'poll-attempts.json'), JSON.stringify(attempts, null, 2));
if (!live) {
  throw new Error(`Production did not publish all expected asset revisions after ${MAX_POLLS} polls`);
}
await fs.writeFile(path.join(OUT, 'live.html'), live.text);

const cssRevision = expected['css/site.css'];
const cssResponse = await fetchText(`https://gospod-bog.ru/css/site.css?v=${cssRevision}&production-smoke=${Date.now()}`);
await fs.writeFile(path.join(OUT, 'live-site.css'), cssResponse.text);
if (!cssResponse.ok) throw new Error(`Live site.css returned ${cssResponse.status}`);
const cssAssertions = {
  balancedA4: /@page\s*\{\s*size:\s*A4;\s*margin:\s*14mm;\s*\}/.test(cssResponse.text),
  neutralPaperMarker: cssResponse.text.includes('GB PRINT CONTRACT v2.4'),
  terminalSignatureMarker: cssResponse.text.includes('GB PRINT CONTRACT v2.6'),
  noPhantomSheetMarker: cssResponse.text.includes('GB PRINT CONTRACT v2.7'),
};
if (Object.values(cssAssertions).some((value) => !value)) {
  throw new Error(`Published CSS is missing final print assertions: ${JSON.stringify(cssAssertions)}`);
}

const browser = await chromium.launch();
let browserReport;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  await page.goto(`${LIVE_URL}?production-smoke=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);

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

  await page.screenshot({ path: path.join(OUT, 'live-screen-1440.png'), fullPage: false });

  await page.evaluate(() => {
    window.__productionPrintCalls = 0;
    window.print = () => { window.__productionPrintCalls += 1; };
  });
  const printControl = page.locator('[data-action="print"]').first();
  if (await printControl.count() === 0) throw new Error('Print control not found on live page');
  await printControl.evaluate((node) => node.click());
  await page.waitForFunction(
    () => window.__productionPrintCalls === 1 && Boolean(window.GBPrintEngine?.getReport?.()),
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(500);
  const printReport = await page.evaluate(() => window.GBPrintEngine?.getReport?.() || null);
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: path.join(OUT, 'live-print-preview.png'), fullPage: false });
  await page.pdf({
    path: path.join(OUT, 'live-reader-print-a4.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  browserReport = {
    checkedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    browserAssets,
    printCalls: await page.evaluate(() => window.__productionPrintCalls),
    printReport,
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
  cssStatus: cssResponse.status,
  cssAssertions,
  browser: browserReport,
};
await fs.writeFile(path.join(OUT, 'live-production-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
