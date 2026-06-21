# PROJECT HEALTH AUDIT v2 — ИСПРАВЛЕННЫЙ И УГЛУБЛЁННЫЙ

**Дата:** 2026-06-21  
**Версия:** 2.0 (верификация через локальный clone + эксперименты)  
**Автор:** Arena Agent (post-verification)  
**Предыдущий:** PROJECT_HEALTH_AUDIT_2026-06-21.md (v1 — содержал критические ошибки)

---

## 1. РЕПОЗИТОРИЙ

| Параметр | Факт | Примечание |
|----------|------|------------|
| Total commits | 1335+ | GitHub UI; shallow clone видит 50 |
| Active branch | main | |
| Production | gospod-bog.ru (GitHub Pages) | dist artifact |
| Stack | Astro 6 + MDX + Vanilla JS + Handcrafted CSS | Node 22.12+ required |
| CPU sandbox | 2 cores | |
| RAM sandbox | 1.9 GB (1.5 GB available) | |
| Filesystem | ext4 | Персистент между сессиями |

---

## 2. СТРАНИЦЫ: ARCHITECTURE REALITY CHECK ⚠️ КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ

| Тип | Количество | Статус v1 | Статус v2 (факт) |
|-----|-----------|-----------|-----------------|
| **Full-document shadow** (`loadLegacyFullDocument`) | **51** | "30+" | **51/52 (98%)** |
| Native-shadow (`loadLegacyShadowPage`) | 0 | "6" | **0** |
| Native Astro (hand-authored) | 1 | "~5" | **1** (`dev/astro-test.astro`) |
| Full shadow — landing pages | 11 | верно | 11 |

**Критический вывод:** Коммиты e116bec (20 июня, 21:00 UTC) и 87fcc7b (20 июня, 22:00 UTC) выполнили **архитектурный откат**: 51 из 52 production-страниц переведены на `loadLegacyFullDocument` — verbatim legacy HTML. Astro теперь работает как **static file server + URL router**, не как компонентный фреймворк.

**Последствия:**
- Все MDX content collections — orphaned (сиротский код).
- Все native layouts (`ArticleLayout.astro`, `SeriesArticleLayout.astro`, `GenealogyTree.tsx`) — orphaned.
- CSS бандлинг через Astro (`_astro/*.css`) не используется для production-страниц.
- Refactoring 6.0 Phases 3-5 (native-shadow, MDX migration) **невозможны** без предварительного выхода из 100% shadow.

---

## 3. CSS — ВЕРИФИЦИРОВАННЫЕ МЕТРИКИ

| Файл | Размер | !important | Примечание |
|------|--------|------------|------------|
| site.css | 265 KB | **202** | v1: 270; факт: 202 (после 40c80dc) |
| home.css | 51 KB | 36 | v1: 20; факт: 36 |
| command-palette.css | 38 KB | 7 | |
| mobile-hotfix.css | ~5 KB | **85** | v1: 74; факт: 85 |
| nagornaya-mobile-toc.css | ~3 KB | **133** | v1: 122; факт: 133 |
| **ИТОГО** | ~362 KB | **463** | v1: 493; факт: 463 |

**Важно:** Поскольку 51/52 страниц используют verbatim `<link rel="stylesheet" href="/css/site.css">` из shadow-wrap, **любая CSS-реформа требует изменения legacy HTML** или выхода из shadow-wrap. `@layer` migration (Phase 2) блокирована архитектурой.

---

## 4. JS — ВЕРИФИЦИРОВАННЫЕ МЕТРИКИ

| Файл | Размер | Строки | addEventListener | removeEventListener | Примечание |
|------|--------|--------|------------------|---------------------|------------|
| site.js | 165 KB | **569** | **45** | **3** | v1: 5129 строк — ОШИБКА |
| enhancements.js | 48 KB | 13 | — | — | Минимизирован |
| search.js | 33 KB | 0 (wc) | — | — | Минимизирован |
| bookmark-engine.js | 12 KB | — | — | — | |
| glossary.js | 7 KB | — | — | — | |
| highlights.js | 14 KB | — | — | — | |
| nagornaya-mobile-toc.js | 15 KB | — | — | — | |
| series-cards.js | 2.6 KB | 59 | — | — | |
| site-utils.js | 2.3 KB | — | — | — | |
| sw-register.js | 3.7 KB | — | — | — | |
| **Итого runtime** | ~300 KB | ~700+ | **45+** | **3** | |
| map-engine.js | 169 KB | 2590 | — | — | |
| avraam-app.js | 247 KB | 2407 | — | — | Extracted из index.html |
| avraam/index.html | ~117 KB | 2385 | — | — | HTML только |

**Критический вывод:** v1 заявлял 130+ addEventListener без remove. Факт: 45 addEventListener, 3 removeEventListener в site.js. Это **всё ещё memory leak** (15:1 ratio), но масштаб меньше.

---

## 5. КОНТЕНТ — MDX vs HTML REGRESSION (ВЕРИФИЦИРОВАНО)

