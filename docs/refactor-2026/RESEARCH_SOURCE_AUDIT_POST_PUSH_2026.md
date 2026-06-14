# RESEARCH_SOURCE_AUDIT_POST_PUSH_2026.md — дополнительный deep pass после актуализации main

Дата: 2026-06-14  
База: актуальный `origin/main` после появления `/konfessii/` и углубления `/karty/avraam/`.

---

## 1. Что перепроверялось

Цель этого прохода — не предлагать немедленный рефакторинг, а уточнить, какие технические решения безопасны для текущего репозитория:

```text
GitHub Pages + Astro future deploy
SEO migration safety
GitHub Actions hardening
Pagefind/search alternatives
Yandex indexing
Service worker/stale cache risk
Accessibility/Playwright testing
SVG/canvas/WebGL accessibility
```

---

## 2. GitHub Pages + Astro deploy

### 1. Astro official GitHub Pages deploy

URL: https://docs.astro.build/en/guides/deploy/github/

Выводы:

- Astro поддерживает официальный `withastro/action` для GitHub Pages.
- Для custom domain нужно `site: 'https://example.com'` и **не ставить `base`**.
- Deploy workflow использует `pages: write` и `id-token: write`.
- Современные версии docs показывают `actions/checkout@v6`, `withastro/action@v6`, `actions/deploy-pages@v5`, но текущий проект уже имеет свой зрелый deploy pipeline; менять его сейчас нельзя.

Влияние:

```text
Когда-нибудь Astro deploy на GitHub Pages возможен, но только после build-time strangler и dist parity.
```

### 2. Astro deploy docs mirror / older versions

URLs:

- https://v4.docs.astro.build/en/guides/deploy/github/
- https://docs.w3cub.com/astro/guides/deploy/github/index

Вывод:

- Важное правило стабильно во всех версиях: custom domain → `site` set, no `base`.

Влияние:

```text
Для gospod-bog.ru Astro config должен быть site='https://gospod-bog.ru', без base.
```

### 3. GitHub Pages custom domain / HTTPS

URLs:

- https://github.com/github/docs/blob/main/content/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site.md
- https://docs.bswen.com/blog/2026-04-16-custom-domain-github-pages/

Выводы:

- CNAME для subdomain должен указывать на `<user>.github.io`, без имени repo.
- Apex domain требует A records на GitHub Pages IPs.
- HTTPS provisioning может задерживаться; CAA/DNS конфликты могут мешать.
- В текущем проекте `CNAME` уже есть и проверяется аудитом.

Влияние:

```text
Не трогать CNAME/DNS при Astro migration.
```

### 4. GitHub Pages limits

URL: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

Выводы:

- published site max 1GB;
- soft bandwidth 100GB/month;
- deployment timeout 10 min;
- soft 10 builds/hour unless custom Actions workflow;
- static only, not for SaaS/ecommerce/sensitive transactions.

Влияние:

```text
Продолжаем GitHub Pages; следим за dist size, media size, build time.
```

---

## 3. SEO/site migration sources

### 5. Google site moves

URL: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

Выводы:

- Mapping old→new URLs.
- New URLs should have self-referencing canonical.
- Internal links and sitemap must be updated.
- Server-side 301/308 redirects recommended if URLs change.

Влияние:

```text
Лучший Astro migration для нас — no URL changes.
```

### 6. SEO migration checklists 2026

URLs:

- https://www.seoraf.com/seo-migration-checklist/
- https://www.o8.agency/blog/seo/site-migration-checklist-seo-tasks-prioritized
- https://www.influize.com/blog/seo-migration-strategy
- https://rightblogger.com/blog/blog-migration-seo

Выводы:

- Pre-migration inventory — главный фактор успеха.
- Нужно сохранять titles, descriptions, canonicals, internal links, content signals.
- Запускать миграцию лучше поэтапно, не совмещать redesign/hosting/URL/CMS.
- Post-launch monitoring 2–4 недели минимум.

Влияние:

```text
Наш build-time strangler + URL contract — правильная модель.
```

