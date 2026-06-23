# V7 Kod-da-Vinchi — Status Report

**Date:** 2026-06-23  
**Agent:** Arena Agent Mode  
**Branch:** lane/visual-fix-kod-da-vinchi-2026-06-23

## Проблемы Найдены и Исправлены

### ❌ КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (уже применены)

**1. CSS @layer pilot — УДАЛЁН**
- **Проблема:** `site-layered.css` заменял `site.css`, ломая CSS каскад через `@layer`
- **Симптом:** 16-18% визуального диффа (КАЖДЫЙ пиксель страницы)
- **Фикс:** Убрана подмена CSS, возвращён canonical `site.css`
- **Файлы:** `src/pages/articles/kod-da-vinchi/index.astro`

**2. JS modules pilot — УДАЛЁН**
- **Проблема:** `site-modules.js` инжектился inline дополнительно к `site.js`
- **Фикс:** Убран inline script тег
- **Файлы:** `src/pages/articles/kod-da-vinchi/index.astro`

**3. DOM структура footer — ИСПРАВЛЕНА**
- **Проблема:** `<footer>` был СНАРУЖИ `.page-wrap` в dist, но ВНУТРИ в legacy
- **Симптом:** footer width 1265px (dist) vs 772px (legacy) — ломает CSS `.page-wrap footer`
- **Фикс:** footer перенесён внутрь `.page-wrap` в index.astro; дубликат footer убран из `KodDaVinchiPageFooter.astro`
- **Файлы:** 
  - `src/pages/articles/kod-da-vinchi/index.astro` — footer добавлен внутри .page-wrap
  - `src/components/article-pilots/kod-da-vinchi/KodDaVinchiPageFooter.astro` — footer удалён

**4. DOM структура page-wrap — ИСПРАВЛЕНА**
- **Проблема:** `.page-wrap` закрывался в `KodDaVinchiPageChrome.astro`, оставляя `<main>` снаружи
- **Симптом:** CSS селекторы `.page-wrap main` не работали
- **Фикс:** `.page-wrap` перенесён на уровень index.astro, оборачивает Chrome + MainShell
- **Файлы:**
  - `src/components/article-pilots/kod-da-vinchi/KodDaVinchiPageChrome.astro` — убран `<div class="page-wrap">`
  - `src/components/article-pilots/kod-da-vinchi/KodDaVinchiMainShell.astro` — `<main>` возвращён внутрь
  - `src/pages/articles/kod-da-vinchi/index.astro` — `.page-wrap` оборачивает все компоненты контента

### 🟡 ОСТАВШИЕСЯ ПРОБЛЕМЫ

**Visual diff после фиксов: ~5.9% (desktop viewport), ранее было 16-18%**

Оставшийся diff вероятно вызван:
- Sub-pixel font rendering различия (anti-aliasing)
- Whitespace minification между legacy и Astro output
- Отличия в 89px высоты (30159 vs 30070)

## Архитектура kod-da-vinchi (после фиксов)

```
src/pages/articles/kod-da-vinchi/index.astro
  ├── head: loadLegacyFullDocument() для SEO/OG meta (костыль, но не влияет на визуал)
  └── body:
      ├── .page-wrap#content (в index.astro)
      │   ├── KodDaVinchiPageChrome (skip-link, theme-toggle, toc-sidebar, breadcrumb)
      │   ├── KodDaVinchiMainShell
      │   │   ├── <main id="main-content"> (внутри .page-wrap ✅)
      │   │   │   ├── HeaderHero (h1 + desc + hero figure)
      │   │   │   ├── ArticleBody (20 секций: Intro..Conclusion)
      │   │   │   └── PostArticle (accuracy block, author card, SDG)
      │   │   └── </main>
      │   └── <footer> (внутри .page-wrap ✅)
      └── KodDaVinchiPageFooter (вне .page-wrap ✅)
          ├── bottom-bar
          ├── btoc-overlay
          ├── bookmark-toast
          └── legacy script tags
```

## Компоненты — Native vs ?raw

**✅ 100% Native Astro (hand-authored, без ?raw):**
- KodDaVinchiArticleBody + 20 секций (SectionIntro..SectionConclusion)
- KodDaVinchiSectionQuiz, KodDaVinchiSectionFaq
- KodDaVinchiSectionPhenomenon, KodDaVinchiSectionDates, и др.
- KodDaVinchiSectionSummaryTitleAuto
- KodDaVinchiPagefindMeta

**⚠️ Всё ещё используют ?raw (нужно исправить):**
- KodDaVinchiPageChrome.astro — body-segment-0 был ?raw, теперь hand-authored ✅
- KodDaVinchiPageFooter.astro — body-segment-1 был ?raw, теперь hand-authored ✅
- KodDaVinchiMainShell.astro — был ?raw wrapper, теперь composite ✅
- KodDaVinchiArticleHeaderHero.astro — был ?raw, теперь hand-authored ✅
- KodDaVinchiPostArticle.astro — был ?raw, теперь hand-authored ✅

**Фактически ВСЕ компоненты kod-da-vinchi уже переведены в hand-authored Astro.**
Оставшиеся ?raw комментарии в коде — это historical notes, не активные импорты.

## Что ОСТАЁТСЯ костылём

1. **`loadLegacyFullDocument` для headHtml** — head загружается из legacy HTML вместо native Astro head. Это не влияет на визуал (meta-теги невидимы), но архитектурно это костыль. Нужно заменить на native Astro `<head>`.

## Setup инструкции

### Node.js
```bash
# Требуется Node >= 22.12.0
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
```

### Playwright
```bash
npm install playwright
npx playwright install chromium
npx playwright install-deps chromium
```

### Диагностика визуального parity
```bash
node _diag-kod.mjs  # Full-page stitched screenshot comparison
```

## Прогресс V7

| Метрика | Было | Сейчас | Цель |
|---------|------|--------|------|
| Desktop visual diff | 16-18% | ~5.9% | < 0.5% |
| Mobile visual diff | 16-18% | TBD | < 0.5% |
| ?raw компоненты | 5 файлов | 0 файлов | 0 |
| CSS @layer pilot | Активен | ❌ Удалён | ❌ |
| JS modules pilot | Активен | ❌ Удалён | ❌ |
| Footer в .page-wrap | ❌ | ✅ | ✅ |
| Main в .page-wrap | ❌ | ✅ | ✅ |
