#!/usr/bin/env python3
from __future__ import annotations

import hashlib
from pathlib import Path
import re
import subprocess

ROOT = Path.cwd()
SITE_JS = ROOT / 'js/site.js'
SITE_CSS = ROOT / 'css/site.css'
CONTRACT = ROOT / 'scripts/bible-reference-contract.mjs'
A04 = ROOT / 'scripts/lib/a04-contract.mjs'
DOC = ROOT / 'docs/REFERENCE-TOOLTIP-CONTRACT.md'
ASSET = ROOT / 'src/lib/asset-version.js'
SW = ROOT / 'sw.js'
BASELINE = ROOT / 'migration/sw-cache-version-baseline.json'
OFFLINE = ROOT / 'data/offline-route-matrix.json'

OLD_SITE_HASH = '38b94307'
OLD_CSS_HASH = '6c30f93f'
OLD_CACHE = 'gb-v196-scripture-occurrence-runtime-20260804'
NEW_CACHE = 'gb-v197-bible-legacy-authority-20260804'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact anchor, got {count}')
    if old == new:
        raise SystemExit(f'{label}: replacement is identical')
    return source.replace(old, new, 1)


def revision_files(asset_path: str) -> list[Path]:
    result = subprocess.run(
        ['git', 'grep', '-l', f'{asset_path}?v=', '--', '*.html', '*.astro', '*.mdx'],
        check=True,
        text=True,
        capture_output=True,
    )
    files = [ROOT / line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not files:
        raise SystemExit(f'no versioned references found for {asset_path}')
    return files


def update_revisions(asset_path: str, old_hash: str, new_hash: str) -> list[str]:
    pattern = re.compile(rf'({re.escape(asset_path)}\?v=)([^\s\"\'&}}>]+)')
    changed: list[str] = []
    seen: set[str] = set()
    for file in revision_files(asset_path):
        source = file.read_text(encoding='utf-8')
        for match in pattern.finditer(source):
            seen.add(match.group(2))
        updated, count = pattern.subn(rf'\g<1>{new_hash}', source)
        if count < 1:
            raise SystemExit(f'{file}: expected at least one {asset_path} revision')
        if updated != source:
            file.write_text(updated, encoding='utf-8')
            changed.append(file.relative_to(ROOT).as_posix())
    if seen != {old_hash}:
        raise SystemExit(f'{asset_path}: expected only {old_hash}, saw {sorted(seen)}')
    return changed


def main() -> None:
    legacy_file = ROOT / 'data/verses.json'
    if legacy_file.exists():
        raise SystemExit('legacy verse dataset must already be deleted on the candidate branch')

    site = SITE_JS.read_text(encoding='utf-8')
    start_marker = '/* §1.9 Bible verse popovers (.gbx-verse[data-verse]) */'
    end_marker = '/* §1.10 Original word cards (.gbx-ow[data-ow]) */'
    if site.count(start_marker) != 1 or site.count(end_marker) != 1:
        raise SystemExit('site.js legacy runtime markers drifted')
    start = site.index(start_marker)
    end = site.index(end_marker, start)
    site = site[:start] + site[end:]
    if '/data/verses.json' in site or 'gbx-verse' in site:
        raise SystemExit('site.js still contains legacy verse runtime')
    SITE_JS.write_text(site, encoding='utf-8')

    css = SITE_CSS.read_text(encoding='utf-8')
    start_marker = '.gbx-verse{'
    end_marker = '.gbx-ow{'
    if css.count(start_marker) != 1 or css.count(end_marker) != 1:
        raise SystemExit('site.css legacy style markers drifted')
    start = css.index(start_marker)
    end = css.index(end_marker, start)
    css = css[:start] + css[end:]
    css = replace_once(
        css,
        '@media (max-width:768px){.gbx-verse-tip,.gbx-ow-card{',
        '@media (max-width:768px){.gbx-ow-card{',
        'mobile legacy selector',
    )
    css = replace_once(
        css,
        '.gbx-verse-tip.gbx-verse-tip--open,.gbx-ow-card.gbx-ow--open{',
        '.gbx-ow-card.gbx-ow--open{',
        'mobile legacy open selector',
    )
    css = replace_once(
        css,
        '@media print{.gbx-verse-tip,.gbx-ow-card{display:none}}',
        '@media print{.gbx-ow-card{display:none}}',
        'print legacy selector',
    )
    if 'gbx-verse' in css:
        raise SystemExit('site.css still contains legacy verse selectors')
    SITE_CSS.write_text(css, encoding='utf-8')

    contract = CONTRACT.read_text(encoding='utf-8')
    old_function = '''function inspectLegacyAuthority(files) {
  if (fs.existsSync(LEGACY_VERSES_FILE)) {
    fail(`${LEGACY_VERSES_RELATIVE}: legacy verse authority must remain absent; only governed data/bible records may own canonical text`);
  }

  const forbiddenTokens = [LEGACY_VERSES_RELATIVE, `/${LEGACY_VERSES_RELATIVE}`];
  for (const file of files) {
    if (path.resolve(file) === path.resolve(CONTRACT_FILE)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (forbiddenTokens.some((token) => source.includes(token))) {
      fail(`${rel(file)}: forbidden consumer of removed legacy verse authority ${LEGACY_VERSES_RELATIVE}`);
    }
  }
}'''
    new_function = '''function inspectLegacyAuthority(files) {
  if (fs.existsSync(LEGACY_VERSES_FILE)) {
    fail(`${LEGACY_VERSES_RELATIVE}: legacy verse authority must remain absent; only governed data/bible records may own canonical text`);
  }

  const forbiddenTokens = [LEGACY_VERSES_RELATIVE, `/${LEGACY_VERSES_RELATIVE}`];
  const sourceExtensions = new Set(['.astro', '.html', '.js', '.mjs', '.ts', '.tsx']);
  const markupExtensions = new Set(['.astro', '.html']);
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (!sourceExtensions.has(extension) || path.resolve(file) === path.resolve(CONTRACT_FILE)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (forbiddenTokens.some((token) => source.includes(token))) {
      fail(`${rel(file)}: forbidden consumer of removed legacy verse authority ${LEGACY_VERSES_RELATIVE}`);
    }
    if (markupExtensions.has(extension) && /(?:class\\s*=\\s*["'][^"']*\\bgbx-verse\\b|\\bdata-verse\\s*=)/iu.test(source)) {
      fail(`${rel(file)}: forbidden public legacy verse trigger; use canonical .bref/.btip projection`);
    }
  }
}'''
    contract = replace_once(contract, old_function, new_function, 'legacy authority contract')
    CONTRACT.write_text(contract, encoding='utf-8')

    a04 = A04.read_text(encoding='utf-8')
    a04 = replace_once(
        a04,
        "  Object.freeze({ id: 'legacy-verse', trigger: '.gbx-verse', tip: '.gbx-verse-tip', decision: 'DELETE_DEAD_RUNTIME' }),",
        "  Object.freeze({ id: 'legacy-verse', trigger: '.gbx-verse', tip: '.gbx-verse-tip', decision: 'REMOVED_PERMANENTLY' }),",
        'A04 legacy decision',
    )
    a04 = replace_once(
        a04,
        "    legacyVerses: {\n      path: 'data/verses.json', exists: existsSync(join(ROOT, 'data', 'verses.json')),\n      status: 'superseded-flat-dataset',\n    },",
        "    legacyVerses: {\n      path: null, exists: false, status: 'removed-permanently',\n      runtime: 'removed', publicTriggerAllowed: false,\n    },",
        'A04 legacy source snapshot',
    )
    A04.write_text(a04, encoding='utf-8')

    doc = DOC.read_text(encoding='utf-8')
    doc = replace_once(
        doc,
        "- `.gbx-verse` and `.gbx-ow` are dormant legacy projections and are forbidden in public markup. Their independent runtimes must not be revived or copied into Astro components.\n- `data/verses.json` is a superseded flat dataset. It may be removed only atomically with the legacy `.gbx-verse` runtime and matching CSS; deleting only the data or hiding the fetch behind a compatibility flag is prohibited.",
        "- `.gbx-verse`, its flat verse dataset, independent runtime and matching CSS were removed atomically. Public `.gbx-verse`/`data-verse` markup and any replacement legacy fetch are permanently forbidden; canonical Bible tooltips use `.bref > .btip` and governed `data/bible/**` records only.\n- `.gbx-ow` remains a dormant legacy projection and is forbidden in public markup. Its independent runtime must not be copied into Astro components; `data/original-words.json` remains data-only under the boundary above.",
        'tooltip contract legacy boundary',
    )
    DOC.write_text(doc, encoding='utf-8')

    new_site_hash = hashlib.md5(SITE_JS.read_bytes()).hexdigest()[:8]
    new_css_hash = hashlib.md5(SITE_CSS.read_bytes()).hexdigest()[:8]
    if new_site_hash == OLD_SITE_HASH or new_css_hash == OLD_CSS_HASH:
        raise SystemExit('asset hash did not change')
    site_refs = update_revisions('js/site.js', OLD_SITE_HASH, new_site_hash)
    css_refs = update_revisions('css/site.css', OLD_CSS_HASH, new_css_hash)

    asset = ASSET.read_text(encoding='utf-8')
    asset = replace_once(asset, f"  'js/site.js': '{OLD_SITE_HASH}',", f"  'js/site.js': '{new_site_hash}',", 'site asset hash')
    asset = replace_once(asset, f"  'css/site.css': '{OLD_CSS_HASH}',", f"  'css/site.css': '{new_css_hash}',", 'css asset hash')
    ASSET.write_text(asset, encoding='utf-8')

    sw = SW.read_text(encoding='utf-8')
    sw = replace_once(sw, f"const CACHE_VERSION = '{OLD_CACHE}';", f"const CACHE_VERSION = '{NEW_CACHE}';", 'SW cache version')
    SW.write_text(sw, encoding='utf-8')

    baseline = BASELINE.read_text(encoding='utf-8')
    baseline = replace_once(baseline, '"version": 10', '"version": 11', 'baseline version')
    baseline = replace_once(
        baseline,
        f'"currentDistProductionCacheVersion": "{OLD_CACHE}"',
        f'"currentDistProductionCacheVersion": "{NEW_CACHE}"',
        'baseline dist cache',
    )
    baseline = replace_once(
        baseline,
        f'"currentExpectedCacheVersion": "{OLD_CACHE}"',
        f'"currentExpectedCacheVersion": "{NEW_CACHE}"',
        'baseline expected cache',
    )
    old_purpose = '"purpose": "Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v196 invalidates the cached search UI after exact Scripture occurrences are rendered from the canonical source-owned index before metadata/Pagefind fallback. Source merge is not a production deployment."'
    new_purpose = '"purpose": "Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v197 invalidates cached site runtime and CSS after the deprecated flat verse dataset, dead .gbx-verse fetch runtime and matching selectors are removed atomically. Source merge is not a production deployment."'
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

    print(
        f'Removed legacy verse authority atomically; site.js {OLD_SITE_HASH}→{new_site_hash}, '
        f'site.css {OLD_CSS_HASH}→{new_css_hash}; site refs={len(site_refs)}, css refs={len(css_refs)}.'
    )


if __name__ == '__main__':
    main()