### 7. Sitemap SEO guide

URL: https://www.w3era.com/blog/seo/xml-sitemap-seo-guide/

Выводы:

- Sitemap should include only canonical, indexable, 200-status URLs.
- No redirects/noindex/duplicates.
- Update sitemap after substantial content changes.

Влияние:

```text
При Astro dist parity обязательно проверять sitemap-only canonical URLs.
```

---

## 4. Yandex sources

### 8. Yandex changing site structure/design

URL: https://yandex.com/support/webmaster/en/recommendations/changing-site-structure.html

Выводы:

- If design/layout changes but URLs stay, content must be available for indexing in HTML immediately after request.
- JavaScript-generated content may not be indexed reliably.
- Check noindex/canonical/robots.
- Add new pages to sitemap and submit/reindex.

Влияние:

```text
Astro HTML-first approach especially important for Yandex.
```

### 9. Yandex meta tags

URL: https://yandex.com/support/webmaster/en/controlling-robot/metatags

Выводы:

- Yandex respects robots meta/noindex directives.
- Multiple directives possible.

Влияние:

```text
No accidental noindex in migration.
```

### 10. Yandex searchable pages statuses

URL: https://yandex.com/support/webmaster/en/service/searchable.html

Выводы:

- Important statuses: DUPLICATE, META_NO_INDEX, NOT_CANONICAL, ROBOTS_HOST_ERROR, ROBOTS_URL_ERROR, REDIRECT_NOTSEARCHABLE, LOW_DEMAND.

Влияние:

```text
Post-pilot Yandex Webmaster check should include these statuses.
```

---

## 5. Search/Pagefind sources

### 11. Pagefind vs Algolia/Lunr/Fuse for static sites

URLs:

- https://dev.to/morinaga/static-site-search-for-astro-in-2026-why-i-picked-pagefind-over-algolia-and-lunr-pg1
- https://staticsignal.io/posts/static-site-search-with-pagefind/
- https://ahmedrajawrites.medium.com/the-easiest-ways-to-add-search-to-your-static-html-website-30782d09ca04

Выводы:

- Pagefind — free/static/no backend.
- Algolia — stronger search/analytics/typo tolerance but SaaS/paid risk.
- Fuse/MiniSearch — useful for small manifests/command palette.

Влияние:

```text
Command palette remains manifest-based; Pagefind is optional full-text layer.
```

### 12. Pagefind limitations

Из практических обзоров:

```text
Pagefind does not log queries by default.
Typo tolerance weaker than Algolia.
Russian morphology must be benchmarked.
```

Влияние:

```text
Do not replace current search blindly.
```

---

## 6. GitHub Actions / security sources

### 13. GitHub Actions security hardening 2026

URLs:

- https://www.buildmvpfast.com/blog/github-actions-supply-chain-security-hardening-guide-2026
- https://securitylabs.datadoghq.com/articles/case-for-github-actions-security/
- https://www.stingrai.io/blog/github-actions-security-checklist

Выводы:

- Pinning actions by SHA is strongest immutable mode, but harder to maintain.
- Minimize `GITHUB_TOKEN` permissions.
- Avoid `pull_request_target` unless absolutely necessary.
- Use OIDC instead of long-lived cloud secrets where relevant.
- Tools: zizmor, StepSecurity harden-runner, Gitleaks/TruffleHog.

Влияние:

```text
Current workflows already have explicit permissions and workflow policy checks. Next hardening step could be zizmor/secret scan, but not urgent.
```

### 14. zizmor / unpinned uses

URLs:

- https://nesbitt.io/2026/05/25/github-actions-security-in-python-packages.html
- https://github.com/stac-utils/xstac/issues/44

Вывод:

- `uses: action@v4` is tag-pinned, not SHA-pinned.
- zizmor detects unpinned uses and unsafe workflow patterns.

Влияние:

```text
Potential future workflow hardening: scheduled zizmor audit, warning-only first.
```

---

## 7. Testing / Playwright / accessibility sources

### 15. Playwright accessibility testing

