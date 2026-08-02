#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;
const OUT_ROOT = path.resolve(process.env.AVRAAM_STATIC_OUT || 'reports/atlas/avraam-static-projection');
const HEAD_SHA = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'local';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';

fs.mkdirSync(OUT_ROOT, { recursive: true });
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT_ROOT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const allFailures = [];
const records = [];

function addFailure(scope, message) {
  const value = `${scope}: ${message}`;
  allFailures.push(value);
  return value;
}

function visibleRect(rect, viewport) {
  if (!rect) return false;
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width;
}

async function inspectStaticSurface(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-map-stage]');
    const fallback = document.querySelector('.map-text-fallback');
    const notice = document.querySelector('.map-runtime-noscript');
    const map = document.querySelector('.me-map,#mapRoot');
    const style = fallback ? getComputedStyle(fallback) : null;
    const rect = fallback?.getBoundingClientRect() || null;
    const text = fallback?.innerText || '';
    const controls = Array.from(document.querySelectorAll('button,input,select,[role="button"],[role="tab"]'))
      .filter(node => {
        const css = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity || 1) > 0 && box.width > 0 && box.height > 0;
      });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      },
      stage: stage ? {
        present: true,
        display: getComputedStyle(stage).display,
        visibility: getComputedStyle(stage).visibility,
        rect: stage.getBoundingClientRect().toJSON(),
      } : { present: false },
      mapVisible: Boolean(map && map.getClientRects().length),
      notice: notice ? {
        present: true,
        text: notice.innerText.trim(),
        display: getComputedStyle(notice).display,
        rect: notice.getBoundingClientRect().toJSON(),
      } : { present: false },
      fallback: fallback ? {
        present: true,
        display: style.display,
        visibility: style.visibility,
        position: style.position,
        width: style.width,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        rect: rect.toJSON(),
        textLength: text.length,
        heading: fallback.querySelector('h2')?.textContent?.trim() || '',
        stageHeadings: fallback.querySelectorAll('h3').length,
        sources: fallback.querySelectorAll('ol li').length,
        contains22: text.includes('22 объекта'),
        contains19: text.includes('19 маршрутных'),
        contains3: text.includes('3 контекст'),
      } : { present: false },
      visibleInteractiveControls: controls.length,
    };
  });
}

