# Баги — gospod-bog.ru · найдено 2026-06-25
> Аудит выполнен агентом по актуальному состоянию main. Каждый пункт — конкретный баг с указанием файла и чёткой формулировкой. Не субъективные замечания, только проверяемые факты.

---

## 🔴 КРИТИЧЕСКИЕ (ломают функциональность)

---

### BUG-001 · `fc-single-active` и `fc-series-active` в CSS никогда не активируются

**Файлы:** `src/components/ui/floating-cluster/SingleArticleCluster.astro`, `SeriesLiteCluster.astro`, `js/floating-cluster-controller.js`

CSS-правила скрытия дублирующих контролов (`#themeToggle`, `#bottomBar`, `#tocSidebar` и др.) написаны под `body.fc-single-active` и `body.fc-series-active`. Контроллер добавляет **другие классы**: `gb-cluster-single-active` и `gb-cluster-series-active`. Пересечения — нет. Итог: дублирующие старые кнопки (themeToggle, bottomBar) **не скрываются** на Герменевтике, Антисоветов, Код да Винчи.

**Проверка:** `body.fc-single-active` в CSS ≠ `classList.add('gb-cluster-single-active')` в JS.

---

### BUG-002 · Baptisty (10 стр.) и Nagornaya (5 стр.) не имеют `data-fc-root` — контроллер не активирует body class

**Файлы:** `baptisty-rossii/*/index.html` (10 файлов), `nagornaya/chast-*/index.html` (5 файлов)

Контроллер ищет `qsa('[data-fc-root]')` для активации `gb-cluster-single-active`. На всех 15 legacy HTML-страницах `data-fc-root` отсутствует. Кнопки `gb-ember`/`gb-save` добавлены в `gbs2-rfoot`, но инициализация body-класса не происходит. `initEmbers()` (SVG-инъекция) всё же выполняется глобально, но click-делегирование через `initCluster()` **не работает** ни на одной из этих страниц.

**Проверка:** `grep -c "data-fc-root" baptisty-rossii/noch-na-kure/index.html` → 0.

---

### BUG-003 · `articles/krajne-li-isporcheno-serdce/index.html` и `rimlyanam-7-*/index.html` — root HTML не имеет `gb-ember`/`gb-save`, но Astro dist уже имеет

**Файлы:** `articles/krajne-li-isporcheno-serdce/index.html`, `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html`

`KrajneBody.astro` и `Rimlyanam7Body.astro` содержат `gb-ember` + `gb-save` в `gbs2-rfoot` (добавлено ранее). Root HTML — нет. Visual parity сравнивает legacy root vs dist: когда Astro dist соберётся, diff будет ненулевым. Также: ни контроллер (`floating-cluster-controller.js`), ни `floating-cluster.css` не подключены в root HTML этих страниц.

**Проверка:** `grep -c "gb-ember" articles/krajne-li-isporcheno-serdce/index.html` → 0. В Astro → 7.

---

### BUG-004 · `validate:static-publication` использует нестрогую проверку миграции

**Файл:** `package.json`

Скрипт `validate:static-publication` вызывает `npm run migration:metadata:check` (без `--strict`), а не `migration:metadata:check:strict`. Это позволяет warnings вместо errors проходить финальный release gate. Исправление вносилось в `system-contract-bugfixes`, но позднейший agent-коммит откатил правку.

**Проверка:** `"validate:static-publication"` в `package.json` заканчивается на `migration:metadata:check"` — без `:strict`.

---

### BUG-005 · `migration/route-migration-matrix.json` не содержит режима `strict-native-holding-page`

**Файл:** `migration/route-migration-matrix.json`

Holding карты (`/karty/early-church/`, `/karty/maccabim/` и ещё 6) помечены как `strict-native-app` в matrix, хотя они — временные placeholder-страницы с `noindex` и `data-pagefind-ignore`. Режим `strict-native-holding-page` был введён в `system-contract-bugfixes`, но откатился. Это нарушает контракт аудита: `native:runtime:audit:strict` не применяет правильные проверки к holding pages.

**Проверка:** `jq '.modes | keys' migration/route-migration-matrix.json` → нет `strict-native-holding-page`.

---

### BUG-006 · `data/route-profiles/karty-*.json` — все 10 карт помечены `mode: legacy-shadow-app`

