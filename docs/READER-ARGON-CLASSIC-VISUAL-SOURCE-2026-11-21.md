# Reader — ARGON Classic: primary visual reference (owner decision 2026-11-21)

**Corrected owner scope, 2026-11-21:** ARGON Classic is the visual direction for **MOBILE Reader only**. DESKTOP W57 is finished and must not be changed. The desktop Classic W58 experiment is rejected and reverted to pre-W58 baseline 42648ab7e; keep the mobile Classic typography, mobile Bible shelf and mobile notes. PR #2352 remains Draft/HOLD.

## Source provenance — verified from the actual archives on DESKTOP-O3FDOA4

- **Primary, original ARGON / Classic reference:** `C:\Users\Fedor\Downloads\GEMINI ARGON--3.zip`, 19 archive entries; SHA-256 `d937997ec00ae3a5c6949ced2074dac9b6121e678fe9364e4b46cdcb9efce956`. Read `src/index.css`, `src/components/{RightResearchPanel,LeftNavigation,CenterArticle,MobileDrawers}.tsx` as a design specimen, not deployable React code. A second 19-entry archive, `GEMINI 4 ARGON theological-research-panel-prototype.zip`, also exists; do not silently treat archive hashes as equal.
- **Non-primary ARGON UPDATE source:** `C:\Users\Fedor\Downloads\ARGON UPDATE.zip`, 36 entries; SHA-256 `515108ba29b5c5c0f2d771c1c8b9bab6948f56411cec419ee4fdd8d6117c73d0`.
- **Actual W57 visual chain is currently based on UPDATE:** `research/reader-w57-pilot/assets/reader_argon_first.css` line 4 declares `ARGON UPDATE.zip/src/{components/LeftNavigation.tsx,BookTOC.tsx,RightResearchPanel.tsx,reader.css,index.css}`. Its W51 CSS includes an isolated “ARGON classic” patch, not a wholesale Classic restoration. This is the factual cause of the owner's concern.
- Archive paths are **evidence paths on the owner's PC**, not runtime dependencies or assets to bundle in production. Never commit the zip or extracted font binaries solely to satisfy this document.

## Verified design differences

| Role | Original Classic: `GEMINI ARGON--3.zip/src/index.css` | Current UPDATE / W57 |
| --- | --- | --- |
| UI and controls | **Inter**, system sans fallback | Source Sans 3 |
| Long-form text / Scripture | **Literata**, serif fallback | Update uses Lora; Gill mobile formerly used Cormorant before Classic W58 |
| Display titles / drop cap | **Cormorant Garamond** | Cormorant already exists, but role assignments differ |
| References / metadata | **JetBrains Mono** | Mix of Source Sans 3 and occasional Mono |
| Light canvas / folio / panel | `#F6F3EC` / `#FBF9F5` / `#EFECE4` | Update uses `#fdfcf9` / `#ffffff` / `#f4f2ed` |
| Dark canvas / folio / panel | `#121316` / `#17191D` / `#1D2025` | Update uses `#0e1116` / `#161a21` / `#13171e` |
| Bronze / rubric | `#8C6239` / `#9B2C2C` | Update foregrounds `#7a2e2e` in multiple roles |
| Hairline | `#DFD9CE` day, `#2A2E35` night | Update uses `#e5e2dc` day and darker blue-grey variant |

Original Classic's Scripture window (`RightResearchPanel.tsx`) includes one selected passage, a horizontally scrollable reference strip, contextual/exegetical controls, citation in **Literata**, and mono reference labels. On mobile, the owner's explicit **two-row horizontally scrollable** reference strip takes precedence over the source's single-row specimen. This adapts presentation without inventing new Scripture data or abandoning the approved projection.

## Implementation precedence and safety — MOBILE ONLY

1. **Do not touch the desktop.** W57 desktop look, typography, columns, right panel, controls and interaction behavior must remain at the accepted pre-W58 baseline (commit 42648ab7e). Do not modify desktop assets, manifest or preview injection for Classic styling without a NEW explicit user request.
2. Classic is used only for the existing mobile Gill Analytics drawer in src/components/article-pilots/gill-series/GillMobileMarginalia.astro. Retain local licensed fonts/Literata and fonts/JetBrainsMono. Neither the mobile implementation nor these fonts are rolled back.
3. Retain compact top bar, Product Play/progress/speed, bottom bar, two-row scrolling Scripture shelf, projected Bible text, separate jump to article, focus, reading position and exact annotations.
4. Test mobile at 320/390 in Chrome and WebKit with both themes, long 18-reference shelf and cross-width annotations. Desktop tests must be strictly regression checks against unchanged W57.
5. The desktop-only W58 skin reader_argon_classic_finish.css was withdrawn; its preview.py and MANIFEST.json entries are restored exactly to pre-W58. Historical W58 desktop screenshots are NOT the accepted desktop design.
6. Keep PR #2352 Draft/HOLD; no deployment, main merge or other desktop visual work.
## W58 implementation evidence (21 November 2026)

- **Accepted mobile only:** Classic styling in GillMobileMarginalia.astro; native Play, notes and ScriptureDataProjection unchanged. W58 desktop skin was removed, preview.py and MANIFEST restored exactly to pre-W58.
- Local licensed font assets: fonts/Literata and fonts/JetBrainsMono. Both use Fontsource v5.3.0, SIL OFL 1.1, Cyrillic+Latin subsets and license notices. Inter and Cormorant Garamond were already present. Do not remove font licenses.
- Verified Node 22 strangler:build: 658 checked Astro files, 0 errors, 0 warnings; 112 generated pages; postbuild G-1 to G-8 pass.
- Chromium+WebKit mobile 320/390 both themes, actual loaded fonts, Genesis 1:2, Exodus 19:9 and two-row 18-ref shelf are the retained mobile acceptance results. The former desktop Classic tests are historical only; the accepted desktop is W57 before W58.
- **Accepted mobile screenshots:** dist/reader-classic-mobile-day.png, dist/reader-classic-mobile-night.png; local mobile review dist/mobile-gill-classic-review.html. Any W58 desktop Classic screenshot shows a rejected experiment.
- Not completed by this visual patch: one shared semantic section material provider for all Reader surfaces, unresolved pre-existing CI defects, physical-phone and owner design sign-off. Draft/HOLD must remain.