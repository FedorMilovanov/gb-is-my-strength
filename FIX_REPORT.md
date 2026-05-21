# gb-is-my-strength — отчёт об исправлениях

Патч пересобран поверх текущего `origin/main` после AUDIT v9/автокоммитов. Цель — не перезаписать свежие правки, а наложить только проверенные исправления.

## Исправлено

### Runtime / конфигурация
- Исправлена перезапись `window.SITE_CONFIG` в двух статьях с quiz-конфигом: теперь конфиг мержится, а не заменяет базовые `version/site/page/features`.

### Service Worker
- PNG больше не маршрутизируются как static assets.
- `.json` добавлен в static routing для `search-manifest.json`.
- Добавлен `trimCache()`; LRU удаляет все лишние записи.
- `cache.put()` включён в promise-chain.
- `staleWhileRevalidate()` использует `event.waitUntil()` для фонового обновления.
- В precache добавлены `js/glossary.js` и `js/series-cards.js`.

### CI / GitHub Actions
- `deploy.yml` ограничивает push-триггер asset/infrastructure файлами и разрешает deploy job для `push`, `workflow_dispatch`, успешного `workflow_run`.
- `indexnow.yml` получил `workflow_dispatch`.
- IndexNow submit сделан non-blocking через `continue-on-error: true`.

### update-meta / sitemap / JSON-LD dates
- `update-meta.js` синхронизирует JSON-LD `datePublished/dateModified` с meta-тегами.
- `update-meta.js` обновляет sitemap для `nagornaya/*`.
- Текущие JSON-LD даты синхронизированы с meta.
- `nagornaya/istochniki/` и `nagornaya/nakhodki/` удалены из sitemap как `noindex`-страницы.
- `validate.js` и `audit-pro.js` больше не требуют `noindex`-страницы в sitemap.

### CSS/UI
- Исправлен reduced-motion блок в `home.css`.
- `.h-mobile-backdrop.open` показывает backdrop на мобильных.
- `pointer-events: all` заменён на `auto`.
- `.cp-backdrop` поднят до modal z-index.
- `ehrman-box` заменён на фактический `ehrman-block`.
- Добавлен no-JS fallback для контентных блоков с initial opacity.

### JS
- `glossary.js` использует Unicode-aware границы вместо ASCII `\b`.
- Динамическая загрузка extra scripts получает `?v=SITE_CONFIG.version`.
- Font-size down button: `a`, up button: `A`.
- Дата статьи форматируется в `Europe/Moscow`.
- `series-cards.js` экранирует данные из JSON.
- `highlights.js`: SVG success не выводится текстом, download link добавляется в DOM, swipe touchmove `passive:false`.
- `nagornaya-mobile-toc.js`: единый encoded hash для href/history.
- `sw-register.js`: offline-toast показывается только при активном SW и наличии страницы в Cache Storage.

### Structured data / SEO
- В `about/index.html` добавлена `Person` entity `https://gospod-bog.ru/about/#person`.
- `ProfilePage` и `BreadcrumbList` на about получили `@id`.
- Локальные статьи получили полноценный `author` object.
- `nagornaya/chast-1..5` теперь указывают Фёдора Милованова как автора JSON-LD.
- Для переводной статьи обновлён `author.url` Abner Chou и добавлен `translationOfWork`.
- `search-manifest.json` обновлён: `generatedAt`, `modifiedTime`.
- `sitemap.xml` image entries получили русские `image:title` и `image:caption`.
- CSP усилен `object-src 'none'` и `base-uri 'self'`.

### Cache-bust
- `cache-bust.js` теперь учитывает `glossary.js` и `series-cards.js`.
- Выполнен `node scripts/cache-bust.js`.

## Проверки

```bash
for f in js/*.js sw.js scripts/*.js; do node --check "$f" || exit 1; done
npm run validate -- --strict
node scripts/audit-pro.js
node scripts/seo-audit.js
git diff --check
```

Все проверки проходят: 0 errors / 0 warnings.
