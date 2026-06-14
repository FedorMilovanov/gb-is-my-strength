# 3D-карта баптизма — smooth physics polish on latest main (2026-06-14)

> Важно: этот проход сделан **поверх актуального `main` (`69cd8bb`)**, где уже есть серия `baptisty-rossii`, data-driven Timeline, article previews, кейсы гонений, BWA-статистика и расширенные `konfessii:audit` I8–I13. Эти добавления НЕ откатывались.

## Цель

Ответ на повторную жалобу владельца: шарики стали красивее, но остаются «напряжёнными», слегка дёрганными, резиновость не достаточно плавная. Задача — смягчить физику без потери новой обучающей логики Timeline/маршрутов/статей.

## Что изменено

### 1. Idle без микродрожания
В `MindMap3D.tsx` и собранном `_app/index.html` смягчены итоговые параметры ForceGraph3D:

```tsx
d3AlphaDecay={0.0165}      // было 0.0115
d3VelocityDecay={0.24}     // было 0.20
warmupTicks={150}          // было 140
cooldownTicks={220}        // было 260
cooldownTime={7000}        // было 9000
```

Смысл: граф стартует уложенно, но быстрее затухает в покое. Орбиты/свет/Timeline остаются живыми через отдельную визуальную анимацию, но координаты узлов не должны постоянно дрожать.

### 2. Мягче возврат к якорям
Сила `composition` к `ANCHORS` снижена:

```tsx
anchor.strength * 1.6 * alpha  →  anchor.strength * 1.28 * alpha
```

Это убирает ощущение, что шарики «держит резина под большим натяжением».

### 3. Drag стал вязким, но не нервным
В latest main уже был хороший соседский rubber-band: при перетаскивании соседние узлы получают velocity pull к dragged node, а не телепортируются. Этот механизм сохранён, но смягчён:

```tsx
drag velocityDecay: 0.32 → 0.26
towardDrag: 0.0038 → 0.0032
towardHome: 0.0016 → 0.0012
neighbor velocity keep: 0.78 → 0.82
reheat throttle: 120ms → 80ms
custom alpha target: 0.12 → 0.10
release impulse: 0.010 → 0.006
release velocity keep: 0.32 → 0.36
release d3VelocityDecay: 0.28 → 0.24
```

Смысл: соседние узлы всё ещё тянутся за выбранным шариком, но не рвутся резко и не отскакивают обратно щелчком.

### 4. Не тронуто / не регрессировано

- Data-driven `TimelineOverlay` сохранён: события, `sourceLevel`, `articleKey`, `nodeId`, `routeId`, `mapSelectionId`.
- Кейсы гонений/Бюллетеней/Инициативной группы сохранены.
- Article previews в Timeline и dossier сохранены.
- BWA-статистика `66 732` сохранена, старое `~144K` не возвращено.
- Learning coach «Как читать карту» сохранён.
- Нижний роутер «Маршруты и города» сохранён.

## Регресс-защита

`scripts/konfessii-map-audit.js` расширен I14:

- static `_app`: проверяет `d3AlphaDecay:.0165`, `d3VelocityDecay:.24`, `warmupTicks:150`, `cooldownTicks:220`, `cooldownTime:7e3`;
- static `_app`: проверяет soft anchor `strength*1.28`, native drag alpha `.16`, custom drag alpha `.1`;
- static `_app`: запрещает возврат старых `d3AlphaDecay:.0115`, `warmupTicks:140`, `cooldownTicks:260`, `cooldownTime:9e3`;
- source: проверяет те же calm/drag constants в `_build-tools/konfessii-baptizm/MindMap3D.tsx`.

Команда проверки:

```bash
npm run konfessii:audit
```

На момент правки: PASS, включая live desktop WebGL и mobile smoke.

## Будущим агентам

- Не откатывать latest-main Timeline/preview/research-events ради старого overlay-патча.
- Не возвращать `anchor * 1.6` и `d3AlphaDecay .0115`: это снова даст «напряжённые» шарики и idle-jitter.
- Если после ручного QA покажется слишком вязко — менять малыми шагами: `d3VelocityDecay 0.24–0.28`, `alphaTarget 0.08–0.12`, но не прыгать обратно к `.3`.
- После любой пересборки `_app/index.html` обязательно прогнать `npm run konfessii:audit`, потому I14 ловит откат physics constants.
