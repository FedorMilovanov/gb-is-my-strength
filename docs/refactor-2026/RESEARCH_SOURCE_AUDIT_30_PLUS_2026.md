# RESEARCH_SOURCE_AUDIT_30_PLUS_2026.md — 30+ источников и выводы для рефакторинга

Дата: 2026-06-12  
Назначение: зафиксировать источники, которые влияют на решения по Astro, SEO, картам, доступности, performance и редакционному workflow.

---

## 1. Ключевой итог дополнительной перепроверки

После прохода по официальным Astro/Google/W3C/Pagefind/Yandex/MDN источникам текущие решения подтверждаются:

```text
1. Astro + build-time content collections — правильный фундамент для статей/серий/карт.
2. React islands — только для настоящего интерактива, не для layout/статей.
3. Structured data — JSON-LD, точный, видимый пользователю контент, меньше типов, но качественно.
4. Internal links — только crawlable <a href>, descriptive anchors, никаких важных JS-only links.
5. Карты — data-first custom SVG, route.json + schema + validation.
6. WCAG 2.2 — особенно важно для карт: drag alternatives, target size, focus not obscured.
7. CSP — только phased hardening; Yandex.Metrika требует отдельного учёта.
8. Search — command manifest + Pagefind full-text как два разных слоя.
```

---

## 2. Astro official / framework sources

### 1. Astro Content Collections

URL: https://docs.astro.build/en/guides/content-collections/

Важные выводы:

- collections управляют связанными наборами контента;
- build-time collections лучше для статей/документации/карт;
- live collections нужны только для часто обновляемых данных;
- live collections имеют ограничения: no MDX runtime rendering, no runtime image optimization, performance cost;
- schemas дают predictable data shape, validation и TypeScript typings;
- `glob()` — one file per entry;
- `file()` — many entries from one JSON/YAML/TOML, нужен unique `id`;
- `reference()` связывает entries;
- `getCollection()` order nondeterministic — сортировать вручную;
- `render()` даёт `<Content />` и headings;
- drafts можно фильтровать через `getCollection()`.

Влияние на проект:

```text
articles/maps/authors/series/sources → build-time collections.
Не использовать live collections на старте.
```

### 2. Astro Islands Architecture

URL: https://docs.astro.build/en/concepts/islands/

Выводы:

- Astro рендерит большинство страницы в static HTML;
- JavaScript добавляется только как islands;
- без `client:*` UI-компонент не интерактивен и не шлёт JS;
- `client:idle` и `client:visible` позволяют приоритизировать hydration;
- islands грузятся и гидратируются изолированно.

Влияние:

```text
MapApp/Search/CommandPalette/Quiz → islands.
Article layout/cards/static UI → Astro static components.
```

### 3. Astro Components / Props

URL: https://docs.astro.build/en/basics/astro-components/

Вывод:

- props типизируются через `interface Props`;
- `Astro.props` можно destructure с default values;
- `<slot />` — стандартный механизм контента.

Влияние:

```text
ASTRO_COMPONENT_INVENTORY_2026.md использует typed Props.
```

### 4. Astro TypeScript

URL: https://docs.astro.build/en/guides/typescript/

Вывод:

- `HTMLAttributes<'a'>`, `HTMLAttributes<'button'>` полезны для компонентов;
- `astro check` нужен для type-check перед build.

Влияние:

```text
build script должен быть astro check && astro build.
```

### 5. Astro Assets / Image API

URL: https://docs.astro.build/en/reference/modules/astro-assets/

Вывод:

- `Picture` генерирует optimized formats/sizes;
- formats order matters: modern first (`avif`, `webp`);
- fallbackFormat нужен для совместимости.

Влияние:

```text
IMAGE_PIPELINE_2026.md: Picture formats ['avif','webp'], fallback jpg/png.
```

### 6. Astro Sitemap integration

URL: https://docs.astro.build/en/guides/integrations-guide/sitemap/

Вывод:

- `@astrojs/sitemap` генерирует sitemap;
- `serialize()` позволяет исключать/менять entries;
- можно задавать lastmod/changefreq/priority, но Google игнорирует часть сигналов вроде priority/changefreq.

Влияние:

```text
sitemap entries из content collections, draft/noindex исключать.
```

### 7. Astro RSS recipe

URL: https://docs.astro.build/en/recipes/rss/

Вывод:

