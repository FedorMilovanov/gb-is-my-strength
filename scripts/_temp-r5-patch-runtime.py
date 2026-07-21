#!/usr/bin/env python3
from pathlib import Path

path = Path('js/site-utils.js')
text = path.read_text(encoding='utf-8')
anchor = "  Object.defineProperty(api, '_scrollLockSources', {\n"
if text.count(anchor) != 1:
    raise SystemExit(f'runtime anchor: expected one match, found {text.count(anchor)}')
snippet = Path('scripts/_temp-r5-overlay-runtime.inc.js').read_text(encoding='utf-8')
text = text.replace(anchor, snippet + '\n' + anchor, 1)
path.write_text(text, encoding='utf-8')
print('OverlayRuntime insertion applied')
