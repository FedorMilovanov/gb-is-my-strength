// Private Reader PDF staging; never publishes, grants rights or touches dist.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = text => text.normalize('NFKC').replace(/[\s\u00ad]+/g, '');

export async function stageReaderPdf({ root, origin, route, revision, expectedTextHash, pdfTextCommand = 'pdftotext' }) {
  root = resolve(root);
  assert(/^\/(?:[a-z0-9-]+\/)+$/.test(route), 'invalid reader route');
  assert(/^[a-f0-9]{40}$/.test(revision), 'exact revision required');
  assert(/^[a-f0-9]{64}$/.test(expectedTextHash), 'independently reviewed expected text hash required');
  const host = new URL(origin);
  assert(host.protocol === 'http:' && host.hostname === '127.0.0.1' && host.origin === origin,
    'local isolated production-like preview only');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), revision);
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim(), '', 'dirty source');
  const require = createRequire(join(root, 'package.json'));
  const { buildPublicSurfaceRegistry } = require('./scripts/lib/public-surface-registry.js');
  const registry = buildPublicSurfaceRegistry();
  assert.deepEqual(registry.errors, []);
  const surface = registry.entries.find(e => e.route === route);
  assert(surface?.routeRole === 'reading' && surface.owner === 'astro' && surface.status === 'production-dist');
  const pageBytes = readFileSync(join(root, 'dist', route, 'index.html'));
  const url = origin + route + '?reader-pilot=0';
  const response = await fetch(url, { redirect: 'error' });
  assert(response.ok && Buffer.from(await response.arrayBuffer()).equals(pageBytes), 'preview HTML differs from dist');
  const dir = mkdtempSync(join(tmpdir(), 'gb-reader-pdf-stage-'));
  const { chromium } = require('playwright');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      try {
        await context.route('**/*', request => {
          const u = new URL(request.request().url());
          return u.origin === origin || ['data:', 'blob:'].includes(u.protocol) ? request.continue() : request.abort();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const nav = await page.goto(url, { waitUntil: 'domcontentloaded' });
        assert(nav?.ok() && Buffer.from(await nav.body()).equals(pageBytes), 'browser HTML differs from dist');
        await page.waitForFunction(() => !!window.GBPrintEngine?.prepare);
        const native = await page.evaluate(async () => {
          await document.fonts.ready;
          return !document.querySelector('#npUniversalDemo') &&
            !document.body.classList.contains('np-w57-ready') &&
            ![...document.querySelectorAll('link[data-gb-reader-desktop-css]')].some(l => matchMedia(l.media).matches);
        });
        assert(native, 'staging renderer must be native, not screen ARGON');
        const file = join(dir, width + '.pdf');
        const bytes = await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true, printBackground: true });
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        const text = execFileSync(pdfTextCommand, ['-enc', 'UTF-8', '-layout', file, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        const normalized = normalize(text);
        assert.equal(hash(normalized), expectedTextHash, 'PDF text diverged from reviewed content');
        assert.deepEqual(errors, [], 'browser page errors');
        const pages = text.split('\f').filter(p => p.trim()).length;
        assert(pages > 0);
        results.push({ width, file, pages, bytes: bytes.length, sha256: hash(bytes), textHash: hash(normalized) });
      } finally { await context.close(); }
    }
    assert.equal(results[0].pages, results[1].pages, 'page count differs by viewport');
    const receipt = { scope: 'private-qa-only', publicDistributionApproved: false, revision, route,
      rendererProfile: 'reader-native-a4-v1', browser: browser.version(), sourceHash: hash(pageBytes), results };
    writeFileSync(join(dir, 'receipt.json'), JSON.stringify(receipt, null, 2));
    return { dir, ...receipt };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  } finally { await browser?.close(); }
}
