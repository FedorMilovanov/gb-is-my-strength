#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ASTRO_ROOT = ROOT / 'src'
SKIP_DIRS = {'.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '_build-tools', 'scripts', 'docs', 'migration', 'src'}

COMPONENT = '<ReaderPreferencesHead />'
LEGACY_RE = re.compile(
    r'\n?[ \t]*<!-- GB Reader Preferences -->\s*\n'
    r'(?P<head>[ \t]*<script\s+src="[^"]*js/reader-preferences-head\.js\?v=[a-f0-9]+"></script>)\s*\n'
    r'(?P<css>[ \t]*<link\s+rel="stylesheet"\s+href="[^"]*css/reader-preferences\.css\?v=[a-f0-9]+">)\s*\n'
    r'(?P<runtime>[ \t]*<script\s+defer\s+src="[^"]*js/reader-preferences\.js\?v=[a-f0-9]+"></script>)\s*',
    re.I,
)
CHARSET_RE = re.compile(r'<meta\s+[^>]*charset\s*=\s*["\']?[^>]+>', re.I)
CSP_RE = re.compile(r'<meta\s+[^>]*http-equiv\s*=\s*["\']Content-Security-Policy["\'][^>]*>', re.I)
HEAD_RE = re.compile(r'<head(?:\s[^>]*)?>', re.I)
FRONTMATTER_RE = re.compile(r'^\s*---[\s\S]*?---\s*', re.M)


def content_start(text: str) -> int:
    head = HEAD_RE.search(text)
    if head:
        return head.end()
    frontmatter = FRONTMATTER_RE.match(text)
    if frontmatter:
        return frontmatter.end()
    return 0


def insertion_offset(text: str) -> int:
    start = content_start(text)
    candidates = [start]
    charset = CHARSET_RE.search(text, start)
    csp = CSP_RE.search(text, start)
    if charset:
        candidates.append(charset.end())
    if csp:
        candidates.append(csp.end())
    return max(candidates)


def insert_after_contract(text: str, block: str) -> str:
    offset = insertion_offset(text)
    prefix = text[:offset].rstrip()
    suffix = text[offset:].lstrip('\r\n')
    return prefix + '\n' + block.rstrip() + '\n' + suffix


def reorder_astro(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    if COMPONENT not in text:
        return False
    if text.count(COMPONENT) != 1:
        raise RuntimeError(f'{path}: expected one ReaderPreferencesHead render')
    without = text.replace(COMPONENT, '', 1)
    updated = insert_after_contract(without, '  ' + COMPONENT)
    if updated == text:
        return False
    path.write_text(updated, encoding='utf-8')
    return True


def reorder_legacy(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    match = LEGACY_RE.search(text)
    if not match:
        return False
    if len(LEGACY_RE.findall(text)) != 1:
        raise RuntimeError(f'{path}: expected one legacy preference block')
    lines = [
        '<!-- GB Reader Preferences -->',
        match.group('head').strip(),
        match.group('css').strip(),
        match.group('runtime').strip(),
    ]
    without = LEGACY_RE.sub('\n', text, count=1)
    updated = insert_after_contract(without, '\n'.join(lines))
    path.write_text(updated, encoding='utf-8')
    return True


def walk_legacy(root: Path):
    for path in root.rglob('*.html'):
        relative = path.relative_to(root)
        if any(part.startswith('.') or part in SKIP_DIRS for part in relative.parts[:-1]):
            continue
        if re.fullmatch(r'yandex_[^/]+\.html', path.name):
            continue
        yield path


astro_changed = 0
for path in sorted(ASTRO_ROOT.rglob('*.astro')):
    if path.name == 'ReaderPreferencesHead.astro':
        continue
    if reorder_astro(path):
        astro_changed += 1

legacy_changed = 0
for path in sorted(walk_legacy(ROOT)):
    if reorder_legacy(path):
        legacy_changed += 1

if astro_changed < 65:
    raise SystemExit(f'expected at least 65 Astro heads, changed {astro_changed}')
if legacy_changed < 50:
    raise SystemExit(f'expected at least 50 legacy documents, changed {legacy_changed}')

print(f'reordered reader bootstrap: astro={astro_changed}, legacy={legacy_changed}')
