# Astro Premium Migration Roadmap

> **Статус: HISTORICAL / PROVENANCE-ONLY.** Это roadmap миграционной фазы от 2026-06-19, а не текущая route-ownership или production policy. Его устойчивый owner-смысл — не ухудшать визуальный уровень и не объявлять visual parity без визуального доказательства — сохраняется через `docs/OWNER-INVARIANTS.md` и `docs/REFERENCE_TRANSFER_POLICY.md`. Старые правила ниже про `legacy root`, `shadow/pilot`, универсальный 95% threshold и конкретные promotion steps не применяются автоматически к current Astro-owned routes.

Дата: 2026-06-19.

## Главная цель

Перейти на Astro **без потери премиального визуала**. Не «пересобрать страницы заново», не заменить дизайн generic-карточками, а перенести существующие лучшие страницы так, чтобы владелец и читатель видели тот же уровень или лучше.

**Целевой стандарт той миграционной фазы: 95%+ визуального совпадения legacy → Astro на desktop и mobile.**

## Что больше не считалось успехом в этой миграционной фазе

- Совпали H1/H2 — это не визуальный перенос.
- Совпали title/description/canonical — это SEO parity, не visual parity.
- Совпал word count — это content parity, не visual parity.
- Страница собрана в Astro, но выглядит как новая заглушка — это 0% визуального переноса.
- Generic `astro-card`, `astro-page`, `astro-card-grid` вместо авторского legacy-дизайна — production regression.

## Historical production rule

На момент этого roadmap, пока Astro-версия конкретного URL не прошла visual parity:

1. production оставался на legacy root;
2. Astro route мог быть только shadow/pilot/noindex;
3. нельзя было менять `page-ownership.json` на `production-dist`;
4. нельзя было писать в отчётах «90%+», если не сравнивались скриншоты и DOM-маркеры.

Эти пункты фиксируют прежний transition state. Текущий render owner определяется текущими route registries/source contracts, а reference-transfer режим — `docs/REFERENCE_TRANSFER_POLICY.md`.

## Обязательные проверки для каждого URL в той фазе

Перед promotion в production требовались:

- screenshot legacy vs Astro desktop;
- screenshot legacy vs Astro mobile;
- owner review первого экрана;
- проверка обязательных DOM/CSS-маркеров;
- отсутствие generic Astro markers там, где должен быть premium layout;
- проверка переполнений текста, длинных слов, карточек и mobile rhythm;
- проверка, что на landing/home не появляются article-only widgets: TTS, bottom TOC, article end actions.

## Особо охраняемые страницы

### Главная `/`

Цель — удобная библиотека и топовая мобильная версия «как приложение», но без колхозных лишних блоков. Любой новый входной блок должен быть:

- нативно встроен в ритм главной;
- красив на desktop;
- ещё лучше на mobile;
- не превращать главную в портянку;
- не повторять уже существующие навигационные элементы.

Rejected example: грубый отдельный блок «Основные входы».

### Нагорная

Исторический migration contract запрещал заменять её на generic series cards. В roadmap были обязательны:

- `nagornaya-page`;
- `nagornaya-series-page` для `/nagornaya/seriya/`;
- `h-hero-title`;
- `h-article-card`;
- собственный sidebar/mobile TOC мир.

Current applicability этих конкретных markers проверяется по текущему route/source owner, а не по этому snapshot.

### Джон Гилл

Roadmap запрещал превращать серию в отдельные generic articles и фиксировал тогдашние markers:

- `gbs-world`;
- `data-gbs2-series="dzhon-gill"`;
- `gbs2-rail`;
- `gbs2-hero`;
- аккуратная серийная навигация без вылетающих слов.

Current owner-sensitive Gill semantics сохраняются, но конкретная реализация проверяется по текущим source/contracts.

### Баптисты России

Серия должна выглядеть полной, богатой и удобной, а не как черновой список. Roadmap требовал:

- GBS2 shell;
- понятную карту чтения серии;
- красивый список 10 частей;
- связь с 3D-картой;
- хороший mobile sheet.

Конкретные counts/engine markers этого snapshot не являются вечным SSOT.

### Карты

Карта не считалась готовой, если были:

- наложение labels;
- плохой initial viewport;
- нечитабельные подписи;
- сломанные controls;
- демо-ощущение вместо premium.

На витрине `/karty/` должны были оставаться только карты, которые не стыдно показывать; остальные — holding page до визуального аудита. Текущий publication status определяется current route/data contracts.

## Historical migration sequence

Roadmap предписывал:

1. стабилизировать legacy production;
2. снять baseline screenshots ключевых legacy страниц;
3. выбрать один простой URL-кандидат;
4. довести Astro-версию до 95% visual parity;
5. добавить route-specific guard;
6. только потом включать production ownership для этого одного URL;
7. повторять постепенно.

Этот sequence завершён как универсальная transition policy и сохраняется только как история миграции.

## Итог

Устойчивый принцип остаётся: Astro — не самоцель; цель — премиальный сайт, который легче поддерживать и который не теряет визуальную красоту, авторские серии и удобство чтения. Текущие средства доказательства этого принципа задают current owner/source/reference-transfer contracts, а не этот dated roadmap.