| Статья | MDX words | HTML words | Diff | Статус | Примечание |
|--------|-----------|------------|------|--------|------------|
| 20-antisovetov | 15,332 | 15,224 | +108 | ⚠️ MDX richer | Разница в 0.7% — в пределах tolerance |
| gill-kontekst | 3,514 | 3,385 | +129 | ⚠️ MDX richer | 3.7% — погранично |
| gill-spravochnik | 1,857 | 1,877 | -20 | ✅ | |
| kod-da-vinchi | 6,809 | 6,835 | -26 | ✅ | |
| rimlyanam-7 | 2,978 | 2,853 | +125 | ⚠️ MDX richer | 4.2% — погранично |
| hermenevticheskaya | 10,444 | 10,576 | -132 | ✅ | HTML богаче (footnotes) |

**Parity guard (`check-mdx-html-parity.js`)**: 0 errors, 0 warnings (12% tolerance). **Но:** tolerance слишком широк для качественных потерь. Новые `<h2>`, улучшенные `alt`, `<figure>` в MDX могут быть в пределах 3-5% word count, но отсутствовать в production HTML.

**Shallow-clone trap:** parity guard пытается проверить `git log -1 --format="%ci"`, но в shallow clone (`--depth 50`) история обрезана. Для 6+ статей MDX и HTML показывают одинаковый last commit, поэтому warning "MDX is newer" **не срабатывает** — false negative.

---

## 6. AUDIT SYSTEM

| Компонент | Факт | v1 | Статус |
|-----------|------|-----|--------|
| audit-pro.js | 4383 строки | 4384 | ✅ |
| Guards (G1-G113+) | 164 passed | 95+ | ✅ Расширено |
| visual-parity-screenshots.js | 323 строки | 323 | ✅ |
| visual-parity-baseline.js | 105 строк | 105 | ✅ |
| Per-route audit scripts | 17 | 17 | ✅ |
| check-mdx-html-parity.js | 157 строк | — | 🆕 Новый |

---

## 7. CI/CD HEALTH

| Workflow | Статус | Проблема |
|----------|--------|----------|
| deploy.yml | ✅ | Не блокируется visual parity — DOM-marker только |
| visual-parity.yml | ✅ | Weekly + manual, **не блокирует deploy** |
| indexnow.yml | ✅ | |
| interactive-audit.yml | ✅ | Weekly + manual |
| source-links.yml | ✅ | Weekly + manual |
| notify-on-failure.yml | ✅ | Создаёт Issue, но damage уже done |

**Критический пробел:** `deploy.yml` не запускает `visual-parity:guard` перед upload. CSS micro-regression (1-2px drift, font-loading, color shift) **пройдёт в production** и будет замечена только в понедельник утром.

---

## 8. MAPS — VERIFIED

| Компонент | Факт | v1 | Статус |
|-----------|------|-----|--------|
| MapEngine v1 (map-engine.js) | 2590 строк | 2276 | ⚠️ Обновлено |
| Avraam (index.html + avraam-app.js) | 4789 строк (2385+2404) | 4776 | ✅ Extracted |
| Dead modules (`modules/`) | **УДАЛЕНЫ** | listed | ✅ Исправлено (83ae4a8) |
| Route.json | 10/10 карт | 10/10 | ✅ |
| maps:validate | 10/10 | 10/10 | ✅ |
| avraam:audit | 28/28 | 28/28 | ✅ |

---

## 9. КЛЮЧЕВЫЕ ИСПРАВЛЕНИЯ vs v1

| v1 (ошибка) | v2 (факт) | Природа ошибки |
|-------------|-----------|----------------|
| 30+ pages in shadow-wrap | **51/52** | Устаревшая информация (pre-rollback) |
| site.js 5129 строк | **569 строк / 165 KB** | Считали распакованный бандл или опечатка |
| 130+ addEventListener | **45** | |
| CSS !important 493 | **463** | Неточность ~6% |
| C8: Dead modules | **Исправлено** | Устаревшая информация |
| Avraam monolith 4776 | **Extracted** (2385+2404) | Устаревшая информация |
| 6 native-shadow pages | **0** | Устаревшая информация (pre-rollback) |
| ~5 native Astro pages | **1** (dev only) | Устаревшая информация |

---

## 10. БЛОКИРУЮЩИЕ ЗАВИСИМОСТИ (НОВОЕ)

```
100% shadow-wrap
    ↓ блокирует
CSS @layer migration (Phase 2) — нет Astro-бандлинга
    ↓ блокирует
MDX native rendering (Phase 5) — orphaned code
    ↓ блокирует
CSP strict-dynamic (Phase 10) — inline CSP в каждом HTML
    ↓ блокирует
Performance budget/Lighthouse CI — нет контроля над HTML-разметкой
```

**Вывод:** Refactoring 6.0 требует **пересмотра архитектурной последовательности**. Сначала нужен **pilot выход из shadow-wrap** для хотя бы одной страницы, чтобы вернуть Astro к роли компонентного фреймворка.
