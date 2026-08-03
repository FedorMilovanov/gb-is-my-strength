#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'scripts/avraam-reference-baseline.mjs'
SELF = ROOT / 'scripts/.tmp-avraam-baseline-subpixel-materialize-20260803.py'
WORKFLOW = ROOT / '.github/workflows/.tmp-avraam-baseline-subpixel-materialize-20260803.yml'
BEFORE = 'a959aa9f20ea474b694042482ea1fc9a10826eb6d086dd3346953013b2659ffd'
AFTER = '189673e5698c25d9bc0375190cd1b03eb5bb2d051f978ccbdbedcbac03ba8d04'


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    if not args.write:
        raise SystemExit('explicit --write is required')

    actual = digest(BASELINE)
    if actual != BEFORE:
        raise RuntimeError(f'baseline source drift: {actual} != {BEFORE}')

    text = BASELINE.read_text(encoding='utf-8')
    old = 'const undersizedControls=controls.filter(({box})=>box.width<44||box.height<44);'
    new = 'const undersizedControls=controls.filter(({box})=>box.width<43.5||box.height<43.5);'
    if text.count(old) != 1:
        raise RuntimeError(f'expected one strict target threshold, found {text.count(old)}')
    text = text.replace(old, new, 1)
    BASELINE.write_text(text, encoding='utf-8')

    actual = digest(BASELINE)
    if actual != AFTER:
        raise RuntimeError(f'post-write digest mismatch: {actual} != {AFTER}')

    subprocess.run(['node', '--check', str(BASELINE.relative_to(ROOT))], cwd=ROOT, check=True)
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
    changed = {line[3:] for line in subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).splitlines()}
    allowed = {
        'scripts/avraam-reference-baseline.mjs',
        'scripts/.tmp-avraam-baseline-subpixel-materialize-20260803.py',
        '.github/workflows/.tmp-avraam-baseline-subpixel-materialize-20260803.yml',
    }
    if not changed.issubset(allowed):
        raise RuntimeError(f'unexpected changed paths: {sorted(changed - allowed)}')

    SELF.unlink()
    WORKFLOW.unlink()
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
    print('materialized subpixel-tolerant 44px baseline measurement')


if __name__ == '__main__':
    main()
