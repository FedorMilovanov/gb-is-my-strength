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

---

## 🔴 НОВЫЕ БАГИ — раунд 4 (external/internal gates, verified 2026-06-27)

---

### BUG-032 · `dist-publication-audit.js` требует устаревший `gbs2-rail` на 4 Gill routes

**Файл:** `scripts/dist-publication-audit.js` (`visualShadowArticleMarkers`, строки ~211–217)

Четыре Gill PageChrome-компонента уже сознательно конвертированы с `gbs2-rail` на `gbs-rail` v16 — см. комментарии в:

- `src/components/article-pilots/gill-part1/GillPart1PageChrome.astro`
- `src/components/article-pilots/gill-part2/GillPart2PageChrome.astro`
- `src/components/article-pilots/gill-part3/GillPart3PageChrome.astro`
- `src/components/article-pilots/gill-spravochnik/GillSpravochnikPageChrome.astro`

Но `dist-publication-audit.js` всё ещё требует `gbs2-rail` для:

- `dzhon-gill-chast-1-chelovek`
- `dzhon-gill-chast-2-uchenyi`
- `dzhon-gill-chast-3-nasledie`
- `dzhon-gill-spravochnik`

При этом `dzhon-gill-istoricheskiy-kontekst` в том же объекте уже требует правильный `gbs-rail`. Значит, часть карты маркеров забыли обновить после v16-конвергенции.

**Воспроизведение:**

```bash
npm run strangler:audit:production-like
```

Фактический провал:

```text
❌ /articles/dzhon-gill-spravochnik/ in dist is missing visual-shadow markers: gbs2-rail
❌ /articles/dzhon-gill-chast-1-chelovek/ in dist is missing visual-shadow markers: gbs2-rail
❌ /articles/dzhon-gill-chast-2-uchenyi/ in dist is missing visual-shadow markers: gbs2-rail
❌ /articles/dzhon-gill-chast-3-nasledie/ in dist is missing visual-shadow markers: gbs2-rail
```

**Исправление:** заменить `gbs2-rail` → `gbs-rail` только для четырёх Gill routes. `krajne`/`rimlyanam-7` не трогать: их источники ещё реально используют `gbs2-rail`.

---

### BUG-033 · `interactive-audit.js` проверяет только `.gbs2-*` и ложно валит конвертированную Gill-серию

**Файл:** `scripts/interactive-audit.js` (селекторы `.gbs2-rail`, `.gbs2-parts`, `.gbs2-mobile-head`, `#gbs2Bbar`, `#gbs2Sheet`)

После v16-конвергенции Gill routes используют `gbs-rail`, но browser-audit продолжает искать только старые `gbs2-*` DOM-маркеры. Поэтому `npm run interactive-audit` даёт 15+ false-positive issues на Gill pages:

```text
gbs-rail-not-visible
gbs-no-current-part
gbs-mobile-ui-missing
```

**Воспроизведение:** поднять `dist/` на `127.0.0.1:8080` и выполнить:

```bash
npm run interactive-audit
```

**Исправление:** принимать актуальные v16-селекторы (`gbs-rail`, current-card marker и т.п.) либо временно поддерживать оба поколения (`gbs2-*` и `gbs-*`) до завершения strangler-миграции.

---

### BUG-034 · `visual-audit.js` проверяет устаревший Gill cover selector и выдаёт `bio-cover-missing`

**Файл:** `scripts/visual-audit.js` (строки ~275–315)

`visual-audit.js` ожидает для `/articles/dzhon-gill-chast-1-chelovek/` один из старых селекторов:

```text
.bio-cover, .gbs2-current-cover, .gbs2-mobile-head img
```

В актуальной v16-разметке Gill chast-1 этих селекторов нет. Поэтому `npm run visual-audit` нашёл 2 HIGH-блокера (`mobile` и `desktop`):

```json
{"kind":"bio-cover-missing","page":"/articles/dzhon-gill-chast-1-chelovek/","detail":"bio-cover 16:9 block missing from Gill chast-1 article"}
```

**Статус:** вероятный stale-check после v16-конвергенции. Нужно либо обновить селектор на реальный текущий cover/current-card marker, либо зафиксировать в проектном контракте, что у этой страницы больше нет отдельного 16:9 `bio-cover` блока.

---

### BUG-035 · `interactive-audit` сообщает `mobile-theme-control-not-visible` на двух статьях

**Файлы/страницы:**

