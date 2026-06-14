# PERFORMANCE_BUDGETS_2026.md — Core Web Vitals, JS budgets, Astro islands

Дата: 2026-06-12  
Связано с:

- `docs/QUALITY_GATES_AND_TESTING_2026.md`
- `docs/IMAGE_PIPELINE_2026.md`
- `docs/ASTRO_STACK_DECISION_RECORD_2026.md`

---

## 1. Цель

Переход на Astro должен не просто сохранить скорость, а сделать производительность управляемой.

```text
Цель: быстрый HTML-first сайт, минимум JS, стабильные Core Web Vitals, контролируемые карты.
```

---

## 2. Core Web Vitals thresholds

Целевые официальные пороги web.dev:

```text
LCP ≤ 2.5s
INP ≤ 200ms
CLS ≤ 0.1
на 75-м перцентиле пользователей
```

Для внутреннего бюджета лучше иметь запас:

```text
LCP target: ≤ 2.0s
INP target: ≤ 150ms
CLS target: ≤ 0.05
```

---

## 3. Бюджеты по типам страниц

### 3.1 Обычная статья

```text
HTML-first content
React runtime: 0 KB
client JS: ≤ 30 KB gzip
CSS page critical: минимально
LCP: текст или cover ≤ 2.0s
CLS: ≤ 0.05
```

### 3.2 Статья с интерактивом

```text
React only for island
island hydration: client:visible или client:idle
no global hydration
JS for island: ≤ 80 KB gzip ideally
```

### 3.3 Карта

```text
transcript first
MapApp lazy/client:visible
map-engine cached
route.json cached
initial JS target: ≤ 150 KB gzip для карты
no heavy filters on low-power/mobile
```

### 3.4 Главная

```text
hero optimized
no massive carousel JS
navigation static
search/command palette client:idle
```

---

## 4. JavaScript budget

JavaScript — самый дорогой ресурс: download, parse, compile, execute. Именно он часто ухудшает INP.

Рекомендации:

```text
[ ] не грузить React на страницах без React islands
[ ] не использовать client:load по умолчанию
[ ] не делать layout-level React island
[ ] списки рендерить статически, интерактив — отдельным маленьким island
[ ] импортировать только нужное
[ ] избегать больших UI-библиотек для простых компонентов
```

Материалы по performance budgets 2026 часто дают ориентиры вроде total JS < 200–300 KB compressed для тяжёлых страниц, CSS < 50–80 KB, total page weight < 1.5 MB [4](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide). Для нашего контентного сайта бюджет должен быть строже на статьях.

---

## 5. Astro hydration rules

Astro client directives:

```text
client:load     — только критично above-the-fold
client:idle     — command palette/search после загрузки
client:visible  — карты, квизы, таймлайны, below-the-fold
client:media    — только для breakpoint-specific UI
client:only     — только если SSR невозможен
```

Astro islands architecture позволяет грузить JS только для конкретных интерактивных компонентов. `client:visible` подходит для below-the-fold элементов, `client:idle` — для менее критичных интерактивов [1](https://leapcell.io/blog/building-high-performance-content-driven-websites-with-astro-islands-architecture).

Антипаттерны:

```astro
<!-- плохо: весь список как React island -->
<ArticleList client:load posts={posts} />

<!-- хорошо: статический список + маленький интерактив -->
{posts.map((post) => <ArticleCard post={post} />)}
<FilterPanel client:idle />
```

---

## 6. LCP strategy

LCP обычно:

```text
hero image
large heading
video poster
```

Правила:

```text
[ ] определить реальный LCP element
[ ] если LCP image — не lazy-load
[ ] использовать fetchpriority="high" только для настоящего LCP image
[ ] preload для критической картинки/шрифта при необходимости
[ ] WebP/AVIF, responsive sizes
[ ] self-host fonts
[ ] font-display: swap
[ ] не ждать client JS для основного контента
```

Материалы по LCP 2026 подчёркивают: lazy-loading hero/LCP image — частая ошибка; для LCP image нужен eager/high priority, иногда `<link rel="preload" as="image">` [1](https://dev.to/helloashish99/images-fonts-third-party-scripts-lcp-and-cls-idc).

---

## 7. INP strategy

INP — главный риск интерактивных страниц и карт.

Причины плохого INP:

```text
long tasks > 50ms
heavy hydration
analytics on every click
large DOM updates
expensive filters/search
SVG pointermove/layout thrash
```

Правила:

```text
[ ] event handlers do minimal sync work
[ ] expensive work after visual feedback
[ ] requestAnimationFrame for pointermove UI updates
[ ] scheduler.yield()/setTimeout yielding for long tasks
[ ] debounce/throttle scroll/resize
[ ] web worker for heavy computation if needed
[ ] avoid re-rendering huge trees on click
```

Практические руководства по INP 2026 часто называют `scheduler.yield()`/yielding одним из самых эффективных способов разбить long tasks и дать браузеру обработать взаимодействия [2](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide).

---

## 8. CLS strategy

Правила:

```text
[ ] width/height на img/video
[ ] aspect-ratio для media containers
[ ] reserve space для lazy content
[ ] no inserting banners above content on load
[ ] fonts with swap/optional and stable fallback metrics where possible
[ ] avoid late-loading layout CSS
```

CLS часто самый дешёвый для исправления: размеры изображений, место под блоки, отсутствие внезапных вставок.

---

## 9. Fonts

Текущие шрифты self-hosted — это плюс.

Правила:

```text
[ ] оставить self-hosted fonts
[ ] preload только критические above-the-fold weights
[ ] font-display: swap
[ ] не грузить лишние начертания
[ ] проверить CLS при смене fallback → custom
```

---

## 10. Third-party scripts

Текущая аналитика: Yandex.Metrika.

Правила:

```text
[ ] async/defer
[ ] не блокировать LCP
[ ] не вызывать тяжёлую синхронную работу на каждый click
[ ] протестировать INP на страницах с метрикой
[ ] не добавлять chat/widgets без фасада
```

---

## 11. Карты: performance rules

Для `/karty/avraam/` и будущих карт:

```text
[ ] transcript HTML rendered first
[ ] MapApp грузится только когда нужен
[ ] route data separate and cacheable
[ ] SVG filters reduced on mobile/low-power
[ ] pointermove tooltip через rAF
[ ] no layout reads after writes in loops
[ ] prefers-reduced-motion respected
[ ] large modals not in main interaction path
```

---

## 12. Measurement

### Lab

```text
Lighthouse
PageSpeed Insights
WebPageTest
Chrome DevTools Performance
Playwright traces
```

### Field

```text
CrUX / Search Console CWV
Yandex metrics if available
future web-vitals RUM optional
```

INP лучше всего ловить field/RUM, потому что lab не всегда воспроизводит реальные взаимодействия.

---

## 13. CI budget idea

Будущий `lighthouserc.json`:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.9 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["warn", { "maxNumericValue": 0.1 }],
        "total-byte-weight": ["warn", { "maxNumericValue": 1500000 }]
      }
    }
  }
}
```

Не делать Lighthouse CI блокирующим в первой фазе — сначала собрать baseline. Потом включать warnings, потом selective errors.

---

## 14. Performance checklist перед merge

```text
[ ] статья без React не грузит React
[ ] LCP image не lazy
[ ] hero/cover optimized
[ ] img dimensions есть
[ ] no layout shifts
[ ] no huge JS dependency
[ ] islands use correct client directive
[ ] mobile проверен
[ ] map interactions не лагают
```

---

## 15. Итог

Astro даст скорость только при дисциплине:

```text
static-first, islands-small, JS-budgeted, images-optimized, maps-lazy.
```
