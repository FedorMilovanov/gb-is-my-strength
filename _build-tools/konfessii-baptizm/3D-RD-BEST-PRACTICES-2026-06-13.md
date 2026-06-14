# 3D-карта ЕХБ — R&D по топовым UX/WebGL-паттернам на июнь 2026

Дата: 2026-06-13. Этот документ — не «ещё один план ради плана», а ориентир для будущих агентов: какие современные паттерны стоит держать в голове, чтобы карта становилась понятнее, глубже и премиальнее без регрессии.

## Главный вывод

3D не должен быть декоративной игрушкой. В 2026 сильные WebGL/3D-интерфейсы работают как **структурный storytelling layer**: 3D помогает понять связи, время, географию и путь пользователя. Поэтому наш приоритет:

1. **Overview first** — сначала дать ориентацию: что это за карта, где истоки, где маршруты.
2. **Zoom/filter/context** — маршруты, Timeline, карта Евразии, подсветка связей.
3. **Details on demand** — dossier узла, источники, спорные вопросы, география влияния.

Это соответствует классической мантре Shneiderman: “overview first, zoom and filter, then details-on-demand”.

## Исследованные ссылки и что из них взять

### 3D/WebGL graph interaction
1. react-force-graph docs — camera controls, node drag, pointer interaction, navigation controls: https://vasturiano.github.io/react-force-graph/
2. 3d-force-graph README — enableNodeDrag, enableNavigationControls, graph2ScreenCoords/getGraphBbox: https://github.com/vasturiano/3d-force-graph/blob/master/README.md
3. npm 3d-force-graph API — hover/click/link precision/pointer interaction: https://www.npmjs.com/package/3d-force-graph/v/1.36.1
4. npm react-force-graph API — onNodeDrag/onNodeHover/onLinkHover/controlType: https://www.npmjs.com/package/react-force-graph/v/1.16.0
5. Neo4j 3D WebGL graph article — color by type, captions/labels, hover cursor feedback: https://medium.com/neo4j/visualizing-graphs-in-3d-with-webgl-9adaaff6fe43
6. Neo4j developer blog 2025 — weighted nodes/relationships and graph algorithms for importance: https://neo4j.com/developer-blog/visualizing-graphs-in-3d-with-webgl/
7. GraphAware + PIXI/WebGL performance — large graph rendering and interaction layers: https://graphaware.com/blog/scale-up-your-d3-graph-visualisation-webgl-canvas-with-pixi-js/

### Three.js/WebGL performance and polish
8. Three.js performance tips 2026 — selective bloom, postprocessing cost, deferred 3D loading: https://www.utsubo.com/blog/threejs-best-practices-100-tips
9. pmndrs/postprocessing — merged passes, bloom/color grading, linear workflow notes: https://github.com/pmndrs/postprocessing
10. Three.js post-processing overview — FXAA/SMAA/Bloom pass concepts: https://sangillee.com/2025-01-15-post-processing/
11. Three.js/WebGPU migration checklist 2026 — fallback detection, WebGPU caveats, post-processing migration: https://www.utsubo.com/blog/webgpu-threejs-migration-guide

### Interactive timelines and historical storytelling
12. Genially interactive timeline guide — timeline must give context/clarity, not just dates: https://genially.com/create/timeline/
13. Flourish timeline maker — event-by-event movement, adaptive desktop/mobile timelines: https://flourish.studio/visualisations/timeline-maker/
14. DesignRush timeline infographic examples — group milestones by theme/decade: https://www.designrush.com/best-designs/infographics/trends/timeline-infographic

### Immersive/storytelling web design 2026
15. Lovable interactive websites 2026 — 3D exploration, user-controlled tours, progressive revelation: https://lovable.dev/guides/best-interactive-websites
16. Pixelmatters UI trends 2026 — refined experimental navigation, progressive disclosure, spatial design: https://www.pixelmatters.com/insights/7-UI-design-trends-to-watch-in-2026
17. ItsBuzz top web design trends 2026 — smarter 3D as structural storytelling, performance-aware design: https://www.itsbuzzinteractive.com/blog/top-web-design-trends
18. ReallyGoodDesigns trends 2026 — horizontal storytelling, interactive worlds, Awwwards direction: https://reallygooddesigns.com/web-design-trends-2026/
19. Metabole immersive website examples 2026 — WebGL transitions and 3D worlds as portfolio/experience quality bar: https://metabole.studio/en/blog/immersive-website-examples
20. Awwwards San Rita case — 3D navigation should disappear behind the experience, not fight user control: https://www.awwwards.com/mapping-the-uncharted-the-san-rita-project.html
21. Wavespace design examples 2026 — WebGL/3D plus clear menu/CTA balance: https://www.wavespace.agency/blog/best-website-design-examples
22. Grokipedia 2026 Web Design Trends — 3D immersion, spatial navigation, progressive rendering: https://grokipedia.com/page/2026_Web_Design_Trends

