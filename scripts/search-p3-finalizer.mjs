#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const write = process.argv.includes('--write');
const searchPath = 'js/search.js';
const contractPath = 'scripts/search-modal-browser-contract.mjs';

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`[search-p3-finalizer] ${label}: expected exactly one match, got ${count}`);
  return source.replace(oldText, newText);
}

function replaceFirst(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`[search-p3-finalizer] ${label}: marker missing`);
  return source.replace(oldText, newText);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`[search-p3-finalizer] ${label}: start marker missing`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`[search-p3-finalizer] ${label}: end marker missing`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function assertMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`[search-p3-finalizer] ${label}: missing marker ${marker}`);
}

function transformSearch(source) {
  if (!source.includes('function __gbHydratePagefind(')) {
    source = replaceOnce(
      source,
      'function Ee(e){',
      'function __gbHydratePagefind(e,t){var i=new Array(e.length),n=0,r=Math.min(8,e.length);function a(){if(t!==M)return Promise.resolve();var r=n++;return r>=e.length?Promise.resolve():Promise.resolve().then(function(){return e[r].data()}).then(function(e){t===M&&(i[r]=e)}).catch(function(){t===M&&(i[r]=null)}).then(a)}var o=[];for(var c=0;c<r;c++)o.push(a());return Promise.all(o).then(function(){return i.filter(Boolean)})}function Ee(e){',
      'insert bounded Pagefind hydrator',
    );
  }

  if (source.includes('Promise.all(n.map(function(e){return e.data()}))')) {
    source = replaceOnce(
      source,
      'Promise.all(n.map(function(e){return e.data()}))',
      '__gbHydratePagefind(n,t)',
      'replace unbounded Pagefind hydration',
    );
  }

  if (source.includes('E.addEventListener("input",function(){A=E.value.trim(),L.style.display=')) {
    source = replaceOnce(
      source,
      'E.addEventListener("input",function(){A=E.value.trim(),L.style.display=',
      'E.addEventListener("input",function(){A=E.value.trim(),++M,L.style.display=',
      'invalidate stale async work on every input mutation',
    );
  }

  if (source.includes('L.addEventListener("click",function(){E.value="",A="",L.style.display=')) {
    source = replaceOnce(
      source,
      'L.addEventListener("click",function(){E.value="",A="",L.style.display=',
      'L.addEventListener("click",function(){++M,E.value="",A="",L.style.display=',
      'invalidate stale async work on clear button',
    );
  }

  if (source.includes('}),_=0,A.length>=2?xe(A):we(),E.focus()})});')) {
    source = replaceOnce(
      source,
      '}),_=0,A.length>=2?xe(A):we(),E.focus()})});',
      '}),_=0,++M,A.length>=2?xe(A):we(),E.focus()})});',
      'invalidate stale async work on scope changes',
    );
  }

  const feReplacement = 'function fe(e){var t=M;function i(){t===M&&e&&e()}he?i():fetch("/data/search-manifest.json",{cache:"no-cache"}).then(function(e){return e.ok?e.json():null}).then(function(e){ve=e&&Array.isArray(e.items)?e.items:[],he=!0,i()}).catch(function(){console.warn("[BugHunter] Search manifest load failed, retrying…"),setTimeout(function(){fetch("/data/search-manifest.json",{cache:"no-cache"}).then(function(e){return e.ok?e.json():null}).then(function(e){ve=e&&Array.isArray(e.items)?e.items:[],he=!0,i()}).catch(function(){ve=[],he=!1,"function"==typeof showToast&&showToast("Поиск временно недоступен. Обновите страницу.",!1,"toast-error"),i()})},700)})}';
  if (!source.includes('function fe(e){var t=M;function i(){t===M&&e&&e()}')) {
    source = replaceSection(source, 'function fe(e){', 'function me(e){', feReplacement, 'guard manifest callbacks by generation');
  }

  return source;
}

