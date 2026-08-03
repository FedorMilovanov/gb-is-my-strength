#!/usr/bin/env python3
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
product = root / 'src/components/karty/ishod/IshodMap.astro'
self_path = root / 'scripts/.tmp-pihahiroth-open-api-materialize-20260803.py'
workflow = root / '.github/workflows/.tmp-pihahiroth-open-api-materialize-20260803.yml'
text = product.read_text(encoding='utf-8')
old = "mapInstance.openPlace('pihahiroth');"
new = "mapInstance.open('pihahiroth');"
if text.count(old) != 1:
    raise SystemExit(f'expected one stale openPlace call, found {text.count(old)}')
if text.count(new) != 0:
    raise SystemExit('new open call already present')
product.write_text(text.replace(old, new, 1), encoding='utf-8')
subprocess.run(['git', 'diff', '--check'], cwd=root, check=True)
changed = {line[3:] for line in subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True).splitlines()}
allowed = {
    'src/components/karty/ishod/IshodMap.astro',
    'scripts/.tmp-pihahiroth-open-api-materialize-20260803.py',
    '.github/workflows/.tmp-pihahiroth-open-api-materialize-20260803.yml',
}
if not changed.issubset(allowed):
    raise SystemExit(f'unexpected paths: {sorted(changed - allowed)}')
self_path.unlink()
workflow.unlink()
print('materialized Pihahiroth instance API repair')
