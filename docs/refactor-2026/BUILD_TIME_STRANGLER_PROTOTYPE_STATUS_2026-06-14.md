# BUILD_TIME_STRANGLER_PROTOTYPE_STATUS_2026-06-14.md

Дата: 2026-06-14  
Риск-уровень: **prototype / local dist only**  
Production status: **deploy всё ещё публикует legacy root, не `dist/`**

## Что сделано

Добавлены:

```text
migration/page-ownership.json
scripts/copy-legacy-to-dist.js
```

Package scripts:

```json
"strangler:build": "npm run astro:build && node scripts/copy-legacy-to-dist.js",
"strangler:validate": "npm run strangler:build && npm run contract:extract:dist && npm run contract:compare:dist"
```

## Ownership manifest

Текущий manifest:

```text
/about/                → astro shadow-pilot
/dev/astro-test/       → astro noindex build-only
/konfessii/.../_app/   → built-app, copy as built asset
```

## Copy algorithm

После `astro:build`:

1. `dist/` уже содержит Astro-owned pages.
2. `copy-legacy-to-dist.js` копирует public root files и public dirs.
3. Legacy pages, которые принадлежат Astro (`/about/`), не копируются.
4. Существующие files в `dist` не перезаписываются.
5. Проверяются required files/routes: `/about/`, root index, sitemap/feed/robots/CNAME, css/js/images basics.

## Dist cleanliness

`astro:build` теперь начинается с `dist:clean`, чтобы исключить stale artifacts от прошлых strangler builds.

## Проверка

```bash
npm run strangler:validate
```

Результат на момент добавления:

```text
copy-legacy-to-dist: copied 442 files (~44 MB)
Astro-owned legacy pages skipped: /about/
contract:extract:dist: 42 public pages, 0 issues
contract:compare:dist: 42 baseline pages, 42 current public pages, 0 new URLs
```

## Что НЕ сделано

- `deploy.yml` не переключён на `dist`;
- Pagefind build on dist не включён;
- sitemap/feed ещё legacy-copied;
- ownership `/about/` в production не включён;
- legacy files не удалены.

## Следующие условия перед deploy switch

Перед изменением deploy path на `dist` нужно отдельно:

1. visual compare `/about/` legacy vs Astro desktop/mobile;
2. smoke test `dist/` через local static server;
3. проверить service worker/cache strategy для dist;
4. решить Pagefind generation on dist;
5. подготовить rollback plan.

## Representative dist smoke

Добавлен скрипт:

```text
scripts/dist-smoke-audit.js
```

Команды:

```bash
npm run strangler:smoke
npm run strangler:smoke:shots
```

Что проверяет:

- `strangler:build` на чистом `dist`;
- локальный static server из `dist/`;
- representative URLs desktop + mobile:
  - `/`
  - `/about/`
  - `/articles/`
  - `/articles/kod-da-vinchi/`
  - `/karty/`
  - `/karty/avraam/`
  - `/konfessii/`
  - `/konfessii/russkij-baptizm/`
  - `/map/`
  - `/404.html`
  - `/dev/astro-test/`
- status 200;
- canonical;
- H1 basics;
- horizontal overflow = 0;
- page/console errors;
- iframe presence for `/konfessii/russkij-baptizm/`.

Первый запуск поймал реальные проблемы прототипа:

1. `sw.js` не копировался в `dist`, из-за чего legacy pages ловили 404 при service worker registration.
2. Astro scaffold давал 18px mobile overflow из-за отсутствия global `box-sizing:border-box`.

Исправлено:

- `sw.js` добавлен в root files copy list;
- `src/styles/global.css` получил global `box-sizing:border-box`.

Повторный результат:

```text
✅ dist smoke passed — representative strangler output is healthy
```

## Deploy-like Pagefind + SW audit

Добавлен скрипт:

```text
scripts/dist-publication-audit.js
scripts/build-pagefind.js
```

Команды:

```bash
npm run strangler:audit
npm run strangler:audit:pagefind
npm run pagefind:build
npm run pagefind:build:dist
```

