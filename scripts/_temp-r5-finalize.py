#!/usr/bin/env python3
from pathlib import Path
import json


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

reader_path = Path('src/components/article-pilots/_shared/ReaderSettings.astro')
reader = reader_path.read_text(encoding='utf-8')
reader = once(
    reader,
    "      else if (toc?.classList.contains('is-open')) {\n        toc.classList.remove('is-open');\n        toc.setAttribute('aria-hidden', 'true');\n      }",
    "      else if (toc?.classList.contains('is-open')) {\n        toc.classList.remove('is-open');\n        toc.setAttribute('aria-hidden', 'true');\n        fallbackUtils()?.unlockScroll?.('hermenevtika-toc');\n      }",
    'Hermenevtika fallback unlock',
)
reader_path.write_text(reader, encoding='utf-8')

package_path = Path('package.json')
package_text = package_path.read_text(encoding='utf-8')
package_text = once(
    package_text,
    '    "series:facade:guard": "node scripts/series-reader-facade-regression-test.js",\n',
    '    "series:facade:guard": "node scripts/series-reader-facade-regression-test.js",\n'
    '    "overlay:runtime:test": "node scripts/runtime-integrity-test.js && node scripts/overlay-runtime-contract-test.js",\n'
    '    "overlay:browser:test": "node scripts/overlay-runtime-browser-test.js",\n',
    'package overlay scripts',
)
package_path.write_text(package_text, encoding='utf-8')

contract_path = Path('scripts/overlay-runtime-contract-test.js')
contract = contract_path.read_text(encoding='utf-8')
contract = once(
    contract,
    "assert.ok(reader.includes(\"OVERLAY_OWNER = 'reader-settings'\"));\n",
    "assert.ok(reader.includes(\"OVERLAY_OWNER = 'reader-settings'\"));\n"
    "assert.ok(reader.includes(\"unlockScroll?.('hermenevtika-toc')\"), 'fallback switch must release the Hermenevtika owner');\n",
    'fallback contract',
)
contract_path.write_text(contract, encoding='utf-8')

browser_test = r'''#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const siteUtils = fs.readFileSync(path.join(process.cwd(), 'js/site-utils.js'), 'utf8');
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;min-height:3000px}.overlay{position:fixed;inset:20px;background:white;padding:20px}.overlay[aria-hidden="true"]{display:none}
</style></head><body>
<main id="background"><button id="openA">Open A</button><div style="height:2600px"></div></main>
<section id="overlayA" class="overlay" aria-hidden="true"><button id="focusA">A focus</button><button id="openB">Open B</button></section>
<section id="overlayB" class="overlay" aria-hidden="true"><button id="focusB">B focus</button></section>
<script src="/site-utils.js"></script>
</body></html>`;

async function main() {
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/site-utils.js') {
      response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      response.end(siteUtils);
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.OverlayRuntime));
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

    await page.evaluate(() => {
      scrollTo(0, 420);
      document.body.style.overflow = 'auto';
      document.body.style.position = 'relative';
      document.body.style.top = '4px';
      document.body.classList.add('no-scroll');
      document.documentElement.classList.add('cp-scroll-lock');
      document.documentElement.setAttribute('data-scroll-locked', 'legacy');
      document.getElementById('openA').focus();
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      const closeA = (reason) => runtime.close('browser-a', reason);
      const closeB = (reason) => runtime.close('browser-b', reason);
      runtime.open('browser-a', {
        element: overlayA,
        opener: document.getElementById('openA'),
        focusTarget: document.getElementById('focusA'),
        inertTargets: [background],
        onRequestClose: closeA,
      });
      document.getElementById('openB').focus();
      runtime.open('browser-b', {
        element: overlayB,
        opener: document.getElementById('openB'),
        focusTarget: document.getElementById('focusB'),
        inertTargets: [background, overlayA],
        onRequestClose: closeB,
      });
    });
    await page.waitForTimeout(30);

    let state = await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      top: window.OverlayRuntime.topLayer()?.ownerId,
      position: document.body.style.position,
      overflow: document.body.style.overflow,
      backgroundInert: document.getElementById('background').inert,
      overlayAInert: document.getElementById('overlayA').inert,
      active: document.activeElement?.id,
    }));
    assert.deepEqual(state, {
      size: 2,
      top: 'browser-b',
      position: 'fixed',
      overflow: 'hidden',
      backgroundInert: true,
      overlayAInert: true,
      active: 'focusB',
    });

    await page.evaluate(() => window.OverlayRuntime.close('browser-b', 'programmatic'));
    await page.waitForTimeout(30);
    state = await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      top: window.OverlayRuntime.topLayer()?.ownerId,
      position: document.body.style.position,
      backgroundInert: document.getElementById('background').inert,
      overlayAInert: document.getElementById('overlayA').inert,
      active: document.activeElement?.id,
    }));
    assert.deepEqual(state, {
      size: 1,
      top: 'browser-a',
      position: 'fixed',
      backgroundInert: true,
      overlayAInert: false,
      active: 'openB',
    });

    await page.evaluate(() => window.OverlayRuntime.close('browser-a', 'programmatic'));
    await page.waitForTimeout(30);
    state = await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      topStyle: document.body.style.top,
      noScroll: document.body.classList.contains('no-scroll'),
      cpLock: document.documentElement.classList.contains('cp-scroll-lock'),
      lockAttr: document.documentElement.getAttribute('data-scroll-locked'),
      backgroundInert: document.getElementById('background').inert,
      active: document.activeElement?.id,
      scrollY: Math.round(window.scrollY),
    }));
    assert.deepEqual(state, {
      size: 0,
      overflow: 'auto',
      position: 'relative',
      topStyle: '4px',
      noScroll: true,
      cpLock: true,
      lockAttr: 'legacy',
      backgroundInert: false,
      active: 'openA',
      scrollY: 420,
    });

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const options = { element: overlayA, opener: document.getElementById('openA'), inertTargets: [background] };
      runtime.open('repeat-owner', options);
      runtime.open('repeat-owner', options);
      runtime.close('repeat-owner', 'programmatic');
    });
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      inert: document.getElementById('background').inert,
      position: document.body.style.position,
    })), { size: 0, inert: false, position: 'relative' });

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      runtime.open('escape-a', {
        element: overlayA,
        inertTargets: [background],
        onRequestClose: (reason) => runtime.close('escape-a', reason),
      });
      runtime.open('escape-b', {
        element: overlayB,
        inertTargets: [background, overlayA],
        onRequestClose: (reason) => runtime.close('escape-b', reason),
      });
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({
      a: window.OverlayRuntime.isOpen('escape-a'),
      b: window.OverlayRuntime.isOpen('escape-b'),
      top: window.OverlayRuntime.topLayer()?.ownerId,
    })), { a: true, b: false, top: 'escape-a' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(20);
    assert.equal(await page.evaluate(() => window.OverlayRuntime.size()), 0);

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      runtime.open('pagehide-a', { element: document.getElementById('overlayA'), inertTargets: [document.getElementById('background')] });
      runtime.open('pagehide-b', { element: document.getElementById('overlayB'), inertTargets: [document.getElementById('background'), document.getElementById('overlayA')] });
      window.dispatchEvent(new Event('pagehide'));
    });
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      position: document.body.style.position,
      backgroundInert: document.getElementById('background').inert,
    })), { size: 0, position: 'relative', backgroundInert: false });

    assert.deepEqual(errors, []);
    console.log('✅ overlay-runtime-browser-test: nested stack + exact restore + focus + Escape + pagehide + reduced motion');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
'''
Path('scripts/overlay-runtime-browser-test.js').write_text(browser_test, encoding='utf-8')

