# MAPS-RD-MASTERPLAN-2026.md
## Мастер-план раздела «Карты» gospod-bog.ru
### R&D + Архитектура + Roadmap + Фиксация находок

> **Создан:** 2026-06-13 (Arena Agent)  
> **Обновлять при каждом улучшении карт.** Этот файл — живая база знаний: всё найденное здесь, чтобы не искать заново.  
> **Принцип:** один мастер-документ > сотни гугл-поисков.

---

## ЧАСТЬ 1: АРХИТЕКТУРА — «БЕЗ БОЛИ» ДЛЯ БУДУЩИХ КАРТ

### 1.1 Структура файлов (целевая, на 3+ карты)

```
karty/
├── index.html                  ← хаб-галерея всех карт
├── _engine/
│   ├── map-engine.js           ← движок (zoom/pan/tour/panel/minimap/search)
│   ├── map-engine.css          ← все стили движка (кнопки, панели, поповеры)
│   ├── base-geo.svg            ← базовая география (море, реки, контуры)
│   └── ui-components.js        ← легенда, шкала, компас, хронология (reusable)
├── _data/
│   ├── geo-base.json           ← координаты базовых географических объектов
│   └── toponyms.json           ← топонимы с era-метками (bronze/iron/roman)
├── avraam/
│   ├── index.html              ← страница-оболочка (SEO, OG, JSON-LD)
│   ├── route.json              ← данные: PLACES, STAGES, CTX, TIMELINE
│   └── map.css                 ← тема карты (цвета эпохи, кастомные стили)
├── ishod/
│   ├── index.html
│   ├── route.json
│   └── map.css
└── pavel/
    ├── index.html
    ├── route.json
    └── map.css
```

**Правило:** новая карта = 3 файла. Движок и базовая география не трогаются.

---

### 1.2 route.json — контракт данных (единый для всех карт)

```json
{
  "meta": {
    "id": "avraam",
    "title": "Путь Авраама",
    "title_he": "אַבְרָהָם אָבִינוּ",
    "subtitle": "Бытие 11–25 · Средняя бронза",
    "era": "bronze",
    "stats": { "places": 19, "stages": 8, "verses": 59, "arch": 26 },
    "viewport_init": { "cx": 1070, "cy": 655, "w": 1900 }
  },
  "stories": [
    {
      "id": "main",
      "label": "Весь путь",
      "description": "От Ура до горы Мория",
      "active_by_default": true,
      "place_ids": ["ur", "harran", "damascus", "shechem", "bethel", "egypt", "hebron", "salem", "dan", "sodom", "beersheba", "moriah"],
      "stage_ids": [0,1,2,3,4,5,6,7]
    },
    {
      "id": "lekh-lekha",
      "label": "Лех-леха",
      "description": "Призвание и первый путь в Ханаан",
      "place_ids": ["harran", "damascus", "shechem", "bethel"],
      "stage_ids": [0, 1],
      "highlight_color": "#e8c879"
    },
    {
      "id": "lot",
      "label": "Линия Лота",
      "description": "От раздела с Авраамом до Цоара",
      "place_ids": ["bethel", "sodom", "hammam", "zoar", "lot-cave"],
      "stage_ids": [3, 5],
      "highlight_color": "#e0813f"
    },
    {
      "id": "war-of-kings",
      "label": "Война царей",
      "description": "Ночной рейд и Мелхиседек",
      "place_ids": ["hebron", "dan", "hovah", "salem"],
      "stage_ids": [4],
      "highlight_color": "#cf5b6b"
    },
    {
      "id": "akeda",
      "label": "Акеда",
      "description": "Три дня пути к горе Мория",
      "place_ids": ["beersheba", "salem"],
      "stage_ids": [7],
      "highlight_color": "#c4a0ff"
    }
  ],
  "places": [ /* массив PLACES — без изменений */ ],
  "stages": [ /* массив STAGES */ ],
  "ctx": [ /* контекстные точки */ ],
  "timeline": [ /* события хронологии 175 лет */ ]
}
```

**Ключевое нововведение: `stories[]`** — массив «сюжетов» на одной карте.  
При выборе сюжета активируются только нужные маркеры и маршруты, остальные dim.

---

### 1.3 map-engine.js — публичный API движка

```javascript
// Инициализация: engine подхватывает route.json и рисует карту
const engine = MapEngine.init({
  svgId: 'svg-map',
  routeData: routeJson,     // подгружается из route.json
  baseGeo: baseGeoSvg,      // инлайн или fetch
  onPlaceOpen: (place) => {},
  onStageChange: (stage) => {},
  onStoryChange: (story) => {}
});

// API для внешнего кода страницы:
engine.flyTo(cx, cy, w, duration);
engine.openPlace(id);
engine.setStory(storyId);       // ← главная новая функция
engine.nextPlace();
engine.prevPlace();
engine.startTour();
engine.stopTour();
engine.setZoom(factor);
engine.getState();              // {place, story, stage, zoom}
engine.shareURL();              // deeplink с состоянием
```

