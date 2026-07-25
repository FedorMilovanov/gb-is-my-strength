#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const LIVE_URL = 'https://gospod-bog.ru/articles/dzhon-gill-chast-1-chelovek/';
const OUT = path.resolve('reports/live-editorial-dateline');
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
      'user-agent': 'GB-Live-Editorial-Dateline-Smoke/1.0',
    },
    redirect: 'follow',
  });
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    headers: Object.fromEntries(response.headers.entries()),
    text: await response.text(),
  };
}

let live = null;
const attempts = [];
for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
  const response = await fetchText(`${LIVE_URL}?dateline-production-smoke=${Date.now()}`);
  const actual = Object.fromEntries(MANAGED.map((asset) => [asset, extract(response.text, asset)]));
  const matches = MANAGED.every((asset) => actual[asset] === expected[asset]);
  const datelineCount = (response.text.match(/class=["'][^"']*editorial-dateline(?:\s|["'])/gi) || []).length;
  const legacyCount = (response.text.match(/foliant-mark/gi) || []).length;
  const snapshot = {
    attempt,
    checkedAt: new Date().toISOString(),
    status: response.status,
    actual,
    expected,
    matches,
    datelineCount,
    legacyCount,
  };
  attempts.push(snapshot);
  console.log(JSON.stringify(snapshot));
  if (response.ok && matches && datelineCount > 0 && legacyCount === 0) {
    live = { ...response, actual, attempt, datelineCount };
    break;
  }
  if (attempt < MAX_POLLS) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
await fs.writeFile(path.join(OUT, 'poll-attempts.json'), JSON.stringify(attempts, null, 2));
if (!live) throw new Error(`Production did not publish the exact editorial dateline build after ${MAX_POLLS} polls`);
await fs.writeFile(path.join(OUT, 'live.html'), live.text);

const cssRevision = expected['css/site.css'];
const cssResponse = await fetchText(`https://gospod-bog.ru/css/site.css?v=${cssRevision}&dateline-production-smoke=${Date.now()}`);
await fs.writeFile(path.join(OUT, 'live-site.css'), cssResponse.text);
assert.equal(cssResponse.status, 200, `Live site.css returned HTTP ${cssResponse.status}`);
const cssAssertions = {
  banner: cssResponse.text.includes('GB EDITORIAL DATELINE v1'),
  datelineRule: cssResponse.text.includes('.editorial-dateline'),
  placeRule: cssResponse.text.includes('.editorial-dateline__place'),
  dateRule: cssResponse.text.includes('.editorial-dateline__date'),
  noLegacySelector: !cssResponse.text.includes('.foliant-mark'),
};
assert.ok(Object.values(cssAssertions).every(Boolean), `Published dateline CSS contract failed: ${JSON.stringify(cssAssertions)}`);

const browser = await chromium.launch();
const browserReports = [];
try {
  for (const mode of [
    { name: 'desktop', viewport: { width: 1440, height: 1000 } },
    { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext({
      viewport: mode.viewport,
      isMobile: !!mode.isMobile,
      hasTouch: !!mode.hasTouch,
      deviceScaleFactor: 1,
      locale: 'ru-RU',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto(`${LIVE_URL}?dateline-production-smoke=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
    await page.waitForTimeout(800);

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
    for (const asset of MANAGED) assert.equal(browserAssets[asset], expected[asset], `${mode.name}: wrong live revision for ${asset}`);

    const audit = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.editorial-dateline')];
      return {
        count: nodes.length,
        legacyCount: document.querySelectorAll('.foliant-mark').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        generatedPrintNodes: document.querySelectorAll('[data-gb-print-generated],.gb-print-closing-group').length,
        nodes: nodes.map((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            role: node.getAttribute('role'),
            headingChildren: node.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
            float: style.cssFloat,
            borderRadius: style.borderRadius,
            backgroundColor: style.backgroundColor,
            display: style.display,
            fontSize: parseFloat(style.fontSize),
            width: rect.width,
            viewport: window.innerWidth,
          };
        }),
      };
    });
    assert.ok(audit.count > 0, `${mode.name}: no live editorial datelines`);
    assert.equal(audit.legacyCount, 0, `${mode.name}: legacy foliant markers remain`);
    assert.ok(audit.overflow <= 1, `${mode.name}: horizontal overflow ${audit.overflow}px`);
    assert.equal(audit.generatedPrintNodes, 0, `${mode.name}: screen DOM already contains print wrappers`);
    for (const node of audit.nodes) {
      assert.equal(node.tag, 'P');
      assert.notEqual(node.role, 'heading');
      assert.equal(node.headingChildren, 0);
      assert.equal(node.float, 'none');
      assert.equal(node.borderRadius, '0px');
      assert.ok(node.backgroundColor === 'rgba(0, 0, 0, 0)' || node.backgroundColor === 'transparent', `unexpected background ${node.backgroundColor}`);
      assert.equal(node.display, 'flex');
      assert.ok(node.fontSize <= 15.1, `dateline acquired heading scale: ${node.fontSize}px`);
      assert.ok(node.width <= node.viewport + 1, 'dateline overflows viewport');
    }

    const first = page.locator('.editorial-dateline').first();
    await first.scrollIntoViewIfNeeded();
    await first.screenshot({ path: path.join(OUT, `live-${mode.name}-dateline.png`) });
    await page.screenshot({ path: path.join(OUT, `live-${mode.name}-viewport.png`), fullPage: false });

    if (mode.name === 'desktop') {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(200);
      await first.screenshot({ path: path.join(OUT, 'live-dark-dateline.png') });
      await page.evaluate(() => document.documentElement.classList.remove('dark'));

      await page.emulateMedia({ media: 'print' });
      const pagination = await page.evaluate(() => window.GBPrintPagination?.prepare?.() || null);
      assert.ok(pagination?.prepared, `Live print pagination failed: ${JSON.stringify(pagination)}`);
      const printAudit = await page.evaluate(() => ({
        datelines: [...document.querySelectorAll('.editorial-dateline')].map((node) => ({
          keepNext: node.hasAttribute('data-print-keep-next'),
          flow: node.getAttribute('data-print-flow'),
        })),
        closingGroups: document.querySelectorAll('.gb-print-closing-group').length,
      }));
      assert.ok(printAudit.datelines.length > 0);
      assert.ok(printAudit.datelines.every((item) => item.keepNext), 'A live dateline can orphan from following content');
      await page.pdf({
        path: path.join(OUT, 'live-editorial-dateline-a4.pdf'),
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.GBPrintPagination?.reset?.());
      const reset = await page.evaluate(() => ({
        wrappers: document.querySelectorAll('[data-gb-print-generated],.gb-print-closing-group').length,
        printAttrs: document.querySelectorAll('[data-print-keep-next],[data-print-flow]').length,
      }));
      assert.equal(reset.wrappers, 0, `Live DOM wrappers did not restore: ${JSON.stringify(reset)}`);
      assert.equal(reset.printAttrs, 0, `Live print attributes did not restore: ${JSON.stringify(reset)}`);
      browserReports.push({ mode: mode.name, browserAssets, audit, pagination, printAudit, reset });
    } else {
      browserReports.push({ mode: mode.name, browserAssets, audit });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  checkedAt: new Date().toISOString(),
  liveUrl: LIVE_URL,
  deployedAfterPoll: live.attempt,
  expected,
  actual: live.actual,
  htmlStatus: live.status,
  serverDatelineCount: live.datelineCount,
  cssStatus: cssResponse.status,
  cssAssertions,
  browsers: browserReports,
};
await fs.writeFile(path.join(OUT, 'live-production-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