shared_path = Path('.github/workflows/shared-files-guard.yml')
shared = shared_path.read_text(encoding='utf-8')
shared = once(
    shared,
    "      - name: Runtime integrity regressions\n        run: node scripts/runtime-integrity-test.js\n",
    "      - name: Overlay and runtime integrity regressions\n        run: npm run overlay:runtime:test\n",
    'permanent overlay guard',
)
shared_path.write_text(shared, encoding='utf-8')

browser_workflow = '''name: Overlay Runtime Browser\n\non:\n  workflow_dispatch:\n  pull_request:\n    branches: [main]\n    paths:\n      - "js/site-utils.js"\n      - "js/site.js"\n      - "js/floating-cluster-controller.js"\n      - "src/components/article-pilots/**"\n      - "scripts/overlay-runtime-*.js"\n      - "scripts/runtime-integrity-test.js"\n      - "package.json"\n      - "package-lock.json"\n      - ".github/workflows/overlay-runtime-browser.yml"\n\nconcurrency:\n  group: overlay-runtime-browser-${{ github.ref }}\n  cancel-in-progress: true\n\npermissions:\n  contents: read\n\njobs:\n  browser:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: "22"\n          cache: "npm"\n      - run: npm ci\n      - name: Install Chromium\n        run: npx playwright install --with-deps chromium\n      - name: Nested overlay browser matrix\n        run: npm run overlay:browser:test\n'''
Path('.github/workflows/overlay-runtime-browser.yml').write_text(browser_workflow, encoding='utf-8')

inventory_path = Path('docs/READER-R5-OVERLAY-RUNTIME-INVENTORY-2026-07-21.md')
inventory = inventory_path.read_text(encoding='utf-8')
if '## Resolution status' not in inventory:
    inventory += '''\n\n## Resolution status\n\nThe reader P0 cluster is migrated to `OverlayRuntime`: the duplicate `site.js` store delegates to the canonical coordinator; ReaderSettings, Hermenevtika TOC, Gill series/part TOCs, Gill learning/settings, and GBS2 sheet use named owners. Map and built-app adapters remain explicitly outside Reader R5 and retain their dedicated special-surface lane.\n'''
inventory_path.write_text(inventory, encoding='utf-8')

print('R5 final permanent files prepared')
