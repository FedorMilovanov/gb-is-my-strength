#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'patched {label}: {relative}')


replace_once(
    'scripts/audit-pro.js',
    "  'css/nagornaya-mobile-toc.css',\n  'css/series-samizdat.css'\n]);",
    "  'css/nagornaya-mobile-toc.css',\n  'css/series-samizdat.css',\n  'css/reader-preferences.css'\n]);",
    'audit CSS allowlist',
)

replace_once(
    'scripts/audit-pro.js',
    "  'js/floating-cluster-controller.js',\n  'js/vosk-tts-core.js',",
    "  'js/floating-cluster-controller.js',\n  'js/reader-preferences-head.js',\n  'js/reader-preferences.js',\n  'js/vosk-tts-core.js',",
    'audit JS allowlist',
)

replace_once(
    'sw.js',
    'CACHE_VERSION="gb-v190-precache-sync-20260714"',
    'CACHE_VERSION="gb-v191-reader-preferences-20260721"',
    'service worker cache version',
)

replace_once(
    'sw.js',
    '"/css/floating-cluster.css","/css/series-samizdat.css",',
    '"/css/floating-cluster.css","/css/series-samizdat.css","/css/reader-preferences.css",',
    'service worker reader CSS',
)

replace_once(
    'sw.js',
    '"/js/nagornaya-mobile-toc.js","/js/floating-cluster-controller.js","/pagefind/pagefind.js"',
    '"/js/nagornaya-mobile-toc.js","/js/floating-cluster-controller.js","/js/reader-preferences-head.js","/js/reader-preferences.js","/pagefind/pagefind.js"',
    'service worker reader JS',
)

replace_once(
    'css/reader-preferences.css',
    '''/* Sepia is semantic color, never a blanket media filter. */
html[data-reader-theme="sepia"] img,
html[data-reader-theme="sepia"] picture,
html[data-reader-theme="sepia"] video,
html[data-reader-theme="sepia"] canvas,
html[data-reader-theme="sepia"] .me-canvas svg,
html[data-reader-theme="sepia"] .hall-stage {
  filter: none;
}

''',
    '''/* Sepia changes semantic color tokens only. It deliberately leaves every
   route-owned image, video, canvas, SVG and 3D filter untouched. */

''',
    'non-invasive Sepia media contract',
)

print('reader asset integration patch complete')
