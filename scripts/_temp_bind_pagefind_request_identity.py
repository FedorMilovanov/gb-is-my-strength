#!/usr/bin/env python3

from pathlib import Path

TARGET = Path(__file__).resolve().parent / "home-browser-lifecycle-contract.mjs"
text = TARGET.read_text(encoding="utf-8")

replacements = [
    (
        "function isKnownNavigationAbort(request, baseUrl, allowNavigationAbort) {\n  // Dynamic import resource types vary across Playwright/browser versions.\n  // Accept only the exact same-origin GET aborted by our intentional route transition.\n  if (!allowNavigationAbort\n    || request.failure()?.errorText !== 'net::ERR_ABORTED'\n    || request.method() !== 'GET') return false;\n  try {\n    const url = new URL(request.url());\n    return url.origin === baseUrl && url.pathname === '/pagefind/pagefind.js';\n  } catch {\n    return false;\n  }\n}",
        "function isExpectedPagefindRequest(request, baseUrl) {\n  if (request.method() !== 'GET') return false;\n  try {\n    const url = new URL(request.url());\n    return url.origin === baseUrl && url.pathname === '/pagefind/pagefind.js';\n  } catch {\n    return false;\n  }\n}\n\nfunction isKnownNavigationAbort(request, expectedNavigationAborts) {\n  // The request is marked when it starts inside the intentional route transition.\n  // A later requestfailed event may arrive after the navigation window has closed.\n  return request.failure()?.errorText === 'net::ERR_ABORTED'\n    && expectedNavigationAborts.has(request);\n}",
    ),
    (
        "  const runtimeErrors = [];\n  const ignoredDiagnostics = [];\n  const navigationState = { allowPagefindAbort: false };",
        "  const runtimeErrors = [];\n  const ignoredDiagnostics = [];\n  const navigationState = { allowPagefindAbort: false };\n  const expectedNavigationAborts = new WeakSet();",
    ),
    (
        "  page.on('response', (response) => {\n    if (response.status() >= 400) runtimeErrors.push(`HTTP ${response.status()} ${response.url()}`);\n  });\n  page.on('requestfailed', (request) => {",
        "  page.on('response', (response) => {\n    if (response.status() >= 400) runtimeErrors.push(`HTTP ${response.status()} ${response.url()}`);\n  });\n  page.on('request', (request) => {\n    if (navigationState.allowPagefindAbort && isExpectedPagefindRequest(request, baseUrl)) {\n      expectedNavigationAborts.add(request);\n    }\n  });\n  page.on('requestfailed', (request) => {",
    ),
    (
        "    if (isKnownNavigationAbort(request, baseUrl, navigationState.allowPagefindAbort)) ignoredDiagnostics.push(diagnostic);",
        "    if (isKnownNavigationAbort(request, expectedNavigationAborts)) ignoredDiagnostics.push(diagnostic);",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected exactly one request-identity marker, found {count}: {old[:120]}")
    text = text.replace(old, new, 1)

TARGET.write_text(text, encoding="utf-8")
Path(__file__).unlink()
