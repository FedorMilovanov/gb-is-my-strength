# Подготовка к будущей платформе: безопасный санитарный этап

> Дата: 2026-06-14  
> Задача: перед возможным переходом на новую платформу не потерять контент, URL, источники, SEO и интерактивные инварианты; сначала закрыть безопасные предупреждения и зафиксировать baseline.

## 1. Найден ли план «новой платформы»

### Первичный проход

Сначала были проверены текущие файлы и полная git-история (после `git fetch --unshallow`, 972 коммита) по ключам:
`platform`, `migration`, `refactor`, `roadmap`, `Astro`, `Next.js`, `MDX`, `CMS`, `платформа`, `миграция`, `переезд`, `рефактор`.

На тот момент явного site-wide плана Astro/Next/new-platform в дереве не было найдено; были найдены только GBS/map-планы:

1. **Удалённый исторический `_agent-handoff/ROADMAP.md`** — план Фазы 2 GBS/серий и общесайтового UI.
2. **`docs/MAPS-ARCHITECTURE.md`** — архитектура раздела карт: одна базовая карта + маршруты как данные.
3. **`docs/MAPS-RD-MASTERPLAN-2026.md`** — живой мастер-план карт: `route.json`, `_engine/map-engine.js`, `base-geo.svg`, story-state extraction, будущие карты (`ishod`, `pavel`), ограничения и QA.

### Обновление после push другого агента

После коммита `8d39ccd docs: add 2026 refactor audit handoff` план найден: новая папка

```text
docs/refactor-2026/
```

содержит полноценный набор документов по миграции. Ключевые документы:

- `REFACTOR_RESEARCH_INDEX_2026.md` — индекс всех исследований;
- `ASTRO_STACK_DECISION_RECORD_2026.md` — ADR: целевой стек **Astro + React islands + MDX/content collections**;
- `AGENT_HANDOFF_NO_REFACTOR_2026.md` — прямо запрещает runtime-рефакторинг без отдельного решения владельца;
- `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md` — профессиональная последовательность PR;
- `ASTRO_MIGRATION_PHASE_PLAN_2026.md` — фазы миграции;
- `TECHNICAL_MIGRATION_RUNBOOK_2026.md` — strangler-style runbook;
- `QUALITY_GATES_AND_TESTING_2026.md`, `URL_CONTRACT_2026.md`, `MIGRATION_RISK_LEVELS_AND_GATES_2026.md`.

Вывод обновлён: готовиться нужно к **Astro + React islands** миграции, но первый безопасный шаг остаётся не Astro install, а контрактные scripts/baseline. Runtime/deploy/URL/HTML пока не трогать.

## 2. Что безопасно сделано в этом проходе

### 2.1 Public preview pages убраны из публичного корня без потери материала

Файлы:
- `karty-preview.html`
- `konfessii-preview.html`

были root-level preview-дубликатами реальных разделов `/karty/` и `/konfessii/`, нигде не были связаны и давали sitemap/JSON-LD warnings.

Решение: не удалять, а перенести в архив прототипов:

```text
_build-tools/preview-archive/karty-preview.html
_build-tools/preview-archive/konfessii-preview.html
```

`_build-tools` теперь исключён из `audit-pro` как build/prototype area; это не публичные страницы.

### 2.2 `/karty/ishod/` добавлен в sitemap

`karty/ishod/index.html` — indexable scaffold второй карты. Он теперь есть в `sitemap.xml`:

```xml
https://gospod-bog.ru/karty/ishod/
```

с priority `0.45` и OG-картой раздела карт.

### 2.3 SEO description `/karty/` укорочен

Предупреждение `description length 199 chars` закрыто безопасным сокращением.

### 2.4 Ложный warning `${p.thumb||p.src}` закрыт в аудите

`audit-pro` теперь игнорирует template placeholders вида `${...}` в `href/src`, потому это runtime template literal, а не реальная ссылка.

### 2.5 Сжат тяжёлый исторический JPEG

Файл:

```text
images/konfessii/russkij-baptizm/photos/old-tbilisi-kura-xix.jpg
```

сжат:

```text
5000×3632 / 1.85 MB  →  1800×1308 / 266 KB
```

Это закрывает image-size guard без удаления источника.

### 2.6 Добавлен baseline публичного контента

Новые файлы:

```text
scripts/check-public-content-baseline.js
data/public-content-baseline.json
```

Новые npm scripts:

```json
"content:guard": "node scripts/check-public-content-baseline.js",
"content:baseline": "node scripts/check-public-content-baseline.js --write"
```

`content:guard` включён в:

```text
npm run validate:static-publication
```

Baseline фиксирует 42 публичные indexable страницы:
- file
- canonical URL
- title
- H1
- visible word count

Новые страницы разрешены. Потеря baseline URL или сильное падение word-count (ниже 72% для страниц от 80 слов) — blocker.

Это главный migration-safety guard: при новой платформе прогнать build-output и убедиться, что URL/контент не потерялись.

## 3. Исторический аудит удалённых материалов

### 3.1 Метод

