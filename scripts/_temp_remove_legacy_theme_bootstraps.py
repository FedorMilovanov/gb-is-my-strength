#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '_build-tools', 'docs', 'migration'}
SCRIPT_RE = re.compile(r'<script(?P<attrs>\s+is:inline)?\s*>(?P<body>[\s\S]*?)</script>', re.I)
THEME_GET_RE = re.compile(r'localStorage\.getItem\(\s*[\'\"]theme[\'\"]\s*\)')
DARK_MUTATION_RE = re.compile(r'document\.documentElement\.(?:classList\.(?:add|toggle)\(\s*[\'\"]dark[\'\"]|setAttribute\(\s*[\'\"]data-reader-theme[\'\"])')
HTML_COMMENT_RE = re.compile(r'(?:[ \t]*\n)?[ \t]*<!--\s*Anti-FOUC(?:\s*:[\s\S]*?)?\s*-->[ \t]*(?:\r?\n)?$', re.I)
ASTRO_COMMENT_RE = re.compile(r'(?:[ \t]*\n)?[ \t]*\{/\*\s*Anti-FOUC[\s\S]*?\*/\}[ \t]*(?:\r?\n)?$', re.I)


def replace_once(relative: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'patched {label}: {relative}')


def iter_files():
    for suffix in ('*.astro', '*.html'):
        for path in ROOT.rglob(suffix):
            rel = path.relative_to(ROOT)
            if any(part.startswith('.') or part in SKIP for part in rel.parts[:-1]):
                continue
            if path.name.startswith('yandex_'):
                continue
            yield path


def theme_matches(text: str):
    matches = []
    for match in SCRIPT_RE.finditer(text):
        body = match.group('body')
        if THEME_GET_RE.search(body) and DARK_MUTATION_RE.search(body):
            matches.append(match)
    return matches


replace_once(
    'scripts/reader-preferences-regression-test.js',
    '''function importsPageHead(source) {
  return /<[A-Z][A-Za-z0-9]*PageHead\\b/.test(source);
}

const astroTargets = [];
''',
    '''function importsPageHead(source) {
  return /<[A-Z][A-Za-z0-9]*PageHead\\b/.test(source);
}

function hasLegacyThemeBootstrap(source) {
  const scripts = /<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi;
  for (const match of source.matchAll(scripts)) {
    const body = match[1] || '';
    if (/localStorage\\.getItem\\(\\s*['\"]theme['\"]\\s*\\)/.test(body) &&
        /document\\.documentElement\\.(?:classList\\.(?:add|toggle)\\(\\s*['\"]dark['\"]|setAttribute\\(\\s*['\"]data-reader-theme['\"])/.test(body)) {
      return true;
    }
  }
  return false;
}

const astroTargets = [];
''',
    'permanent legacy bootstrap detector',
)

replace_once(
    'scripts/reader-preferences-regression-test.js',
    '''  astroTargets.push(file);
  assert(source.includes('ReaderPreferencesHead'), `${path.relative(ROOT, file)} must import shared head preferences`);
''',
    '''  astroTargets.push(file);
  assert(!hasLegacyThemeBootstrap(source), `${path.relative(ROOT, file)} must not contain a route-owned theme bootstrap`);
  assert(source.includes('ReaderPreferencesHead'), `${path.relative(ROOT, file)} must import shared head preferences`);
''',
    'Astro no-duplicate assertion',
)

replace_once(
    'scripts/reader-preferences-regression-test.js',
    '''  legacyTargets.push(file);
  assert(source.includes('js/reader-preferences-head.js?v='), `${path.relative(ROOT, file)} missing first-paint bootstrap`);
''',
    '''  legacyTargets.push(file);
  assert(!hasLegacyThemeBootstrap(source), `${path.relative(ROOT, file)} must not contain a route-owned theme bootstrap`);
  assert(source.includes('js/reader-preferences-head.js?v='), `${path.relative(ROOT, file)} missing first-paint bootstrap`);
''',
    'legacy no-duplicate assertion',
)

changed_files = []
removed_scripts = 0
for path in sorted(set(iter_files())):
    text = path.read_text(encoding='utf-8')
    matches = theme_matches(text)
    if not matches:
        continue
    if len(matches) != 1:
        raise SystemExit(f'{path.relative_to(ROOT)}: expected one legacy theme bootstrap, found {len(matches)}')
    match = matches[0]
    prefix = text[:match.start()]
    suffix = text[match.end():]
    prefix = HTML_COMMENT_RE.sub('', prefix)
    prefix = ASTRO_COMMENT_RE.sub('', prefix)
    updated = prefix.rstrip(' \t') + '\n' + suffix.lstrip('\r\n')
    path.write_text(updated, encoding='utf-8')
    changed_files.append(str(path.relative_to(ROOT)).replace('\\', '/'))
    removed_scripts += 1

if removed_scripts != 110 or len(changed_files) != 110:
    raise SystemExit(f'expected exact 110-file/110-script migration, got files={len(changed_files)} scripts={removed_scripts}')

remaining = []
for path in sorted(set(iter_files())):
    if theme_matches(path.read_text(encoding='utf-8')):
        remaining.append(str(path.relative_to(ROOT)).replace('\\', '/'))
if remaining:
    raise SystemExit('legacy theme bootstraps remain: ' + ', '.join(remaining))

print(f'removed legacy theme bootstraps: files={len(changed_files)} scripts={removed_scripts}')
for relative in changed_files:
    print(relative)
