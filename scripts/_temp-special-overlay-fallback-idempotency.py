#!/usr/bin/env python3
from pathlib import Path
path = Path('karty/_engine/map-engine.js')
text = path.read_text(encoding='utf-8')
old = """      fallbackOverlayOwners.add(ownerId);
      if (options.lockScroll !== false) window.SiteUtils?.lockScroll?.(ownerId);
      setTimeout(() => focusSpecialTarget(options.focusTarget), 0);
"""
new = """      const wasOpen = fallbackOverlayOwners.has(ownerId);
      fallbackOverlayOwners.add(ownerId);
      if (!wasOpen && options.lockScroll !== false) window.SiteUtils?.lockScroll?.(ownerId);
      setTimeout(() => focusSpecialTarget(options.focusTarget), 0);
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'fallback idempotency anchor: {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('✅ MapEngine fallback ownership is idempotent')
