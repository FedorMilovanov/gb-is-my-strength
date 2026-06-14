# GITHUB_PAGES_DEPLOY_ROLLBACK_RUNBOOK_2026.md — деплой и rollback на GitHub Pages

Дата: 2026-06-12  
Связано с:

- `docs/GITHUB_PAGES_RETENTION_PLAN_2026.md`
- `docs/TECHNICAL_MIGRATION_RUNBOOK_2026.md`

---

## 1. Цель

Сохранить простой и обратимый деплой на GitHub Pages/current static hosting.

---

## 2. Варианты GitHub Pages деплоя

### A. Deploy from branch

Просто, но меньше контроля.

Подходит текущей legacy-модели.

### B. GitHub Actions artifact deploy

Больше контроля:

```text
checkout
install
validate
build
upload-pages-artifact
deploy-pages
```

Позволяет:

```text
[ ] запускать contract checks до деплоя
[ ] не деплоить, если validation fail
[ ] хранить артефакты
[ ] делать manual workflow_dispatch
```

---

## 3. Минимальный будущий workflow

```yaml
name: Build and deploy static site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run contract:extract
      - run: npm run maps:validate
      - run: npm run validate:static-publication
      # future:
      # - run: npm run check
      # - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Для Astro позже `path: dist`.

---

## 4. Rollback strategy

### Если deploy from branch

Rollback = revert commit or reset branch to previous known good commit.

### Если Actions artifact deploy

Rollback options:

```text
1. Revert PR and redeploy.
2. Re-run previous successful workflow if artifacts retained.
3. If gh-pages branch used, reset to previous commit.
```

Самый простой и безопасный:

```bash
git revert <bad_commit>
git push
```

---

## 5. Что хранить для rollback

```text
previous good commit SHA
workflow run URL
contract report
sitemap/feed snapshot
release notes
```

---

## 6. Smoke tests after deploy

Проверить вручную/скриптом:

```text
/
/about/
/articles/
/karty/
/karty/avraam/
/map/
/404.html
/sitemap.xml
/feed.xml
/google verification
/yandex verification
```

---

## 7. Rollback triggers

```text
[ ] main page 404/blank
[ ] widespread missing CSS
[ ] sitemap/feed missing
[ ] verification files missing
[ ] accidental noindex sitewide
[ ] canonical to wrong domain
[ ] Yandex/analytics script fatal break
[ ] map route broken if map PR
```

---

## 8. Non-rollback fixes

Не делать rollback, если:

```text
minor typo
one non-critical image missing
small visual diff accepted
low-priority related link missing
```

Fix forward.

---

## 9. GitHub Pages limits awareness

Official GitHub Pages limits:

```text
published site <= 1GB
soft bandwidth <= 100GB/month
deployment timeout 10 min
soft 10 builds/hour unless custom Actions workflow
```

CI should report dist size after Astro migration.

---

## 10. Итог

Деплой должен быть скучным:

```text
validate → build → deploy → smoke → monitor
```

Rollback должен быть ещё скучнее:

```text
revert → redeploy → smoke
```
