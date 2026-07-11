# GENEALOGY ENGINE CONTRACT — GenealogyEngine (Phase 2, дизайн-до-кода)

> **Статус:** контракт движка v0 (design-before-code, доктрина karty STRAT-02).
> **Не** код — спецификация, по которой пишется рендер Phase 3.
> **Основа:** GENEALOGY-FOUNDATION-2026-07-11 (стратегия) + AuditRepo intake
> claude-genealogy-atlas-strategy/2026-07-11 (REPORT §S5, evidence, 89 источников).
> **Данные-вход:** `data/genealogy/v2/` (persons/edges/groups/spine — Phase 1, готовы).
> **Академические входы:** McGuffin & Balakrishnan (genealogical graphs), ZMLT
> (arXiv 1906.05996), DOI-trees (Card & Nation 2002), ELK layered; bible-family-tree
> lesson (force-на-полном-графе = «клубок» → послойный BFS-layout).

Принцип: **движок проектируется так, чтобы генеалогия была его первым честным
клиентом** (не «данные подгоняются под библиотеку»). Как MapEngine для karty.

---

## 0. Почему собственный SVG-движок, а не библиотека (закреплено)

Из REPORT §S3, §S5.2 + бенчмарки (evidence workflow-appendix):
- React Flow — мейнтейнеры: «не для 1000+ узлов»; 136KB gz налога; inline-стиль
  несовместим с темизацией `html.dark`.
- Cytoscape WebGL bench: тормоза при 3k узлов идут от **плотности рёбер** (68k рёбер
  → 3fps); наш граф — 3056 узлов / **2053 ребра** ⇒ bottleneck нас не касается при
  LOD-бюджете ≤500 видимых карточек.
- ⇒ **GenealogyEngine**: vanilla TS, один `<svg>`-сценграф, d3-zoom + d3-interpolate,
  предвычисленный layout, виртуализация вьюпорта. Цель ≤70KB gz своего кода.

Отвергнуто: Canvas/WebGL-ядро (владелец заказал SVG; теряем a11y-DOM, чёткость
пергамента, печать) — если когда-нибудь LOD-бюджет перестанет спасать, вводится
гибрид (SVG для лейблов/интерактива + Canvas-подложка рёбер), но НЕ в Phase 3.

---

## 1. Расположение и форма (интеграционный контракт)

```
src/lib/genealogy-engine/            ← движок (vanilla TS, БЕЗ React в рантайме)
├── engine.ts            — GenealogyEngine: mount/destroy, публичный API (§4)
├── scene.ts             — сценграф SVG-слоёв (§3)
├── viewport.ts          — d3-zoom, pan/zoom, minimap, URL-state (§5)
├── lod.ts               — LOD-контроллер: выбор видимого множества по зуму (§2)
├── morph.ts             — FLIP-морфинг кластер↔развёртка (§2.3)
├── search.ts            — индекс имён (ru/he/gr/translit) + фокус (§6)
├── focus.ts             — фокус-линия (предки+потомки), degree-of-interest (§6)
├── nodes.ts             — шаблоны узлов-карточек и мега-узлов (<use>-символы)
├── theme.ts             — токены (пергамент/тёмная), маппинг линий→стили рёбер
├── a11y.ts              — клавиатура, ARIA-модель, SR-навигация (§7)
└── types.ts             — типы данных v2 (импорт из data-контракта)

src/pages/rodosloviye/index.astro   ← монтирует остров (client:only или client:load)
src/components/rodosloviye/          ← Astro-обёртка: PageHead(SEO)+StaticLayer(§8)+mount
data/genealogy/v2/                   ← данные (Phase 1); в рантайм — lazy fetch, НЕ props
```

Правила (AGENTS): новый код только в `src/**` (legacy `/css/`+`/js/` не расширяем);
Tailwind не вводим (токены сайта + scoped CSS); обе темы `html.dark`; CSP не меняется
(всё self-hosted); данные — lazy-чанки из `/data/genealogy/v2/`, НЕ инлайн-props
(иначе HTML ×20, см. GEN-SCALE-01). PremiumControls (§3.10) не трогаем.

---

## 2. LOD-контракт (сердце)

Три уровня, переключение по зуму ИЛИ явному действию (клик по кластеру, «быстрый вид»).

| Уровень | Триггер (zoom) | Что видно | Бюджет узлов |
|---|---|---|---|
| **L0 «Обзор»** | < 0.35 | Хребет (76 якорей spine.json, но визуально ~10-12 крупных) + 14 мега-узлов кластеров со счётчиками + пунктирные превью-глифы | ≤ ~90 «узлов» (якоря+кластеры) |
| **L1 «Ветвь»** | 0.35–0.8 ИЛИ клик по кластеру | Развёртка целевого кластера (радиальная — 12 колен; колоночная — Мф1/Лк3; список — народы/изолированные), соседи сжаты в мега-узлы | 100–300 |
| **L2 «Персоны»** | > 0.8 | Полные карточки в пересечении вьюпорт∩LOD, lazy-чанки данных | ≤ 400–500 |

