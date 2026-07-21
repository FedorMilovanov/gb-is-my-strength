#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "js/highlights.js"
TEST = ROOT / "scripts/highlights-runtime-regression-test.js"
TRIGGER = ROOT / ".github/_temp-highlights-hardening-trigger"
SELF = Path(__file__).resolve()


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def apply_patch() -> None:
    source = RUNTIME.read_text(encoding="utf-8")

    old_prefix = '(function(){"use strict";var T="gb-highlights-v1",U=!1;function f(){try{return JSON.parse(localStorage.getItem(T)||"[]")}catch(e){return[]}}function C(e){'
    new_prefix = r'''(function(){"use strict";var T="gb-highlights-v1",U=!1;function gbHighlightPath(e){var t=e&&e.url?String(e.url):"";try{var i=new URL(t,window.location.origin).pathname;return i=i.replace(/\/+$/,""),i||"/"}catch(r){return t.split("#")[0].split("?")[0].replace(/^https?:\/\/[^/]+/i,"").replace(/\/+$/,"" )||"/"}}function gbHighlightText(e){return String(e&&e.text||"").replace(/\s+/g," ").trim().toLocaleLowerCase()}function gbHighlightKey(e){var t=gbHighlightText(e);return t?gbHighlightPath(e)+"\n"+t:""}function gbDedupeHighlights(e){var t=[],i=new Set;return(Array.isArray(e)?e:[]).forEach(function(e,r){var n=gbHighlightKey(e),a=n||"__invalid__:"+(e&&e.id||r);i.has(a)||(i.add(a),t.push(e))}),t}function gbAddHighlight(e,t){var i=gbDedupeHighlights(e),r=gbHighlightKey(t);return r&&i.some(function(e){return gbHighlightKey(e)===r})?i:(i.unshift(t),i.slice(0,200))}function f(){try{var e=JSON.parse(localStorage.getItem(T)||"[]"),t=Array.isArray(e)?e:[],i=gbDedupeHighlights(t);return i.length!==t.length&&C(i),i}catch(e){return[]}}function C(e){'''

    source = once(source, old_prefix, new_prefix, "state helper prefix")
    source = once(
        source,
        'l.setAttribute("aria-modal","true"),l.setAttribute("aria-label"',
        'l.setAttribute("aria-modal","true"),l.setAttribute("aria-hidden","true"),l.setAttribute("aria-label"',
        "initial dialog aria-hidden",
    )
    source = once(
        source,
        'l.classList.add("is-open"),window.SiteUtils',
        'l.classList.add("is-open"),l.setAttribute("aria-hidden","false"),window.SiteUtils',
        "dialog open aria-hidden",
    )
    source = once(
        source,
        'l.classList.remove("is-open"),l.removeEventListener',
        'l.classList.remove("is-open"),l.setAttribute("aria-hidden","true"),l.removeEventListener',
        "dialog close aria-hidden",
    )
    source = once(
        source,
        ',c=f();c.unshift({id:',
        ',c=f();c=gbAddHighlight(c,{id:',
        "save through add helper",
    )
    source = once(
        source,
        ',c.length>200&&(c=c.slice(0,200)),C(c),v()',
        ',C(c),v()',
        "remove duplicate local cap",
    )
    RUNTIME.write_text(source, encoding="utf-8")

    test_source = textwrap.dedent(
        r'''\
        #!/usr/bin/env node
        'use strict';

        const assert = require('node:assert/strict');
        const fs = require('node:fs');
        const path = require('node:path');
        const vm = require('node:vm');

        const sourcePath = path.resolve(__dirname, '..', 'js', 'highlights.js');
        const source = fs.readFileSync(sourcePath, 'utf8');
        const start = source.indexOf('function gbHighlightPath');
        const end = source.indexOf('function f(){', start);
        assert.ok(start >= 0 && end > start, 'pure highlight helpers must be embedded in production runtime');

        const context = {
          URL,
          window: { location: { origin: 'https://gospod-bog.ru' } },
        };
        vm.createContext(context);
        vm.runInContext(
          `${source.slice(start, end)};this.api={path:gbHighlightPath,text:gbHighlightText,key:gbHighlightKey,dedupe:gbDedupeHighlights,add:gbAddHighlight};`,
          context,
        );
        const api = context.api;
        const plain = (value) => JSON.parse(JSON.stringify(value));

        const existing = [
          { id: 'newest', text: '  Одна   цитата ', url: 'https://gospod-bog.ru/articles/a/#one', savedAt: 30 },
          { id: 'older', text: 'одна цитата', url: 'https://gospod-bog.ru/articles/a/#two', savedAt: 20 },
          { id: 'other-page', text: 'Одна цитата', url: 'https://gospod-bog.ru/articles/b/#one', savedAt: 10 },
        ];

        const compacted = plain(api.dedupe(existing));
        assert.deepEqual(
          compacted.map((item) => item.id),
          ['newest', 'other-page'],
          'old duplicates compact while preserving newest stable order and cross-page quote',
        );

        const samePage = plain(api.add(compacted, {
          id: 'duplicate-attempt',
          text: 'одна\nцитата',
          url: '/articles/a/?from=test#another',
          savedAt: 40,
        }));
        assert.deepEqual(
          samePage.map((item) => item.id),
          ['newest', 'other-page'],
          'same-page duplicate is not inserted or reordered',
        );

        const crossPage = plain(api.add(compacted, {
          id: 'third-page',
          text: 'ОДНА ЦИТАТА',
          url: '/articles/c/#one',
          savedAt: 40,
        }));
        assert.deepEqual(
          crossPage.map((item) => item.id),
          ['third-page', 'newest', 'other-page'],
          'same quote on another path remains valid and is inserted first',
        );

        const many = Array.from({ length: 205 }, (_, index) => ({
          id: `item-${index}`,
          text: `quote ${index}`,
          url: `/articles/${index}/`,
        }));
        assert.equal(
          api.add(many, { id: 'fresh', text: 'fresh quote', url: '/fresh/' }).length,
          200,
          '200-item cap remains enforced',
        );

        assert.match(source, /i\.length!==t\.length&&C\(i\)/, 'read path persists compacted legacy data');
        assert.match(source, /c=gbAddHighlight\(c,\{id:/, 'save path uses canonical duplicate guard');
        assert.doesNotMatch(source, /c\.unshift\(\{id:/, 'legacy unconditional quote insertion is removed');
        assert.match(source, /aria-modal","true"\),l\.setAttribute\("aria-hidden","true"\)/, 'dialog starts hidden from accessibility APIs');
        assert.match(source, /classList\.add\("is-open"\),l\.setAttribute\("aria-hidden","false"\)/, 'open path exposes dialog');
        assert.match(source, /classList\.remove\("is-open"\),l\.setAttribute\("aria-hidden","true"\)/, 'close path hides dialog');

        console.log('✅ highlights runtime dedupe + ARIA regression passed');
        '''
    )
    TEST.write_text(test_source, encoding="utf-8")


