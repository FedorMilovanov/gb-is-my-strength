from pathlib import Path
import hashlib
import re

SEARCH_PATH = Path('js/search.js')
ASSET_VERSION_PATH = Path('src/lib/asset-version.js')
OLD_CACHE_VERSION = 'gb-v194-nagornaya-dark-20260804'
NEW_CACHE_VERSION = 'gb-v195-search-truthful-scripture-20260804'

source = SEARCH_PATH.read_text(encoding='utf-8')
replacements = [
    ('placeholder="Поиск по статьям, Писанию…"', 'placeholder="Поиск по статьям и ссылкам…"'),
    ('<span>Писание</span>', '<span>Ссылки</span>'),
    ('"scripture"===C?"Писание":"Материалы"', '"scripture"===C?"Ссылки в материалах":"Материалы"'),
    ('<p class="cp-empty-title">Поиск по Писанию</p>', '<p class="cp-empty-title">Ссылки в материалах</p>'),
    ('<p class="cp-empty-sub">Введите ссылку или слово из текста:</p>', '<p class="cp-empty-sub">Введите библейскую ссылку, указанную в материалах:</p>'),
    ('["Ин 3:16","Мф 5:3","Рим 8:28","Иер 17:9"]', '["Иер 17:9","Рим 7:14–25","1 Тим 3","Тит 1"]'),
    ('"authors"===C?"Авторы":"Писание"', '"authors"===C?"Авторы":"Ссылки в материалах"'),
    ('h.push({name:"Писание",items:v})', 'h.push({name:"Ссылки в материалах",items:v})'),
]
for old, new in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'expected one exact search anchor, found {count}: {old}')
    if new in source:
        raise SystemExit(f'replacement already present before mutation: {new}')
    source = source.replace(old, new, 1)
SEARCH_PATH.write_text(source, encoding='utf-8')
new_search_hash = hashlib.md5(SEARCH_PATH.read_bytes()).hexdigest()[:8]

asset_versions = ASSET_VERSION_PATH.read_text(encoding='utf-8')
asset_pattern = re.compile(r"('js/search\.js':\s*')[0-9a-f]{8}(',)")
asset_versions, count = asset_pattern.subn(rf"\g<1>{new_search_hash}\g<2>", asset_versions)
if count != 1:
    raise SystemExit(f'asset-version search entry drift: {count}')
ASSET_VERSION_PATH.write_text(asset_versions, encoding='utf-8')

skip_roots = {'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '_build-tools', 'scripts', 'docs', 'migration'}
revision_pattern = re.compile(r"(js/search\.js\?v=)[^\s\"'&}>]+")
changed_revision_files = []
for path in [*Path('.').rglob('*.html'), *Path('src').rglob('*.astro')]:
    if any(part in skip_roots or part.startswith('.') for part in path.parts):
        continue
    text = path.read_text(encoding='utf-8')
    updated, count = revision_pattern.subn(rf"\g<1>{new_search_hash}", text)
    if count and updated != text:
        path.write_text(updated, encoding='utf-8')
        changed_revision_files.append(path.as_posix())
if not changed_revision_files:
    raise SystemExit('no search revision references changed')

sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
if sw.count(OLD_CACHE_VERSION) != 1:
    raise SystemExit(f'SW cache-version drift: {sw.count(OLD_CACHE_VERSION)}')
sw_path.write_text(sw.replace(OLD_CACHE_VERSION, NEW_CACHE_VERSION, 1), encoding='utf-8')

baseline_path = Path('migration/sw-cache-version-baseline.json')
baseline = baseline_path.read_text(encoding='utf-8')
required_baseline = [
    '"version": 8',
    f'"currentDistProductionCacheVersion": "{OLD_CACHE_VERSION}"',
    f'"currentExpectedCacheVersion": "{OLD_CACHE_VERSION}"',
]
for anchor in required_baseline:
    if baseline.count(anchor) != 1:
        raise SystemExit(f'baseline anchor drift: {anchor}')
baseline = baseline.replace('"version": 8', '"version": 9', 1)
baseline = baseline.replace(f'"currentDistProductionCacheVersion": "{OLD_CACHE_VERSION}"', f'"currentDistProductionCacheVersion": "{NEW_CACHE_VERSION}"', 1)
baseline = baseline.replace(f'"currentExpectedCacheVersion": "{OLD_CACHE_VERSION}"', f'"currentExpectedCacheVersion": "{NEW_CACHE_VERSION}"', 1)
old_purpose = '"purpose": "Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v194 invalidates the precached Nagornaya CSS after the cascade-safe Chromium-confirmed dark-theme contrast repair. Source merge is not a production deployment."'
new_purpose = '"purpose": "Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v195 invalidates the cached search UI after truthful manifest-backed Scripture labels and suggestions replace unsupported full-Bible claims. Source merge is not a production deployment."'
if baseline.count(old_purpose) != 1:
    raise SystemExit('baseline purpose drift')
baseline_path.write_text(baseline.replace(old_purpose, new_purpose, 1), encoding='utf-8')

offline_path = Path('data/offline-route-matrix.json')
offline = offline_path.read_text(encoding='utf-8')
old_offline = f'"cacheVersion": "{OLD_CACHE_VERSION}"'
new_offline = f'"cacheVersion": "{NEW_CACHE_VERSION}"'
if offline.count(old_offline) != 1:
    raise SystemExit('offline cache-version drift')
offline_path.write_text(offline.replace(old_offline, new_offline, 1), encoding='utf-8')

print(f'Applied truthful Scripture suggestions, search revision {new_search_hash} across {len(changed_revision_files)} files, and SW cache v195.')