URLs:

- https://rishikc.com/articles/accessibility-testing-ci-integration/
- https://qaskills.sh/blog/playwright-accessibility-testing-axe-complete-guide
- https://dev.to/vitalyskadorva/accessible-web-testing-with-playwright-and-axe-core-2kg1
- https://www.davidmello.com/software-testing/test-automation/playwright-accessibility-testing-axe-lighthouse-limitations

Выводы:

- axe catches only part of accessibility defects.
- Playwright keyboard tests are needed for focus/menus/modals/palette/maps.
- Automated scans miss ambiguous link text, bad labels, focus behavior.

Влияние:

```text
For future React islands: keyboard tests are required, not optional.
```

### 16. Visual regression testing

URLs:

- https://oneuptime.com/blog/post/2026-01-24-visual-regression-testing/view
- https://oneuptime.com/blog/post/2026-01-27-playwright-visual-testing/view
- https://bug0.com/knowledge-base/visual-regression-testing-tools

Выводы:

- Same OS/browser for baselines.
- Disable animations.
- Mask dynamic content.
- Baseline updates require human review.

Влияние:

```text
Before batch migration, add Playwright screenshots for key templates.
```

---

## 8. Lighthouse / performance sources

### 17. Lighthouse CI budgets

URLs:

- https://dev.to/apogeewatcher/how-to-set-up-performance-budgets-in-cicd-pipelines-lj
- https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
- https://unlighthouse.dev/integrations/ci

Выводы:

- Use local static server for static site candidate build.
- Run multiple times for stability.
- Use warning-only first for noisy metrics.
- Test representative templates, not only homepage.

Влияние:

```text
Performance CI should start as advisory, then tighten.
```

---

## 9. Service worker sources

### 18. Workbox / stale cache guidance

URLs:

- https://developer.chrome.com/docs/workbox/service-worker-deployment
- https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/docs/workbox/improving-development-experience/index.md
- https://oneuptime.com/blog/post/2026-01-25-implement-service-worker-caching/view

Выводы:

- Unversioned assets with cache-first can become stale.
- HTML should generally be network-first or not aggressively cached.
- Versioned/hash assets are safer.
- Testing SW requires clean profile/incognito or cache inspection.

Влияние:

```text
Before Astro dist deploy, decide SW strategy; do not let old sw.js cache obsolete root HTML.
```

---

## 10. SVG / map / iframe accessibility sources

### 19. SVG accessibility

URLs:

- https://www.w3.org/TR/SVG/access.html
- https://wpdean.com/accessible-svg-files/
- https://www.svgai.org/blog/svg-accessibility-inclusive-design

Выводы:

- Informative SVG needs title/desc/role.
- Decorative SVG should be aria-hidden/focusable=false.
- Interactive SVG elements need tabindex/keyboard/focus styles.
- Native button/link wrappers are safer.

Влияние:

```text
For maps: SVG visual layer + HTML accessible list is best.
```

### 20. iframe accessibility

URL: https://getwcag.com/en/accessibility-guide

Вывод:

- Iframes with focusable content must be keyboard reachable.
- Scrollable regions need keyboard focus.

Влияние:

```text
/konfessii/russkij-baptizm/ iframe wrapper must preserve keyboard access into _app.
```

---

## 11. Final updated recommendations

```text
1. Do not refactor now while content work is active.
2. Keep GitHub Pages/current deploy.
3. Preserve /konfessii/_app as built asset.
4. Before any Astro work: add extractor --root/--out.
5. Before dist deploy: add dist parity + ownership + copy safety.
6. Before React islands: add keyboard/axe tests.
7. Before Pagefind production: run Russian query benchmark.
8. Before service worker changes: define stale-cache migration strategy.
9. Before workflow hardening: add warning-only zizmor/secret scan, do not break deploy.
```

---

## 12. Immediate safe next step

No refactor. If adding one safety improvement later:

```text
scripts/extract-url-contract.js --root/--out
```

This is safe, test-only, and unlocks professional dist comparison.
