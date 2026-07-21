#!/usr/bin/env python3
from pathlib import Path
import runpy

patcher = Path('scripts/_temp-patch-nagornaya-bar-asset.py')
text = patcher.read_text(encoding='utf-8')
start = text.index("cache = ROOT / 'scripts/cache-bust.js'")
end = text.index('\n\nfor part in range(1, 6):', start)
block = '''cache = ROOT / 'scripts/cache-bust.js'
once(
    cache,
    r"    const re = new RegExp(`((?:\\\\.\\\\.\\\\/)*|/?)${escapedAsset}\\\\?v=[a-f0-9]{8}`, 'g');",
    r''' + '"""' + '''    const re = new RegExp(`((?:\\\\.\\\\.\\\\/)*|/?)${escapedAsset}\\\\?v=[^\\\\s"'&}>]+`, 'g');''' + '"""' + ''',
    'accept arbitrary stale Astro revision values',
)'''
patcher.write_text(text[:start] + block + text[end:], encoding='utf-8')
runpy.run_path(str(patcher), run_name='__main__')