function transformContract(source) {
  source = replaceOnce(
    source,
    `  async function openFixture(configure) {\n    const context = await browser.newContext({ viewport: { width: 960, height: 760 } });\n    const page = await context.newPage();\n    if (configure) await configure(page);\n    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 });\n    await page.waitForFunction(() => window.GBSearch && typeof window.GBSearch.open === 'function');\n    await page.evaluate(() => window.GBSearch.open());\n    await page.waitForFunction(\n      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),\n      null,\n      { timeout: 30_000 },\n    );\n    return { context, page, input: page.locator('.cp-input') };\n  }`,
    `  async function openFixture(configure, viewport = { width: 960, height: 760 }) {\n    const context = await browser.newContext({ viewport });\n    const page = await context.newPage();\n    if (configure) await configure(page);\n    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 });\n    await page.evaluate(() => window.dispatchEvent(new CustomEvent('gb:openSearch')));\n    await page.waitForFunction(\n      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),\n      null,\n      { timeout: 30_000 },\n    );\n    return { context, page, input: page.locator('.cp-input') };\n  }`,
    'open continuation fixtures through public lazy-load contract',
  );

  const assertPaged = `  async function assertPaged(page, total, label) {\n    await page.waitForFunction(({ total, label }) => {\n      const status = document.getElementById('cp-status')?.textContent || '';\n      return document.querySelectorAll('.cp-item[role="option"]').length === 12 &&\n        status === 'Показано 12 из ' + total + ' ' + label &&\n        !!document.querySelector('#cp-more-wrap > .cp-more');\n    }, { total, label }, { timeout: 30_000 });\n    assert.equal(await page.locator('#cp-listbox .cp-more').count(), 0, 'continuation button must stay outside listbox');\n\n    let shown = 12;\n    const windows = [shown];\n    while (shown < total) {\n      await page.locator('#cp-more-wrap > .cp-more').click();\n      shown = Math.min(shown + 12, total);\n      windows.push(shown);\n      await page.waitForFunction(({ shown, total, label }) => {\n        const status = document.getElementById('cp-status')?.textContent || '';\n        const expectedStatus = shown < total\n          ? 'Показано ' + shown + ' из ' + total + ' ' + label\n          : String(total) + ' ' + label;\n        return document.querySelectorAll('.cp-item[role="option"]').length === shown &&\n          status === expectedStatus &&\n          Boolean(document.querySelector('#cp-more-wrap > .cp-more')) === (shown < total);\n      }, { shown, total, label }, { timeout: 30_000 });\n      const ids = await page.locator('.cp-item[role="option"]').evaluateAll((nodes) => nodes.map((node) => node.id));\n      assert.equal(new Set(ids).size, shown, 'continued options must keep unique ids');\n    }\n    return { initial: 12, total, windows };\n  }`;
  source = replaceSection(source, '  async function assertPaged(page, total, label) {', '\n\n  try {', assertPaged, 'make continuation assertion multi-step');

  source = replaceOnce(
    source,
    "  const summary = { browser: browserName, pagefind: null, fallback: null, scripture: null };",
    "  const summary = { browser: browserName, viewport, pagefind: null, fallback: null, scripture: null, staleClear: null, staleShortQuery: null };",
    'record continuation viewport and stale-race coverage',
  );
  source = replaceOnce(
    source,
    'async function runContinuationContract(browserType, browserName, port) {',
    'async function runContinuationContract(browserType, browserName, port, viewport) {',
    'parameterize continuation viewport',
  );

  source = replaceOnce(source, 'Array.from({ length: 16 }, (_, index) => index < 2', 'Array.from({ length: 28 }, (_, index) => index < 2', 'expand Pagefind fixture past two windows');
  source = replaceOnce(source, "summary.pagefind = await assertPaged(page, 15, 'рез.');", "summary.pagefind = await assertPaged(page, 27, 'рез.');", 'expect deduped Pagefind multi-step total');
  source = replaceFirst(source, 'items: Array.from({ length: 16 }, (_, index) => ({', 'items: Array.from({ length: 25 }, (_, index) => ({', 'expand fallback fixture past two windows');
  source = replaceOnce(source, "summary.fallback = await assertPaged(page, 16, 'рез.');", "summary.fallback = await assertPaged(page, 25, 'рез.');", 'expect fallback multi-step total');
  source = replaceOnce(source, 'occurrences: Array.from({ length: 15 }, (_, index) => ({', 'occurrences: Array.from({ length: 25 }, (_, index) => ({', 'expand Scripture fixture past two windows');
  source = replaceOnce(source, "summary.scripture = await assertPaged(page, 15, 'вх.');", "summary.scripture = await assertPaged(page, 25, 'вх.');", 'expect Scripture multi-step total');

  const clearRaceBlock = `\n\n    {\n      const delayedPagefindModule = [\n        'export async function search() {',\n        '  window.__searchP3RaceStarted = (window.__searchP3RaceStarted || 0) + 1;',\n        '  return {',\n        '    results: Array.from({ length: 25 }, (_, index) => ({',\n        '      data: async () => {',\n        '        await new Promise((resolve) => setTimeout(resolve, 220));',\n        '        return {',\n        \"          url: '/fixture/clear-race-' + index + '/',\",\n        \"          meta: { title: 'Clear Race ' + index, author: '', readTime: '1', category: 'Fixture', scripture: '' },\",\n        \"          excerpt: 'Clear Race excerpt ' + index,\",\n        '        };',\n        '      },',\n        '    })),',\n        '  };',\n        '}',\n      ].join('\\n');\n      const { context, page, input } = await openFixture(async (fixturePage) => {\n        await fixturePage.route('**/pagefind/pagefind.js', async (route) => {\n          await route.fulfill({\n            status: 200,\n            contentType: 'text/javascript',\n            body: route.request().method() === 'HEAD' ? '' : delayedPagefindModule,\n          });\n        });\n      });\n\n      await input.fill('clearrace');\n      await page.waitForFunction(() => (window.__searchP3RaceStarted || 0) >= 1, null, { timeout: 30_000 });\n      await page.locator('.cp-clear').click();\n      await page.waitForTimeout(650);\n      assert.equal(await input.inputValue(), '');\n      assert.equal(await page.locator('#cp-more-wrap > .cp-more').count(), 0, 'clear must not resurrect stale continuation');\n      assert.equal(\n        (await page.locator('.cp-item-title').allTextContents()).some((text) => text.includes('Clear Race')),\n        false,\n        'clear must not resurrect stale Pagefind results',\n      );\n      summary.staleClear = true;\n\n      await input.fill('clearrace');\n      await page.waitForFunction(() => (window.__searchP3RaceStarted || 0) >= 2, null, { timeout: 30_000 });\n      await input.fill('x');\n      await page.waitForTimeout(650);\n      assert.equal(await input.inputValue(), 'x');\n      assert.equal(await page.locator('#cp-more-wrap > .cp-more').count(), 0, 'short query must not resurrect stale continuation');\n      assert.equal(\n        (await page.locator('.cp-item-title').allTextContents()).some((text) => text.includes('Clear Race')),\n        false,\n        'short query must not resurrect stale Pagefind results',\n      );\n      summary.staleShortQuery = true;\n      await context.close();\n    }`;
  source = replaceOnce(
    source,
    "      summary.pagefind = await assertPaged(page, 27, 'рез.');\n      await context.close();\n    }",
    "      summary.pagefind = await assertPaged(page, 27, 'рез.');\n      await context.close();\n    }" + clearRaceBlock,
    'insert delayed stale-query race contract',
  );

  source = replaceOnce(
    source,
    "  results.push(await runContinuationContract(chromium, 'chromium', port));\n  results.push(await runContinuationContract(webkit, 'webkit', port));",
    "  for (const [browserType, browserName, viewport] of matrix) {\n    results.push(await runContinuationContract(browserType, browserName, port, viewport));\n  }",
    'run continuation contract on Chromium/WebKit desktop/mobile',
  );

  source = replaceOnce(
    source,
    '    chromiumWebkitDesktopMobile: true,\n',
    '    chromiumWebkitDesktopMobile: true,\n    truthfulContinuation: true,\n    continuationMultiStep: true,\n    continuationDesktopMobile: true,\n    staleAsyncInvalidation: true,\n    boundedPagefindHydration: true,\n',
    'record permanent continuation assertions',
  );
  source = replaceOnce(
    source,
    "  '- Coverage: combobox/listbox ARIA, active descendant, close control, full modal Tab trap, top-layer ordering, 44px targets, focus-visible, focus restoration, Escape/backdrop closure.',",
    "  '- Coverage: combobox/listbox ARIA, active descendant, close control, full modal Tab trap, top-layer ordering, 44px targets, focus-visible, focus restoration, Escape/backdrop closure, truthful multi-step continuation, desktop/mobile continuation, stale async invalidation and bounded Pagefind hydration.',",
    'document continuation coverage in report',
  );

  return source;
}

