#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const file = 'scripts/search-modal-browser-contract.mjs';
const write = process.argv.includes('--write');

function count(text, needle) { return text.split(needle).length - 1; }
function once(text, needle, replacement, label) {
  const found = count(text, needle);
  if (found !== 1) throw new Error(`[search-continuation-diagnostics] ${label}: expected 1 match, got ${found}`);
  return text.replace(needle, replacement);
}

function patch(source) {
  source = once(
    source,
    "  const summary = { browser: browserName, pagefind: null, fallback: null, scripture: null };\n\n  async function openFixture(configure) {",
    "  const summary = { browser: browserName, pagefind: null, fallback: null, scripture: null };\n  let phase = 'setup';\n  let activePage = null;\n  let consoleErrors = [];\n  let pageErrors = [];\n\n  async function writeContinuationFailure(error) {\n    fs.mkdirSync(reportDir, { recursive: true });\n    const safePhase = String(phase || 'unknown').replace(/[^a-z0-9_-]+/gi, '-');\n    let state = {};\n    if (activePage) {\n      state = await activePage.evaluate(() => ({\n        url: location.href,\n        input: document.querySelector('.cp-input')?.value || '',\n        status: document.getElementById('cp-status')?.textContent || '',\n        optionCount: document.querySelectorAll('.cp-item[role=\"option\"]').length,\n        moreCount: document.querySelectorAll('#cp-more-wrap > .cp-more').length,\n        moreHtml: document.getElementById('cp-more-wrap')?.innerHTML || '',\n        listHtml: (document.getElementById('cp-listbox')?.innerHTML || '').slice(0, 4000),\n        scope: document.querySelector('.cp-scope-chip.active')?.dataset.scope || '',\n        pagefindReady: window.__pagefindReady__ === true,\n        pagefindFailed: window.__pagefindFailed__ === true,\n        hasPagefind: !!window.__pagefind__,\n        searchReady: window.GBSearch?.__ready === true,\n      })).catch((stateError) => ({ stateError: String(stateError) }));\n      await activePage.screenshot({\n        path: path.join(reportDir, 'continuation-failure-' + browserName + '-' + safePhase + '.png'),\n        fullPage: true,\n      }).catch(() => {});\n    }\n    fs.writeFileSync(\n      path.join(reportDir, 'continuation-failure-' + browserName + '-' + safePhase + '.json'),\n      JSON.stringify({\n        browser: browserName,\n        phase,\n        message: error instanceof Error ? error.message : String(error),\n        stack: error instanceof Error ? error.stack : null,\n        consoleErrors,\n        pageErrors,\n        state,\n      }, null, 2) + '\\n',\n    );\n  }\n\n  async function openFixture(configure) {",
    'diagnostic state/helper',
  );

  source = once(
    source,
    "    const page = await context.newPage();\n    if (configure) await configure(page);",
    "    const page = await context.newPage();\n    activePage = page;\n    consoleErrors = [];\n    pageErrors = [];\n    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });\n    page.on('pageerror', (error) => pageErrors.push(String(error)));\n    if (configure) await configure(page);",
    'active page diagnostics',
  );

  source = once(source, "  try {\n    {\n      const pagefindModule = [", "  try {\n    phase = 'pagefind';\n    {\n      const pagefindModule = [", 'pagefind phase');
  source = once(source, "      await context.close();\n    }\n\n    {\n      const manifest = {", "      await context.close();\n    }\n\n    phase = 'fallback';\n    {\n      const manifest = {", 'fallback phase');
  source = once(source, "      await context.close();\n    }\n\n    {\n      const scriptureIndex = {", "      await context.close();\n    }\n\n    phase = 'scripture';\n    {\n      const scriptureIndex = {", 'scripture phase');
  source = once(
    source,
    "    return { continuation: summary };\n  } finally {\n    await browser.close();\n  }",
    "    return { continuation: summary };\n  } catch (error) {\n    await writeContinuationFailure(error);\n    throw error;\n  } finally {\n    await browser.close();\n  }",
    'continuation catch',
  );
  return source;
}

function validate(source) {
  for (const marker of [
    "let phase = 'setup';",
    "phase = 'pagefind';",
    "phase = 'fallback';",
    "phase = 'scripture';",
    'continuation-failure-',
    "optionCount: document.querySelectorAll('.cp-item[role=\"option\"]').length",
    'await writeContinuationFailure(error);',
  ]) if (!source.includes(marker)) throw new Error('[search-continuation-diagnostics] missing final marker: ' + marker);
}

let source = fs.readFileSync(file, 'utf8');
if (write) {
  source = patch(source);
  validate(source);
  fs.writeFileSync(file, source);
  console.log('[search-continuation-diagnostics] applied');
} else {
  validate(source);
  console.log('[search-continuation-diagnostics] final contract OK');
}
