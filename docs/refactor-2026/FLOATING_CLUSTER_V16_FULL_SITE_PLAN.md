# Floating Cluster v16 — Полный план внедрения на весь сайт
**Дата:** 2026-06-25  
**Статус:** АКТИВНЫЙ — выполняется агентом  
**Референс:** `gb-floating-cluster-probe-v16.html` (owner-approved)  
**Компоненты:** PlayEmber=`gb-ember`, Save=`gb-save`, Icon=`gb-icon`, Floater=`gb-floater`

---

## ПРИНЦИПЫ (нарушать нельзя)

1. **1 в 1 с референсом** — классы `gb-ember`, `gb-save`, `gb-icon`, `gb-theme-toggle`, `gb-floater`, `gbs-rail-foot`
2. **Не сносить уникальность** — Нагорная сохраняет Tailwind sidebar, SVG-иконки в nav, `nagornaya-mobile-toc.js`
3. **Не дублировать** — одна тема, один поиск, один BookmarkEngine
4. **`gbs2-*` маркеры Гилла не трогать** — owner:ui-guard проверяет
5. **CSS — в компонентах/site.css, не инжектировать из JS**
6. **data/series.json — единственный источник** для readTime/titles/order

---

## КАРТА СТРАНИЦ САЙТА

### ГРУППА A — Standalone статьи (одиночный кластер `gb-floater`)
**Паттерн:** 4 кнопки сверху вниз: ThemeToggle | Search | PlayEmber(idle) | Save  
**Позиция:** fixed top-right (desktop), bottom-center pill (mobile ≤899px)

| Маршрут | Компонент | Статус |
|---|---|---|
| `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` | HermenevtikaBody.astro | ✅ Есть FloatingCluster(single) |
| `/articles/kod-da-vinchi/` | KodDaVinchiPageChrome.astro | ✅ Есть FloatingCluster(single) |
| `/articles/krajne-li-isporcheno-serdce/` | KrajneBody.astro | ❌ НЕТ кластера |
| `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` | Rimlyanam7Body.astro | ❌ НЕТ кластера |

### ГРУППА B — Серия Гилл (GBS2 rich rail)
**Паттерн:** `gbs-rail-foot` в sidebar — Theme | Search | A− | A+ | PlayEmber(32px gold) | Save  
**Мобайл:** существующий `gbs2-bbar` + PlayEmber в actions

| Маршрут | Компонент | Статус |
|---|---|---|
| `/articles/dzhon-gill-istoricheskiy-kontekst/` | GillContextPageChrome.astro | ✅ Есть GillRailControls |
| `/articles/dzhon-gill-chast-1-chelovek/` | GillPart1PageChrome.astro | ✅ Есть GillRailControls |
| `/articles/dzhon-gill-chast-2-uchenyi/` | GillPart2PageChrome.astro | ✅ Есть GillRailControls |
| `/articles/dzhon-gill-chast-3-nasledie/` | GillPart3PageChrome.astro | ✅ Есть GillRailControls |
| `/articles/dzhon-gill-spravochnik/` | GillSpravochnikPageChrome.astro | ✅ Есть GillRailControls |

### ГРУППА C — Серия «Тёмная сторона кафедры» (pastor-series, series-lite)
**Паттерн:** `gb-floater` compact — chip с названием серии + [Index] [Theme] [Search] [Play] [Save]  
**Мобайл:** горизонтальная пилюля (chip + controls)

| Маршрут | Компонент | Статус |
|---|---|---|
| `/articles/20-antisovetov-pastoru/` | AntisovetovBody.astro | ✅ Есть SeriesLiteCluster (нужна проверка классов) |

### ГРУППА D — Серия «Сердце» (hard-texts, series-lite)
**Паттерн:** как pastor-series, tone = deep-red

| Маршрут | Компонент | Статус |
|---|---|---|
| `/articles/krajne-li-isporcheno-serdce/` | KrajneBody.astro | ❌ НЕТ (серия heart) |
| `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` | Rimlyanam7Body.astro | ❌ НЕТ (серия heart) |

> **Замечание:** krajne и rimlyanam7 попадают ОДНОВРЕМЕННО в группы A и D.  
> Решение: они — серийные статьи (hard-texts), поэтому используют series-lite кластер (группа D), не одиночный.

### ГРУППА E — Баптисты России (russian-baptism, prep-only → series-lite)
**Паттерн:** series-lite (compact chip + 4 actions)  
**Статус:** owner сказал «Баптисты raw/placeholder». Добавляем кластер, но без chip названия серии.  
**Решение:** simple `gb-floater` (standalone mode) для всех 10 страниц пока серия в prep.

