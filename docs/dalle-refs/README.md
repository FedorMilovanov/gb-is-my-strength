# DALL-E Reference Images — genealogy tree visual targets

**Дата:** 2026-06-20  
**Автор:** владелец проекта (Fedor Milovanov)  
**Назначение:** визуальные ориентиры для интерактивного древа родословий на `/rodosloviye/`  
**Архитектурный план:** см. [`GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md`](./GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md) (1478 строк) — полное ТЗ для будущих агентов

---

## ⚠️ Главный дисклеймер: это DALL-E, не библия

**Все 16 PNG-файлов в этой папке сгенерированы DALL-E**, а не взяты из канонических источников. Используйте их ТОЛЬКО как **визуальные ориентиры для общего стиля и композиции**. НЕ КОПИРУЙТЕ буквально.

### Известные проблемы DALL-E референсов

| Тип проблемы | Примеры из этих скринов |
|---|---|
| **Семантические ошибки** | Связи между людьми часто нарисованы неправильно (кто чей родич). На скриншоте `v2-visual-tree-states/03-bug-overlay-visual-errors.png` владелец явно отметил красным области с ошибками. |
| **Библиографические ошибки** | Матфей 1 vs Лука 3: DALL-E часто путает порядок и наличие имён. Нужно сверять с каноническими списками Быт 5/10/11/22/25/36/46, 1 Пар 1-9, Мф 1, Лк 3. |
| **Неполные данные** | На скрине `v2-visual-tree-states/06-unnamed-wife-7-kids-detail.png` DALL-E показал "безымянную жену" с 7 детьми — это может быть Лия или Зилфа. Точное имя нужно сверять с данными. |
| **Эстетические ошибки** | Скрин `03-bug-overlay-visual-errors.png` показывает красные области — это ОШИБКИ DALL-E (наложения текста, нечитаемые места, broken layout). |
| **Лишние/недостающие имена** | DALL-E может придумать имена которых нет в Библии, или пропустить важные. Проверять против `data/genealogy/genealogy.json`. |

### Что делать с этими скринами

