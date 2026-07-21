#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/gill-v16-mobile-play-smoke.js')
text = path.read_text(encoding='utf-8')
old = "      assert((state.partTitle || '').includes('Введение'), `${prefix}: part overlay is intro TOC`, state.partTitle);"
new = "      assert(['Джон Гилл', 'Исторический контекст', 'Оглавление части'].every((part) => (state.partTitle || '').includes(part)), `${prefix}: part overlay identifies intro article and TOC`, state.partTitle);"
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one stale intro-heading assertion, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
