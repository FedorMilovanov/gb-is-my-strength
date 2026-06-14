# DEPLOYMENT_SECURITY_ENV_2026.md — деплой, окружение, безопасность, CSP

Дата: 2026-06-12  
Связано с:

- `docs/ASTRO_STACK_DECISION_RECORD_2026.md`
- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/QUALITY_GATES_AND_TESTING_2026.md`

---

## 1. Цель

Спланировать безопасный production-переход на Astro без потери SEO, analytics, verification файлов и статической надёжности.

---

## 2. Режим рендера

Для текущего проекта целевой режим:

```text
Astro static output by default
```

Почему:

- статьи и карты можно предварительно собрать;
- меньше runtime-зависимостей;
- проще хостинг;
- лучше для SEO и скорости;
- меньше surface area для атак.

SSR/server output пока не нужен.

---

## 3. Хостинг: варианты

### 3.1 Остаться на текущем static hosting / GitHub Pages-подобной модели

Плюсы:

```text
+ минимум риска
+ простая модель
+ статические файлы
+ текущий deploy workflow легче сохранить
```

Минусы:

```text
- меньше гибкости headers/redirects
- если нужны server islands/API, придётся менять позже
```

### 3.2 Cloudflare Pages

Плюсы:

```text
+ быстрый CDN
+ хорошая связка с Astro
+ headers/redirects
+ можно позже добавить SSR/Functions
+ Cloudflare купил Astro-команду в 2026, что усиливает долгосрочную связку
```

Cloudflare announced acquisition of The Astro Technology Company team in Jan 2026, while Astro remains open source under Cloudflare stewardship [2](https://finance.yahoo.com/news/cloudflare-acquires-astro-accelerate-future-140000528.html).

Для purely static Astro на Cloudflare Pages можно просто подключить repo, build command `npm run build`, output directory `dist`; adapter не обязателен [2](https://astroseoblog.com/blog/astro-cloudflare-pages-integration-guide).

Решение:

```text
Фаза 1: static output, не менять хостинг без необходимости.
Фаза 2: рассмотреть Cloudflare Pages после стабилизации Astro build.
```

---

## 4. Node version

Astro 6 ecosystem в 2026 часто требует Node 22+.

Решение:

```json
"engines": {
  "node": ">=22"
}
```

Но в текущем проекте пока стоит:

```json
"node": ">=20"
```

Не менять сразу. Сначала в ветке Astro prototype проверить совместимость текущих scripts.

---

## 5. Environment variables

Astro использует Vite env модель. Важное правило: только переменные с `PUBLIC_` доступны клиентскому коду; остальные доступны server-side/build-time [3](https://docs.astro.build/en/guides/environment-variables/).

Правила проекта:

```text
[ ] PUBLIC_* — только то, что не секрет
[ ] API keys/secrets никогда не PUBLIC_*
[ ] Yandex ID можно PUBLIC_, если он и так виден в HTML
[ ] tokens/credentials не хранить в repo
[ ] .env не коммитить
```

Пример:

```env
PUBLIC_SITE_URL=https://gospod-bog.ru
PUBLIC_YANDEX_METRIKA_ID=108353327
SOURCE_AUDIT_TOKEN=secret_server_only
```

---

## 6. Verification files

Сохранить как static public files:

```text
google7e02f9855e02b89a.html
yandex_42bc0d54a1ca4952.html
yandex_d8876d66da1b4592.html
```

В Astro они могут лежать в:

```text
public/google7e02f9855e02b89a.html
public/yandex_42bc0d54a1ca4952.html
public/yandex_d8876d66da1b4592.html
```

Правило:

```text
Не конвертировать verification files в Astro pages.
```

---

## 7. 404

Текущий:

```text
/404.html
```

В Astro:

```text
src/pages/404.astro
```

Но output должен быть:

```text
dist/404.html
```

На Cloudflare Worker/assets конфигурациях важно, чтобы fallback отдавал 404.html с 404 status. В Cloudflare Workers static assets config встречается `not_found_handling = "404-page"` для корректной отдачи `dist/404.html` [1](https://mohammedbanani.com/journal/deploy-astro-to-cloudflare-pages/).

---

## 8. Redirects

Цель: URL не менять. Но если когда-нибудь понадобится:

Google recommends permanent server-side redirects, especially 301/308, when URL changes are needed [3](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

Правила:

```text
[ ] один старый URL → один релевантный новый URL
[ ] не редиректить всё на главную
[ ] избегать chains
[ ] обновить internal links
[ ] обновить canonical
[ ] обновить sitemap
```

Google site move docs рекомендуют mapping old→new, self-referencing canonical на новых URL, обновление внутренних ссылок и sitemap [1](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

Yandex также предупреждает не редиректить все страницы на главную: это неудобно пользователям и замедляет индексацию [3](https://yandex.com/support/webmaster/en/yandex-indexing/moving-site.html).

---

## 9. Headers

Желательные production headers:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: phased
Cache-Control for hashed assets: public, max-age=31536000, immutable
```

