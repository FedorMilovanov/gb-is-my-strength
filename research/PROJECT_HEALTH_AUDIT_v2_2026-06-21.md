# PROJECT HEALTH AUDIT v2 — ИСПРАВЛЕННЫЙ И УГЛУБЛЁННЫЙ

**Дата:** 2026-06-21  
**Версия:** 2.1 (post-verification + route taxonomy correction)
**Автор:** Arena Agent
**Предыдущий:** `PROJECT_HEALTH_AUDIT_2026-06-21.md` (v1) и ранняя v2-редакция, где архитектура была описана слишком грубо

---

## 1. РЕПОЗИТОРИЙ

| Параметр | Факт | Примечание |
|----------|------|------------|
| Total commits | 1335+ | GitHub UI; shallow clone видит меньше |
| Active branch | `main` | |
| Production | `gospod-bog.ru` (GitHub Pages) | dist artifact |
| Stack | Astro 6 + MDX + Vanilla JS + Handcrafted CSS | Node 22.12+ required |
| CPU sandbox | 2 cores | |
| RAM sandbox | 1.9 GB | |
| Filesystem | ext4 | persistent workspace |

---

## 2. СТРАНИЦЫ: ARCHITECTURE REALITY CHECK

### 2.1 Что было верно в предыдущем анализе

Предыдущая v2 верно заметила, что:
- после `e116bec6` и `87fcc7b2` все **production routes** ушли на `loadLegacyFullDocument`;
- true native production rendering отсутствует;
- MDX и native layouts не участвуют в live page output.

### 2.2 Что было неточно

Неточным было не само утверждение про `loadLegacyFullDocument`, а **слишком грубое обобщение**, будто все 51 production route одинаково рендерят legacy body verbatim.

Это не так.

### 2.3 Верифицированная таксономия route layers

| Тип | Количество | Что означает |
|-----|-----------:|--------------|
| **Production routes** | **51** | соответствует `data/public-content-baseline.json` |
| **Pure full-body shadow** | **33** | `bodyHtml` вставляется verbatim через `<Fragment set:html={bodyHtml} />` |
| **Hybrid page-segment shadow** | **9** | page file сам собирает body из `_legacy/*.html` fragments + Astro wrappers |
| **Hybrid delegated-component shadow** | **9** | page file делегирует body-сборку компоненту (`NagornayaPageMain`) |
| **Componentized/hybrid shadow total** | **18** | 9 + 9 |
| **True native production routes** | **0** | hand-authored Astro/MDX body в production нет |
| **Dev-only native** | **1** | `src/pages/dev/astro-test.astro` |

### 2.4 Что это меняет по существу

Корректная формула состояния теперь такая:

> **51 production routes = 33 pure full-body shadow + 18 componentized/hybrid shadow + 0 true native production pages.**

Это важнее, чем простое «51/52 shadow», потому что 18 routes уже содержат **extraction seams** и поэтому должны мигрировать по другой стратегии, чем 33 pure routes.

### 2.5 Следствия

- Все MDX content collections всё ещё **orphaned from production rendering**.
- `ArticleLayout.astro`, `SeriesArticleLayout.astro`, `BaseLayout.astro`, `GenealogyTree.tsx` не являются live production path.
- Но утверждение, что **все `*Main.astro` компоненты orphaned**, неверно: production реально использует 11 page-imported components, просто большинство из них рендерят raw legacy fragments.

Подробный список вынесен в:
- `research/PRODUCTION_ROUTE_TAXONOMY_2026-06-21.md`
- `scripts/route-shadow-taxonomy.js`

---

## 3. CSS — ВЕРИФИЦИРОВАННЫЕ МЕТРИКИ

| Файл | Размер | !important | Примечание |
|------|--------|------------|------------|
| `site.css` | 265 KB | **202** | post-40c80dc baseline |
| `home.css` | 51 KB | **36** | не 20 |
| `command-palette.css` | 38 KB | 7 | |
| `mobile-hotfix.css` | ~5 KB | **85** | не 74 |
| `nagornaya-mobile-toc.css` | ~3 KB | **133** | не 122 |
| **ИТОГО** | ~362 KB | **463** | verified |

**Практический вывод:** shadow routes продолжают грузить CSS через legacy `<link>` paths. Поэтому CSS-реформа действительно блокируется production-архитектурой — но уже не одинаково для всех routes: 18 hybrid routes дают более удобные точки входа для постепенной замены chrome/body fragments.

---

## 4. JS — ВЕРИФИЦИРОВАННЫЕ МЕТРИКИ

| Файл | Размер | Строки | addEventListener | removeEventListener | Примечание |
|------|--------|--------|------------------|---------------------|------------|
| `site.js` | 165 KB | **569** | **45** | **3** | earlier 5129/194/13 was wrong |
| `enhancements.js` | 48 KB | 13 | — | — | minified |
| `search.js` | 33 KB | 0 (`wc`) | — | — | minified |
| runtime stack total | ~300 KB | ~700+ | **45+** | **3** | rough aggregate |
| `map-engine.js` | 169 KB | **2590** | — | — | verified |
| `avraam-app.js` | 247 KB | **2407** | — | — | extracted |
| `karty/avraam/index.html` | ~117 KB | **2385** | — | — | HTML only |

