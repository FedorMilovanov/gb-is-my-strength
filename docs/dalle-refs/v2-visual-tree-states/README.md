# v2 — детальные состояния DALL-E (visual states exploration)

**Дата:** 2026-06-20 (вторая итерация, после архитектурного исследования)  
**Источник:** DALL-E Image generation  
**Назначение:** визуальные состояния для каждого UI-state GenealogyTree

---

## ⚠️ Главный дисклеймер

**Эти 9 PNG — DALL-E, не библия.**  
- **Семантика часто ошибочна:** DALL-E путает связи, имена, хронологию.
- **Скрин #3 — ОБРАЗЕЦ ОШИБОК**: красные подсветки показывают, что НЕ делать.
- **Скрин #6 содержит "безымянную жену"** — нужно сверить с Быт 29-30, 35.

**НЕ копировать буквально. Использовать как layout inspiration. Проверять данные против `data/genealogy/genealogy.json`.**

---

## Файлы (по визуальным состояниям)

| Файл | Состояние | Что полезного |
|---|---|---|
| `01-full-messianic-tree-adam-to-jesus.png` | **Overview** | Общая композиция: sidebar + canvas + minimap + detail panel. Era icons слева, search/filters сверху, quick links снизу. Это ОБЩАЯ структура всей страницы. |
| `02-filtered-view-side-branches.png` | **Filtered view** | Messianic в центре яркий, боковые ветви (messengers от Ноя, cain, haran) приглушены. Полезно для **semantic zoom + filter buttons**. |
| `03-bug-overlay-visual-errors.png` | ⚠️ **ANTI-PATTERNS** | **КРАСНЫЕ подсветки показывают ошибки:** наложения текста, нечитаемые места, broken layout. **ОБРАЗЕЦ того, как НЕ делать.** Соблюдать label collision, accessibility, contrast. |
| `04-patriarchal-close-up-abraham.png` | **Close zoom Авраам** | Авраам в центре, Сарра, Агарь, Исаак, Измаил, Ревекка, Иаков, Исав, Лия, Рахиль. Tour mode с шагами 3 из 8. Это **zoom level 3 — детальный вид**. |
| `05-post-christ-and-early-church.png` | **Post-Christ tradition** | Отдельный слой: Мария, Иосиф (обручник), Иаков (брат Господень), Симеон. **НЕ "потомки Христа"** — это раннецерковная традиция, помеченная пунктиром. |
| `06-unnamed-wife-7-kids-detail.png` | ⚠️ **Detail panel** | Безымянная жена в центре с 7 детьми. В DALL-E это часто = Лия или Зилфа (Быт 29-30). **НЕ ДОВЕРЯТЬ именам.** Использовать только как layout для detail panel. |
| `07-split-view-matthew-luke-comparison.png` | **Split View** | Две колонки: Матфей 1 (purple) и Лука 3 (teal), с общим внизу. Поколения указаны с `+X поколений` для пропусков. Это наш `SplitView.tsx` целевой дизайн. |
| `08-filtered-with-thamar-highlighted.png` | **Focus on Thamar** | Мессианская линия с подсвеченной Фамарь (Thamar) — важный узел в родословной (Быт 38, Мф 1:3). Демонстрирует **focus lineage mode**. |
| `09-levites-priests-service-tree.png` | **Service lists** | Левий → Гирсон/Кааф/Мерари; Аарон → священники. **НЕ обычная связь отец→сын**, а **служебные списки** (1 Пар 23-26). Демонстрирует **canonical-list layer**. |

---

## Как использовать в реализации

### Архитектурные слои (по research doc 2.0)

| Скрин | Реализация в `src/components/genealogy/` |
|---|---|
| 01 (overview) | `GenealogyPageShell.tsx` + `GenealogyCanvas.tsx` + `GenealogySidebar.tsx` + `GenealogyMinimapPanel.tsx` |
| 02, 08 (filtered/focus) | `GenealogyFilters.tsx` + `computeFocusLineage()` в layout.ts |
| 03 (⚠️ bugs) | **anti-pattern reference** — соблюдать label collision, accessibility |
| 04 (close zoom Abraham) | semantic zoom + tour mode (`GenealogyTourPanel.tsx`) |
| 05 (post-Christ) | отдельный `GenealogySourceLayer = 'early-church-tradition'` слой |
| 06 (detail panel) | `PersonDetailPanel.tsx` |
| 07 (split view) | `SplitView.tsx` (уже существует) |
| 09 (service lists) | `RelationshipType = 'list-member' \| 'service'` |

### Эстетические принципы

✅ **Цветовая палитра:**
- Messianic line: старое золото `#d4a857`/`#c4a04a`
- Matthew 1: царский пурпур `#8b6b9c`-like
- Luke 3: teal `#4a80b4`-like
- Cainite: приглушённая ржавчина
- Боковые ветви: тёплый серо-коричневый

✅ **Типы связей:**
- Сплошная: отец→сын (каноническая)
- Пунктир: служебные списки
- Двойная: spouse
- Жирная золотая: golden path (Авраам→Христос)
- Янтарная с `?`: спорные позиции

✅ **Icons:** 🦅 (Женевская традиция), 👑 (царь), ⛪ (священник), ⚔️ (воин), 👑 (Иисус)

✅ **UI states** (обязательные из research doc):
- overview (zoom 0)
- medium (zoom 1)
- close (zoom 2 — Abraham)
- detail (zoom 3 — одна персона)
- filtered
- focused (highlight lineage)
- split (Matthew vs Luke)
- tour
- disputed (отдельный янтарный стиль)

---

## Что НЕ делать (антипаттерны из #3)

❌ Наложения подписей (label collision)  
❌ Обрезанный текст  
❌ Недостаточный контраст  
❌ Сломанная композиция (элементы вылазят за viewport)  
❌ Неясные связи (кто чей родич)  
❌ Лишние/недостающие узлы  
❌ Статичный только-desktop дизайн  

---

## Сверка данных с реальной Библией

DALL-E не знает канонические списки. Нужно сверять:
- Быт 5 (Адам → Ной)
- Быт 10 (таблица народов)
- Быт 11 (Сим → Авраам)
- Быт 22, 25, 36, 46 (ветви Авраама/Измаила/Исава)
- 1 Пар 1-9 (большой корпус)
- Мф 1 (через Соломона, 14/14/14)
- Лк 3 (через Нафана/Марию)

В нашей реализации источник истины — `data/genealogy/genealogy.json` (156 персон).

---

## См. также

- [`../README.md`](../README.md) — главный дисклеймер и общая структура
- [`../GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md`](../GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md) — полное ТЗ 2.0
- [`../../rodosloviye/`](../../rodosloviye/) — legacy HTML (до Astro)
- [`../../src/components/genealogy/`](../../src/components/genealogy/) — текущие React Flow компоненты
