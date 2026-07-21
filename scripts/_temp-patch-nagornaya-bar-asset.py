#!/usr/bin/env python3
from pathlib import Path

ROOT = Path('.')
HASH = '3c7e0bdd'


def once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: {label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


cache = ROOT / 'scripts/cache-bust.js'
once(
    cache,
    "    const re = new RegExp(`((?:\\.\\.\\/)*|/?)${escapedAsset}\\?v=[a-f0-9]{8}`, 'g');",
    "    const re = new RegExp(`((?:\\.\\.\\/)*|/?)${escapedAsset}(?:\\?v=[^\\s\"'&}>]+)?`, 'g');",
    'broaden Astro revision matcher',
)

for part in range(1, 6):
    footer = ROOT / f'src/components/nagornaya/chast-{part}/NagornayaChast{part}PageFooter.astro'
    once(
        footer,
        '../../js/nagornaya-bar-extras.js?v=1',
        f'../../js/nagornaya-bar-extras.js?v={HASH}',
        'canonical bar asset revision',
    )

    shadow = ROOT / f'nagornaya/chast-{part}/index.html'
    text = shadow.read_text(encoding='utf-8')
    expected = f'<script src="../../js/nagornaya-bar-extras.js?v={HASH}" defer></script>'
    if expected in text:
        raise SystemExit(f'{shadow}: canonical bar asset already present; patch must be one-shot')
    anchor = '<script src="../../js/nagornaya-mobile-toc.js?v=649d9217" defer></script>'
    if text.count(anchor) != 1:
        raise SystemExit(f'{shadow}: mobile toc anchor expected once, found {text.count(anchor)}')
    text = text.replace(anchor, anchor + '\n' + expected, 1)
    shadow.write_text(text, encoding='utf-8')

print('Nagornaya bar asset patch applied')
