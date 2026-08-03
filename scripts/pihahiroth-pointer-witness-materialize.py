from pathlib import Path

root = Path(__file__).resolve().parents[1]
target_path = root / 'scripts/pihahiroth-uncertainty-browser-contract.mjs'
self_path = root / 'scripts/pihahiroth-pointer-witness-materialize.py'
workflow_path = root / '.github/workflows/pihahiroth-pointer-witness-materialize.yml'

text = target_path.read_text(encoding='utf-8')
old = """    await enterInteractiveMap(page, profile.id);
    await corridors.nth(1).click({ timeout: 5_000 });
    await page.locator('.me-panel.me-panel--open').waitFor({ state: 'visible', timeout: 5_000 });
"""
new = """    await enterInteractiveMap(page, profile.id);
    const targetCorridor = corridors.nth(1);
    const exposedPoint = await targetCorridor.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const matrix = node.getScreenCTM?.();
      if (!matrix || rect.width <= 0 || rect.height <= 0) return null;
      const inverse = matrix.inverse();
      const steps = 24;
      for (let row = 0; row < steps; row += 1) {
        for (let column = 0; column < steps; column += 1) {
          const x = rect.left + ((column + 0.5) / steps) * rect.width;
          const y = rect.top + ((row + 0.5) / steps) * rect.height;
          const local = new DOMPoint(x, y).matrixTransform(inverse);
          const inFill = typeof node.isPointInFill === 'function' && node.isPointInFill(local);
          const inStroke = typeof node.isPointInStroke === 'function' && node.isPointInStroke(local);
          if (!inFill && !inStroke) continue;
          const top = document.elementFromPoint(x, y);
          if (top === node) return { x, y, row, column, topTag: top.tagName };
        }
      }
      return null;
    });
    check(profile.id, 'corridors:pointer-exposed-point', Boolean(exposedPoint), JSON.stringify(exposedPoint));
    if (!exposedPoint) throw new Error('target corridor has no physically exposed pointer point');
    await page.mouse.click(exposedPoint.x, exposedPoint.y);
    await page.locator('.me-panel.me-panel--open').waitFor({ state: 'visible', timeout: 5_000 });
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one center-click block, found {text.count(old)}')
text = text.replace(old, new, 1)
if text.count("corridors:pointer-exposed-point") != 1:
    raise SystemExit('exposed-point contract marker drift')
if "target corridor has no physically exposed pointer point" not in text:
    raise SystemExit('fail-closed exposed-point error missing')
target_path.write_text(text, encoding='utf-8')
self_path.unlink()
workflow_path.unlink()