✅ **МОЖНО и НУЖНО:**
- Скриншоты как inspiration для цветовой палитры (cream/beige + gold #d4a857/#c4a04a)
- Структура sidebar слева (era icons)
- Minimap справа (mini overview)
- Detail panel справа (для выбранной персоны)
- "VS." comparison view в центре (Матфей vs Лука)
- Боковые ветви (Cain, Ham) как приглушённый контекст
- Multiple visual states (overview, focused, split, post-Christ)

❌ **НЕЛЬЗЯ:**
- Буквально копировать макет/цвета/sizes
- Использовать имена/связи/хронологию которые видите на скрине без проверки
- Делать вид что это библия — DALL-E иногда ошибается в родословных
- Копировать мелкие баги DALL-E (наложения, обрезанный текст) — это НЕ образец

### Ключевая формула

> **Данные сохранять, визуальные оболочки и движки пересобирать модульно.**
>
> Визуально стремиться к стилю референсов, но НЕ КОПИРОВАТЬ детали.  
> Богословски — проверять против канонических источников.

---

## Структура папки

```
docs/dalle-refs/
├── README.md                                       ← этот файл
├── GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md  ← полное ТЗ
├── v1-visual-tree-detail/                          ← ранние референсы (7 файлов)
│   ├── README.md
│   ├── v1-messianic-tree-detail-3.png
│   ├── v1-messianic-tree-detail-4.png
│   ├── v1-messianic-tree-detail-5.png
│   ├── v1-messianic-tree-detail-6.png
│   ├── v1-messianic-tree-detail-7.png
│   ├── v1-messianic-tree-detail-8.png
│   └── v1-messianic-tree-detail-9.png
└── v2-visual-tree-states/                          ← новые референсы состояний (9 файлов)
    ├── README.md
    ├── 01-full-messianic-tree-adam-to-jesus.png    ← общий вид
    ├── 02-filtered-view-side-branches.png         ← фильтрованный вид с боковыми ветвями
    ├── 03-bug-overlay-visual-errors.png           ← ⚠️ ОБРАЗЕЦ ОШИБОК — красные подсветки
    ├── 04-patriarchal-close-up-abraham.png         ← близкий zoom Авраам
    ├── 05-post-christ-and-early-church.png         ← отдельный слой традиции
    ├── 06-unnamed-wife-7-kids-detail.png          ← ⚠️ БЕЗЫМЯННАЯ жена — проверить!
    ├── 07-split-view-matthew-luke-comparison.png   ← Split View Матфей vs Лука
    ├── 08-filtered-with-thamar-highlighted.png     ← фильтр с подсветкой Фамарь
    └── 09-levites-priests-service-tree.png        ← левиты и служения
```

---

## Где использовать как reference

| Что в референсе | Где это нужно в проекте | Файл |
|---|---|---|
| Общая композиция (sidebar + canvas + minimap + detail) | `/rodosloviye/` общий layout | `v2/01` |
| Цветовая палитра (cream/beige + gold) | `src/components/genealogy/theme.ts` | `v1/*`, `v2/01` |
| Era sidebar слева | `src/components/genealogy/GenealogySidebar.tsx` | `v2/01` |
| Minimap справа | уже есть ReactFlow MiniMap | `v1/*`, `v2/01` |
| Detail panel справа | `src/components/genealogy/PersonDetailPanel.tsx` | `v1/7`, `v2/04` |
| Filtered view (боковые приглушены) | semantic zoom + filter buttons | `v2/02`, `v2/08` |
| Split view Матфей vs Лука | `src/components/genealogy/SplitView.tsx` | `v2/07` |
| Patriarchal close-up (Abraham zoom) | zoom level 3 — детали Авраама | `v2/04` |
| Post-Christ / раннецерковная традиция | отдельный слой (НЕ "потомки Христа") | `v2/05` |
| Levites / priests / services | сервисные списки (НЕ обычные связи) | `v2/09` |
| Ошибки DALL-E (красные подсветки) | антипаттерны — что НЕ делать | `v2/03` |

---

## Ошибки DALL-E которых надо избегать

Скрин `v2-visual-tree-states/03-bug-overlay-visual-errors.png` — **ОБРАЗЕЦ того, как НЕ делать**. Видны красные области, обозначающие:
- Наложения подписей
- Нечитаемые места
- Обрезанный текст
- Плохая контрастность
- Перекрытие элементов

В нашей реализации:
- ✅ Использовать `aria-label`, `role`, `tabindex` для accessibility
- ✅ Делать label collision detection
- ✅ Тестировать на mobile + desktop
- ✅ Соблюдать минимальный размер hit area (44x44 для touch)
- ✅ Соблюдать WCAG контраст (4.5:1 для текста)

---

## Что мы делаем ЕЩЁ ЛУЧШЕ чем DALL-E

DALL-E — это inspiration, не spec. Наша цель — **превзойти** референсы по:
- **Точности данных** — реальные библейские родословия из `data/genealogy/genealogy.json`
- **Интерактивности** — реальный React Flow с клавиатурной навигацией, semantic zoom, фокусом
- **Accessibility** — WCAG 2.1 AA, screen reader support, keyboard-only
- **Performance** — virtualization, lazy loading, нет 60fps jank
- **Богословской честности** — спорные места помечены, после Христа отделено от канона
- **Data model 2.0** — полная база с группами, списками, служениями (не просто lineage="messianic")

Если референс DALL-E показывает красивую композицию — мы берём **layout pattern**, но проверяем **каждое имя и связь** против канона.

---

## См. также

- [`GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md`](./GBS_INTERACTIVE_ARCHITECTURE_RESEARCH_2_0_2026-06-20.md) — полное ТЗ 2.0 (1478 строк)
- [`/rodosloviye/` на dist](https://gospod-bog.ru/rodosloviye/) — текущая реализация
- [`src/components/genealogy/`](../../src/components/genealogy/) — исходники компонентов
