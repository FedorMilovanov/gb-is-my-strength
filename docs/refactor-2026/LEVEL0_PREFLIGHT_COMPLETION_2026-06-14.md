# LEVEL0_PREFLIGHT_COMPLETION_2026-06-14.md

Дата: 2026-06-14  
Риск-уровень: **Level 0 — docs/scripts/data validation only**

## Назначение

Закрыть безопасные pre-refactor gaps перед любым Astro/React-islands scaffold. Production runtime, deploy, URL и legacy HTML не меняются.

## Закрытые gaps из refactor handoff

### 1. URL contract extractor

Файл:

```text
scripts/extract-url-contract.js
```

Поддерживает:

```bash
npm run contract:extract
npm run contract:extract:root
npm run contract:extract:dist
```

Ключевые опции: `--root`, `--out-json`, `--out-md`, `--include-noindex`.

### 2. URL contract comparator

Файл:

```text
scripts/compare-url-contract.js
```

Команды:

```bash
npm run contract:compare
npm run contract:compare:dist
```

Что проверяет:

- baseline URL не пропал;
- title/H1 не пустые;
- canonical остаётся self-referencing;
- public URL не стал `noindex`;
- substantial word-count не просел ниже 72%;
- новые URL разрешены по умолчанию, но видны как warning.

### 3. Map route schema

Файл:

```text
karty/_shared/route.schema.json
```

Это JSON Schema для будущей Astro/route-data фазы. Сейчас она документирует контракт; runtime не зависит от неё.

### 4. Map route validator

Файл:

```text
scripts/validate-map-routes.js
```

Команда:

```bash
npm run maps:validate
```

Проверяет все `karty/*/route.json`:

- `meta`, `stories`, `places`, `stages`;
- уникальность ids;
- корректность stage references;
- story place/stage references;
- stats vs actual counts;
- basic photo alt/src;
- coordinate sanity.

### 5. Ishod route draft/scaffold consistency

`karty/ishod/route.json` имел pre-refactor debt:

- `meta.stats.places = 14`, но `places.length = 7`;
- stories ссылались на отсутствующие `etham`, `elim`, `rephidim`, `aaron_mount`.

Исправлено безопасно как data scaffold:

- добавлены 4 недостающих минимальных узла;
- `meta.stats.places` синхронизирован с фактическими 11 places.

Production UI карты Исхода остаётся scaffold/no heavy runtime.

## Gates

`validate:static-publication` теперь включает:

```text
validate:all
maps:validate
avraam:audit
tokens:check
audit-pro
readable-audit
editorial:lint
data:consistency
content:guard
contract:compare
```

`reports/` добавлен в `.gitignore` и `audit-pro` skipDirs, потому contract reports — локальные артефакты.

## Чего НЕ сделано

- Astro зависимости не устанавливались.
- `deploy.yml` не менялся.
- Production output не менялся.
- HTML → MDX не начинался.
- Карта Авраама UI не переписывалась.
- Hosting не менялся.

## Проверка на момент добавления

```bash
npm run maps:validate
npm run contract:compare
npm run validate:static-publication
npm run konfessii:audit
npm run workflows:check
```

Ожидаемый статус: все pass; remaining warnings только стратегические (CSS budget, `!important`, Avraam inline script).
