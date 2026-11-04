#!/usr/bin/env node
'use strict';
// Exact public-release witness. Browser reads production normally: no
// route.fulfill, JS replacement, monkey-patching or test-only CSS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'reports', 'live-mobile-print-pdf');
const CORPUS = require('./fixtures/mobile-print-lock-wave49-routes.json');
const HOST = 'https://gospod-bog.ru';
const SHA = String(process.env.GB_EXPECTED_RELEASE_SHA || '').trim();
const SOURCE_SHA = String(process.env.GITHUB_SHA || '').trim();
const A4 = { format: 'A4', printBackground: true };
const representative = new Set([
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/baptisty-rossii/noch-na-kure/',
]);
const PROFILES = [
  { name: 'light-reduced-all73', colorScheme: 'light', reducedMotion: 'reduce', all: true },
  { name: 'light-normal-three', colorScheme: 'light', reducedMotion: 'no-preference' },
  { name: 'dark-reduced-three', colorScheme: 'dark', reducedMotion: 'reduce' },
  { name: 'dark-normal-three', colorScheme: 'dark', reducedMotion: 'no-preference' },
];

function checkInputs() {
  assert.match(SHA, /^[a-f0-9]{40}$/, 'Exact published SHA is required');
  assert.equal(SOURCE_SHA, SHA, 'Workflow source SHA and intended live SHA must agree');
  assert.equal(CORPUS.expectedRoutes, 73);
  assert.equal(CORPUS.entries.length, 73, 'Do not shrink AuditRepo route matrix');
  assert.equal(new Set(CORPUS.entries.map(x => x.path)).size, 73);
  assert.equal(CORPUS.entries.filter(x => x.opener === '#mobPartTocBtn').length, 68);
  assert.equal(CORPUS.entries.filter(x => x.opener === '#hmBottomBtn').length, 5);
  assert.equal(CORPUS.entries.filter(x => representative.has(x.path)).length, 3);
}

async function readLiveManifest() {
  const response = await fetch(HOST + '/deployments/current.json?t=' + Date.now(), {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, 'Live manifest HTTP status');
  const m = await response.json();
  assert.equal(m.repository, 'FedorMilovanov/gb-is-my-strength');
  assert.equal(m.releaseSha, SHA, 'Exact live release SHA');
  assert.equal(m.controlPlaneSha, SHA, 'Exact live control plane SHA');
  return { releaseSha: m.releaseSha, runId: m.workflow?.runId, candidateId: m.artifact?.candidateId };
}

function countPages(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}
function words(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\u00ad\u200b-\u200d]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}
function extractWords(pdf) {
  const result = spawnSync('pdftotext', ['-enc', 'UTF-8', '-layout', '-', '-'], {
    input: pdf, maxBuffer: 32 * 1024 * 1024, timeout: 30000,
  });
  assert.equal(result.error, undefined, 'pdftotext subprocess');
  assert.equal(result.status, 0, 'pdftotext exit 0: ' + String(result.stderr).slice(0,160));
  const tokens = words(result.stdout.toString('utf8'));
  assert(tokens.length >= 100, 'Substantive selectable PDF text');
  return tokens;
}
function anchor(reference, candidate, fraction) {
  const start = Math.max(0, Math.min(reference.length - 24,
    Math.floor(reference.length * fraction) - 12));
  const sample = reference.slice(start, start + 24);
  const haystack = ' ' + candidate.join(' ') + ' ';
  let matched = 0;
  for (let i = 0; i < 24; i += 6) {
    if (haystack.includes(' ' + sample.slice(i, i + 6).join(' ') + ' ')) matched++;
  }
  return { position: fraction, chunksMatched: matched, pass: matched >= 3 };
}
async function snapshot(page) {
  return page.evaluate(() => ({
    overlayOwners: (window.OverlayRuntime?.snapshot() || []).map(x => x.ownerId),
    scrollSources: Object.keys(window.SiteUtils?._scrollLockSources || {}).sort(),
    locked: document.documentElement.getAttribute('data-scroll-locked'),
    bodyPosition: getComputedStyle(document.body).position,
  }));
}

