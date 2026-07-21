#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/_temp_apply_map_layers_theme.py')
text = path.read_text(encoding='utf-8')

old_before = '''"""      if (q) {
        const mc = markersG.querySelectorAll('g[transform]').length;
        let visibleCount = 0;
        markersG.querySelectorAll('g[transform]').forEach(g => {
          if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
        });
        if (visibleCount > 0 && visibleCount < mc) {
          showToast('Найдено: ' + visibleCount, 1500);
        }
      }
    }, 200);""",'''
new_before = '''"""    // Show match count (was: at handler entry; crashed: q not in scope here)
    if (q) {
      const mc = markersG.querySelectorAll('g[transform]').length;
      let visibleCount = 0;
      markersG.querySelectorAll('g[transform]').forEach(g => {
        if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
      });
      if (visibleCount > 0 && visibleCount < mc) {
        showToast('Найдено: ' + visibleCount, 1500);
      }
    }
  }, 200);""",'''

old_after = '''"""      if (q) {
        const mc = markersG.querySelectorAll('g[transform]').length;
        let visibleCount = 0;
        markersG.querySelectorAll('g[transform]').forEach(g => {
          if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
        });
        if (visibleCount > 0 && visibleCount < mc) {
          showToast('Найдено: ' + visibleCount, 1500);
        }
      }
      applyLayerVisibility();
    }, 200);""",'''
new_after = '''"""    // Show match count (was: at handler entry; crashed: q not in scope here)
    if (q) {
      const mc = markersG.querySelectorAll('g[transform]').length;
      let visibleCount = 0;
      markersG.querySelectorAll('g[transform]').forEach(g => {
        if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
      });
      if (visibleCount > 0 && visibleCount < mc) {
        showToast('Найдено: ' + visibleCount, 1500);
      }
    }
    applyLayerVisibility();
  }, 200);""",'''

for label, old, new in (
    ('search before signature', old_before, new_before),
    ('search after signature', old_after, new_after),
):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('exact search-block signature corrected')
