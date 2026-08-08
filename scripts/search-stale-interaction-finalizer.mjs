#!/usr/bin/env node
import fs from 'node:fs';

const WRITE = process.argv.includes('--write');
if (!WRITE) {
  console.error('usage: node scripts/search-stale-interaction-finalizer.mjs --write');
  process.exit(2);
}

function replaceExactly(source, before, after, label) {
  const first = source.indexOf(before);
  const last = source.lastIndexOf(before);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one structural marker, found ${first < 0 ? 0 : 'multiple'}`);
  }
  if (source.includes(after)) {
    throw new Error(`${label}: replacement already present before transaction`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const searchPath = 'js/search.js';
let search = fs.readFileSync(searchPath, 'utf8');

search = replaceExactly(
  search,
  'var __gbSearchPageSize=12;function __gbClearMore(){More&&(More.innerHTML="")}function __gbGroupTotal',
  'var __gbSearchPageSize=12;function __gbClearMore(){More&&(More.innerHTML="")}function __gbInvalidateVisibleResults(){__gbClearMore(),j=[],_=0,E.removeAttribute("aria-activedescendant"),S.innerHTML="",T.textContent="",ce()}function __gbGroupTotal',
  'insert stale interactive-state invalidator',
);
search = replaceExactly(
  search,
  'function xe(e){__gbClearMore();if(e&&!(e.length<2))',
  'function xe(e){__gbInvalidateVisibleResults();if(e&&!(e.length<2))',
  'route every query execution through stale-state invalidation',
);
search = replaceExactly(
  search,
  'function __gbSearchExactScripture(e){__gbClearMore();var t=++M;',
  'function __gbSearchExactScripture(e){__gbInvalidateVisibleResults();var t=++M;',
  'invalidate stale state before exact Scripture async lookup',
);
search = replaceExactly(
  search,
  'E.addEventListener("input",function(){A=E.value.trim(),++M,__gbClearMore(),L.style.display=A?"":"none",clearTimeout(q),_=0,q=setTimeout',
  'E.addEventListener("input",function(){A=E.value.trim(),++M,__gbInvalidateVisibleResults(),L.style.display=A?"":"none",clearTimeout(q),_=0,q=setTimeout',
  'invalidate stale state synchronously on input mutation',
);

fs.writeFileSync(searchPath, search);

const browserPath = 'scripts/search-modal-browser-contract.mjs';
let browser = fs.readFileSync(browserPath, 'utf8');

browser = replaceExactly(
  browser,
  "  assert.ok(jsSource.includes('function __gbSearchExactScripture(e){__gbClearMore();'), 'exact Scripture must clear stale continuation before async index load');",
  "  assert.ok(jsSource.includes('function __gbInvalidateVisibleResults(){__gbClearMore(),j=[],_=0,E.removeAttribute(\"aria-activedescendant\"),S.innerHTML=\"\",T.textContent=\"\",ce()}'), 'query mutation must invalidate stale interactive result state');\n  assert.ok(jsSource.includes('function __gbSearchExactScripture(e){__gbInvalidateVisibleResults();'), 'exact Scripture must invalidate stale interactive state before async index load');",
  'strengthen browser source markers for stale interactive state',
);
browser = replaceExactly(
  browser,
  "  const summary = { browser: browserName, viewport, pagefind: null, fallback: null, scripture: null, staleClear: null, staleShortQuery: null };",
  "  const summary = { browser: browserName, viewport, pagefind: null, fallback: null, scripture: null, staleClear: null, staleShortQuery: null, staleKeyboard: null };",
  'extend continuation summary with stale keyboard witness',
);
browser = replaceExactly(
  browser,
  "        'export const __fixture = \"pagefind-stale-query\";',\n        'export async function search() {',",
  "        'export const __fixture = \"pagefind-stale-query\";',\n        'export async function search(query) {',",
  'make stale-query fixture query-aware',
);
browser = replaceExactly(
  browser,
  "        '        await new Promise((resolve) => setTimeout(resolve, 220));',",
  "        \"        if (query !== 'seedrace') await new Promise((resolve) => setTimeout(resolve, 220));\",",
  'delay only the mutated stale query',
);
browser = replaceExactly(
  browser,
  "      await page.waitForFunction(() => window.__pagefind__?.__fixture === 'pagefind-stale-query', null, { timeout: 30_000 });\n      await input.fill('clearrace');\n      await page.waitForFunction(() => (window.__searchP3RaceStarted || 0) >= 1, null, { timeout: 30_000 });",
  "      await page.waitForFunction(() => window.__pagefind__?.__fixture === 'pagefind-stale-query', null, { timeout: 30_000 });\n      await input.fill('seedrace');\n      await page.waitForFunction(() => document.querySelectorAll('.cp-item[role=\\\"option\\\"]').length === 12 && !!document.querySelector('#cp-read-btn'), null, { timeout: 30_000 });\n      const beforeStaleMutationUrl = page.url();\n      await input.fill('clearrace');\n      assert.equal(await page.locator('.cp-item[role=\\\"option\\\"]').count(), 0, 'query mutation must remove stale options immediately');\n      assert.equal(await input.getAttribute('aria-activedescendant'), null, 'query mutation must clear stale active descendant immediately');\n      assert.equal(await page.locator('#cp-read-btn').count(), 0, 'query mutation must clear stale preview action immediately');\n      assert.equal(await page.locator('#cp-more-wrap > .cp-more').count(), 0, 'query mutation must clear stale continuation immediately');\n      await page.waitForFunction(() => (window.__searchP3RaceStarted || 0) >= 2, null, { timeout: 30_000 });\n      await input.press('Enter');\n      assert.equal(page.url(), beforeStaleMutationUrl, 'Enter during pending hydration must not navigate to a stale result');\n      assert.equal(await page.locator('.cp-backdrop.is-open').count(), 1, 'Enter during pending hydration must keep Search open');\n      summary.staleKeyboard = true;",
  'add stale keyboard and preview invalidation witness',
);
browser = replaceExactly(
  browser,
  "      summary.staleClear = true;\n\n      await input.fill('clearrace');\n      await page.waitForFunction(() => (window.__searchP3RaceStarted || 0) >= 2, null, { timeout: 30_000 });",
  "      summary.staleClear = true;\n\n      await input.fill('clearrace');\n      await page.waitForFunction(() => (window.__searchP3RaceStarted || 0) >= 3, null, { timeout: 30_000 });",
  'advance race counter after seed query',
);
browser = replaceExactly(
  browser,
  '    staleAsyncInvalidation: true,\n    boundedPagefindHydration: true,',
  '    staleAsyncInvalidation: true,\n    staleInteractiveInvalidation: true,\n    boundedPagefindHydration: true,',
  'record stale interactive invalidation contract',
);
browser = replaceExactly(
  browser,
  'truthful multi-step continuation, desktop/mobile continuation, stale async invalidation and bounded Pagefind hydration.',
  'truthful multi-step continuation, desktop/mobile continuation, stale async/interactive invalidation and bounded Pagefind hydration.',
  'document stale interactive coverage',
);

fs.writeFileSync(browserPath, browser);

console.log('SEARCH STALE INTERACTION FINALIZER: structural patch applied');
