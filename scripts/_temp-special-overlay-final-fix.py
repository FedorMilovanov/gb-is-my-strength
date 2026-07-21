#!/usr/bin/env python3
from pathlib import Path
path = Path('scripts/special-overlay-runtime-browser-test.js')
text = path.read_text(encoding='utf-8')
old = "    window;\n  } finally { await page.close(); }"
if text.count(old) != 1:
    raise SystemExit(f'fallback witness cleanup anchor: {text.count(old)}')
path.write_text(text.replace(old, "  } finally { await page.close(); }", 1), encoding='utf-8')
print('✅ final special overlay browser witness corrected')