---

## ЧАСТЬ 2: MULTI-STORY MAP — «МУЛЬТИКАРТА»

### 2.1 Концепция

На **одной и той же карте** пользователь может выбрать разные «сюжеты»:

- **«Весь путь»** — все 19 мест + 8 этапов (текущий вид)
- **«Линия Лота»** — только города долины, маршрут Лота (медный цвет)
- **«Война царей»** — этап IV, военный маршрут (красный цвет)
- **«Акеда»** — только Беэр-Шева + Мория, крупный план
- **«Лех-леха»** — только призвание и первый путь

При переключении сюжета:
1. Карта плавно летит (`flyTo`) к bbox выбранных мест
2. Нерелевантные маркеры тускнеют (`opacity: .15`)
3. Нерелевантные маршруты скрываются
4. Заголовок и подзаголовок меняются
5. Хронология фильтруется по событиям сюжета

### 2.2 UI — Story Switcher (переключатель сюжетов)

```
┌─────────────────────────────────────────┐
│  [Весь путь] [Лех-леха] [Война] [Акеда] │
│  [Линия Лота]                            │
└─────────────────────────────────────────┘
```
- На десктопе: горизонтальные pill-кнопки над тайм-баром или слева
- На мобиле: горизонтальный scroll-row с chips в верхней части
- Активный сюжет — золотой фон
- Первый сюжет — «Весь путь» всегда по умолчанию

### 2.3 Deeplink для сюжетов

`/karty/avraam/#story=lot` — открывает сразу линию Лота  
`/karty/avraam/#story=akeda&place=salem` — Акеда + открытая панель Мории

---

## ЧАСТЬ 3: АРХИТЕКТУРА BASE-GEO (общая подложка)

### 3.1 Что выносится в base-geo.svg

| Слой | Содержимое | Общий для карт |
|---|---|---|
| `terrain` | фон суши, градиенты пустынь/плодородных зон | ✅ |
| `seas` | Средиземное, Красное, Персидский залив, Акаба | ✅ |
| `rivers` | Нил, Тигр, Евфрат, Иордан, Оронт | ✅ |
| `dead-sea` | Мёртвое море (контур) | ✅ |
| `galilee` | Кинерет (контур) | ✅ |
| `cyprus` | о. Кипр | ✅ |
| `grain-filter` | шумовой фильтр текстуры | ✅ |
| `glow-filter` | фильтр свечения маркеров | ✅ |
| `region-labels` | МЕСОПОТАМИЯ, ХАНААН, ЕГИПЕТ | с era-метками |
| `sea-labels` | ВЕЛИКОЕ МОРЕ, КРАСНОЕ МОРЕ | ✅ |
| `trade-routes` | Via Maris, Царская дорога, Сура, Патриархов | ✅ |
| `mountains` | Гевал, Геризим, Кармил, Синай-силуэт | частично |

### 3.2 Топонимы с era-метками

```json
{
  "id": "ur-haldeiskiy",
  "label_ru": "Ур Халдейский",
  "label_he": "אוּר כַּשְׂדִּים",
  "x": 1710, "y": 897,
  "era": ["bronze"],          // показывать только на картах bronze
  "zoom_min": 0               // видно всегда
},
{
  "id": "babylon",
  "label_ru": "Вавилон",
  "label_he": "בָּבֶל",
  "x": 1472, "y": 758,
  "era": ["bronze", "iron"],
  "zoom_min": 1
}
```

---

## ЧАСТЬ 4: ТОЧНОСТЬ КАРТЫ — КРИТИЧЕСКИЕ ПРАВКИ

### 4.1 Маршрут Ур→Харран (P1 — самое важное)

**Проблема:** текущий путь Stage 0 срезает через пустыню.  
**Исторически верно:** вдоль Евфрата через Вавилон → Мари → Каркемиш → Харран.

**Исправленный path:**
```
M1710,897
C1680,860 1640,828 1600,800
C1555,765 1510,740 1472,755
C1430,698 1380,648 1330,625
C1295,610 1260,595 1240,580
C1215,560 1200,510 1189,470
C1140,435 1080,395 1035,360
C1010,330 1000,290 1003,194
```
Путь теперь:
- Проходит через SVG-позицию Вавилона (~1472, 755)
- Проходит через SVG-позицию Мари (~1189, 470)
- Огибает реку Евфрат (SVG ~x:900-1200, y:200-800)

### 4.2 Маркер Ур Халдейский (P2 — критично)