- `/articles/dzhon-gill-chast-1-chelovek/`
- `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`

Помимо stale `gbs2-*` проблем, `interactive-audit` отдельно сообщает:

```text
mobile-theme-control-not-visible: "theme enabled but no visible control"
```

Это не объясняется только `gbs2-rail → gbs-rail` конвергенцией и требует ручного UX-триажа на мобильном viewport: либо контрол темы действительно скрыт/недоступен, либо audit неверно определяет видимость.

---

### BUG-036 · Pa11y нашёл 45 WCAG2AA contrast errors на home page

**Инструмент:** Pa11y `9.1.1`
**Команда:**

```bash
pa11y http://127.0.0.1:8090/ --reporter json --standard WCAG2AA
```

`/about/` прошёл без ошибок, но `/` выдал 45 ошибок `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail`: недостаточный контраст текста. Повторяющиеся зоны:

- `.h-hero-tagline`
- `.h-hero-desc`
- `.h-hero-search__placeholder`
- `.h-section-label`
- `.h-planned-label`
- `.h-meta-author`
- `.h-meta-time`
- `.h-meta-sep`
- `.h-meta-tag--neutral`
- `kbd` внутри hero search

Пример:

```text
Expected a contrast ratio of at least 4.5:1, but text in this element has a contrast ratio of 4.41:1.
<p class="h-hero-tagline">Для изучения Писания</p>
```

**Исправление:** поднять контраст secondary/meta текста home page до WCAG AA 4.5:1, особенно в светлой теме.

---

### BUG-037 · Semgrep/zizmor подтверждают template injection risk в `shared-files-guard.yml`

**Файл:** `.github/workflows/shared-files-guard.yml`, строка ~43

В шаге `Report shared files touched` GitHub context вставляется прямо в shell script:

```yaml
run: |
  echo "Branch: ${{ github.ref_name }}"
  echo "Event: ${{ github.event_name }}"
```

Semgrep rule `yaml.github-actions.security.run-shell-injection.run-shell-injection` пометил это как blocking finding. Zizmor также нашёл `template-injection` с `High` confidence / `High` severity для этого workflow.

**Почему это баг:** значения GitHub context подставляются в shell source до выполнения. Для branch/ref names безопаснее разделять код и данные через `env:`.

**Исправление:**

```yaml
- name: Report shared files touched
  if: always()
  env:
    REF_NAME: ${{ github.ref_name }}
    EVENT_NAME: ${{ github.event_name }}
  run: |
    echo "Branch: $REF_NAME"
    echo "Event: $EVENT_NAME"
    echo "Shared files guard completed"
```

---

### BUG-038 · Dependency audit не зелёный: `npm audit` = 8 vulnerabilities, OSV подтверждает `esbuild` LOW

**Файлы:** `package-lock.json`, dependency tree

`npm audit --json` в текущем `main` возвращает ненулевой exit code:

```text
8 vulnerabilities: 3 low, 5 moderate
```

Независимый OSV Scanner по `package-lock.json` также подтвердил минимум одну актуальную advisory:

```text
esbuild 0.27.7 · GHSA-g7r4-m6w7-qqqr · LOW
```

**Статус:** dependency-security debt. Не запускать `npm audit fix --force` автоматически: audit сам предлагает major/breaking path через `@astrojs/check`. Нужен отдельный dependency lane с проверкой Astro/build gates.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 4

### NOTE-011 · `html-validate` работает, но без конфигурации слишком шумный для CI

`npx html-validate 'dist/**/*.html' --formatter json` нашёл 1591 errors на 53 файлах. Большая часть — проектно-спорные правила (`doctype-style`, `no-inline-style`, `no-redundant-role`, `script-type`, generated Astro output). Инструмент полезен только после создания `.htmlvalidate.json` с правилами проекта. Без конфигурации не делать blocking gate.

### NOTE-012 · Lighthouse полезен как диагностика, но локальный `python3 http.server` искажает perf-gate

Lighthouse успешно запустился через `CHROME_PATH` Playwright Chromium:

```text
/ home: Performance 66, Accessibility 95, Best Practices 75, SEO 100
Gill part1: Performance 31, Accessibility 90, Best Practices 75, SEO 100
```

Но локальный `python3 http.server` не даёт production gzip/cache/CDN headers, поэтому `uses-text-compression` и часть perf score нельзя считать production-багом без проверки на реальном preview/prod.

