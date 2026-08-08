#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/search-modal-browser-contract.mjs';
const write = process.argv.includes('--write');

function count(text, needle) { return text.split(needle).length - 1; }
function once(text, needle, replacement, label) {
  const found = count(text, needle);
  if (found !== 1) throw new Error(`[search-p3-pagefind-fixture] ${label}: expected exactly 1 match, got ${found}`);
  return text.replace(needle, replacement);
}

function transform(source) {
  source = once(
    source,
    "    const context = await browser.newContext({ viewport });",
    "    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });",
    'block service workers in synthetic continuation contexts',
  );

  source = once(
    source,
    "        hasPagefind: !!window.__pagefind__,\n        searchReady: window.GBSearch?.__ready === true,",
    "        hasPagefind: !!window.__pagefind__,\n        pagefindFixture: window.__pagefind__?.__fixture || null,\n        searchReady: window.GBSearch?.__ready === true,",
    'record actual Pagefind fixture identity in failure artifact',
  );

  source = once(
    source,
    "      const pagefindModule = [\n        'export async function search() {',",
    "      const pagefindModule = [\n        'export const __fixture = \"pagefind-continuation\";',\n        'export async function search() {',",
    'mark continuation Pagefind module',
  );

  source = once(
    source,
    "      }, viewport);\n      await input.fill('fixture-pagefind');",
    "      }, viewport);\n      await page.waitForFunction(() => window.__pagefind__?.__fixture === 'pagefind-continuation', null, { timeout: 30_000 });\n      await input.fill('fixture-pagefind');",
    'prove continuation synthetic module ownership before query',
  );

  source = once(
    source,
    "      const delayedPagefindModule = [\n        'export async function search() {',",
    "      const delayedPagefindModule = [\n        'export const __fixture = \"pagefind-stale-query\";',\n        'export async function search() {',",
    'mark stale-query Pagefind module',
  );

  source = once(
    source,
    "      }, viewport);\n\n      await input.fill('clearrace');",
    "      }, viewport);\n\n      await page.waitForFunction(() => window.__pagefind__?.__fixture === 'pagefind-stale-query', null, { timeout: 30_000 });\n      await input.fill('clearrace');",
    'prove stale-query synthetic module ownership before query',
  );

  return source;
}

function validate(source) {
  const required = [
    "browser.newContext({ viewport, serviceWorkers: 'block' })",
    "pagefindFixture: window.__pagefind__?.__fixture || null",
    "export const __fixture = \"pagefind-continuation\";",
    "window.__pagefind__?.__fixture === 'pagefind-continuation'",
    "export const __fixture = \"pagefind-stale-query\";",
    "window.__pagefind__?.__fixture === 'pagefind-stale-query'",
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`[search-p3-pagefind-fixture] missing final marker: ${marker}`);
  }
  if (source.includes('const context = await browser.newContext({ viewport });')) {
    throw new Error('[search-p3-pagefind-fixture] synthetic continuation context still allows service-worker interception');
  }
}

let source = fs.readFileSync(file, 'utf8');
if (write) {
  source = transform(source);
  validate(source);
  fs.writeFileSync(file, source);
  console.log('[search-p3-pagefind-fixture] applied');
} else {
  validate(source);
  console.log('[search-p3-pagefind-fixture] final contract OK');
}