**Инварианты LOD (ZMLT):**
- **Anchor continuity:** позиции 10-12 крупных якорей хребта НЕ меняются между
  уровнями (якорь — точка стабильности взгляда). Проверяется тестом морфинга.
- **Честный счётчик:** мега-узел показывает `N видимых / M всего` при активных
  фильтрах (не врёт «+318», если фильтр скрыл половину).
- **Фильтры/фокус — ПОВЕРХ LOD**, не ломают агрегаты.
- Виртуализация: рендерятся только узлы в (расширенном на 20%) вьюпорте ∩ LOD-множество.

### 2.3. Морфинг (самая сложная часть — прототип ДО обязательств)
Переход L0→L1 (раскрытие кластера) и обратно — **FLIP** (First-Last-Invert-Play):
1. First: запомнить bbox мега-узла.
2. Last: применить предвычисленные позиции детей (layout-l1/<cluster>.json).
3. Invert: дети стартуют трансформированными в bbox родителя.
4. Play: d3-interpolate 300–450ms к финальным позициям; мега-узел растворяется.
`prefers-reduced-motion` → мгновенное переключение (без Play).
**Fallback (если морфинг не уложится в бюджет Phase 2-прототипа):** жёсткое
переключение уровней без анимации — всё ещё эталонного уровня minus, не блокер.

---

## 3. Сценграф (порядок слоёв `<svg>`, снизу вверх)

```
<svg> (один, координаты «мира»; d3-zoom трансформирует <g class="world">)
├── <g class="layer-bg">        — пергамент/шум (декор, non-interactive)
├── <g class="layer-era-bands"> — горизонтальные полосы эпох (AM-ось, §9)
├── <g class="layer-edges">     — рёбра (parent/spouse/tradition/golden), под узлами
├── <g class="layer-nodes">     — карточки персон + мега-узлы кластеров (<use>-символы)
├── <g class="layer-labels">    — лейблы (отдельно: overlap-free при зуме, ZMLT)
└── <g class="layer-overlays">  — фокус-подсветка, спорные-маркеры, hover
<!-- вне world (экранные координаты): minimap, toolbar, timeline-axis, detail-panel -->
```

Узлы — экземпляры `<use href="#tpl-person">` / `#tpl-mega` (один раз определённые
`<symbol>` в `<defs>`) → минимум DOM, стиль через CSS-переменные-per-узел.
AM-ось (§9) — слой сценграфа `layer-era-bands` (в координатах мира, движется с pan/zoom),
НЕ фиксированный overlay (закрывает GEN-UX-01 старого v1).

---

## 4. Публичный API движка

```ts
interface GenealogyEngine {
  mount(el: HTMLElement, opts: MountOptions): void;
  destroy(): void;                          // снимает listeners (AGENTS §5.2)
  // навигация
  focusPerson(id: string, opts?: { zoom?: number; duration?: number }): void;
  expandCluster(clusterId: string): void;   // L0→L1 морфинг
  collapseCluster(clusterId: string): void;
  applyView(view: SavedView): void;         // «быстрые ссылки»
  resetView(): void;
  // состояние
  setFilter(f: LineageFilter | PeriodFilter | 'only-anchors' | 'hide-empty'): void;
  setFocus(id: string | null): void;        // фокус-линия предки+потомки
  toggleGolden(on: boolean): void;
  // события (движок эмитит; Astro-обёртка/SEO-слой слушают)
  on(evt: 'nodeSelect'|'levelChange'|'viewChange', cb): void;
}

interface MountOptions {
  dataUrl: string;          // '/data/genealogy/v2/' — lazy fetch чанков
  theme: 'auto'|'light'|'dark';   // следует html.dark
  initialView?: SavedView;  // из URL-state
  reducedMotion?: boolean;
}
```

Данные грузятся движком по `dataUrl` порционно: сначала `spine.json` + `groups.json`
+ L0-layout (маленькие) → мгновенный L0; L2-чанки персон — по мере зума/панорамы.

---

## 5. Viewport, URL-state, minimap

- d3-zoom: pan (drag/swipe), zoom (wheel/pinch), `minZoom`/`maxZoom` по LOD-порогам.
- **URL-state** (share/save): `?view=david-line&z=0.6&focus=jesse--rut-4-17&f=messianic`
  → `applyView` при загрузке. «Поделиться»/«Сохранить вид» = сериализация состояния.
- Minimap: уменьшенная копия `layer-nodes` bbox + рамка вьюпорта, pannable.
- Экспорт: «Скачать SVG/PNG видимой области» (SVG serialize + опц. canvas rasterize).

---

## 6. Поиск и фокус

- **Индекс** (build-time `search-index.json`): по ru/he/gr/translit/alt именам +
  ссылкам на стих + названиям кластеров. Fuzzy (Левенштейн/prefix), find-as-you-type.
