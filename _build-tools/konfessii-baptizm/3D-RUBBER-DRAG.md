# 3D-карта: «резиновое» перетаскивание + анти-джиттер (r119)

Патч к React-исходнику оригинального 3D-приложения (`MindMap3D.tsx`,
react-force-graph-3d / three.js). Бандл `_app/index.html` собирается из этого
исходника через Vite singlefile. Исходник целиком в репо не хранится (2 МБ,
деплоился бы зря) — здесь зафиксированы ТОЧНЫЕ правки для воспроизводимости.

## Что и зачем изменено

### 1. Rubber-band drag (тянешь шарик — соседи следуют, отпускаешь — мягко домой)
`<ForceGraph3D>` props:
```
enableNodeDrag={true}                 // было: dims.w >= 768 (drag не работал на мобиле)
onNodeDrag={handleNodeDrag}           // было: () => d3ReheatSimulation()
onNodeDragEnd={handleNodeDragEnd}     // было: () => d3ReheatSimulation()
```
Хендлеры (рядом с handleNodeClick):
```js
const handleNodeDrag = useCallback(() => {
  if (!fgRef.current) return;
  fgRef.current.d3VelocityDecay?.(0.28);   // мягче → соседи плавно тянутся
  fgRef.current.d3ReheatSimulation?.();
}, []);

const handleNodeDragEnd = useCallback((node) => {
  if (!fgRef.current) return;
  if (node) {
    node.fx = undefined; node.fy = undefined; node.fz = undefined; // РАСПИН → возврат
    const a = ANCHORS[node.id];
    if (a) { // лёгкий импульс к якорю, без рывка
      node.vx = (node.vx ?? 0)*0.4 + (a.x-(node.x??a.x))*0.012;
      node.vy = (node.vy ?? 0)*0.4 + (a.y-(node.y??a.y))*0.012;
      node.vz = (node.vz ?? 0)*0.4 + (a.z-(node.z??a.z))*0.012;
    }
  }
  fgRef.current.d3VelocityDecay?.(0.20);   // штатное демпфирование
  fgRef.current.d3ReheatSimulation?.();
}, []);
```

### 2. Анти-джиттер в покое (владелец: «чтобы ничего не дрыгалось»)
```
warmupTicks={140}        // было 120 — стартовая раскладка пред-уложена
cooldownTicks={260}      // было Infinity — физика затухает и ЗАМИРАЕТ
cooldownTime={9000}      // было Infinity
d3AlphaDecay={0.0115}    // было 0.012
```
Орбиты/кольца/«дыхание» крутятся в ОТДЕЛЬНОМ requestAnimationFrame-loop
(useEffect `animate()`), не зависят от физики → продолжают жить в покое.
Drag / выбор маршрута / выбор страны будят симуляцию через `d3ReheatSimulation`.

### 3. Сила возврата усилена
`composition` force (пружина к ANCHORS): множитель `* 1.6`; зафиксированные
(тянущиеся, fx!=null) узлы пропускаются, чтобы не бороться с курсором.

### 4. Бандл-голова (воспроизводимость + регресс-аудит)
`index.html` исходника содержит CSP, `robots=noindex`, `viewport-fit=cover`,
title «Карта Русского Баптизма — 3D-приложение» — иначе падает konfessii-map-audit I6.

## Как пересобрать
1. Восстановить React-проект (оригинальный ZIP владельца) + применить правки выше.
2. `npm install && npm run build`
3. `cp dist/index.html <repo>/konfessii/russkij-baptizm/_app/index.html`
4. `npm run konfessii:audit` — должны держаться все инварианты.
