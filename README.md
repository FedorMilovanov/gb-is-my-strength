# Господь Бог — Сила Моя · gospod-bog.ru

Богословский и редакционный сайт: экзегеза, история церкви, апологетика, переводы, серии и интерактивные библейские карты.

Production публикуется GitHub Pages из **production-like `dist/`**, собранного из Astro 6, MDX/content collections и явно зарегистрированных legacy/special adapters. Корень репозитория не является Pages-артефактом.

## Начать здесь

- ИИ-агент: [`AGENTS.md`](AGENTS.md), затем [`docs/WORK_MODES.md`](docs/WORK_MODES.md) и [`docs/LANE_LOCK_POLICY.md`](docs/LANE_LOCK_POLICY.md).
- Редакционная правда и источники: [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md), [`docs/CONTENT-QUALITY-STANDARD.md`](docs/CONTENT-QUALITY-STANDARD.md).
- Владелецкие инварианты: [`docs/OWNER-INVARIANTS.md`](docs/OWNER-INVARIANTS.md).
- Текущие lanes и recovery: [`docs/refactor-2026/lanes/README.md`](docs/refactor-2026/lanes/README.md), [`docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md`](docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md).
- Каноническая bug-матрица, source/deploy witnesses и глубокие аудиты: [`FedorMilovanov/AuditRepo`](https://github.com/FedorMilovanov/AuditRepo), проект `projects/gb-is-my-strength/`.

Перед исправлением старого отчёта проверяйте текущий `main`, фактический diff и AuditRepo: закрытый PR или удалённая ветка не доказывают ни наличие, ни отсутствие нужного кода.

## Текущая архитектура

### Build и deploy

- **Node:** `>=22.12.0`.
- **Framework:** Astro 6 + MDX/content collections; React используется только внутри изолированных интерактивных приложений, а не как общий клиентский runtime.
- **Production output:** `npm run strangler:build:production-like` → `dist/`.
- **Deploy source of truth:** `.github/workflows/deploy.yml`; Pages получает `dist/` через `actions/upload-pages-artifact`.
- **Runtime:** статический HTML, CSS и vanilla JS; специальные карты/3D-приложения остаются capability adapters.
- **Service Worker/Pagefind:** материализуются и проверяются на `dist`, а не на предположениях о legacy root.

### Route ownership

Публичная поверхность управляется эффективным route registry:

```text
migration/page-ownership.json
+ data/route-profiles/*.json
→ scripts/lib/effective-route-registry.js
→ migration/route-migration-matrix.json (derived projection)
```

`route-migration-matrix.json` не является вторым ручным списком. После изменения ownership/profile:

```bash
node scripts/sync-route-migration-matrix.js --write
npm run migration:metadata:check:strict
```

Текущие постоянные контракты охватывают 75 production routes. Sitemap-контракт требует 66 indexable routes; девять маршрутов имеют явный `profile.seo.indexable=false`. Числа защищены mutation-тестами, но при осознанном добавлении маршрута меняются через registry/policy, а не случайной правкой одного XML-файла.

### Reader engines

Канонические поверхности:

- `series` — включая book-shaped series;
- `article`;
- `page`;
- maps/3D — специальные capability adapters поверх общей инфраструктуры.

Reading progress, active section, completion и resume объединены через ReaderState R6. Не создавайте новый route-local storage/progress engine без отдельного архитектурного решения.

### Source, build и production — разные границы

- **Source truth:** exact `main` commit и его проверенные файлы.
- **Build truth:** exact production-like `dist` и артефакты CI.
- **Production truth:** exact Pages/live witness на том же SHA.

Успешный merge не доказывает деплой. Зелёный workflow на старом head не доказывает новый head.

## Рабочий процесс

Нормальная запись в репозиторий всегда проходит через branch + pull request. Прямой push в `main` запрещён, кроме явно одобренной владельцем аварийной операции с немедленной post-push проверкой и rollback SHA.

```bash
git fetch --all --prune
git checkout -b lane/<bounded-task>-YYYY-MM-DD
```

В PR объявите routes, allowed/forbidden files, source of truth, required checks и rollback point. Перед удалением ветки выполните content-based disposition; уникальные закрытые головы сохраняются в AuditRepo или `archive/forensic-*`, но не сливаются wholesale.

### Быстрый цикл

Выберите проверки по зоне риска:

```bash
git diff --check
npm run data:consistency
npm run content:parity
npm run migration:metadata:check
npm run native:runtime:audit:strict
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
```

### Финальный барьер

Для production/shared/refactor/system PR:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Добавьте текущие route/browser/visual contracts. Все 75 public routes имеют Chromium и Android/WebKit browser coverage; изменение интерактивной геометрии не принимается одним скриншотом или фразой «выглядит нормально».

## Добавление новой статьи или страницы

Не копируйте старый root HTML-шаблон как новую архитектуру. Начинайте от текущего route family и его shared engine.

1. Создайте MDX/content и Astro route/components по существующему каноническому примеру.
2. Добавьте route в `migration/page-ownership.json` и `data/route-profiles/`; материализуйте derived matrix.
3. Задайте SEO/search/RSS membership через `data/route-search-policy.json`, `data/search-manifest.json` и действующие normalizer contracts.
4. Обновите `data/series.json`, если материал входит в серию/книгу.
5. Обновите sitemap projection так, чтобы `sitemap-route-contract-test.js` совпал с registry; не создавайте параллельный список маршрутов.
6. Для RSS используйте deterministic normalizers, а не ручную перестановку XML:

```bash
npm run strangler:build:production-like
node scripts/search-manifest-policy-normalizer.js --dist=dist --promote-rss-articles --write
node scripts/rss-feed-normalizer.js --write
node scripts/rss-feed-normalizer.js --check
```

В same-repository PR доступен label-gated `autofix` job `Search Manifest and RSS autofix`; он может изменять только `feed.xml`, `data/route-search-policy.json` и `data/search-manifest.json`.

7. Подготовьте фактически существующее OG-изображение, обычно 1200×630, с корректными MIME, alt и путями.
8. Запустите source, content, schema, browser и visual contracts для новой поверхности.
9. После merge отдельно подтвердите readiness/Pages/live boundary, если заявляется production.

## Редакционная метаинформация

Технический commit не меняет `dateModified`. Редакционные даты фиксируются как отдельный контракт:

- `data/editorial-metadata.json` — committed freeze;
- `scripts/editorial-metadata-freeze-audit.js` — проверка текущих projections против committed freeze;
- observation refresh — отдельный артефакт, не автоматическое принятие новых дат.

Нельзя «сделать зелёным» metadata drift простым перегенерированием baseline. Сначала определить, была ли реальная редакционная правка, технический шум или несогласованная проекция.

## Авторство и цитаты

- Тип A/B: **Автор-редактор: Фёдор Милованов**.
- Перевод: оригинальный автор сохраняется автором, Фёдор Милованов — **Редактор**/translator согласно route contract.
- Формулировка «Автор: Фёдор Милованов» как универсальный byline запрещена.
- Цитаты Писания — дословно по заявленному изданию; пересказ нельзя маркировать как прямую цитату.
- Цитаты, числовые заявления, квизы и «Коротко» должны быть подтверждены текстом или конкретным источником.
- CSS/JS/CI правка не является причиной менять редакционные даты.

Подробности и owner-only решения — в `docs/OWNER-INVARIANTS.md` и `AGENTS.md`.

## Search, sitemap, RSS и IndexNow

- `data/route-search-policy.json` задаёт явную membership policy.
- `data/search-manifest.json`, `feed.xml` и `sitemap.xml` — проверяемые projections, не независимые источники истины.
- `scripts/search-index-policy-inventory.js`, sitemap/RSS/search contracts и route registry не допускают незарегистрированные или дублированные URL.
- `.github/workflows/indexnow.yml` уведомляет поисковики об изменённых production URL после `main`; он не заменяет Pages/live verification.
- Секрет `INDEXNOW_KEY` хранится только в GitHub Actions secrets; key-файл создаётся в Pages artifact, а не коммитится.

## Legacy root и recovery

Корневые HTML могут быть:

- действующим source для явно зарегистрированного legacy-shadow route;
- committed shadow/contract fixture;
- historical dead duplicate уже Astro-owned маршрута.

Не объявляйте весь root rollback-слоем. Перед правкой или удалением проверьте `page-ownership`, route profile, copy/build scripts и current `dist`. Dead duplicate не восстанавливается только потому, что он старше Astro source.

Удалённые/закрытые ветки также проверяются по фактическому содержимому. Текущий forensic register находится в AuditRepo issue #40 и source audit index.

## Основные команды

```bash
npm ci
npm run astro:check
npm run strangler:build:production-like
npm run validate:static-publication
npm run guard:shared-files
npm run control-plane:audit
npm run workflows:policy
npm run migration:metadata:check:strict
npm run engine:guard
npm run visual:parity:production
```

Внешние инструменты и environment assumptions описаны в `audit/external-checks/README.md` и `docs/SANDBOX-ENV-2026-06-21.md`. Сначала определяйте capability текущей сессии; не считайте root, сеть, browser binaries или filesystem persistence гарантированными.

## История

Подробная история refactor/audit решений остаётся в Git и [`AUDIT_HISTORY.md`](AUDIT_HISTORY.md). Предыдущий большой README v11 от 2026-07-04 сохранён в immutable blob `305b2d83380999b888a1809dae2a3231531389ea`; он содержал полезные исторические шаблоны, но его shadow-wrap counts, direct-main command и ручные SEO/feed инструкции больше не являются текущим процессом.
