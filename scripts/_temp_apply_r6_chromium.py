from pathlib import Path

path = Path("scripts/engine-sweep.mjs")
text = path.read_text()

old_require = "const require = createRequire(import.meta.url);\nconst { chromium } = require('playwright');"
new_require = "const require = createRequire(import.meta.url);\nconst { existsSync } = require('node:fs');\nconst { chromium } = require('playwright');"
old_launch = "  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });"
new_launch = "  const pinnedChromium = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';\n  browser = await chromium.launch(existsSync(pinnedChromium) ? { executablePath: pinnedChromium } : {});"

if text.count(old_require) != 1:
    raise SystemExit("engine-sweep require contract drifted")
if text.count(old_launch) != 1:
    raise SystemExit("engine-sweep launch contract drifted")

path.write_text(text.replace(old_require, new_require).replace(old_launch, new_launch))
