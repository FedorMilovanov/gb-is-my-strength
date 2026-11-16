# Grok Focus V17 — исходный эталон и перенос в настоящий Reader

**Источник:** архив владельца `grok-focus-web-layout (1).zip`, передан 7 ноября 2026. SHA-256 исходного архива: `b47b5ae562ce92a64291651af8a2f6b142decb80236b68dcb343ae880b01f5cb`.

Внутри: Vite/React-прототип Grok Focus V17 (`src/index.css`, `src/components/Sidebar.tsx`, `src/components/Reader.tsx`, `src/reader.tsx`, `src/components/Drawers.tsx`, `scripts/qa16.mjs`, `scripts/qa17.mjs`). Это **дизайн-образец, а не Product-runtime**. Не перетаскивать React, mock-данные, поиск, ReaderState или собственный PlayEmber в Astro-продукт.

## Решения, извлечённые из реального V17

- **Древо/вертикальная ось:** `.outline-branch:not(:last-child)::after` и `.outline-titlebar::before` работают по одной оптической оси и между реальными соседними точками, а не по двум несогласованным координатам. Product адаптирует тот же принцип к исходному `GrokReaderTree.astro` и его каноническим H2: курсор H2, заполнение прогресса и конец линии привязаны к измеренным центрам точек. **Не добавлять второй scroll/heading engine.**
- **Подсветка:** `.outline-titlebar.selected` — приглушённая редакторская заливка; hover мягче активного; родитель с активным дочерним узлом получает иной, неброский акцент. Не использовать тяжёлые рамки и конкурирующие активные полосы на разных X.
- **Focus mode / rail:** `.shell.rail-mode` сжимает левую область до 68 px, а `.reading` увеличивает меру текста (`+92px` в React-демо). Product сохраняет свою читаемую ширину/типографику, но увеличивает настоящую меру с 46rem до 51rem, без overflow и перекрытия текста.
- **Управление:** в V17 самостоятельная узкая рейка содержит поиск, настройки и библиотеку. Product делает это **через единственные существующие** `gbFloatingControls`, `GBReaderLibrary V3` и `PlayEmber`. Узлы перемещаются целиком, не клонируются; после раскрытия возвращаются вправо. Вложенные `data-fc-root` должны делегировать действие **один раз**, без повторного двойного переключения.
- **Микроанимации:** эталонные `--ease-soft:cubic-bezier(.32,.72,0,1)`, переход сетки около 520ms и лёгкий вход компактных инструментов. Поддерживать `prefers-reduced-motion`; никаких oversized elastic bounce.
- **Кнопка:** исходный V17 всё ещё рисует миниатюрный прямоугольник с перегородкой. Владелец **отклонил этот тяжёлый символ** на более раннем варианте, поэтому продукт использует только тонкий открытый line glyph без обводки-коробки.
- **Вторичные механики V17:** меню с поиском/мягким затуханием, настройка около кнопки, поисковое выделение, управление ускорением и другие возможности существуют в отдельном демонстрационном приложении. Их **не копировать вслепую** в Product: владельцы этих состояний уже присутствуют в его самостоятельных системах.

## Текущий исходник и приёмка

Редизайн реализуется **в существующем Product PR #2292**: `ReaderRail.astro`, `GrokReaderTree.astro`, `grok-rail-pilot-browser-test.mjs`. В старом PR код уже исправлял отдельную карточку, перемещение библиотеки, мобильный первый экран и AA. Вторая итерация добавляет V17 refinement: тонкий icon, real H2 track geometry, деликатную подсветку, ширину текста и перенос единственных действующих правых контролов в компактную рейку.

Владелец требует принять дизайн по **реальным скриншотам из локальной сборки** (expanded, collapsed, в середине статьи, 1200/1440/1920, short 1440×300, mobile 320/390, темы Day/Sepia/Night, библиотека/поиск/PlayEmber) и после merge — по свежему реальному production SHA. Успешный CI — необходимое, но **не достаточное** условие приёмки. Пока владелец не одобрил изображения, PR остаётся Draft, Production не менять.

**Не забывать:** текущий пользовательский архив V17 имеет имя и SHA выше; если будущий агент не видит бинарный прототип, он должен найти прикреплённый оригинал в разговоре или запросить именно его, а не придумывать на словах новый дизайн. Проверенные практические критерии находятся также в `AuditRepo/projects/gb-is-my-strength/prototype/grok-desktop-reader/OWNER-VISUAL-ACCEPTANCE-2026-11-07.md`.


## PlayEmber — окончательный критерий премиальных скоростей

Новая претензия владельца к настоящему локальному Reader: при нажатии на Play в компактной рейке не предлагался выбор скорости; справа раскрытый ряд содержал несколько пересекающихся окружностей, обводок и бейджей. Два скриншота — обратная связь от 7 ноября 2026.

**Нормативный дизайн и поведение:**