### NOTE-013 · `zizmor` нашёл 34 GitHub Actions hardening findings

Категории: `unpinned-uses` (20), `artipacked` (7), `template-injection` (5), `dangerous-triggers` (2). Это не всё сразу production-баги, но хороший backlog для отдельной CI-hardening lane.

---

*Итого раунд 4: +7 багов (BUG-032..038), +3 замечания.*
*Суммарный итог по всем раундам: 38 багов · 14 категорий мусора · 13 замечаний.*
*Дата: 2026-06-27. Состояние main: `819fd3f`.*

---

## 🔴 НОВЫЕ БАГИ — раунд 5 (external checks wave 2, verified 2026-06-27)

---

### BUG-039 · `docs/LANE_LOCK_POLICY.md` содержит битую относительную ссылку на `WORK_MODES.md`

**Файл:** `docs/LANE_LOCK_POLICY.md`, строка 6

Lychee local-docs scan нашёл broken local link:

```text
docs/LANE_LOCK_POLICY.md: file:///home/user/repo/docs/docs/WORK_MODES.md
File not found. Check if file exists and path is correct
```

Причина: файл уже находится в `docs/`, поэтому ссылка `[docs/WORK_MODES.md](docs/WORK_MODES.md)` резолвится как `docs/docs/WORK_MODES.md`.

**Исправлено в lane:** ссылка заменена на `[docs/WORK_MODES.md](WORK_MODES.md)`.

---

### BUG-040 · `shared-files-guard.yml` template injection finding исправлен через `env`

**Файл:** `.github/workflows/shared-files-guard.yml`

Semgrep в предыдущей волне нашёл GitHub Actions template injection в shell step. В этой lane блок заменён с прямой подстановки `${{ github.* }}` внутри `run:` на безопасную передачу через `env:`:

```yaml
env:
  REF_NAME: ${{ github.ref_name }}
  EVENT_NAME: ${{ github.event_name }}
run: |
  echo "Branch: $REF_NAME"
  echo "Event: $EVENT_NAME"
```

**Проверка после фикса:** `semgrep scan --config p/ci` → `0` findings.

---

### BUG-041 · actionlint+ShellCheck находит shell issues в GitHub Actions snippets

**Файлы:** `.github/workflows/indexnow.yml`, `.github/workflows/visual-parity.yml`

После установки `shellcheck` `actionlint` начинает проверять inline shell внутри workflow. Команда:

```bash
actionlint -color=false .github/workflows/*.yml
```

сейчас падает на shellcheck findings:

- `indexnow.yml`: `SC2015` — `A && B || C` не является безопасным if-then-else;
- `indexnow.yml`: `SC2034` — переменная `i` в retry loop выглядит unused;
- `indexnow.yml`: `SC2086` — часть переменных/refs нужно quote-ить;
- `indexnow.yml` и `visual-parity.yml`: `SC2129` style — несколько `>> file` можно сгруппировать.

**Статус:** workflow syntax проходит, но strict shell-aware actionlint не зелёный. Рекомендация: отдельной CI-hardening правкой привести inline shell к ShellCheck-clean или запускать syntax-only mode `actionlint -shellcheck ''` до завершения hardening.

---

### BUG-042 · OpenSSF Scorecard = 4.5/10: repo security posture ниже желаемого уровня

**Инструмент:** OpenSSF Scorecard `v5.5.0`
**Команда:** `scorecard --repo=github.com/FedorMilovanov/gb-is-my-strength --format=json --show-details`

Итоговый score:

```text
4.5 / 10
```

Низкие/нулевые зоны:

- `Branch-Protection: 0` — branch protection not enabled on development/release branches;
- `Code-Review: 0` — approved changesets not detected;
- `License: 0` — license file not detected;
- `SAST: 0` — no SAST tool detected;
- `Security-Policy: 0` — security policy file not detected;
- `Token-Permissions: 0` — detected GitHub workflow tokens with excessive permissions;
- `Pinned-Dependencies: 2` — actions/dependencies not pinned by hash.

**Статус:** это не один code bug, а repository-governance backlog. Нужно отдельной hardening lane: `SECURITY.md`, license decision, SAST workflow, token permissions, pinning policy, branch protection через GitHub settings.

---

### BUG-043 · `notify-on-failure.yml` не имел newline at EOF

**Файл:** `.github/workflows/notify-on-failure.yml`

`yamllint -d relaxed .github/workflows` нашёл единственный не-style error:

