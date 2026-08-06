#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const MARKER_SELECTOR = '[data-audit-footnote="40"]';
const TIP_SELECTOR = '.tooltip.gb-floating-tip.is-open';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
};

fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        response.writeHead(404);
        response.end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(target).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function record(checks, id, description, pass, evidence = null) {
  checks.push({ id, area: 'tooltip-handoff', description, pass: Boolean(pass), evidence });
}

async function instrumentStaticFootnote(page, expectedNumber) {
  return page.evaluate((number) => {
    const marker = Array.from(document.querySelectorAll('.fn-marker')).find((candidate) => {
      const directText = Array.from(candidate.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || '')
        .join('')
        .replace(/\s+/g, '')
        .trim();
      return directText === number;
    });
    if (!marker) return false;
    marker.dataset.auditFootnote = number;
    return marker.querySelector('.tooltip') instanceof Element;
  }, expectedNumber);
}

async function waitForProjectionQuiescence(page, quietMs = 350, timeoutMs = 5000) {
  return page.evaluate(({ quietMs, timeoutMs }) => new Promise((resolve) => {
    let quietTimer = 0;
    let timeoutTimer = 0;
    const finish = (quiet) => {
      window.clearTimeout(quietTimer);
      window.clearTimeout(timeoutTimer);
      window.removeEventListener('gb:reader-projection-ready', onProjection);
      resolve({
        quiet,
        eventCount: window.__projectionReadyEvents.length,
        events: window.__projectionReadyEvents.slice(-12),
      });
    };
    const armQuiet = () => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => finish(true), quietMs);
    };
    const onProjection = () => armQuiet();
    window.addEventListener('gb:reader-projection-ready', onProjection);
    timeoutTimer = window.setTimeout(() => finish(false), timeoutMs);
    armQuiet();
  }), { quietMs, timeoutMs });
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function state(page) {
  return page.evaluate(({ markerSelector, tipSelector }) => {
    const directNumber = (marker) => Array.from(marker?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join('')
      .replace(/\s+/g, '')
      .trim();
    const marker = document.querySelector(markerSelector);
    const tip = document.querySelector(tipSelector);
    const openMarker = document.querySelector('.fn-marker[aria-expanded="true"]');
    const rect = tip?.getBoundingClientRect() || null;
    const style = tip ? getComputedStyle(tip) : null;
    const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
    const epsilon = 1;
    return {
      markerOpen: marker?.getAttribute('aria-expanded') === 'true',
      openMarkerNumber: directNumber(openMarker),
      tipOpen: Boolean(tip),
      tipHovered: Boolean(tip?.matches(':hover')),
      tipContainsHit: Boolean(tip && hit && (tip === hit || tip.contains(hit))),
      hit: hit ? {
        tag: hit.tagName,
        id: hit.id || '',
        className: typeof hit.className === 'string' ? hit.className : '',
        footnoteNumber: directNumber(hit.closest?.('.fn-marker')),
      } : null,
      eventCount: window.__projectionReadyEvents.length,
      events: window.__projectionReadyEvents.slice(-12),
      tipText: String(tip?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
      tip: tip && rect && style ? {
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        inViewport:
          rect.left >= -epsilon &&
          rect.top >= -epsilon &&
          rect.right <= window.innerWidth + epsilon &&
          rect.bottom <= window.innerHeight + epsilon,
      } : null,
    };
  }, { markerSelector: MARKER_SELECTOR, tipSelector: TIP_SELECTOR });
}

async function inspectPointerPath(page, from, to, samples = 32) {
  return page.evaluate(({ from, to, samples }) => {
    const directNumber = (marker) => Array.from(marker?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join('')
      .replace(/\s+/g, '')
      .trim();
    const points = [];
    for (let index = 0; index <= samples; index += 1) {
      const ratio = index / samples;
      const x = from.x + (to.x - from.x) * ratio;
      const y = from.y + (to.y - from.y) * ratio;
      const hit = document.elementFromPoint(x, y);
      const marker = hit?.closest?.('.fn-marker') || null;
      points.push({
        index,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        tag: hit?.tagName || '',
        id: hit?.id || '',
        className: typeof hit?.className === 'string' ? hit.className : '',
        footnoteNumber: directNumber(marker),
        insideOpenTip: Boolean(hit?.closest?.('.gb-floating-tip.is-open')),
      });
    }
    return {
      competingFootnotes: [...new Set(points.map((point) => point.footnoteNumber).filter((number) => number && number !== '40'))],
      points,
    };
  }, { from, to, samples });
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
await context.addInitScript(() => {
  window.__projectionReadyEvents = [];
  window.addEventListener('gb:reader-projection-ready', (event) => {
    window.__projectionReadyEvents.push({
      reason: String(event.detail?.reason || 'unspecified'),
      t: Math.round(performance.now()),
      tts: Number(event.detail?.tts || 0),
      sections: Number(event.detail?.sections || 0),
    });
  });
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
const checks = [];

try {
  await page.goto(`${origin}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.GBReaderProjection?.version === 1 && window.GBArticleTooltips?.version >= 13, null, { timeout: 15000 });

  const markerInstrumented = await instrumentStaticFootnote(page, '40');
  const marker = page.locator(MARKER_SELECTOR).first();
  record(checks, 'RPH-01', 'Hermenevtika static footnote marker exists with inline tooltip', markerInstrumented && await marker.count() === 1, { markerInstrumented });
  record(checks, 'RPH-02', 'ReaderProjection v1 is installed', await page.evaluate(() => window.GBReaderProjection?.version === 1));
  record(checks, 'RPH-03', 'Article tooltip owner is installed', await page.evaluate(() => window.GBArticleTooltips?.version >= 13));

  await marker.scrollIntoViewIfNeeded();
  const quiescence = await waitForProjectionQuiescence(page);
  record(checks, 'RPH-04', 'reader projection reaches event quiescence after viewport activation', quiescence.quiet, quiescence);
  const baseline = quiescence.eventCount;
  const markerBox = await marker.boundingBox();
  assert.ok(markerBox, 'footnote marker must have geometry');

  await marker.hover({ force: true });
  await page.waitForFunction((selector) => Boolean(document.querySelector(selector)), TIP_SELECTOR, { timeout: 3000 });
  await twoFrames(page);
  const opened = await state(page);

  record(checks, 'RPH-05', 'hover opens the static footnote tooltip', opened.tipOpen, opened);
  record(checks, 'RPH-06', 'hover keeps marker aria-expanded truthful', opened.markerOpen && opened.openMarkerNumber === '40', opened);
  record(checks, 'RPH-07', 'desktop tooltip is fixed, visible and hit-testable', opened.tip?.position === 'fixed' && opened.tip.display !== 'none' && opened.tip.visibility !== 'hidden' && opened.tip.pointerEvents !== 'none' && opened.tipContainsHit, opened);
  record(checks, 'RPH-08', 'desktop tooltip remains inside the viewport', Boolean(opened.tip?.inViewport && opened.tip.width > 20 && opened.tip.height > 20), opened);
  record(checks, 'RPH-09', 'tooltip extraction does not trigger a projection refresh', opened.eventCount === baseline, { baseline, opened });

  const from = { x: markerBox.x + markerBox.width / 2, y: markerBox.y + markerBox.height / 2 };
  const to = { x: opened.tip.centerX, y: opened.tip.centerY };
  const pointerPath = await inspectPointerPath(page, from, to);
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await twoFrames(page);
  const immediate = await state(page);

  record(checks, 'RPH-10', 'pointer handoff immediately keeps the original tooltip open', immediate.tipOpen && immediate.markerOpen && immediate.openMarkerNumber === '40', { pointerPath, immediate });
  record(checks, 'RPH-11', 'tooltip center owns pointer hit-test after handoff', immediate.tipContainsHit && immediate.tipHovered, { pointerPath, immediate });
  record(checks, 'RPH-12', 'pointer handoff does not trigger a projection refresh', immediate.eventCount === baseline, { baseline, pointerPath, immediate });

  await page.waitForTimeout(700);
  const held = await state(page);
  record(checks, 'RPH-13', 'tooltip stays open beyond the 520ms hover transit window', held.tipOpen && held.tipHovered && held.markerOpen && held.openMarkerNumber === '40', held);
  record(checks, 'RPH-14', 'held tooltip does not trigger a projection refresh', held.eventCount === baseline, { baseline, held });

  await page.mouse.move(from.x, from.y, { steps: 12 });
  await twoFrames(page);
  const returned = await state(page);
  record(checks, 'RPH-15', 'returning from tooltip to the original marker keeps the same tooltip open', returned.tipOpen && returned.markerOpen && returned.openMarkerNumber === '40', returned);

  await page.mouse.move(4, 4, { steps: 8 });
  await page.waitForFunction((selector) => !document.querySelector(selector), TIP_SELECTOR, { timeout: 3000 });
  const closed = await state(page);
  record(checks, 'RPH-16', 'leaving both marker and tooltip closes the tooltip', !closed.tipOpen && !closed.markerOpen, closed);

  const commentBaseline = closed.eventCount;
  await page.evaluate(() => {
    const root = window.GBReaderProjection.getRoot();
    root.appendChild(document.createComment('gb-inline-tooltip-contract'));
  });
  await twoFrames(page);
  const afterComment = await state(page);
  record(checks, 'RPH-17', 'comment placeholders are ignored by the projection observer', afterComment.eventCount === commentBaseline, { commentBaseline, afterComment });

  const semanticBaseline = afterComment.eventCount;
  await page.evaluate(() => {
    const root = window.GBReaderProjection.getRoot();
    const paragraph = document.createElement('p');
    paragraph.id = 'reader-projection-semantic-addition';
    paragraph.textContent = 'СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ';
    root.appendChild(paragraph);
  });
  await page.waitForFunction((baselineCount) => {
    return window.__projectionReadyEvents.length > baselineCount &&
      window.GBReaderProjection.getTtsSegments().some((segment) => segment.text === 'СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ');
  }, semanticBaseline, { timeout: 3000 });
  const semantic = await state(page);
  const semanticIncluded = await page.evaluate(() => window.GBReaderProjection.getTtsSegments()
    .some((segment) => segment.text === 'СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ'));
  record(checks, 'RPH-18', 'real semantic additions still trigger projection refresh', semantic.eventCount > semanticBaseline && semanticIncluded, { semanticBaseline, semanticIncluded, semantic });
  record(checks, 'RPH-19', 'tooltip handoff contract has no uncaught page errors', pageErrors.length === 0, pageErrors);

  await page.screenshot({ path: path.join(REPORTS, 'reader-projection-tooltip-handoff.png'), fullPage: false });
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'tooltip handoff check IDs must be unique');
assert.ok(checks.length >= 19, `tooltip handoff contract requires at least 19 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = {
  sha: process.env.GITHUB_SHA || null,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
};
fs.writeFileSync(path.join(REPORTS, 'reader-projection-tooltip-handoff-contract.json'), JSON.stringify({ summary, checks }, null, 2));
const markdown = [
  '# ReaderProjection tooltip handoff contract',
  '',
  `- SHA: \`${summary.sha || 'local'}\``,
  `- Checks: **${summary.checks}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`,
  '',
  '| ID | Result | Description |',
  '|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`),
].join('\n');
fs.writeFileSync(path.join(REPORTS, 'reader-projection-tooltip-handoff-contract.md'), markdown);
checks.forEach((item) => console.log(`[READER-PROJECTION-HANDOFF] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`));
console.log('[READER-PROJECTION-HANDOFF-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `ReaderProjection tooltip handoff contract failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('ReaderProjection tooltip handoff contract: PASS');
