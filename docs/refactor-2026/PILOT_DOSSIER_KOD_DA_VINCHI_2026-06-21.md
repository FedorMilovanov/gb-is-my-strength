# Pilot Dossier — `/articles/kod-da-vinchi/` (content/layout-first lane)

**Дата:** 2026-06-21  
**Route class:** pure full-body shadow  
**Current state:** `loadLegacyFullDocument` + verbatim `bodyHtml` transport  
**Why this pilot:** после дополнительной верификации это лучший первый candidate для standard-article breakout.

---

## 1. Почему это pilot лучше, чем `rimlyanam-7`

Ранее предполагалось, что `rimlyanam-7` — low-risk article pilot. Это оказалось неверно.

### Что показала локальная проверка

`rimlyanam-7`:
- `series: hard-texts`
- legacy body = `body.gbs-world`
- содержит `gbs2-rail`, mobile sheet, progress ring, TOC runtime
- это не standard article, а **GBS2-style series article**

`kod-da-vinchi`:
- pure route
- MDX entry существует
- legacy body = `body.gbs-paper`
- нет GBS2 rail / mobile sheet / series chrome
- это стандартная article shell форма с более предсказуемой миграцией

**Вывод:** `kod-da-vinchi` — лучший first content pilot, если цель — доказать standard article breakout, а не сразу лезть в GBS2-series complexity.

---

## 2. Exact files in scope

## Обязательные
- `src/pages/articles/kod-da-vinchi/index.astro`
- `src/content/articles/kod-da-vinchi.mdx`
- `articles/kod-da-vinchi/index.html` (baseline)
- `scripts/article-mdx-pilot-audit.js`
- `scripts/visual-parity-screenshots.js`

## Вероятно затронет
- новый extracted-shell component directory
- возможно новый route-specific audit helper
- возможно новый article-shell extractor output (`_legacy/*.html`)

## Read-only references
- `src/layouts/ArticleLayout.astro`
- `src/layouts/BaseLayout.astro`
- `research/PRODUCTION_ROUTE_TAXONOMY_2026-06-21.md`
- `research/MIGRATION_LANE_PRIORITY_2026-06-21.md`
- `research/EXTERNAL_MIGRATION_CONSTRAINTS_2026-06-21.md`

---

## 3. Главное архитектурное открытие

### Нельзя просто «вернуть `ArticleLayout`»

Это была бы слишком грубая операция.

Почему:
- `ArticleLayout.astro` строится через `BaseLayout.astro`
- `BaseLayout.astro` добавляет `astro-shell`, `Header`, `Footer`, `global.css`
- legacy `kod-da-vinchi` page сейчас живёт в другом chrome-контракте

### Следствие

**Первый breakout должен быть не full switch на `ArticleLayout`, а extracted-shell promotion.**

То есть:
1. сохранить legacy head verbatim,
2. разрезать legacy body на frame + main article shell,
3. подменить article content на MDX `Content`,
4. только потом оценивать, нужен ли переход на generic `ArticleLayout` вообще.

---

## 4. Recommended first technical move

Использовать уже существующий helper:
- `scripts/extract-native-pilot.js`

### Концептуально
Для `kod-da-vinchi` нужно извлечь как минимум:
- frame before `<main id="main-content">`
- сам `<main id="main-content">...</main>`
- frame after main

Потом внутри extracted main-shell:
- заменить raw article body на `render(entry).Content`
- но оставить legacy page frame, breadcrumb zone, author card zone, SDG end-block и runtime contract

### Почему это лучше
Потому что такой путь:
- минимизирует visual blast radius,
- даёт настоящую MDX activation,
- не ломает legacy page contract сразу whole-route rewrite'ом.

---

## 5. Concrete breakout strategy

### Phase A — pure route → componentized shadow

Цель: перевести `/articles/kod-da-vinchi/` из:
- pure `bodyHtml`

в:
- legacy head + body segments + extracted main shell component

Это уже само по себе progress, потому что route переходит из класса 33 pure в класс 18+ hybrid-like.

### Phase B — activate MDX body inside shell

Внутри extracted main-shell:
- подключить `getEntry('articles', 'kod-da-vinchi')`
- `const { Content } = await render(entry)`
- заменить центральный article content на MDX output
- сохранить legacy wrappers, metas, author-card, SDG block

### Phase C — only after parity proof

Только после этого решать:
- нужен ли `ArticleLayout` как universal layout,
- или standard article lane лучше развивать через legacy-compatible shell components.

---

## 6. Success criteria

## Structural
- route перестаёт быть pure `bodyHtml` transport;
- но пока ещё не обязан переходить на `BaseLayout`.

## Content
- MDX content реально участвует в production rendering path;
- headings / figures / editorial improvements из MDX доходят до live route.

## Visual
- parity screenshots for `/articles/kod-da-vinchi/`
- no generic `astro-shell` drift
- no unexpected header/footer injection

## Audit
- обновить или расширить `article-mdx-pilot-audit.js`
- добавить route-specific expectations для `kod-da-vinchi`

---

## 7. Known blockers

### Blocker 1 — current `ArticleLayout` mismatch

Current `ArticleLayout` — это useful native asset, но не доказано, что он подходит как first-step replacement для legacy standard article pages.

### Blocker 2 — static hosting model

На GitHub Pages + `output: 'static'` нельзя сделать настоящий cookie-based pilot rollout.

Следовательно pilot проверяется через:
- `dev/` preview route,
- `dist` artifact,
- visual parity,
- manual smoke.

### Blocker 3 — route-specific runtime assumptions

Нужно проверить, что legacy page relies only on:
- `site.css`
- `command-palette.css`
- `mobile-hotfix.css`
- `site.js`
- `search.js`
- `SITE_CONFIG`

Если в legacy shell есть page-specific assumptions, их нельзя потерять при MDX activation.

---

## 8. Exact commands to anchor the pilot

### Route taxonomy sanity
```bash
npm run route:taxonomy
```

### MDX/content audit
```bash
node scripts/article-mdx-pilot-audit.js --require-content-parity
```

### Visual proof
```bash
node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/
```

### Build smoke
```bash
npm run strangler:build:production-like
```

---

## 9. Final recommendation

Если нужна **первая честная активация MDX в production-grade route**, то:

- **не** начинать с `rimlyanam-7`
- **не** делать blind revert на `ArticleLayout`
- **начинать с `kod-da-vinchi` через extracted-shell breakout**

Это лучший баланс между:
- реальной ценностью для migration,
- управляемым visual risk,
- и возможностью потом масштабировать recipe на другие standard article routes.
