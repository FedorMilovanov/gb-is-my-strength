v11 — VISUAL BUG FIXES

WHAT THIS FIXES (the bugs you caught from screenshots):

1. nag-summary heading "Коротко" was 9px — now 11px (visible)
2. nag-summary text was faint (#4b4036) — now darker (#3d342b, 13.5px)
3. nag-summary section had no background — now has subtle bg + border
4. nagornaya/seriya had huge whitespace (112px gap) — reduced to 52px
5. nagornaya/seriya hero desc/tagline were opacity:0 with animation
   that might not fire — now opacity:1 on non-homepage pages
6. "← Главная" breadcrumb was orphaned above hero — moved inside main
7. index.html body gets class="home-page" so spacing overrides
   don't affect the actual homepage animations

HOW TO APPLY:
  cd "C:\Users\Fedor\Projects\gb-is-my-strength"
  Expand-Archive -Path "$HOME\Downloads\v11-visual-fixes.zip" -DestinationPath . -Force
  npm run validate:all
  node scripts/audit-pro.js
  git add -A
  git commit -m "v11: visual bug fixes — summary visibility, spacing, breadcrumb"
  git pull origin main --rebase
  git push origin main
