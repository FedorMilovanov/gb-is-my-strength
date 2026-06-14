# HOSTING_DEPLOYMENT_OPTIONS_2026.md — варианты хостинга и деплоя Astro/static сайта

Дата: 2026-06-12  
Связано с:

- `docs/FREE_PAID_SERVICES_COST_STRATEGY_2026.md`
- `docs/DEPLOYMENT_SECURITY_ENV_2026.md`

---

## 1. Главный вывод

Для первого этапа не менять хостинг без необходимости.

```text
Сначала: Astro prototype локально + текущий деплой.
Потом: если нужны headers/redirects/CDN/лимиты — рассмотреть Cloudflare Pages.
```

---

## 2. GitHub Pages / current static hosting

Плюсы:

```text
+ бесплатно
+ просто
+ static-only безопасно
+ уже близко к текущей модели
```

Минусы:

```text
- static only
- нет функций/backend
- ограниченный контроль headers
- soft bandwidth/build/site size limits
```

Подходит для:

```text
первого Astro static output;
пилотной миграции;
малого/среднего трафика.
```

---

## 3. Cloudflare Pages

Плюсы:

```text
+ free static hosting
+ очень сильный CDN
+ щедрый/free bandwidth по многим обзорам
+ DDoS protection
+ deploy previews
+ custom domains
+ Workers/Pages Functions как future option
+ хорошая связка с Astro после acquisition Astro team by Cloudflare
```

Минусы:

```text
- новый deploy pipeline
- Workers/advanced features могут стать платными
- нужно аккуратно настроить 404/headers/redirects
```

Лучший момент для миграции:

```text
после того, как Astro build стабилен и URL contract проходит.
```

---

## 4. Netlify

Плюсы:

```text
+ хороший Jamstack DX
+ deploy previews
+ forms/functions
+ удобные redirects/headers
```

Минусы:

```text
- bandwidth/build/team limits
- paid forms/analytics/usage can grow
```

Для проекта не первый выбор, если формы/functions не нужны.

---

## 5. Vercel

Плюсы:

```text
+ лучший DX для Next.js
+ deploy previews
+ edge/functions
```

Минусы:

```text
- для Astro static не даёт уникального преимущества
- paid/commercial/team considerations
```

Если мы выбираем Astro, Vercel не обязателен.

---

## 6. VPS / own server

Плюсы:

```text
+ полный контроль
+ headers/server configs
+ backend/RUM/search possible
```

Минусы:

```text
- DevOps
- security updates
- backups
- monitoring
- paid
```

Не нужно сейчас.

---

## 7. Recommended path

```text
Phase 1: current static hosting.
Phase 2: Astro build static dist.
Phase 3: compare URL/SEO.
Phase 4: evaluate Cloudflare Pages preview.
Phase 5: move only if benefits outweigh risk.
```

---

## 8. Required hosting capabilities

Минимум:

```text
[ ] serve clean URLs with trailing slash
[ ] serve 404.html with 404 status
[ ] preserve verification files
[ ] serve sitemap.xml/feed.xml
[ ] HTTPS
[ ] custom domain
```

Желательно:

```text
[ ] custom headers
[ ] redirects
[ ] immutable cache for hashed assets
[ ] deploy previews
[ ] rollback
```

---

## 9. Headers needed eventually

```text
Cache-Control for /_astro/* immutable
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
CSP report-only/enforced later
```

---

## 10. Итог

Хостинг — не первая проблема. Первая проблема — корректная сборка, URL contract и content model.

```text
Не менять платформу и движок одновременно, если можно избежать.
```
