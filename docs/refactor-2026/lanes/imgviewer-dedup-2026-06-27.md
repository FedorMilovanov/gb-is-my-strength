# Lane: imgviewer-dedup-2026-06-27

## Bug (AuditRepo BUTTON_INTERACTION_AUDIT P1 — verified LIVE on main)
Two image viewers both bound to `.article-img img`:
- modern `img-viewer` (role=dialog, panel, close button, focus-trap, caption) —
  CORRECT (closes only on backdrop `e.target===t` / close button / ESC, NOT on image);
- legacy `gbx-imgview` — fired on `.article-img img, .bio-cover img` and closed on
  ANY click (including the image), and STACKED on top of `img-viewer` on article pages.

Net effect on article pages: two overlays opened at once; the legacy one closed on
image-click. User could not comfortably view enlarged images.

## Fix
- `gbx-imgview` narrowed to its UNIQUE selector `.bio-cover img` only (biography covers;
  `img-viewer` runs only on `isArticle()` so it never covered bio covers) → no more
  overlap/stacking on article pages.
- `gbx-imgview` itself hardened (in case bio-cover path is used): backdrop-only close
  (`.gbx-imgview-backdrop`) + visible round close button (`.gbx-imgview__close`,
  40px / 52px touch) + ESC; image element is `.gbx-imgview-img` and no longer closes
  on click. CSS added to css/site.css + css/site-layered.css.

## Verified (browser witness, dist)
Article page: exactly ONE viewer (`img-viewer`) opens; clicking the image keeps it open;
close button closes it; backdrop closes it. audit-pro PASS (0 errors), data:consistency
PASS, workflows:check PASS, audit:premium-controls 39/39 PASS.