Для статических assets Astro обычно генерирует hashed files в `/_astro/`; их можно кешировать долго.

---

## 10. CSP strategy

Текущий сайт использует:

```text
script-src 'self' 'unsafe-inline' ...
style-src 'self' 'unsafe-inline'
```

Это понятно для ручного HTML, но долгосрочно лучше уйти от unsafe-inline.

### Фазы CSP

#### CSP-0: сохранить как есть

На первом Astro prototype не трогать CSP радикально.

#### CSP-1: вынести inline JS/CSS

```text
[ ] styles → Astro/CSS files
[ ] scripts → modules
[ ] Yandex snippet в отдельный компонент
[ ] JSON-LD безопасно через script application/ld+json
```

#### CSP-2: hashes/nonces

Если Astro 6 CSP включается стабильно в проекте, протестировать автоматическую CSP generation.

По сообщениям экосистемы Astro 6, CSP support стал stable и может автоматически генерировать CSP headers/meta с hashes для scripts/styles [2](https://www.infoq.com/news/2026/02/astro-v6-beta-cloudflare/).

#### CSP-3: убрать лишнее

```text
[ ] убрать unsafe-inline для script-src, если возможно
[ ] ограничить connect-src
[ ] ограничить img-src
[ ] проверить Yandex.Metrika
```

---

## 11. Analytics

Yandex.Metrika сохранить.

Правила:

```text
[ ] script async
[ ] noscript image fallback
[ ] не блокировать LCP
[ ] CSP разрешает только нужные домены
[ ] в preview без сети не должно ломать страницу
```

Если позже включать SPA-like navigation/View Transitions, нужно отдельно проверить pageview tracking. Поэтому View Transitions не включать в первой фазе.

---

## 12. Secrets hygiene

Workspace snapshot уже исключает некоторые sensitive paths, но проектно правила такие:

```text
[ ] .env не коммитить
[ ] tokens только в GitHub/Cloudflare secrets
[ ] PUBLIC_ только для публичных значений
[ ] не писать credentials в docs
[ ] source audit external tokens не хранить в repo
```

---

## 13. Build output safety

Перед deploy:

```text
[ ] dist содержит 404.html
[ ] dist содержит verification files
[ ] sitemap.xml есть
[ ] feed.xml есть
[ ] robots.txt есть
[ ] нет draft страниц
[ ] нет source maps в production, если не нужны
[ ] нет .env/.md исходников в dist, кроме явно нужных public docs
```

---

## 14. Cache strategy

```text
HTML: short cache / revalidate
/_astro/* hashed assets: immutable 1 year
/images/*: long cache, если filename versioned
/feed.xml: short cache
/sitemap.xml: short cache
/data/*.json: medium cache, если versioned; short если frequently updated
```

---

## 15. Deployment checklist

```text
[ ] npm ci
[ ] npm run validate:content
[ ] npm run build
[ ] npm run contract:extract on dist/future extractor
[ ] sitemap/feed проверены
[ ] verification files доступны
[ ] 404 status проверен
[ ] Yandex.Metrika работает
[ ] Search Console live URL для pilot pages
[ ] Yandex Webmaster проверен
```

---

## 16. Итог

Первый этап должен быть максимально консервативным:

```text
Static Astro build
No URL changes
No hosting change unless needed
No aggressive CSP changes first
No ClientRouter first
Verification/analytics preserved
```

После стабилизации можно усиливать Cloudflare/CSP/headers.