**Файлы:** `data/route-profiles/karty-avraam.json`, `karty-early-church.json` и ещё 8

Профили содержат `"migrationMode": "legacy-shadow-app"` и `"currentStatus": "production-dist"` для всех карт, включая реальные live-приложения (`avraam`, `ishod`) и holding pages. Правильные значения (`strict-native-app`/`strict-native-holding-page`, `production-app`/`temporary-placeholder`) были установлены в предыдущей lane, но откатились позднейшим агентом.

**Проверка:** `cat data/route-profiles/karty-avraam.json | grep migrationMode` → `legacy-shadow-app`.

---

### BUG-007 · `GillContextPageChrome.astro` не имеет PlayEmber в `gbs-rail-foot`

**Файл:** `src/components/article-pilots/gill-context/GillContextPageChrome.astro`

`gill-context` не использует `GillRailControls` в отличие от всех остальных Gill-частей (Part1–3, Spravochnik). В его `gbs-rail-foot` есть только Theme, Search, A−/A+, но нет PlayEmber и SaveButton. Пользователь `/articles/dzhon-gill-istoricheskiy-kontekst/` не видит ни Play ни Save в rail.

**Проверка:** В `GillContextPageChrome.astro` нет `GillRailControls` и нет `gb-ember` в rfoot-секции.

---

## 🟡 ВАЖНЫЕ (влияют на UX или корректность данных)

---

### BUG-008 · `floating-cluster.css` не подключён на baptisty (10 стр.) и nagornaya (5 стр.)

**Файлы:** `baptisty-rossii/*/index.html` (10 файлов), `nagornaya/chast-*/index.html` (5 файлов)

Кнопки `gb-ember` и `gb-save` добавлены в HTML, но `css/floating-cluster.css` не подключён через `<link>`. Стили для `gb-ember` присутствуют в `site.css` (базовые), но полный набор стилей (ring, states, mobile pill) живёт только в `floating-cluster.css`. Визуально кнопки могут выглядеть некорректно.

**Проверка:** `grep "floating-cluster.css" baptisty-rossii/noch-na-kure/index.html` → пусто.

---

### BUG-009 · `NagornayaChastNPageFooter.astro` (all 5) — версия контроллера `c78a4236` устарела

**Файлы:** `src/components/nagornaya/chast-{1..5}/NagornayaChast{N}PageFooter.astro`

Все 5 Astro-футеров Нагорной содержат `floating-cluster-controller.js?v=c78a4236`. Актуальная версия — `35a91710`. Когда Astro dist строится, подключается стальная версия. Root HTML уже обновлён до `35a91710`, но dist будет отставать.

**Проверка:** Actual hash: `md5(js/floating-cluster-controller.js)[:8]` = `35a91710`. В footer: `c78a4236`.

---

### BUG-010 · `hard-texts` серия: часть 3 `zakon-duha-zhizni-rimlyanam-8` без `readTime` в `data/series.json`

**Файл:** `data/series.json`

Третья часть серии `hard-texts` (`n=3`, `slug=zakon-duha-zhizni-rimlyanam-8`) не имеет поля `readTime` (и `readingTime`). Страница не существует физически, но запись в `series.json` есть. `data:consistency` и `gill:reading-time:audit` не проверяют `hard-texts` — баг проходит незамеченным.

**Проверка:** `jq '.["hard-texts"].parts[2]' data/series.json` → нет поля `readTime`.

---

### BUG-011 · `floating-cluster.css` содержит 207 `!important` — превышает ceiling

**Файл:** `css/floating-cluster.css`

`css/site-layered.css` имеет ceiling `!important` = 202 (проверяется `css:layer:validate`). `floating-cluster.css` содержит **207** `!important`. Это нарушает budgeting-политику проекта. `css:layer:validate` не проверяет `floating-cluster.css`, поэтому нарушение проходит незамеченным.

**Проверка:** `grep -c "!important" css/floating-cluster.css` → 207.

---

### BUG-012 · Нагорная root HTML: нет `data-fc-root` — контроллер не активирует дубль-скрытие

**Файлы:** `nagornaya/chast-*/index.html` (5 файлов)

Даже если `floating-cluster-controller.js` загрузится, без `data-fc-root` в DOM не выполнятся `activateSinglePilot()` / `activateSeriesPilot()`. В итоге `body.gb-cluster-single-active` не будет добавлен — sidebar может показывать избыточные кнопки при определённом DOM.