let searchSource = fs.readFileSync(searchPath, 'utf8');
let contractSource = fs.readFileSync(contractPath, 'utf8');

if (write) {
  searchSource = transformSearch(searchSource);
  contractSource = transformContract(contractSource);
  fs.writeFileSync(searchPath, searchSource);
  fs.writeFileSync(contractPath, contractSource);

  const cacheBust = spawnSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
  if (cacheBust.status !== 0) process.exit(cacheBust.status ?? 1);
} else {
  searchSource = fs.readFileSync(searchPath, 'utf8');
  contractSource = fs.readFileSync(contractPath, 'utf8');
}

for (const [marker, label] of [
  ['function __gbHydratePagefind(e,t)', 'bounded Pagefind hydrator'],
  ['__gbHydratePagefind(n,t)', 'bounded Pagefind hydration call'],
  ['A=E.value.trim(),++M', 'input generation invalidation'],
  ['L.addEventListener("click",function(){++M', 'clear generation invalidation'],
  ['}),_=0,++M,A.length>=2?xe(A):we()', 'scope generation invalidation'],
  ['function fe(e){var t=M;function i(){t===M&&e&&e()}', 'manifest generation guard'],
]) assertMarker(searchSource, marker, label);
if (searchSource.includes('Promise.all(n.map(function(e){return e.data()}))')) {
  throw new Error('[search-p3-finalizer] unbounded Pagefind hydration survived');
}

for (const [marker, label] of [
  ["window.dispatchEvent(new CustomEvent('gb:openSearch'))", 'public lazy-open fixture'],
  ['Array.from({ length: 28 }, (_, index) => index < 2', 'Pagefind multi-window fixture'],
  ["summary.pagefind = await assertPaged(page, 27, 'рез.');", 'Pagefind dedupe total'],
  ["summary.fallback = await assertPaged(page, 25, 'рез.');", 'fallback multi-window total'],
  ["summary.scripture = await assertPaged(page, 25, 'вх.');", 'Scripture multi-window total'],
  ['__searchP3RaceStarted', 'stale async browser fixture'],
  ['continuationMultiStep: true', 'continuation report assertion'],
  ['runContinuationContract(browserType, browserName, port, viewport)', 'mobile/desktop continuation matrix'],
]) assertMarker(contractSource, marker, label);
if (contractSource.includes('await page.waitForFunction(() => window.GBSearch && typeof window.GBSearch.open === \'function\');')) {
  throw new Error('[search-p3-finalizer] pre-open GBSearch wait survived');
}

console.log('[search-p3-finalizer] Search P3 closure markers OK');
