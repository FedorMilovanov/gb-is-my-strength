#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import re
import subprocess

ROOT = Path.cwd()
SEARCH = ROOT / 'js/search.js'
ASSET_VERSIONS = ROOT / 'src/lib/asset-version.js'
SW = ROOT / 'sw.js'
BASELINE = ROOT / 'migration/sw-cache-version-baseline.json'
OFFLINE = ROOT / 'data/offline-route-matrix.json'

OLD_CACHE = 'gb-v195-search-truthful-scripture-20260804'
NEW_CACHE = 'gb-v196-scripture-occurrence-runtime-20260804'
OLD_SEARCH_HASH = 'f48e4610'
INSERT_ANCHOR = 'function Le(e){'

RUNTIME_BLOCK = r'''var __gbLegacySearch=xe,__gbScriptureIndexState={loaded:!1,loading:!1,data:null,waiters:[]};function __gbFlushScriptureIndex(e){var t=__gbScriptureIndexState.waiters.slice();__gbScriptureIndexState.waiters.length=0,__gbScriptureIndexState.loading=!1,__gbScriptureIndexState.loaded=!0,__gbScriptureIndexState.data=e,t.forEach(function(t){t(e)})}function __gbLoadScriptureIndex(e){if(__gbScriptureIndexState.loaded)return void e(__gbScriptureIndexState.data);if(__gbScriptureIndexState.waiters.push(e),!__gbScriptureIndexState.loading){__gbScriptureIndexState.loading=!0;fetch("/data/scripture-search-index.json",{cache:"no-cache"}).then(function(e){return e.ok?e.json():null}).then(function(e){__gbFlushScriptureIndex(e&&1===e.schemaVersion&&Array.isArray(e.references)?e:null)}).catch(function(){__gbFlushScriptureIndex(null)})}}function __gbExactScriptureReference(e,t){for(var i=$(t),n=e&&Array.isArray(e.references)?e.references:[],r=0;r<n.length;r++)if($(n[r].label)===i)return n[r];return null}function __gbScriptureOccurrenceItem(e,t,i,n){var r=t.url+(t.anchor?"#"+encodeURIComponent(t.anchor):""),a=t.context||t.title||e.label,o=["Точное вхождение"],s=(t.topics||[]).filter(Boolean);return s.length&&o.push(s[0]),{id:"xref-"+e.id+"-"+i,title:e.label,titleHtml:R(e.label,n),sub:a,subHtml:R(a,n),icon:c,meta:(t.anchor?"Якорь · ":"")+(t.title||"Материал"),tags:o,article:{url:r,title:t.title||e.label,author:null,readTime:null,category:"",scripture:e.label,excerpt:a,image:null},isScripture:!0,isExactScripture:!0}}function __gbRenderExactScripture(e,t){var i={},n=[];return(t.occurrences||[]).forEach(function(r,a){var o=r.url+"#"+(r.anchor||"");i[o]||(i[o]=!0,n.push(__gbScriptureOccurrenceItem(t,r,a,e)))}),n=n.slice(0,12),!!n.length&&(ae([{name:"Точные вхождения",items:n}]),T.textContent=(t.occurrences||[]).length+" вх.",!0)}function __gbSearchExactScripture(e){var t=++M;S.innerHTML='<div class="cp-loading">Ищу точные вхождения…</div>',__gbLoadScriptureIndex(function(i){if(t===M){var n=i&&__gbExactScriptureReference(i,e);n&&__gbRenderExactScripture(e,n)||__gbLegacySearch(e)}})}xe=function(e){return"scripture"===C&&e&&e.length>=2?void __gbSearchExactScripture(e):__gbLegacySearch(e)};'''


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact anchor, got {count}')
    if new in source:
        raise SystemExit(f'{label}: replacement already present before mutation')
    return source.replace(old, new, 1)