**Связан с BUG-002.**

---

### BUG-013 · `gill-context` root HTML содержит `gb-ember` в gbs2-rfoot, но Astro-источник — нет

**Файлы:** `articles/dzhon-gill-istoricheskiy-kontekst/index.html` vs `GillContextPageChrome.astro`

Root HTML статьи Gill Context был обновлён (раньше), но `GillContextPageChrome.astro` не имеет PlayEmber в rfoot — только Theme и Search. При сборке dist происходит расхождение: root content ≠ dist content. Это parity-риск.

**Связан с BUG-007.**

---

### BUG-014 · `AGENTS.md` не обновлялся с `r299` (24 июня) — вся работа 25 июня не задокументирована

**Файл:** `AGENTS.md`

Все крупные изменения 25 июня (`floating-cluster.css`, новый контроллер, добавление Play/Save на 25 страниц, parity-фикс Нагорной, cleanup 52 веток) не зафиксированы в revision log. По правилам проекта, каждое крупное изменение архитектуры должно создавать новую запись `AGENTS-rNNN`.

**Проверка:** `grep "AGENTS-r3" AGENTS.md | head -1` → последняя `r299` от 2026-06-24.

---

### BUG-015 · `AUDIT_HISTORY.md` не обновлялся с `v72` (22 июня)

**Файл:** `AUDIT_HISTORY.md`

История аудитов заморожена на `v72`. Всё что произошло 23–25 июня (visual-parity сессии, floating cluster, lane cleanups, P0.1–P0.6 фиксы) не задокументировано. Это нарушает traceability и recovery-политику проекта.

---

## 🟢 ЗАМЕЧАНИЯ (улучшения / технический долг)

---

### BUG-016 · `GillPart1-3`, `GillSpravochnik` PageChrome не имеют `data-fc-root`

**Файлы:** `src/components/article-pilots/gill-part{1,2,3}/Gill*PageChrome.astro`, `gill-spravochnik/GillSpravochnikPageChrome.astro`

`GillRailControls` внутри этих PageChrome имеет `data-fc-controls="gill-rail"` — контроллер находит его через `initGillRail()`. Но `data-fc-root` отсутствует в PageChrome, поэтому `roots.forEach(activateSinglePilot)` не вызывается. Это означает body-класс `gb-cluster-single-active` не добавляется на Gill-страницах.

---

### BUG-017 · `SeriesLiteCluster.astro` — body class `fc-series-active` в CSS, но контроллер добавляет `gb-cluster-series-active`

**Файлы:** `src/components/ui/floating-cluster/SeriesLiteCluster.astro`

В Astro-компоненте в `<style is:global>` написаны правила для `body.fc-series-active`. Контроллер добавляет `body.gb-cluster-series-active`. Правила из Astro (которые попадают в dist) никогда не сработают.

**Связан с BUG-001.**

---

### BUG-018 · `SingleArticleCluster.astro` — body class `fc-single-active` в `<style is:global>`, но не активируется

**Файл:** `src/components/ui/floating-cluster/SingleArticleCluster.astro`

Аналогично BUG-017: Astro-компонент содержит правила `body.fc-single-active` для скрытия дублирующих controls. Контроллер добавляет `gb-cluster-single-active`. Правила в Astro-dist никогда не сработают.

---

### BUG-019 · `css/floating-cluster.css` не подключён на `articles/krajne` и `articles/rimlyanam-7`

**Файлы:** `articles/krajne-li-isporcheno-serdce/index.html`, `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html`

Стили `gb-ember` частично есть в `site.css`, но полный набор (progress ring, states, dark mode glow) — только в `floating-cluster.css`. На обеих страницах он не подключён, но кнопки уже есть в Astro-source.

---

### BUG-020 · Nagornaya Astro `PageFooter` использует устаревший hash `c78a4236` для controller

Дублирует BUG-009 на уровне замечания: даже если hash не влияет на функциональность прямо сейчас, при deploy dist пользователи на Нагорной получат кэшированную старую версию контроллера, если браузер уже закэшировал `35a91710` для других страниц (разные версии конфликтуют в Service Worker).

---

### BUG-021 · `data/route-profiles/karty-*.json` — `legacyPath` и `visualParity` содержат stale данные

**Файлы:** `data/route-profiles/karty-{avraam,early-church,...}.json`