### Data visualization and cognitive clarity
23. Shneiderman mantra — overview first, zoom/filter, details-on-demand: http://www.ifp.illinois.edu/nabhcs/abstracts/shneiderman.html
24. Dev3lop progressive disclosure in complex visualization — reveal layers gradually to avoid overload: https://dev3lop.com/progressive-disclosure-in-complex-visualization-interfaces/
25. Holistic integrated information visualization guidelines — focus/context, grouping/chunking, details on demand: https://pmc.ncbi.nlm.nih.gov/articles/PMC11618013/
26. Technology & Strategy data visualization 2026 — temporal awareness, historical context, geospatial context: https://www.technologyandstrategy.com/news/data-visualization
27. SR Analytics data visualization examples — immediate clarity, honest representation, purposeful design: https://sranalytics.io/blog/best-data-visualization-examples/
28. TimeTackle data visualization best practices — clarity, labels, purposeful interactivity, narrative: https://www.timetackle.com/data-visualization-best-practices/

### Context-aware UX / adaptive guidance
29. Sanjay Dey UX trends 2026 — contextual navigation and progressive disclosure by user role/expertise: https://www.sanjaydey.com/ux-design-trends-2026/
30. GroovyWeb AI app UX trends 2026 — contextual guidance, persistent bottom navigation, dark adaptive panels: https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026
31. Dev.to UI/UX 2026 — context-aware interfaces, spatial/immersive experiences, minimal UI with intelligence underneath: https://dev.to/pixel_mosaic/top-uiux-design-trends-for-2026-ai-first-context-aware-interfaces-spatial-experiences-166j

## Что уже применено в карте

