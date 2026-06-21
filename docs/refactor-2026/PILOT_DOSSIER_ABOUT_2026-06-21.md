# Pilot Dossier — `/about/` (shell-first lane)

**Дата:** 2026-06-21  
**Route class:** hybrid page-segment shadow  
**Current state:** `loadLegacyFullDocument` for head + body frame fragments + 2 leaf Astro components  
**Why this pilot:** лучший low-risk route для доказательства, что project может переходить от raw-fragment shadow к real Astro shell без потери parity.

---

## 1. Текущее устройство route

`src/pages/about/index.astro` уже находится в промежуточной стадии:

- legacy `<head>` сохраняется verbatim через `loadLegacyFullDocument('about/index.html')`
- body frame вынесен в:
  - `src/components/about/_legacy/body-before.html`
  - `src/components/about/_legacy/body-mid.html`
  - `src/components/about/_legacy/body-after.html`
- 2 смысловых блока вынесены в:
  - `src/components/about/AboutArticle.astro`
  - `src/components/about/AboutAccuracyBlock.astro`

### Что важно
Это **не true native page**, потому что оба компонента пока всё ещё делают raw render legacy HTML.
Но это уже лучший route для controlled replacement.

---

## 2. Exact files in scope

## Обязательные
- `src/pages/about/index.astro`
- `src/components/about/AboutArticle.astro`
- `src/components/about/AboutAccuracyBlock.astro`
- `src/components/about/_legacy/article.html`
- `src/components/about/_legacy/accuracy-block.html`
- `about/index.html` (baseline source of truth)
- `scripts/about-visual-parity-audit.js`

## Read-only references
- `audit/visual-parity-evidence-2026-06-21-full-coverage.md`
- `research/PRODUCTION_ROUTE_TAXONOMY_2026-06-21.md`
- `research/MIGRATION_LANE_PRIORITY_2026-06-21.md`

## Не трогать на первом pilot
- `src/utils/legacyFullDocument.ts`
- global route ownership
- `BaseLayout.astro`
- `docs/OWNER-REQUIREMENTS.md`

---

## 3. What exactly should be rewritten first

### Step 1 — `AboutArticle.astro`

Текущий вид:
```astro
import legacyHtml from './_legacy/article.html?raw';
<Fragment set:html={legacyHtml} />
```

### Цель
Переписать этот компонент в hand-authored Astro markup, сохранив:
- те же тексты,
- те же `id`, `class`, `data-pagefind-meta`,
- ту же семантику секций,
- те же ссылки и aria-labels,
- тот же порядок узлов.

### Почему именно он first
- самый большой смысловой блок страницы;
- page frame и scripts не трогаются;
- при неудаче откат минимален;
- визуальный риск ограничен одной article zone.

---

### Step 2 — `AboutAccuracyBlock.astro`

После стабилизации `AboutArticle.astro` переписать:
- `AboutAccuracyBlock.astro`

Это маленький блок с понятной структурой и низким blast radius.

---

### Step 3 — только потом трогать frame fragments

Не раньше чем после двух успешных шагов выше.

Frame fragments:
- `body-before.html`
- `body-mid.html`
- `body-after.html`

должны уходить последними, потому что в них сидят:
- skip-link,
- theme toggle,
- breadcrumb wrapper,
- page-wrap,
- footer,
- runtime scripts.

---

## 4. Success criteria

## Structural
- `src/pages/about/index.astro` продолжает использовать `loadLegacyFullDocument('about/index.html')` для head.
- Route не переходит на `BaseLayout`.
- `astro-shell`, `Header`, `Footer`, global Astro chrome не появляются.

## Visual
- `npm run visual:parity:screenshots -- --routes /about/`
- desktop / mobile diff внутри текущего approved tolerance

## Guard
- `node scripts/about-visual-parity-audit.js`
- не должно появиться generic wrapper markers

## Editorial
- все external links, mailto, contact handles, pagefind metas и anchor ids совпадают

---

## 5. Failure modes

### Красный флаг №1
Если новый `AboutArticle.astro` требует изменения `body-before.html` или `body-after.html`, значит scope пилота выбран слишком широко.

### Красный флаг №2
Если для совпадения требуется `BaseLayout`, значит пилот сорвался в generic-shell regression.

### Красный флаг №3
Если приходится менять legacy head, значит это уже не shell-first pilot, а full route redesign.

---

## 6. Recommended implementation order

1. Скопировать exact DOM structure из `src/components/about/_legacy/article.html`
2. Переписать в Astro без изменения class/id names
3. Сравнить HTML visual markers
4. Прогнать `about-visual-parity-audit`
5. Прогнать screenshot parity
6. Только после этого браться за `AboutAccuracyBlock.astro`

---

## 7. Why `/about/` is still the best shell-first pilot

Потому что он уже:
- не pure shadow,
- не special app,
- не GBS2 series world,
- не зависит от map runtime,
- и уже имеет 2 выделенных semantic leaves.

Это самый чистый маршрут для доказательства: **можно заменить raw legacy fragments на настоящий Astro, не ломая premium visual contract**.
