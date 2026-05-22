═══════════════════════════════════════════════════════
  v10 FINAL CLEANUP — HOW TO APPLY
═══════════════════════════════════════════════════════

1. Extract this ZIP over your project root (overwrite):
   Expand-Archive -Path "$HOME\Downloads\v10-final-cleanup.zip" -DestinationPath "C:\Users\Fedor\Projects\gb-is-my-strength" -Force

2. Delete old files:
   cd "C:\Users\Fedor\Projects\gb-is-my-strength"
   Remove-Item -Force scripts\patch-v2-apply.js, scripts\patch-v4-mobile.js, scripts\patch-v5-interactivity.js, scripts\patch-v6-functions.js -ErrorAction SilentlyContinue
   Remove-Item -Force images\pastor-series\hero.png, images\pastor-series\manipulation.png, images\pastor-series\mirror.png, images\pastor-series\og-hero.png -ErrorAction SilentlyContinue
   Get-ChildItem audit\*.md | Sort-Object LastWriteTime | Select-Object -SkipLast 1 | Remove-Item -Force

3. Verify:
   npm run validate:all
   node scripts/audit-pro.js

4. Commit & push:
   git add -A
   git commit -m "v10 final cleanup: repo hygiene, PNG-to-webp, dead code removal"
   git pull origin main --rebase
   git push origin main

5. Delete this README_APPLY.txt after applying.

═══════════════════════════════════════════════════════
  WHAT CHANGED
═══════════════════════════════════════════════════════

DELETED:
  - scripts/patch-v2-apply.js (dead code)
  - scripts/patch-v4-mobile.js (dead code)
  - scripts/patch-v5-interactivity.js (dead code)
  - scripts/patch-v6-functions.js (dead code)
  - images/pastor-series/hero.png (2.2MB, has .webp)
  - images/pastor-series/manipulation.png (1.9MB, has .webp)
  - images/pastor-series/mirror.png (2.5MB, has .webp)
  - images/pastor-series/og-hero.png (1.1MB, has .webp)
  - 6 stale audit reports in audit/
  - 4 dead "patch:*" scripts from package.json

UPDATED:
  - AGENTS.md → r3 (removed dead refs, updated architecture)
  - package.json (removed dead patch scripts)
  - index.html (PNG→webp references)
  - articles/index.html (PNG→webp reference)
  - articles/20-antisovetov-pastoru/index.html (PNG→webp references)
  - pastor-series/index.html (PNG→webp references)
  - AUDIT_HISTORY.md (added v10 entry)
  - audit/ (cleaned to latest report only)

SAVINGS: ~7.7MB in deleted PNGs

═══════════════════════════════════════════════════════
  FINAL AUDIT RESULTS
═══════════════════════════════════════════════════════

audit-pro.js:     31/31 PASS · 0 errors · 0 warnings
validate:strict:  PASS
seo-audit:        PASS

Deep scan:        0 P0 · 0 P1 · 20 INFO (all non-issues)

Overall score: 9.7/10 — Production-grade, clean repo.