```text
.github/workflows/notify-on-failure.yml
  166:14 error no new line character at the end of file (new-line-at-end-of-file)
```

**Исправлено в lane:** добавлен newline в конец файла.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 5

### NOTE-014 · markdownlint-cli2 без конфигурации даёт 17k+ ошибок

Инструмент работает, но текущий репозиторий содержит много старых research/build-tool Markdown файлов с длинными строками и нестандартной структурой. Blocking gate без `.markdownlint-cli2`/scoped changed-files режима будет шумом.

### NOTE-015 · CSpell без русского/custom dictionary непригоден

Generic CSpell scan дал 306k+ unknown words из-за русского текста, транслитерации (`nagornaya`, `rodosloviye`, `baptisty`) и project-specific терминов. Не добавлять до настройки словарей.

### NOTE-016 · Knip дважды падает в Arena на `oxc-parser` ArrayBuffer allocation

Пробовались:

1. обычный `npx knip --reporter json`;
2. scoped config с исключением `_build-tools`, `dist`, `docs`, `audit`;
3. retry с `NODE_OPTIONS=--max-old-space-size=1536`.

Все варианты завершились `RangeError: Array buffer allocation failed`. В Arena эту проверку не повторять без изменения памяти/версии Knip. Можно переоценить локально на машине владельца.

### NOTE-017 · depcheck полезен только с ignore list

`depcheck --json` нашёл потенциально unused devDependencies (`@astrojs/check`, `@astrojs/rss`, `typescript`) и missing deps в `_build-tools`, но в текущем виде это noisy: `astro:content` и R&D `_build-tools` дают false positives. Не делать blocking gate без config.

### NOTE-018 · madge circular dependency scan чистый

`madge --extensions js,ts,tsx,astro --circular src scripts` обработал 493 файла и не нашёл циклических зависимостей. Это хороший low-noise advisory check.

---

*Итого раунд 5: +5 багов/исправлений (BUG-039..043), +5 замечаний.*
*Суммарный итог по всем раундам: 43 бага · 14 категорий мусора · 18 замечаний.*
*Дата: 2026-06-27. Состояние lane: `lane/external-checks-registry`.*

---

## 🔴 НОВЫЕ БАГИ / FIXES — раунд 6 (external checks wave 3, verified 2026-06-27)

---

### BUG-044 · `dist-publication-audit.js` stale `gbs2-rail` marker fixed for Gill v16 routes

**Файл:** `scripts/dist-publication-audit.js`

Исправлен BUG-032: для четырёх Gill routes audit-карта теперь требует актуальный `gbs-rail`, а не устаревший `gbs2-rail`:

- `dzhon-gill-spravochnik`
- `dzhon-gill-chast-1-chelovek`
- `dzhon-gill-chast-2-uchenyi`
- `dzhon-gill-chast-3-nasledie`

`rimlyanam-7` и `krajne` оставлены на `gbs2-rail`, потому что их источники ещё реально используют старый marker.

**Статус:** fixed in main working session. Полный `strangler:audit:production-like` в Arena не удалось завершить из-за OOM/killed во время Astro check/build, но сама stale-marker правка точечная и проверена по source contract.

---

### BUG-045 · Prettier + Astro plugin показывает массовый formatting drift и CSS parse issue в `site-layered.css`

**Инструмент:** Prettier with temporary `prettier-plugin-astro` install

Обычный `npx prettier --check` не понимает `.astro`; после установки `prettier-plugin-astro` проверка запускается, но показывает много formatting diffs по Astro/JS/CSS и отдельный parse error:

```text
css/site-layered.css: SyntaxError: CssSyntaxError: Unknown word .bottom-bar,.btoc-link,.flip-card-inner,.h-article-card,.quiz-option
```

**Статус:** не добавлять Prettier как blocking gate без явной project config, plugin setup и exclude/cleanup для generated/layered CSS.

---

### BUG-046 · jscpd выявил 27 duplicated code clones в audit/script layer

**Инструмент:** `jscpd`

Команда нашла 27 clones. Самые показательные зоны:

