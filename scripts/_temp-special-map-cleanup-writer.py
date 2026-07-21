#!/usr/bin/env python3
from pathlib import Path

path = Path('karty/_engine/map-engine.js')
text = path.read_text(encoding='utf-8')
old = "      // Restore body overflow\n      document.body.style.overflow = '';\n"
if text.count(old) != 1:
    raise SystemExit(f'legacy cleanup writer mismatch: {text.count(old)}')
path.write_text(text.replace(old, '', 1), encoding='utf-8')
print('Legacy map cleanup body overflow writer removed')