| Маршрут | Статус |
|---|---|
| `/baptisty-rossii/noch-na-kure/` | ❌ НЕТ кластера |
| `/baptisty-rossii/yuzhnaya-shtunda/` | ❌ НЕТ |
| ... (10 страниц) | ❌ НЕТ |

### ГРУППА F — Нагорная проповедь (ОСОБЫЙ РЕЖИМ)
**Уникальность:** Tailwind sidebar (dark), `nagornaya-mobile-toc.js`, SVG-иконки, `#themeToggle` уже есть в sidebar  
**Что НЕ трогать:** sidebar layout, Tailwind классы, `nag-sidebar-theme-btn`, SVG-иконки разделов  
**Что добавить:** PlayEmber + Save в `nag-sidebar-controls` (рядом с существующей темой)  
**Мобайл:** в существующий `bottomBar` (генерируется `nagornaya-mobile-toc.js`) добавить Play+Save кнопки через JS-инициализацию

| Маршрут | Статус |
|---|---|
| `/nagornaya/chast-1/` ... `/nagornaya/chast-5/` | ❌ Нет Play/Save |

---

## ТЗ ПО ЗАДАЧАМ

### ЗАДАЧА 1: Добавить кластер на krajne + rimlyanam7 (series heart)

**Файлы:**
- `src/components/article-pilots/krajne/KrajneBody.astro`
- `src/components/article-pilots/rimlyanam7/Rimlyanam7Body.astro`

**Что добавить:**
```astro
<FloatingCluster 
  mode="series-lite" 
  variant="heart" 
  seriesKey="hard-texts" 
  currentSlug="krajne-li-isporcheno-serdce"  // или rimlyanam-7-...
  hubHref="/hard-texts/" 
  audioState="none" 
/>
```

**Tone:** deep-red (тёмно-красный, соответствует теме «сердца»)

---

### ЗАДАЧА 2: Проверить/починить AntisovetovBody (pastor-series)

**Проверить:** использует ли SeriesLiteCluster правильные классы `gb-ember`, `gb-save`, `gb-icon`  
**Если нет:** обновить после нашего rebuild компонентов

---

### ЗАДАЧА 3: Баптисты — standalone gb-floater

Для всех 10 страниц в `baptisty-rossii/`:  
- В Astro-компонентах добавить `<FloatingCluster mode="single" variant="article" audioState="none" />`
- Подключить `floating-cluster-controller.js`

Если страницы — legacy HTML (не Astro), добавить кластер напрямую в HTML (inline компонент = div + 4 кнопки).

---

### ЗАДАЧА 4: Нагорная проповедь (хирургическое дополнение)

**НЕ трогать:** sidebar structure, Tailwind, `nag-sidebar-theme-btn`, SVG-иконки разделов, `nagornaya-mobile-toc.js`  

**Добавить в `nag-sidebar-controls` (рядом с темой):**
```html
<!-- Play ember (32px) -->
<button class="gb-ember nag-sidebar-ember" data-state="idle" style="--p:0;--ember-size:32px" 
        aria-label="Озвучка" data-fc-action="play">
  [SVG ring + glyph]
</button>
<!-- Save (без halo) -->
<button class="gb-save nag-sidebar-save" data-fc-action="save" aria-label="Сохранить">
  [SVG bookmark]
</button>
```

**Добавить в нижний bottomBar (через дополнение nagornaya-mobile-toc.js или отдельный скрипт):**  
Кнопки Play + Save вставляются после barShareBtn (крайние справа).

**Подключить:** `floating-cluster-controller.js` (только для Play+Save, не трогая тему — там уже `m.addEventListener`)

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

1. ✅ PlayEmber, SaveButton, ClusterButton, SingleArticleCluster, GillRailControls — **DONE**
2. ✅ floating-cluster-controller.js rebuild — **DONE**  
3. ✅ P0.2 + P0.3 restore — **DONE**
4. **NOW:** krajne + rimlyanam7 → series-lite (heart)
5. **NOW:** Antisovetov SeriesLite — проверка и fix классов
6. **NOW:** Баптисты — standalone floater (10 страниц legacy HTML)
7. **NOW:** Нагорная — Play+Save только, хирургически

---

## ACCEPTANCE

Сайт принят когда:
- [ ] Все статьи имеют Play+Save кнопки из референса
- [ ] Классы: `gb-ember`, `gb-save`, `gb-icon`, `gb-floater` везде консистентны
- [ ] Нагорная не сломана (sidebar, SVG, Tailwind)
- [ ] GBS2 маркеры Гилла живы
- [ ] owner:ui-guard PASS
- [ ] data:consistency PASS
- [ ] gill:reading-time:audit PASS
- [ ] cache-bust обновлён