- повторяющийся scaffolding в `about-visual-parity-audit.js`, `articles-visual-parity-audit.js`, `biografii-visual-parity-audit.js`, `hard-texts-visual-parity-audit.js`, `karty-visual-parity-audit.js`, `konfessii-visual-parity-audit.js`, `nagornaya-visual-parity-audit.js`, `pastor-series-visual-parity-audit.js`;
- сильное дублирование между `gill-context-visual-parity-audit.js` и `gill-spravochnik-visual-parity-audit.js`;
- дубли между `map-browser-smoke.js` и `map-mobile-smoke.js`;
- дубли между `audit-pro.js` и `validate.js`.

**Статус:** refactor backlog, не production bug. Рекомендация: вынести общий audit helper для visual-parity скриптов, но не делать jscpd blocking gate.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 6

### NOTE-019 · npm registry signatures и lockfile-lint чистые

`npm audit signatures` прошёл: 476 packages have verified registry signatures, 106 packages have verified attestations. `lockfile-lint` прошёл: HTTPS/allowed hosts/integrity clean.

### NOTE-020 · JSON/XML syntax checks чистые

90 JSON файлов парсятся через `JSON.parse`, XML/XSL файлы проходят `xmllint --noout`.

### NOTE-021 · ESLint/Stylelint не готовы без конфигурации

ESLint v9 падает из-за отсутствия `eslint.config.*`; Stylelint падает из-за отсутствия config. Не добавлять как gate до отдельной config lane.

---

*Итого раунд 6: +3 пункта (BUG-044..046), +3 замечания.*
*Суммарный итог по всем раундам: 46 багов/пунктов · 14 категорий мусора · 21 замечание.*
*Дата: 2026-06-27. Состояние main session after direct push policy.*

---

## 🔴 НОВЫЕ БАГИ / FIXES — раунд 7 (runtime + axe verification, 2026-06-27)

---

### BUG-047 · `interactive-audit.js` stale Gill `gbs2-*` selectors fixed; runtime audit now passes

**Файл:** `scripts/interactive-audit.js`

Исправлены BUG-033/035 false positives:

- desktop series audit теперь принимает `.gbs-rail` и `.gbs-rail-card.is-current` вместе с legacy `.gbs2-*`;
- mobile series audit теперь различает legacy GBS2 sheet (`#gbs2Bbar`, `#gbs2Sheet`) и Gill v16 bottom bar (`.mobile-bottom-bar`, `#mobTocBtn`, `#seriesTocOverlay`, `#partTocOverlay`);
- theme control discovery теперь видит `[data-fc-action="theme"]` и `.gb-theme-toggle`.

**Верификация:**

```bash
AUDIT_BASE=http://127.0.0.1:8080 npm run interactive-audit
```

Результат на root server:

```text
GB INTERACTIVE AUDIT
Pages: 41 · series: 10 · quizzes: 6 · glossary: 3 · theme: 6 · search: 4 · media: 2
✅ Interactive audit passed
```

---

### BUG-048 · `visual-audit.js` stale `bio-cover-missing` selector fixed; visual audit now passes

**Файл:** `scripts/visual-audit.js`

Исправлен BUG-034: Gill v16 chast-1 больше не обязан иметь legacy `.bio-cover` / `.gbs2-current-cover` / `.gbs2-mobile-head img`. В качестве актуального current marker audit принимает `.gbs-rail-card[aria-current="page"]` / `.gbs-rail-card.is-current`.

**Верификация:**

```bash
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
```

Результат:

```text
Pages audited: 52
Screenshots: 156
After suppression: 0
```

---

### BUG-049 · Nagornaya mobile theme button was visible but not wired; fixed in `site.js`

**Файл:** `js/site.js`

`interactive-audit` после stale-selector фикса оставлял один реальный runtime bug:

```text
mobile-theme-click-did-not-toggle /nagornaya/chast-1/: {"before":false,"after":false}
```

Причина: late theme bridge слушал только `#barThemeBtn`, а мобильная Nagornaya sidebar-кнопка имеет класс `.nag-sidebar-theme-btn`. Визуально кнопка была доступна, но click не переключал `html.dark`.

**Исправление:** late theme bridge теперь слушает:

```js
#barThemeBtn,.nag-sidebar-theme-btn
```

**Верификация:** повторный `interactive-audit` → `✅ Interactive audit passed`.

---

### BUG-050 · axe-core нашёл accessibility backlog на home/about/Gill/Nagornaya

**Инструмент:** `@axe-core/playwright`
**Проверенные URL:** `/`, `/about/`, `/articles/dzhon-gill-chast-1-chelovek/`, `/nagornaya/chast-1/`

Найдены реальные a11y категории:

- `color-contrast` на `/` и других страницах;
- `aria-hidden-focus` у `#selection-share-popup`;
- `aria-allowed-attr` на glossary `<abbr>` / related tooltip markup;
- `nested-interactive` у source marker внутри Gill article;
- `link-in-text-block` на Nagornaya external links.

**Частично исправлено в этой волне:** speed selector buttons in `floating-cluster-controller.js` больше не используют `aria-pressed` вместе с `role="radio"`; оставлен корректный `aria-checked`.

**Статус:** нужен отдельный accessibility lane для оставшихся axe findings.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 7

### NOTE-022 · Browser checks теперь подтверждают, что Gill v16 stale-check слой закрыт

`interactive-audit` и `visual-audit` оба зелёные на root server после обновления селекторов. Это подтверждает, что BUG-033/034 были stale-check проблемами, а не production UI regression.

---

*Итого раунд 7: +4 пункта (BUG-047..050), +1 замечание.*
*Суммарный итог по всем раундам: 50 багов/пунктов · 14 категорий мусора · 22 замечания.*
*Дата: 2026-06-27. Состояние main session after runtime/axe checks.*

---

## 🔴 НОВЫЕ БАГИ / FIXES — раунд 8 (axe a11y cleanup, 2026-06-27)

---

### BUG-051 · `#selection-share-popup` had `aria-hidden` focusable children; fixed with `inert`

**Файл:** `js/site.js`

axe-core находил:

```text
aria-hidden-focus #selection-share-popup
```

Причина: popup создавался с `aria-hidden="true"`, но внутри оставались focusable `button`/`a`. Пока popup скрыт, такие элементы не должны попадать в accessibility tree / tab order.

**Исправление:** popup теперь получает `inert=true` при создании и при hide, и `inert=false` только при показе:

```js
e.inert = true  // hidden
e.inert = false // visible
```

**Верификация:** повторный axe scan `/about/` и Gill part1 больше не сообщает `aria-hidden-focus`.

---

### BUG-052 · Glossary hosts had `aria-expanded`/`aria-describedby` without explicit interactive role; fixed

**Файл:** `js/glossary.js`

axe-core находил `aria-allowed-attr` на glossary hosts (`abbr.gterm`, `.gterm`). Причина: runtime tooltip layer добавлял `aria-expanded`/`aria-describedby`, но часть hosts оставалась без явного `role="button"`.

**Исправление:** glossary runtime post-pass теперь гарантирует для tooltip hosts:

```js
role="button"
tabindex="0"
```

для:

```text
abbr.gterm
.gterm[data-term]
.gterm[aria-expanded]
.gterm[aria-describedby]
```

**Верификация:** повторный axe scan закрыл glossary `aria-allowed-attr` на `/nagornaya/chast-1/`; на Gill part1 массовые glossary findings исчезли. Оставшиеся Gill `aria-allowed-attr` заменились на отдельную структурную проблему `nested-interactive` source markers.

---

### BUG-053 · Remaining axe backlog after cleanup: contrast, nested source markers, link-in-text-block

**Статус:** не исправлено в этой волне; зафиксировано для отдельной accessibility pass.

После исправлений BUG-051/052 остаются:

- `/about/`: `color-contrast` на `cite`;
- `/articles/dzhon-gill-chast-1-chelovek/`: `color-contrast` на Gill cards, `nested-interactive` у source markers;
- `/nagornaya/chast-1/`: `color-contrast` на controls/text, `link-in-text-block` для внешних ссылок.

Это уже не stale-check и не runtime wiring bug, а реальный a11y backlog.

---

*Итого раунд 8: +3 пункта (BUG-051..053).*
*Суммарный итог по всем раундам: 53 багов/пунктов · 14 категорий мусора · 22 замечания.*
*Дата: 2026-06-27. Состояние main session after axe cleanup.*

---

## 🔴 НОВЫЕ БАГИ / FIXES — раунд 9 (workflow lint + SBOM checks, 2026-06-27)

---

### BUG-054 · actionlint strict ShellCheck findings in workflows fixed

**Файлы:** `.github/workflows/indexnow.yml`, `.github/workflows/visual-parity.yml`

Ранее `actionlint` с установленным ShellCheck падал на inline shell:

- `SC2015` в `indexnow.yml`: `A && B || C` не является безопасным if/else;
- `SC2034` в `indexnow.yml`: loop variable looked unused;
- `SC2086` в `indexnow.yml`: unquoted GitHub SHA interpolation;
- `SC2129` в `indexnow.yml` и `visual-parity.yml`: repeated redirects to the same file.