- `@astrojs/rss` генерирует feed endpoint;
- items можно строить из `getCollection()`.

Влияние:

```text
/feed.xml сохранить, генерировать из published articles.
```

### 8. Astro Keystatic guide

URL: https://docs.astro.build/en/guides/cms/keystatic/

Вывод:

- Keystatic работает через `keystatic.config.ts`;
- storage local/GitHub;
- admin UI `/keystatic`;
- если уже есть content collections, schema Keystatic должна соответствовать им.

Влияние:

```text
CMS позже; первым кандидатом остаётся Keystatic, но не на старте.
```

---

## 3. Google Search / SEO official sources

### 9. Google Structured Data intro

URL: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

Выводы:

- structured data помогает Google понимать страницу;
- нельзя добавлять structured data о невидимом пользователю контенте;
- JSON-LD recommended как easiest to implement/maintain;
- лучше меньше, но complete/accurate recommended properties;
- Rich Results Test во время разработки;
- Search Console reports после деплоя.

Влияние:

```text
STRUCTURED_DATA_GRAPH_2026.md: JSON-LD graph, visible content only.
```

### 10. Google Article structured data

URL: https://developers.google.com/search/docs/appearance/structured-data/article

Выводы:

- author best practices: `Person`, `url`/`sameAs`, author.name только имя;
- images must be crawlable/indexable;
- recommended image aspect ratios 1x1, 4x3, 16x9;
- datePublished/dateModified в ISO 8601.

Влияние:

```text
Author entity + Article schema + image policy.
```

### 11. Google Organization structured data

URL: https://developers.google.com/search/docs/appearance/structured-data/organization

Выводы:

- Organization markup лучше размещать на home или about/organization page;
- использовать наиболее конкретный subtype, если применимо;
- logo/url/sameAs/contact can clarify entity.

Влияние:

```text
Organization @id единый, не обязательно перегружать каждую страницу деталями.
```

### 12. Google ProfilePage structured data

URL: https://developers.google.com/search/docs/appearance/structured-data/profile-page

Вывод:

- `ProfilePage` с `mainEntity` Person/Organization подходит для `/about/`.

Влияние:

```text
/about/ станет author/entity hub.
```

### 13. Google Structured data gallery

URL: https://developers.google.com/search/docs/appearance/structured-data/search-gallery

Вывод:

- поддерживаемые типы: Article, Breadcrumb, Organization, Profile page, Dataset, Video и др.;
- не каждый schema.org type даёт rich result.

Влияние:

```text
Не добавлять редкие типы ради «AI магии»; держать ядро Article/Breadcrumb/Organization/ProfilePage.
```

### 14. Google Dataset structured data

URL: https://developers.google.com/search/docs/appearance/structured-data/dataset

Вывод:

- Dataset лучше ставить на canonical dataset landing pages;
- используется Dataset Search;
- JSON-LD preferred;
- `distribution`, `creator`, `license`, `sameAs` полезны.

Влияние:

```text
Dataset только если route.json публикуется как открытый dataset.
```

### 15. Google Search documentation updates

URL: https://developers.google.com/search/updates

Вывод:

- Google упрощает/меняет поддержку некоторых rich result types;
- Dataset structured data clarified as used by Dataset Search, not ordinary Google Search surfaces.

Влияние:

```text
Dataset не как общий SEO-трюк, а как data-discovery опция.
```

### 16. Google Link best practices

URL: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

Выводы:

- crawlable link = `<a href>`;
- JS-only links ненадёжны;
- anchor text descriptive, concise, relevant;
- image link anchor = image alt;
- every cared-about page should have at least one internal link;
- external source links могут establish trustworthiness;
- nofollow не использовать для всех external links, только если не доверяешь/paid/ugc.

Влияние:

```text
INTERNAL_LINKING_STRATEGY_2026.md: real links, no JS-only navigation.
```

### 17. Google URL structure

URL: https://developers.google.com/search/docs/crawling-indexing/url-structure

Вывод:

- root-relative links помогают избежать broken relative link spaces;
- избегать параметров/бесконечных URL-пространств.

Влияние:

```text
Внутренние ссылки: /articles/foo/, не ../foo.
```

### 18. Google robots meta

URL: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag

Вывод:

- `noindex` запрещает показ страницы в search results;
- если директива не указана, страница может индексироваться.

Влияние:

```text
draft != noindex; noindex управляется явно.
```

