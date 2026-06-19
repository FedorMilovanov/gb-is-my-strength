# Genealogy Department — Architecture & Features (2026-06-19)

> `/rodosloviye/` — интерактивное генеалогическое древо от Адама до Христа.
> Стек: Astro island (client:load) + React Flow 12 + dagre + TypeScript.
> Стиль: пергаментно-золотой premium, dark theme.

## Модули (8 файлов, ~1300 строк)

```
src/components/genealogy/
├── types.ts          (143) — strict TypeScript: Person, Era, Disputed, Chronology
├── theme.ts          (72)  — палитра линий, эпохи, константы, правила zoom
├── layout.ts         (153) — dagre layout + golden path + AM-хронологическая ось
├── PersonNode.tsx    (131) — memoized custom node (life-bars, era stripes)
├── DetailPanel.tsx   (146) — slide-in sidebar (хронология, спорные места)
├── TimelineAxis.tsx  (99)  — вертикальная AM-шкала с эпохами и вехами
├── SplitView.tsx     (182) — сравнение родословий Мф/Лк side-by-side
└── GenealogyTree.tsx (555) — оркестратор: state, zoom, search, tour, keyboard
```

## Данные

`data/genealogy/genealogy.json` — 156 персон, 8 эпох, 3 спорных апологетических узла:
- **Каинан Лк 3:36** (textual: копистская ошибка vs намеренный пропуск)
- **Иехоний** (theological: проклятие Иер 22:30 снято в Агг 2:23)
- **Иосиф/Мария** (genealogical: Лк = линия Марии через Илию vs Levirate)

Покрытие: Быт 4 (Каинова), Быт 5 (хроногенеалогия), Быт 10 (таблица народов),
Быт 11 (Сим→Авраам), патриархи, 12 колен, Левий→Моисей, Иуда→Давид (Руфь 4),
Давидовы цари, полный Мф 1 + Лк 3, обе линии ко Христу.

Целостность: 0 orphan parent references, children arrays синхронны.

## Фичи

| # | Фича | Описание |
|---|---|---|
| 1 | **Семантический зум 3 уровня** | zoom<0.3: golden path skeleton (Адам, Ной, Авраам, Давид, Христос); 0.3–0.7: патриархи/цари/пророки; ≥0.7: все 156 персон |
| 2 | **Золотая мессианская нить** | toggle: трассирует Христос→Мария→...→Адам (77 шагов), золотые анимированные рёбра |
| 3 | **Панель деталей** | клик по персоне → sidebar: имя (ru/he), эпоха, роль, хронология MT, значение, спорные callouts, Писание |
| 4 | **Timeline AM-ось** | вертикальная шкала слева с 7 вехами (Сотворение AM 0 → Христос AM 4000) и era-полосами |
| 5 | **Life bars** | полоса ∝ lifespan (max=969 Мафусал) — драматический спад после Потопа виден сразу |
| 6 | **Поиск с центрированием** | fuzzy search → setCenter на найденном человеке (600ms анимация) |
| 7 | **Split-view Мф/Лк** | side-by-side сравнение двух родословий Христа, общие имена (≡), спорные (⚠) |
| 8 | **Guided tour** | «🎬 Тур»: проводит по 77 шагам золотой нити от Адама до Христа |
| 9 | **Keyboard navigation** | стрелки: Up=родитель, Down=первый ребёнок, Left/Right=братья, Enter=детали, Esc=выход |
| 10 | **Фильтр по линиям** | Все / Мессианская / Каинова / Прочие |
| 11 | **MiniMap** | цветная по линиям, pannable, zoomable |
| 12 | **Era legend** | 8 эпох с цветовыми метками |

## a11y

- `role="toolbar"`, `role="complementary"` на контейнерах
- `aria-pressed`, `aria-label` на всех кнопках
- Keyboard navigation (arrow keys, Enter, Escape)
- `prefers-reduced-motion` совместимость (через CSS animations)
- sr-only H1 на странице

## Источники

TMS Journal 18:1 (Mortenson 2007), Sarfati «Biblical Chronogenealogies» (2003),
Freeman AUSS 42 (2004), Coming to Grips with Genesis (Master Books, MacArthur foreword),
Ussher Annals of the World, Brigden (TBS) по Каинану.

## Статус деплоя

Компонент готов, собирается (astro check 0 errors, build 52 pages).
Ждёт dist-promotion по AGENTS-r244 doctrine (95%+ visual parity).
На legacy root — fallback HTML без React.
