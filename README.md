# Господь Бог — Сила Моя · gospod-bog.ru

Богословский и редакционный сайт: экзегеза, история церкви, апологетика, переводы, серии, исследования и интерактивные библейские карты.

Production публикуется GitHub Pages из production-like `dist/`, собранного из Astro 7, MDX/content collections и явно зарегистрированных legacy/special adapters. Корень репозитория не является Pages-артефактом.

## Начать здесь

1. ИИ-агент: [`AGENTS.md`](AGENTS.md).
2. Режим и ownership: [`docs/WORK_MODES.md`](docs/WORK_MODES.md) → [`docs/LANE_LOCK_POLICY.md`](docs/LANE_LOCK_POLICY.md).
3. Документальная authority: [`docs/DOCUMENT_AUTHORITY.md`](docs/DOCUMENT_AUTHORITY.md) и machine SSOT [`data/document-authority.json`](data/document-authority.json).
4. Owner-sensitive решения: [`docs/OWNER-INVARIANTS.md`](docs/OWNER-INVARIANTS.md).
5. Verified backlog / reverify evidence: проект `gb-is-my-strength` в [`FedorMilovanov/AuditRepo`](https://github.com/FedorMilovanov/AuditRepo), прежде всего `verified/MASTER_BUG_MATRIX.md`.

Активную работу определяют текущий `main`, открытые PR/issues и exact heads. Датированные migration/readiness/incident/forensic документы не становятся current authority только из-за имени `CURRENT`, `FINAL`, `READY` или даты в названии.

## Документальная модель

`data/document-authority.json` управляет repository-wide authority и явно классифицированными high-risk документами. Незарегистрированный документ по умолчанию имеет только `surface-local-non-overriding` роль: он может быть действующим локальным контрактом лишь при явном current delegation от владельца/source/current contract, но не может сам переопределить зарегистрированную глобальную authority.

Исторические документы сохраняются для provenance и расследований; их не надо удалять ради «чистоты». Но operational entrypoint не должен выдавать historical snapshot за текущее состояние.

## Текущая архитектура

### Build и deploy

- **Node:** `>=22.12.0`; точная toolchain authority — `package.json`, lockfile и CI contracts.
- **Framework:** Astro 7 + MDX/content collections; точные package versions берутся из `package.json`/`package-lock.json`, а не из prose.
- **Production output:** `npm run strangler:build:production-like` → `dist/`.
- **Deploy source of truth:** `.github/workflows/deploy.yml`.
- **Runtime:** статический HTML/CSS/vanilla JS с явно изолированными capability adapters.
- **Service Worker / Pagefind:** проверяются на production-like `dist`; source merge не доказывает live bytes.

### Route ownership

Публичная поверхность определяется machine registries:

```text
migration/page-ownership.json
+ data/route-profiles/*.json
→ scripts/lib/effective-route-registry.js
→ migration/route-migration-matrix.json (derived projection)
```

`migration/route-migration-matrix.json` не редактируется вручную. Точные route/index/search counts вычисляются из registries и validation reports; README намеренно не хранит второй ручной счётчик.

После изменения ownership/profile:

```bash
node scripts/sync-route-migration-matrix.js --write
npm run migration:metadata:check:strict
```

### Search / sitemap / RSS

`data/route-search-policy.json` задаёт publication/search membership. `data/search-manifest.json`, `sitemap.xml` и `feed.xml` являются проверяемыми projections, а не независимыми источниками истины.

### Reader / capability ownership

Current reader families и retained capabilities должны иметь одного semantic owner. Не возвращайте legacy transport или вторую handwritten copy только для достижения визуального/контентного паритета. Route-specific исключения допускаются только через явный current contract.

## Source, build и production — разные доказательства

- **Source truth:** exact commit и проверенные source owners.
- **Build truth:** exact production-like `dist` и CI artifact.
- **Production truth:** Pages/live witness для конкретного release SHA.

`merge != deploy`, а зелёный workflow старого head не доказывает новый head.

## Рабочий процесс

Обычная запись идёт через bounded branch + PR. Direct `main` — только owner-approved emergency с rollback SHA и немедленной reconciliation.

Выбирайте FAST/LANE/SYSTEM и только применимые checks по [`docs/WORK_MODES.md`](docs/WORK_MODES.md). Для shared/system изменений final exact-head barrier задаётся затронутыми contracts; wording-only docs diff не требует full production build без технической причины.

Основные control-plane проверки:

```bash
npm run guard:shared-files
npm run control-plane:audit
npm run workflows:check
node scripts/document-authority-audit.mjs
```

## Редакционный контур

Текущие верхнеуровневые документы:

- [`docs/ARTICLE-STANDARD-CHARTER.md`](docs/ARTICLE-STANDARD-CHARTER.md);
- [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md);
- [`docs/CONTENT-QUALITY-STANDARD.md`](docs/CONTENT-QUALITY-STANDARD.md).

Их authority reconciled 2026-09-07: Charter определяет publication/editorial eligibility, Editorial Source Policy — research/evidence closure, а Content Quality Standard — reader-facing capability/quality requirements. Эти границы не создают второй source of truth поверх более свежих machine/source contracts. Research closure, editorial readiness, publication eligibility и production/live state — разные границы.

## Legacy, visual reference и owner provenance

- [`docs/REFERENCE_TRANSFER_POLICY.md`](docs/REFERENCE_TRANSFER_POLICY.md) — current режимы reference transfer (`exact-replica`, `adaptive-approved`, `native-contract`, `legacy-preserve`, и др.).
- [`docs/OWNER-REQUIREMENTS.md`](docs/OWNER-REQUIREMENTS.md) — исторический owner-message provenance, не универсальный live merge-gate.
- [`docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md`](docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md) — исторический migration plan, не текущая route-ownership модель.

Точный repository-wide статус явно классифицированных документов берётся из `data/document-authority.json`; локальный surface-guide требует current delegation и не получает глобальную authority автоматически.

## Forensic и audit

Current verified necessary work живёт в AuditRepo. `docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md` сохраняется как датированный source/forensic snapshot и не заменяет current Product tree или AuditRepo MASTER.

Старый README до введения document-authority SSOT сохранён без потерь: [`docs/history/README-2026-09-07-pre-document-authority.md`](docs/history/README-2026-09-07-pre-document-authority.md).

## Главный принцип

Если факт можно детерминированно получить из текущего source tree, registry, lockfile или CI artifact, prose не должен становиться вторым ручным SSOT этого факта.