`"legacyPath": "karty/avraam/index.html"` и `"visualParity": {"desktop": 0, "mobile": 0}` — устаревшие поля. Для native Astro-страниц `legacyPath` должен быть `null`, а `visualParity` — тоже `null` (проверяется smoke, не pixel diff). Текущие значения дают неверную информацию при анализе профилей.

**Связан с BUG-006.**

---

### BUG-022 · `baptisty-rossii/*/index.html` — нет `floating-cluster-controller.js` в кэше SW

**Файл:** `sw.js`

Service Worker precache содержит `floating-cluster-controller.js` и `floating-cluster.css`. Но на baptisty-страницах `floating-cluster.css` не подключён (BUG-008). При offline-режиме SW всё равно отдаст файл, но браузер его никогда не запросит — файл занимает место в кэше впустую.

---

### BUG-023 · Nagornaya Astro PageChrome — `nag-sidebar-ember` добавлен, но нет `data-fc-controls` или `data-fc-root`

**Файлы:** `src/components/nagornaya/chast-{1..5}/NagornayaChast{N}PageChrome.astro`

PlayEmber и SaveButton добавлены в `nag-sidebar-controls`, но без `data-fc-root` или `data-fc-controls` атрибута. Контроллер не найдёт эти кнопки через `initCluster()`. Клик на Play/Save не будет обработан контроллером.

---

### BUG-024 · Остаточные правила `body.fc-single-active` в `SingleArticleCluster.astro` создают неработающий CSS в dist

**Файл:** `src/components/ui/floating-cluster/SingleArticleCluster.astro`

`<style is:global>` содержит `body.fc-single-active` правила которые Astro компилирует в dist CSS. Эти правила никогда не сработают (controller добавляет другой класс). Dead CSS в production — это технический долг.

---

### BUG-025 · `GillContextPageChrome.astro` имеет `data-fc-root` в inline `gbs-rail-foot` но нет PlayEmber

**Файл:** `src/components/article-pilots/gill-context/GillContextPageChrome.astro`

`gbs-rail-foot` имеет `data-fc-root data-fc-variant="gill" data-fc-mode="series-rich"` — контроллер найдёт его и вызовет `initCluster()`. Но кнопки в этом блоке — только Theme, Search, A−/A+. PlayEmber и SaveButton отсутствуют. Таким образом контроллер инициализируется, но управлять нечем — Play и Save недоступны для пользователя на `/articles/dzhon-gill-istoricheskiy-kontekst/`.

---

*Всего найдено: 25 багов (7 критических, 8 важных, 10 замечаний).*
*Дата аудита: 2026-06-25. Состояние: актуальный main, последний коммит `fb8e492`.*

---

## 🗑️ МУСОР — КАНДИДАТЫ НА УДАЛЕНИЕ

> Каждый пункт проверен: либо явный мусор (не используется нигде), либо **помечен как сомнительный** с объяснением почему НЕ удалять немедленно.

---

### TRASH-001 · `js/site-modules.js` — пилот Phase 3, нигде не подключён

**Статус: МУСОР (безопасно удалить)**

Файл 8.7KB, создан `bundle-modules.js` как эксперимент Рефакторинга 6.0 Phase 3. Не подключён ни в одном HTML файле (72 проверено). Не в `package.json`. Попал в `sw.js` precache ошибочно — SW кэширует файл который никогда не запрашивается браузером. Содержит захардкоженные Arena-пути в комментариях.

**Проверка:** `grep -rl "site-modules.js" . | grep -v "sw.js\|bundle-modules"` → пусто.

---

### TRASH-002 · `js/modules/` (4 файла, 6.9KB) — только для `site-modules.js`

**Статус: МУСОР (удалить вместе с TRASH-001)**

`js/modules/back-to-top.js`, `js/modules/faq-accordion.js`, `js/modules/img-loaded.js`, `js/modules/theme.js` — импортируются только в `site-modules.js`. Если `site-modules.js` удалить, эти файлы становятся полностью orphaned. Не в package.json, не в workflows, не в sw.js precache.

---

### TRASH-003 · `scripts/bundle-modules.js` — создаёт `site-modules.js`

**Статус: МУСОР (удалить вместе с TRASH-001/002)**