```javascript
{
  id: "ur",
  name: "Ур Халдейский",
  he: "אוּר כַּשְׂדִּים",
  tr: "Ур Касдим",
  x: 1710, y: 897,
  type: "main",
  era: ["bronze"],
  stage: 0,
  kick: "Начало: шумерский мегаполис III тыс. до н. э.",
  id1: "Тель эль-Мукаяр",
  id2: "Южный Ирак, ~15 км от Насирии",
  ep1: "Быт 11:28,31; 15:7; Неем 9:7",
  ep2: "исход рода Тераха из Ура",
  side: "l",
  story: `<p>Великий шумерский мегаполис, столица III династии Ура (~2112–2004 гг. до н. э.) — один из крупнейших городов древнего мира (35 000–65 000 жителей). Здесь родился Аврам, здесь умер Аран, отец Лота. Отсюда Терах «вышел с ними из Ура Халдейского, чтобы идти в землю Ханаанскую» (Быт 11:31).</p>
  <p>Ур и Харран связывал общий культ лунного бога Сина — «Наннар» в Уре, «Эхульхуль» в Харране. Семья патриарха перешла из одной «лунной столицы» в другую.</p>`,
  bible: `<div class="verse">«Ты, Господи Боже, избрал Аврама, и вывел его из Ура Халдейского, и дал ему имя Авраама».<span>НЕЕМИЯ 9:7</span></div>
  <div class="verse">«И взял Терах Аврама, сына своего… и вышли с ними из Ура Халдейского».<span>БЫТИЕ 11:31</span></div>`,
  arch: `<p>Раскопки Леонарда Вулли (1922–1934, совместная экспедиция Британского музея и Пенсильванского университета): зиккурат Ур-Намму (~2100 г. до н. э., основание 64×45 м, высота ~15 м в сохранившемся состоянии), «Царские гробницы» (~2600 г. до н. э.) с уникальными украшениями из лазурита и золота, «Великая яма смерти» с ритуальными захоронениями свиты.</p>
  <p>Клинописные архивы из Ура содержат имена, типологически схожие с именами рода Авраама: «Аб-ра-му», «Иа-ку-ба-лум» (Иаков-Эль). Нео-шумерские тексты III династии (~2100–2000 гг. до н. э.) фиксируют развитую торговлю с Дилмуном (Бахрейн), Маганом (Оман) и Мелуххой (Инд) — Ур был настоящей торговой столицей мира.</p>
  <div class="note"><b>Культ Сина:</b> главное святилище Ура — «Экишнугаль», храм лунного бога Нанны/Сина. Та же лунная традиция в Харране (Эхульхуль) — семья Тераха «путешествует» между двумя центрами одного культа, что объясняет остановку именно там.</div>`
}
```

### 4.3 Беэр-лахай-рои → тип кандидата (P3)

Изменить `type:"main"` → `type:"cand"`, добавить в начало story:
```
<p class="note">📍 Точная локализация неизвестна — маркер приблизительный (Быт 16:14: «между Кадешем и Бередом»).</p>
```

### 4.4 Кинерет — исправить форму

Текущий: `cx=668, cy=670, r=маленький` (почти точка).  
Нужно: вытянутый эллипс СЗ→ЮВ (~21×12 км → ~23×13 SVG-единиц):
```xml
<ellipse cx="658" cy="673" rx="7" ry="13" 
  transform="rotate(-25 658 673)"
  fill="#10263a" stroke="#2e4d6b" stroke-width=".9"/>
```

### 4.5 Акабский залив — подписать

Добавить в sea-labels (рядом с нижним концом Красного моря):
```xml
<text class="sea-label lbl-z1" x="730" y="1290" font-size="8"
  transform="rotate(38 730 1290)" letter-spacing=".18em">ЗАЛИВ АКАБА · יָם סוּף</text>
```

---

## ЧАСТЬ 5: UX ШЕДЕВРА — ЧТО ДЕЛАЕТ КАРТУ НЕЗАБЫВАЕМОЙ

### 5.1 Десктоп — финальный список фич

| Фича | Статус | Приоритет |
|---|---|---|
| Кинотур по этапам | ✅ есть | — |
| Клик по маркеру → панель | ✅ есть | — |
| Поиск Ctrl+K | ✅ есть | — |
| Minimap | ✅ есть | — |
| Масштабная линейка | ✅ есть | — |
| Колесо мыши / двойной клик zoom | ✅ есть | — |
| Линейка расстояний | ✅ есть | — |
| Хронология 175 лет | ✅ есть | — |
| Родословное дерево | ✅ есть | — |
| Источники / метод | ✅ есть | — |
| Dark mode auto | ✅ есть | — |
| **Story Switcher (мультикарта)** | ❌ нет | 🔴 P1 |
| **Маркер Ур Халдейский** | ❌ нет | 🔴 P2 |
| **Исправленный маршрут Ур→Харран** | ❌ нет | 🔴 P3 |
| **Легенда типов маркеров** | ❌ нет | 🟡 P4 |
| **DrawSVG анимация маршрута** (GSAP бесплатно с 2025) | ❌ нет | 🟡 P5 |
| **Animated caravan dot** вдоль пути | ❌ нет | 🟡 P6 |
| **Hover-preview маркера** (мини-карточка без клика) | ❌ нет | 🟡 P7 |
| **Keyboard nav** (Tab между маркерами) | ❌ нет | 🟡 P8 |
| **View Transitions API** при смене сюжета | ❌ нет | 🟢 P9 |
| **Акабский залив подписан** | ❌ нет | 🟢 P10 |
| Кинерет — правильная форма | ❌ нет | 🟢 P11 |

