#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'interactive-audit');
const BASE = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
const SITE_ID = 'gb-strength';
const STORAGE_PREFIX = `gb:reader-state:v1:${SITE_ID}:`;
const WEBKIT_IGNORED_CONSOLE_ERRORS = new Set([
  'Viewport argument key "interactive-widget" not recognized and ignored.',
]);

if (!BASE) throw new Error('AUDIT_BASE is required for homepage resume browser contract');

const engines = [
  ['chromium', chromium],
  ['webkit', webkit],
];

async function runEngine(name, browserType) {
  const browser = await browserType.launch({ headless: true });
  const now = Date.now();
  const newerKey = `${STORAGE_PREFIX}/articles/resume-browser-newer`;
  const olderKey = `${STORAGE_PREFIX}/articles/resume-browser-older`;
  const seed = {
    [newerKey]: {
      version: 1,
      routePath: '//tampered.example',
      title: 'Resume Browser Newer',
      sectionId: 'part 2',
      sectionTitle: 'Раздел браузерного контракта',
      progress: 61,
      scrollY: 640,
      completed: false,
      savedAt: now,
      dismissedAt: 0,
      source: 'reader-state-v1',
      customField: 'preserve-me',
    },
    [olderKey]: {
      version: 1,
      routePath: '/articles/resume-browser-older',
      title: 'Resume Browser Older',
      sectionId: '',
      sectionTitle: '',
      progress: 27,
      scrollY: 270,
      completed: false,
      savedAt: now - 1000,
      dismissedAt: 0,
      source: 'reader-state-v1',
    },
    [`${STORAGE_PREFIX}/articles/resume-browser-complete`]: {
      version: 1,
      title: 'Must stay hidden complete',
      progress: 100,
      completed: true,
      savedAt: now + 1000,
    },
    [`${STORAGE_PREFIX}//evil.example`]: {
      version: 1,
      title: 'Must stay hidden unsafe',
      progress: 88,
      completed: false,
      savedAt: now + 2000,
    },
    'gb:reader-state:v1:foreign-site:/articles/foreign': {
      version: 1,
      title: 'Must stay hidden foreign',
      progress: 82,
      completed: false,
      savedAt: now + 3000,
    },
  };

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
  });
  const runtimeErrors = [];
  try {
    await context.addInitScript(({ entries }) => {
      for (const [key, value] of entries) localStorage.setItem(key, JSON.stringify(value));
    }, { entries: Object.entries(seed) });

    const page = await context.newPage();
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror:${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (name === 'webkit' && WEBKIT_IGNORED_CONSOLE_ERRORS.has(text)) return;
      runtimeErrors.push(`console:${text}`);
    });

    const response = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert(response && response.ok(), `${name}: homepage request failed (${response?.status() || 'no response'})`);

    const block = page.locator('#resumeReadingBlock');
    const listBlock = page.locator('#resumeListBlock');
    const title = page.locator('#resumeReadingTitle');
    const meta = page.locator('#resumeReadingMeta');
    const progress = page.locator('#resumeReadingProgress');
    const link = page.locator('#resumeReadingLink');
    const dismiss = page.locator('#resumeReadingDismiss');

    await block.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal((await title.textContent())?.trim(), 'Resume Browser Newer', `${name}: newest canonical record did not own primary resume card`);
    assert.equal((await meta.textContent())?.trim(), 'Раздел браузерного контракта · 61% прочитано', `${name}: resume metadata drift`);
    assert.equal(await progress.evaluate((element) => element.style.width), '61%', `${name}: progress width drift`);
    assert.equal(await link.getAttribute('href'), '/articles/resume-browser-newer#part%202', `${name}: storage-key route authority / encoded fragment drift`);
    assert.equal(await link.evaluate((element) => new URL(element.href, location.origin).origin === location.origin), true, `${name}: resume link escaped same origin`);

    await listBlock.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#resumeList .resume-list-item').count(), 1, `${name}: filtered inventory must expose exactly one secondary item`);
    assert.equal((await page.locator('#resumeList .resume-list-item .h-article-title').textContent())?.trim(), 'Resume Browser Older', `${name}: secondary resume item drift`);
    assert.equal(await page.getByText('Must stay hidden complete', { exact: true }).count(), 0, `${name}: completed record leaked into resume UI`);
    assert.equal(await page.getByText('Must stay hidden unsafe', { exact: true }).count(), 0, `${name}: unsafe route leaked into resume UI`);
    assert.equal(await page.getByText('Must stay hidden foreign', { exact: true }).count(), 0, `${name}: foreign-site record leaked into resume UI`);

    await dismiss.click();
    await page.waitForFunction(() => document.querySelector('#resumeReadingTitle')?.textContent?.trim() === 'Resume Browser Older');
    assert.equal(await link.getAttribute('href'), '/articles/resume-browser-older', `${name}: dismiss did not advance to next canonical record`);
    assert.equal(await listBlock.isHidden(), true, `${name}: secondary list stayed visible with one remaining item`);

    const dismissedRecord = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), newerKey);
    assert(dismissedRecord && Number(dismissedRecord.dismissedAt) > 0, `${name}: dismiss did not persist dismissedAt`);
    assert.equal(dismissedRecord.routePath, '/articles/resume-browser-newer', `${name}: dismiss did not repair route authority from storage key`);
    assert.equal(dismissedRecord.progress, 61, `${name}: dismiss destroyed progress`);
    assert.equal(dismissedRecord.scrollY, 640, `${name}: dismiss destroyed restore geometry`);
    assert.equal(dismissedRecord.source, 'reader-state-v1', `${name}: dismiss destroyed source metadata`);
    assert.equal(dismissedRecord.customField, 'preserve-me', `${name}: dismiss destructively rewrote unrelated record metadata`);

    await dismiss.click();
    await page.waitForFunction(() => document.querySelector('#resumeReadingBlock')?.hidden === true);
    assert.equal(await link.getAttribute('href'), null, `${name}: final hidden state retained a stale resume href`);
    assert.deepEqual(runtimeErrors, [], `${name}: runtime errors: ${runtimeErrors.join(' | ')}`);

    await page.close();
    return { browser: name, result: 'PASS' };
  } finally {
    await context.close();
    await browser.close();
  }
}

const results = [];
try {
  for (const [name, browserType] of engines) results.push(await runEngine(name, browserType));
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, 'homepage-resume-browser-contract.json'),
    `${JSON.stringify({ result: 'PASS', sourceSha: process.env.SOURCE_SHA || process.env.GITHUB_SHA || '', results }, null, 2)}\n`,
  );
  console.log(`HOMEPAGE RESUME BROWSER CONTRACT: PASS (${results.map((item) => item.browser).join(', ')})`);
} catch (error) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, 'homepage-resume-browser-contract.json'),
    `${JSON.stringify({ result: 'FAIL', sourceSha: process.env.SOURCE_SHA || process.env.GITHUB_SHA || '', results, error: error.stack || error.message }, null, 2)}\n`,
  );
  throw error;
}