Скрипт 2.1KB, не в package.json, не в workflows. Единственное назначение — генерировать `js/site-modules.js`. Если `site-modules.js` удалён — скрипт бесполезен.

---

### TRASH-004 · `_check-fonts.mjs`, `_check-styles.mjs`, `_diag-kod.mjs` в корне

**Статус: МУСОР (безопасно удалить)**

Три диагностических скрипта от сессии отладки V7 Kod da Vinci (2026-06-23). Используют `import {chromium} from 'playwright'` и захардкоженный путь `/home/user/gb-is-my-strength` (Arena-специфичный, не работает на CI или локально у другого разработчика). Не в package.json, не в workflows. Принципиально: они **не нужны для production** — это одноразовые диагностические скрипты сессии.

---

### TRASH-005 · `docs/refactor-2026/lanes/visual-fix-nagornaya-native-2026-06-23/visual/` — 30.1MB PNG скриншотов

**Статус: МУСОР (безопасно удалить)**

18 PNG файлов с pixel-diff скриншотами от сессии 23 июня 2026. Самый тяжёлый: `nagornaya-chast-4-desktop-diff.png` — 4.7MB. Итого 30.1MB в git-репозитории. Эти скриншоты были временными доказательствами parity для той сессии. Lane завершена, parity достигнута. Хранить их в git бессмысленно — они занимают место в истории коммитов навсегда.

**Осторожность:** перед удалением убедиться что lane `visual-fix-nagornaya-native-2026-06-23` полностью закрыта и её результаты отражены в AUDIT_HISTORY.md.

---

### TRASH-006 · `.state-grid` CSS в `css/floating-cluster.css`

**Статус: МУСОР (маленький, безопасно удалить)**

Правило `@media(max-width:680px){.state-grid{grid-template-columns:repeat(2,1fr)}}` — остаток от probe HTML (`gb-floating-cluster-probe-v16.html`). Класс `.state-grid` использовался только в демо-секции скриншотов состояний. В production страницах не применяется.

---

### TRASH-007 · `js/site-modules.js` в `sw.js` precache

**Статус: связан с TRASH-001, исправить после удаления**

`sw.js` содержит `/js/site-modules.js` в `PRECACHE_ASSETS`. Файл SW кэширует его, но браузер никогда не запрашивает — пустой расход сетевого трафика при первой загрузке. После удаления `site-modules.js` (TRASH-001) нужно убрать запись из precache и обновить `CACHE_VERSION`.

---

### ⚠️ СОМНИТЕЛЬНЫЕ — ПРОВЕРИТЬ ПЕРЕД УДАЛЕНИЕМ

---

### MAYBE-001 · `js/series-cards.js` — нигде не подключён, но в официальном контракте

**Статус: НЕ удалять без решения владельца**

Файл v2 от 2026-06-08, 10.2KB. Не подключён ни в одном из 72 HTML-файлов и ни в одном Astro-компоненте. Не использует `data-series-cards` атрибут ни одна страница. НО: файл явно перечислен в `README.md` (§9 Структура файлов) и `AGENTS.md` как один из официальных JS-файлов (`ровно 11 файлов` в архитектурном контракте). Также в `sw.js` precache.

**Риск удаления:** нарушение контракта AGENTS.md §5.1. Возможно, файл готовится к использованию в будущих catalog pages. Решение должен принять владелец.

---

### MAYBE-002 · `scripts/` (10 файлов) без записи в package.json и workflows

**Статус: СОМНИТЕЛЬНЫЕ, требуют ручного ревью**

| Файл | Описание | Риск |
|---|---|---|
| `scripts/_audit-deep.js` | deep-audit (post patch-v2) | Возможно нужен для ручных проверок |
| `scripts/about-leaf-parity-shots.js` | Visual proof for /about/ pilot | Пилот завершён, скорее всего не нужен |
| `scripts/deep-check.js` | Playwright deep check | Может использоваться вручную |
| `scripts/extract-native-pilot.js` | Рефакторинг 5.0 Phase 6 | Старый пилот |
| `scripts/genealogy-e2e-v2.js` | E2E тест /rodosloviye/ | Нужен для ручного QA |
| `scripts/generate-route-profiles.js` | Генерация route-profiles | Есть ли скрипт-замена? |
| `scripts/ishod-qa.js` | QA для karty/ishod | Нужен для ручного QA |
| `scripts/map-visual-qa.js` | Visual QA для карт | Нужен для ручного QA |
| `scripts/route-impact-report.js` | Отчёт об impact | Аналитический инструмент |