### 5.2 Мобайл — критический аудит

**Текущие проблемы на мобиле:**
1. Панель остановки (aside) занимает ~92vw — хорошо, но кнопки «ПРЕДЫДУЩЕЕ / СЛЕДУЮЩЕЕ» мелкие
2. Кнопки инструментов (правый столбец) при открытой панели сдвигаются правильно, но на узких экранах (<390px) частично перекрываются
3. Pinch-zoom работает через `pointer events` — хорошо, но нет `touch-action: none` на SVG → возможны конфликты с браузерным scroll
4. Этапы (stage chips) в нижней полосе горизонтально скроллятся — хорошо
5. **Нет haptic feedback** (Vibration API) при открытии маркера — мелочь, но wow-эффект
6. **Нет full-screen кнопки** (Fullscreen API) — на мобиле карта выиграла бы от полноэкранного режима
7. **Свайп по карте** с открытой панелью закрывает её через swipe-down — нет swipe-left/right для перехода между маркерами

**Что добавить для мобайла:**

```javascript
// Haptic при открытии маркера
if (navigator.vibrate) navigator.vibrate(12);

// Swipe left/right между маркерами в открытой панели
// (используем pointer events, уже есть в коде)
panel.addEventListener('pointerdown', ...) // добавить swipe-x для next/prev

// Fullscreen button
const fsBtn = document.createElement('button');
fsBtn.onclick = () => document.documentElement.requestFullscreen?.();
```

### 5.3 DrawSVG — анимация «рисования» маршрута (GSAP, бесплатно)

GSAP с апреля 2025 полностью бесплатен, включая DrawSVG и MotionPath.

```javascript
// При входе в этап — маршрут «рисуется» от точки A к точке B
gsap.from(routePath, {
  drawSVG: "0%",
  duration: 1.8,
  ease: "power2.inOut"
});

// Animated caravan dot вдоль пути
gsap.to(caravanDot, {
  motionPath: { path: routePath, autoRotate: true },
  duration: 4,
  ease: "power1.inOut"
});
```

### 5.4 Hover-preview без клика

При hover на маркер (только desktop) — компактная карточка 240×80px:
- Иврит + название
- Одна строка kick
- «Нажмите для подробностей»

Появляется через 200ms (не мешает быстрому скроллу), исчезает при уходе мыши.

```css
.marker-preview {
  position: fixed;
  width: 240px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
  padding: 10px 14px;
  pointer-events: none;
  opacity: 0;
  transition: opacity .2s;
  backdrop-filter: blur(14px);
}
.marker-preview.visible { opacity: 1; }
```

### 5.5 Story Switcher — UI-дизайн

```html
<!-- Desktop: в верхнем левом углу, под brand -->
<nav id="story-nav" aria-label="Выбор сюжета">
  <button class="story-btn active" data-story="main">Весь путь</button>
  <button class="story-btn" data-story="lekh-lekha">Лех-леха</button>
  <button class="story-btn" data-story="lot">Линия Лота</button>
  <button class="story-btn" data-story="war-of-kings">Война царей</button>
  <button class="story-btn" data-story="akeda">Акеда</button>
</nav>
```

```css
#story-nav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.story-btn {
  background: var(--panel);
  border: 1px solid rgba(255,255,255,.12);
  color: var(--txt-dim);
  font-size: 10.5px;
  letter-spacing: .14em;
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: .2s;
}
.story-btn:hover { border-color: var(--gold-dim); color: var(--txt); }
.story-btn.active { 
  background: rgba(232,200,121,.12); 
  border-color: var(--gold); 
  color: var(--gold); 
}

/* Mobile: в верхней полосе, скроллится горизонтально */
@media (max-width: 760px) {
  #story-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    padding: 8px 12px;
    overflow-x: auto;
    flex-wrap: nowrap;
    background: linear-gradient(to bottom, rgba(5,8,13,.95), transparent);
    z-index: 28;
  }
}
```

---

## ЧАСТЬ 6: R&D НАХОДКИ — ИЮНЬ 2026

### 6.1 Конкуренты (изучены)

