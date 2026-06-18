# DIST_DEPLOY_SWITCH_RUNBOOK_2026-06-15.md

Дата: 2026-06-15
Статус: **deploy-switch ВЫПОЛНЕН 2026-06-18.** Production GitHub Pages публикуется из Astro/strangler `dist/` через `deploy.yml` (path: dist). Чтобы это работало детерминированно, репозиторий Pages должен быть в `build_type: workflow` (см. §«Pages build_type» ниже) — иначе нативный legacy-билдер из root конкурирует с actions-деплоем и прод «прыгает» между dist и root.
Риск-уровень будущего шага: **Level 2/6 boundary — one deploy mechanism switch, one rollback**

## Цель

Зафиксировать безопасный порядок будущего переключения GitHub Pages artifact с корня репозитория на `dist/`, когда Astro-owned страницы и legacy-copy output будут достаточно проверены.

Этот документ **не является разрешением на переключение deploy**. Переключение делается отдельным маленьким commit/PR только после явного согласия владельца и зелёных gate-команд ниже.

## Почему нужен отдельный SW/cache gate

Текущий `sw.js` кэширует HTML через `CACHE_CONTENT` и стратегию stale-while-revalidate. Если переключить Pages artifact на `dist/` без bump `CACHE_VERSION`, у части пользователей может остаться старый HTML из legacy root, например legacy `/about/`, хотя новый deploy уже содержит Astro `/about/`.

Поэтому в actual deploy-switch commit обязательно:

```text
[ ] bump sw.js CACHE_VERSION
[ ] run npm run sw:dist:audit:deploy-switch
[ ] убедиться, что CACHE_VERSION отличается от migration/sw-cache-version-baseline.json
```

Базовая версия текущего root-production SW зафиксирована в:

```text
migration/sw-cache-version-baseline.json
```

## Новые guard-команды

```bash
npm run page-ownership:check
npm run page-ownership:dist
npm run page-ownership:dist:production-like
npm run strangler:copy:dry-run
npm run sw:dist:audit
npm run sw:dist:audit:pagefind
npm run sw:dist:audit:deploy-switch
npm run strangler:deploy-readiness
```

Назначение:

- `page-ownership:check` — быстрый manifest/source guard: все `src/pages/*` Astro routes должны быть объявлены в `migration/page-ownership.json`.
- `page-ownership:dist` — проверка ownership против обычного strangler `dist`.
- `page-ownership:dist:production-like` — строгий режим: build-only routes, например `/dev/astro-test/`, должны отсутствовать в deploy-like `dist`.
- `strangler:copy:dry-run` — preview copy operation без мутации deploy-like copy step; пишет ignored `reports/dist-copy-dry-run-manifest.json` для inspection.
- `sw:dist:audit` — статический SW audit для `dist/`, Pagefind optional.
- `sw:dist:audit:pagefind` — то же, но `/pagefind/pagefind.js` обязан существовать в `dist`.
- `sw:dist:audit:deploy-switch` — строгий режим для actual deploy-switch commit; сейчас ожидаемо падает, пока `CACHE_VERSION` не bumped.
- `strangler:deploy-readiness` — локальный dry-run readiness: `/about/` audit, production-like `dist` без build-only dev routes, ownership guard, Pagefind + smoke, затем SW audit в advisory-режиме.

## Pre-switch gates

Перед изменением `.github/workflows/deploy.yml`:

```bash
npm run page-ownership:check
npm run strangler:deploy-readiness
npm run astro:audit:about:shots
npm run ci:check
npm run konfessii:audit
npm audit --omit=dev --audit-level=moderate
git diff --check
```

Дополнительно перед actual switch желательно вручную запустить GitHub Actions workflow:

```text
Dist Strangler Dry Run
```

Он собирает production-like `dist`, проверяет отсутствие `/dev/astro-test/`, создаёт screenshots для `/about/` и загружает обычный artifact `production-like-dist` без публикации на Pages.

`astro:audit:about:shots` создаёт screenshots в `reports/`; они не коммитятся. Визуальное отличие `/about/` должно быть вручную принято владельцем до rollout.

## Изменения в deploy.yml в actual switch commit

В одном атомарном commit:

```text
[ ] Static publication gates остаются
[ ] Build step: npm run strangler:build:production-like
[ ] Ownership gate: npm run page-ownership:dist:production-like
[ ] Pagefind: npm run pagefind:build:dist
[ ] Dist publication audit: node scripts/dist-publication-audit.js --require-pagefind --forbid-dev
[ ] SW strict gate: npm run sw:dist:audit:deploy-switch
[ ] IndexNow key пишется в dist/${KEY}.txt, не в root
[ ] touch dist/.nojekyll
[ ] upload-pages-artifact path: dist
```

Нельзя делать частичный switch, например `path: dist` без Pagefind-on-dist или без IndexNow key в `dist/`.

Это дополнительно защищено workflow policy guard в:

```text
scripts/check-workflows.js
```

Если будущий commit переключит artifact на `dist`, guard потребует все связанные шаги в том же workflow.

## `/dev/astro-test/`

Решение для production-like `dist`: **исключать build-only route**.

`/dev/astro-test/` остаётся полезным в обычном shadow/prototype build и защищён `noindex`, но actual deploy-switch path должен использовать:

```bash
npm run strangler:build:production-like
```

Этот режим вызывает `copy-legacy-to-dist.js --omit-build-only` и удаляет Astro routes с `status:"build-only"` из `migration/page-ownership.json`. Дополнительно `page-ownership:dist:production-like` и `dist-publication-audit.js --forbid-dev` падают, если `/dev/astro-test/` всё ещё есть в production-like output.

## Pages build_type — КРИТИЧНО для детерминированного деплоя

GitHub Pages имеет два режима публикации:

- **`legacy`** — нативный билдер берёт `<branch>/<path>` (например `main /`) и публикует сам.
- **`workflow`** — публикация только через GitHub Actions `actions/deploy-pages` (наш `deploy.yml`).

**Репозиторий ДОЛЖЕН стоять на `build_type: workflow`.** Иначе (legacy) нативный
билдер публикует root, а `deploy.yml` (path: dist) публикует dist — они **конкурируют**
за один Pages-таргет, и прод недетерминированно «прыгает» между legacy root и dist.
Именно это вызывало «instability» в первые дни после switch (2026-06-17/18).

Проверить / переключить через API (нужен PAT с `admin:repo_hook` / Pages rights):

```bash
# проверить
gh api repos/FedorMilovanov/gb-is-my-strength/pages --jq '.build_type'

# переключить на workflow (отключить нативный legacy builder)
gh api -X PUT repos/FedorMilovanov/gb-is-my-strength/pages \
  -f build_type=workflow
# или через curl: PUT .../pages -d '{"build_type":"workflow"}'
```

Если вернуть на `legacy` — `deploy.yml` перестанет быть источником правды, и прод
вернётся к root (с потерей всех Astro/dist-страниц и стилей).

## paths-фильтры — КРИТИЧНО для автодеплоя после миграции

После миграции **публичные страницы живут в `src/**`** (`src/pages/**/*.astro`,
`src/content/**/*.mdx`, `src/layouts/**`). Workflow-фильтры обязаны это отражовать:
`deploy.yml` и `indexnow.yml` обязаны включать `src/**` в `paths`. Иначе коммиты,
правящие только Astro-источник, **не деплоятся и не индексируются** (именно так
прод «застрял» на старом коммите 2026-06-18). Защищено assertion'ами в
`scripts/check-workflows.js`.

## Rollback

Rollback должен быть таким же маленьким, как switch:

```bash
git revert <deploy-switch-commit>
```

Ожидаемый rollback возвращает:

```text
- upload-pages-artifact path: .
- Pagefind build at repository root
- IndexNow key file at repository root
- no dist upload requirement
```

Если после switch был bumped `CACHE_VERSION`, откатывать его необязательно и обычно нежелательно: новая версия SW уже помогла очистить старые HTML caches. Если revert всё же меняет `sw.js`, проверить `sw:dist:audit`/root deploy smoke отдельно.

## Текущее состояние на момент документа

```text
Production deploy: legacy root
Dist prototype: Astro /about/ + copied legacy pages
Pagefind-on-dist: локально проверяется
Build-only /dev/astro-test/: исключается из production-like dist
SW deploy-switch strict gate: ожидаемо требует будущий CACHE_VERSION bump
```