- Сохранить единственный настоящий PlayEmber и его существующий горизонтально выдвигающийся speed radiogroup (1× / 1.25× / 1.5× / 1.75× / 2×). Нельзя делать другой поповер или дублировать TTS.
- В обычной компоновке ряд выдвигается влево от кнопки Play, в компактной 68px рейке — вправо. Кнопка и ряд должны иметь отдельные, чётко выверенные оптические границы без столкновения кругов, теней и лишних декоративных контуров.
- В компактном режиме первое нажатие Play из idle открывает скорости без автозапуска. Выбор скорости сохраняет параметр и запускает штатную TTS. При чтении Play остаётся кнопкой паузы/возобновления. На остальных маршрутах исходная семантика не меняется.
- Источники ответственности: src/runtime/reader-tts.js — захват кликов и playback; js/floating-cluster-controller.js — существующие PlayEmber/speed; ReaderRail.astro — только геометрия Grok. Не создавать второй источник состояния или слушатель-двойник.
- Якорь полоски измеряется от реальной кнопки при раскрытии. Узкая компактная полоска около 195px должна не перекрывать начало заголовка при ширине 1440px. В покое — только один спокойный ободок; в режиме воспроизведения — единственное оригинальное SVG-кольцо прогресса, без второго периметра и плавающего бейджа 1×.
- Обязательная приёмка реального Product: Chromium/Firefox/WebKit, раскрытый и свёрнутый режим, короткое окно 1440×300, light/dark, click → выбор скорости → TTS, keyboard/Escape, отсутствие pageerror/overflow. Сравнивать настоящие скриншоты, не макеты.

Код продолжается в Product PR #2292. Проверки после исправления: Grok browser 318/318 PASS; PlayEmber speed geometry/click 46/46 PASS в Chromium и WebKit; Speedrail focus 68 маршрутов × 2 браузера PASS; TTS-runtime PASS; keyboard 252/252 PASS. Эти проверки не означают слияние/публикацию без визуальной приёмки.


## Reader popup lifecycle + fold icon first-choice acceptance (2026-11-07)

Owner screenshot reproduced simultaneously open “Настройки чтения” and “Разделы сайта” panels; desktop site menu had no functional outside-click dismissal because its backdrop exists only in the mobile breakpoint. Requirement: first GPT-image icon variant, a larger simple arrow (22px rendering with compact first-choice chevron; no heavy button box), and one open reader popover at a time.

- Preserve single OverlayRuntime stack, SiteSectionsMenuRuntime and ReaderSettings as canonical owners. Opening one closes the other through OverlayRuntime.requestClose so nested windows never visually overlap; no duplicate state or ad-hoc z-index overriding.
- A desktop site menu is an anchored, nonmodal popover. Clicking outside must dismiss it; clicking the trigger should toggle it, Escape returns focus, reopening remains reliable. The mobile menu continues to use its native backdrop owner.
- Desktop settings already close via the full-sheet backdrop, close button, “Готово” and Escape; repeated hm:open-settings must also toggle closed. Closing restores focus and releases the canonical scroll lock.
- Acceptance must run real Product on 1200/1440/1920 and collapsed 68px rail, Chromium/WebKit/Firefox, verify OverlayRuntime.snapshot().length <= 1 for settings/menu, no horizontal overflow and no pageerrors. Do not accept artificial stacked screenshot states.
- Persistent CI: scripts/grok-reader-overlay-lifecycle-browser-test.mjs in Grok Hermeneutics Product Pilot workflow, including explicit browser selection and exact built Product HTML.

No merge/deploy until owner visually approves and complete exact-SHA CI is green.


## Owner final polishing / parity and release gate (2026-11-07)

Current owner request after 23px icon: reduce its apparent check-mark size slightly; reduce the Play circle radius a little; improve smoothness instead of instant text disappearance; audit references, event ownership and realistic production parity.

**Exact implementation in Product Astro only (same PR #2292):**
- Owner's FIRST GPT design remains the source, now a fixed 22px icon with a 4.3-unit chevron and one SVG containing two mirrored opacity states. No distorted scaleX or 180-degree rotating bounding box at mid-transition.
- Single genuine PlayEmber 34px button, inner progress SVG 30px (30px button on ultra-short rail); keep original rate selector, five rates, canonical TTS engine, start/pause semantics and unchanged non-Grok pages.
- V17 520ms rail and article geometry with cubic-bezier(.32,.72,0,1). The former instant display:none of TOC blocks and the 280ms/520ms conflicting tempos are eliminated. Hide actual authored TOC by opacity/clip/visibility while removing it from compact flex layout; keep inert/aria-hidden immediately. Firefox 153 does not animate display:none transitions consistently, therefore do not depend on allow-discrete display for premium fade. Reduced motion disables animations.
- Correct nested-root event ownership in the one canonical floating-cluster controller: nearest data-fc-root handles its own actions, ancestor root skips. Remove the former child stopPropagation workaround; keep document click events available to OverlayRuntime. Cache versions must use LF Git-blob hash (Windows CRLF mismatch previously failed CI).
- Do not equate raw scrollY with reading position after article width changes: WebKit may adjust scrollY by 68px while keeping the SAME paragraph at the SAME on-screen y coordinate. Avoid forced scrollTo hacks.
- Full Product source vs Grok Focus V17 React/Vite reference: transfer visual contract and authored interactions only. No second React Reader, second library, duplicate Play, duplicate settings, mock data or shadow scroll owner.

**Parity/ship discipline:** 1:1 screenshot-level fidelity is feasible with Astro for agreed 1200/1440/1920 and mobile 320/390 breakpoints, but cannot honestly be guaranteed by local previews or CI alone. Owner accepts true browser frames of the exact Product commit. Then merge to main (without drift), GitHub Pages publishes that exact main SHA with PUBLIC_GB_GROK_HERMENEUTICS_PILOT enabled; verify public deployments/current.json releaseSha AND controlPlaneSha, cache/service-worker revisions, cold Chromium/WebKit frames compared at identical viewport/theme/font and a final real-live clickthrough. Any mismatch blocks closure and triggers rollback/investigation. Do not silently deploy a flag-off build or call local screenshots production.

Other known gate: 2026-11-07 Product PR CI included a failing Bible App WebKit test (third-party Yandex beacon/pageerrors and non-Grok popup checks). Treat as a separate real red check requiring independent resolution; never weaken required checks or label the full PR CI green until the exact-head checks are green.
