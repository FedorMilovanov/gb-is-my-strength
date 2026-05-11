# 🔬 МАСТЕР-АУДИТ: gospod-bog.ru — ФИНАЛЬНЫЙ v10
## Версия патча: v10 · Дата: 2026-05-10

---

## ИТОГОВАЯ ТАБЛИЦА — 19 из 19 задач закрыты ✅

| ID | Описание | Файл | Приоритет | Статус | Версия |
|----|----------|------|-----------|--------|--------|
| BUG-01 | `ssr:false` в Яндекс.Метрике | `index.html:93` | 🔴 | ✅ Выполнено | v7 |
| BUG-02 | «как у ланей» (иврит) | `index.html:269,271` | 🔴 | ✅ Выполнено | v7 |
| BUG-03 | Theme toggle: `themeToggle || hThemeBtn` | `js/site.js:302` | 🟠 | ✅ Выполнено | v7 |
| BUG-04 | sw-register.js v1.1 | `js/sw-register.js` | 🟠 | ✅ Выполнено | **v10** |
| BUG-05 | highlights.js v1.1 | `js/highlights.js` | 🟠 | ✅ Выполнено | **v10** |
| BUG-06 | enhancements.js v1.1 | `js/enhancements.js` | 🟠 | ✅ Выполнено | **v10** |
| BUG-07 | `jobTitle` «Редактор-составитель» | `about/index.html` | 🟠 | ✅ Выполнено | v8 |
| SEO-01 | Кнопка поиска в articles navbar | `articles/index.html` | 🟡 | ✅ Выполнено | v8 |
| SEO-02 | OG image для about page | `about/index.html` | 🟡 | ✅ URL обновлён (нужен файл `og-about.webp`) | v9 |
| SEO-03 | `syncThemeColor` из CSS-переменных | `js/site.js` | 🟡 | ✅ Выполнено | v8 |
| SEO-04 | `manifest.json theme_color` синхронизация | `manifest.json` | 🟡 | ✅ Выполнено | v7 |
| RISK-01 | `forceUnlockEmergency` + `no-scroll` | `js/site.js` | 🟡 | ✅ Выполнено | v8 |
| RISK-03 | Безопасный `cleanupOldSDG` | `js/site.js` | 🟡 | ✅ Выполнено | v8 |
| RISK-04 | `search-manifest.json` в SW precache | `sw.js` | 🟢 | ✅ Выполнено | v8 |
| PREM-01 | Search Manifest + Premium Default | `search.js` + `data/` | 🟡 | ✅ Выполнено | v8 |
| PREM-02 | About page premium contact card + h1 | `about/index.html` | 🟡 | ✅ Выполнено | v9 |
| PREM-03 | Article JSON-LD `publisher` → Organization | Все статьи | 🟡 | ✅ Выполнено | v9 |
| PREM-04 | FAQPage JSON-LD (via enhancements v1.1) | auto | 🟢 | ✅ Выполнено | **v10** |
| PREM-05 | Видимые даты обновления в byline | Все статьи | 🟢 | ✅ Выполнено | v9 |

---

## ЧТО СДЕЛАНО В v10 (3 drop-in файла)

### BUG-04: sw-register.js v1.1

**Изменения:**
- **Версионированный URL SW**: `/sw.js?v=${SITE_CONFIG.version}` — надёжный cache-bust при обновлении
- **Toast через DOM-API** (без `innerHTML`) — XSS-безопасность
- **`pagehide` cleanup**: снимает `_reloadHandler` при уходе со страницы
- **Lazy mount guard**: защита от двойного монтирования toast-элемента

### BUG-05: highlights.js v1.1

**Изменения:**
- **`lockScroll('highlights')`/`unlockScroll('highlights')`** — передаём source для отладки (совместимо с PATCH-SITE-1 из v8)
- **Swipe-down для закрытия** на мобильных (touch события на `#gb-hl-panel`)
- **Defensive double-open guard**: `openPanel()` возвращается если панель уже открыта
- **`overscroll-behavior: contain`** на `#gb-hl-list`

### BUG-06 / PREM-04: enhancements.js v1.1

**Изменения:**
- **FAQPage @graph merging**: если на странице уже есть JSON-LD с `@graph`, FAQPage добавляется в него (вместо отдельного тега) — соответствует рекомендациям Google для Rich Results
- **`sanitizeHtml()`**: удаляет `<script>`, `<style>`, `<iframe>`, `<object>` из innerHTML ответа перед записью в JSON-LD
- **rAF throttle для scroll**: `requestAnimationFrame` предотвращает layout-thrashing при быстром скролле
- **ResizeObserver для offset-пересчёта**: offsets пересчитываются при изменении размера `document.body` (вместо только `window.resize`)

---

## ЕДИНСТВЕННОЕ ЧТО ОСТАЛОСЬ

### 📁 Один файл изображения

`images/og-about.webp` — 800×420px, обложка страницы «О редакторе».
URL уже прописан во всех meta-тегах, осталось только загрузить файл.

---

## ИТОГ

**Все 19 задач выполнены. Проект в полностью боеспособном состоянии.**

Осталось только загрузить `images/og-about.webp` (визуальный ресурс, не код).
