# Agent 17 — Home archaeology and component lab

**Date:** 2026-08-01  
**Status:** `DONE_READ_ONLY_ARCHAEOLOGY / NON_PRODUCTION_LAB / IMPLEMENTATION_OWNER_GATED`  
**Product snapshot:** `41617252e18939599e1e3f45e62d8d10d0fd1b27`  
**Production claim:** `no`

## Scope and collision boundary

Agent 17 does not edit the current Home route, components, CSS, JavaScript, assets, route registries or generated revisions. Active NoteRegistry PR #680, Offline/PWA PR #698 and the independent Diotrophes draft PR #708 remain untouched.

Permanent output is limited to an archaeology report, one machine decision inventory, a self-contained non-production specimen page and a read-only contract. Nothing in the lab is importable production authority.

## Evidence

The latest exact-head Home visual witness is PR #675 head `404db8d14087d29522e56f190717d6224e8e3bfb`:

- Visual Parity run `30679376588` — success;
- Runtime Interactive run `30679376578` — success;
- Native Source run `30679376587` — success;
- Print Paper run `30679376572` — success;
- artifact `8811768705`, `46,374,395` bytes;
- digest `sha256:ae956b28f5263d6c9712903d1a892c83dfd331f838d3787551e2d7ff2e083758`.

The artifact contains current and legacy full-page captures at 1280 and 390 pixels plus progressive-enhancement witnesses. From that exact head to the current Product snapshot, no Home visual/runtime owner changed; the later Home diff is discovery metadata/audit only.

Progressive-enhancement result:

| Scene | Width | Horizontal overflow | Visible reveal surfaces | Runtime errors |
|---|---:|---:|---:|---:|
| normal mobile | 390 | 0 | 13 | 0 |
| JavaScript disabled | 390 | 0 | 13 | n/a |
| no `IntersectionObserver` | 390 | 0 | 13 | 0 |
| print desktop | 1280 | 0 | 13 | 0 |

The no-JS scene hides the script controls, exposes one fallback menu with eight links and keeps the complete page visible.

## Archaeology conclusion

The current native Home is a deliberate redesign, not a pixel-preserving strangler projection. Therefore the 21.70% desktop and 27.74% mobile pixel delta against the legacy page is not by itself a defect.

### Preserved across both directions

- sacred Hebrew source line, Russian meaning and citation;
- featured studies and publication list;
- refutation entry points;
- project/about statement;
- Avvakum/source quotation surface;
- planned work and feedback/footer boundary.

### Deliberately replaced

- the legacy feature-card preamble became a search-first hero;
- dense functional navigation became five visual library directions;
- the cool blue paper treatment became the owner-approved warm parchment/deep-umber system;
- separate mobile/fallback structures became one semantic Home tree with capability fallbacks.

### Reference value retained only in the lab

The legacy functional index remains useful as an information-architecture specimen. Optional route-card depth remains useful as a motion specimen only when keyboard behavior is equivalent and `prefers-reduced-motion` removes transforms. Neither is authorized for production promotion.

## Owner decision queue

| Candidate | Decision | Reason |
|---|---|---|
| sacred word inline flip | `KEEP_CURRENT` | distinctive source-first interaction already has a production owner |
| search-first library entry | `KEEP_CURRENT` | clearer primary action without deleting the substantive library |
| five-direction gateway | `KEEP_CURRENT` | coherent owner-approved visual map, responsive at 390 px |
| single semantic Home tree | `KEEP_CURRENT` | no-JS, print and capability evidence all pass |
| legacy functional index | `LAB_ONLY` | useful density, but restoring the whole preamble would duplicate hierarchy |
| route-card tilt | `LAB_ONLY` | decorative only; reduced-motion boundary is mandatory |
| legacy blue-paper palette | `REFERENCE_ONLY` | historical direction conflicts with current owner palette |
| direct-main responsive experiments | `SUPERSEDED` | reviewed later Home waves represent the accepted result |

Machine details and exact owner paths live in `data/home-component-lab-inventory-2026-08-01.json`.

## Component lab boundary

`research/component-lab/home/` is intentionally outside every production input. It has:

- no route registration;
- no import from `src/`, `js/` or `css/`;
- no Pagefind, sitemap, RSS, service-worker or cache-bust registration;
- no external asset or runtime dependency;
- `noindex,nofollow,noarchive` in the standalone specimen.

Promotion is forbidden by copy. A future owner must rebuild a chosen idea from current `main` in a dedicated Home lane.

## Residuals

- No current Home implementation defect was proved by this archaeology pass.
- No owner-approved visual redesign is queued.
- The laboratory is reference-only; its specimens are not production-quality components.
- Source merge does not establish production deployment.
