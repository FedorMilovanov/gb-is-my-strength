# DIST_OWNERSHIP_AUDIT_STATUS_2026-06-15.md

Дата: 2026-06-15  
Статус: **исторический pre-switch status; superseded 2026-06-18.** Ownership guard остаётся актуален, но production deploy уже публикует `dist/`, а baseline вырос с 42 до 51 public pages. Текущий статус см. `REFACTORING_4_5_PRODUCTION_CUTOVER_AUDIT_2026-06-18.md`.
Риск-уровень на момент создания: **Level 0/1 — scripts + CI guard, no deploy switch**

## Цель

Закрыть следующий safety-gap перед будущим root→`dist` switch: явная проверка, что `migration/page-ownership.json` и фактический `dist/` не расходятся.

Новый guard:

```text
scripts/check-page-ownership.js
```

Он сам не деплоит сайт; после 2026-06-18 production `deploy.yml` публикует `dist`, поэтому guard защищает уже боевой artifact.

## Новые npm-команды

```bash
npm run page-ownership:check
npm run page-ownership:dist
npm run page-ownership:dist:production-like
```

Назначение:

- `page-ownership:check` — быстрый manifest/source guard без сборки `dist`; включён в `validate:static-publication`.
- `page-ownership:dist` — проверяет manifest + обычный strangler `dist`, где build-only `/dev/astro-test/` может присутствовать, но должен быть noindex.
- `page-ownership:dist:production-like` — строгий deploy-like режим: build-only routes должны отсутствовать в `dist`.

## Что проверяется

Manifest-level:

```text
[ ] migration/page-ownership.json существует и валиден;
[ ] route keys нормализованы;
[ ] owner входит в разрешённый набор;
[ ] source существует в repo;
[ ] risk — integer 0..6;
[ ] status заполнен;
[ ] все src/pages/* Astro routes объявлены в manifest;
[ ] Astro source route совпадает с route key.
```

Dist-level:

```text
[ ] dist/ существует;
[ ] system files есть: .nojekyll, 404.html, CNAME, robots.txt, sitemap.xml, feed.xml, manifest.json, sw.js;
[ ] Astro-owned /about/ существует в dist и не является byte-identical legacy root copy;
[ ] build-only /dev/astro-test/ отсутствует в production-like dist;
[ ] built app /konfessii/russkij-baptizm/_app/ скопирован и остаётся noindex;
[ ] все 51 baseline public URL resolve в dist;
[ ] остальные baseline pages считаются implicit legacy until promoted.
```

## Интеграция в gates

`validate:static-publication` теперь включает быстрый guard:

```bash
npm run page-ownership:check
```

Strangler-gates теперь проверяют ownership сразу после build/copy:

```bash
npm run strangler:validate
npm run strangler:audit
npm run strangler:audit:pagefind
npm run strangler:audit:production-like
npm run strangler:deploy-readiness
```

В production-like цепочке это означает:

```bash
npm run strangler:build:production-like
npm run page-ownership:dist:production-like
npm run pagefind:build:dist
node scripts/dist-publication-audit.js --require-pagefind --forbid-dev
```

## Текущий результат

Исторически guard начинался с `/about/` как единственного Astro route. На 2026-06-18 ожидаемая картина иная:

```text
public baseline: 51 pages
Astro production-dist routes: declared in migration/page-ownership.json
build-only route: /dev/astro-test/ absent from production-like dist
remaining implicit legacy pages: copied into dist until individually promoted
```


## Что это НЕ делает

```text
❌ сам по себе не переключает Pages artifact;
❌ не bump-ает sw.js CACHE_VERSION;
❌ не удаляет legacy HTML;
❌ сам по себе не подключает новые Astro страницы к production;
❌ не заменяет contract/dist publication/SW audits, а дополняет их.
```

## Проверки

Зелёные на момент добавления:

```bash
npm run page-ownership:check
npm run page-ownership:dist:production-like
npm run strangler:deploy-readiness
npm run ci:check
```

Ключевой смысл: если агент добавит Astro route в `src/pages`, забудет объявить ownership, случайно оставит build-only route в production-like `dist` или перетрёт Astro-owned страницу legacy copy — gate упадёт до deploy.
