#!/usr/bin/env python3
from pathlib import Path


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

site_path = Path('js/site-utils.js')
site = site_path.read_text(encoding='utf-8')
old_release = '''  function releaseLock() {
    if (effectiveLocked() || restoring) return;
    restoring = true;
    try {
      var top = parseFloat(document.body.style.top || '');
      var restoreY = Number.isFinite(top) && top < 0 ? -top : savedScrollY;
      restoreLockStyles(savedLockStyles);
      savedLockStyles = null;
      var oldBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, restoreY || 0);
      document.documentElement.style.scrollBehavior = oldBehavior;
    } finally { restoring = false; }
  }
'''
new_release = '''  function releaseLock() {
    if (effectiveLocked() || restoring) return;
    restoring = true;
    try {
      var top = parseFloat(document.body.style.top || '');
      var restoreY = Number.isFinite(top) && top < 0 ? -top : savedScrollY;
      var targetY = Math.max(0, restoreY || 0);
      restoreLockStyles(savedLockStyles);
      savedLockStyles = null;
      var html = document.documentElement;
      var oldBehavior = html.style.scrollBehavior;
      var frameCount = 0;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, targetY);
      var finishRestore = function () {
        if (effectiveLocked()) {
          html.style.scrollBehavior = oldBehavior;
          return;
        }
        window.scrollTo(0, targetY);
        frameCount += 1;
        if (frameCount < 2 && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(finishRestore);
          return;
        }
        setTimeout(function () {
          if (!effectiveLocked()) window.scrollTo(0, targetY);
          html.style.scrollBehavior = oldBehavior;
        }, 0);
      };
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(finishRestore);
      else setTimeout(finishRestore, 0);
    } finally { restoring = false; }
  }
'''
site = once(site, old_release, new_release, 'post-layout scroll restore')
old_close = '''    releaseOverlayInert(record);
    if (record.lockScroll) unlockScroll('overlay:' + record.ownerId);
    syncOverlayDiagnostics();
    overlayEvent('gb:overlay-close', record, reason || 'close');
    var restore = options.restoreFocus !== false && record.restoreFocus && !/^(?:pagehide|beforeunload|force)$/.test(reason || '');
    var opener = record.opener;
    record.opener = null;
    if (restore && opener) setTimeout(function () { overlayFocus(opener); }, 0);
    return true;
'''
new_close = '''    releaseOverlayInert(record);
    var restore = options.restoreFocus !== false && record.restoreFocus && !/^(?:pagehide|beforeunload|force)$/.test(reason || '');
    var opener = record.opener;
    record.opener = null;
    if (restore && opener) overlayFocus(opener);
    if (record.lockScroll) unlockScroll('overlay:' + record.ownerId);
    syncOverlayDiagnostics();
    overlayEvent('gb:overlay-close', record, reason || 'close');
    return true;
'''
site = once(site, old_close, new_close, 'focus before final scroll unlock')
site_path.write_text(site, encoding='utf-8')

browser_path = Path('scripts/overlay-runtime-browser-test.js')
browser = browser_path.read_text(encoding='utf-8')
browser = once(
    browser,
    "const { chromium } = require('playwright');\n",
    "const playwright = require('playwright');\nconst browserName = process.env.PW_BROWSER || 'chromium';\nconst browserType = playwright[browserName];\nif (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);\n",
    'browser selector import',
)
browser = once(browser, "  const browser = await chromium.launch({ headless: true });", "  const browser = await browserType.launch({ headless: true });", 'browser selector launch')
browser = once(
    browser,
    "    await page.evaluate(() => {\n      scrollTo(0, 420);\n      document.body.style.overflow = 'auto';",
    "    await page.evaluate(() => {\n      document.body.style.overflow = 'auto';",
    'remove same-task scroll',
)
browser = once(
    browser,
    "      document.documentElement.setAttribute('data-scroll-locked', 'legacy');\n      document.getElementById('openA').focus();\n      const runtime = window.OverlayRuntime;",
    "      document.documentElement.setAttribute('data-scroll-locked', 'legacy');\n    });\n    await page.evaluate(() => scrollTo(0, 420));\n    await page.waitForFunction(() => Math.round(window.scrollY) === 420);\n    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 420, 'precondition: page must be scrolled before opening');\n\n    await page.evaluate(() => {\n      document.getElementById('openA').focus();\n      const runtime = window.OverlayRuntime;",
    'frame-realistic scroll precondition',
)
browser = once(
    browser,
    "    await page.evaluate(() => window.OverlayRuntime.close('browser-a', 'programmatic'));\n    await page.waitForTimeout(30);\n    state = await page.evaluate(() => ({",
    "    await page.evaluate(() => window.OverlayRuntime.close('browser-a', 'programmatic'));\n    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);\n    await page.waitForTimeout(250);\n    state = await page.evaluate(() => ({",
    'capture exact post-layout restoration state',
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

runtime_path = Path('scripts/runtime-integrity-test.js')
runtime = runtime_path.read_text(encoding='utf-8')
if "requestAnimationFrame" not in runtime:
    runtime = once(
        runtime,
        "  clearTimeout() {},\n});",
        "  clearTimeout() {},\n  requestAnimationFrame: (fn) => { fn(); return 1; },\n  cancelAnimationFrame() {},\n});",
        'VM animation frame stub',
    )
runtime_path.write_text(runtime, encoding='utf-8')

print('Focus-before-unlock restoration and exact browser diagnostics prepared')