| Проект | URL | Сильные стороны | Слабые стороны | Чему учиться |
|---|---|---|---|---|
| **Anselm Atlas** | anselm-project.com/blog/anselm-atlas | 190 мест, route-builder, честные «uncertainty marks», реальные расстояния | Нет кинотура, нет иврита, западный проект | Uncertainty marks (пунктир=неточно) уже есть у нас ✓ |
| **3dBibleMaps** | 3dbiblemaps.com | 3D-рельеф, terrain controls, pan/pitch/spin | Тяжёлый, без оффлайн, нет русского | 3D-terrain как будущая фича |
| **Bible Mapper** | preceptaustin.org | кастомизируемые карты | Устарел визуально | — |

**Вывод:** gospod-bog.ru на уровне выше Anselm Atlas по глубине контента (иврит, вкладки Сюжет/Писание/Арх). Нужно добавить: Story Switcher, DrawSVG анимацию, исправить маршрут.

### 6.2 Технологии — что применяем

| Технология | Статус 2026 | Применение |
|---|---|---|
| **GSAP + DrawSVG** | ✅ Бесплатно с апреля 2025 | Анимация «рисования» маршрутов, caravan dot |
| **GSAP MotionPath** | ✅ Бесплатно | Движение верблюда/точки вдоль пути |
| **CSS Scroll-Driven Animations** | ✅ Chrome/Edge 115+, Safari 26, Firefox flag | Хронология, параллакс — осторожно (Firefox) |
| **View Transitions API** | ✅ Chrome 111+, Safari 18+, Firefox 133+ | Смена сюжетов, переходы между маркерами |
| **Pointer Events API** | ✅ Universal | Уже используется для pan/zoom/pinch |
| **Fullscreen API** | ✅ Universal | Кнопка полноэкранного режима для мобайла |
| **Vibration API** | ✅ Chrome/Android (не Safari) | Haptic при открытии маркера |
| **CSS Container Queries** | ✅ Universal 2026 | Адаптив панели без медиазапросов |
| **Web Share API** | ✅ Mobile browsers | Замена clipboard copy на нативный шаринг |

### 6.3 Паттерны UX — что берём

| Паттерн | Откуда | Применение |
|---|---|---|
| **Progressive disclosure** | Nielsen Norman Group | Маркер → кратко → табы СЮЖЕТ/ПИСАНИЕ/АРХ |
| **Overview → detail** | InfoVis | Кинотур даёт overview, клик — detail |
| **Focus+context** | Bret Victor | При выборе сюжета: фокус на нужных, контекст остальных dim |
| **Uncertainty marks** | Anselm Atlas | Пунктирный кружок для кандидатов (уже есть ✓) |
| **Scrollytelling** | NYT, NatGeo | Для хаба /karty/ — возможная будущая фича |
| **Story chapters** | ArcGIS StoryMaps | = наш Story Switcher |
| **DrawSVG path reveal** | Tympanus Codrops | Анимация маршрута «от руки» |
| **Spatial UI** | Apple Vision Pro 2025 | Карточки с depth/blur — уже используем backdrop-filter |

### 6.4 Источники для контента карт

| Тема | Источник | Качество |
|---|---|---|
| Координаты библейских мест | bibleplaces.com, BibleAtlas.org | ★★★★ |
| Анселм Атлас | anselm-project.com | ★★★★★ (190 мест, честные данные) |
| Ретракции и свежая наука | retraction-watch.com | ★★★★ |
| Торговые пути бронзового века | Kuhrt «The Ancient Near East» | ★★★★★ |
| Археология Ура | woolley-ur.com / British Museum | ★★★★★ |
| Карты Мадабы | madabamap.org | ★★★★ |
| Египетские тексты проклятий | ANET (Pritchard) | ★★★★★ |

---

## ЧАСТЬ 7: ХАААБ /karty/ — РЕДИЗАЙН

### 7.1 Текущие проблемы

- Карточки «В разработке» — просто `div`, не `<a>`
- Нет счётчика «X карт доступно из N»
- Нет подписки/уведомления о новых картах
- Нет поиска по картам (при наличии 5+ карт нужен)
- Компас декоративный, но не кликабельный

### 7.2 Улучшения хаба

1. **Прогресс-бар разработки**: «Исход — 40% готово» (ориентирует пользователя)
2. **Web Share API** — «Поделиться разделом Карты»
3. **Hover-анимация** на карточках карт (лёгкий parallax иконки)
4. **Breadcrumb** для SEO (уже есть в JSON-LD, добавить видимый)
5. **RSS/уведомление**: «Подпишитесь, чтобы узнать о новой карте» → Telegram

---

## ЧАСТЬ 8: ROADMAP ЗАДАЧ