`dist-publication-audit` проверяет:

- required dist files;
- отсутствие приватных/build папок в `dist`;
- отсутствие частичных Astro sitemap files (`sitemap-index.xml`, `sitemap-N.xml`) пока sitemap legacy-owned;
- все `<loc>` из legacy `sitemap.xml` резолвятся в `dist`;
- `robots.txt` указывает на canonical `sitemap.xml`;
- `/about/` в `dist` действительно Astro-owned;
- `/about/` не содержит technical scaffold copy;
- `/dev/astro-test/` остаётся `noindex`;
- `sw.js` precache assets существуют в `dist`;
- Pagefind присутствует, если audit запущен с `--require-pagefind`.

Первый audit поймал и закрыл:

1. partial Astro sitemap files оставались рядом с legacy `sitemap.xml`;
2. Pagefind command через `npx -y pagefind@...`/`npm exec --package` в npm scripts вёл себя нестабильно;
3. нужен явный `sw.js` copy в dist для legacy service worker registration.

Исправлено:

- `copy-legacy-to-dist.js` удаляет partial Astro sitemap files до копирования legacy sitemap;
- `copy-legacy-to-dist.js` копирует `sw.js`;
- `build-pagefind.js` вызывает Pagefind через стабильный `npm exec -c` wrapper;
- `deploy.yml` переведён на `npm run pagefind:build` вместо прямого npx вызова.

Deploy-like локальный результат:

```text
npm run strangler:audit:pagefind
✅ dist publication audit passed
✅ contract:compare:dist 42/42
✅ dist smoke passed
```

## SW/cache deploy-switch readiness guard

2026-06-15 добавлены подготовительные проверки для будущего переключения GitHub Pages artifact на `dist/`:

```text
scripts/sw-dist-readiness-audit.js
migration/sw-cache-version-baseline.json
docs/refactor-2026/DIST_DEPLOY_SWITCH_RUNBOOK_2026-06-15.md
```

Package scripts:

```json
"sw:dist:audit": "node scripts/sw-dist-readiness-audit.js",
"sw:dist:audit:pagefind": "node scripts/sw-dist-readiness-audit.js --require-pagefind",
"sw:dist:audit:deploy-switch": "node scripts/sw-dist-readiness-audit.js --require-pagefind --require-cache-bump",
"strangler:deploy-readiness": "npm run astro:audit:about && npm run strangler:audit:pagefind && npm run sw:dist:audit:pagefind"
```

Что проверяет SW audit:

- `dist/sw.js` существует и пока byte-for-byte совпадает с root `sw.js`;
- `CACHE_VERSION` парсится;
- `PRECACHE_ASSETS` не содержит дубликатов;
- precache assets резолвятся в `dist`;
- HTML content pages не precache-ятся через SW во время Astro/legacy ownership switch;
- Pagefind bootstrap существует, если включён `--require-pagefind`;
- SW содержит `skipWaiting`, `clients.claim`, cleanup старых cache names;
- HTML/static/images/Pagefind стратегии присутствуют;
- `js/sw-register.js` регистрирует `/sw.js` с root scope.

Важно: строгий режим

```bash
npm run sw:dist:audit:deploy-switch
```

сейчас **ожидаемо падает**, потому что `CACHE_VERSION` равен зафиксированной root-production baseline. Это не ошибка текущего root deploy. Это предохранитель: в actual deploy-switch commit нужно bumped `sw.js CACHE_VERSION`, чтобы старый `CACHE_CONTENT` не отдавал legacy HTML после перехода на `dist`.

Workflow policy guard (`scripts/check-workflows.js`) теперь также защищает от частичного deploy switch: если будущий `.github/workflows/deploy.yml` начнёт загружать `dist`, он обязан в том же commit переключить Pagefind на `dist/pagefind`, писать IndexNow key в `dist/`, создавать `dist/.nojekyll`, запускать dist publication audit и строгий SW cache-bump gate.
