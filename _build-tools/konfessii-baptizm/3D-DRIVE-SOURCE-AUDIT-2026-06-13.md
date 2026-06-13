# 3D-карта ЕХБ — сверка с Google Drive React-исходником

Дата: 2026-06-13

Источник владельца: Google Drive ZIP `react-vite-tailwind`:

https://drive.google.com/file/d/1tSV6l2CVl7MaPBWHNvf0Vt33JKUxDrJQ/view?usp=drive_link

File ID: `1tSV6l2CVl7MaPBWHNvf0Vt33JKUxDrJQ`.

## Что внутри Drive-архива

Это не только бандл, а полноценный Vite/React-проект:

- `src/components/MindMap3D.tsx`
- `src/components/mindmap3d/data.ts`
- `src/components/mindmap3d/materials.ts`
- `src/components/mindmap3d/nodeKind.ts`
- `src/components/mindmap3d/types.ts`
- `src/data/timeline.ts`
- `src/data/history/persons.ts`
- `src/data/history/mapPlaces.ts`
- `src/data/history/biographyDisputes.ts`
- другие секции страницы и данные.

## Проверенные выводы

1. **Drive-исходник подтверждает, что full dossier изначально был узким.**
   В оригинальном `MindMap3D.tsx` inspector width был:
   ```tsx
   inspectorMode === 'peek' ? 300 : 320
   ```
   Поэтому ширину full-досье нельзя «чинить» простым расширением без отдельного визуального решения. Если кажется узко — сначала искать реальную причину: auto-collapse, line-clamp, density секций, поведение same-node click, mobile/full transitions.

2. **Критический регресс 2026-06-13 был не в данных, а в Timeline JSX.**
   После восстановления dossier был оставлен старый inline timeline-блок, который ссылался на удалённые `timelineYear` / `setTimelineYear`. При входе в 3D это давало runtime error:
   ```txt
   timelineYear is not defined
   ```
   Исправлено в коммите `7850e0f`: используется один ref-based `TimelineOverlay`.

3. **Событийность Timeline подтверждена `src/data/timeline.ts`.**
   Годы должны быть связаны с событиями и русскими категориями через `categoryLabels`, а не показывать внутренние ключи (`modern`, `origin`) или голую шкалу лет.

4. **Для дальнейших сравнений Drive-проект полезнее бандла.**
   Если снова кажется, что агент урезал блоки, сравнивать нужно не минифицированный `_app/index.html`, а:
   ```bash
   diff -u <drive>/src/components/MindMap3D.tsx _build-tools/konfessii-baptizm/MindMap3D.tsx
   ```
   и отдельно сверять данные `src/data/history/*`.

## Новая защита после сверки

`scripts/konfessii-map-audit.js` усилен source-level guard:

- `TimelineOverlay` и `timelineYearRef` должны существовать.
- stale-ссылки `setTimelineYear` / `timelineYear ??` запрещены.
- `<TimelineOverlay>` должен монтироваться ровно один раз.
- live I8 проверяет, что в 3D виден событийный Timeline.
- live I9 проверяет нижний роутер «Маршруты и города».

## Следующий безопасный шаг

Сделать отдельную таблицу parity по данным:

| Блок | Drive source | Current source | Статус |
|---|---|---|---|
| `personProfiles` | есть | проверить | ? |
| `mapPlaces` | есть | проверить | ? |
| `biographyDisputes` | есть | проверить | ? |
| route summaries | есть | проверить | ? |
| full dossier sections | есть | проверить | ? |

Не восстанавливать блоки «на глаз» — только после сверки источника, текущего UX и owner-review.