- Совпадение → `focusPerson` (setCenter + zoom-in 500-600ms), карточка деталей.
- **Фокус-линия** (degree-of-interest, Card&Nation): выбор персоны → подсветка
  предков (вверх по отцу/матери) + потомков (вниз), приглушение остального
  (opacity/grayscale). Toggle «показать всех потомков от X».
- Золотая нить: toggle подсветки spine.json поверх любого вида.

---

## 7. A11y (не опционально — эталонного уровня)

- **Клавиатура** (модель v1, сохранить): ↑ родитель, ↓ первый ребёнок, ←→ братья,
  Enter детали, Esc выход; Tab по интерактивным контролам; `/` или Ctrl+K — поиск.
- **ARIA:** `role="tree"`/`treeitem` на логическом уровне (не только SVG); `aria-label`
  с русским именем+эпохой; `aria-expanded` на мега-узлах.
- **SR-навигация:** статический слой §8 — первичный доступ для скринридера
  (canvas-опыт дополняет, не заменяет).
- `prefers-reduced-motion` → без морфинга/анимаций.
- Контраст ≥ WCAG AA в обеих темах (Lighthouse a11y ≥ 95).

---

## 8. Статический слой (SEO/SR/print/no-JS) — обязателен

Build-time (Astro, из `data/genealogy/v2/`), в DOM страницы независимо от JS:
- HTML-оглавление генеалогии: эпохи → кластеры → персоны (ru-имя + ссылка на стих),
  `data-pagefind-body` (внутренний поиск сайта индексирует), `<details>`-раскрытие.
- `<noscript>` — тот же оглавление-вид как основной контент.
- Print-CSS: линейное родословие (хребет + ключевые ветви).
- JSON-LD: `Dataset` (атрибуция TIPNR/Синодальный/CC BY) + `WebPage` + `BreadcrumbList`.
- Этот слой = контент для llms.txt и деградация без JS (AGENTS `scripting:none`).

---

## 9. AM-ось и эпохи (богословский слой)

- 8 эпох (eras.json из v1: Сотворение…Воплощение), горизонтальные полосы в
  `layer-era-bands` (координаты мира). MT-хронология (AM) — основная шкала;
  LXX/Самарянский — toggle (данные v1 уже мультитрадиционные).
- Life-bars узлов ∝ lifespan (драматический спад после Потопа — сохранить из v1).
- Спорные узлы (disputed из v1: Каинан Лк 3:36, Иехония, Иосиф/Мария) — маркер «?»
  + callout с ОБЕИМИ позициями (EDITORIAL-SOURCE-POLICY; не подаём как решённое).
- Слой «после Христа» (281 НЗ-персона): ученики/апостолы + родня Господа — канон;
  внеканоническое предание (деспосины) — отдельный `tradition`-слой с маркировкой.

---

## 10. Бюджеты (acceptance, замер в CI Phase 5)

| Метрика | Бюджет |
|---|---|
| JS движка (gz) | ≤ 120KB (цель ≤ 70KB; для сравнения RF+React = 136KB) |
| Initial data (gz) | ≤ 300KB (spine+groups+L0/L1); L2-чанк ≤ 80KB |
| DOM-элементов одновременно | ≤ ~2 000 |
| pan/zoom | 60fps desktop / ≥40fps mobile (4× CPU throttle) |
| LCP | < 2.5s; Lighthouse mobile ≥90 / a11y ≥95 |
| Морфинг L0↔L1 | ≤ 450ms, без «прыжка» якорей |

---

## 11. Порядок Phase 3 (реализация на этом контракте)

1. scene + viewport + theme (пустой сценграф, pan/zoom, обе темы) — каркас.
2. L0: хребет + мега-узлы из spine.json/groups.json (статичные позиции) — первый экран.
3. nodes + edges + L2 персоны с виртуализацией и lazy-чанками.
4. LOD-контроллер + морфинг (прототип §2.3 → продакшн).
5. search + focus + golden + фильтры.
6. minimap + URL-state + экспорт + «быстрые виды».
7. a11y + mobile (vertical cards, pinch — паттерн MyHeritage 2025).
8. статический слой §8 (параллельно, Astro build-time).

Каждый шаг — за бюджетами §10; visual-baseline до/после; v1 остаётся на проде до
полного паритета (переключение — атомарный lane, Phase 5).

---

## 12. Открытые вопросы Phase 2 (прототип должен ответить ДО Phase 3)

1. Морфинг FLIP укладывается в 450ms/60fps на реальном L0→«12 колен» и L0→«Мф 1»?
   (если нет — fallback жёсткого переключения, §2.3).
2. Радиальный layout «12 колен» vs колоночный «Мф1/Лк3» — единый layout-движок с
   параметром или два? (ELK layered покрывает колоночный; радиальный — свой).
3. Изолированные ~980 персон (без рёбер): в L1 как списки-в-кластерах по эпохе/книге —
   какой кластер-вид? (референс «12 колен расширенный» — радиальные списки).
4. Lazy-чанкование L2: по эпохам, по кластерам или по bbox-тайлам? (замерить на прототипе).
