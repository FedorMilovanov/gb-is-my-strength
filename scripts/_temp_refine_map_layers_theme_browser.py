#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
engine_path = ROOT / 'karty/_engine/map-engine.js'
browser_path = ROOT / 'scripts/map-layers-theme-browser-smoke.js'
pure_path = ROOT / 'scripts/map-layers-theme-regression-test.js'


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    engine_path,
    """      container.setAttribute('data-map-theme',palette.id);
      container.style.setProperty('--me-bg',palette.bg);""",
    """      container.setAttribute('data-map-theme',palette.id);
      container.style.backgroundColor=palette.bg;
      container.style.color=palette.text;
      container.style.setProperty('--me-bg',palette.bg);""",
    'apply actual container palette',
)

replace_once(
    browser_path,
    """    await context.addInitScript(() => {
      try { localStorage.removeItem('me-map-theme'); } catch (_) {}
    });""",
    """    const resetPage = await context.newPage();
    await resetPage.goto(`${BASE}/karty/ishod/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await resetPage.evaluate(() => { try { localStorage.removeItem('me-map-theme'); } catch (_) {} });
    await resetPage.close();""",
    'one-time theme reset',
)

replace_once(
    browser_path,
    """      const warSelector = '#me-markers [data-layer~="war"]';""",
    """      const warSelector = '#me-markers [data-layer-all~="war"]';""",
    'restrictive war selector',
)

replace_once(
    pure_path,
    """assert(source.includes(\"container.setAttribute('data-map-theme',palette.id)\"));""",
    """assert(source.includes(\"container.setAttribute('data-map-theme',palette.id)\"));
assert(source.includes('container.style.backgroundColor=palette.bg;'));""",
    'palette source contract',
)

print('final map palette/browser refinements applied')
