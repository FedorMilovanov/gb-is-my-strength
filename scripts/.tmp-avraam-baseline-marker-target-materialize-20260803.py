#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'karty/_engine/map-engine.js'
BASELINE = ROOT / 'scripts/avraam-reference-baseline.mjs'
SELF = ROOT / 'scripts/.tmp-avraam-baseline-marker-target-materialize-20260803.py'
WORKFLOW = ROOT / '.github/workflows/.tmp-avraam-baseline-marker-target-materialize-20260803.yml'

EXPECTED_BEFORE = {
    ENGINE: '4561f431c2386ef04ac190221a8458fa160eb02cac3e85c4a76d3f0bc3acd491',
    BASELINE: 'd85495211bc8c180f4e1b272151cf04b57c7e5f418c04331c68190cc735cd48e',
}
EXPECTED_AFTER = {
    ENGINE: 'a61d909f76c6219fd7db09e33fa0b02426fcc4d09e265b7b12a6d6136c40c314',
    BASELINE: 'a959aa9f20ea474b694042482ea1fc9a10826eb6d086dd3346953013b2659ffd',
}


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    if not args.write:
        raise SystemExit('explicit --write is required')

    for path, expected in EXPECTED_BEFORE.items():
        actual = sha(path)
        if actual != expected:
            raise RuntimeError(f'source drift for {path.relative_to(ROOT)}: {actual} != {expected}')

    engine = ENGINE.read_text(encoding='utf-8')
    engine = replace_once(
        engine,
        "hit.setAttribute('r','20')",
        "hit.setAttribute('r','22')",
        '44px SVG marker target',
    )
    ENGINE.write_text(engine, encoding='utf-8')

    baseline = BASELINE.read_text(encoding='utf-8')
    baseline = replace_once(
        baseline,
        "const offscreenControls=controls.filter(({box,scrollReachable})=>!scrollReachable&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));",
        "const offscreenControls=controls.filter(({box,scrollReachable,placeId})=>!placeId&&!scrollReachable&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));",
        'pannable marker offscreen classification',
    )
    BASELINE.write_text(baseline, encoding='utf-8')

    for path, expected in EXPECTED_AFTER.items():
        actual = sha(path)
        if actual != expected:
            raise RuntimeError(f'post-write digest mismatch for {path.relative_to(ROOT)}: {actual} != {expected}')

    subprocess.run(['node', '--check', str(ENGINE.relative_to(ROOT))], cwd=ROOT, check=True)
    subprocess.run(['node', '--check', str(BASELINE.relative_to(ROOT))], cwd=ROOT, check=True)
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)

    changed = {line[3:] for line in subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).splitlines()}
    allowed = {
        'karty/_engine/map-engine.js',
        'scripts/avraam-reference-baseline.mjs',
        'scripts/.tmp-avraam-baseline-marker-target-materialize-20260803.py',
        '.github/workflows/.tmp-avraam-baseline-marker-target-materialize-20260803.yml',
    }
    if not changed.issubset(allowed):
        raise RuntimeError(f'unexpected changed paths: {sorted(changed - allowed)}')

    SELF.unlink()
    WORKFLOW.unlink()
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
    print('materialized 44px map-marker target and pannable-control baseline classification')


if __name__ == '__main__':
    main()
