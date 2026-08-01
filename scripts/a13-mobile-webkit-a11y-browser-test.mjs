#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/a13-mobile-webkit-a11y-scene-matrix.json'), 'utf8'));
const outDir = path.join(ROOT, 'reports/a13-mobile-webkit-a11y');
const results = [], failures = [];
let server, base = process.env.AUDIT_BASE || '';
const note = (scene, browser, route, detail = {}) => results.push({ scene, browser, route, ...detail });
const reject = (where, error) => failures.push(`${where}: ${error instanceof Error ? error.message : error}`);

function validateMatrix() {
  assert.equal(matrix.schema_version, 1);
  assert.equal(matrix.authority_id, 'A13-MOBILE-WEBKIT-A11Y-2026-08-01');
  assert.deepEqual(matrix.browsers, ['chromium', 'webkit']);
  assert.deepEqual(matrix.viewport_contract.narrow_widths, [320, 360, 390]);
  assert.deepEqual(matrix.viewport_contract.breakpoint_widths, [1199, 1200, 1201]);
  assert.equal(matrix.production_claim, false);
  assert.equal(new Set(matrix.routes.map(({ id }) => id)).size, matrix.routes.length);
  assert.equal(new Set(matrix.scenes.map(({ id }) => id)).size, matrix.scenes.length);
}

async function startServer() {
  if (base) return;
  const port = Number(process.env.A13_PORT || 4177);
  base = `http://127.0.0.1:${port}`;
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '-d', 'dist'], { cwd: ROOT });
  for (let i = 0; i < 120; i += 1) {
    try { if ((await fetch(`${base}/`)).status < 500) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('dist server did not become ready');
}

async function stopServer() {
  if (!server) return;
  server.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => server.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 1500))]);
}

async function load(page, route) {
  const response = await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert.ok(response && response.status() < 400, `${route.path} returned ${response?.status() ?? 'no response'}`);
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; }).catch(() => {});
  await page.waitForTimeout(120);
}

async function geometry(page) {
  return page.evaluate(() => {
    const root = document.documentElement, body = document.body;
    const mains = [...document.querySelectorAll('main, [role="main"]')];
    const visible = (element) => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const focusable = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(visible);
    return {
      clientWidth: root.clientWidth,
      scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0),
      scrollHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0),
      mainCount: mains.length,
      visibleMain: mains.some(visible),
      focusableCount: focusable.length,
    };
  });
}

function check(metrics, label) {
  const overflow = metrics.scrollWidth - metrics.clientWidth;
  assert.ok(overflow <= matrix.viewport_contract.max_root_overflow_px, `${label} root overflow ${overflow}px`);
  assert.equal(metrics.mainCount, 1, `${label} main landmarks=${metrics.mainCount}`);
  assert.equal(metrics.visibleMain, true, `${label} main is hidden`);
  assert.ok(metrics.focusableCount > 0, `${label} has no reachable controls`);
  return overflow;
}

async function withContext(browser, options, callback) {
  const context = await browser.newContext({ locale: 'ru-RU', ...options });
  const page = await context.newPage();
  try { return await callback(page); } finally { await context.close(); }
}

async function responsive(name, type) {
  const browser = await type.launch();
  try {
    for (const width of [...matrix.viewport_contract.narrow_widths, ...matrix.viewport_contract.breakpoint_widths]) {
      for (const route of matrix.routes) {
        const label = `${name}/${route.id}/${width}`;
        try {
          await withContext(browser, { viewport: { width, height: 900 } }, async (page) => {
            const errors = []; page.on('pageerror', (error) => errors.push(error.message));
            await load(page, route); const metrics = await geometry(page); const overflow = check(metrics, label);
            assert.deepEqual(errors, [], `${label} page errors: ${errors.join(' | ')}`);
            note('responsive-root-overflow', name, route.id, { width, overflow });
          });
        } catch (error) { reject(label, error); }
      }
    }
  } finally { await browser.close(); }
}

async function zoomEquivalent(name, type) {
  const browser = await type.launch();
  try {
    for (const route of matrix.routes.filter(({ id }) => id !== 'map')) {
      const label = `${name}/${route.id}/zoom-200-layout-equivalent`;
      try {
        await withContext(browser, { viewport: { width: 320, height: 900 }, deviceScaleFactor: 2 }, async (page) => {
          await load(page, route); const metrics = await geometry(page); const overflow = check(metrics, label);
          const focus = await page.evaluate(() => {
            const visible = (element) => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
            const target = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')].find(visible);
            if (!target) return null; target.focus({ preventScroll: true }); const rect = target.getBoundingClientRect();
            return { active: document.activeElement === target, width: rect.width, height: rect.height, dpr: devicePixelRatio };
          });
          assert.ok(focus?.active && focus.dpr >= 1.9, `${label} 2x focus evidence missing`);
          note('zoom-200-layout-equivalent', name, route.id, { width: 320, physicalWidth: 640, overflow, focus });
        });
      } catch (error) { reject(label, error); }
    }
  } finally { await browser.close(); }
}

