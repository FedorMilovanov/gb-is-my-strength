# V4 — контрольный фикс и финальная проверка

Дата: 2026-05-16
Репозиторий: `FedorMilovanov/gb-is-my-strength`

## Что добавлено поверх V3

1. **Дочищены SEO-title**
   - Удалён оставшийся суффикс `| gb` из статей и страниц `nagornaya/*`.
   - `npm run validate:strict` теперь проходит без предупреждений по `<title> ≠ og:title`.

2. **Удалены `title`-атрибуты с `<img>`**
   - Было 18 оставшихся `title` на изображениях.
   - Стало 0.
   - `alt` сохранены.

3. **Закрыт баг с отсутствующими `.woff2`**
   - Скачаны и добавлены локальные self-hosted шрифты из `fonts.css`.
   - Проверено: все пути из `fonts/fonts.css` существуют на диске.
   - Исправлен `scripts/download-fonts.js`: греческий subset берётся из `Noto Sans`, файл сохраняется как `fonts/NotoSansGreek/notosansgreek-400.woff2`.

4. **OG JPEG fallback для страниц, где JPEG уже был в репозитории**
   - `index.html` → `images/og-preview.jpg`
   - `articles/kod-da-vinchi/` → `images/og-kod-da-vinchi.jpg`
   - `articles/krajne-li-isporcheno-serdce/` → `images/og-krajne-isporcheno.jpg`
   - Для fallback прописаны `og:image:width`, `og:image:height`, `og:image:type`, `og:image:alt`.

5. **CSS fallback для последних `color-mix()`**
   - Исправлены последние 2 места без явного fallback.
   - Контрольный аудит: 23 `color-mix()`, 0 без fallback.

6. **IndexNow key больше не хранится в репозитории**
   - Удалён `34dbdd34-965b-4934-a5d4-d18a0a783600.txt`.
   - Убран fallback workflow на чтение ключа из файла.
   - `.gitignore` дополнен шаблоном UUID-like key-файлов.
   - `deploy.yml` генерирует `<INDEXNOW_KEY>.txt` из GitHub Secret только в Pages-артефакте.
   - Важно: после деплоя нужно добавить новый секрет `INDEXNOW_KEY` в GitHub repository secrets.

7. **IndexNow workflow расширен**
   - В URL payload добавлены `index.html`, `about/index.html`, `pastor-series/index.html`.
   - Раньше `paths` запускал workflow для `pastor-series/**`, но URL-сборщик не включал эту страницу в payload.

8. **Cache bust пересчитан**
   - `css/site.css` получил новый hash `?v=9975c898`.
   - HTML обновлены через `scripts/cache-bust.js`.

## Контрольные проверки

Пройдены:

```bash
npm run validate:strict
npm run seo-audit
node --check scripts/download-fonts.js
node --check sw.js
node --check js/site.js
node --check js/search.js
```

Результат:

- `validate.js --strict`: ✅ всё чисто
- `seo-audit.js`: ✅ 0 errors, 0 warnings
- JSON-LD: ✅ валиден на всех 18 публичных HTML
- `feed.xml` / `sitemap.xml`: ✅ well-formed XML
- `manifest.json`: ✅ valid JSON
- Локальные `href/src`: ✅ 0 битых путей
- `javascript:void(0)`: ✅ 0
- `<img title="...">`: ✅ 0
- `color-mix()` без fallback: ✅ 0
- отсутствующие woff2 из `fonts.css`: ✅ 0
- публичный IndexNow key-файл: ✅ удалён

## Намеренно не добавлено

- `twitter:site` / `twitter:creator`: не добавлялись, потому что нужен реальный X/Twitter аккаунт. Добавлять фиктивный handle небезопасно и непрофессионально.
- `og-hero.png` физически оставлен как fallback/исходник, но мета-теги используют лёгкий `og-hero.webp`.
