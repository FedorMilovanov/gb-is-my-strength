from pathlib import Path

root = Path(__file__).resolve().parents[1]
product_path = root / 'src/components/karty/ishod/IshodMap.astro'
self_path = root / 'scripts/pihahiroth-pointer-product-materialize.py'
workflow_path = root / '.github/workflows/pihahiroth-pointer-product-materialize.yml'

text = product_path.read_text(encoding='utf-8')
old = """        if (event) event.preventDefault();
        mapInstance.openPlace('pihahiroth');"""
new = """        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        mapInstance.openPlace('pihahiroth');"""
if text.count(old) != 1:
    raise SystemExit(f'expected one corridor openPanel owner, found {text.count(old)}')
text = text.replace(old, new, 1)
if text.count('event.stopPropagation();') < 1:
    raise SystemExit('corridor event isolation missing')
product_path.write_text(text, encoding='utf-8')
self_path.unlink()
workflow_path.unlink()