### 19. Google image SEO

URL: https://developers.google.com/search/docs/appearance/google-images

Выводы:

- использовать `<img src>`;
- descriptive alt;
- responsive `<picture>`/srcset;
- WebP/SVG/AVIF поддерживаются;
- filenames, context, structured data важны.

Влияние:

```text
IMAGE_PIPELINE_2026.md.
```

### 20. Google site moves

URL: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

Вывод:

- old→new mapping;
- self-referencing canonical;
- update internal links/sitemap;
- test redirects.

Влияние:

```text
Лучше не менять URL при Astro migration.
```

### 21. Google redirects

URL: https://developers.google.com/search/docs/crawling-indexing/301-redirects

Вывод:

- permanent server-side redirects 301/308 preferred for URL changes.

Влияние:

```text
Если URL меняется — только 301/308, без chains.
```

---

## 4. Performance / Web Vitals sources

### 22. web.dev Web Vitals

URL: https://web.dev/articles/vitals

Вывод:

```text
LCP ≤ 2.5s
INP ≤ 200ms
CLS ≤ 0.1
75th percentile mobile/desktop
```

Влияние:

```text
PERFORMANCE_BUDGETS_2026.md.
```

### 23. web.dev Debug performance in the field

URL: https://web.dev/articles/debug-performance-in-the-field

Вывод:

- `web-vitals/attribution` даёт debug_target для LCP/INP/CLS;
- field data помогает искать реальные root causes.

Влияние:

```text
В будущем добавить RUM только после стабилизации.
```

### 24. web.dev GA4 + BigQuery web vitals

URL: https://web.dev/articles/vitals-ga4

Вывод:

- можно собирать LCP/INP/CLS в GA4/BigQuery;
- нужно агрегировать last value per metric ID.

Влияние:

```text
Не первая фаза, но направление field monitoring.
```

### 25. web.dev LCP/INP baseline article

URL: https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available

Вывод:

- LCP и INP стали baseline newly available across main browsers;
- измерение web vitals становится более interoperable.

Влияние:

```text
INP monitoring важен не только для Chrome-мира.
```

---

## 5. Accessibility / WCAG sources

### 26. W3C WCAG 2.2 standard

URL: https://www.w3.org/TR/WCAG22/

Выводы:

- Dragging Movements: drag functionality must be achievable without dragging unless essential;
- Target Size Minimum: at least 24×24 CSS px or spacing exceptions.

Влияние:

```text
Карты обязаны иметь non-drag alternatives.
```

### 27. W3C What’s New in WCAG 2.2

URL: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

Вывод:

- WCAG 2.2 published W3C Recommendation 5 Oct 2023;
- 9 new success criteria since 2.1;
- target size/dragging/focus criteria особенно практичны.

Влияние:

```text
ACCESSIBILITY_STANDARD_2026.md.
```

### 28. MDN ARIA button role

URL: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role

Вывод:

- non-button with `role=button` needs tabindex and keyboard handlers;
- native `<button>` лучше.

Влияние:

```text
Компоненты: native button first.
```

### 29. Deque accessible buttons

URL: https://www.deque.com/blog/accessible-aria-buttons/

Вывод:

- `<button>` даёт Enter/Space behaviour бесплатно;
- div/span button требуют tabindex + keydown.

Влияние:

```text
Не делать кликабельные div в UI/картах без необходимости.
```

---

## 6. Search / CMS sources

### 30. Pagefind API

URL: https://pagefind.app/docs/api/

Выводы:

- search API supports filters/sort;
- result data loads independently to reduce bandwidth;
- `pagefind.filters()` даёт available filters.

Влияние:

```text
/search/ можно сделать кастомным UI поверх Pagefind.
```

### 31. Pagefind filtering

URL: https://pagefind.app/docs/filtering/

Выводы:

- `data-pagefind-filter` captures filter value;
- values can come from text, attributes, inline syntax.

Влияние:

```text
section/tag/author/date filters in ArticleLayout.
```

### 32. Pagefind + Astro practice

URL: https://deku.posstree.com/en/astro/search/

Вывод:

- Pagefind runs after Astro build: `astro build && pagefind --site dist`;
- `data-pagefind-body` limits indexed content;
- `data-pagefind-ignore` excludes nav/footer.

Влияние:

```text
SEARCH_AND_DISCOVERY_ARCHITECTURE_2026.md.
```

