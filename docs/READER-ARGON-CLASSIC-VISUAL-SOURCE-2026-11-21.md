# Reader — ARGON Classic: primary visual reference (owner decision 2026-11-21)

**Status:** design-source correction for existing Draft/HOLD PR #2352. Not a release approval or a claim that W57 is already visually Classic. The owner explicitly requires the **Classic** visual language rather than ARGON UPDATE/UPGRADE. Keep Reader functionality and content/annotation ownership unchanged.

## Source provenance — verified from the actual archives on DESKTOP-O3FDOA4

- **Primary, original ARGON / Classic reference:** `C:\Users\Fedor\Downloads\GEMINI ARGON--3.zip`, 19 archive entries; SHA-256 `d937997ec00ae3a5c6949ced2074dac9b6121e678fe9364e4b46cdcb9efce956`. Read `src/index.css`, `src/components/{RightResearchPanel,LeftNavigation,CenterArticle,MobileDrawers}.tsx` as a design specimen, not deployable React code. A second 19-entry archive, `GEMINI 4 ARGON theological-research-panel-prototype.zip`, also exists; do not silently treat archive hashes as equal.
- **Non-primary ARGON UPDATE source:** `C:\Users\Fedor\Downloads\ARGON UPDATE.zip`, 36 entries; SHA-256 `515108ba29b5c5c0f2d771c1c8b9bab6948f56411cec419ee4fdd8d6117c73d0`.
- **Actual W57 visual chain is currently based on UPDATE:** `research/reader-w57-pilot/assets/reader_argon_first.css` line 4 declares `ARGON UPDATE.zip/src/{components/LeftNavigation.tsx,BookTOC.tsx,RightResearchPanel.tsx,reader.css,index.css}`. Its W51 CSS includes an isolated “ARGON classic” patch, not a wholesale Classic restoration. This is the factual cause of the owner's concern.
- Archive paths are **evidence paths on the owner's PC**, not runtime dependencies or assets to bundle in production. Never commit the zip or extracted font binaries solely to satisfy this document.

## Verified design differences

| Role | Original Classic: `GEMINI ARGON--3.zip/src/index.css` | Current UPDATE / W57 |
| --- | --- | --- |
| UI and controls | **Inter**, system sans fallback | Source Sans 3 |
| Long-form text / Scripture | **Literata**, serif fallback | Lora is default in Update; current Gill mobile Scripture directly uses Cormorant |
| Display titles / drop cap | **Cormorant Garamond** | Cormorant already exists, but role assignments differ |
| References / metadata | **JetBrains Mono** | Mix of Source Sans 3 and occasional Mono |
| Light canvas / folio / panel | `#F6F3EC` / `#FBF9F5` / `#EFECE4` | Update uses `#fdfcf9` / `#ffffff` / `#f4f2ed` |
| Dark canvas / folio / panel | `#121316` / `#17191D` / `#1D2025` | Update uses `#0e1116` / `#161a21` / `#13171e` |
| Bronze / rubric | `#8C6239` / `#9B2C2C` | Update foregrounds `#7a2e2e` in multiple roles |
| Hairline | `#DFD9CE` day, `#2A2E35` night | Update uses `#e5e2dc` day and darker blue-grey variant |

Original Classic's Scripture window (`RightResearchPanel.tsx`) includes one selected passage, a horizontally scrollable reference strip, contextual/exegetical controls, citation in **Literata**, and mono reference labels. On mobile, the owner's explicit **two-row horizontally scrollable** reference strip takes precedence over the source's single-row specimen. This adapts presentation without inventing new Scripture data or abandoning the approved projection.

## Implementation precedence and safety

1. **Classic design tokens and font roles are authoritative** for new Reader visual work. Later W57/UPDATE changes may remain only where they fix accessibility, mobile usability, verified functional problems, or deliberate owner-approved differences. Do not import UPDATE chrome by default.
2. Keep Reader's **real Astro article, source-of-truth ScriptureDataProjection, exact annotations, original floating controls, TTS/Play, focus and navigation**. No imitation UI, duplicate script owners, default-Reader replacement or silent production activation.
3. Implement visually in bounded, reviewable slices: first side-by-side screenshots of **Classic source vs current W57**; then Classic typography/tokens in the existing desktop shell and mobile Analytics; then chapter index / research window / toolbar refinements. Do not claim full Classic parity until the screenshot comparison is performed.
4. Existing local `fonts/` currently includes Cormorant Garamond and Inter, but no verified local **Literata** or **JetBrains Mono** files. Do **not** claim faithful Classic typography by naming a missing font in CSS and silently using fallback. Acquire locally hosted, appropriately licensed font assets with attribution and check actual loaded font in Chromium/WebKit before declaring that portion complete. Retain reader-selectable article font and never overwrite a user's preference.
5. QA must cover Gill II `#part-controversy`, Gill III and independent articles, 320/390/1120/1121/1440px, day/night, long passages, two-row overflow, article scroll and focused selection, annotation round trip, real local screenshots. The physical phone and visual owner sign-off remain separate HOLD criteria.
6. The currently committed W57/Classic patches, mobile shelf, and annotations are **not rolled back just to adjust visual styling**. Fix tokens and component treatment without breaking verified behavior.

**Repo gate:** PR #2352 remains Draft/HOLD; ordinary fast-forward into the existing branch, no main merge or production deploy until actual Classic visual comparison and the pending Reader/CI acceptance gates.
