#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/map-overlay-runtime-browser-test.js')
text = path.read_text(encoding='utf-8')

old_css = "      html,body{margin:0;min-height:2200px} body{overflow:auto;position:relative;top:4px}\n"
new_css = "      html,body{margin:0;min-height:2200px}\n"
if text.count(old_css) != 1:
    raise SystemExit(f'fixture css mismatch: {text.count(old_css)}')
text = text.replace(old_css, new_css, 1)

old_body = '</style></head><body><div id="pre">'
new_body = '</style></head><body style="overflow:auto;position:relative;top:4px"><div id="pre">'
if text.count(old_body) != 1:
    raise SystemExit(f'fixture body mismatch: {text.count(old_body)}')
text = text.replace(old_body, new_body, 1)

old_close = "    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);\n    await page.waitForFunction(() => Math.round(scrollY) === 420);\n"
new_close = "    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);\n    await page.waitForFunction(() => document.activeElement?.id === 'outside');\n    await page.waitForFunction(() => Math.round(scrollY) === 420);\n"
if text.count(old_close) < 1:
    raise SystemExit('panel close wait mismatch')
text = text.replace(old_close, new_close, 1)

path.write_text(text, encoding='utf-8')
print('Map fixture inline styles and panel opener wait finalized')