### 33. Keystatic Astro docs

URL: https://docs.astro.build/en/guides/cms/keystatic/

Вывод:

- Keystatic admin UI; local/GitHub storage;
- schema should match content collections.

Влияние:

```text
Keystatic later, not now.
```

### 34. Keystatic review / CMS ecosystem

URL: https://www.luckymedia.dev/insights/keystatic

Вывод:

- Keystatic strong Astro integration;
- Git-based content has Git workflow limits;
- Tina stronger for visual editing, Keystatic stronger for Astro DX.

Влияние:

```text
CMS_OPTIONS_DECISION_2026.md.
```

---

## 7. Security / CSP / Yandex sources

### 35. Yandex.Metrika CSP

URL: https://yandex.com/support/metrica/en/code/install-counter-csp

Вывод:

- script-src nonce option;
- img-src/connect-src needed;
- child-src/frame-src blob + mc.yandex.ru for session replay/click maps.

Влияние:

```text
CSP hardening must be separate phase.
```

### 36. MDN CSP script-src

URL: https://github.com/mdn/content/blob/main/files/en-us/web/http/reference/headers/content-security-policy/script-src/index.md?plain=1

Вывод:

- `unsafe-inline` is security risk;
- nonce/hash alternatives;
- nonce should be unique per request;
- hashes sensitive to whitespace.

Влияние:

```text
Static output: prefer external scripts or hashes, not runtime nonce.
```

### 37. OWASP CSP Cheat Sheet

URL: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html

Вывод:

- hashes/nonces/strict-dynamic approaches;
- avoid unsafe-inline/eval where possible.

Влияние:

```text
SECURITY_CSP_IMPLEMENTATION_PLAN.md.
```

---

## 8. Maps / GIS sources

### 38. Leaflet 2 alpha discussion

URL: https://github.com/Leaflet/Leaflet/discussions/9719

Вывод:

- Leaflet modernization: ESM, Pointer Events, no IE;
- still useful for simple maps.

Влияние:

```text
Leaflet optional preview, not main artistic engine.
```

### 39. MapLibre style spec sources

URL: https://maplibre.org/maplibre-style-spec/sources/

Вывод:

- sources hold data, layers style it;
- vector/raster/geojson/image/video sources;
- vector layers need source-layer.

Влияние:

```text
MapLibre future GIS mode only.
```

### 40. Protomaps PMTiles + MapLibre

URL: https://docs.protomaps.com/pmtiles/maplibre

Вывод:

- PMTiles protocol works via `maplibregl.addProtocol`;
- register once in app lifecycle;
- good for future vector atlas.

Влияние:

```text
Not current stage, but future /atlas/ possibility.
```

---

## 9. Decisions confirmed by this audit

```text
[confirmed] Astro build-time collections for content.
[confirmed] React islands only for interactivity.
[confirmed] JSON-LD graph with stable @id.
[confirmed] URL contract must preserve existing routes.
[confirmed] Pagefind can be added after build; command palette remains separate.
[confirmed] Keystatic later, not now.
[confirmed] Custom SVG maps remain primary.
[confirmed] route.json schema + validator is right first step.
[confirmed] CSP hardening after Astro extraction, not before.
[confirmed] WCAG 2.2 requires non-drag map alternatives.
```

---

## 10. Corrections / refinements after deeper pass

1. **Dataset schema** — useful only if route.json is public dataset; not general Google Search booster.
2. **FAQPage** — use only for visible FAQ; Google rich result landscape changes, do not rely on FAQ snippets.
3. **Content collection order** — `getCollection()` sort order nondeterministic; always sort manually.
4. **file() loader** — entries need unique `id`; good for authors/series/sources JSON.
5. **External source links** — do not nofollow all sources; Google says external links can establish trust when used properly.
6. **Yandex CSP** — session replay/click maps require frame/child-src blob handling.
7. **Maps accessibility** — SVG markers should prefer native/focusable controls or full keyboard handlers if using ARIA role.

---

## 11. Следующий источник проверки

При следующем проходе отдельно проверить:

```text
- official Astro content loader API details
- Astro image responsive layout flags/current stable behavior
- Pagefind multilingual/Russian stemming limitations
- Yandex Webmaster sitemap/indexing docs
- Map accessibility examples from WAI/APG if available
- Static hosting headers for current deployment target
```
