#!/usr/bin/env python3
from pathlib import Path


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

browser_path = Path('scripts/overlay-runtime-browser-test.js')
browser = browser_path.read_text(encoding='utf-8')
browser = once(
    browser,
    "const { chromium } = require('playwright');\n",
    "const playwright = require('playwright');\nconst browserName = process.env.PW_BROWSER || 'chromium';\nconst browserType = playwright[browserName];\nif (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);\n",
    'browser selector import',
)
browser = once(
    browser,
    "  const browser = await chromium.launch({ headless: true });",
    "  const browser = await browserType.launch({ headless: true });",
    'browser selector launch',
)
browser = once(
    browser,
    "    await page.evaluate(() => {\n      scrollTo(0, 420);\n      document.body.style.overflow = 'auto';",
    "    await page.evaluate(() => {\n      document.body.style.overflow = 'auto';",
    'remove same-task scroll',
)
browser = once(
    browser,
    "      document.documentElement.setAttribute('data-scroll-locked', 'legacy');\n      document.getElementById('openA').focus();\n      const runtime = window.OverlayRuntime;",
    "      document.documentElement.setAttribute('data-scroll-locked', 'legacy');\n    });\n    await page.evaluate(() => scrollTo(0, 420));\n    await page.waitForFunction(() => Math.round(window.scrollY) === 420);\n    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 420, 'precondition: page must be scrolled before opener focus');\n    await page.evaluate(() => document.getElementById('openA').focus({ preventScroll: true }));\n    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 420, 'precondition: opener focus must preserve scroll');\n\n    await page.evaluate(() => {\n      const runtime = window.OverlayRuntime;",
    'focus opener without changing pre-open scroll',
)
browser = once(
    browser,
    "    await page.evaluate(() => window.OverlayRuntime.close('browser-a', 'programmatic'));\n    await page.waitForTimeout(30);\n    state = await page.evaluate(() => ({",
    "    await page.evaluate(() => window.OverlayRuntime.close('browser-a', 'programmatic'));\n    await page.waitForFunction(() => window.OverlayRuntime.size() === 0 && Math.round(window.scrollY) === 420 && document.activeElement && document.activeElement.id === 'openA');\n    state = await page.evaluate(() => ({",
    'wait for exact restoration',
)
browser = once(
    browser,
    "    console.log('✅ overlay-runtime-browser-test: nested stack + exact restore + focus + Escape + pagehide + reduced motion');",
    "    console.log(`✅ overlay-runtime-browser-test [${browserName}]: nested stack + exact restore + focus + Escape + pagehide + reduced motion`);",
    'browser result label',
)
browser_path.write_text(browser, encoding='utf-8')

workflow_path = Path('.github/workflows/overlay-runtime-browser.yml')
workflow = workflow_path.read_text(encoding='utf-8')
old_job = '''  browser:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Nested overlay browser matrix
        run: npm run overlay:browser:test
'''
new_job = '''  browser:
    name: ${{ matrix.browser }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - name: Install ${{ matrix.browser }}
        run: npx playwright install --with-deps ${{ matrix.browser }}
      - name: Nested overlay browser matrix
        env:
          PW_BROWSER: ${{ matrix.browser }}
        run: npm run overlay:browser:test
'''
workflow = once(workflow, old_job, new_job, 'three-browser workflow matrix')
workflow_path.write_text(workflow, encoding='utf-8')

print('Browser fixture preserves scroll across opener focus and prepares three-browser matrix')
