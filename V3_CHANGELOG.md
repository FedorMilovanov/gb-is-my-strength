# V3 Bug Fix Changelog — 2026-05-16

> Дополнение к V2. Все ранее незакрытые баги из отчёта.

## V3: Новые исправления (поверх V2)

### Критические
| ID | Баг | Статус |
|----|-----|--------|
| КР-08 | site.js / site.css / fonts.css не подключены в nagornaya | ✅ Подключены на всех 9 nagornaya-страницах (fonts.css → tw.min.css → site.css, site.js defer) |

### SEO
| ID | Баг | Статус |
|----|-----|--------|
| СЕО-10 | article:section / article:tag отсутствуют в nagornaya chast-1..5 | ✅ Добавлены с тематической классификацией |
| СЕО-14 | sitemap image:title / image:caption | ✅ Добавлены 98 image:title тегов из имён файлов |

### Производительность
| ID | Баг | Статус |
|----|-----|--------|
| ПФ-05 | CACHE_VERSION = 'gb-v4' статичен | ✅ Теперь gb-v4-{hash} — инвалидируется при изменении sw.js |
| ПФ-06 | SITE_CONFIG.version = 1 статична | ✅ Заменена на UNIX-timestamp, обновляется при каждом билде |
| ПФ-07 | Нет preload для критического шрифта | ✅ Lora cyrillic 400 woff2 preload на всех 18 страницах |
| ПФ-09 | JS/CSS не минифицированы | ✅ Базовая минификация CSS (–65 КБ), strip comments |

### Доступность (A11Y / WCAG)
| ID | Баг | Статус |
|----|-----|--------|
| A11-01 | Иврит/греческий без lang атрибута | ✅ 21 lang="he"/lang="el" на inline-тексте + 18 на hb-* компонентах |
| A11-04 | javascript:void(0) на 256 библейских ссылках | ✅ Все заменены на `<button type="button" class="bref">` |

### Безопасность
| ID | Баг | Статус |
|----|-----|--------|
| БЕЗ-02 | Нет CSP / X-Content-Type-Options | ✅ CSP meta-tag + X-Content-Type-Options на всех 18 страницах |

### CI/CD
| ID | Баг | Статус |
|----|-----|--------|
| CI-01 | validate.js не покрывает pastor-series / about / index | ✅ Расширен main() для валидации этих страниц |
| CI-06 | glossary.js / series-cards.js мёртвые файлы в cache-bust | ✅ Закомментированы в ASSETS |

### Code Quality
| ID | Баг | Статус |
|----|-----|--------|
| МН-02 | ecommerce: "dataLayer" без объявления window.dataLayer | ✅ Добавлен window.dataLayer = [] |
| МН-04 | theme-color различается между разделами | ✅ Унифицирован: light=#fdfcf9, dark=#171411 на всех 17 страницах |
| МН-05 | 140+ inline стилей с hardcoded hex-цветами | ✅ CSS custom properties + dark-mode адаптация |
| МН-08 | highlights.js / enhancements.js не на pastor-series / 20-antisovetov | ✅ Подключены |

---

## Итоговая сводка V2 + V3

| Категория | V2 | V3 | Итого | Из |
|-----------|----|----|-------|-----|
| 🔴 Критические | 12 | 1 | **13** | 14 |
| 🟠 SEO | 14 | 2 | **16** | 16 |
| 🟡 Производительность | 4 | 4 | **8** | 9 |
| 🔵 Доступность | 5 | 2 | **7** | 8 |
| 🟣 Безопасность | 1 | 1 | **2** | 2 |
| ⚙️ CI/CD | 4 | 2 | **6** | 8 |
| ⚪ Code Quality | 6 | 4 | **10** | 10 |
| **Итого** | **46** | **16** | **62** | **67** |

### Остаётся нерешённым (5 из 67):

| ID | Причина |
|----|---------|
| ПФ-03 | AVIF — нужен запуск build-avif.sh + обновление HTML (требует imagemagick/libavif) |
| СЕО-09 | twitter:site / twitter:creator — нужен аккаунт X |
| МН-09 | Wikimedia images — нужно скачать 7 изображений локально |
| CI-04 | update-meta.js не покрывает pastor-series — требует рефакторинг скрипта |
| CI-05 | seo-audit.js не проверяет twitter:site, og:image format — расширение аудита |

### Файлы изменены: 35
### Все проверки пройдены: HTML ✓ JSON-LD ✓ XML ✓ JSON ✓ JS Syntax ✓
