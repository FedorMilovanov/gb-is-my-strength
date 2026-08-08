#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const write = process.argv.includes('--write');
const searchPath = 'js/search.js';
const browserPath = 'scripts/search-modal-browser-contract.mjs';

function count(text, needle) { return text.split(needle).length - 1; }
function once(text, needle, replacement, label) {
  const found = count(text, needle);
  if (found !== 1) throw new Error(`[search-race] ${label}: expected 1 match, got ${found}`);
  return text.replace(needle, replacement);
}

function patchSearch(source) {
  return once(
    source,
    'function __gbSearchExactScripture(e){var t=++M;S.innerHTML=',
    'function __gbSearchExactScripture(e){__gbClearMore();var t=++M;S.innerHTML=',
    'exact Scripture stale continuation clear',
  );
}

function patchBrowser(source) {
  source = once(
    source,
    "  assert.ok(!jsSource.includes('i.results.slice(0,10)'), 'Pagefind pre-hydration cap survived');\n",
    "  assert.ok(!jsSource.includes('i.results.slice(0,10)'), 'Pagefind pre-hydration cap survived');\n  assert.ok(jsSource.includes('function __gbSearchExactScripture(e){__gbClearMore();'), 'exact Scripture must clear stale continuation before async index load');\n",
    'source race assertion',
  );

  source = once(
    source,
    "      const { context, page, input } = await openFixture(async (fixturePage) => {\n        await fixturePage.route('**/data/scripture-search-index.json', async (route) => {\n          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scriptureIndex) });\n        });\n      });\n      await page.locator('[data-scope=\"scripture\"]').click();\n      await input.fill('Иер 17:9');\n      summary.scripture = await assertPaged(page, 15, 'вх.');",
    "      const staleManifest = {\n        items: Array.from({ length: 16 }, (_, index) => ({\n          id: 'stale-' + index,\n          type: 'article',\n          url: '/fixture/stale-' + index + '/',\n          title: 'stalerace ' + index,\n          description: 'stalerace material ' + index,\n          section: 'Fixture',\n          author: 'Fixture Author',\n          priority: 100 - index,\n          tags: ['stalerace'],\n        })),\n      };\n      const { context, page, input } = await openFixture(async (fixturePage) => {\n        await fixturePage.route('**/pagefind/pagefind.js', async (route) => {\n          await route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing in stale continuation fixture' });\n        });\n        await fixturePage.route('**/data/search-manifest.json', async (route) => {\n          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(staleManifest) });\n        });\n        await fixturePage.route('**/data/scripture-search-index.json', async (route) => {\n          await new Promise((resolve) => setTimeout(resolve, 350));\n          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scriptureIndex) });\n        });\n      });\n      await input.fill('stalerace');\n      await page.waitForFunction(() => document.querySelectorAll('.cp-item[role=\"option\"]').length === 12 && !!document.querySelector('#cp-more-wrap > .cp-more'), null, { timeout: 30_000 });\n      await page.locator('[data-scope=\"scripture\"]').click();\n      assert.equal(await page.locator('#cp-more-wrap > .cp-more').count(), 0, 'exact Scripture must clear stale continuation before index response');\n      await input.fill('Иер 17:9');\n      summary.scripture = await assertPaged(page, 15, 'вх.');",
    'delayed Scripture race fixture',
  );
  return source;
}

function validate(search, browser) {
  if (!search.includes('function __gbSearchExactScripture(e){__gbClearMore();')) throw new Error('[search-race] runtime clear missing');
  for (const marker of [
    'exact Scripture must clear stale continuation before async index load',
    'exact Scripture must clear stale continuation before index response',
    'setTimeout(resolve, 350)',
    "await input.fill('stalerace')",
  ]) if (!browser.includes(marker)) throw new Error('[search-race] browser marker missing: ' + marker);
}

let search = fs.readFileSync(searchPath, 'utf8');
let browser = fs.readFileSync(browserPath, 'utf8');
if (write) {
  search = patchSearch(search);
  browser = patchBrowser(browser);
  validate(search, browser);
  fs.writeFileSync(searchPath, search);
  fs.writeFileSync(browserPath, browser);
  console.log('[search-race] applied');
} else {
  validate(search, browser);
  console.log('[search-race] final contract OK');
}
