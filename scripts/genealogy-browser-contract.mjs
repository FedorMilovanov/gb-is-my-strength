#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit, firefox } from 'playwright';
import { assertGenealogyGeometryContract } from './genealogy-geometry-contract.mjs';
import { assertGospelContract } from './genealogy-gospel-contract.mjs';
import { getGospelComparison } from '../src/components/genealogy/gospelSequences.ts';

assertGospelContract();
assertGenealogyGeometryContract();

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'genealogy-browser-contract');
const GENEALOGY_DATA_PATH = path.join(ROOT, 'data', 'genealogy', 'genealogy.json');
const BROWSERS = { chromium, webkit, firefox };
// WebKit emits this delivery diagnostic from ReactFlow's internal observers
// during controlled viewport updates. Keep it visible in the report while
// failing on every other page exception.
const KNOWN_WEBKIT_RESIZE_DIAGNOSTIC = 'ResizeObserver loop completed with undelivered notifications.';
// CSS min-height/min-width is 44px; tolerate sub-pixel engine rounding.
const MIN_TOUCH_TARGET = 43.9;
const browserNames = String(process.env.GENEALOGY_BROWSERS || 'chromium,webkit')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const VIEWPORTS = String(process.env.GENEALOGY_VIEWPORTS || '390x844,1440x1000').split(',').map(value => {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  assert.ok(match, `Invalid genealogy viewport: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
});

function readExpectedPersonNodes() {
  const source = JSON.parse(fs.readFileSync(GENEALOGY_DATA_PATH, 'utf8'));
  const count = Array.isArray(source?.persons) ? source.persons.length : 0;
  assert.ok(count > 0, 'canonical data/genealogy/genealogy.json has no persons');
  return count;
}

const EXPECTED_PERSON_NODES = readExpectedPersonNodes();

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }[extension] || 'application/octet-stream';
}

function resolveRequestPath(urlValue) {
  const url = new URL(urlValue || '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const indexCandidate = path.join(candidate, 'index.html');
  if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) return indexCandidate;
  return null;
}

async function startServer() {
  assert.ok(fs.existsSync(path.join(DIST, 'rodosloviye', 'index.html')), 'dist/rodosloviye/index.html is missing; build production-like dist first');
  const server = http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!filePath) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('Content-Type', contentType(filePath));
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForViewportStable(page) {
  await page.evaluate(async () => {
    const viewport = document.querySelector('.react-flow__viewport');
    if (!viewport) throw new Error('ReactFlow viewport is missing');
    await new Promise((resolve, reject) => {
      let last = '';
      let stableFrames = 0;
      let frames = 0;
      const tick = () => {
        const current = viewport.getAttribute('style') || getComputedStyle(viewport).transform || '';
        stableFrames = current && current === last ? stableFrames + 1 : 0;
        last = current;
        frames += 1;
        if (stableFrames >= 6) return resolve();
        if (frames > 600) return reject(new Error('ReactFlow viewport did not settle'));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

async function waitForAtlasChromeStable(page) {
  await page.evaluate(async () => {
    const selector = '.genealogy-primary-tools button, .genealogy-primary-tools input';
    await new Promise((resolve, reject) => {
      let last = '';
      let stableFrames = 0;
      let frames = 0;
      const tick = () => {
        const current = [...document.querySelectorAll(selector)].map((element) => {
          const rect = element.getBoundingClientRect();
          return [rect.left, rect.top, rect.width, rect.height].join(',');
        }).join('|');
        stableFrames = current && current === last ? stableFrames + 1 : 0;
        last = current;
        frames += 1;
        if (stableFrames >= 4) return resolve();
        if (frames > 600) return reject(new Error('Atlas controls did not settle'));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

async function measurePersonViewport(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.react-flow');
    if (!canvas) throw new Error('ReactFlow root is missing');
    const canvasRect = canvas.getBoundingClientRect();
    const nodes = [...document.querySelectorAll('.react-flow__node')]
      .filter((node) => node.querySelector('.genealogy-node'));

    const visibleIds = [];
    let visibleArea = 0;
    for (const node of nodes) {
      const style = getComputedStyle(node);
      const card = node.querySelector('.genealogy-node');
      const cardStyle = card ? getComputedStyle(card) : null;
      if (
        style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') <= 0
        || !cardStyle || cardStyle.display === 'none' || cardStyle.visibility === 'hidden'
      ) continue;

      const rect = node.getBoundingClientRect();
      const left = Math.max(rect.left, canvasRect.left);
      const right = Math.min(rect.right, canvasRect.right);
      const top = Math.max(rect.top, canvasRect.top);
      const bottom = Math.min(rect.bottom, canvasRect.bottom);
      const area = Math.max(0, right - left) * Math.max(0, bottom - top);
      if (area > 4) {
        visibleIds.push(node.getAttribute('data-id') || node.textContent?.trim().slice(0, 60) || 'unknown');
        visibleArea += area;
      }
    }

    return {
      mountedPersonNodes: nodes.length,
      visiblePersonCards: visibleIds.length,
      visibleIds,
      visibleArea,
      transform: document.querySelector('.react-flow__viewport')?.getAttribute('style') || '',
    };
  });
}

async function assertSplitLifecycle(page, touch) {
  const opener = page.getByTitle('Сравнить Мф/Лк');
  const tour = page.getByTitle('Тур');

  if (touch) await opener.tap();
  else { await opener.focus(); await opener.press('Enter'); }
  const dialog = page.getByRole('dialog', { name: 'Две родословные Христа' });
  await dialog.waitFor({ state: 'visible' });

  const persons = JSON.parse(fs.readFileSync(GENEALOGY_DATA_PATH, 'utf8')).persons;
  const screenshotPrefix = `${page.context().browser().browserType().name()}-${page.viewportSize().width}x${page.viewportSize().height}`;
  for (const range of ['david', 'full']) {
    await dialog.getByRole('button', { name: range === 'david' ? 'От Давида' : 'Полностью', exact: true }).click();
    for (const line of getGospelComparison(persons, range).lines) {
      const entries = dialog.locator(`[data-gospel="${line.id}"] [data-gospel-entry]`);
      assert.deepEqual(await entries.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-person-id'))),
        line.entries.map(entry => entry.personId), `${line.id}/${range}: rendered sequence/order is wrong`);
      assert.deepEqual(await dialog.locator(`[data-gospel="${line.id}"] .genealogy-split-person`).allTextContents(),
        line.entries.map(entry => entry.name), `${line.id}/${range}: displayed names differ from the source`);
    }
    await dialog.screenshot({ path: path.join(REPORT_DIR, `${screenshotPrefix}-${range}.png`), animations: 'disabled' });
  }
  const dialogBounds = await dialog.evaluate(node => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
  assert.ok(dialogBounds.scrollWidth <= dialogBounds.clientWidth, 'comparison overflows horizontally');
  for (const button of await dialog.locator('button').all()) {
    if (!await button.isVisible()) continue;
    const bounds = await button.boundingBox();
    assert.ok(bounds && bounds.width >= MIN_TOUCH_TARGET && bounds.height >= MIN_TOUCH_TARGET, 'comparison button is smaller than 44 CSS px');
  }
  const mobileSwitch = dialog.getByRole('group', { name: 'Показать родословную' });
  if (await mobileSwitch.isVisible()) {
    await mobileSwitch.getByRole('button', { name: 'Лука', exact: true }).click();
    assert.equal(await dialog.getByRole('region', { name: 'Родословие по Матфею' }).isVisible(), false);
    assert.equal(await dialog.getByRole('region', { name: 'Родословие по Луке' }).isVisible(), true);
    await mobileSwitch.getByRole('button', { name: 'Матфей', exact: true }).click();
    assert.equal(await dialog.getByRole('region', { name: 'Родословие по Луке' }).isVisible(), false);
    await mobileSwitch.getByRole('button', { name: 'Обе линии', exact: true }).click();
  }

  assert.equal(await page.evaluate(() => {
    const current = document.activeElement;
    const openDialog = document.querySelector('dialog.genealogy-split-dialog[open]');
    return Boolean(openDialog && current && openDialog.contains(current));
  }), true, 'Split View focus did not enter the modal comparison');

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab');
    const focusState = await page.evaluate(() => {
      const current = document.activeElement;
      const openDialog = document.querySelector('dialog.genealogy-split-dialog[open]');
      return {
        inside: Boolean(openDialog && current && openDialog.contains(current)),
        title: current instanceof HTMLElement ? current.getAttribute('title') : null,
      };
    });
    assert.equal(focusState.inside, true, `Split View Tab ${index + 1} escaped to the covered page`);
    assert.notEqual(focusState.title, 'Тур', `Split View Tab ${index + 1} reached the covered Tour control`);
  }
  assert.equal(await tour.evaluate((node) => document.activeElement === node), false, 'covered Tour control became focused');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await opener.evaluate((node) => document.activeElement === node), true, 'Escape did not restore focus to Split View opener');

  await opener.press('Enter');
  const reopened = page.getByRole('dialog', { name: 'Две родословные Христа' });
  await reopened.waitFor({ state: 'visible' });
  await reopened.getByRole('button', { name: 'Закрыть сравнение' }).click();
  await reopened.waitFor({ state: 'detached' });
  assert.equal(await opener.evaluate((node) => document.activeElement === node), true, 'explicit Split View close did not restore focus to opener');
}

async function assertFocusInteractions(page) {
  await page.getByRole('textbox', { name: 'Поиск по имени' }).fill('Исаак');
  await waitForViewportStable(page);
  await page.locator('.react-flow__node[data-id="isaac"]').click();
  await page.getByRole('complementary', { name: 'Детали: Исаак' }).waitFor({ state: 'visible' });
  const details = page.locator('[data-genealogy-details]');
  const closeBox = await details.getByRole('button', { name: 'Закрыть панель' }).boundingBox();
  assert.ok(closeBox && closeBox.width >= MIN_TOUCH_TARGET && closeBox.height >= MIN_TOUCH_TARGET, 'Person close control is too small');
  assert.equal(await details.getByRole('button', { name: 'Закрыть панель' }).evaluate(node => document.activeElement === node), true,
    'Focus did not enter the person drawer');
  assert.equal(await details.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'Person drawer overflows horizontally');
  await page.locator('[data-genealogy-app]').screenshot({ path: path.join(REPORT_DIR,
    `${page.context().browser().browserType().name()}-${page.viewportSize().width}x${page.viewportSize().height}-details.png`), animations: 'disabled' });
  for (const id of ['abram', 'sarah']) {
    await page.waitForFunction(personId => {
      const node = document.querySelector(`.react-flow__node[data-id="${personId}"] .genealogy-node`);
      return node && Number.parseFloat(getComputedStyle(node).opacity) > 0.5;
    }, id);
  }
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
  const isaacNode = page.locator('.react-flow__node[data-id="isaac"]');
  await page.evaluate(() => {
    window.__genealogyKeyTrace = [];
    document.addEventListener('keydown', event => {
      window.__genealogyKeyTrace.push({ type: event.type, key: event.key, composing: event.isComposing,
        target: event.target instanceof Element ? event.target.closest('.react-flow__node')?.getAttribute('data-id') : null,
        focused: document.activeElement?.getAttribute('data-id') });
    }, true);
    document.addEventListener('focusin', event => {
      window.__genealogyKeyTrace.push({ type: event.type,
        target: event.target instanceof Element ? event.target.closest('.react-flow__node')?.getAttribute('data-id') : null });
    }, true);
  });
  const assertNodeFocus = async (id, message) => {
    // Observe React's completed focus/selection update; do not assume that
    // returning from the browser key dispatch also flushed its render queue.
    await page.waitForFunction(expected => document.activeElement?.getAttribute('data-id') === expected
      && document.querySelector('[data-genealogy-app]')?.getAttribute('data-genealogy-active-person') === expected,
    id, { timeout: 5000 }).catch(() => undefined);
    const state = await page.evaluate(expected => {
      const node = document.querySelector(`.react-flow__node[data-id="${expected}"]`);
      return { focused: document.activeElement?.getAttribute('data-id'),
        selected: document.querySelector('[data-genealogy-app]')?.getAttribute('data-genealogy-active-person'),
        target: node ? { style: node.getAttribute('style'), tabIndex: node.getAttribute('tabindex'),
          visibility: getComputedStyle(node).visibility, width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height } : null,
        keys: window.__genealogyKeyTrace };
    }, id);
    assert.equal(state.focused, id, `${message}; focus state: ${JSON.stringify(state)}`);
    assert.equal(state.selected, id, 'Keyboard focus and selected genealogy person disagree');
  };
  await isaacNode.focus();
  await isaacNode.press('ArrowUp');
  await assertNodeFocus('abram', 'ArrowUp left keyboard focus on Isaac');
  await page.keyboard.press('ArrowUp');
  await assertNodeFocus('terah', 'A second family-navigation key did not reach Terah');
  await page.keyboard.press('Delete');
  assert.equal(await page.locator('.react-flow__node').count(), EXPECTED_PERSON_NODES, 'Read-only atlas allowed a person to be deleted');
  await page.keyboard.press('Enter');
  await page.getByRole('complementary', { name: 'Детали: Фарра' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-genealogy-details]').count(), 0, 'Escape in person details did not close the panel');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-id')), 'terah', 'Person details did not restore node focus');
  await isaacNode.focus();
  await isaacNode.press('Enter');
  await page.getByRole('complementary', { name: 'Детали: Исаак' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
  const opener = page.getByTitle('Сравнить Мф/Лк');
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Две родословные Христа' });
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-genealogy-details]').count(), 0, 'Enter on comparison reopened person details');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await opener.evaluate(node => document.activeElement === node), true);
  const filter = page.getByRole('button', { name: 'Каинова', exact: true });
  await filter.press('Space');
  assert.equal(await filter.getAttribute('aria-pressed'), 'true', 'Space did not activate the filter');
  assert.equal(await page.locator('[data-genealogy-focus-count]').count(), 0, 'Excluded person left stale focus');
  assert.equal(await page.locator('[data-genealogy-details]').count(), 0, 'Excluded person left stale details');
  // Search must reveal a person even when the active filter excludes them.
  await page.getByRole('textbox', { name: 'Поиск по имени' }).fill('Исаак');
  await page.waitForFunction(() => document.querySelector('.genealogy-filter-tools button[aria-pressed="true"]')?.textContent === 'Все');
  await page.waitForFunction(() => document.querySelector('[data-genealogy-app]')?.getAttribute('data-genealogy-level') === '2');
  await waitForViewportStable(page);
  await isaacNode.focus();

  await isaacNode.press('Enter');
  await page.getByRole('complementary', { name: 'Детали: Исаак' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
}


async function assertAtlasNavigation(page, viewport, screenshotPrefix) {
  const app = page.locator('[data-genealogy-app]');
  await app.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-genealogy-app]')?.getAttribute('data-genealogy-level') === '0');
  await waitForAtlasChromeStable(page);
  const overview = await measurePersonViewport(page);
  assert.deepEqual([...overview.visibleIds].sort(), ['adam', 'noah', 'abram', 'david', 'jesus'].sort(), 'Initial L0 must show every story anchor');
  const layout = await page.evaluate(() => ({
    width: window.innerWidth, documentWidth: document.documentElement.scrollWidth,
    appWidth: document.querySelector('[data-genealogy-app]').getBoundingClientRect().width,
  }));
  assert.ok(layout.documentWidth <= layout.width, `Page overflow: ${JSON.stringify(layout)}`);
  for (const button of await app.locator('.genealogy-toolbar button, .genealogy-navigation button').all()) {
    if (!await button.isVisible()) continue;
    const box = await button.boundingBox();
    if (!box || box.width < MIN_TOUCH_TARGET || box.height < MIN_TOUCH_TARGET) {
      throw new Error(`Atlas primary control smaller than 44px: ${JSON.stringify({ text: await button.textContent(), box })}`);
    }
  }
  await page.waitForFunction(() => {
    const controls = [...document.querySelectorAll('.genealogy-primary-tools button, .genealogy-primary-tools input')];
    return controls.length > 0 && controls.every(control => {
      const r = control.getBoundingClientRect();
      return [0.2, 0.5, 0.8].every(fraction => {
        const hit = document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2);
        return hit === control || control.contains(hit);
      });
    });
  }, undefined, { polling: 'raf', timeout: 3000 });
  const controlObstructions = await app.locator('.genealogy-primary-tools button, .genealogy-primary-tools input').evaluateAll(controls =>
    controls.flatMap(control => {
      const r = control.getBoundingClientRect();
      return [0.2, 0.5, 0.8].flatMap(fraction => {
        const hit = document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2);
        return hit && (hit === control || control.contains(hit)) ? [] : [control.getAttribute('title') || control.getAttribute('aria-label')];
      });
    }));
  assert.deepEqual(controlObstructions, [], 'Site controls obscure atlas search or actions');
  const labels = await app.locator('.react-flow__node .genealogy-node').evaluateAll(cards => cards
    .filter(card => getComputedStyle(card).visibility !== 'hidden')
    .map(card => { const r = card.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
  assert.ok(labels.every(r => r.width >= 143.9 && r.height >= 43.9), 'Overview labels became microscopic');
  const obstructed = await app.locator('.react-flow__node').evaluateAll(nodes => nodes.flatMap(node => {
    const card = node.querySelector('.genealogy-node');
    if (!card || getComputedStyle(card).visibility === 'hidden') return [];
    const r = card.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return ['offscreen:' + node.getAttribute('data-id')];
    const hit = document.elementFromPoint(x, y);
    return hit?.closest('.react-flow__node') === node ? [] : [node.getAttribute('data-id')];
  }));
  assert.deepEqual(obstructed, [], 'Overview card is covered by controls or outside the screen');

  await app.screenshot({ path: path.join(REPORT_DIR, `${screenshotPrefix}-overview.png`), animations: 'disabled' });
  const mini = app.getByRole('button', { name: 'Мини-карта', exact: true });
  if (viewport.width < 640) {
    await mini.tap();
    assert.equal(await mini.getAttribute('aria-expanded'), 'true');
    assert.equal(await app.locator('.react-flow__minimap').isVisible(), true, 'Mobile minimap did not open');
    await mini.tap();
  } else {
    assert.equal(await app.locator('.react-flow__minimap').isVisible(), true);
  }
  await page.locator('.react-flow__node[data-id="noah"]').click();
  await page.waitForFunction(() => document.querySelector('[data-genealogy-app]')?.getAttribute('data-genealogy-level') === '2');
  await waitForViewportStable(page);
  assert.ok((await measurePersonViewport(page)).visibleIds.includes('noah'), 'Overview did not open Noah in the detail graph');
  await app.screenshot({ path: path.join(REPORT_DIR, `${screenshotPrefix}-branch.png`), animations: 'disabled' });
  await app.getByRole('button', { name: 'Обзор древа', exact: true }).click();
  await waitForViewportStable(page);
  assert.equal(await app.getAttribute('data-genealogy-level'), '0');
  // Reach L1 through the actual shipped zoom control.
  for (let i = 0; i < 32 && await app.getAttribute('data-genealogy-level') === '0'; i++) {
    await app.locator('.react-flow__controls-zoomin').click();
    await waitForViewportStable(page);
  }
  assert.equal(await app.getAttribute('data-genealogy-level'), '1', 'Zoom controls skip or cannot reach L1');
  await app.getByRole('combobox', { name: 'Перейти к эпохе' }).selectOption('kings');
  await waitForViewportStable(page);
  assert.ok((await measurePersonViewport(page)).visiblePersonCards > 0, 'Era navigation produced an empty viewport');
  await app.getByRole('button', { name: 'Обзор древа', exact: true }).click();
  await waitForViewportStable(page);
  const tour = app.getByTitle('Тур', { exact: true });
  if (viewport.width <= 430) await tour.tap(); else await tour.click();
  await app.getByRole('group', { name: 'Путешествие по родословию' }).waitFor({ state: 'visible' });
  await waitForViewportStable(page);
  assert.ok((await measurePersonViewport(page)).visibleIds.includes('adam'), 'Tour did not reach its first person');
  await app.getByRole('button', { name: 'Закрыть тур' }).click();
  await app.getByRole('button', { name: 'Обзор древа', exact: true }).click();
  await waitForViewportStable(page);

}

async function runViewport(browserName, browserType, baseUrl, viewport) {
  const browser = await browserType.launch({ headless: true });
  const touch = viewport.width <= 430;
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch && browserName !== 'firefox',
    reducedMotion: process.env.GENEALOGY_REDUCED_MOTION === '1' ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const pageErrors = [];
  let phase = 'navigation';
  page.on('pageerror', (error) => pageErrors.push(`[${phase}] ${String(error?.stack || error)}`));

  try {
    const response = await page.goto(`${baseUrl}/rodosloviye/`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} ${viewport.width}x${viewport.height}: /rodosloviye/ did not load successfully`);

    phase = 'initial-settle';
    await page.locator('.react-flow__node .genealogy-node').first().waitFor({ state: 'attached' });
    await waitForViewportStable(page);

    const initial = await measurePersonViewport(page);
    assert.equal(initial.mountedPersonNodes, EXPECTED_PERSON_NODES, `${browserName} ${viewport.width}x${viewport.height}: genealogy dataset mount count diverged from canonical data/genealogy/genealogy.json`);
    assert.ok(initial.visiblePersonCards > 0, `${browserName} ${viewport.width}x${viewport.height}: settled initial viewport contains no visible person cards`);
    assert.ok(initial.visibleArea > 0, `${browserName} ${viewport.width}x${viewport.height}: settled initial viewport has no useful person-card area`);

    phase = 'atlas-navigation';
    await assertAtlasNavigation(page, viewport, `${browserName}-${viewport.width}x${viewport.height}`);
    phase = 'fit-view';
    const fitButton = page.locator('.react-flow__controls-fitview');
    await fitButton.waitFor({ state: 'visible' });
    await fitButton.click();
    await waitForViewportStable(page);
    const afterFit = await measurePersonViewport(page);
    assert.equal(afterFit.mountedPersonNodes, EXPECTED_PERSON_NODES, `${browserName} ${viewport.width}x${viewport.height}: Fit View changed mounted person count relative to canonical dataset`);
    assert.ok(afterFit.visiblePersonCards > 0, `${browserName} ${viewport.width}x${viewport.height}: canonical Fit View contains no visible person cards`);
    assert.ok(afterFit.visibleArea > 0, `${browserName} ${viewport.width}x${viewport.height}: canonical Fit View has no useful person-card area`);

    phase = 'search';
    const search = page.getByRole('textbox', { name: 'Поиск по имени' });
    await search.fill('Адам');
    await waitForViewportStable(page);
    const afterSearch = await measurePersonViewport(page);
    assert.ok(afterSearch.visibleIds.includes('adam'), `${browserName} ${viewport.width}x${viewport.height}: search did not center Adam into the useful viewport`);
    await page.getByText('Все детали', { exact: true }).waitFor({ state: 'visible' });

    await page.locator('[data-genealogy-app]').screenshot({ path: path.join(REPORT_DIR, `${browserName}-${viewport.width}x${viewport.height}-search.png`), animations: 'disabled' });
    if (process.env.GENEALOGY_REDUCED_MOTION === '1') {
      const running = await page.locator('[data-genealogy-app]').evaluate(root =>
        root.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length);
      assert.equal(running, 0, 'Reduced-motion atlas still runs animations');
    }
    phase = 'split-view';
    await assertSplitLifecycle(page, touch);
    phase = 'focus-and-controls';
    await assertFocusInteractions(page);
    phase = 'final';
    const browserDiagnostics = pageErrors.filter(error => browserName === 'webkit' && error.includes(KNOWN_WEBKIT_RESIZE_DIAGNOSTIC));
    const actionablePageErrors = pageErrors.filter(error => !browserDiagnostics.includes(error));
    assert.deepEqual(actionablePageErrors, [], `${browserName} ${viewport.width}x${viewport.height}: uncaught page errors`);

    return { browser: browserName, viewport, touch, mobileEmulation: touch && browserName !== 'firefox',
      reducedMotion: process.env.GENEALOGY_REDUCED_MOTION === '1', initial, afterFit, afterSearch, pageErrors, browserDiagnostics };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const { assertGenealogyFocusContract } = await import('./genealogy-focus-contract.mjs');
  assertGenealogyFocusContract();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const server = await startServer();
  const results = [];
  try {
    for (const browserName of browserNames) {
      const browserType = BROWSERS[browserName];
      assert.ok(browserType, `unsupported browser: ${browserName}`);
      for (const viewport of VIEWPORTS) {
        const result = await runViewport(browserName, browserType, server.baseUrl, viewport);
        results.push(result);
        console.log(`[genealogy] ${browserName} ${viewport.width}x${viewport.height}: expected=${EXPECTED_PERSON_NODES}, initial=${result.initial.visiblePersonCards}, fit=${result.afterFit.visiblePersonCards}, search=${result.afterSearch.visiblePersonCards}`);
      }
    }
  } finally {
    await server.close();
  }

  const report = {
    schemaVersion: 1,
    conclusion: 'success',
    sha: process.env.SOURCE_SHA || '',
    route: '/rodosloviye/',
    expectedPersonNodes: EXPECTED_PERSON_NODES,
    expectedPersonNodesAuthority: 'data/genealogy/genealogy.json#persons.length',
    browsers: browserNames,
    viewports: VIEWPORTS,
    results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('Genealogy browser contract: PASS');
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    schemaVersion: 1,
    conclusion: 'failure',
    sha: process.env.SOURCE_SHA || '',
    route: '/rodosloviye/',
    expectedPersonNodes: EXPECTED_PERSON_NODES,
    expectedPersonNodesAuthority: 'data/genealogy/genealogy.json#persons.length',
    error: String(error?.stack || error),
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
