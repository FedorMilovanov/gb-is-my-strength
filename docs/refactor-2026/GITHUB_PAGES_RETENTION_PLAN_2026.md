# GITHUB_PAGES_RETENTION_PLAN_2026.md — план оставаться на GitHub Pages

Дата: 2026-06-12

---

## 1. Решение

Пока остаёмся на GitHub Pages/current static hosting.

Причина:

```text
не жмёт;
бесплатно;
уже работает;
Astro static output совместим;
меньше миграционных рисков;
Cloudflare для владельца из России проблемен по доступу/оплате.
```

---

## 2. Что GitHub Pages должен уметь для нас

```text
[ ] отдавать HTML/CSS/JS/images/fonts
[ ] custom domain CNAME
[ ] HTTPS
[ ] sitemap.xml
[ ] feed.xml
[ ] 404.html
[ ] verification files
[ ] static JSON data
[ ] Astro dist
```

Это всё подходит.

---

## 3. Что GitHub Pages НЕ умеет

```text
server-side rendering;
API endpoints;
dynamic RUM endpoint;
server-generated nonce CSP;
advanced redirects/headers like Nginx;
private staging on free public repo;
database;
```

Пока это не нужно.

---

## 4. Как Astro должен собираться для GitHub Pages

```text
output: static
trailingSlash: always
site: https://gospod-bog.ru
```

Нельзя завязываться на SSR/server islands.

---

## 5. CI strategy

Если repository public:

```text
GitHub Actions standard runners free;
validation/build can run in CI;
```

Команды:

```bash
npm run contract:extract
npm run maps:validate
npm run validate:static-publication
# future:
npm run check
npm run build
npm run contract:compare
```

---

## 6. Size/bandwidth discipline

GitHub Pages official limits include:

```text
published site <= 1GB;
soft bandwidth 100GB/month;
build timeout 10 minutes;
soft 10 builds/hour unless custom Actions workflow;
```

Практика:

```text
[ ] keep dist small
[ ] avoid videos/huge media
[ ] optimize images
[ ] avoid committing unnecessary generated files
[ ] monitor repo size
[ ] Pagefind index size watch
```

---

## 7. Headers/CSP limitation

GitHub Pages не даёт такой же гибкости headers, как Cloudflare/VPS.

Следствие:

```text
CSP hardening может быть ограничен meta CSP или текущими средствами.
```

Не делать CSP hardening blocker для Astro migration.

---

## 8. When to reconsider

Пересмотреть GitHub Pages, если:

```text
[ ] трафик приближается к 100GB/month;
[ ] dist приближается к 1GB;
[ ] нужны custom headers/redirects;
[ ] нужен API/RUM endpoint;
[ ] нужен R2/S3 для media;
[ ] GitHub доступ становится нестабилен;
[ ] нужен приватный preview workflow;
```

---

## 9. Candidate next hosts if needed

Порядок рассмотрения:

```text
1. Cloudflare Pages — если доступ/оплата решены и нужен CDN/headers.
2. Yandex Cloud Object Storage/CDN — если нужен российский доступ и готовность платить за traffic/storage.
3. VPS + Caddy/Nginx — если нужен полный контроль.
4. Netlify/Vercel — если доступ/оплата не проблема, но менее предпочтительно для России.
```

---

## 10. Итог

```text
GitHub Pages — остаётся production baseline.
Astro должен быть portable static build.
Cloudflare — не цель первой миграции.
```