### Sprint 1 — Точность и Мультикарта ✅ ЗАКРЫТ
- [x] P1: Исправить маршрут Ур→Харран (огибание Евфрата через Мари)
- [x] P2: Добавить маркер Ур Халдейский с полной панелью
- [x] P3: Беэр-лахай-рои → тип `cand` + note
- [x] P4: Кинерет — правильный эллипс rotate(-20)
- [x] P5: Акабский залив подписан (יָם סוּף)
- [x] P6: Горные символы Гевал/Геризим + Хермон + Синай + Кармил + Ливан
- [x] P7: Легенда типов маркеров в панели «Слои»
- [x] P8: Story Switcher (5 сюжетов: Весь путь/Лех-леха/Лот/Война/Акеда)

### Sprint 2 — Анимации и Мобайл ✅ ЗАКРЫТ
- [x] GSAP 3.13 CDN: DrawSVG анимация маршрутов (анимируется при входе в этап)
- [x] GSAP MotionPath: caravan dot с trail glow вдоль пути
- [x] Hover-preview на маркерах (desktop, 200ms, thumbnail фото)
- [x] Fullscreen API кнопка (мобайл)
- [x] Haptic (Vibration API) при открытии маркера + swipe
- [x] Swipe left/right панели (prev/next маркер)
- [x] touch-action:none + bottom sheet 92svh + iOS fallbacks

### Sprint 3 — Архитектура под вторую карту ✅ CORE ЗАКРЫТ (2026-06-14)
- [x] Вынести движок в `_engine/map-engine.js` (v0.2 reusable core: loadRoute/normalize/validate + viewport/flyTo/zoom/pan + story/tour/share)
- [x] Вынести базовую географию в `_engine/base-geo.svg` (34KB extract)
- [x] Создать `karty/avraam/route.json` v2 full data (PLACES/STAGES/CTX/STORIES + 40 verified photos + 5 verified_waypoints + 47 scientific_variants + yec_position/notes, r157)
- [x] Создать `karty/ishod/` scaffold + route.json (7 мест, 6 этапов)
- [x] Хаб: прогресс Исхода + ссылки (карточка теперь <a>)
- [x] QA: `MapEngine.validateRoute(route.json)` green (19 places / 8 stages / 5 stories / 7 ctx / 40 photos)

### Sprint 4 — Карта Исхода (Ishod)
- [ ] Маршрут Раамсес → Суккот → Мара → Синай → Кадеш → Моав
- [ ] ~30 мест (Числа 33: все станы)
- [ ] Дебаты о переправе (Суэц vs. Акаба vs. Тростниковое море)
- [ ] Хронология 40 лет
- [ ] Базируется на том же движке и base-geo.svg

### Wave-26 (2026-06-14) — Abraham map hardening
- **Verified media:** 38 Wikimedia assets checked through Commons API and switched to `Special:FilePath` redirects; LOC Matson and Ritmeyer direct assets preserved. This fixes broken thumbnails that previously caused photo cards to disappear.
- **Runtime stability:** dangling marker-preview code using `g/pl` outside the marker loop was removed; marker hover, long-press, and keyboard activation now live inside the marker builder.
- **Tour UX:** caravan dot upgraded to a small SVG Abraham figure (cloak, staff, Hebrew label אַבְרָם) with pause halo at each stop; reduced-motion safe.
- **Engine:** `map-engine.js` is no longer a placeholder; future maps can load JSON and use a shared viewport/story/tour API. Avraam still keeps its inline visual runtime until Ishod migration, to avoid regression.

### Wave-27 (2026-06-14) — Browser QA fixes
- Playwright desktop/mobile smoke added manually for Avraam: markers/routes/ctx counts, route audit, panel/photos/modal, story switcher, tour walker, search, mobile panel.
- Fixed `animateStageRoutes is not defined` caused by a script-boundary split before GSAP setup.
- Fixed `captionSpring` horizontal transform: caption no longer leaves the viewport (`rect.x=22` at 1440px).
- `startTour()` now hides the intro hint so it cannot cover the Abraham walker.
- LOC Matson image now uses canonical `tile.loc.gov` URL and CSP allows it; all 40 thumbnails load in Chromium.

### Wave-28 (2026-06-14) — Stage I verified corridor nodes
- Added `routeWaypoints` SVG layer for the historically correct Euphrates corridor: Uruk → Nippur → Babylon → Mari → Carchemish.
- Added layer toggle «Опорные узлы» + marker legend item; route.json now has `verified_waypoints[5]`.
- Waypoint labels avoid CTX duplication: Babylon/Mari use ring-only because their CTX labels already exist.
- Story-aware opacity: waypoints are bright for main/Лех-леха/stage I and dimmed for Lot/War/Akeda.
- MapEngine validator now checks waypoint ids/coords/stage and reports stats.waypoints.