Скрипты QA (genealogy, ishod, map-visual-qa) **не удалять** — они нужны для ручного тестирования интерактивных страниц которые не покрываются автоматическими CI-тестами. Остальные — на усмотрение владельца.

---

### MAYBE-003 · `docs/image-archive/` — старое OG-изображение Гилла

**Статус: НЕ критично, проверить**

`docs/image-archive/og-replaced-2026-06/old-og-gill-library-shelf.webp` — 183KB. Старое OG-изображение, заменённое в июне 2026. Хранится как backup. Если замена признана окончательной — можно удалить. Не влияет на production.

---

*Итого мусора: 6 категорий (TRASH-001..007), ~30MB в PNG + ~18KB в JS + ~11KB в scripts.*
*Сомнительных: 3 категории (MAYBE-001..003) — решение за владельцем.*
*Дата: 2026-06-25. Аудит выполнен агентом по main (fb8e492).*

---

## 🔴 НОВЫЕ БАГИ — раунд 2

---

### BUG-026 · Все 10 `baptisty-rossii/*/index.html` не имеют `BreadcrumbList` в JSON-LD

**Файлы:** `baptisty-rossii/{10 slug}/index.html`

DOM-хлебные крошки присутствуют (`.breadcrumb` в HTML), но JSON-LD `BreadcrumbList` отсутствует во всех 10 страницах. Яндекс и Google используют именно JSON-LD для Rich Results навигации. Без него ни одна baptisty-страница не получит хлебные крошки в SERP. Проверка: `grep "BreadcrumbList" baptisty-rossii/noch-na-kure/index.html` → пусто.

---

### BUG-027 · Все 11 `baptisty-rossii` страниц имеют `og:image` в формате SVG

**Файлы:** `baptisty-rossii/index.html` + 10 статей, `images/baptisty-rossii/cover-*.svg`

`og:image:type` = `image/svg+xml`. Facebook, Twitter, Telegram, VK, WhatsApp — ни одна соцсеть **не рендерит SVG** в превью ссылки. При шеринге baptisty-страниц превью будет без изображения. SVG-обложки (`cover-01-kura.svg`, …) — крошечные (1.4–1.5KB) placeholder-иконки. WebP-версий нет совсем. Нужно создать 1200×630px WebP/JPG обложки для соцсетей.

---

### BUG-028 · `nagornaya-visual-parity-audit.js` не проверяет наличие `nag-sidebar-ember`

**Файл:** `scripts/nagornaya-visual-parity-audit.js`

После добавления Play+Save кнопок в Nagornaya sidebar (25 июня) audit-скрипт не обновлён. Он проверяет только `<!DOCTYPE html>`, `nagornaya-page`, `main-content`. Если кто-то случайно удалит `nag-sidebar-ember` из PageChrome — audit не поймает регрессию. Нужно добавить `must(chrome, 'nag-sidebar-ember', ...)` и `must(chrome, 'nag-sidebar-save', ...)` в проверки.

---

## 🗑️ НОВЫЙ МУСОР — раунд 2

---

### TRASH-008 · `data/term-links.json` (12KB) — нигде не используется

**Статус: МУСОР или заготовка (уточнить у владельца)**

Файл содержит заготовку системы term-linking с полями `id`, `term`, `cat`, `color`, `brief`. Не загружается ни в одном JS-файле, Astro-компоненте или скрипте. Возможно, заготовка для будущей фичи перекрёстных ссылок на термины. Если фича не планируется — мусор. Проверка: `grep -r "term-links" . --include="*.js" --include="*.ts" --include="*.astro"` → только сам файл.

---

### TRASH-009 · `data/strategic-map-antisovetov.json` (30KB) — нигде не используется

**Статус: МУСОР или заготовка (уточнить у владельца)**

Файл содержит biblical analysis blocks (объекты с `type: 'biblical'`, `title`, `text`) для статьи 20 антисоветов пастору. Не подключён в `articles/20-antisovetov-pastoru/index.html`, не загружается в `AntisovetovBody.astro`, не упоминается ни в каком скрипте. Возможно, готовился для интерактивной «стратегической карты» статьи — но не реализован.

---

### TRASH-010 · `src/utils/legacyFullDocument.ts` — не импортируется нигде

