#!/usr/bin/env python3
"""Count exact summary-card roots in built /articles/ HTML (static markup only)."""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

class Counter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cards = 0
    def handle_starttag(self, tag, attrs):
        if 'summary-card' in (dict(attrs).get('class') or '').split():
            self.cards += 1

root = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/gb-pr2352/dist') / 'articles'
if not root.is_dir():
    raise SystemExit(f'Missing built articles directory: {root}')
rows = []
for path in sorted(root.rglob('index.html')):
    parser = Counter()
    parser.feed(path.read_text(encoding='utf-8'))
    if parser.cards:
        rows.append({'route': '/articles/' + str(path.relative_to(root).parent).replace('\\', '/') + '/', 'cards': parser.cards})
print(json.dumps({'article_routes': len(rows), 'card_roots': sum(row['cards'] for row in rows), 'routes': rows}, ensure_ascii=False, indent=2))
