# Arena LM Coding — Agent Push Model
**Repo:** `FedorMilovanov/gb-is-my-strength`  
**Updated:** 2026-06-29  
**Main:** `93059323f980c3120f6e539d3a6e4fd6daa1d657`

## Truth
- GitHub repository secrets (`${{ secrets.NAME }}`) доступны **только внутри GitHub Actions**.
- Внешний Arena LM Coding **НЕ видит** `secrets.ARENA_AGENT`, `GITHUB_TOKEN`, PAT и т.п., если Arena runtime сам не предоставляет secure env / secrets UI.
- Наличие `ARENA_AGENT` в repo secrets ≠ наличие `$GH_TOKEN` у внешнего агента.

## Разрешённые пути пуша
- Прямой push из Arena: **только если** Arena runtime уже аутентифицирован (проверка: `git push origin HEAD:refs/heads/test/arena-push-probe-... --dry-run` / реальный empty branch).
- Разрешённые ветки: `lane/**`, `agent/**`, `arena/**`
- Запрещено: `main`, `gh-pages`, `release`, `production`, force-push в чужие lane без rebase-check
- Прямой `main` push — **FORBIDDEN**. Только PR.
- Никогда: PAT в чат / TXT / gist / issue / PR body / commit message / ссылку.

## Write-пути, которые есть в репо
- `.github/workflows/indexnow.yml` — единственный workflow с `contents: write`, делает `git commit` + `git push` метаданных IndexNow изнутри GitHub Actions, использует `${{ secrets.ARENA_AGENT || secrets.GITHUB_TOKEN }}` — **это внутри Actions, безопасно**.
- Все остальные workflows: `deploy.yml`, `shared-files-guard.yml`, `visual-parity.yml`, `interactive-audit.yml`, `source-links.yml` — **read-only**, используют default `GITHUB_TOKEN`, `ARENA_AGENT` удалён (2026-06-28, commit a417d9c / cc9957b8).

## Безопасная проверка из Arena
```bash
git fetch --all --prune
git rev-parse origin/main
git checkout -b lane/arena-test-YYYY-MM-DD
touch .arena-push-probe && git add .arena-push-probe
git commit -m "test: arena push probe"
git push -u origin HEAD
# success → push работает
# 403 → нет секрета в Arena runtime → используем patch-relay через owner
git push origin --delete lane/arena-test-YYYY-MM-DD
```

## Если секрета нет
- Direct external Arena push — **NOT SUPPORTED**
- Использовать: patch relay / PR через owner / GitHub connector
- Не просить PAT в чате. Не класть PAT в .txt / .md / env-примеры.

## CI gates, обязательные перед пушем
```
npm run astro:check
npm run strangler:build:production-like
npm run audit:premium-controls
npm run gill:context:visual-parity:audit -- --require-dist
npm run gill:spravochnik:visual-parity:audit -- --require-dist
npm run gill:mobile-play:smoke
npm run gill:series:data:consistency:audit
npm run validate:static-publication:light
npm run workflows:check
```

## Контакты truth-источников
- Production truth: `dist/articles/dzhon-gill-*/index.html`
- Source truth: `src/pages/**`, `src/components/article-pilots/gill-series/**`, `src/components/article-pilots/gill-series/gillSeriesData.ts`
- Current main SHA: см. README / `git rev-parse origin/main`
- Open PRs: должно быть 0 (PR #20 closed 2026-06-28 superseded)

---
**Never trust “я запушил”. Trust only:** `origin/<branch>`, GitHub PR SHA, built `dist/`, smoke-артефакты.
