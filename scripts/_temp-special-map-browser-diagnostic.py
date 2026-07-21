#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/map-overlay-runtime-browser-test.js')
text = path.read_text(encoding='utf-8')
old_page = "  const page = await browser.newPage({viewport:{width:844,height:390}});\n"
new_page = "  const page = await browser.newPage({viewport:{width:844,height:390}});\n  page.on('console', message => console.log(`[page:${message.type()}] ${message.text()}`));\n  page.on('pageerror', error => console.error('[pageerror]', error));\n"
if text.count(old_page) != 1:
    raise SystemExit(f'page diagnostic anchor mismatch: {text.count(old_page)}')
text = text.replace(old_page, new_page, 1)
old_wait = "    await page.waitForFunction(() => document.querySelector('.me-panel--open') && window.OverlayRuntime.size() === 1);\n"
new_wait = "    await page.waitForTimeout(250);\n    console.log('panel-precondition', JSON.stringify(await page.evaluate(() => ({\n      panelExists:Boolean(document.querySelector('.me-panel')),\n      panelOpen:Boolean(document.querySelector('.me-panel--open')),\n      runtime:Boolean(window.OverlayRuntime),\n      size:window.OverlayRuntime?.size?.(),\n      top:window.OverlayRuntime?.topLayer?.()?.ownerId || '',\n      active:document.activeElement?.className || document.activeElement?.id || '',\n      overlayCount:document.documentElement.getAttribute('data-overlay-count'),\n    }))));\n    await page.waitForFunction(() => document.querySelector('.me-panel--open') && window.OverlayRuntime.size() === 1);\n"
if text.count(old_wait) != 1:
    raise SystemExit(f'panel wait diagnostic anchor mismatch: {text.count(old_wait)}')
path.write_text(text.replace(old_wait, new_wait, 1), encoding='utf-8')
print('Map browser precondition diagnostics prepared')