function verify(scope, snapshot, { print = false } = {}) {
  const failures = [];
  const fail = message => failures.push(addFailure(scope, message));
  if (!snapshot.fallback?.present) fail('text fallback missing');
  if (snapshot.fallback?.present && !visibleRect(snapshot.fallback.rect, snapshot.viewport)) fail('text fallback has no visible rectangle');
  if (snapshot.stage?.present && snapshot.stage.display !== 'none') fail(`interactive stage is not hidden (${snapshot.stage.display})`);
  if (snapshot.mapVisible) fail('interactive map remains visible');
  if (!snapshot.fallback?.contains22) fail('missing exact total: 22 objects');
  if (!snapshot.fallback?.contains19) fail('missing exact route total: 19 route places');
  if (!snapshot.fallback?.contains3) fail('missing exact context total: 3 context points');
  if ((snapshot.fallback?.textLength || 0) < 4000) fail(`fallback text too short (${snapshot.fallback?.textLength || 0})`);
  if ((snapshot.fallback?.stageHeadings || 0) < 8) fail(`stage headings incomplete (${snapshot.fallback?.stageHeadings || 0})`);
  if ((snapshot.fallback?.sources || 0) < 10) fail(`source list incomplete (${snapshot.fallback?.sources || 0})`);
  if (snapshot.document.horizontalOverflow > 2) fail(`horizontal overflow ${snapshot.document.horizontalOverflow}px`);
  const fontSize = Number.parseFloat(snapshot.fallback?.fontSize || '0');
  if (fontSize < (print ? 10 : 14)) fail(`fallback font too small (${snapshot.fallback?.fontSize || 'unknown'})`);
  if (!print && !snapshot.notice?.present) fail('no-JS recovery notice missing');
  if (print && snapshot.visibleInteractiveControls > 0) fail(`interactive controls remain in print (${snapshot.visibleInteractiveControls})`);
  if (print && snapshot.fallback?.position !== 'static') fail(`print fallback position is ${snapshot.fallback?.position}`);
  return failures;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { id: 'nojs-desktop-1440x900', width: 1440, height: 900 },
    { id: 'nojs-mobile-390x844', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      javaScriptEnabled: false,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));
    await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120000 });
    const snapshot = await inspectStaticSurface(page);
    const failures = verify(viewport.id, snapshot);
    if (failedRequests.length) failures.push(addFailure(viewport.id, `failed requests: ${failedRequests.join(' | ')}`));
    await page.screenshot({ path: path.join(OUT_ROOT, `${viewport.id}.png`), fullPage: true });
    records.push({ id: viewport.id, type: 'no-js', snapshot, failures, failedRequests });
    await context.close();
  }

  for (const viewport of [
    { id: 'print-desktop-1440x900', width: 1440, height: 900 },
    { id: 'print-mobile-390x844', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: 'light' });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));
    await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('[data-map-stage]')?.getAttribute('data-map-state') === 'ready', { timeout: 60000 });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    const snapshot = await inspectStaticSurface(page);
    const failures = verify(viewport.id, snapshot, { print: true });
    if (consoleErrors.length) failures.push(addFailure(viewport.id, `console errors: ${consoleErrors.join(' | ')}`));
    if (failedRequests.length) failures.push(addFailure(viewport.id, `failed requests: ${failedRequests.join(' | ')}`));
    await page.screenshot({ path: path.join(OUT_ROOT, `${viewport.id}.png`), fullPage: true });
    records.push({ id: viewport.id, type: 'print-preview', snapshot, failures, consoleErrors, failedRequests });
    await context.close();
  }

  const pdfContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const pdfPage = await pdfContext.newPage();
  await pdfPage.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120000 });
  await pdfPage.waitForFunction(() => document.querySelector('[data-map-stage]')?.getAttribute('data-map-state') === 'ready', { timeout: 60000 });
  await pdfPage.emulateMedia({ media: 'print' });
  const pdfPath = path.join(OUT_ROOT, 'avraam-static-a4.pdf');
  await pdfPage.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
  });
  const pdf = fs.readFileSync(pdfPath);
  const pdfRecord = { id: 'print-a4-pdf', type: 'pdf', bytes: pdf.length, header: pdf.subarray(0, 5).toString('ascii'), failures: [] };
  if (pdfRecord.header !== '%PDF-') pdfRecord.failures.push(addFailure(pdfRecord.id, `invalid PDF header ${JSON.stringify(pdfRecord.header)}`));
  if (pdfRecord.bytes < 20000) pdfRecord.failures.push(addFailure(pdfRecord.id, `PDF too small (${pdfRecord.bytes} bytes)`));
  records.push(pdfRecord);
  await pdfContext.close();
} finally {
  await browser.close();
}

const result = {
  headSha: HEAD_SHA,
  runId: RUN_ID,
  route: ROUTE_URL,
  capturedAt: new Date().toISOString(),
  records,
  failures: allFailures,
};
writeJson('result.json', result);

const lines = [
  '# Avraam static projection witness',
  '',
  `- Head SHA: \`${HEAD_SHA}\``,
  `- Workflow run: \`${RUN_ID}\``,
  `- Route: \`${ROUTE_URL}\``,
  `- Captured at: ${result.capturedAt}`,
  '',
  '| State | Fallback | Text length | H3 | Sources | Horizontal overflow | Failures |',
  '|---|---:|---:|---:|---:|---:|---:|',
];
for (const record of records.filter(item => item.snapshot)) {
  lines.push(`| ${record.id} | ${record.snapshot.fallback?.present ? 'yes' : 'no'} | ${record.snapshot.fallback?.textLength || 0} | ${record.snapshot.fallback?.stageHeadings || 0} | ${record.snapshot.fallback?.sources || 0} | ${record.snapshot.document?.horizontalOverflow || 0}px | ${record.failures.length} |`);
}
const pdf = records.find(item => item.type === 'pdf');
lines.push('', `- PDF: ${pdf?.bytes || 0} bytes; header \`${pdf?.header || 'missing'}\`.`);
lines.push('', '## Failures', '', ...(allFailures.length ? allFailures.map(item => `- ${item}`) : ['- none']));
fs.writeFileSync(path.join(OUT_ROOT, 'SUMMARY.md'), `${lines.join('\n')}\n`, 'utf8');

if (allFailures.length) {
  console.error(allFailures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Avraam static projection witness passed: ${records.length} records.`);
}