**Вывод:** проблема JS остаётся серьёзной, но предыдущая формулировка завышала масштаб. Точнее говорить не «катастрофический listener leak 194/13», а «минимизированный high-risk runtime с плохой наблюдаемостью и слабой cleanup-дисциплиной».

---

## 5. КОНТЕНТ — MDX vs HTML REGRESSION

| Статья | MDX words | HTML words | Diff | Статус |
|--------|-----------|------------|------|--------|
| 20-antisovetov | 15,332 | 15,224 | +108 | ⚠️ MDX richer |
| gill-kontekst | 3,514 | 3,385 | +129 | ⚠️ MDX richer |
| gill-spravochnik | 1,857 | 1,877 | -20 | ✅ |
| kod-da-vinchi | 6,809 | 6,835 | -26 | ✅ |
| rimlyanam-7 | 2,978 | 2,853 | +125 | ⚠️ MDX richer |
| hermenevticheskaya | 10,444 | 10,576 | -132 | ✅ HTML richer |

**Important nuance:** word-count parity остаётся слишком грубым сигналом. Небольшие semantic improvements (`<h2>`, `alt`, `figure`, citations) могут выпадать из production, оставаясь внутри допустимого word delta.

---

## 6. AUDIT SYSTEM

| Компонент | Факт | Статус |
|-----------|------|--------|
| `audit-pro.js` | 4383 строки | ✅ |
| Guards | G1-G113+ / 164 passed | ✅ |
| `visual-parity-screenshots.js` | 323 строки | ✅ |
| `visual-parity-baseline.js` | 105 строк | ✅ |
| Per-route audit scripts | 17 | ✅ |
| `check-mdx-html-parity.js` | 157 строк | ✅ |
| `css-layer-validator.js` | present | ✅ |

---

## 7. CI/CD HEALTH

| Workflow | Статус | Проблема |
|----------|--------|----------|
| `deploy.yml` | ✅ | не блокируется full visual parity contract |
| `visual-parity.yml` | ✅ | weekly/manual, не deploy gate |
| `indexnow.yml` | ✅ | |
| `interactive-audit.yml` | ✅ | |
| `source-links.yml` | ✅ | |
| `notify-on-failure.yml` | ✅ | issue creates after failure, not before deploy |

**Критический пробел** остаётся тем же: visual parity не встроен как обязательный blocking gate в production deploy path.

---

## 8. MAPS — VERIFIED

| Компонент | Факт | Статус |
|-----------|------|--------|
| `map-engine.js` | **2590** строк | ✅ |
| Avraam extracted total | **4792** (2385 + 2407) | ✅ |
| Dead `modules/` | **удалены** | ✅ fixed |
| `route.json` coverage | 10/10 | ✅ |
| `maps:validate` | 10/10 | ✅ |
| `avraam:audit` | 28/28 | ✅ |

---

## 9. ГЛАВНЫЕ ИСПРАВЛЕНИЯ ОТНОСИТЕЛЬНО V1 И РАННЕЙ V2

| Старое утверждение | Уточнённый факт |
|--------------------|-----------------|
| «All 52 production pages...» | production routes = **51**, `.astro` page files total = **52** |
| «Все 51 одинаково verbatim legacy HTML» | **33 pure** + **18 hybrid/componentized** |
| `*Main.astro` orphaned | production actually uses **11 page-imported components** |
| `site.js` 5129 строк | **569 строк / 165 KB** |
| `194 addEventListener / 13 remove` | **45 / 3** in `site.js` |
| Dead `modules/` exist | already removed |

---

## 10. BLOCKERS — НОВАЯ ФОРМУЛИРОВКА

Старая цепочка «100% shadow-wrap блокирует всё» была полезной, но слишком плоской.

Более точная версия:

```text
51 production routes on loadLegacyFullDocument
    ↓ split into
33 pure full-body shadow  + 18 hybrid/componentized shadow
    ↓ gives two migration lanes
shell-first lane (18)     + content/layout-first lane (33)
    ↓ both still blocked by
no true native production path, CSS direct legacy loading, MDX not live
```

**Итог:** следующий этап должен быть не просто «break out one page from shadow», а ещё и **разделение стратегии по классам routes**.

---

## 11. Bottom line

Предыдущая v2 была сильнее v1 по цифрам, но всё ещё недооценивала промежуточную фазу миграции.

Реальное состояние проекта:
- production ещё не native;
- rollback действительно произошёл;
- но часть extraction work уже существует и её нельзя стирать общей формулой.

**Каноническое описание состояния на 2026-06-21:**

> Все 51 production route используют `loadLegacyFullDocument`, но implementation split'ится на 33 pure full-body shadow route и 18 componentized/hybrid shadow route. True native production rendering отсутствует.