**Статус: МУСОР (безопасно удалить)**

Утилита `loadLegacyFullDocument()` для shadow-wrap режима (загрузка полного legacy HTML). Рефакторинг 6.0 убрал все shadow-wrap страницы. `grep -r "legacyFullDocument" src/` → 0 результатов в `.astro`/`.ts`/`.tsx`. Включён в tsconfig но не импортируется. Audit-скрипты проверяют отсутствие вызовов этой функции в routes — удаление файла на это не влияет.

---

### TRASH-011 · `src/utils/legacyShadow.ts` — не импортируется нигде

**Статус: МУСОР (безопасно удалить)**

Утилита-парсер для `legacyShadow` режима (извлечение head/body/meta из legacy HTML). Аналогично TRASH-010: после рефакторинга 6.0 не используется. `grep -r "legacyShadow" src/` → 0 результатов. Можно удалить вместе с TRASH-010.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 2

---

### NOTE-001 · `css/floating-cluster.css` содержит `.state-grid` — probe-класс из демо

Уже в TRASH-006. Подтверждено: единственный probe-класс в файле. Остальной CSS файла — production-ready.

### NOTE-002 · `data/visual-parity-baseline.json` и `data/public-content-baseline.json` — актуальны

Оба используются в `scripts/visual-parity-baseline.js` и `scripts/generate-route-profiles.js`. Не мусор.

### NOTE-003 · `src/styles/global.css` и `src/styles/tokens.css` — используются

Импортируются в `src/layouts/BaseLayout.astro`. Не мусор.

### NOTE-004 · React (`@astrojs/react`, `@xyflow/react`) — intentional для `/rodosloviye/`

Родословие (`src/components/genealogy/*.tsx`) — интерактивное дерево генеалогии на React+XYFlow. AGENTS.md запрет React как runtime-стека относится к обычным статьям, не к специализированным интерактивным виджетам. Не баг.

### NOTE-005 · Все 20 MDX-файлов используют `publishedAt`/`updatedAt` (не `date`) — корректно

Astro content schema это принимает. Ложная тревога при первичном сканировании.

### NOTE-006 · `baptisty-rossii` не имеет записей в `feed.xml`

Baptisty-статьи отсутствуют в RSS-ленте. Возможно намеренно (серия ещё в работе). Требует решения владельца — включать ли в feed.

---

*Итого после раунда 2: +3 новых бага (BUG-026..028), +4 единицы мусора (TRASH-008..011), 6 замечаний.*
*Общий счёт: 28 багов, 11 категорий мусора, 9 замечаний.*
*Дата: 2026-06-25. Состояние main: коммит 216bc1a.*

---

## 🔴 НОВЫЕ БАГИ — раунд 3

---

### BUG-029 · `RomanNumeral.astro` рендерит класс `fc-roman` — CSS не существует ни в одном файле

**Файлы:** `src/components/ui/floating-cluster/RomanNumeral.astro`, `GillPart1-3PageChrome.astro`, `GillSpravochnikPageChrome.astro`

`RomanNumeral.astro` рендерит `<span class="fc-roman">`. Root HTML Gill-статей содержит `<span class="gb-roman">`. Ни `fc-roman`, ни `gb-roman` не определены ни в одном CSS файле. Компонент отображается как unstyled text — визуально пока работает за счёт контекста (`gbs2-bbar`), но класс бессмысленный. Дополнительное несоответствие: root HTML (legacy) = `gb-roman`, Astro dist = `fc-roman` → разные классы между parity-парами.

**Проверка:** `grep -r "fc-roman\|gb-roman" css/` → только в `floating-cluster.css` как `roman-cell` (другой компонент), но не сам `fc-roman` / `gb-roman`.

---

### BUG-030 · `css/site-layered.css` (282KB) в `sw.js` precache — пользователи кэшируют файл зря

**Файлы:** `sw.js`, `css/site-layered.css`

`site-layered.css` — это CSS с `@layer`-архитектурой для audit/validation скриптов (`css:layer:validate`). В production HTML (ни в одном из 72 страниц) он **не подключён**. Тем не менее попал в `PRECACHE_ASSETS` в `sw.js`. При каждом первом визите браузер скачивает лишние ~282KB. Это чистый overhead.

