# Round 23 Audit — PR #2352 (`a77fae84`) & `origin/main` (`c60b3347`)

- **PR #2352 HEAD:** `a77fae84` (`test(reader-w57): isolate external Metrika in WebKit two-tab contract`)
- **`origin/main` HEAD:** `c60b3347` (`editorial(teen): содержательная редактура части II после разоблачения (#2362)`)
- **Build:** `/tmp/head-a77f-build` (`BUILD_A77F_EXIT=0`, 117 HTML pages)

## Clean / Verified
- 117/117 HTML pages at `390×844` and `1440×900` load with `0` uncaught `pageerror`, `0` local HTTP 4xx/5xx, `0` broken images, and `0` horizontal document overflow (`docOv <= 0`).
- Dark theme works on `/rodosloviye/` (via `.gb-fc-theme`), `/journal/`, `/journal/dossiers/g3/`, `/podrostok-za-kadrom/`, `/404.html`, `/app/`, `/map/`.
- Bookmarking (`button.gb-save`) saves `/articles/dzhon-gill-chast-2-uchenyi/`, `/articles/podrostok-za-kadrom-dvoynaya-zhizn/`, and `/articles/kod-da-vinchi/` into `/izbrannoe/` (3 cards).
- Search (`Ctrl+K`) opens palette on `/` & `/articles/` and navigates results (`Мф 5` → `/nagornaya/seriya/`).
- Audio playback initializes without HTTP 404; "Управлять заметками" opens `#gb-hl-panel`.

## New Confirmed Bugs (both `a77fae84` and `main c60b3347` unless noted)
1. **`/baptisty-rossii/` (`320×568` & `390×844`):** Fixed two-row bottom toolbar `.gbs2-rfoot` + `.gbs2-bbar` consumes ~150px at the bottom; at `320×568` `.gbs2-rfoot` (`top: 408`) directly overlaps `<h1>Баптисты России</h1>` (`top: 404, bottom: 436`).
2. **`/about/` (`768×1024` & `1440×900`):** Feedback cards break on tablet `768px` (`ВКонтакт / е` split across lines; handles clipped to `vk.com/...`, `viktorco...`, `@fedorm...`), and on `1440×900` Email is truncated to `viktorcoy2012...` (`cw: 101, sw: 153`) and VK handle to `/the_lord_god_is_my_stre...`.
3. **Desktop `1440×900` Reader Left Sidebar (`.gbs-rail-card__info b`):** Series navigation titles are hard-clipped to `166px` single-line ellipsis across `/articles/podrostok-za-kadrom-*` (`A. Взрослый ребён...`, `B. Взрослый ребён...`, `C. Совершеннолети...`), `/articles/serdce-i-duh/`, and `/articles/dzhon-gill-chast-2-uchenyi/` (`Исторический контекст`, `Справочник по Гиллу`).
4. **`/map/` (`320×568`):** `<h1>` is clipped to `86px` (`Атлас ис...`, `sw: 161`) and search placeholder clips (`Найти материал, тему или авто|`).
5. **`/articles/kod-da-vinchi/` (`320×568`):** Top-left breadcrumbs touch/clip against viewport edge; `.hm-speedrail` (`cw: 116, sw: 309`) clips `1.75×` and `2×` outside `320px`.
6. **`/nagornaya/chast-1/` (`320×568`):** Even in Light theme, bottom bar capsule `СЕЙЧАС ЧИТАЕТЕ / Коротко` clips the bottom half of `Коротко`, and `1×` badge overlaps the Play triangle.
7. **`⏱` (`U+23F1`) tofu glyph:** Also present in the new `Подросток за кадром` reader header metadata (`10 сентября 2026 г. · [▯] 32 мин`).
8. **`/izbrannoe/` (`320×568`):** Saved card for `Джон Гилл (1697-1771): доктор Многотомный` also renders a blank gradient placeholder without cover image.
9. **`#gillLearningOverlay` Тест UX & `/rodosloviye/` `data-theme`:** Quiz answer buttons `.quiz-option` are `disabled` until clicking confidence buttons placed *below* them (`Точно знаю` / `Кажется` / `Наугад`); `/rodosloviye/` toggles dark CSS via `localStorage.theme` while leaving `<html data-theme="light">` unchanged.
