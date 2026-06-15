# REFACTOR_RESEARCH_INDEX_2026.md — индекс исследований по будущему рефакторингу

Дата: 2026-06-12

Этот файл разводит два направления, чтобы не смешивать архитектуру сайта и архитектуру карт.

## 1. Общий движок сайта / Astro / SEO / контент

Основной документ:

- `docs/refactor-2026/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`

Темы:

- почему Astro + React islands;
- почему не React SPA;
- SEO-first архитектура;
- MD/MDX content collections;
- Zod-схемы для статей;
- единые layouts/components;
- sitemap/RSS/search;
- безопасная phased migration;
- CI-проверки;
- сохранение URL/canonical/OG/JSON-LD.

## 2. Карты / атлас / Leaflet / MapLibre / custom SVG

Основной документ:

- `docs/refactor-2026/MAPS_ENGINE_RESEARCH_2026.md`

Связанный существующий документ:

- `docs/MAPS-ARCHITECTURE.md`

Темы:

- почему custom SVG остаётся основным;
- зачем Leaflet/MapLibre могут понадобиться позже;
- route.json;
- эпохи и топонимы;
- certainty/sourceIds;
- GeoJSON export;
- SEO transcript для карт;
- доступность карт;
- фазы развития карт.

## 3. Предыдущий объединённый черновик

- `docs/refactor-2026/MAPS_AND_REACT_REFACTOR_ROADMAP_2026.md`

Статус: полезный общий черновик, но теперь направления разделены на два отдельных исследования выше.

## 4. Дополнительные документы по Astro/refactor