### Wave-29 (2026-06-14) — Scientific variants + source recheck
- MD→code audit: old research-only/photo proposals are now implemented; current Avraam data has 40 photos, 5 waypoints, and 47 scientific variants.
- Added `SCIENCE_VARIANTS` in HTML and `scientific_variants` in route.json for all 19 places.
- Rendered panel block: «НАУЧНЫЕ ВАРИАНТЫ И ОГОВОРКИ» on story/arch tabs.
- Fixed Shechem dispute title (was accidentally Bethel/Ai wording).
- Rechecked 39 source URLs across BiblePlaces/Wikimedia/LOC/Ritmeyer/AiG/ARJ/CMI/NPAPH; documented in ABRAHAM-ARCHAEOLOGY VERIF30.

### Wave-30 (2026-06-14) — Clean source index
- Cleaned `ABRAHAM-ARCHAEOLOGY-RESEARCH-2026-06-13.md`: removed repeated research-only/proposal noise and kept a compact source index + implementation audit.
- Added German scholarly layer (WiBiLex: Bethel/Hebron/Beerscheba) and Jewish tradition/text layer (Jewish Encyclopedia / Sefaria) to the source base.
- Map source modal mentions WiBiLex + Jewish Encyclopedia/Sefaria without adding dozens of UI links.

---

## ЧАСТЬ 9: ТЕХНИЧЕСКИЕ ПРАВИЛА

### 9.1 Что НЕЛЬЗЯ делать
- ❌ Внешние карт-библиотеки (Leaflet, MapLibre, Google Maps) — ломают эстетику
- ❌ Растровые тайлы — не масштабируются в тёмной теме
- ❌ Копипаст avraam/index.html для новой карты — только через _engine/
- ❌ Отдельный поддомен для карт
- ❌ Добавление GSAP без CDN-fallback (должен работать без GSAP)

### 9.2 Что ВСЕГДА делать
- ✅ `aria-label` на всех `<input>` и `<button>`
- ✅ `prefers-reduced-motion` guard для всех анимаций
- ✅ Deep link через `location.hash`
- ✅ `touch-action: none` на интерактивном SVG
- ✅ `overscroll-behavior: none` на body при полноэкранной карте
- ✅ Inline Dark/Light theme check до отрисовки (anti-FOUC)
- ✅ JSON-LD WebPage + BreadcrumbList на каждой карте
- ✅ OG image 1200×630 с превью карты
- ✅ Uncertainty marks (пунктирный кружок) для неточных мест
- ✅ Источники в панели ИСТОЧНИКИ для каждого маркера

### 9.3 Масштаб и координаты
- **Масштаб:** 1 SVG-единица ≈ 0.92 км (задан в коде `km = len * 0.92`)
- **ViewBox:** 1900×1430 (W0×H0) — не менять!
- **Охват:** Египет (x≈220) → Персидский залив (x≈1900), Турция (y≈0) → Синай (y≈1430)
- **Евфрат** течёт примерно по x≈900–1500, y≈190–960
- **Тигр** — x≈1200–1900, y≈200–960

---

## ЧАСТЬ 10: КЛЮЧЕВЫЕ КООРДИНАТЫ SVG (справочник)

| Место | x | y | Реальные координаты |
|---|---|---|---|
| Ур Халдейский | 1710 | 897 | 30.96°N, 46.10°E |
| Харран | 1003 | 194 | 36.87°N, 39.03°E |
| Дамаск | 731 | 594 | 33.51°N, 36.29°E |
| Сихем | 628 | 748 | 32.21°N, 35.28°E |
| Бет-Эль | 624 | 782 | 31.93°N, 35.24°E |
| Иерусалим/Мория | 623 | 800 | 31.78°N, 35.23°E |
| Хеврон | 610 | 829 | 31.53°N, 35.10°E |
| Беэр-Шева | 584 | 864 | 31.24°N, 34.79°E |
| Дан | 665 | 625 | 33.25°N, 35.65°E |
| Хацор | 658 | 648 | 33.03°N, 35.56°E |
| Мегиддо | 613 | 706 | 32.58°N, 35.18°E |
| Содом/Баб эд-Дра | 669 | 880 | ~31.0°N, 35.5°E |
| Цоар | 660 | 907 | ~30.85°N, 35.47°E |
| Кадеш-Барнеа | 542 | 934 | 30.66°N, 34.38°E |
| Герар | 561 | 847 | 31.35°N, 34.47°E |
| Египет (Дельта) | 260 | 916 | 30.8°N, 31.2°E |
| Вавилон | 1472 | 758 | 32.54°N, 44.42°E |
| Мари | 1189 | 470 | 34.55°N, 40.89°E |
| Эбла | 800 | 300 | 35.80°N, 36.80°E |
| Ниневия | 1410 | 256 | 36.36°N, 43.16°E |
| **Антиохия (для Павла)** | **780** | **232** | **36.20°N, 36.16°E** |
| **Рим (для Павла)** | **-100** | **410** | **41.90°N, 12.50°E** |
| **Синай (гора Хорив)** | **680** | **1300** | **28.54°N, 33.97°E** |
| **Раамсес** | **210** | **880** | **30.78°N, 31.82°E** |