**Исправление:**

- commit metadata step переписан на явный `if ! git diff ...`;
- retry loop использует `_attempt`;
- `github.event.before/after` передаются через `env` and quoted shell vars;
- output writes grouped through `{ ... } >> "$GITHUB_OUTPUT"`;
- visual summary writes grouped through `{ ... } >> "$GITHUB_STEP_SUMMARY"`.

**Верификация:**

```bash
actionlint -color=false .github/workflows/*.yml
```

Результат: `PASS`.

---

## ⚠️ ЗАМЕЧАНИЯ — раунд 9

### NOTE-023 · SBOM generation is clean

`npm sbom --sbom-format cyclonedx --json` produced CycloneDX 1.5 with 476 components. `@cyclonedx/cyclonedx-npm` also generated a JSON SBOM from `package-lock.json` successfully.

### NOTE-024 · Trivy full vulnerability DB scan is not suitable for this Arena session

`trivy fs --scanners vuln,secret,misconfig` failed before scanning because the vulnerability DB download exhausted sandbox disk (`no space left on device`). Scoped `trivy fs --scanners secret,misconfig` completed and found no secret/misconfig issues. Future agents should not retry full Trivy DB scan in Arena unless disk limits change.

### NOTE-025 · oxlint useful advisory, Biome config-first

`oxlint` ran without errors but reported 1094 warnings. `Biome check` emitted 1466 errors / 2855 warnings, mostly formatter/import organization. Use oxlint as advisory; do not add Biome as blocking gate without a project migration/config decision.

---

*Итого раунд 9: +1 fix (BUG-054), +3 замечания.*
*Суммарный итог по всем раундам: 54 багов/пунктов · 14 категорий мусора · 25 замечаний.*
*Дата: 2026-06-27. Состояние main session after workflow lint/SBOM checks.*

---

## 🔴 НОВЫЕ БАГИ / FIXES — раунд 10 (schema rich-results audit, 2026-06-27)

---

### BUG-055 · Schema semantic audit added for Article/Breadcrumb/FAQ regressions

**Файлы:** `scripts/schema-rich-results-audit.js`, `package.json`, `audit/external-checks/run-local-windows-audit.ps1`

Добавлен новый guard, который проверяет не только parse-valid JSON-LD, но и семантические поля rich-results:

- Article / ScholarlyArticle: `headline`, `datePublished`, `dateModified`, `author`, `publisher`, absolute `image` URL;
- BreadcrumbList: `ListItem`, sequential `position`, `name`, absolute `item` URL where required;
- FAQPage: `Question`, `acceptedAnswer`, `Answer.text`;
- known placeholder regression: literal `{jsonLd}`.

**Команды:**

```bash
npm run schema:rich-results:audit
npm run schema:rich-results:audit:dist
```

**Верификация root:**

```text
SCHEMA RICH RESULTS AUDIT (.)
HTML files: 61
JSON-LD blocks: 63
Graphs: 50
Articles: 25
BreadcrumbLists: 41
FAQPages: 4
✅ Schema rich-results audit passed
```

**Статус:** добавлено как постоянная проверка и включено в local Windows runner. Это закрывает риск повторения старых schema-регрессий вроде missing `datePublished`/`dateModified`/`publisher`, broken BreadcrumbList и literal `{jsonLd}`.

---

### NOTE-026 · Local Windows runner now inventories existing `reports/*` artifacts

Скрипт `audit/external-checks/run-local-windows-audit.ps1` теперь отдельно перечисляет локальные отчёты, которые есть у владельца, но не коммитятся:

```text
reports\retire-dist.json
reports\retire-repo.json
reports\semgrep.json
reports\url-contract-dist.json/md
reports\url-contract-draft.json/md
reports\htmlval-*.json
reports\lighthouse-*.json
reports\pa11y-*.json
reports\npm-audit.json
reports\visual-parity
reports\local-audit-*
```

Это позволит присылать локальные результаты и обновлять registry/bug report без хранения сырых report-файлов в git.

---

*Итого раунд 10: +1 guard (BUG-055), +1 замечание.*
*Суммарный итог по всем раундам: 55 багов/пунктов · 14 категорий мусора · 26 замечаний.*
*Дата: 2026-06-27. Состояние main session after schema audit work.*