- `docs/refactor-2026/ASTRO_MIGRATION_PHASE_PLAN_2026.md` — пошаговый план миграции.
- `docs/refactor-2026/CONTENT_MODEL_AND_AUTHORING_2026.md` — модель контента, frontmatter, authoring workflow.
- `docs/refactor-2026/SEO_TECHNICAL_CONTRACT_2026.md` — SEO-контракт: URL, canonical, JSON-LD, sitemap, RSS.
- `docs/refactor-2026/ASTRO_STACK_DECISION_RECORD_2026.md` — ADR по выбору Astro + React islands.
- `docs/refactor-2026/QUALITY_GATES_AND_TESTING_2026.md` — CI, Playwright, axe, visual regression, performance budgets.
- `docs/refactor-2026/DEPLOYMENT_SECURITY_ENV_2026.md` — деплой, environment variables, headers, CSP, verification files.
- `docs/refactor-2026/HTML_TO_MDX_MIGRATION_RESEARCH_2026.md` — стратегия переноса legacy HTML в MDX.
- `docs/refactor-2026/ASTRO_IMPLEMENTATION_BLUEPRINT_2026.md` — практический blueprint первого Astro-прототипа.
- `docs/refactor-2026/EDITORIAL_AUTHORITY_EEAT_2026.md` — авторитет, E-E-A-T, авторы, источники, редакционная методология.
- `docs/refactor-2026/SEARCH_AND_DISCOVERY_ARCHITECTURE_2026.md` — поиск, Pagefind, command palette, links graph, related.
- `docs/refactor-2026/CMS_OPTIONS_DECISION_2026.md` — Git+MDX vs Keystatic/Tina/Sanity/Storyblok.
- `docs/refactor-2026/URL_CONTRACT_2026.md` — публичный URL/SEO-контракт перед миграцией.
- `docs/refactor-2026/STRUCTURED_DATA_GRAPH_2026.md` — единый JSON-LD graph, @id, Article/ProfilePage/LearningResource/Dataset.
- `docs/refactor-2026/IMAGE_PIPELINE_2026.md` — изображения, Astro assets, OG, alt, image SEO.
- `docs/refactor-2026/INTERNAL_LINKING_STRATEGY_2026.md` — topic clusters, related, links graph, crawlable links.
- `docs/refactor-2026/PERFORMANCE_BUDGETS_2026.md` — Core Web Vitals, JS budgets, Astro hydration rules.
- `docs/refactor-2026/ACCESSIBILITY_STANDARD_2026.md` — WCAG 2.2 AA, keyboard, dialogs, maps accessibility.
- `docs/refactor-2026/TYPOGRAPHY_DESIGN_SYSTEM_2026.md` — типографика, дизайн-токены, MDX components.
- `docs/refactor-2026/ASTRO_PROTOTYPE_TASKLIST.md` — конкретный первый PR tasklist.
- `docs/refactor-2026/MAPS_DATA_SCHEMA_2026.md` — конкретная схема route.json для карт.
- `docs/refactor-2026/ASTRO_COMPONENT_INVENTORY_2026.md` — инвентарь Astro/React компонентов и props.
- `docs/refactor-2026/LEGACY_TO_ASTRO_PAGE_MAPPING.md` — mapping legacy HTML → будущие Astro routes/content.
- `docs/refactor-2026/SECURITY_CSP_IMPLEMENTATION_PLAN.md` — практический CSP hardening plan.
- `docs/refactor-2026/MAPS_AVRAAM_EXTRACTION_PLAN.md` — план извлечения данных карты Авраама.
- `docs/refactor-2026/ARTICLE_MDX_FRONTMATTER_SCHEMA_FINAL.md` — финализируемая схема frontmatter статей.
- `docs/refactor-2026/ASTRO_SEO_COMPONENT_SPEC.md` — спецификация Seo.astro/JSON-LD helpers.
- `docs/refactor-2026/MAPS_ROUTE_DRAFT_EXTRACTION_SCRIPT_PLAN.md` — план скрипта извлечения данных карты Авраама.
- `docs/refactor-2026/RESEARCH_SOURCE_AUDIT_30_PLUS_2026.md` — 40 источников, выводы и корректировки решений после deep pass.
- `docs/refactor-2026/RESEARCH_SOURCE_AUDIT_80_PLUS_2026.md` — второй deep pass, ещё 25+ источников/уточнений.
- `docs/refactor-2026/ASTRO_CONTENT_LOADER_STRATEGY_2026.md` — loaders: glob/file/reference/custom/live.
- `docs/refactor-2026/PAGEFIND_RUSSIAN_SEARCH_NOTES_2026.md` — Pagefind, русский поиск, фильтры, query benchmark.
- `docs/refactor-2026/YANDEX_WEBMASTER_SEO_CONTRACT_2026.md` — Яндекс.Вебмастер, sitemap, indexing statuses.
- `docs/refactor-2026/ARIA_WIDGET_PATTERNS_2026.md` — ARIA patterns для dialogs/tabs/combobox/SVG maps.
- `docs/refactor-2026/ASTRO_IMAGE_CURRENT_NOTES_2026.md` — уточнение current Astro image API layouts.
- `docs/refactor-2026/FREE_PAID_SERVICES_COST_STRATEGY_2026.md` — что бесплатно/что станет платным и когда платить.
- `docs/refactor-2026/HOSTING_DEPLOYMENT_OPTIONS_2026.md` — GitHub Pages/Cloudflare/Netlify/Vercel/VPS стратегия.
- `docs/refactor-2026/RUSSIAN_SEARCH_ALTERNATIVES_2026.md` — бесплатные/платные варианты русского поиска.
- `docs/refactor-2026/BIBLIOGRAPHY_SOURCE_MODEL_2026.md` — модель источников/библиографии.
- `docs/refactor-2026/RUSSIA_ACCESS_HOSTING_CONSTRAINTS_2026.md` — ограничения доступа/оплаты Cloudflare из России, portable static strategy.
- `docs/refactor-2026/GITHUB_PAGES_RETENTION_PLAN_2026.md` — план оставаться на GitHub Pages/current static hosting.
- `docs/refactor-2026/RESEARCH_SOURCE_AUDIT_120_PLUS_2026.md` — третий source audit: хостинг, Россия, лимиты, стоимость.
- `docs/refactor-2026/TECHNICAL_MIGRATION_RUNBOOK_2026.md` — главный безопасный runbook миграции по фазам/gates.
- `docs/refactor-2026/MIGRATION_RISK_LEVELS_AND_GATES_2026.md` — уровни риска 0–6 и checklists.
- `docs/refactor-2026/GITHUB_PAGES_DEPLOY_ROLLBACK_RUNBOOK_2026.md` — деплой и rollback на GitHub Pages.
- `docs/refactor-2026/ASTRO_SCAFFOLDING_IMPLEMENTATION_PLAN.md` — точный план первого Astro scaffold PR.
- `docs/refactor-2026/TEST_COVERAGE_GAP_ANALYSIS_2026.md` — недостающие тесты, safety gaps, token hygiene.
- `docs/refactor-2026/AGENT_HANDOFF_NO_REFACTOR_2026.md` — handoff для следующих агентов: пока без рефакторинга, только контент/безопасные проверки.
- `docs/refactor-2026/CURRENT_REPO_ADAPTATION_2026.md` — адаптация плана под актуальный main: новый отдел konfessii, embedded 3D app, no-refactor rules.
- `docs/refactor-2026/RESEARCH_SOURCE_AUDIT_POST_PUSH_2026.md` — post-push deep pass: GitHub Pages/Astro deploy, Yandex, Actions security, Playwright, SW, SVG/iframe a11y.
- `docs/refactor-2026/DIST_DEPLOY_SWITCH_RUNBOOK_2026-06-15.md` — практический runbook будущего root→dist deploy switch, SW cache bump, Pagefind-on-dist, IndexNow key и rollback.
- `docs/refactor-2026/DIST_DRY_RUN_WORKFLOW_STATUS_2026-06-15.md` — manual-only GitHub Actions dry-run для production-like `dist` artifact без deploy.
- `docs/refactor-2026/DIST_OWNERSHIP_AUDIT_STATUS_2026-06-15.md` — ownership guard для `migration/page-ownership.json` и production-like `dist`: Astro routes, build-only routes, built-app copy, implicit legacy baseline.

## 5. Черновой baseline

- `reports/url-contract-draft.json`
- `reports/url-contract-draft.md`

Исторически это был черновик baseline. Текущий machine baseline для gates теперь:

- `data/public-content-baseline.json` — 42 public indexable pages;
- `scripts/extract-url-contract.js` / `scripts/compare-url-contract.js` — root/dist URL contract extraction and compare;
- `migration/page-ownership.json` + `scripts/check-page-ownership.js` — ownership guard для Astro/legacy strangler.

## 6. Рекомендуемый следующий шаг

1. Не переключать production deploy без отдельного explicit deploy-switch решения владельца.
2. Перед таким решением вручную запустить GitHub Actions **Dist Strangler Dry Run** и принять visual review `/about/`.
3. Если refactor продолжается без deploy switch — следующий безопасный технический шаг: готовить first-article MDX preview/gates локально, не трогая homepage, карты и production `deploy.yml`.
4. Для карт продолжать только data/schema work без подключения к production UI, если нет отдельного решения.