async function verifyRoute(browser, record, profile) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    colorScheme: profile.colorScheme, reducedMotion: profile.reducedMotion,
    locale: 'ru-RU', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(HOST + record.path, {
      waitUntil: 'domcontentloaded', timeout: 40000,
    });
    assert.equal(response?.status(), 200, 'Route HTTP 200');
    await page.waitForFunction(
      () => Boolean(window.OverlayRuntime?.snapshot && window.SiteUtils?.suspendScrollForPrint),
      undefined, { timeout: 20000 }
    );
    await page.evaluate(() => document.fonts.ready);
    assert.equal((await snapshot(page)).locked, null, 'Clean page has no scroll lock');
    const cleanPdf = await page.pdf(A4);
    const cleanPages = countPages(cleanPdf);
    assert(cleanPages > 1, 'Clean PDF must be multi-page');

    await page.locator(record.opener + ':visible').click({ timeout: 15000 });
    await page.waitForFunction(
      owner => window.OverlayRuntime?.isOpen(owner)
        && document.documentElement.getAttribute('data-scroll-locked') === '1',
      record.owner, { timeout: 10000 }
    );
    const before = await snapshot(page);
    assert(before.overlayOwners.includes(record.owner), 'Correct live overlay owner');
    assert(before.scrollSources.includes('overlay:' + record.owner), 'Named scroll-lock source');

    const openedPdf = await page.pdf(A4);
    const openedPages = countPages(openedPdf);
    assert(openedPages > 1, 'No one-page clipping with open overlay');
    assert(Math.abs(openedPages - cleanPages) <= 1,
      'Page count discrepancy: ' + cleanPages + ' vs ' + openedPages);
    assert.deepEqual(await snapshot(page), before,
      'Overlay/lock state must be exactly restored by afterprint');

    const baseline = extractWords(cleanPdf);
    const actual = extractWords(openedPdf);
    const ratio = actual.length / baseline.length;
    assert(ratio >= 0.94 && ratio <= 1.06,
      'Extracted text volume discrepancy: ' + ratio.toFixed(4));
    const anchors = [0.12, 0.50, 0.94].map(f => anchor(baseline, actual, f));
    assert(anchors.every(x => x.pass),
      'First/middle/terminal PDF text anchors must survive overlay printing');
    return {
      route: record.path, profile: profile.name, owner: record.owner, pass: true,
      cleanPages, openedPages, baselineWords: baseline.length,
      openedWords: actual.length, wordRatio: Number(ratio.toFixed(4)),
      textAnchors: anchors,
      cleanPdfSha256: crypto.createHash('sha256').update(cleanPdf).digest('hex'),
      openedPdfSha256: crypto.createHash('sha256').update(openedPdf).digest('hex'),
    };
  } finally {
    await page.close();
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  checkInputs();
  const started = await readLiveManifest();
  const report = {
    schemaVersion: 1, expectedSha: SHA, sourceSha: SOURCE_SHA,
    timestamp: new Date().toISOString(), startManifest: started,
    routeCorpus: CORPUS.provenance,
    method: 'unmodified-live-production-A4-Chromium-mobile-print-media',
    limitation: 'Headless page.pdf exercises the native print lifecycle with open overlay, not a visible OS print dialog click.',
    results: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const profile of PROFILES) {
      const selected = profile.all
        ? CORPUS.entries : CORPUS.entries.filter(x => representative.has(x.path));
      for (const record of selected) {
        try {
          const result = await verifyRoute(browser, record, profile);
          report.results.push(result);
          console.log('PASS ' + result.profile + ' ' + result.route
            + ' PDF=' + result.openedPages + '/' + result.cleanPages);
        } catch (error) {
          const result = { route: record.path, profile: profile.name, pass: false,
            error: String(error.message).slice(0,700) };
          report.results.push(result);
          console.error('FAIL ' + result.profile + ' ' + result.route + ': ' + result.error);
        }
      }
    }
  } finally {
    await browser.close();
    try { report.endManifest = await readLiveManifest(); }
    catch (error) { report.endManifestError = String(error.message).slice(0,700); }
    report.totals = {
      expected: 82, checked: report.results.length,
      passed: report.results.filter(x => x.pass).length,
      failed: report.results.filter(x => !x.pass).length,
    };
    fs.writeFileSync(path.join(OUTPUT, 'witness.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(OUTPUT, 'witness.md'), [
      '# Live mobile PDF witness', '',
      '- Release SHA: ' + SHA,
      '- Start manifest: ' + started.releaseSha,
      '- End manifest: ' + (report.endManifest?.releaseSha || report.endManifestError),
      '- Original AuditRepo corpus: 73 routes, 68 Gill/common and 5 standalone owners',
      '- Extra Light/Dark × reduced/normal representative tests: 9',
      '- PASS: ' + report.totals.passed + '/' + report.totals.checked,
      '- FAIL: ' + report.totals.failed,
      '- Real PDF first/middle/end text anchors at 12%, 50%, 94% compared to unlocked baseline',
      '- Does not modify or replace any production script',
      '',
    ].join('\n'));
  }
  assert.equal(report.totals.checked, 82, 'Full 73+9 matrix required');
  assert.equal(report.totals.failed, 0, 'Every live native PDF case required');
  assert.equal(report.endManifest?.releaseSha, SHA, 'Published SHA must not change during audit');
  console.log('LIVE MOBILE PDF WITNESS 82/82 PASS, release=' + SHA);
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