async function homeModal(name, type) {
  const browser = await type.launch(); const label = `${name}/home/modal`;
  try {
    await withContext(browser, { viewport: { width: 390, height: 900 } }, async (page) => {
      await load(page, matrix.routes.find(({ id }) => id === 'home'));
      await page.locator('#hMobileMenuBtn').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#hMobileMenuBtn')?.getAttribute('aria-expanded') === 'true');
      const opened = await page.evaluate(() => {
        const trigger = document.querySelector('#hMobileMenuBtn'), panel = document.querySelector('#hMobileNav'), content = document.querySelector('.home-v20');
        return { hidden: panel?.getAttribute('aria-hidden'), focusInside: Boolean(panel?.contains(document.activeElement)), inert: content?.hasAttribute('inert'), locks: Number(window.SiteUtils?._scrollLockCount || 0), expanded: trigger?.getAttribute('aria-expanded') };
      });
      assert.deepEqual(opened, { hidden: 'false', focusInside: true, inert: true, locks: 1, expanded: 'true' });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('#hMobileMenuBtn')?.getAttribute('aria-expanded') === 'false');
      const closed = await page.evaluate(() => {
        const trigger = document.querySelector('#hMobileMenuBtn'), panel = document.querySelector('#hMobileNav'), content = document.querySelector('.home-v20');
        return { hidden: panel?.getAttribute('aria-hidden'), focusReturned: document.activeElement === trigger, inert: content?.hasAttribute('inert'), locks: Number(window.SiteUtils?._scrollLockCount || 0) };
      });
      assert.deepEqual(closed, { hidden: 'true', focusReturned: true, inert: false, locks: 0 });
      note('home-mobile-modal-lifecycle', name, 'home', { width: 390, opened, closed });
    });
  } catch (error) { reject(label, error); } finally { await browser.close(); }
}

async function touchWebKit() {
  const browser = await webkit.launch();
  try {
    for (const width of [320, 390]) for (const route of matrix.routes) {
      const label = `webkit/${route.id}/touch-${width}`;
      try {
        await withContext(browser, { viewport: { width, height: 780 }, hasTouch: true, isMobile: true }, async (page) => {
          await load(page, route); const before = await geometry(page); const targetY = Math.min(640, Math.max(0, before.scrollHeight - 780));
          await page.evaluate((y) => scrollTo(0, y), targetY); await page.waitForTimeout(160);
          const after = await geometry(page), scrollY = await page.evaluate(() => window.scrollY), overflow = check(after, label);
          if (targetY > 0) assert.ok(scrollY > 0, `${label} made no vertical progress`);
          note('touch-scroll-webkit', 'webkit', route.id, { width, targetY, scrollY, overflow });
        });
      } catch (error) { reject(label, error); }
    }
  } finally { await browser.close(); }
}

async function mediaScene(scene, name, type, options, mediaQuery) {
  const browser = await type.launch();
  try {
    for (const route of matrix.routes) {
      const label = `${name}/${route.id}/${scene}`;
      try {
        await withContext(browser, { viewport: { width: 390, height: 900 }, ...options }, async (page) => {
          await load(page, route); assert.equal(await page.evaluate((query) => matchMedia(query).matches, mediaQuery), true, `${label} media inactive`);
          let focus = null;
          if (scene === 'forced-colors-focus') {
            await page.keyboard.press('Tab');
            focus = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const r = a.getBoundingClientRect(); return { tag: a.tagName, width: r.width, height: r.height }; });
            assert.ok(focus?.width > 0 && focus?.height > 0, `${label} focus geometry missing`);
          }
          const metrics = await geometry(page), overflow = check(metrics, label);
          note(scene, name, route.id, { width: 390, overflow, focus });
        });
      } catch (error) { reject(label, error); }
    }
  } finally { await browser.close(); }
}

function writeReport() {
  fs.mkdirSync(outDir, { recursive: true });
  const report = { schema_version: 1, authority_id: matrix.authority_id, conclusion: failures.length ? 'failure' : 'success', source_sha: process.env.SOURCE_SHA || '', run_id: process.env.GITHUB_RUN_ID || '', generated_at: new Date().toISOString(), scene_count: matrix.scenes.length, assertion_records: results.length, failures, results };
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'summary.txt'), `A13 Mobile/WebKit/A11y: ${report.conclusion.toUpperCase()}\nScenes: ${report.scene_count}\nAssertion records: ${report.assertion_records}\nFailures: ${failures.length}\n${failures.map((item) => `- ${item}`).join('\n')}\n`);
}

async function main() {
  validateMatrix(); await startServer();
  try {
    await responsive('chromium', chromium); await responsive('webkit', webkit);
    await zoomEquivalent('chromium', chromium); await zoomEquivalent('webkit', webkit);
    await homeModal('chromium', chromium); await homeModal('webkit', webkit); await touchWebKit();
    await mediaScene('reduced-motion', 'chromium', chromium, { reducedMotion: 'reduce' }, '(prefers-reduced-motion: reduce)');
    await mediaScene('reduced-motion', 'webkit', webkit, { reducedMotion: 'reduce' }, '(prefers-reduced-motion: reduce)');
    await mediaScene('forced-colors-focus', 'chromium', chromium, { forcedColors: 'active' }, '(forced-colors: active)');
  } finally { await stopServer(); writeReport(); }
  if (failures.length) { failures.forEach((item) => console.error(`❌ ${item}`)); process.exitCode = 1; }
  else console.log(`A13 MOBILE/WEBKIT/A11Y: PASS (${results.length} records across ${matrix.scenes.length} scenes)`);
}

main().catch(async (error) => { reject('fatal', error); await stopServer(); writeReport(); console.error(error); process.exitCode = 1; });
