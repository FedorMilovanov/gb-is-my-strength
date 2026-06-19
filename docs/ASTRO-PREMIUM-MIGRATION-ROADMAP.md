# Astro Premium Migration Roadmap

Дата: 2026-06-19.

## Главная цель

Перейти на Astro **без потери премиального визуала**. Не «пересобрать страницы заново», не заменить дизайн generic-карточками, а перенести существующие лучшие страницы так, чтобы владелец и читатель видели тот же уровень или лучше.

**Целевой стандарт: 95%+ визуального совпадения legacy → Astro на desktop и mobile.**

## Что больше не считается успехом

- Совпали H1/H2 — это не визуальный перенос.
- Совпали title/description/canonical — это SEO parity, не visual parity.
- Совпал word count — это content parity, не visual parity.
- Страница собрана в Astro, но выглядит как новая заглушка — это 0% визуального переноса.
- Generic `astro-card`, `astro-page`, `astro-card-grid` вместо авторского legacy-дизайна — production regression.

## Production правило

Пока Astro-версия конкретного URL не прошла visual parity:

1. production остаётся на legacy root;
2. Astro route может быть только shadow/pilot/noindex;
3. нельзя менять `page-ownership.json` на `production-dist`;
4. нельзя писать в отчётах «90%+», если не сравнивались скриншоты и DOM-маркеры.

## Обязательные проверки для каждого URL

Перед promotion в production:

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

Нельзя заменять на generic series cards. Обязательны:

- `nagornaya-page`;
- `nagornaya-series-page` для `/nagornaya/seriya/`;
- `h-hero-title`;
- `h-article-card`;
- собственный sidebar/mobile TOC мир.

### Джон Гилл

Нельзя превращать серию в отдельные generic articles. Обязательны:

- `gbs-world`;
- `data-gbs2-series="dzhon-gill"`;
- `gbs2-rail`;
- `gbs2-hero`;
- аккуратная серийная навигация без вылетающих слов.

### Баптисты России

Серия должна выглядеть полной, богатой и удобной, а не как черновой список. Обязательны:

- GBS2 shell;
- понятная карта чтения серии;
- красивый список 10 частей;
- связь с 3D-картой;
- хороший mobile sheet.

### Карты

Карта не считается готовой, если есть:

- наложение labels;
- плохой initial viewport;
- нечитабельные подписи;
- сломанные controls;
- демо-ощущение вместо premium.

На витрине `/karty/` остаются только карты, которые не стыдно показывать. Остальные — holding page до визуального аудита.

## Порядок миграции

1. Сначала стабилизировать legacy production.
2. Снять baseline screenshots ключевых legacy страниц.
3. Выбрать один простой URL-кандидат.
4. Довести Astro-версию до 95% visual parity.
5. Добавить route-specific guard.
6. Только потом включать production ownership для этого одного URL.
7. Повторять постепенно.

## Итог

Astro — не самоцель. Цель — премиальный сайт, который легче поддерживать, но который не теряет визуальную красоту, авторские серии и удобство чтения.
