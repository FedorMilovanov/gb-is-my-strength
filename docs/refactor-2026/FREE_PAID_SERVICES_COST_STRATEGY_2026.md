# FREE_PAID_SERVICES_COST_STRATEGY_2026.md — бесплатные и платные сервисы в будущей архитектуре

Дата: 2026-06-12  
Статус: стратегический документ. Цены/лимиты сервисов меняются — перед фактическим подключением перепроверять официальные pricing pages.

---

## 1. Главный принцип

Пока строим архитектуру на бесплатных/локальных инструментах.

```text
Сначала: Git + MDX + Astro static + local validation + existing hosting.
Потом: подключать платные сервисы только если появилась реальная боль.
```

Не покупать сервисы заранее «на будущее».

---

## 2. Что у нас может быть полностью бесплатно

### Framework / build

```text
Astro — бесплатно, open source
React — бесплатно, open source
TypeScript — бесплатно
Zod — бесплатно
MDX — бесплатно
```

### Content workflow

```text
Git + MDX — бесплатно
Astro Content Collections — бесплатно
JSON files for authors/series/sources/maps — бесплатно
```

### Search

```text
Current search-manifest — бесплатно
Pagefind — бесплатно/open source/static files
```

Pagefind хорош тем, что индекс строится в build output и отдаётся как static assets, без backend/API/monthly bill.

### Validation / CI scripts

```text
contract:extract — бесплатно
contract:compare — бесплатно
maps:validate — бесплатно
validate.js / seo-audit — бесплатно
Playwright local — бесплатно
axe-core/playwright — бесплатно/open source
Lighthouse local — бесплатно
```

### Maps

```text
Custom SVG engine — бесплатно
route.json — бесплатно
JSON Schema — бесплатно
GeoJSON export — бесплатно
Leaflet optional — бесплатно/open source
MapLibre optional — бесплатно/open source
```

### Hosting сейчас

Текущий static hosting/GitHub Pages-like подход может оставаться бесплатным, пока хватает лимитов.

---

## 3. Что может стать платным позже

### 3.1 Hosting / CDN

#### GitHub Pages

Бесплатно, но ограничено static-only моделью и мягкими лимитами. По публичным материалам/документации часто указываются:

```text
static only
~100GB/month bandwidth soft limit
published site size limit ~1GB
build limits
no server functions
```

Подходит:

```text
small/medium static site
без server-side функций
```

Риск:

```text
много изображений/трафика может упереться в bandwidth.
```

#### Cloudflare Pages

Часто выглядит лучшим бесплатным/почти бесплатным вариантом для static Astro:

```text
free static hosting
очень щедрый bandwidth
global CDN
DDoS protection
builds/month лимиты
Workers/functions отдельно
```

Платным может стать:

```text
Workers Paid
Cloudflare Access/advanced features
R2 storage
D1/KV при расширении
больше builds/team features
```

Решение:

```text
Не мигрировать hosting сразу. Рассмотреть Cloudflare Pages после Astro prototype.
```

#### Vercel / Netlify

Могут быть удобны, но:

```text
Vercel особенно силён для Next.js
Netlify силён для Jamstack/forms
оба могут иметь bandwidth/team/analytics paid limits
```

Для Astro static сайта Cloudflare/GitHub часто рациональнее.

---

### 3.2 CMS

#### Git + MDX

```text
Цена: бесплатно
Статус: основной вариант сейчас
```

#### Keystatic Core

```text
Core: open source / бесплатно
Local mode: бесплатно
GitHub mode: может требовать GitHub access/users
Keystatic Cloud: free tier до ограниченного числа users; Pro paid для дополнительных users/Cloud Images/multiplayer
```

Подключать только если:

```text
нужен UI для редактирования;
MDX руками становится неудобным;
появляется редактор без IDE.
```

#### TinaCMS

Может быть платным при Cloud/visual workflow. Сильнее, если нужен visual editing.

#### Sanity / Storyblok / Contentful

```text
Sanity: free tier может быть щедрым, paid per user/usage
Storyblok: visual editor, но paid планы могут стать существенными
Contentful: enterprise-oriented, paid может быть дорогим
```

Не подключать сейчас.

---

### 3.3 Search SaaS

#### Pagefind

```text
бесплатно
static
рекомендуемый full-text эксперимент
```

#### Algolia

```text
может быть платно для commercial/большого использования
очень качественный поиск
но SaaS dependency
```

Не нужен на старте.

#### Meilisearch / Typesense / OpenSearch

```text
self-hosting/server cost
maintenance cost
```

Не нужен на старте.

---

### 3.4 Images / media

#### Astro assets / local Sharp

```text
бесплатно
build-time optimization
подходит для текущей стадии
```

#### Cloudinary / Imgix / Uploadcare / image CDN

```text
free tiers possible
paid при росте изображений/трафика/трансформаций
```

Подключать только если:

