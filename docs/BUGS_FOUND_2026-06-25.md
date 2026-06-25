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
