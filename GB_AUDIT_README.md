# 🛡️ gb-is-my-strength — Professional Audit + Failure Alerts

Дата: 2026-05-17

Пакет добавляет к существующим `validate.js` и `seo-audit.js` ещё один слой защиты:

- `scripts/audit-pro.js` — профессиональный аудит без зависимостей
- `.github/workflows/audit.yml` — ручной/PR аудит
- `.github/workflows/deploy.yml` — патч деплоя: перед публикацией запускает audit gate + после публикации smoke-check
- `.github/workflows/notify-on-failure.yml` — если `Deploy`, `IndexNow` или `Professional Audit` падают, автоматически создаётся GitHub Issue

## Локальный запуск

```bash
npm ci
npm run validate:strict
npm run seo-audit
node scripts/audit-pro.js
```

## Как понять, прошёл ли деплой

1. В GitHub: **Actions → Deploy to GitHub Pages**.
   - зелёная галочка = прошёл
   - красный крест = ошибка
2. В repo: вкладка **Issues**. Если деплой/CI упал — workflow `Notify on CI / Deploy Failure` создаст issue `🚨 CI/Deploy failure: ...`.
3. В README можно добавить бейджи:

```md
[![Deploy](https://github.com/<OWNER>/<REPO>/actions/workflows/deploy.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/deploy.yml)
[![Audit](https://github.com/<OWNER>/<REPO>/actions/workflows/audit.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/audit.yml)
```

## Что проверяет audit-pro.js

- Ровно 4 CSS в `/css` и ровно 9 JS в `/js` по `AGENTS.md`
- `fonts/fonts.css` и `nagornaya/tw.min.css` существуют
- JS syntax через `node --check`
- JSON-файлы валидны
- `?v=` cache-bust хеши совпадают с реальным MD5 содержимого файлов
- SEO basics: title, description, canonical, OG, h1, viewport, lang
- JSON-LD парсится, нет дублей `@id`
- Богословская защита: нет `Автор: Фёдор Милованов`, только редактор/редакция перевода
- Внутренние ссылки и локальные ресурсы существуют
- Нет дублей `id`, картинки имеют `alt`
- PWA manifest + Service Worker strategy
- `search-manifest.json`, `series.json`, Нагорная серия
- `CNAME`, `robots.txt`, `sitemap.xml`, `feed.xml`
- Security hygiene: нет утечек repo-base path, нет `eval()`

## Важно

`warnings` не блокируют деплой. `errors` блокируют.

Сейчас на свежем репозитории audit-pro проходит: **0 errors, 0 warnings**.
