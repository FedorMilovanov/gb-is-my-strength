#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '_build-tools', 'docs', 'migration'}
SCRIPT_RE = re.compile(r'<script\b(?P<attrs>[^>]*)>(?P<body>[\s\S]*?)</script>', re.I)
THEME_GET_RE = re.compile(r'localStorage\.getItem\(\s*[\'\"]theme[\'\"]\s*\)')
DARK_MUTATION_RE = re.compile(r'document\.documentElement\.(?:classList\.(?:add|toggle)\(\s*[\'\"]dark[\'\"]|setAttribute\(\s*[\'\"]data-reader-theme[\'\"])')


def iter_files():
    for suffix in ('*.astro', '*.html'):
        for path in ROOT.rglob(suffix):
            rel = path.relative_to(ROOT)
            if any(part.startswith('.') or part in SKIP for part in rel.parts[:-1]):
                continue
            if path.name.startswith('yandex_'):
                continue
            yield path


records = []
for path in sorted(set(iter_files())):
    text = path.read_text(encoding='utf-8')
    matches = []
    for index, match in enumerate(SCRIPT_RE.finditer(text), 1):
        body = match.group('body')
        if THEME_GET_RE.search(body) and DARK_MUTATION_RE.search(body):
            before = text[max(0, match.start() - 160):match.start()]
            matches.append({
                'script_index': index,
                'attrs': match.group('attrs').strip(),
                'body_chars': len(body),
                'body_lines': len(body.splitlines()),
                'comment_context': before.splitlines()[-2:],
                'body': body.strip(),
            })
    if matches:
        records.append({'file': str(path.relative_to(ROOT)).replace('\\', '/'), 'matches': matches})

report = {
    'files': len(records),
    'scripts': sum(len(item['matches']) for item in records),
    'records': records,
}
Path('legacy-theme-bootstrap-inventory.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"legacy theme bootstrap inventory: files={report['files']} scripts={report['scripts']}")
for item in records:
    for match in item['matches']:
        print(f"{item['file']} :: script#{match['script_index']} chars={match['body_chars']} lines={match['body_lines']}")
