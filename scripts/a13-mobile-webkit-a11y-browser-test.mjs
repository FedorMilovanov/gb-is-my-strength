#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/a13-mobile-webkit-a11y-scene-matrix.json'), 'utf8'));
const outDir = path.join(ROOT, 'reports/a13-mobile-webkit-a11y');
const results = [];
const failures = [];
let server = null;
let base = process.env.AUDIT_BASE || '';

const note = (scene, browser, route, detail = {}) => results.push({ scene, browser, route, ...detail });
const reject = (where, error) => failures.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateMatrix() {
  assert.equal(matrix.schema_version, 1);
  assert.equal(matrix.authority_id, 'A13-MOBILE-WEBKIT-A11Y-2026-08-01');
  assert.deepEqual(matrix.browsers, ['chromium', 'webkit']);
  assert.deepEqual(matrix.viewport_contract.narrow_widths, [320, 360, 390]);
  assert.deepEqual(matrix.viewport_contract.breakpoint_widths, [1199, 1200, 1201]);
  assert.equal(matrix.production_claim, false);
  assert.equal(new Set(matrix.routes.map(({ id }) => id)).size, matrix.routes.length, 'route ids must be unique');
  assert.equal(new Set(matrix.scenes.map(({ id }) => id)).size, matrix.scenes.length, 'scene ids must be unique');
}

function probeServer(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 1000 }, (response) => {
      response.resume();
      resolve(Number(response.statusCode || 500) < 500);
    });
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => resolve(false));
  });
}

