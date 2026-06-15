# DIST_DRY_RUN_WORKFLOW_STATUS_2026-06-15.md

Дата: 2026-06-15
Статус: **manual-only CI dry run; production deploy не меняется**
Риск-уровень: **Level 1/2 — artifact rehearsal, no deploy**

## Цель

Добавить безопасную GitHub Actions репетицию будущего `dist/` artifact до реального переключения GitHub Pages.

Workflow:

```text
.github/workflows/dist-dry-run.yml
```

Название в Actions:

```text
Dist Strangler Dry Run
```

Запуск только вручную:

```text
workflow_dispatch
```

Никаких `pages: write`, `id-token: write`, `actions/upload-pages-artifact` или `actions/deploy-pages` в этом workflow нет.

## Что делает workflow

1. Checkout.
2. Node.js 22.
3. `npm ci`.
4. `npx playwright install --with-deps chromium`.
5. Optional fonts download.
6. Root publication gates:

```bash
npm run ci:check
```

7. Visual-review screenshots for `/about/`:

```bash
npm run astro:audit:about:shots
```

8. Production-like strangler readiness:

```bash
npm run strangler:deploy-readiness
```

Внутри этой команды теперь есть ownership guard:

```bash
npm run page-ownership:dist:production-like
```

Он проверяет, что `/about/` остаётся Astro-owned, `/dev/astro-test/` отсутствует в production-like `dist`, built-app `_app/` скопирован, а 42 baseline public URLs resolve в `dist`.

9. Hard artifact shape assertions:

```bash
test -f dist/index.html
test -f dist/about/index.html
test -f dist/pagefind/pagefind.js
test -f dist/.nojekyll
test ! -e dist/dev/astro-test/index.html
```

10. Uploads normal GitHub artifacts, not Pages artifacts:

```text
production-like-dist
dist-dry-run-review-reports
```

Artifacts are retained for 7 days.

## Почему это безопасно

- Workflow не запускается на push/schedule/workflow_run.
- Workflow не имеет Pages deploy permissions.
- Workflow не вызывает `upload-pages-artifact`.
- Workflow не вызывает `deploy-pages`.
- Production `deploy.yml` по-прежнему публикует repository root.

## Policy guard

`scripts/check-workflows.js` обновлён так, чтобы workflow нельзя было случайно превратить в deploy:

```text
- должен оставаться workflow_dispatch-only;
- должен использовать Node 22;
- должен ставить Playwright Chromium;
- должен запускать ci:check;
- должен запускать astro:audit:about:shots;
- должен запускать strangler:deploy-readiness;
- должен проверять отсутствие dist/dev/astro-test/index.html;
- должен использовать только actions/upload-artifact;
- запрещены pages:write, id-token:write, upload-pages-artifact и deploy-pages.
```

## Что это НЕ делает

```text
❌ не переключает Pages artifact на dist;
❌ не публикует Astro /about/ в production;
❌ не bump-ает sw.js CACHE_VERSION;
❌ не меняет deploy.yml;
❌ не удаляет legacy HTML.
```

## Следующий use-case

Перед реальным root→`dist` switch владелец может вручную запустить **Dist Strangler Dry Run** в GitHub Actions и скачать artifact `production-like-dist` для inspection. Только после зелёного manual dry-run, visual review `/about/` и явного согласия владельца имеет смысл делать отдельный deploy-switch commit.
