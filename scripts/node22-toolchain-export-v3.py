#!/usr/bin/env python3
from __future__ import annotations

import runpy
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: node22-toolchain-export-v3.py <target-root>")

helper_root = Path(__file__).resolve().parent
exporter = helper_root / "node22-toolchain-export.py"
runpy.run_path(str(exporter), run_name="__main__")

target = Path(sys.argv[1]).resolve()
guard = target / "scripts/node-toolchain-pin-contract-test.mjs"
text = guard.read_text(encoding="utf-8")
normalized = text.lstrip("\ufeff\r\n\\")
if not normalized.startswith("#!/usr/bin/env node\n"):
    raise SystemExit("guard shebang normalization failed")
guard.write_text(normalized, encoding="utf-8")

print("Normalized Node toolchain guard shebang at byte zero")