async function startServer() {
  if (base) return;
  const port = Number(process.env.A13_PORT || 4177);
  base = `http://127.0.0.1:${port}`;
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '-d', 'dist'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`dist server exited ${server.exitCode}: ${stderr.trim()}`);
    if (await probeServer(`${base}/`)) return;
    await sleep(250);
  }
  throw new Error(`dist server did not become ready: ${stderr.trim()}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    sleep(1500),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function load(page, route) {
  const response = await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.ok(response && response.status() < 400, `${route.path} returned ${response?.status() ?? 'no response'}`);
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; }).catch(() => {});
  await page.waitForTimeout(120);
}

async function geometry(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const mains = [...document.querySelectorAll('main, [role="main"]')];
    const applications = [...document.querySelectorAll('[role="application"]')];
    const focusable = [...document.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )].filter(visible);
    return {
      clientWidth: root.clientWidth,
      scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0),
      scrollHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0),
      mainCount: mains.length,
      visibleMain: mains.some(visible),
      applicationCount: applications.length,
      visibleApplication: applications.some(visible),
      focusableCount: focusable.length,
    };
  });
}

function checkGeometry(metrics, label, route) {
  const overflow = metrics.scrollWidth - metrics.clientWidth;
  assert.ok(
    overflow <= matrix.viewport_contract.max_root_overflow_px,
    `${label} root overflow ${overflow}px (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`,
  );
  if (route.surface === 'application') {
    assert.equal(metrics.applicationCount, 1, `${label} application landmarks=${metrics.applicationCount}`);
    assert.equal(metrics.visibleApplication, true, `${label} application landmark is hidden`);
  } else {
    assert.equal(metrics.mainCount, 1, `${label} main landmarks=${metrics.mainCount}`);
    assert.equal(metrics.visibleMain, true, `${label} main is hidden`);
  }
  assert.ok(metrics.focusableCount > 0, `${label} has no reachable controls`);
  return overflow;
}

async function withContext(browser, options, callback) {
  const context = await browser.newContext({ locale: 'ru-RU', ...options });
  const page = await context.newPage();
  try {
    return await callback(page);
  } finally {
    await context.close();
  }
}

async function responsive(browserName, browserType) {
  const browser = await browserType.launch({ headless: true });
  try {
    const widths = [...matrix.viewport_contract.narrow_widths, ...matrix.viewport_contract.breakpoint_widths];
    for (const width of widths) {
      for (const route of matrix.routes) {
        const label = `${browserName}/${route.id}/${width}`;
        try {
          await withContext(browser, { viewport: { width, height: 900 } }, async (page) => {
            const pageErrors = [];
            page.on('pageerror', (error) => pageErrors.push(error.message));
            await load(page, route);
            const metrics = await geometry(page);
            const overflow = checkGeometry(metrics, label, route);
            assert.deepEqual(pageErrors, [], `${label} page errors: ${pageErrors.join(' | ')}`);
            note('responsive-root-overflow', browserName, route.id, { width, overflow, metrics });
          });
        } catch (error) {
          reject(label, error);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

async function zoomEquivalent(browserName, browserType) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const route of matrix.routes.filter(({ id }) => id !== 'map')) {
      const label = `${browserName}/${route.id}/zoom-200-layout-equivalent`;
      try {
        await withContext(browser, {
          viewport: { width: 320, height: 900 },
          deviceScaleFactor: 2,
        }, async (page) => {
          await load(page, route);
          const metrics = await geometry(page);
          const overflow = checkGeometry(metrics, label, route);
          const focus = await page.evaluate(() => {
            const visible = (element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const target = [...document.querySelectorAll(
              'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
            )].find(visible);
            if (!target) return null;
            target.focus({ preventScroll: true });
            const rect = target.getBoundingClientRect();
            return {
              active: document.activeElement === target,
              width: rect.width,
              height: rect.height,
              dpr: devicePixelRatio,
            };
          });
          assert.ok(focus?.active && focus.dpr >= 1.9, `${label} 2x focus evidence missing`);
          note('zoom-200-layout-equivalent', browserName, route.id, {
            cssWidth: 320,
            physicalWidth: 640,
            scale: 2,
            overflow,
            focus,
          });
        });
      } catch (error) {
        reject(label, error);
      }
    }
  } finally {
    await browser.close();
  }
}

async function homeModal(browserName, browserType) {
  const browser = await browserType.launch({ headless: true });
  const label = `${browserName}/home/modal`;
  try {
    await withContext(browser, { viewport: { width: 390, height: 900 } }, async (page) => {
      const home = matrix.routes.find(({ id }) => id === 'home');
      await load(page, home);
      const trigger = page.locator('#hMobileMenuBtn');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#hMobileMenuBtn')?.getAttribute('aria-expanded') === 'true');
      const opened = await page.evaluate(() => {
        const button = document.querySelector('#hMobileMenuBtn');
        const panel = document.querySelector('#hMobileNav');
        const content = document.querySelector('.home-v20');
        const html = document.documentElement;
        const body = document.body;
        return {
          expanded: button?.getAttribute('aria-expanded'),
          hidden: panel?.getAttribute('aria-hidden'),
          focusInside: Boolean(panel?.contains(document.activeElement)),
          backgroundInert: Boolean(content?.hasAttribute('inert')),
          scrollLocked: html.getAttribute('data-scroll-locked') === '1'
            && body.style.position === 'fixed'
            && body.style.overflow === 'hidden',
        };
      });
      assert.deepEqual(opened, {
        expanded: 'true',
        hidden: null,
        focusInside: true,
        backgroundInert: true,
        scrollLocked: true,
      });

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('#hMobileMenuBtn')?.getAttribute('aria-expanded') === 'false');
      const closed = await page.evaluate(() => {
        const button = document.querySelector('#hMobileMenuBtn');
        const panel = document.querySelector('#hMobileNav');
        const content = document.querySelector('.home-v20');
        const html = document.documentElement;
        const body = document.body;
        return {
          expanded: button?.getAttribute('aria-expanded'),
          hidden: panel?.getAttribute('aria-hidden'),
          focusReturned: document.activeElement === button,
          backgroundInert: Boolean(content?.hasAttribute('inert')),
          scrollLocked: html.getAttribute('data-scroll-locked') === '1'
            || body.style.position === 'fixed'
            || body.style.overflow === 'hidden',
        };
      });
      assert.deepEqual(closed, {
        expanded: 'false',
        hidden: 'true',
        focusReturned: true,
        backgroundInert: false,
        scrollLocked: false,
      });
      note('home-mobile-modal-lifecycle', browserName, 'home', { width: 390, opened, closed });
    });
  } catch (error) {
    reject(label, error);
  } finally {
    await browser.close();
  }
}

async function touchWebKit() {
  const browser = await webkit.launch({ headless: true });
  try {
    for (const width of [320, 390]) {
      for (const route of matrix.routes) {
        const label = `webkit/${route.id}/touch-${width}`;
        try {
          await withContext(browser, {
            viewport: { width, height: 780 },
            hasTouch: true,
            isMobile: true,
          }, async (page) => {
            await load(page, route);
            const before = await geometry(page);
            const targetY = Math.min(640, Math.max(0, before.scrollHeight - 780));
            await page.evaluate((y) => scrollTo(0, y), targetY);
            await page.waitForTimeout(160);
            const after = await geometry(page);
            const scrollY = await page.evaluate(() => window.scrollY);
            const overflow = checkGeometry(after, label, route);
            if (targetY > 0) assert.ok(scrollY > 0, `${label} made no vertical scroll progress`);
            note('touch-scroll-webkit', 'webkit', route.id, { width, targetY, scrollY, overflow });
          });
        } catch (error) {
          reject(label, error);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

async function mediaScene(scene, browserName, browserType, options, mediaQuery) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const route of matrix.routes) {
      const label = `${browserName}/${route.id}/${scene}`;
      try {
        await withContext(browser, { viewport: { width: 390, height: 900 }, ...options }, async (page) => {
          await load(page, route);
          const active = await page.evaluate((query) => matchMedia(query).matches, mediaQuery);
          assert.equal(active, true, `${label} media query is inactive`);
          let focus = null;
          if (scene === 'forced-colors-focus') {
            await page.keyboard.press('Tab');
            focus = await page.evaluate(() => {
              const element = document.activeElement;
              if (!element || element === document.body) return null;
              const rect = element.getBoundingClientRect();
              return { tag: element.tagName, width: rect.width, height: rect.height };
            });
            assert.ok(focus?.width > 0 && focus?.height > 0, `${label} focus geometry missing`);
          }
          const metrics = await geometry(page);
          const overflow = checkGeometry(metrics, label, route);
          note(scene, browserName, route.id, { width: 390, overflow, focus });
        });
      } catch (error) {
        reject(label, error);
      }
    }
  } finally {
    await browser.close();
  }
}

function writeReport() {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    schema_version: 1,
    authority_id: matrix.authority_id,
    conclusion: failures.length ? 'failure' : 'success',
    source_sha: process.env.SOURCE_SHA || '',
    run_id: process.env.GITHUB_RUN_ID || '',
    generated_at: new Date().toISOString(),
    scene_count: matrix.scenes.length,
    assertion_records: results.length,
    failures,
    results,
  };
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, 'summary.txt'),
    [
      `A13 Mobile/WebKit/A11y: ${report.conclusion.toUpperCase()}`,
      `Scenes: ${report.scene_count}`,
      `Assertion records: ${report.assertion_records}`,
      `Failures: ${failures.length}`,
      ...failures.map((item) => `- ${item}`),
      '',
    ].join('\n'),
  );
}

async function main() {
  validateMatrix();
  await startServer();
  try {
    await responsive('chromium', chromium);
    await responsive('webkit', webkit);
    await zoomEquivalent('chromium', chromium);
    await zoomEquivalent('webkit', webkit);
    await homeModal('chromium', chromium);
    await homeModal('webkit', webkit);
    await touchWebKit();
    await mediaScene('reduced-motion', 'chromium', chromium, { reducedMotion: 'reduce' }, '(prefers-reduced-motion: reduce)');
    await mediaScene('reduced-motion', 'webkit', webkit, { reducedMotion: 'reduce' }, '(prefers-reduced-motion: reduce)');
    await mediaScene('forced-colors-focus', 'chromium', chromium, { forcedColors: 'active' }, '(forced-colors: active)');
  } finally {
    await stopServer();
    writeReport();
  }

  if (failures.length) {
    failures.forEach((item) => console.error(`❌ ${item}`));
    process.exitCode = 1;
  } else {
    console.log(`A13 MOBILE/WEBKIT/A11Y: PASS (${results.length} records across ${matrix.scenes.length} scenes)`);
  }
}

main().catch(async (error) => {
  reject('fatal', error);
  await stopServer();
  writeReport();
  console.error(error);
  process.exitCode = 1;
});