def search_reference_files() -> list[Path]:
    result = subprocess.run(
        ['git', 'grep', '-l', 'js/search.js?v=', '--', '*.html', '*.astro'],
        check=True,
        text=True,
        capture_output=True,
    )
    paths = [ROOT / line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not paths:
        raise SystemExit('no versioned search.js references found')
    return paths


def update_search_revisions(new_hash: str) -> list[str]:
    pattern = re.compile(r'(js/search\.js\?v=)[^\s"\'&}>]+')
    changed: list[str] = []
    for file in search_reference_files():
        source = file.read_text(encoding='utf-8')
        updated, count = pattern.subn(rf'\g<1>{new_hash}', source)
        if count < 1:
            raise SystemExit(f'{file}: expected at least one search.js revision')
        if updated != source:
            file.write_text(updated, encoding='utf-8')
            changed.append(file.relative_to(ROOT).as_posix())
    return changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    if not args.write:
        raise SystemExit('explicit --write is required')

    search = SEARCH.read_text(encoding='utf-8')
    if RUNTIME_BLOCK in search:
        raise SystemExit('S2 runtime block already exists before mutation')
    search = replace_once(search, INSERT_ANCHOR, RUNTIME_BLOCK + INSERT_ANCHOR, 'search runtime insertion')
    SEARCH.write_text(search, encoding='utf-8')
    new_hash = hashlib.md5(SEARCH.read_bytes()).hexdigest()[:8]
    if new_hash == OLD_SEARCH_HASH:
        raise SystemExit('search.js hash did not change')

    changed_refs = update_search_revisions(new_hash)

    asset = ASSET_VERSIONS.read_text(encoding='utf-8')
    asset = replace_once(
        asset,
        f"  'js/search.js': '{OLD_SEARCH_HASH}',",
        f"  'js/search.js': '{new_hash}',",
        'asset-version search hash',
    )
    ASSET_VERSIONS.write_text(asset, encoding='utf-8')

    sw = SW.read_text(encoding='utf-8')
    sw = replace_once(sw, f"const CACHE_VERSION = '{OLD_CACHE}';", f"const CACHE_VERSION = '{NEW_CACHE}';", 'SW cache version')
    SW.write_text(sw, encoding='utf-8')

    baseline = BASELINE.read_text(encoding='utf-8')
    for anchor in [
        '"version": 9',
        f'"currentDistProductionCacheVersion": "{OLD_CACHE}"',
        f'"currentExpectedCacheVersion": "{OLD_CACHE}"',
    ]:
        if baseline.count(anchor) != 1:
            raise SystemExit(f'baseline drift: {anchor}')
    baseline = baseline.replace('"version": 9', '"version": 10', 1)
    baseline = baseline.replace(
        f'"currentDistProductionCacheVersion": "{OLD_CACHE}"',
        f'"currentDistProductionCacheVersion": "{NEW_CACHE}"',
        1,
    )
    baseline = baseline.replace(
        f'"currentExpectedCacheVersion": "{OLD_CACHE}"',
        f'"currentExpectedCacheVersion": "{NEW_CACHE}"',
        1,
    )
    old_purpose = '"purpose": "Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v195 invalidates the cached search UI after truthful manifest-backed Scripture labels and suggestions replace unsupported full-Bible claims. Source merge is not a production deployment."'
    new_purpose = '"purpose": "Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v196 invalidates the cached search UI after exact Scripture occurrences are rendered from the canonical source-owned index before metadata/Pagefind fallback. Source merge is not a production deployment."'
    baseline = replace_once(baseline, old_purpose, new_purpose, 'baseline purpose')
    BASELINE.write_text(baseline, encoding='utf-8')

    offline = OFFLINE.read_text(encoding='utf-8')
    offline = replace_once(
        offline,
        f'"cacheVersion": "{OLD_CACHE}"',
        f'"cacheVersion": "{NEW_CACHE}"',
        'offline cache version',
    )
    OFFLINE.write_text(offline, encoding='utf-8')

    print(f'Applied exact-reference-first Scripture runtime; search.js {OLD_SEARCH_HASH} → {new_hash}; revision owners: {len(changed_refs)}.')


if __name__ == '__main__':
    main()