```text
много медиа;
Git repo раздувается;
нужны on-the-fly transformations;
нужна редакторская media library.
```

#### Keystatic Cloud Images

Платная/Pro-фича по данным Keystatic Cloud docs; полезна, чтобы не хранить binary assets в Git.

---

### 3.5 Analytics / monitoring

#### Yandex.Metrika

```text
бесплатно
уже используется
```

#### Google Search Console / Yandex Webmaster

```text
бесплатно
обязательно использовать
```

#### Plausible / Fathom / PostHog Cloud / Sentry / RUM products

```text
могут быть платными
```

Не нужны на старте. RUM можно сделать позже через lightweight web-vitals endpoint, если будет backend/Workers.

---

### 3.6 Maps / GIS data

#### Custom SVG / GeoJSON / Leaflet / MapLibre

```text
бесплатно/open source
```

#### Map tiles providers

```text
MapTiler / Mapbox / commercial tiles — paid beyond free tiers
```

Не нужны сейчас.

#### PMTiles hosting

Сам PMTiles open; hosting может быть:

```text
Cloudflare R2/S3 paid by storage/requests
```

Нужно только для будущего GIS atlas, не сейчас.

---

## 4. Рекомендуемая бесплатная дорожка

```text
1. Оставить текущий hosting.
2. Astro prototype локально.
3. Git + MDX.
4. Content Collections.
5. Local scripts validation.
6. Current search-manifest.
7. Pagefind эксперимент локально/в build.
8. Custom SVG maps route.json.
9. Yandex.Metrika + Search Console/Webmaster.
```

Стоимость:

```text
$0/month additional
```

---

## 5. Когда платить оправданно

### Cloudflare Pages/Workers/R2

Платить, если:

```text
нужен более надёжный CDN/headers/redirects;
GitHub Pages bandwidth/headers limitations мешают;
нужен Workers endpoint для RUM/search/API;
нужно R2 для media/PMTiles.
```

### Keystatic Cloud

Платить, если:

```text
нужно больше редакторов;
нужны Cloud Images;
нужен удобный GitHub editing без локальной среды.
```

### Headless CMS

Платить, если:

```text
появилась команда;
нужны роли/права;
нужен visual preview;
нужно расписание публикаций;
нужно многоязычие/complex workflows.
```

### Image CDN

Платить, если:

```text
много изображений;
repo раздувается;
нужна media library;
нужна автоматическая трансформация на лету.
```

### Search SaaS

Платить, если:

```text
Pagefind/manifest не справляются;
нужна морфология/опечатки/синонимы/аналитика поиска на высоком уровне.
```

---

## 6. Что НЕ покупать сейчас

```text
❌ Sanity/Storyblok/Contentful до content model.
❌ Algolia до Pagefind benchmark.
❌ Image CDN до появления media bottleneck.
❌ Map tiles до решения о GIS atlas.
❌ Paid RUM до стабильного Astro build.
❌ Cloudflare R2/D1/KV до реального use case.
```

---

## 7. Decision table

| Область | Сейчас бесплатно | Платное позже | Когда платить |
|---|---|---|---|
| Hosting | current/GitHub Pages | Cloudflare Pro/Workers/R2 | traffic, headers, functions |
| Framework | Astro/React | — | не нужно |
| Content | Git+MDX | Keystatic Cloud / CMS | нужен UI/команда |
| Search | manifest/Pagefind | Algolia/Meilisearch hosting | если русский поиск слабый |
| Images | Astro assets/local | Cloudinary/Keystatic Cloud Images/R2 | media scale |
| Maps | SVG/GeoJSON | tiles/R2/MapTiler | future GIS atlas |
| Analytics | Yandex/Search Console | Plausible/Sentry/RUM | advanced monitoring |
| CI | GitHub Actions/local | paid CI minutes | если лимиты |

---

## 8. Уточнение для владельца из России

Cloudflare Pages технически хорош, но не должен быть обязательной частью стратегии, потому что:

```text
[ ] доступ к dashboard из России может быть проблемным;
[ ] оплата зарубежных paid features может быть невозможной;
[ ] Cloudflare соблюдает санкционные ограничения;
[ ] российские провайдеры могут ограничивать Cloudflare-protected ресурсы;
```

Поэтому на ближайших этапах:

```text
остаемся на GitHub Pages/current static hosting;
не покупаем Cloudflare;
не строим архитектуру вокруг Cloudflare-specific функций;
держим static output portable.
```

Подробнее: `docs/RUSSIA_ACCESS_HOSTING_CONSTRAINTS_2026.md` и `docs/GITHUB_PAGES_RETENTION_PLAN_2026.md`.

## 9. Итог

Архитектура специально строится так, чтобы не зависеть от платных сервисов.

```text
Топовый фундамент ≠ сразу платная инфраструктура.
Топовый фундамент = правильные данные, HTML-first SEO, валидация, компоненты, качество.
```

Платные сервисы подключать только как усилители, когда бесплатный слой достиг предела.