---

*Обновлять этот файл при каждом добавлении новой карты или фичи.*  
*Последнее обновление: 2026-06-13, Arena Agent.*

---

## ОБНОВЛЕНИЕ 2026-06-13 (wave-4)

### Реализовано
- Вкладка «ИВРИТ» в каждом маркере: he_deep поле, CSS he-block
- dispute-block с conf-hi/med/lo тегами надёжности
- bible_extra: расширенные цитаты и bib-note
- SVG: edgeFog, Ливан, Синай пик, Хермон, реки с ивритом

### Позиция по спорным местам (зафиксировано)
- **Ур:** Тель эль-Мукайяр (основная) > Урфа (альтернатива серьёзная)
- **Содом:** ЮВ берег Мёртвого моря (основная) + Хаммам (ослаблен 2025)
- **Мория:** Иерусалим (очень высокая надёжность) > Гаризим (низкая)
- **Правило:** не давать уверенности там, где её нет у учёных

### Богословская позиция (для всех карт)
- Консервативная / реформатская: 6-дневное творение ex nihilo
- Исторический потоп, патриархи — реальные исторические фигуры
- Хронология: библейская (Авраам ~2100–1900 г. до н. э.)
- Типология: события ВЗ как прообразы НЗ (Акеда→Голгофа, Мицраим→Исход)
- Антиципирующие топонимы — не противоречие, а авторский приём

---

## ОБНОВЛЕНИЕ 2026-06-13 (wave-15 + bug-fixes)

### Финальное состояние карты Авраама (karty/avraam/index.html)

**Статистика:**
- 3625 строк | 340KB | 1 style block | 9 script tags balanced
- 19 мест × 7 полей = 133 контентных единицы (все заполнены)
- 20 фото (все места + урфа)
- 41 @keyframes анимация | 9 GSAP анимаций
- 19 dispute-блоков | 19 bible_extra | 19 he_deep

**Исправлены критические баги:**
- `92svh` → `92vh / -webkit-fill-available / 92svh` (iOS <16 fallback)
- `user-scalable=no` в viewport (нет Safari zoom при input)
- `aria-modal/aria-hidden` JS при open/close панели
- `-webkit-text-size-adjust:100%` (Safari не масштабирует текст)
- `panel translateZ(0)` (GPU layer для smooth transition)
- `#tourProgress z-index:26` (явный z-index)
- Два `<style>` блока → один (убраны дубли)
- Пустой CSS `#tabs .tab[data-t="he"]{}` убран
- Photomodal Esc — возврат фокуса
- `#intro::before pointer-events:none` — клики на кнопки работают (было заблокировано)

**Полнота контента (все 19 мест):**
- `story` ✅ 19/19
- `bible` ✅ 19/19
- `arch` ✅ 19/19
- `he_deep` ✅ 19/19 (этимология иврита)
- `bible_extra` ✅ 19/19 (богословский контекст + типология НЗ)
- `dispute` ✅ 19/19 (дискуссия + позиция YEC)
- `photos` ✅ 20/20 мест (реальные Wikimedia CC/PD фото)

**YEC позиция (зафиксировано):**
- Буквальное 6-дневное творение ex nihilo ~6000 лет
- Авраам ~2166 до н.э. (Ашшер) / ARJ v5 McClellan
- Содом = ЮВ берег Мёртвого моря (AiG 2022/2025)
- Хаммам rejected (Соф 2:9 + хронология + retraction 2025)
- Все спорные места помечены с conf-hi/med/lo

**SVG карта (детали):**
- Морей/регионов: 30+ лейблов
- Реки с ивритом: Иордан/Евфрат/Тигр/Оронт/Нил/Аббана
- Горы: Синай (2285м), Хермон (2814м), Кармил, Гевал, Геризим, Ливан, Тавр
- Острова: Кипр, Родос, Хиос, Лесбос, Крит
- Регионы: Шумер (НИППУР, УРУК, ЛАГАШ, АККАД), Ассирия, Вавилония
- Города: Каркемиш, Алеппо, Эцион-Гевер, Вифлеем, Изреель, Меридиан Иерусалима
- Анимации: 18 звёзд над Харраном (SMIL), торговые пути (dashOffset)
- Паттерны: mountainHatch, desertStipple, seaPattern, caravanGrad
- Фильтры: waterRipple (feDisplacementMap), goldGlow, neonGlow, terrainTex

*Последнее обновление: 2026-06-13 wave-15 + bug-fixes. Arena Agent.*
