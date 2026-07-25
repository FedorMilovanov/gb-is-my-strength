from pathlib import Path

SCRIPT = Path('scripts/home-browser-lifecycle-contract.mjs')
SELF = Path('scripts/_temp_materialize_bfcache_diagnostics.py')
text = SCRIPT.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one match, found {count}: {old[:100]!r}')
    text = text.replace(old, new, 1)


replace_once(
    'async function assertRealHistoryRestore(page, baseUrl) {',
    'async function assertRealHistoryRestore(page, baseUrl, bfcacheDiagnostics) {',
)
replace_once(
    "  await assertScrollUnlocked(page, 'real history restore');\n\n  const evidence = await page.evaluate((storageKey) => ({",
    "  await assertScrollUnlocked(page, 'real history restore');\n  // Chromium reports BFCache rejection reasons asynchronously after traversal.\n  await page.waitForTimeout(100);\n\n  const evidence = await page.evaluate((storageKey) => ({",
)
replace_once(
    "  assert.equal(homePageHide?.persisted, true, `home page was not admitted to BFCache: ${JSON.stringify(evidence.events)}`);\n  assert.equal(homePageShow?.persisted, true, `home page was not restored from BFCache: ${JSON.stringify(evidence.events)}`);",
    "  const diagnosticSuffix = ` events=${JSON.stringify(evidence.events)} bfcache=${JSON.stringify(bfcacheDiagnostics)}`;\n  assert.equal(homePageHide?.persisted, true, `home page was not admitted to BFCache:${diagnosticSuffix}`);\n  assert.equal(homePageShow?.persisted, true, `home page was not restored from BFCache:${diagnosticSuffix}`);",
)
replace_once(
    "  await installLifecycleProbe(context);\n  const page = await context.newPage();\n  const runtimeErrors = [];",
    "  await installLifecycleProbe(context);\n  const page = await context.newPage();\n  const bfcacheDiagnostics = [];\n  if (browserName === 'chromium') {\n    const cdp = await context.newCDPSession(page);\n    await cdp.send('Page.enable');\n    cdp.on('Page.backForwardCacheNotUsed', (event) => bfcacheDiagnostics.push(event));\n  }\n  const runtimeErrors = [];",
)
replace_once(
    '    const lifecycle = await assertRealHistoryRestore(page, baseUrl);',
    '    const lifecycle = await assertRealHistoryRestore(page, baseUrl, bfcacheDiagnostics);',
)
replace_once(
    "    return { browser: browserName, result: 'PASS', lifecycle, ignoredDiagnostics };",
    "    return { browser: browserName, result: 'PASS', lifecycle, bfcacheDiagnostics, ignoredDiagnostics };",
)

SCRIPT.write_text(text, encoding='utf-8')
SELF.unlink()
print('materialized permanent Chromium BFCache rejection diagnostics')
