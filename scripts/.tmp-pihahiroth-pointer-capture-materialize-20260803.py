#!/usr/bin/env python3
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
product = root / 'src/components/karty/ishod/IshodMap.astro'
contract = root / 'scripts/pihahiroth-uncertainty-release-contract.mjs'
self_path = root / 'scripts/.tmp-pihahiroth-pointer-capture-materialize-20260803.py'
workflow = root / '.github/workflows/.tmp-pihahiroth-pointer-capture-materialize-20260803.yml'

text = product.read_text(encoding='utf-8')
old = """      path.addEventListener('click', openPanel);
      path.addEventListener('keydown', openPanel);"""
new = """      // The shared canvas captures pointerdown for panning. Keep the pointer
      // sequence owned by the interactive corridor so its physical click is not
      // retargeted to the canvas before openPanel can run.
      path.addEventListener('pointerdown', function(event){ event.stopPropagation(); });
      path.addEventListener('click', openPanel);
      path.addEventListener('keydown', openPanel);"""
if text.count(old) != 1:
    raise SystemExit(f'expected one corridor listener anchor, found {text.count(old)}')
if "path.addEventListener('pointerdown'" in text:
    raise SystemExit('pointerdown ownership repair already present')
product.write_text(text.replace(old, new, 1), encoding='utf-8')

release = contract.read_text(encoding='utf-8')
anchor = '  "mapInstance.open(\'pihahiroth\')",\n'
addition = "  \"path.addEventListener('pointerdown'\",\n" + anchor
if release.count(anchor) != 1:
    raise SystemExit(f'expected one API contract anchor, found {release.count(anchor)}')
if "path.addEventListener('pointerdown'" in release:
    raise SystemExit('pointerdown release marker already present')
contract.write_text(release.replace(anchor, addition, 1), encoding='utf-8')

subprocess.run(['node','--check',str(contract.relative_to(root))], cwd=root, check=True)
subprocess.run(['node',str(contract.relative_to(root))], cwd=root, check=True)
subprocess.run(['git','diff','--check'], cwd=root, check=True)
changed = {line[3:] for line in subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True).splitlines()}
allowed = {
  'src/components/karty/ishod/IshodMap.astro',
  'scripts/pihahiroth-uncertainty-release-contract.mjs',
  'scripts/.tmp-pihahiroth-pointer-capture-materialize-20260803.py',
  '.github/workflows/.tmp-pihahiroth-pointer-capture-materialize-20260803.yml',
}
if not changed.issubset(allowed):
    raise SystemExit(f'unexpected paths: {sorted(changed - allowed)}')
self_path.unlink()
workflow.unlink()
print('materialized Pihahiroth pointer-capture ownership repair')
