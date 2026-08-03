#!/usr/bin/env python3
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
contract = root / 'scripts/pihahiroth-uncertainty-release-contract.mjs'
self_path = root / 'scripts/.tmp-pihahiroth-release-api-contract-20260803.py'
workflow = root / '.github/workflows/.tmp-pihahiroth-release-api-contract-20260803.yml'
text = contract.read_text(encoding='utf-8')
old = '  "mapInstance.openPlace(\'pihahiroth\')",\n'
new = '  "mapInstance.open(\'pihahiroth\')",\n'
if text.count(old) != 1:
    raise SystemExit(f'expected one stale API marker, found {text.count(old)}')
text = text.replace(old, new, 1)
anchor = "]) requireValue(adapter.includes(marker), `adapter contract marker missing: ${marker}`);\n\n"
addition = "]) requireValue(adapter.includes(marker), `adapter contract marker missing: ${marker}`);\nrequireValue(!adapter.includes(\"mapInstance.openPlace('pihahiroth')\"), 'stale map instance API returned to adapter');\n\n"
if text.count(anchor) != 1:
    raise SystemExit(f'expected one marker loop anchor, found {text.count(anchor)}')
text = text.replace(anchor, addition, 1)
contract.write_text(text, encoding='utf-8')
subprocess.run(['node','--check',str(contract.relative_to(root))], cwd=root, check=True)
subprocess.run(['node',str(contract.relative_to(root))], cwd=root, check=True)
subprocess.run(['git','diff','--check'], cwd=root, check=True)
changed = {line[3:] for line in subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True).splitlines()}
allowed = {
  'scripts/pihahiroth-uncertainty-release-contract.mjs',
  'scripts/.tmp-pihahiroth-release-api-contract-20260803.py',
  '.github/workflows/.tmp-pihahiroth-release-api-contract-20260803.yml',
}
if not changed.issubset(allowed):
    raise SystemExit(f'unexpected paths: {sorted(changed - allowed)}')
self_path.unlink()
workflow.unlink()
print('materialized Pihahiroth release API contract repair')
