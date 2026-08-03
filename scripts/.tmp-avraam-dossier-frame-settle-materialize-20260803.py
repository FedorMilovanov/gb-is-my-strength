#!/usr/bin/env python3
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
witness = root / 'scripts/avraam-dossier-witness.mjs'
self_path = root / 'scripts/.tmp-avraam-dossier-frame-settle-materialize-20260803.py'
workflow = root / '.github/workflows/.tmp-avraam-dossier-frame-settle-materialize-20260803.yml'
text = witness.read_text(encoding='utf-8')
old = """        await tab.click();
        await page.waitForTimeout(70);
        const state = await inspectPanel(page);"""
new = """        await tab.click();
        // renderTabContent enters at translateX(4px) and settles on the next
        // animation frame. Geometry must describe the steady panel, not a
        // transient four-pixel entrance transform on a busy CI runner.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForFunction(() => {
          const content = document.querySelector('.me-content[role=\"tabpanel\"]');
          if (!content) return false;
          const transform = getComputedStyle(content).transform;
          if (transform === 'none') return true;
          try { return Math.abs(new DOMMatrixReadOnly(transform).m41) < 0.25; }
          catch { return false; }
        });
        const state = await inspectPanel(page);"""
if text.count(old) != 1:
    raise SystemExit(f'expected one tab-settle anchor, found {text.count(old)}')
if 'steady panel, not a' in text:
    raise SystemExit('frame-settle repair already present')
witness.write_text(text.replace(old, new, 1), encoding='utf-8')
subprocess.run(['node','--check',str(witness.relative_to(root))], cwd=root, check=True)
subprocess.run(['git','diff','--check'], cwd=root, check=True)
changed = {line[3:] for line in subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True).splitlines()}
allowed = {
  'scripts/avraam-dossier-witness.mjs',
  'scripts/.tmp-avraam-dossier-frame-settle-materialize-20260803.py',
  '.github/workflows/.tmp-avraam-dossier-frame-settle-materialize-20260803.yml',
}
if not changed.issubset(allowed):
    raise SystemExit(f'unexpected paths: {sorted(changed - allowed)}')
self_path.unlink()
workflow.unlink()
print('materialized steady-frame dossier geometry witness')
