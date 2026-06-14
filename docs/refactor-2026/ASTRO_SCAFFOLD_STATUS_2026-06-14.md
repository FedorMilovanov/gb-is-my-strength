# ASTRO_SCAFFOLD_STATUS_2026-06-14.md

Дата: 2026-06-14  
Риск-уровень: **Level 1 — build-only Astro scaffold**

## Что сделано

Создан минимальный Astro scaffold рядом с legacy-сайтом. Production output и deploy path не переключались.

Добавлены/обновлены:

```text
astro.config.mjs
tsconfig.json
src/data/site.ts
src/layouts/BaseLayout.astro
src/components/seo/Seo.astro
src/components/seo/JsonLd.astro
src/components/ui/Header.astro
src/components/ui/Footer.astro
src/styles/tokens.css
src/styles/global.css
src/pages/dev/astro-test.astro
```

Команды:

```json
"astro:dev": "ASTRO_TELEMETRY_DISABLED=1 astro dev",
"astro:check": "ASTRO_TELEMETRY_DISABLED=1 astro check",
"astro:build": "ASTRO_TELEMETRY_DISABLED=1 astro check && ASTRO_TELEMETRY_DISABLED=1 astro build",
"astro:preview": "ASTRO_TELEMETRY_DISABLED=1 astro preview"
```

## Stack

Используется актуальная линия:

```text
Astro 6.x
React islands
MDX
@astrojs/sitemap
@astrojs/rss
TypeScript
```

Astro 6 требует Node >=22.12.0, поэтому:

```text
package.json engines.node = >=22.12.0
GitHub Actions setup-node = 22
```

Legacy deploy path не менялся: workflow всё ещё деплоит текущий static root, не `dist/`.

## Тестовая страница

```text
/dev/astro-test/
```

Страница:

- `noindex, follow`;
- проверяет BaseLayout/Seo/JsonLd/styles;
- не является production switch;
- не включена в legacy sitemap;
- в Astro `dist` может генерироваться локально, но `dist/` ignored.

## Build status

Проверено через Node 22.12.0:

```bash
npx -y -p node@22.12.0 -c 'node -v && npm run astro:check && npm run astro:build'
```

Результат:

```text
astro:check — 0 errors, 0 warnings, 0 hints
astro:build — 1 page built: /dev/astro-test/index.html
```

## Security note

Все Astro/React пакеты сохранены в `devDependencies`, потому scaffold пока build-only и production runtime не зависит от них.

Проверка:

```bash
npm audit --omit=dev --audit-level=moderate
```

Результат на момент scaffold:

```text
found 0 vulnerabilities
```

Full `npm audit` может показывать dev/build-tool advisories по Astro/esbuild/vite. Это не production runtime, но должно быть отслежено перед реальным `dist` deploy. Не запускать `npm audit fix --force` вслепую: он может сделать breaking downgrade/upgrade.

## Legacy audits

Чтобы локальный `dist/` не воспринимался legacy-аудитами как production root, `dist/out/build/.astro/reports` исключены из legacy scan там, где нужно.

## Что НЕ сделано

- production deploy не переключался на `dist`;
- `/about/` не мигрирован;
- статьи не переносились в MDX;
- карты/3D не переписывались;
- hosting не менялся;
- CMS не подключалась.

## Следующий шаг

По `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md` следующий runtime шаг — `/about/` pilot, но только после отдельной проверки/решения. Перед этим можно добавить `compare-url-contract` for dist в CI как advisory, когда появится build-time strangler.

## Dist contract smoke

После `astro:build` проверено:

```bash
npm run contract:extract:dist
```

Результат ожидаемый для scaffold-only:

```text
HTML files: 1
Public pages: 0
Noindex pages: 1
Issues: 0
```

`contract:compare:dist` пока намеренно не запускается как gate, потому dist ещё не содержит legacy-copied pages. Он станет обязательным только на этапе build-time strangler, когда dist будет содержать полный сайт.