- Полная история: 972 коммита.
- Собран список deleted content-like files: `.html`, `.md`, `.txt`, `.json`.
- Найдено 96 удалённых записей.
- Большинство — audit reports, ZIP artifacts, pagefind, старые README/changelog.

### 3.2 Реальные кандидаты и итог

| Удалённый файл | Состояние |
|---|---|
| `articles/dzhon-gill-1697-1771/index.html` | Старый единый Gill-материал: ~20 963 слова. Сейчас серия Gill из 5 страниц: ~27 967 слов. История уже содержит фикс `4cdbd3dd RESTORE 16,498 words`; текущий контент не выглядит потерянным, а расширен/разнесён. |
| `_agent-handoff/ROADMAP.md` | Не новая платформа; GBS/серии. Прочитан полностью. Ключевые решения перенесены в AGENTS/GBS-доки; восстанавливать как рабочую папку не нужно. |
| `_agent-handoff/README.md` | Координационный handoff GBS, закрыт в r107. Смысл перенесён в `docs/GBS-PATTERN.md` и AGENTS. |
| `GILL_DEEP_AUDIT_PLAN_2026-06-01.md` | Старый план аудита Гилла; ключевые решения уже зафиксированы в AGENTS §9.17–9.20. |
| `baptisty-rossii/research/raw-sources/batchenko-nkvd-normative-acts-1929-1930.html` | HTML-raw заменён текущим `.txt` (120 KB, ~7319 слов). Материал сохранён. |
| `baptisty-rossii/research/raw-sources/istmat-1919-decree-raw.html` | HTML-raw заменён текущим `istmat-1919-decree.txt` (~383 слова). Материал сохранён. |

### 3.3 Вывод

На этом проходе явной неперенесённой потери содержательного текста не найдено. Самый опасный исторический инцидент — удаление Gill-текста — уже был обнаружен и восстановлен ранее; теперь дополнительно есть baseline guard.

## 4. Оставшиеся warnings после санитарного этапа

`npm run validate:static-publication` сейчас проходит с 0 errors и 3 warnings:

1. **CSS total 421 KB > 390 KB**  
   Причина: общий budget включает 5 CSS + `fonts/fonts.css` + `nagornaya/tw.min.css`. Это не один мусорный блок, а накопленная архитектура + Tailwind Нагорной.

2. **`site.css` 214 `!important`, цель 200**  
   Большая часть оставшихся `!important` — tooltip/mobile/print/GBS/summary-card hardening, то есть зоны с реальными историческими регрессиями. Удалять ради цифры нельзя; нужно отдельной фазой с браузерной проверкой.

3. **`karty/avraam/index.html` inline script 2033 LOC**  
   Это не «мусор», а текущий inline runtime карты Авраама. План карт уже говорит: выносить постепенно в `_engine/map-engine.js`, не копипастить `avraam/index.html`. Следующий безопасный шаг — подключение `ishod/index.html` к engine и продолжение extraction.

## 5. Что делать перед новой платформой

### Делать сейчас

- Держать `validate:static-publication`, `konfessii:audit`, `avraam:audit`, `content:guard` зелёными.
- Сохранять URL и canonical 1-в-1.
- Расширять structured data/route.json/series.json как источники истины.
- Все новые статьи/серии делать так, чтобы их можно было мигрировать в structured content (frontmatter + body + sources + quiz + assets).
- Для карт продолжать extraction в `_engine` согласно `MAPS-RD-MASTERPLAN-2026.md`.

### Не делать сейчас

- Не переписывать `site.css` целиком ради budget warning.
- Не удалять `!important` в tooltip/mobile/summary/GBS без визуального QA.
- Не переносить карту Авраама большим рывком — только engine extraction малыми шагами.
- Не считать текущие guards «устаревшими» при новой платформе: они должны проверять **собранный HTML output** новой платформы.

## 6. Как использовать guards при переезде

Новая платформа может быть любой, но после build она должна дать публичный output. К нему нужно применить:

```bash
npm run validate:static-publication
npm run konfessii:audit
npm run interactive-audit
```

Если структура репозитория изменится, сами guard-скрипты можно адаптировать к папке output (`dist/`, `.output/public`, etc.), но логика остаётся актуальной:

- URL не исчезли;
- canonical совпадает;
- word-count не просел;
- sitemap/feed согласованы;
- noindex не появился случайно;
- изображения и источники существуют;
- 3D-карта и карта Авраама не регрессировали;
- GBS/серии не потеряли навигацию и прогресс.

## 7. Следующие безопасные шаги

1. Сделать отдельный CSS-audit с реальным browser QA: искать только группы правил, где доказан `hosts=0` и нет runtime class usage.
2. Разобрать `site.css` budget по компонентам (не только общий размер): GBS, glossary, summary-card, home, legacy article blocks.
3. Для карт: продолжать `MapEngine` extraction — это одновременно снижает inline JS warning и готовит новую платформу.
4. Для контента: добавить migration-friendly metadata для новых статей (slug, title, section, series, published, modified, readingTime, sources, quiz id).
5. После выбора новой платформы создать отдельный `docs/PLATFORM-MIGRATION-PLAN.md` с точным стеком, output directory, URL parity checklist и rollback plan.
