# Контракт навигационной ткани сайта

Статус: **архитектурный владелец**  
Маршрут продукта: статьи → контекстные связи → `/map/`  
Версия движка: relation schema v1  
Дата фиксации: 2026-07-27

## 1. Назначение

Система смысловых связей решает три разные задачи и не смешивает их:

1. **Навигация серии** — порядок, предыдущая/следующая часть, содержание и прогресс.
2. **Контекст статьи** — внешние материалы, которые помогают понять тему.
3. **Атлас исследований** — глобальное исследование библиотеки через карту и список.

Один типизированный компилятор строит проекции статей, данные Атласа, no-JS список, обратные отношения, статистику и диагностику.

## 2. Неприкосновенная граница серии

Series engine является единственным владельцем:

- предыдущей и следующей части;
- порядка и прогресса;
- оглавления;
- спутников, глав и вложенных материалов;
- пользовательского маршрута по серии.

Relation engine может показать `series-next` как структурную линию в Атласе, но article projection никогда не выводит:

- `seriesPrev` / `seriesNext`;
- другую часть той же серии;
- спутник, уже принадлежащий series chrome;
- повтор существующей серийной навигации.

> Сначала существующая серия. Затем только полезные внешние связи.

## 3. Канонические источники

| Факт | Единственный владелец |
|---|---|
| Порядок и опубликованные части серии | `data/series.json` / series engine |
| Проверенное смысловое отношение и rationale | `data/relations.json` |
| Переходные исторические пары | `data/links-graph.json` как legacy fallback |
| Обратная подпись и направление | relation compiler |
| Карточки статьи | relation compiler projection |
| Узлы, рёбра, группы и статистика Атласа | relation compiler |
| Static article HTML | build-time projector |
| Интерактивное состояние Атласа | Atlas runtime над compiled payload |

Новые отношения запрещено добавлять в legacy edges. Они создаются в `data/relations.json` с типом, весом, rationale и `editorialStatus`.

## 4. Компилятор

Канонический модуль: `src/lib/relations/engine.mjs`.

Он обязан быть:

- чистым и детерминированным;
- независимым от DOM и браузера;
- fail-closed в strict mode;
- одинаковым владельцем SSR, prerendered endpoint, no-JS и build projection;
- версионированным через `schemaVersion` и `engineVersion`.

Компилятор валидирует:

- уникальность node ID и нормализованного URL;
- существование source/target;
- отсутствие self-links;
- допустимость type, direction, status и weight;
- уникальность relation ID и semantic relation;
- отсутствие визуальных зеркальных дублей;
- существование projection для каждого узла.

## 5. Типы отношений

Поддерживаемый словарь:

- `series-next`;
- `part-of`;
- `historical-context`;
- `methodological-context`;
- `explains`;
- `expands`;
- `contrasts`;
- `cites`;
- `biography-of`;
- `map-of`;
- `same-topic`;
- `recommended-next`;
- `related`.

Каждый тип определяет:

- направленность;
- публичную прямую подпись;
- inverse label;
- приоритет article projection;
- default weight;
- допустимость показа внутри статьи.

В публичном интерфейсе запрещены технические подписи `source`, `target`, `edge`, `incoming`, `outgoing`, `backlink` и голое «ссылается на».

## 6. Проекция внутри статьи

### Самостоятельный материал

Название: **«Продолжить исследование»**.

### Материал серии

Название: **«Контекст и связи»**.

### Инварианты

- один семантический `<nav aria-labelledby>`;
- настоящий `<a href>` для каждого перехода;
- максимум четыре уникальных target;
- deterministic ranking;
- rationale берётся из typed relation или метаданных материала;
- same-series relations исключаются до HTML;
- старые `.gbx-backlinks` удаляются;
- повторный build не создаёт второй panel;
- JavaScript для сборки article panel отсутствует;
- блок существует и работает при выключенном JavaScript;
- отказ любых graph/compiled запросов не влияет на статью;
- print/PDF скрывает navigation panel.

Build-владелец: `scripts/project-relations-to-dist.mjs`.

Проектор пишет диагностический артефакт `dist/reports/relation-projection.json` и падает при нарушении контракта.

## 7. Атлас исследований

Публичное название: **«Атлас исследований»**.  
Короткое название: **«Атлас»**.

SSR отдаёт:

- заголовок и описание;
- фильтры тем и типов связей;
- полный список материалов с anchors;
- вычисленные counts;
- no-JS библиотеку.

Astro prerender создаёт единственный browser payload:

`/data/relations.compiled.json`

Browser runtime не загружает `links-graph.json`, `series.json` или editorial catalog по отдельности.

Runtime добавляет:

- pan и wheel/trackpad zoom;
- pinch zoom;
- кнопки масштаба и центрирования;
- semantic zoom;
- focus mode;
- deep links `focus`, `group`, `view`;
- поиск и фильтры;
- desktop detail panel;
- mobile bottom sheet.

При отказе compiled payload карта скрывается, а server-rendered список остаётся рабочим.

## 8. Legacy migration

`data/links-graph.json` временно импортируется с пониженным приоритетом.

Правила:

- typed catalog всегда сильнее legacy pair;
- одна неориентированная legacy pair импортируется один раз;
- same-series legacy mesh подавляется;
- structural hub relation нормализуется в `part-of`;
- legacy relation не получает выдуманного rationale;
- origin сохраняется как `legacy-import` для диагностики.

Цель миграции — переносить качественные пары в `data/relations.json` и затем запретить legacy-import для article projections без потери Атласа.

## 9. Progressive enhancement и доступность

- Статья полностью функциональна без JavaScript.
- Атлас имеет равноправный list mode.
- No-JS Атлас содержит полный список anchors.
- Drag не является единственным способом управления.
- Интерактивные цели соответствуют touch-размерам.
- Keyboard focus видим.
- `prefers-reduced-motion` соблюдается.
- Mobile layout проектируется отдельно, а не уменьшается пропорционально desktop.

## 10. Запрещённые решения

- browser-side сборка article relations;
- два блока «исходящие / входящие»;
- ручные обратные связи;
- guessed URL из ID;
- ручные публичные counts;
- дублирование series navigation;
- независимые компиляторы для SSR и runtime;
- загрузка нескольких raw JSON для одной карты;
- silent fallback на повреждённые данные;
- ослабление контракта ради зелёного CI;
- центральная modal-карточка, закрывающая карту;
- постоянная физическая дрожь layout.

## 11. Обязательные проверки

Static contracts:

- два запуска компилятора дают byte-equivalent JSON;
- все endpoints существуют;
- relation IDs и semantics уникальны;
- article projection ≤ 4;
- нет `series-next` и same-series target внутри статьи;
- SSR/list/runtime counts совпадают;
- obsolete relationship runtime отсутствует;
- compiler/projector/runtime проходят syntax check;
- CSS проходит AST parse.

Browser contracts:

- article panel: desktop, mobile, no-JS, data-failure isolation, print;
- Atlas: desktop zoom/focus/list, mobile sheet/filters, no-JS, compiled-data failure;
- Atlas делает ровно один data request;
- article route не делает relation data request;
- horizontal overflow отсутствует.

## 12. Критерии приёмки

- 0 повторов серийной навигации;
- 0 зеркальных визуальных дублей;
- 0 guessed URL;
- 0 browser-side article graph assembly;
- 0 raw graph/series requests из Атласа;
- 0 hardcoded публичных counts;
- все видимые переходы имеют anchors;
- focus URL восстанавливается после перезагрузки;
- отказ runtime не блокирует чтение;
- exact-head CI и AuditRepo reverify зелёные.