**Проверка:** `grep "site-layered" **/*.html` → 0. `grep "site-layered" sw.js` → есть в precache.

---

### BUG-031 · `audit/` содержит 10 дублированных файлов (211KB) — те же файлы что в `audit/archive/`

**Файлы:** `audit/*.md` (10 файлов), `audit/archive/*.md` (10 тех же)

Файлы `audit-full-2026-06-04.md`, `content-source-audit-2026-06-06.md`, 8 других — присутствуют и в корне `audit/` и в `audit/archive/`. Это 211KB полного дублирования. Очевидно, при создании `archive/` поддиректории файлы переместили, но оригиналы не удалили.

---

## 🗑️ НОВЫЙ МУСОР — раунд 3

---

### TRASH-012 · `_build-tools/konfessii-baptizm/MAP-MOCKUPS-2D-3D-ATLAS-STANDALONE-2026-06-14.html` — 10MB в репо

**Статус: СОМНИТЕЛЬНЫЙ — уточнить у владельца**

Один HTML файл весит **10.1MB** (standalone mockup с inline данными). Вся папка `_build-tools/` = 10.4MB. Папка явно исключена из production pipeline (в exclude-lists всех скриптов), не в `.gitignore`, но хранится в git. Содержит R&D материалы для 3D-карты ЕХБ (`MindMap3D.tsx`, `source-snapshot/`, планы). Предназначен для разработчиков как reference. Вопрос: нужно ли хранить 10MB в git-истории навсегда? Альтернатива — перенести в GitHub Wiki или внешнее хранилище.

---

### TRASH-013 · `audit/` дубли 10 файлов (211KB)

**Статус: МУСОР (безопасно удалить дубли из корня `audit/`)**

10 файлов существуют и в `audit/` и в `audit/archive/`. Архивные копии в `archive/` — это источник истины. Дубли в корне `audit/` — лишние. Безопасно: `rm audit/audit-full-2026-06-04.md audit/content-source-audit-2026-06-06.md ...` (10 файлов) оставив только в `archive/`.

---

### TRASH-014 · `site-layered.css` в `sw.js` precache — лишний трафик 282KB

**Статус: ИСПРАВИТЬ (убрать из precache)**

Удалить `/css/site-layered.css` из `PRECACHE_ASSETS` в `sw.js` и обновить `CACHE_VERSION`. Файл нужен только для локальных аудитов (`npm run css:layer:validate`), не для пользователей.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 3

---

### NOTE-007 · `src/layouts/ArticleLayout.astro` и `SeriesArticleLayout.astro` — заготовки без использования

Оба импортируют `astro:content` (getCollection) и предназначены для MDX content-collection routing через `getStaticPaths + [slug].astro`. Однако в проекте нет динамических `[slug].astro` страниц — каждая статья имеет свой отдельный `index.astro`. Layouts готовы, но не подключены ни к одному production route. Это архитектурный debt — либо реализовать dynamic routing, либо задокументировать как «заготовки будущей архитектуры».

### NOTE-008 · `_build-tools/` не в `.gitignore` — 10.4MB в git-истории навсегда

Папка правильно исключена из production pipeline, но не из `.gitignore`. Каждый `git clone` тянет 10.4MB дополнительных данных. Рассмотреть добавление в `.gitignore` или использование Git LFS для больших файлов.

### NOTE-009 · `fc-roman` vs `gb-roman` — несоответствие классов между Astro dist и root HTML

Технически не ломает визуал (unstyled span), но нарушает принцип parity. При CSS audit или добавлении стилей нужно знать какой класс использовать. Рекомендация: унифицировать в одно имя и добавить CSS стили (`font-family: serif; font-style: italic; font-weight: 700; letter-spacing: .06em;`).

### NOTE-010 · `data/term-links.json` и `data/strategic-map-antisovetov.json` — нет документации назначения

Оба файла не используются и не упомянуты в README/AGENTS как планируемые фичи. Если это заготовки — они должны быть задокументированы (`# TODO:` комментарий в файле или запись в AGENTS.md). Иначе любой агент может их удалить как мусор.

---

*Итого раунд 3: +3 бага (BUG-029..031), +3 мусора (TRASH-012..014), 4 замечания.*
*Суммарный итог по всем раундам: 31 баг · 14 категорий мусора · 10 замечаний.*
*Дата: 2026-06-25. Состояние main: 7f554dd.*
