# Верификация аудита GPT — 2026-06-22

**Источники:**
- `gb-is-my-strength-audit-final-2026-06-22.md` (822 lines)
- `GBIS_publication_purity_audit_2026-06-22.md` (727 lines)

**Метод:** каждое утверждение проверено против актуальной кодовой базы (`main`, commit `9281951a`).

---

## Верификационная таблица

| # | Claim GPT | Статус | Что найдено | Действие |
|---|-----------|--------|-------------|----------|
| P0-1 | `readingTime` имеет 7 разных источников | ✅ Подтверждено | MDX=32/39/54, series.json=28/34/47, home=39мін/54мін — РЕАЛЬНЫЙ DRIFT | **FIX NOW**: унифицировать источник → series.json / content collection |
| P0-2 | Главная и каталог — raw legacy с stale данными | ✅ Подтверждено | `dist/index.html` содержит `39 мін`, `54 мін` | **FIX NOW**: исправить мін→мин, обновить числа |
| P0-3 | MDX-файлы структурно повреждены | ✅ Подтверждено | `kod-da-vinchi.mdx`: `.1CNN`, `2016Франциск`, `left=3.5%` layout leak | **FIX NOW**: добавить `mdx-structure-audit`, карантин MDX |
| P0-4 | `content:parity` не в основном gate | ✅ Подтверждено | `validate:static-publication` вызывает `content:parity`, не v2 | **FIX NOW**: переключить на v2 |
| P1-5 | Route taxonomy — отчёт, не guard | ✅ Подтверждено | `native-runtime-taxonomy-audit.js` печатает JSON, нет fail-правил | **DEFER**: добавить после создания publication registry |
| P1-6 | Временные карты индексируются | ✅ Подтверждено | `early-church`: `robots: index, follow`, в sitemap, в llms.txt | **FIX NOW**: noindex + убрать из sitemap/llms |
| P1-7 | llms.txt несогласован с картами | ✅ Частично | llms.txt перечисляет 2 карты как полноценные, но 9 на аудите | **FIX NOW**: перегенерировать llms.txt |
| P1-8 | Baseline закрепляет заглушки | ⚠️ Частично | baseline не содержит отдельного status-поля для temporary | **DEFER**: добавить publicationStatus в registry |
| P1-9 | Home card reading time не из registry | ✅ Подтверждено | Hardcoded в legacy HTML fragment | **FIX NOW**: исправить числа, затем registry |
| P1-10 | update-meta.js legacy-first | ✅ Подтверждено | Работает с `../articles/`, не с MDX | **DEFER**: переписать после registry |
| P1-11 | Pagefind/search text-layer загрязняется | ⚠️ Частично | sr-only pagefind body в shadow routes — 1 предложение, не критично | **DEFER**: улучшить после breakout expansion |
| P1-12 | source-link-audit проверяет только `<a href>` | ✅ Подтверждено | Не проверяет img/src/og:image | **DEFER**: расширить позже |
| P1-13 | SW может удерживать stale HTML | ✅ Подтверждено | CACHE_VERSION отстаёт (20260618 vs sitemap 20260621) | **FIX NOW**: bump cache version |
| P1-14 | Gill spravochnik og:image ≠ sitemap image | ⚠️ Не подтверждено | og:image = `og-gill-five-volumes-shelf.webp`, search-manifest = тоже. Sitemap не содержит `<image:loc>`. | **NO ACTION**: нет реального дрифта в текущем dist |
| P2-15 | BaseLayout runtime extractor — риск дублей | ⚠️ Частично | BaseLayout не используется в production (все 51 route на shadow-wrap) | **NO ACTION**: BaseLayout orphaned, не в production |
| P2-16 | innerHTML/set:html sink audit | ⚠️ Справедливо в целом | Много raw HTML insertion, но источник — собственный legacy, не user input | **DEFER**: low risk, не blocking |
| P2-17 | Footer separator склейка | ⚠️ Не подтверждено | Проверка: `·Оригинал` не найдено в dist | **NO ACTION**: нет бага в production |
| P2-18 | OG/image asset audit | ⚠️ Справедливо в целом | Нет автоматической проверки существования/размера OG images | **DEFER**: nice-to-have |
| WF-19 | Visual parity workflow не запускался | ✅ Подтверждено | `continue-on-error: true`, нет push trigger | **FIX NOW**: убрать continue-on-error, добавить push trigger |
| WF-20 | Dist Dry Run не запускался | ✅ Подтверждено | 0 runs, notify не покрывает | **DEFER**: запустить вручную, добавить в notify |
| WF-21 | check-workflows не требует notify для Dist Dry Run | ✅ Подтверждено | notify покрывает только 4 workflow | **DEFER**: добавить |
| CI-22 | ci:check мутирует cache-bust до validate | ✅ Подтверждено | `cache-bust` первый в цепочке | **FIX NOW**: переставить validate перед cache-bust |
| CI-23 | `[skip ci]` может закреплять stale артефакты | ⚠️ Справедливо | Но `[skip ci]` используется только для auto-meta commits | **NO ACTION**: текущее использование безопасно |

---

## Классификация действий

### FIX NOW — исправить в этом коммите

1. **`мін` → `мин`** на главной + правильные числа readingTime
2. **Nagornaya `~96` → `89`** + `исследоват. находка` → `исследовательская находка`
3. **`Спердген` → `Сперджен`** в Gill III legacy HTML
4. **SeriesArticleLayout `|| 18`** → убрать fallback
5. **content:parity** в validate:static-publication
6. **Temporary maps noindex** + убрать из sitemap/llms
7. **SW cache version bump**
8. **Visual parity workflow**: убрать continue-on-error, добавить push trigger
9. **ci:check**: validate перед cache-bust
10. **mdx-structure-audit** скрипт + карантин kod-da-vinchi.mdx

### DEFER — после создания Publication Registry

11. Publication Registry — единый источник readingTime/cards/search/SEO
12. Home/articles cards → генерация из registry
13. Route taxonomy → blocking guard
14. Baseline publicationStatus
15. update-meta.js → content-registry-first
16. Pagefind quality audit
17. Asset-link audit (img/src/og:image)
18. notify-on-failure для Dist Dry Run

### NO ACTION — не баг или уже не актуально

19. BaseLayout runtime extractor — orphaned, не в production
20. Footer separator склейка — не найдено в dist
21. `[skip ci]` — текущее использование безопасно
22. Gill spravochnik image drift — нет реального дрифта

---

## Ключевой инсайт GPT: parity ≠ purity

Это абсолютно верно. Все наши visual parity тесты доказывают, что «новая версия похожа на legacy», но НЕ доказывают, что «публикуемый документ чист». Мы зафиксировали visual parity на грязных данных (мін, Спердген, stale readingTime).

**Принцип для дальнейшей работы:**
> Новая страница должна быть не только визуально идентична legacy, 
> но и чиста как публикуемый документ: visual + HTML + reader text + 
> Pagefind/search + RSS/sitemap + LLM-readable layer.