def verify_diff_and_cleanup() -> None:
    changed = subprocess.check_output(
        ["git", "diff", "--name-only"], cwd=ROOT, text=True
    ).splitlines()
    allowed_exact = {
        "js/highlights.js",
        "scripts/highlights-runtime-regression-test.js",
        "src/lib/asset-version.js",
        ".github/_temp-highlights-hardening-trigger",
        "scripts/_temp-highlights-runtime-hardening-patch.py",
    }
    unexpected = [
        path
        for path in changed
        if path not in allowed_exact
        and not path.endswith(".html")
        and not path.endswith(".astro")
    ]
    if unexpected:
        raise SystemExit("unexpected paths: " + ", ".join(unexpected))
    required = {
        "js/highlights.js",
        "scripts/highlights-runtime-regression-test.js",
    }
    missing = required.difference(changed)
    if missing:
        raise SystemExit("required permanent files are missing: " + ", ".join(sorted(missing)))

    if TRIGGER.exists():
        TRIGGER.unlink()
    SELF.unlink()
    subprocess.run(["git", "diff", "--check"], cwd=ROOT, check=True)
    print(f"✅ restricted generated transaction: {len(changed)} pre-cleanup paths")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-diff-and-cleanup", action="store_true")
    args = parser.parse_args()
    if args.verify_diff_and_cleanup:
        verify_diff_and_cleanup()
    else:
        apply_patch()


if __name__ == "__main__":
    main()
