#!/usr/bin/env python3
"""Assert print tail presence and first/repeat tail-text parity; exit 1 on regression."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader

folder = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/reader-cold-pdf')
manifest = json.loads((folder / 'manifest.json').read_text())

def normalized(text):
    return re.sub(r'\s+', '', text).casefold()

# These cover the article's final paragraph and each of its three closing blocks.
# Full editorial statement is included rather than merely matching its heading.
needles = {
    'article-final-paragraph': 'каноническим резонансом',
    'author-heading': 'Редакционный принцип',
    'author-statement': 'Писание выше личности и системы',
    'author-detail': 'Факт, толкование, пастырское применение и степень уверенности различаются явно; вывод не должен быть сильнее текста или доказательств.',
    'sdg': 'SOLI DEO GLORIA',
    'accuracy-heading': 'Нашли неточность',
    'accuracy-body': 'Богословскую или техническую — напишите, исправим',
    'accuracy-email': 'Email',
    'accuracy-telegram': 'Telegram',
}
rows = {}
failed = False
if not manifest.get('results'):
    raise ValueError('Empty capture manifest')
for entry in manifest['results']:
    reader = PdfReader(folder / entry['file'])
    text = normalized(''.join(page.extract_text() or '' for page in reader.pages))
    found = {name: normalized(needle) in text for name, needle in needles.items()}
    missing = [name for name, ok in found.items() if not ok]
    # Compare the extracted tail, starting at the author heading. This avoids page count
    # as a proxy for content while keeping formatting whitespace out of the comparison.
    start = text.find(normalized(needles['author-heading']))
    end = text.find(normalized(needles['accuracy-telegram']), start) if start >= 0 else -1
    tail = text[start:end + len(normalized(needles['accuracy-telegram']))] if end >= 0 else None
    key = (entry['width'], entry['method'], entry['run'])
    if entry['copy'] not in (1, 2) or entry['copy'] in rows.get(key, {}):
        raise ValueError(f'Invalid or duplicate copy for {key}')
    rows.setdefault(key, {})[entry['copy']] = tail
    print(f"{entry['file']}: {len(reader.pages)} pages; missing={missing}")
    failed |= bool(missing)
for key, copies in rows.items():
    parity = copies.get(1) is not None and copies.get(1) == copies.get(2)
    print(f'{key}: first/repeat closing text parity={parity}')
    failed |= not parity
print('FAIL: closing content or parity' if failed else 'PASS: closing content and parity')
sys.exit(1 if failed else 0)