- **Baptists series research sync:** после появления полной серии `/baptisty-rossii/` и research-досье в 3D-источнике обновлены современные статистические данные РС ЕХБ (`~144K` заменено на BWA `66 732 / 1 413 церквей`) и добавлены события по статье «Гонения и совесть» (1919, 1923, 1926, 1945).
- **Initiative/samizdat sync:** после новых находок по Братскому Вестнику №6/1963, Инициативной группе и подпольной печати добавлены события 1963 (съезд ВСЕХБ/Устав + «Вестник спасения»), 1966 (майская делегация), 1970 (Совет родственников), 1971 («Христианин»/Косыгин), 1976 («Вестник истины»).
- **Relatives bulletin sync:** после PDF-каталога Бюллетеней Совета родственников добавлены события 1972 (Иван Моисеев), 1977 (печатники «Христианина» под следствием), 1980 (Донченко, Бюллетени/Евангелия, дети верующих, психбольницы, 79 узников).
- **Persecution case index sync:** после индекса кейсов гонений добавлены события 1935–1938 (Георгий Слесарев), 10.09.1937 (Иван Шилов), 09.01.1964 (Николай Хмара). Timeline теперь показывает `sourceLevel` для части событий.
- **Data-driven metadata first:** `handleTimelineEventSelect` сначала читает поля события (`nodeId`, `routeId`, `mapSelectionId`, `articleKey`), и только затем использует `TIMELINE_TARGETS` как fallback. Это промежуточный шаг к полному переносу связей в `timeline.ts`.
- **Timeline/article preview:** Timeline-card и full dossier теперь показывают «Связанную статью» из серии `/baptisty-rossii/` (cover + часть + title + description + переход `target=_top`). Это связывает 3D-карту с текстовым исследовательским слоем, а не оставляет карту отдельным аттракционом.
- **Timeline → event → graph focus:** ticks на Timeline кликабельны и могут перелетать к узлу.
- **Timeline → map sync:** событие теперь не только фокусирует узел, но и включает/подсвечивает релевантную географию (`city-Тифлис`, `city-Санкт-Петербург`, `city-Москва`, `country-804` и т.п.) через `findMapSelectionForNode`.
- **Timeline target table:** вместо разрозненной regex-логики используется единый `TIMELINE_TARGETS` в `MindMap3D.tsx` как промежуточный шаг к полноценным `nodeId/routeId/mapSelectionId` в `timeline.ts`.
- **Timeline declutter:** ticks сгруппированы по году, minor-события визуально приглушены; native `title` убран, чтобы не появлялись белые браузерные tooltip-плашки поверх премиального UI.
- **Timeline landmark mode:** рендерятся только major/landmark ticks (`visibleTimelineTicks = timelineTicks.filter(tick => tick.major)`), а hover/focus обновляет собственную тёмную карточку события (`hoveredTick`) вместо браузерного tooltip. Minor-события остаются в данных, но не создают шумную россыпь точек.
- **No native browser tooltips in 3D UI:** прямые `title` на `<button>`/`<motion.button>` запрещены; использовать `aria-label` и/или собственные тёмные карточки. Это убирает белые системные плашки поверх карты.
- **Timeline stacking rule:** когда нижний route panel раскрыт, event-card Timeline скрывается (`displayEvent && !bottomBarExpanded`), чтобы не лежать поверх маршрутов.
- **Map highlight restraint:** заливка выбранной страны снижена (`35`→`14`, opacity `0.9`→`0.48`), related-страны приглушены; карта должна давать контекст, а не заливать сцену золотым пятном.
- **Wheel capture:** внутри fullscreen 3D добавлен `onWheelCapture={handleSceneWheel}` — если колесо не над реально прокручиваемым dossier, оно не скроллит документ, а управляет zoom камеры.
- **Scroll lock:** при открытой 3D-карте `html/body` получают `overflow:hidden`, чтобы колесо мыши не двигало правый document-scrollbar вместо zoom/pan сцены.
- **Raycast hygiene:** декоративные glows/labels/orbits отключены от raycast, клики ловит компактный `interactiveHit`; это снижает ситуацию, когда близкий огромный glow/кольцо мешает выбрать дальний узел.
- **Top navigation anti-overlap:** nav-панель 3D-приложения должна оставаться читаемой на 1366–1680px: бренд не перекрывает «Главная», пункты `whitespace-nowrap`, ширина nav расширена до `max-w-[82rem]`. Исходник-фикс хранится в `_build-tools/konfessii-baptizm/Navigation.tsx`.
- **Route step chips:** этапы маршрута кликабельны и ведут к узлам.
- **Route storyboard context:** раскрытый маршрут показывает текущий узел (`Сейчас в маршруте`), его год/описание и следующий шаг/связь. Это уменьшает когнитивную нагрузку: пользователь видит не только «цепочку», но и зачем он сейчас на этом этапе.
- **Context coach:** добавлен тихий обучающий блок «Как читать карту» для первого входа в 3D без фокуса.
- **Progressive disclosure:** overview → Timeline/route/map → dossier.
- **Source-level guards:** `konfessii:audit` проверяет, что Timeline не откатился к stale `timelineYear` state и что route/timeline interactions подключены.

## Идеи следующих проходов, НЕ делать всё сразу

### P1 — data-driven Timeline mapping
Сейчас Timeline → node focus частично эвристический по ключевым словам. Лучше добавить в `src/data/timeline.ts` поля:

```ts
nodeId?: string;
routeId?: string;
mapSelectionId?: string;
```

Тогда `handleTimelineEventSelect` станет простым и безопасным. Это приоритет №1 для будущей верификации данных.

### P2 — route storyboard
Каждый маршрут должен иметь мини-структуру:

```ts
steps: [{ nodeId, title, why, year }]
```

Тогда route chips смогут показывать не только label узла, но и смысл перехода: «почему этот этап важен».

### P3 — map synchronization
При Timeline event focus подсвечивать не только узел, но и связанную географию:

- 1867 → Тифлис / Закавказье
- 1874 → Петербург
- 1944 → Москва / Россия
- 1961–1965 → СЦ ЕХБ
- 1992 → РС ЕХБ

### P4 — visual regression screenshots
Добавить Playwright screenshot suite для 3D-состояний:

- старт 3D без фокуса;
- Timeline event selected;
- active route expanded;
- route step clicked;
- full dossier;
- map mode;
- mobile.

### P5 — performance meter, но тихий
Не показывать пользователю FPS, но в dev/audit измерять:

- pageerror;
- canvas present;
- idle stability;
- drag no runaway alpha;
- Timeline click no React crash.

### P6 — avoid over-polishing
Не внедрять тяжёлый postprocessing/bloom до perf-аудита. Визуал уже богатый; больше пользы сейчас дают понятность, route/story, source parity и стабильность.
