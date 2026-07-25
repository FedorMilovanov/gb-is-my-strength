#!/usr/bin/env python3
from pathlib import Path

path = Path('css/site.css')
source = path.read_text('utf-8')
marker = '/* GB PRINT CONTRACT v2.9 — progress chrome isolation and reversible-card flow. */'
start = source.find(marker)
if start < 0:
    raise SystemExit('v2.9 print contract not found')
head, block = source[:start], source[start:]
important_count = block.count(' !important')
if important_count < 50:
    raise SystemExit(f'expected legacy priority-heavy block, found {important_count} !important declarations')
block = block.replace(' !important', '')
if '!important' in block:
    raise SystemExit('v2.9 still contains !important')
path.write_text((head + block).rstrip() + '\n', 'utf-8')
print(f'Removed {important_count} unnecessary !important declarations from v2.9.')
