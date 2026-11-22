# Аудит текущего HEAD PR #2352 (`c43dfb6fbf45fdc03e163429ae67698c0c2b7f52`, W99)

Сборка `c43dfb6fbf45fdc03e163429ae67698c0c2b7f52` выполнена в `/tmp/head-c43d-build` (Node `v22.23.4`, `strangler:build` + postbuild) и проверена в реальном Chromium без правки продуктового кода.

## Новая регрессия W99 (`GillSeriesMobileBar.astro` + `ReaderMobilePlayGroup.astro`)

Из-за расширения `.mobile-playwrap` до `88 px` и размещения отдельной кнопки `#mobSpdBadge` (`44×44`) слева от Play:
1. **На `320×568` панель скоростей `#mobileSpeedrail` сжата до `44 px` (`railOverflow: 230 px`):** при открытии видна только кнопка `1×`, а `0.75×`, `1.25×`, `1.5×`, `1.75×`, `2×` полностью обрезаются и заслоняют значок «Моя библиотека» (📖).
2. **На `390×844` панель скоростей сжата до `114 px` (`railOverflow: 160 px`):** крайние кнопки режутся до `.75×` и `1.25`, а `1.5×–2×` уходят за обрез.
3. **Невидимая кликабельная зона `44×44`:** `#mobSpdBadge` занимает пустое белое место слева от Play (`138..182 px` на `320px`, `208..252 px` на `390px`), тогда как видимый чип `.reader-mobile-speed-chip` (`24×15`) вынесен в нижний правый угол самой кнопки Play.

## Что подтвердилось в W99 и смежных проверках
- **Римские номера и вводные главы в `#partTocOverlay`:** `I..IV` снова прямые `26px` Cormorant; на `dzhon-gill-istoricheskiy-kontekst` (`.gbat-foot--frontmatter`) убрана лишняя кнопка «Слушать» и скрыты точки прогресса (`dotsVisible: 0`).
- **Остаточный баг `prefers-reduced-motion`:** у `#partTocOverlay .toc-sheet` по-прежнему остаётся `transitionDuration: 0.38s, 0.3s`.
- **W57 preview (`1440×900`, `?reader-pilot=1`):** монтируется без ошибок (`#npW57NotesDetails` присутствует, 0 JS errors).
- **Дополнительные проверки:** `/404.html` (чистый рендер, `docOv: 0` на `320px` и `1440px`), `.faq-accordion` (`kod-da-vinchi`, 8 пунктов, `aria-expanded` переключается), заголовки с якорями (`#sec-intro`) и `manifest.json` (4 иконки без потерь) работают исправно.

[Скриншоты W99](r5-findings.jpg) · [замеры](r5-w99.jsonl) · [сценарий](../../research/reader-w57-audit/analytics/head-c43d-r5-verify.mjs).
