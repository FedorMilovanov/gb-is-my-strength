# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Обязательно к прочтению ДО любой правки кода**, если ты — ИИ-агент
> (Cursor / Arena Agent / Copilot Workspace / Kilo / любой).
>
> Этот файл — **договор** между владельцем (Фёдор Милованов) и любым агентом.
> Нарушение = регресс, который видят сотни читателей сайта.
> Если правило кажется глупым — **спроси, ПОЧЕМУ оно появилось**.

| Версия документа | Дата | Состояние |
|---|---|---|
| **AGENTS-r200** | 2026-06-15 | **Public shadow ownership reached 42/42 baseline pages (100%) in `dist`; production deploy still legacy root.** Added cleanup/hardening batch over raw coverage growth: shadow home page moved closer to legacy mobile IA, `/konfessii/russkij-baptizm/` wrapper became Astro-owned, `/karty/ishod/` became Astro prelaunch route, `/map/` became Astro shadow wrapper, and all five `nagornaya/chast-*` pages were promoted via legacy-faithful Astro shadow wrappers. New guards: `astro:audit:home`, `astro:audit:ishod`, `astro:audit:baptisty-series`, `astro:audit:legacy-wrappers`; `dist-publication-audit` and Pagefind now require all 42 public shadow routes. Итог: `audit-pro` 154 passed · 0 errors, `validate:static-publication` ✅, `contract:compare:dist` 42/42 ✅, production-like dist publication + Pagefind source pages 42/42 ✅. Progress: public shadow ownership 100%, build-time strangler readiness ~98%, safety/gates ~96%, production migration still 0–3%, deploy.yml unchanged until explicit owner decision. |
| **AGENTS-r199** | 2026-06-15 | **Nagornaya reference pages shadow-owned: `/nagornaya/istochniki/` and `/nagornaya/nakhodki/`.** Added Astro routes for sources bibliography and verified findings pages; ownership manifest promoted both to `astro` / `shadow-pilot`. Dist publication audit, dry-run workflow and workflow policy now require `dist/nagornaya/istochniki/index.html` and `dist/nagornaya/nakhodki/index.html` and verify Astro-owned/indexable/public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 21/42 (50%), implicit legacy routes 21. Progress: overall Astro/MDX ~59%, safety/gates ~93%, build-time strangler readiness ~92%, public shadow ownership at halfway point; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r198** | 2026-06-15 | **Next landing batch shadow-owned: `/karty/`, `/konfessii/`, `/nagornaya/seriya/` added after `/nagornaya/`.** Added Astro routes for biblical maps, confessions/denominations, and Nagornaya series index; ownership manifest promoted all to `astro` / `shadow-pilot`. Dist publication audit, dry-run workflow and workflow policy now require these landing files and verify Astro-owned/indexable/public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 19/42 (~45%), implicit legacy routes 23. Progress: overall Astro/MDX ~57%, safety/gates ~92%, build-time strangler readiness ~91%, public shadow ownership expanding; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r197** | 2026-06-15 | **`/nagornaya/` landing получил Astro shadow ownership.** Added `src/pages/nagornaya/index.astro`; ownership manifest promoted `/nagornaya/` to `astro` / `shadow-pilot`. Page preserves legacy title/H1/description/canonical/OG contract, CollectionPage/BreadcrumbList JSON-LD, data-pagefind-body and links to 5 legacy Nagornaya parts. Dist publication audit, dry-run workflow and workflow policy now require `dist/nagornaya/index.html` and verify `/nagornaya/` as Astro-owned, indexable, public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 16/42 (~38%), implicit legacy routes 26. Progress: overall Astro/MDX ~55%, safety/gates ~92%, build-time strangler readiness ~90%, public shadow ownership expanding; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r196** | 2026-06-15 | **`/biografii/` landing получил Astro shadow ownership.** Added `src/pages/biografii/index.astro`; ownership manifest promoted `/biografii/` to `astro` / `shadow-pilot`. Page preserves legacy title/H1/description/canonical/OG contract, CollectionPage/BreadcrumbList JSON-LD, data-pagefind-body, era sections and Gill links. Dist publication audit, dry-run workflow and workflow policy now require `dist/biografii/index.html` and verify `/biografii/` as Astro-owned, indexable, public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 15/42 (~36%), implicit legacy routes 27. Progress: overall Astro/MDX ~53%, safety/gates ~92%, build-time strangler readiness ~90%, MDX/article pipeline ~96%, landing/catalog shadow expanding; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r195** | 2026-06-15 | **Series landing shadow pass: `/hard-texts/` and `/pastor-series/` added as Astro shadow routes.** Added `src/pages/hard-texts/index.astro` and `src/pages/pastor-series/index.astro`; ownership manifest promoted both to `astro` / `shadow-pilot`. Both pages preserve legacy title/H1/description/canonical/OG contracts, CollectionPage/BreadcrumbList JSON-LD and data-pagefind-body, linking to already migrated article routes. Dist publication audit, dry-run workflow and workflow policy now require `dist/hard-texts/index.html` and `dist/pastor-series/index.html` and verify both are Astro-owned, indexable, public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 14/42 (~33%), implicit legacy routes 28. Progress: overall Astro/MDX ~52%, safety/gates ~92%, build-time strangler readiness ~89%, MDX/article pipeline ~96%, series landing shadow ~30%, production migration still 0–3%; deploy.yml unchanged. |
| **AGENTS-r194** | 2026-06-15 | **`/articles/` catalog получил Astro shadow ownership после завершения 10/10 article pages.** Добавлен `src/pages/articles/index.astro` с CollectionPage/BreadcrumbList JSON-LD, data-pagefind-body, legacy title/H1/description/canonical/OG contract и карточками всех ключевых материалов. `migration/page-ownership.json` перевёл `/articles/` в `astro` / `shadow-pilot`; `dist-publication-audit`, dry-run workflow и workflow policy теперь требуют `dist/articles/index.html` и проверяют, что `/articles/` Astro-owned, indexable и с public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/`, `/articles/` + 10 articles (12/42 ≈29%), implicit legacy baseline routes 30. Progress: overall Astro/MDX ~50%, safety/gates ~92%, build-time strangler readiness ~88%, MDX/article pipeline ~96%, article catalog shadow 100%, production migration still 0–3%; deploy.yml unchanged. |
| **AGENTS-r193** | 2026-06-15 | **Article shadow migration complete: 10/10 article pages now have public MDX/Astro shadow routes in `dist`.** Финальный article route `/articles/20-antisovetov-pastoru/` добавлен с MDX entry и Astro route; ownership manifest перевёл URL в `astro` / `shadow-pilot`. Multi-article strict audit now checks all 10 articles; final article parity: 13590/13563 words (1.00), H2 17/17, exact SEO/article meta/Article JSON-LD/BreadcrumbList. Dist publication audit, dry-run workflow and workflow policy require all 10 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 10 articles (11/42 ≈26%), implicit legacy baseline routes 31. Progress: overall Astro/MDX ~48%, safety/gates ~91%, build-time strangler readiness ~87%, MDX/article pipeline ~95%, articles shadow-owned 10/10 (100%), production migration still 0–3%; deploy.yml unchanged. |
| **AGENTS-r192** | 2026-06-15 | **Article migration near-complete: добавлены 8-й и 9-й public MDX shadow routes — `krajne-li-isporcheno-serdce` и `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki`.** Добавлены MDX entries и Astro routes; ownership manifest перевёл оба URL в `astro` / `shadow-pilot`. `ArticleLayout.astro` получил author display mapping для `abner-chou`, чтобы article meta/JSON-LD Абнера Чау зеркалили legacy. Multi-article strict audit теперь проверяет 9 article routes; новые parity: Jeremiah 17 8005/8250 words (0.97), H2 19/19; Hermeneutics 9887/10056 words (0.98), H2 7/7. Dist publication audit, dry-run workflow и workflow policy require all 9 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 9 articles, implicit legacy baseline routes 32. Progress: overall Astro/MDX ~45%, safety/gates ~90%, build-time strangler readiness ~85%, MDX/article pipeline ~87%, articles shadow-owned 9/10 (90%), public shadow ownership 10/42 pages (~24%); production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r191** | 2026-06-15 | **Gill article batch completed: 6-й и 7-й public MDX shadow routes — `dzhon-gill-chast-2-uchenyi` и `dzhon-gill-chast-3-nasledie`.** Добавлены MDX entries и Astro routes для `/articles/dzhon-gill-chast-2-uchenyi/` и `/articles/dzhon-gill-chast-3-nasledie/`; ownership manifest перевёл оба URL в `astro` / `shadow-pilot`. Multi-article strict audit теперь проверяет 7 article routes; новые parity: Gill часть II 6789/6837 words (0.99), H2 5/5; Gill часть III 9408/9469 words (0.99), H2 4/4. Dist publication audit, dry-run workflow и workflow policy require all 7 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 7 articles, implicit legacy baseline routes 34. Progress: overall Astro/MDX ~40%, safety/gates ~89%, build-time strangler readiness ~82%, MDX/article pipeline ~68%, articles shadow-owned 7/10 (70%), public shadow ownership 8/42 pages (~19%); production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r190** | 2026-06-15 | **Большой article pass: добавлены 4-й и 5-й public MDX shadow routes — `kod-da-vinchi` и `dzhon-gill-chast-1-chelovek`.** Добавлены MDX entries и Astro routes для `/articles/kod-da-vinchi/` и `/articles/dzhon-gill-chast-1-chelovek/`; ownership manifest перевёл оба URL в `astro` / `shadow-pilot`. Multi-article strict audit теперь проверяет 5 article routes: Gill справочник (0.95), Gill исторический контекст (0.99), Romans 7 (0.93), Kod da Vinci (1.01), Gill часть I (0.99), все с exact title/description/H1/OG/article meta/Article JSON-LD/BreadcrumbList and H2 parity. Dist publication audit, dry-run workflow and workflow policy require all 5 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 5 articles, implicit legacy baseline routes 36. Progress: overall Astro/MDX ~35%, safety/gates ~88%, build-time strangler readiness ~80%, MDX/article pipeline ~49%, articles shadow-owned 5/10 (50%), public shadow ownership 6/42 pages (~14%); production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r189** | 2026-06-15 | **Третий article MDX shadow route добавлен: `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`.** Добавлены `src/content/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy.mdx` и public shadow route `src/pages/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.astro`; ownership manifest перевёл `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` в `astro` / `shadow-pilot`. Multi-article strict audit теперь проверяет 3 public shadow articles: Gill справочник (0.95 ratio, H2 12/12), Gill исторический контекст (0.99 ratio, H2 13/13), Romans 7 (0.93 ratio, H2 14/14). Dist publication audit, dry-run workflow and workflow policy require all 3 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 3 articles, implicit legacy baseline routes 38; production deploy remains root legacy. Progress: overall Astro/MDX ~31%, safety/gates ~87%, build-time strangler readiness ~77%, MDX/article pipeline ~37%, production migration still 0–3%. |
| **AGENTS-r188** | 2026-06-15 | **Второй article MDX shadow route добавлен по той же guarded-схеме: `dzhon-gill-istoricheskiy-kontekst`.** Добавлены `src/content/articles/dzhon-gill-istoricheskiy-kontekst.mdx` и `src/pages/articles/dzhon-gill-istoricheskiy-kontekst/index.astro`; ownership manifest перевёл `/articles/dzhon-gill-istoricheskiy-kontekst/` в `astro` / `shadow-pilot`. `article-mdx` audit теперь multi-article и проверяет 2 public shadow routes: справочник (1611/1694 words, H2 12/12) и исторический контекст (2954/2969 words, H2 13/13), оба с exact legacy SEO/article meta/Article JSON-LD/BreadcrumbList parity. `dist-publication-audit`, dry-run workflow и workflow policy теперь требуют оба article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/`, `/articles/dzhon-gill-spravochnik/`, `/articles/dzhon-gill-istoricheskiy-kontekst/`; deploy.yml не менялся. |
| **AGENTS-r187** | 2026-06-15 | **Redundant `/dev/article-mdx-pilot/` canary retired after public article shadow route was fully guarded.** Removed `src/pages/dev/article-mdx-pilot/index.astro` and its ownership entry; `scripts/article-mdx-pilot-audit.js` is now a public shadow audit that requires the retired dev preview route to stay absent while checking `/articles/dzhon-gill-spravochnik/` in `dist` against legacy SEO/content contract. This reduces dev surface: only `/dev/astro-test/` remains build-only. Production-like dist still requires `/dev/article-mdx-pilot/` absence via dry-run and dist publication audits. Production deploy remains root legacy. |
| **AGENTS-r186** | 2026-06-15 | **Dist publication audit теперь явно защищает первый article shadow route и оба dev routes.** `scripts/dist-publication-audit.js` требует `dist/articles/dzhon-gill-spravochnik/index.html`, проверяет что он Astro-owned, indexable, с public canonical и без pilot/noindex copy. Production-like `--forbid-dev` теперь запрещает не только `/dev/astro-test/`, но и `/dev/article-mdx-pilot/`; sitemap audit также падает, если legacy sitemap/partial output вдруг содержит `/dev/article-mdx-pilot/`. Это закрывает gap между article-specific shadow audit и general dist publication audit перед manual Dist Strangler Dry Run. Production deploy не переключён. |
| **AGENTS-r185** | 2026-06-15 | **Article shadow gate включён в общий deploy-readiness/dry-run policy.** `strangler:deploy-readiness` теперь запускает не только `astro:audit:about` и production-like dist audit, но и `astro:audit:article-mdx:strict`, чтобы первый public Astro article shadow route нельзя было обойти перед будущим dist dry-run/deploy-switch решением. `.github/workflows/dist-dry-run.yml` дополнительно проверяет наличие `dist/articles/dzhon-gill-spravochnik/index.html` и отсутствие обоих build-only dev routes: `dist/dev/astro-test/index.html` и `dist/dev/article-mdx-pilot/index.html`. `scripts/check-workflows.js` защищает эти требования от удаления. Production deploy по-прежнему root legacy; `deploy.yml` не переключён. |
| **AGENTS-r184** | 2026-06-15 | **Первый MDX article получил public shadow ownership в `dist` без production deploy switch.** Добавлен `src/pages/articles/dzhon-gill-spravochnik/index.astro`; `migration/page-ownership.json` перевёл `/articles/dzhon-gill-spravochnik/` в `owner: astro`, `status: shadow-pilot`, `risk: 2`. `copy-legacy-to-dist` теперь пропускает legacy copy этой статьи в `dist`, но repository root legacy HTML остаётся production truth. `scripts/article-mdx-pilot-audit.js` переведён в shadow audit: проверяет public Astro route на indexable canonical, title/description/H1/OG/article meta, Article JSON-LD, BreadcrumbList, отсутствие pilot note, H2/word parity (1611/1694 = 0.95), а `/dev/article-mdx-pilot/` остаётся noindex с dev canonical и intended public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` и `/articles/dzhon-gill-spravochnik/`, dev routes omitted; deploy.yml не менялся. |
| **AGENTS-r183** | 2026-06-15 | **Первый MDX article pilot доведён до strict body/SEO parity, оставаясь build-only/noindex.** `src/content/articles/dzhon-gill-spravochnik.mdx` получил curated body draft по legacy article: word parity 1630/1694 (0.96), H2 parity 12/12. `Seo.astro`/`BaseLayout.astro` поддерживают article-aware meta (`og:type=article`, `article:published_time`, `article:modified_time`, `article:author`), `ArticleLayout.astro` добавляет Article URL/mainEntityOfPage и BreadcrumbList JSON-LD на intended public canonical. `scripts/article-mdx-pilot-audit.js` усилен: теперь проверяет article meta, BreadcrumbList, Article URL/mainEntityOfPage/author и в strict режиме требует H2/body parity. `npm run astro:audit:article-mdx:strict` проходит, но public `/articles/dzhon-gill-spravochnik/` всё ещё byte-identical legacy copy; production deploy не переключён. |
| **AGENTS-r182** | 2026-06-15 | **MDX article pilot получил metadata parity audit против legacy article.** Добавлен `scripts/article-mdx-pilot-audit.js` и npm `astro:audit:article-mdx` / `:no-build` / `:strict`. Audit строит strangler `dist`, проверяет, что public `/articles/dzhon-gill-spravochnik/` остался byte-identical legacy copy, а `/dev/article-mdx-pilot/` остаётся `noindex` с dev canonical, но mirrors legacy title/description/H1/OG image/dates/Article JSON-LD и intended public canonical. Body parity пока advisory: 208/1694 words (0.12), поэтому strict режим оставлен для следующего шага после полного MDX body draft. |
| **AGENTS-r181** | 2026-06-15 | **Начат build-only MDX/article content pipeline без production switch.** Добавлены `src/content.config.ts` с `articles` collection + Zod schema, draft/noindex `src/content/articles/dzhon-gill-spravochnik.mdx`, статический `ArticleLayout.astro`, noindex preview `/dev/article-mdx-pilot/` и npm `astro:pilot:article-mdx`. `migration/page-ownership.json` объявляет preview route как `astro-noindex`/`build-only`, поэтому обычный strangler build проверяет его noindex, а production-like dist удаляет вместе с `/dev/astro-test/`. `astro check/build` снова 0 errors/0 warnings/0 hints. Legacy `/articles/dzhon-gill-spravochnik/` и production deploy не менялись. |
| **AGENTS-r180** | 2026-06-15 | **copy-legacy-to-dist получил dry-run и operation manifest для auditability.** Добавлен npm `strangler:copy:dry-run`; `scripts/copy-legacy-to-dist.js` теперь поддерживает `--dry-run` (не мутирует `dist/`), пишет ignored reports `reports/dist-copy-dry-run-manifest.json` / `reports/dist-copy-manifest.json`, фиксирует copied files/bytes/routes, skipped Astro-owned pages, preserved existing dist files, removed partial Astro sitemaps и omitted build-only routes. Это закрывает copy-legacy safety gap перед будущими batch migrations/deploy-switch без изменения production deploy. |
| **AGENTS-r179** | 2026-06-15 | **Build-time strangler получил page ownership guard перед deploy-switch.** Добавлен `scripts/check-page-ownership.js` и npm `page-ownership:check`, `page-ownership:dist`, `page-ownership:dist:production-like`; `validate:static-publication` теперь проверяет manifest/source coverage, а `strangler:validate`/`strangler:audit*` проверяют ownership сразу после build/copy. Guard требует, чтобы все `src/pages/*` Astro routes были объявлены в `migration/page-ownership.json`, Astro source route совпадал с route key, `/about/` в `dist` не был legacy-copy overwrite, build-only `/dev/astro-test/` отсутствовал в production-like `dist`, built-app `_app/` был скопирован и noindex, а 42 baseline public URLs resolve в `dist`. `scripts/check-workflows.js` дополнительно защищает package gates и будущий dist deploy от удаления ownership check. Production deploy не менялся: root всё ещё публикуется как legacy. |
| **AGENTS-r178** | 2026-06-14 | **Dist deploy-like checks усилены: Pagefind/SW/sitemap/publication audit для strangler output.** Добавлены `scripts/dist-publication-audit.js` и `scripts/build-pagefind.js`; npm `strangler:audit`, `strangler:audit:pagefind`, `pagefind:build`, `pagefind:build:dist`. Audit проверяет required files, отсутствие private dirs, отсутствие частичных Astro `sitemap-index.xml/sitemap-N.xml`, резолв всех legacy sitemap locs в dist, canonical robots sitemap, Astro ownership `/about/`, no technical scaffold copy, dev noindex, SW precache assets, Pagefind presence when required. Первый запуск поймал реальные dist issues: partial Astro sitemap files рядом с legacy sitemap, unstable npx/npm exec Pagefind syntax, и необходимость копировать `sw.js`; исправлено: `copy-legacy-to-dist.js` удаляет partial Astro sitemaps и копирует `sw.js`, `build-pagefind.js` стабильно вызывает Pagefind через npm exec wrapper, `deploy.yml` использует `npm run pagefind:build`. `strangler:audit:pagefind` green: dist publication audit passed, contract 42/42, dist smoke passed. |
| **AGENTS-r177** | 2026-06-14 | **Strangler dist получил representative smoke audit; пойманы и закрыты первые реальные dist-проблемы.** Добавлен `scripts/dist-smoke-audit.js` и npm `strangler:smoke`/`strangler:smoke:shots`: строит `dist`, поднимает local static server и проверяет representative URLs desktop+mobile (`/`, `/about/`, `/articles/`, `kod-da-vinchi`, `/karty/`, `/karty/avraam/`, `/konfessii/`, `/konfessii/russkij-baptizm/`, `/map/`, `/404.html`, `/dev/astro-test/`) на status 200, canonical/H1 basics, overflow=0, pageerrors, iframe wrapper. Первый запуск выявил: (1) `sw.js` не копировался в `dist` → 404 при SW registration на legacy pages; (2) Astro scaffold давал mobile overflow 18px из-за отсутствия global `box-sizing:border-box`. Исправлено: `sw.js` добавлен в `copy-legacy-to-dist` root files, `src/styles/global.css` получил global box-sizing. Повторный `strangler:smoke` green. |
| **AGENTS-r176** | 2026-06-14 | **Astro public `/about/` очищен от scaffold-технических надписей; dev markers оставлены только на `/dev/astro-test/`.** `Header.astro`/`Footer.astro` теперь принимают optional `badge`/`note`, `BaseLayout` прокидывает `technicalBadge`/`footerNote`; публичный `/about/` не показывает «Astro scaffold · noindex» и «Технический прототип, не production switch», а dev page продолжает показывать их явно. `astro-about-pilot-audit` усилен: падает, если public `/about/` снова содержит technical scaffold copy. QA: `astro:audit:about` сохраняет ratio 0.90+ и h2 parity. |
| **AGENTS-r175** | 2026-06-14 | **Astro `/about/` pilot parity polish: закрыты smoke-notes по heading/link/content.** Astro about дополнен ресурсными ссылками (YouTube/Rutube/Telegram/VK/Dzen/Facebook), contact grid (Telegram/VK/Email/Max), блоком «Нашли неточность?» и эпиграфом Авв. 3:19. Повторный `astro:audit:about`: legacy 605 words vs Astro 550 (ratio 0.91), все H2 совпадают включая «Нашли неточность?», прежние notes о missing heading и too-few links исчезли. Production ownership всё ещё НЕ переключён; перед rollout нужен ручной visual review, но content/SEO smoke теперь близок к legacy. |
| **AGENTS-r174** | 2026-06-14 | **Astro about pilot получил автоматический legacy-vs-dist smoke audit.** Добавлен `scripts/astro-about-pilot-audit.js` и npm scripts `astro:audit:about` / `astro:audit:about:shots`: скрипт строит strangler dist, поднимает два локальных static server (legacy root и dist), сравнивает `/about/` по title/canonical/H1/word-count/JSON-LD basics, проверяет overflow/pageerrors и может сохранять screenshots в ignored `reports/`. Локальный legacy CSP-шум от absolute `https://gospod-bog.ru/...` favicon/icon URL фильтруется как не-production false positive. Текущий результат: legacy 605 words vs Astro 458 (ratio 0.76), smoke pass; notes: Astro pilot пока без H2 «Нашли неточность?» и с меньшим числом contact links — это не blocker для shadow, но перед rollout нужен ручной visual/content review. |
| **AGENTS-r173** | 2026-06-14 | **Build-time strangler prototype готов локально: `dist` = Astro-owned `/about/` + copied legacy pages.** Добавлены `migration/page-ownership.json` и `scripts/copy-legacy-to-dist.js`; npm scripts `strangler:build`/`strangler:validate`. Алгоритм: `astro:build` сначала clean `dist`, затем copy legacy public files/dirs, не перезаписывая Astro-owned routes (`/about/`, `/dev/astro-test/`). `/konfessii/russkij-baptizm/_app/` отмечен как built-app/copy-as-built-asset. `strangler:validate` создаёт полный local dist: copied 442 files (~44MB), Astro-owned legacy `/about/` skipped, `contract:extract:dist` видит 42 public pages, `contract:compare:dist` сравнивает 42/42 baseline URLs без ошибок. Production deploy всё ещё НЕ переключён на `dist`; sitemap/feed/SW пока legacy-copied. Документ: `BUILD_TIME_STRANGLER_PROTOTYPE_STATUS_2026-06-14.md`. |
| **AGENTS-r172** | 2026-06-14 | **Astro `/about/` pilot создан в local dist без production switch.** Добавлен `src/pages/about/index.astro` как первая реальная Astro route для shadow-сравнения: сохранены canonical/title/description/H1/robots, JSON-LD graph (Organization/WebSite/Person/ProfilePage/BreadcrumbList), OG image и смысловые секции legacy about. Legacy `about/index.html` не удалялся, deploy.yml всё ещё публикует root, а не `dist`. `compare-url-contract.js` получил `--only-url`; добавлен npm `contract:compare:dist:about`. После `astro:build`, `contract:extract:dist` видит 1 public page, а `contract:compare:dist:about` сравнивает только `https://gospod-bog.ru/about/` и проходит. Документ: `docs/refactor-2026/ASTRO_ABOUT_PILOT_STATUS_2026-06-14.md`. Следующий шаг перед rollout — visual desktop/mobile compare и build-time strangler/copy-legacy, не deploy switch сразу. |
| **AGENTS-r171** | 2026-06-14 | **Astro scaffold Level‑1 создан без production switch.** После pre-Astro baseline tag `pre-astro-refactor-baseline-2026-06-14` добавлен минимальный Astro 6 scaffold: `astro.config.mjs`, `tsconfig.json`, `src/data/site.ts`, `BaseLayout.astro`, SEO/JSON-LD/Header/Footer components, локальные `src/styles/*`, noindex dev page `/dev/astro-test/`. Production deploy path не менялся и legacy HTML не заменялся. Astro 6 требует Node `>=22.12.0`, поэтому `package.json engines` и GitHub Actions `setup-node` переведены на 22; Astro/React/MDX packages находятся в `devDependencies` (build-only). `npm audit --omit=dev` clean; full dev audit advisories по build tools зафиксированы в `ASTRO_SCAFFOLD_STATUS_2026-06-14.md`, без `--force`. Legacy validators теперь игнорируют local `dist/` output. QA: Astro check/build под Node 22.12 — 0 errors/warnings/hints; `validate:static-publication`, `workflows:check`, `konfessii:audit` green. |
| **AGENTS-r170** | 2026-06-14 | **Pre-Astro baseline: audit warning noise closed without risky CSS/runtime deletion.** Перед первым Astro scaffold оставшиеся 3 warnings переведены в корректные контракты: CSS budget теперь считает core CSS отдельно от route-scoped `nagornaya/tw.min.css` (route CSS остаётся info), `site.css` `!important` переведён в hard ratchet `IMPORTANT_CEIL=214` без warning (новые `!important` теперь сразу error; долг +14 над целью 200 остаётся info), большой inline runtime `karty/avraam/index.html` признан известным guarded map-app debt (info), защищён `avraam:audit` и MapEngine extraction plan. Production CSS/HTML/runtime не менялись; audit стал чище без «обмана» и с более строгим ratchet. |
| **AGENTS-r169** | 2026-06-14 | **Перед Astro/refactor закрыты Level‑0 preflight gaps: URL compare + maps route schema/validator + Ishod route consistency.** Без установки Astro, без deploy/runtime/URL изменений: добавлен `scripts/compare-url-contract.js` (`contract:compare`, `contract:compare:dist`) для сравнения baseline vs current/future dist; добавлен `karty/_shared/route.schema.json`; добавлен `scripts/validate-map-routes.js` и npm `maps:validate`; `validate:static-publication` теперь включает `maps:validate` и `contract:compare`; `reports/` добавлен в `.gitignore` и skipDirs `audit-pro`. Найдена и исправлена data-debt в `karty/ishod/route.json`: stories ссылались на отсутствующие `etham/elim/rephidim/aaron_mount`, а stats `places=14` не совпадал с фактическими 7; добавлены 4 минимальных маршрутных узла, stats синхронизирован на 11. Docs обновлены: `AGENT_HANDOFF_NO_REFACTOR`, `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE`, новый `LEVEL0_PREFLIGHT_COMPLETION_2026-06-14.md`. QA: `maps:validate`, `contract:compare`, `validate:static-publication`, `konfessii:audit`, `workflows:check` green. |
| **AGENTS-r168** | 2026-06-14 | **Refactor-2026 handoff принят: Astro + React islands план найден; выполнен первый безопасный Level-0 шаг без runtime-рефакторинга.** После fast-forward на `origin/main` обнаружена новая папка `docs/refactor-2026/` (55+ документов): ADR выбирает Astro + React islands + MDX/content collections; handoff прямо запрещает рефакторинг без отдельного решения владельца. Прочитаны индекс, `AGENT_HANDOFF_NO_REFACTOR_2026.md`, `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md`, `ASTRO_MIGRATION_PHASE_PLAN_2026.md`, `TECHNICAL_MIGRATION_RUNBOOK_2026.md`. Найдено расхождение handoff: он заявлял `extract-url-contract.js`, но в main его не было. Реализован безопасный Next PR 1: добавлен `scripts/extract-url-contract.js` с `--root`, `--out-json`, `--out-md`, `--include-noindex`; добавлены npm scripts `contract:extract`, `contract:extract:root`, `contract:extract:dist`; `reports/` добавлен в `.gitignore`; добавлен документ `docs/refactor-2026/CONTRACT_EXTRACTOR_IMPLEMENTATION_2026-06-14.md`. `npm run contract:extract` на текущем root: 42 public pages, 0 issues. Production/deploy/Astro deps не тронуты. |
| **AGENTS-r167** | 2026-06-14 | **Карта Авраама: panel-section extraction into MapEngine.** Продолжен вынос без смены DOM-рендера: `MapEngine` получил `getPanelSections(route, placeId, tab, relatedMap)`, который централизует tab content key и флаги панели (`showRelated`, `showPhotos`, `showDispute`, `showScientificVariants`, `showBibleExtra`). `setTab()` теперь строит section через `MapEngine.getPanelSections(...)`, хранит `window.AvraamCurrentPanelSection`, а условия рендера related/photos/dispute/scientific variants/bible_extra читают section flags с fallback. `avraam:audit` расширен до 51/51: проверяет panel section helper, canonical flags для story/bible, и использование section flags в `setTab`. QA: `npm run avraam:audit` green. |
| **AGENTS-r166** | 2026-06-14 | **Карта Авраама: panel-model extraction into MapEngine.** Продолжен безопасный вынос движка: `MapEngine` получил pure helpers `getPlaceIndex()`, `getPlaceById()`, `getStageForPlace()`, `getRelatedPlaceIds()`, `getTabContentKey()`, `getPanelModel()`. `openPlace()` теперь берёт place/stage/related model через `MapEngine.getPanelModel(window.AvraamRouteData,id,RELATED)` с fallback; stage-hint использует model.stage; `setTab()` использует `MapEngine.getTabContentKey()` и related places через `MapEngine.getRelatedPlaceIds()`. DOM-рендер панели остался прежним, но вычисление модели панели вынесено в engine. `avraam:audit` расширен до 49/49: проверяет panel helpers exports, canonical `getPanelModel/getTabContentKey/getRelatedPlaceIds`, использование helpers в openPlace/setTab. Browser smoke: `openPlace(ur)` даёт model place=ur/stage=I/related=harran+urfa, arch tab рендерит variants/photos, pageerror=0. |
| **AGENTS-r165** | 2026-06-14 | **Карта Авраама: layer/marker visual extraction into MapEngine.** Продолжен безопасный вынос движка: `MapEngine` получил pure helpers `normalizeLayerState()`, `isLayerOn()`, `getPlaceLayerId()`, `getRouteLayerId()`, `getPlaceVisual()`. Inline marker builder теперь берёт `markerClass/cssColor` из `getPlaceVisual`; places-list color тоже из engine visual; `applyLayers()` больше не держит ручные ternary по `cand/lot/war`, а использует `MapEngine.isLayerOn/getRouteLayerId/getPlaceLayerId` с fallback. `avraam:audit` расширен до 45/45: проверяет экспорт layer/visual helpers, canonical ids/colors, использование helpers в marker builder и applyLayers. Browser smoke: 19 markers, candidate layer off hides exactly `urfa/hammam/lahairoi`, Abraham layer off hides `ur`, pageerror=0. |
| **AGENTS-r164** | 2026-06-14 | **Подготовка к будущей платформе: контентный baseline + санитарные warnings + исторический delete-audit.** Полная история поднята (`git fetch --unshallow`, 972 коммита); явного site-wide плана Astro/Next/new-platform в репо/истории не найдено. Прочитаны релевантные планы: удалённый `_agent-handoff/ROADMAP.md` (GBS/серии, не новая платформа), `docs/MAPS-ARCHITECTURE.md`, `docs/MAPS-RD-MASTERPLAN-2026.md`. Safe cleanup: root-preview `karty-preview.html`/`konfessii-preview.html` перенесены в `_build-tools/preview-archive/` (материал сохранён, публичный шум снят), `/karty/ishod/` добавлен в sitemap, meta-description `/karty/` укорочен, `audit-pro` игнорирует template placeholders `${...}` как не-URL, `_build-tools` исключён из public `audit-pro`, `old-tbilisi-kura-xix.jpg` сжат 1.85MB→266KB. Добавлен migration guard: `scripts/check-public-content-baseline.js`, `data/public-content-baseline.json` (42 public indexable pages: URL/title/H1/word-count), npm `content:guard`/`content:baseline`, `content:guard` включён в `validate:static-publication`. Исторический delete-audit: 96 deleted content-like files проверены; Gill old single 20 963 words vs current Gill 5 pages 27 967 words; raw-source HTML по баптистам заменены `.txt`; явной потери содержательного материала не найдено. Документ: `docs/PLATFORM-MIGRATION-PREP-2026-06-14.md`. QA: `validate:static-publication` PASS, `konfessii:audit` PASS; warnings снижены до 3 (CSS budget, 214 !important, Avraam inline script — стратегические, не точечные). |
| **AGENTS-r163** | 2026-06-14 | **3D-карта баптизма: smooth physics polish поверх актуального main без отката новых research/Timeline добавлений.** После проверки remote `main` (`69cd8bb`, уже содержит `baptisty-rossii`, data-driven Timeline metadata, article previews, кейсы гонений, BWA-статистику и I8–I13 guards) правки перенесены НЕ на старую базу, а поверх latest. Смягчена физика 3D: `d3AlphaDecay .0115→.0165`, `d3VelocityDecay .20→.24`, `warmupTicks 140→150`, `cooldownTicks 260→220`, `cooldownTime 9000→7000`, сила `composition` к якорям `*1.6→*1.28`, drag damping `0.32→0.26`, neighbor pull/home `0.0038/0.0016→0.0032/0.0012`, release impulse `0.010→0.006`, release velocity keep `0.32→0.36`. Цель: убрать ощущение «напряжённых» и дёрганных шариков, оставить rubber-band и синхронизацию с картой/Timeline. `scripts/konfessii-map-audit.js` расширен **I14**: static+source guards на calm physics constants, запрет старых jitter constants, live I1–I13 сохранены. Документация: `_build-tools/konfessii-baptizm/3D-PREMIUM-POLISH-2026-06-14.md`; README/3D-RUBBER обновлены. Попутно восстановлен static gate latest-main: `_build-tools` добавлен в skipDirs `audit-pro` (прототипы/мокапы не являются публичными страницами), `old-tbilisi-kura-xix.jpg` сжат 5000px/1.85MB → 1800px/266KB. QA: `npm run konfessii:audit` PASS (I1–I14, live desktop WebGL + mobile smoke), затем полный `validate:static-publication` прогоняется повторно. |
| **AGENTS-r162** | 2026-06-14 | **Карта Авраама: story-state extraction into MapEngine + guards.** Продолжен аккуратный вынос движка без визуального риска: в `MapEngine` добавлены pure helpers `getStoryState(route, storyId)`, `getPlaceOrder(route, storyId)` и `auditStoryDefinitions(route)`; `applyStory()` в `karty/avraam/index.html` теперь берёт place/stage/waypoint sets из `MapEngine.getStoryState`, с fallback на старые данные. Это вынесло story filtering из inline-логики, но DOM-рендер остался прежним. Исправлен нюанс opacity SVG-группы waypoints: теперь dim ставится и на root, и на child `.route-waypoint` атрибутами, чтобы браузеры не расходились по computed opacity. `avraam:audit` расширен до 39/39: проверяет экспорт story-state/place-order helpers, exact story counts, main-order без кандидатов, story-order с кандидатами, использование helpers в `applyStory`/counter/prev-next, child waypoint opacity. Browser smoke по main/lekh/war/lot/akeda: state counts верные, hi/dim маркеры корректны, waypoint opacity .72 только main/Лех-леха и .08 для остальных, `AvraamRouteJsonAudit.ok=true`, pageerror=0; lekh/main next from Ур → Харран, counters 1/6→2/6 и 1/16→2/16. |
| **AGENTS-r161** | 2026-06-14 | **3D-карта баптизма: data-driven Timeline metadata + кейсы гонений.** Продолжение после новых research-коммитов: в `TimelineEvent` добавлены поля `sourceLevel`, `nodeId`, `routeId`, `mapSelectionId`, `articleKey`; `handleTimelineEventSelect` теперь сначала читает эти поля и только потом использует `TIMELINE_TARGETS` как fallback. В Timeline добавлены кейсы из индекса гонений: 1935–1938 Георгий Слесарев (Сиблаг/расстрел), 10.09.1937 Иван Шилов (Соловки/Карлаг/расстрел), 09.01.1964 Николай Хмара (Барнаульская тюрьма), с `sourceLevel` badges. Source snapshot `data/timeline.ts` обновлён, `_app/index.html` пересобран. `konfessii:audit` усилен I12/I13 на case-index events и data-driven metadata. QA: `validate:all`, `audit-pro`, `konfessii:audit` green. |
| **AGENTS-r160** | 2026-06-14 | **Readable-publication guard cleanup after wiring Avraam audit into static gate.** После добавления `npm run avraam:audit` в `validate:static-publication` полный gate выявил существующий readable-audit шум в серии «Баптисты России»: `.summary-card__num` без `aria-hidden`. Исправлено на 11 страницах `baptisty-rossii/` добавлением `aria-hidden="true"` к декоративным номерам summary-card. `npm run readable-audit` и `npm run validate:static-publication` теперь green. |
| **AGENTS-r159** | 2026-06-14 | **Карта Авраама: аккуратный engine extraction + history-derived guards.** По истории коммитов/AGENTS выделены повторные регрессии: script-boundary (`animateStageRoutes`), caption transform off-screen, panel rubber animation conflict, dangling `g/pl` preview block, hint over tour walker, CSP/photo redirects, drift HTML↔route.json. `MapEngine` получил `compareRouteData()` и `collectPhotoHosts()`; `avraam/index.html` теперь preload-ит `route.json` и в фоне выставляет `window.AvraamRouteJsonAudit = MapEngine.compareRouteData(window.AvraamRouteData, routeJson)` — шаг миграции к data-driven engine без визуального риска. `avraam:audit` расширен до 31/31: проверяет dynamic photo hosts vs CSP, route.json preload, runtime drift audit wiring, отсутствие dangling SVG pointerenter, `.panel-opening` вместо `#panel.open` для rubber, отсутствие skeleton console logging. `validate:static-publication` теперь запускает `npm run avraam:audit`, чтобы CI/ручные gate ловили регрессии карты. Browser smoke подтвердил `AvraamRouteJsonAudit.ok=true`, pageerror=0. |
| **AGENTS-r158** | 2026-06-14 | **Карта Авраама: anti-regression audit guard.** Добавлен `scripts/avraam-map-audit.js` + npm script `npm run avraam:audit`: проверяет inline PLACES/STAGES/CTX/STORIES, `route.json`, `MapEngine.validateRoute`, 19/8/5/7/40/5/47 stats, совпадение HTML/route place IDs, scientific variants для всех 19 мест, exact waypoints, layer/legend UI, Shechem title, captionSpring без `translateX(-50%)`, script-boundary GSAP setup, `startTour()`→`killHint()`, CSP для `tile.loc.gov`/Ritmeyer, отсутствие хрупких Wikimedia `/upload` URL и старого LOC redirect, compact Abraham source MD без stale proposal-noise. Текущий результат: 24/24 passed. |
| **AGENTS-r157** | 2026-06-14 | **Карта Авраама: доведение до full-data/verified state + visual QA.** Выполнен большой проход раздела `/karty/avraam/`: `map-engine.js` обновлён до v0.2 reusable core (loadRoute/normalize/validate + viewport/flyTo/zoom/pan + story/tour/share); `route.json` расширен до full data (19 places / 8 stages / 5 stories / 7 ctx / 40 photos / 5 verified_waypoints / 47 scientific_variants); все Wikimedia фото переведены на `Special:FilePath`, LOC Matson на canonical `tile.loc.gov`, CSP расширен под LOC/Ritmeyer; добавлена SVG-фигурка Авраама в кинотуре; исправлены runtime-regressions (`animateStageRoutes` script-boundary, captionSpring off-screen, hint over walker); добавлен слой опорных узлов Ур→Харран (Урук/Ниппур/Вавилон/Мари/Каркемиш) + toggle/legend; добавлен UI-блок «Научные варианты и оговорки» для всех 19 мест; исправлен dispute-title Сихема; `ABRAHAM-ARCHAEOLOGY` очищен до compact source index с BiblePlaces/Commons/LOC/Ritmeyer/AiG/ARJ/Creation/NPAPH + WiBiLex/Jewish/Sefaria. QA: Commons 38/38, 40 thumbnails load, browser smoke pageerror=0, `validate:all` green, `audit-pro` green. |
| **AGENTS-r156** | 2026-06-14 | **3D-карта баптизма: события Бюллетеней Совета родственников перенесены в Timeline.** После коммита `16bda31` (PDF-каталог Бюллетеней Совета родственников узников ЕХБ) Timeline 3D-приложения дополнен событиями: 1972 — Бюллетень №9 о смерти Ивана Моисеева (военный вопрос/молодёжное свидетельство), 1977 — Бюллетень №44 о печатниках «Христианина» под следствием (Левен, Кооп, Людмила и Лариса Зайцевы), 1980 — Бюллетени №84/88: Донченко с Бюллетенями и Евангелиями, отобрание детей, психбольницы во время Олимпиады, 79 узников. `TIMELINE_TARGETS` расширен на эти события (conscience/samizdat previews, советский маршрут, Москва). Source snapshot `data/timeline.ts` обновлён, `_app/index.html` пересобран. `konfessii:audit` усилен I12 на relatives-bulletin events. QA: `validate:all`, `audit-pro`, `konfessii:audit` green. |
| **AGENTS-r155** | 2026-06-14 | **3D-карта баптизма: превью статей серии прямо в Timeline и dossier.** По запросу владельца «умно всё связывать и красиво превью статей раскрывалось» добавлен слой `ARTICLE_PREVIEWS` + `NODE_ARTICLE`: события Timeline и выбранные узлы теперь показывают связанную статью серии `/baptisty-rossii/` (cover SVG, номер части, title, description, переход `target=_top`). Timeline-card показывает мини-preview статьи при hover/focus события; full dossier показывает блок «Связанная статья» перед связями узла. `TIMELINE_TARGETS` получил `article` key, fallback идёт через `articleForNode`. `konfessii:audit` усилен I13 source/_app guards на article previews. Пересборка Vite singlefile → `_app/index.html`. QA: `validate:all`, `audit-pro`, `konfessii:audit` green. |
| **AGENTS-r154** | 2026-06-14 | **3D-карта баптизма: синхронизация с новыми источниками по Инициативной группе и самиздату.** После коммитов `c8f9899` и `614da41` (углубление статьи 8/9 + Братский Вестник №6 1963) Timeline 3D-приложения дополнен событиями: 15–17.10.1963 съезд ВСЕХБ и Устав 1963 (официальная линия), 1963 появление «Вестника спасения», 16–17.05.1966 майская делегация к ЦК КПСС + арест Винса/Хорева, 1970 Совет родственников узников, 05.06.1971 издательство «Христианин» уведомляет Косыгина, 1976 «Вестник спасения» → «Вестник истины». `TIMELINE_TARGETS` расширен на 1963/1966/1970/1971/1976, все ведут в релевантные узлы/маршрут/Москву. Source snapshot `data/timeline.ts` обновлён, `_app/index.html` пересобран. `konfessii:audit` усилен I12 на initiative/samizdat events. QA: `konfessii:audit`, `validate:all`, `audit-pro` 154 passed · 0 errors. |
| **AGENTS-r153** | 2026-06-14 | **3D-карта баптизма: синхронизация с полной серией «Баптисты России» (10 статей) + BWA статистика + события совести.** После публикации 10-й статьи/справочника проверен актуальный `main`: серия `russian-baptism` теперь полностью published (10 частей). 3D-приложение обновлено из Vite-source: hero/root/organizations/quiz/Comparison статистика `~144K/~72 000` заменена на источниково оговорённые BWA `66 732 членов / 1 413 церквей` (independent/unregistered groups требуют отдельной методики); Timeline получил события статьи «Гонения и совесть» — 04.01.1919 декрет о замене воинской повинности, 1923 ОГПУ/«Голос с Востока»/XXV съезд, 1926 новая формула по военному вопросу, 1945 «Братский Вестник» и послевоенная линия; `TIMELINE_TARGETS` расширен для этих событий (фокус графа/маршрута/Москвы). Добавлены source snapshots изменённых Vite-файлов в `_build-tools/konfessii-baptizm/source-snapshot/`. `konfessii:audit` усилен I12: отсутствие `~144K`, наличие BWA 66 732 и событий совести. Пересборка Vite singlefile → `_app/index.html`. Дополнительно исправлена mixed-content ссылка в справочнике (http→https) и проверены `validate:all`/`audit-pro`/`konfessii:audit` green. |
| **AGENTS-r152** | 2026-06-13 | **wave-25: Sprint 3 route.json + MAPS-ANALYSIS P1+P6 + OWNER-REQ #15 глоссарий рамки.** (1) **MAPS-ANALYSIS P1 ЗАКРЫТ**: маршрут Stage I Ур→Харран исправлен — теперь огибает Евфрат через Ниппур/Мари/Каркемиш (исторически верный торговый путь СБ, подтверждён архивом Мари). Описание этапа обновлено. (2) **MAPS-ANALYSIS P6 ЗАКРЫТ**: легенда типов маркеров добавлена в #layersPop — SVG иконки для каждого типа: основные места (круг+золото), Лот (ромб+медь), кандидаты (пунктир+фиолет), контекст (серый кружок). (3) **Sprint 3 ЗАКРЫТ**: `karty/avraam/route.json` создан (131 строка, valid JSON) — meta/places_index(19)/stages_index(8)/stories(5)/ctx_index(7)/yec_position/notes. route.json `<link rel=preload>` добавлен в head. MAPS-RD-MASTERPLAN Sprint 3 checklist обновлён. (4) **OWNER-REQ #15 ЗАКРЫТ**: глоссарий «забагованные рамки» — найден корень: `.gterm.is-open{padding:4px 6px 6px;margin:-4px -5px -5px}` создавал визуальную «рамку» вокруг активного слова. Исправлено: `padding:0 1px 1px;margin:0;outline:none` — рамка исчезает, подчёркивание остаётся. (5) **QA**: route.json валидный JSON (python3 json.load), Stage I path в HTML confirmed, marker-legend в HTML confirmed. 4363 строки avraam | 131 строка route.json | site.css #15 fix. |
| **AGENTS-r151** | 2026-06-13 | **wave-24: MD глубокий проход + SVG красота + кнопки + звёзды + новые фото.** (1) **MD VERIF28/29 данные внедрены**: LOC Matson PD ~1900-1920 фото Пустыни Сур (https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg); Ritmeyer Archaeological Design фото Мамре реконструкция (https://www.ritmeyer.com/wp-content/uploads/2020/04/il_mamre_d01_wm.jpg). (2) **SVG красота**: Кинерет — реалистичная форма (вытянуто СЗ→ЮВ); Гевал/Геризим — тройной хребет с боковыми пиками, крупнее (MAPS-ANALYSIS P5); Падающие звёзды — 4 линии с trailing glow, calcMode:discrete; Звезда Мории — мигающая над Шалемом; Млечный путь — nebulaGrad + дыхание 14s; starGlow filter (feGaussianBlur двойной) для ярких звёзд. (3) **Кнопки идеально**: btn 42px→48px(mobile); zin/zout 52px mobile; btn hover scale(1.05)+translateY; active scale(.91); @media(hover:none) guard; haptic на zin/zout/zreset; micro-animation (scale+rotate на zreset); stage-chip min-height:36px; marker hover scale(1.08)→scale(1.15); markerGlow drop-shadow двойной. (4) **Новые CSS**: starGlow filter; nebulaGrad radial; btn::after radial inlay; prefers-reduced-motion guards расширены. (5) **QA**: Node.js vm.Script: block 3/4/5 OK; 4362 строки, 398KB. |
| **AGENTS-r150** | 2026-06-13 | **wave-23: 3 критических бага — день/ночь SVG, карта Авраама, 3D зум.** (1) **День/ночь SVG пропал**: корень — `overflow:hidden` на `.h-navbar__inner` в `css/home.css` обрезал абсолютно позиционированные SVG иконки `.theme-toggle`. Исправлено: `overflow:hidden → overflow:visible`. Баг введён при минификации CSS (коммит a0a363d2). (2) **Карта Авраама — мерцание и нельзя открыть**: `panelRubberIn animation fill:both` конфликтовал с `transform:none` из `#panel.open` — панель мерцала (0% кадр убирает за экран). Решение: rubber animation перенесён на класс `.panel-opening` (добавляется JS в openPlace и убирается через 600ms), не конфликтует с `.open`. Caption `both→forwards`, marker bounce `both→forwards`. (3) **3D карта баптистов — глитч зума**: `wheel` события регистрировались как `passive` на родительской странице, мешая Three.js OrbitControls вызвать `preventDefault()`. Добавлен non-passive wheel listener + touch pinch fix на `.stage`. Проверено: все 3 исправления атомарные, без side effects. |
| **AGENTS-r149** | 2026-06-13 | **wave-22: ЗВЁЗДЫ 5 слоёв + PARALLAX + SPRING/RUBBER анимации + КИНОТУР БАГ FIX.** (1) **ЗВЁЗДЫ**: 5 слоёв глубины — `starDeep` (20 далёких, мелкие, 7–13s), `starMid` (средние, существующий набор), `starField` (6 ярких передних с анимацией r-пульсации), `starMilky` (Млечный Путь — размытая ellipse), `starShoot` (падающие звёзды 60/73s цикл). (2) **PARALLAX**: mousemove/touchmove → CSS transform на 3 слоях с разными коэф. (Deep×0.3, Mid×0.6, Field×1.0) — звёзды «плывут» в глубину при движении. (3) **SPRING АНИМАЦИИ**: `panelRubberIn` (rubber 55% overshoot), `tabFlipIn` (3D flip контента), `markerBounceActive` (spring при клике), `captionSpring` (caption появление), `chipElastic` (elastic chip), `ctxSpring` (ctxCard spring), `introBtnBounce` (кнопки intro появляются поочерёдно), `goRubber` (кинотур-кнопка), `prevSpring` (hover preview), `storyBtnSpring`, `toastRubber`, `markerOpenWave`. (4) **КИНОТУР БАГ FIX**: `_pathLen()` fallback если getTotalLength()=0; guard если paths пустой; caravan dot с goldGlow+trailing glow ring; easeInOutQuart + spring overshoot финал; rafId для отмены; playBtn.style.color gold при туре; рестарт через requestAnimationFrame для layout-ready. (5) **ДОП**: дублированный `<script>` тег удалён; `}open');` JS синтаксис-баг исправлен; panel transition только при .open:not(.open); mobile panel transition тоже. prefers-reduced-motion guards. Wave22 JS блок 5235 chars, OK. 4241 строка, 379KB. |
| **AGENTS-r148** | 2026-06-13 | **wave-21: TTS race condition fix + MD глубокий проход (20+ баш).** TTS ПЛЕЕР: (1) _uttGen счётчик поколений — каждый utt получает myGen; onend/onerror: if(myGen!==_uttGen)return → race condition УСТРАНЁН; (2) 120ms delay (было 50ms); (3) double-check speaking; (4) resumeIdx=idx сохранение; (5) _uttGen++ в pl/pa/st/speed; (6) 6 speeds [0.75,1,1.25,1.5,1.75,2]; (7) visual feedback opacity. MD проход: Гевал/Геризим двойные пики (снежная шапка+блик); Сихем arch NPAPH/BiblePlaces Then/Now note; @container panel-body (max-width:320px) адаптив; .act-btn hover+active; MAPS-ANALYSIS незакрытые P5-P6 закрыты; EDITORIAL-SOURCE-POLICY проверена (нет eng цитат в тексте). QA: 24/24 ✅ | avraam 3804 строки | site.js 565 строк | 159KB. |
| **AGENTS-r147** | 2026-06-13 | **wave-20: Sprint3 _engine/ + MD чеклисты + Hub Web Share + фото.** Глубокий проход всех MD: (1) **_engine/map-engine.js v0.1** (API skeleton: init/flyTo/openPlace/setStory/nextPlace/prevPlace/startTour/stopTour/setZoom/getState/shareURL по MAPS-RD §1.3). (2) **_engine/base-geo.svg** (34KB, 444 строки — базовая география для всех карт). (3) **MD чеклисты обновлены**: Sprint 1 ✅ ЗАКРЫТ, Sprint 2 ✅ ЗАКРЫТ, Sprint 3 В ПРОЦЕССЕ; MAPS-ARCHITECTURE статус таблица. (4) **Фото из ABRAHAM-ARCHAEOLOGY VERIF29**: Харран ворота Ракка (then), Сихем NPAPH Th.C. Vriezen 1957 (then/now). (5) **Источники** в панели: BiblePlaces Vol.2-7, NPAPH/Vriezen 1957, LOC American Colony, CMI creation.com, Ашшер ~2166. (6) **Hub Web Share API** + прогресс-бар Исхода 25%. QA: 12/12 ✅ | 3791 строка | 357KB. |
| **AGENTS-r146** | 2026-06-13 | **wave-19: вторые фото 7 мест + route.json Исхода + waterRipple Нил + preview thumb.** (1) **Вторые фото** для урфа (Гёбекли-Тепе), дамаска (оазис Гута), бет-эля (водораздел), хаммама (Иорданская долина), шур (Синай), лахай-рои (стада Негев LOC), хова (вид к северу). (2) **Sprint 3: karty/ishod/route.json** — 7 мест: Раамсес, Сокхоф, Пи-Гахироф (dispute 3 версии переправы), Мара (he_deep + Откр параллель), Синай/Хорив (dispute Джебель Муса vs Лоз), Кадеш-Барнеа (he_deep Мерива), Равнины Моавитские (he_deep Нево) — все поля story/bible/arch/he_deep/dispute/bible_extra; 6 stages с km/age. (3) **Нил** в <g filter=waterRipple>. (4) Hover preview: thumbnail из photos[0] если есть (img.mp-thumb, CSS .has-photo). (5) tn-item мобайл 180px. QA: 11/11 ✅ | 3790 строк | 356KB. |
| **AGENTS-r145** | 2026-06-13 | **wave-18: Sprint3 scaffold Исхода + MD фото + Ritmeyer Мория + Синай.** Из MD: (1) **karty/ishod/index.html** scaffold (noindex, JSON-LD breadcrumb, preview SVG маршрута, иврит); карточка Исхода на хабе → `<a href=/karty/ishod/>` (была div); CSS hover gold. (2) **Новые фото из MD**: Кадеш (Wadi Ain Qudeirat LOC Matson ~1900s), Герар (Nahal Gerar valley BiblePlaces Vol.5), Египет (Pyramids of Giza). (3) **Arch обновления**: Мория — Ritmeyer «выемка под Ковчег» (1 Цар 8, Holy of Holies на Скале); Кадеш — LOC Matson «оазис с стадами» YEC аргумент; Герар — BiblePlaces Pictorial Vol.5 ref. (4) **SVG**: Раамсес dot (lbl-z2); Синай хребет детальнее (Ум-Шаумер 2587м + Хорив + 2 боковых + снег). (5) Story toast: count «✦ Война · 4 места». Conf badges font-weight:600. QA: 14/14 ✅ | 3766 строк | 351KB. |
| **AGENTS-r144** | 2026-06-13 | **wave-17: waterRipple все 5 морей + a11y маркеры + UX polish + картуш.** (1) waterRipple (<g filter>, Safari-safe) на Средиземном, Красном, Персидском, Мёртвом, Кинерете — живая вода везде. (2) Маркеры: aria-label, tabindex=0, role=button, Enter/Space открывают, .marker:focus outline gold. (3) Прибрежная зона Средиземноморья SVG. (4) Картуш: 4 декоративных угловых орнамента, ярче цвет. (5) CSS: scroll-snap на stage-chips, ::selection gold, contain:content/layout, story-nav translateZ(0), touch-action manipulation. (6) Photo modal swipe-down close mobile. (7) haptic только при touch (maxTouchPoints>0). QA: 13/13 ✅ | 3751 строк | 347KB. |
| **AGENTS-r143** | 2026-06-13 | **Карта Авраама wave-16: waterRipple/terrainTex применены + lot ромб + Tab/story auto-open + UX polish.** (1) **SVG фильтры активированы**: waterRipple (feDisplacementMap) на Средиземном и Красном морях — вода анимированно «колышется»; terrainTex на фоне суши — органическая текстура рельефа; координатная сетка с метками 27–36°N / 31–46°E. (2) **Lot-маркеры = ромбы** (path M0,-8.5 L6.5,0...) — визуально отличают линию Лота от пути Авраама. (3) **Tab keyboard nav**: листает видимые маркеры (story-aware); Shift+Tab обратно. (4) **Story auto-open**: при выборе сюжета через 1.2с автоматически открывается первое место. (5) **Long-press + фото**: показывает метку+кредит первого фото. (6) **CSS polish**: tn-item photo zoom, pfoot стрелки hover, tip .08s, search box gold, panel header gradient, life rail shadow, panel-open story-nav dim mobile. QA: 17/17 ✅ | 3703 строки | 344KB. |
| **AGENTS-r142** | 2026-06-13 | **Технический аудит + bug-fixes Safari/Mobile/A11y/Чистка.** Найдены и исправлены: (1) 🔴 КРИТИЧНО: `92svh` без vh fallback → `92vh / -webkit-fill-available / 92svh` (iOS <16); (2) `user-scalable=no` в viewport (нет Safari zoom при input focus); (3) `aria-modal/aria-hidden` динамически меняются при open/close панели (accessibility); (4) `-webkit-text-size-adjust:100%` (Safari не масштабирует текст); (5) panel `translateZ(0)` GPU layer; (6) `#tourProgress z-index:26` явный; (7) 2 `<style>` блока → 1 (merge без риска); (8) пустой CSS `#tabs .tab[data-t="he"]{}` удалён; (9) photoModal Esc — улучшен handler; (10) `panel setCursorPointer` active. Аудит подтвердил: 28/28 checks green, 0 console.log, GSAP guards есть, pointer-events:none intro::before ✅, overscroll-behavior ✅, prefers-reduced-motion ✅. MAPS-RD-MASTERPLAN обновлён: финальная статистика карты (3625 строк, 7 полей × 19 мест = 133 единицы контента, 20 фото, 41 keyframes, YEC позиция, SVG детали). |
| **AGENTS-r141** | 2026-06-13 | **Карта Авраама wave-15: dispute+bible_extra+he_deep+photos 19/19/19/20 — ПОЛНОЕ ЗАКРЫТИЕ контента.** (1) **dispute 19/19**: Урфа (традиция vs академия), Харран (бесспорная), Дамаск, Сихем, Бет-Эль (Ливингстон 1994), Египет (контекст не точка), Хеврон (Рамат+Тель Румейда), Дан (антиципация + YEC caveat), Беэр-Шева, Шур, Беэр-лахай-рои (богосл. приоритет), Хова (Алалах Ḫbt). (2) **photos 20/20**: Лахай-рои (Wadi Zin spring), Урфа (пруд Балыклыгёль). (3) **SVG**: 18 анимированных звёзд над Харраном (SMIL animate, 3–8s, gold/white/blue); 5 рукавов Нила + glow; меридиан Иерусалима (Иез 5:5, opacity .06). (4) **Анимации**: tourProgressShine (progress bar переливается); tour .active class; sharePulse (⧉ ССЫЛКА пульс при открытии); stars reduced-motion guard. QA: 27/27 ✅ | 3613 строк | 339KB. |
| **AGENTS-r140** | 2026-06-13 | **Карта Авраама wave-14: bible_extra 19/19 + SVG регионы + ambient chord.** (1) **bible_extra ЗАКРЫТ для всех 19 мест**: Ур (Деян 7:2), Урфа (Берешит Рабба), Харран (Лех-леха три круга), Сихем (Ин 4 колодец), Бет-Эль (лестница→тельцы), Хеврон (Быт 18:25), Шалем (Акеда→Голгофа), Дан (война ради Лота), Содом (Иез 16:49 гордость), Хаммам (критерий Соф 2:9), Цоар (молитва меняет суд), Герар (язычник невиновен), Беэр-Шева (Эль Олам посреди боли), Кадеш (перекрёсток 3 эпох), Шур (первое явление ангела — рабыне), Лахай-рои (один источник двух встреч), Хова (ночной рейд); теперь отображается после bible. (2) **SVG**: Суэцкий залив, Едом שֵׂעִיר, Аббана/Барада אֲמָנָה, Вифлеем, Изреель. (3) **Ambient**: changeAmbientChord(i) — 8 тональностей (C/D/Bmin/Cmin/Amin/Bdim/Cmaj/D) с portamento .8s. (4) **CSS**: verse::before ❝, place-counter gold border, zoom-badge glow, cartouche z2 hide. QA: 21/21 ✅ | 3543 строки | 322KB. |
| **AGENTS-r139** | 2026-06-13 | **Карта Авраама wave-13: AiG/YEC аргументы + 18 мест с фото + Каркемиш/Алеппо/Эцион-Гевер.** Из MD (ABRAHAM-ARCHAEOLOGY-RESEARCH + OWNER-REQUIREMENTS): (1) **YEC/консерв.**: Содом — полная AiG 2022/2025 аргументация (Иез 16:46 «Содом к югу», Быт 10:19, Флавий, Мадабская карта, серо-битум юга); Хаммам — 5 пунктов against (Соф 2:9 «необитаем вовек», хронология 300-450 лет, AiG «Have we found Sodom? No», retraction 2025); Ур — note Ашшер ~2166 г. до н.э.; Источники: AiG + ARJ v5 + Ritmeyer + LOC Matson PD. (2) **Фото 18 мест**: Харран (2014), Дан (2011), Мамре (2010), Мория (2019+панорама), Zoar, Шур, Хова, Бет-Эль. (3) **SVG**: Каркемиш (כַּרְכְּמִישׁ), Алеппо (חָלֶב), Эцион-Гевер (עֶצְיֹן גֶּבֶר), Ассирия/Вавилония lbl, маршрут через Каркемиш. (4) **CSS**: normTxt NFD, photo cap, he-tab cur, he-word mob 20px, dispute/bib-note mobile, panel aria-label, cam 3 breakpoints, cap-dot glow. QA: 29/29 ✅ | 3461 строка | 304KB. |
| **AGENTS-r138** | 2026-06-13 | **Карта Авраама wave-12: spotlight + поиск highlight + 7 disputes + arrows + print.** (1) **bible_extra** для Египта (Рассказ Синухе, Бени-Хасан, Папирус Анастаси VI) и Дамаска (Элиэзер + два упоминания). (2) **Dispute** закрыт для Цоара (Гор эс-Сафи conf-hi), Герара (Тель Харор vs Джемме), Кадеша (Эйн эль-Кудейрат, уточнение: оазис/не телль) — итого 7 dispute-block. (3) **Spotlight**: radial glow при открытии маркера (scale .5→1, .5s), убирается при closePanel. (4) **Поиск highlight**: hlText() → mark с gold bg, CSS mark стиль. (5) **SVG**: Крит כָּפְתּוֹר, Вади Арава пунктир, стрелки течения рек (Иордан/Евфрат/Нил), terra incognita label. (6) **CSS**: soundPulse (ambient btn), pulseLot (lot-маркеры быстрее), goldRuleGlow (gold-rule 3s мерцание), life-tick::after dot, pfoot share pill, mHud improved, print styles, aria-live+aria-label, fog lighter. QA: 32/32 ✅ | 3406 строк | 295KB. |
| **AGENTS-r137** | 2026-06-13 | **Карта Авраама wave-11: иврит 19/19 + SVG шумер/Моав/fog-of-war + zoom + частицы.** (1) **Иврит закрыт для всех 19 мест**: Дамаск (דַּמֶּשֶׂק + Гута + Элиэзер), Урфа (אוּרְהַי + традиция огня Нимрода), Египет (מִצְרַיִם двойств. + יְאוֹר + типология). (2) **SVG**: шумерские города у Ура (НИППУР, УРУК, ЛАГАШ, АККАД, lbl-z2); Моав + Галаад; река Кишон; −430 м Мёртвого моря; треугольный контур Синая; mountainHatch на горах Заиорданья; fog-of-war overlay (восток/запад/юг). (3) **UX**: Tab underline sweep (::after scaleX 0→1); zoom badge «3.2×» в scalebar; Route idle breath (routeIdle 4s); Compass pan tilt (±1.5°); Particle CSS + 5 частиц в intro; CtxCard gold border+h3 underline; Modal gold border; Tooltip .vis+translateY; ::-webkit-scrollbar 4px gold; Panel drag-handle tap = close (mobile). QA: 30/30 ✅ | 3332 строки | 285KB. |
| **AGENTS-r136** | 2026-06-13 | **Карта Авраама wave-10: полнота иврита + ripple + 12 анимаций + SVG детали.** (1) **he_deep закрыт для всех 17 мест**: Хаммам (תַּל אֶל-חַמָּם), Цоар (самоэтимология Быт 19:20), Герар + Авимелех, Кадеш-Барнеа (три имени оазиса), Шур (египетская стена), Беэр-лахай-рои (первое явление ангела), Хова (единственное упоминание). (2) **Ripple при клике**: SVG circle r=8→28, opacity .6→0, цвет по типу маркера. (3) **12 новых CSS анимаций**: underlineSweep, hebGlow, storyBtnActivate, hintSlideDown, searchSlideIn, photoFadeIn, counterPop, chipShimmer, cartoucheBreathe, backKarty underline, counter rAF restart. (4) **SVG**: Нил יְאוֹר, Красное море יַם-סוּף, Персидский залив הַיָּם הַמִּזְרָחִי, Кипр כִּתִּים, Ханаан bbox, Кинерет green zone, Евфрат highlight glow. (5) **CSS полировка**: panel h2 underline sweep, heb glow, meta borders, chip cur gradient+glow, chipShimmer hover, kbd-help bg, hint gold border, timeline darker. QA: 43/43 ✅ | 3220 строк | 275KB. |
| **AGENTS-r135** | 2026-06-13 | **КРИТИЧЕСКИЙ БАГ кнопки intro исправлен + wave-9 SVG шедевр.** БАГ: #intro::before (звёздный паттерн) position:absolute;inset:0 без pointer-events:none перехватывал ВСЕ клики внутри intro — кнопка 'НАЧАТЬ КИНОТУР' не нажималась. ИСПРАВЛЕНИЕ: pointer-events:none на ::before; z-index:2 на .inner; z-index:3+pointer-events:auto на .go, .skip, .intro-story-btn; story-nav скрыт JS'ом на время intro. MOBILE INTRO: GO min-height 54px + goShine 3s pulse animation; SKIP 44px; staggered introFadeUp. SVG WAVE 9: Ливан с 3 снежными пиками + הַר לְבָנוֹן; Хермон הַר חֶרְמוֹן; Ярмук (приток); Лесбос+Хиос (Эгей); Via Maris стрелка; Персидский залив seaPattern; истоки Евфрата/Тигра; Компас PREMIUM (кольцо + 8 рисок + межкардинальные + центральный диск с glow); CTX hover glow; minimap gold border; caption enhanced bg. GSAP: trade routes drawSVG при загрузке. QA: 29/29 ✅ |
| **AGENTS-r134** | 2026-06-13 | **Карта Авраама wave-8: SVG шедевр — фильтры воды, картуш, паттерны, 15 premium анимаций.** (1) **SVG фильтры**: feDisplacementMap + анимированный feTurbulence (baseFrequency осциллирует 14s) → живая вода Средиземного; goldGlow/neonGlow для маршрутов; terrainTex для суши. (2) **SVG паттерны**: mountainHatch (45°), desertStipple (3 точки, покрывает Аравию), seaPattern (волны на Средиземном+Красном), caravanGrad radial. (3) **Декор**: картуш LEGENDA (антикварный с полной легендой), угловые орнаменты map frame, координатная сетка (15 faint gold lines, opacity .04), 5 анимированных звёзд (ночной режим). (4) **Animated trade routes**: Via Maris dashOffset 0→-28 (3s), Царская дорога 0→+28 (4s). (5) **15 CSS анимаций**: markerEntrance staggered, headerSweep, contentFade, routePulse, compassBob, mmRectPulse, toastIn, introFadeUp 6-уровневый stagger, progressGlow. (6) **GSAP**: маршруты с goldGlow при DrawSVG, glow исчезает за .8s; caravan trail (ring glow + dot, opacity tween). (7) **Рельеф**: гранитные горы Синая, заливные луга Иордана, Кинерет с паттерном+бликом, Красное море с волнами. QA: 39/39 ✅ | 3009 строк | 255KB. |
| **AGENTS-r133** | 2026-06-13 | **Карта Авраама wave-7: топ мобайл — touch 44px + bottom sheet + SVG шедевр.** (1) **Touch targets WCAG AA**: все кнопки ≥44px на мобайле (.btn 44, closeP 44, pm-x 48, pfoot 44, backKarty 44, story-btn 36, stage-chip 130, tab 42, pl-item 44, life-tick 22, life-nav 48, pfoot-arrows 52). (2) **Panel bottom sheet**: на ≤760px панель выезжает снизу (92svh, border-radius 22px, drag handle ::after, translateY). (3) **Active states**: scale(.94) на btn/story-btn, scale(.97) на chip, scale(.96) на arrows — чёткий клик. (4) **Long-press 500ms**: haptic(25ms) + hover preview на маркерах. (5) **iOS**: -webkit-overflow-scrolling touch, -webkit-appearance none, font-size 16px на inputs, search modal снизу. (6) **will-change** на panel/caption/pulse/marker. (7) **SVG**: skyG атмосфера, Тавр/Загрос горные хребты, волны Средиземного, соляной берег Мёртвого моря, dashed halo на кандидатах, valleyG Иордан. (8) **Caption dots**: 8 точек прогресса кинотура. (9) **tn-item full-width** мобайл + img 160px. (10) **reduced-motion**: shimmer + starsDrift отключаются. QA: 48/48 ✅ |
| **AGENTS-r132** | 2026-06-13 | **Карта Авраама wave-6: визуальный шедевр + прогресс тура + счётчик мест + a11y + SVG острова.** (1) **Визуал**: intro — звёздный паттерн (starsDrift 60s) + gold glow на иврите; panel header — золотая полоска 3px ::before; verse — border-radius 0 8px 8px 0; note — border-left 3px; bib-note — ✦ звезда + gradient; he-block — border-top 2px + shadow; btn hover — glow 12px gold; маркер active — drop-shadow filter; route hot — stroke 3px; stage chip — text-shadow; pulse — улучшен 0.35→1.65. (2) **#tourProgress**: золотая полоска внизу экрана, растёт с 0 до 100% по мере кинотура, сбрасывается при stopTour. (3) **Счётчик места**: pill «X из Y» над кнопками prev/next (story-aware); сбрасывается при closePanel. (4) **Skeleton loader**: shimmer анимация на img; loaded class отключает по onload. (5) **A11y**: focus trap в photoModal; focus на ✕ при открытии; Esc priority. (6) **SVG**: Кармил (הַכַּרְמֶל), горы Самарии/Иудеи (6 пиков), река Оронт, Родос (Ρόδος), Крит, дюны Аравии (волнистый паттерн), Синай со снежной шапкой, Нил с 3 рукавами дельты, minimap active-place mmPulse. (7) **Фото** расширены до 13 мест: Герар, Кадеш, Дамаск. QA: 36/36 ✅ |
| **AGENTS-r131** | 2026-06-13 | **Карта Авраама wave-5: фото-галерея then/now + UI баги + SVG рельеф (из исследования ABRAHAM-ARCHAEOLOGY-RESEARCH-2026-06-13.md).** (1) **Photos[]** — 10 маркеров получили массив фотографий (Wikimedia CC/PD, NASA PD): Ур (зиккурат USAF + раскопки Вулли PD), Харран (конические дома), Сихем (NPAPH 1957), Хеврон/Мамре (Махпела), Дан («Ворота Авраама» ~1750 до н.э.), Содом (реальная соляная колонна горы Содом CC BY-SA 2020 + Баб эд-Дра c dis-тегом + retraction disclaimer), Талл эль-Хаммам (раскопки Коллинза), Беэр-Шева (UNESCO + жертвенник), Египет (NASA PD орбита), Шалем/Мория (Купол Скалы). (2) **renderPhotos() + openPhotoModal()**: галерея в вкладках СЮЖЕТ/АРХЕОЛОГИЯ; полноэкранный модальный просмотр с кредитами, «спорная локализация» для dis-типа. CSS: .tn-gallery/.tn-item/.tn-label (then/now/ctx/dis). CSP расширен: nasa.gov. (3) **UI баги**: #tabs overflow-x (4 вкладки без переполнения), .tab flex:0 0 auto (не сжимаются), Esc priority (photoModal перехватывает Esc первым), p-stage-hint фон, story-toast top:52px мобайл. (4) **SVG**: «ПЛОДОРОДНЫЙ ПОЛУМЕСЯЦ» label, соляная текстура Мёртвого моря, компас с W/E стрелками. QA: 45 passed · 0 errors |
| **AGENTS-r129** | 2026-06-15 | **Overflow fix Kod Da Vinchi QA: `npm run audit-pro` 154 passed · 0 errors, `npm run validate:all` ✅, strangler build 23 Astro + 423 legacy pages, dist smoke 24/24 overflow=0. | + Astro CSS hardening + smoke test fix + karty/_shared API docs.** Smoke audit обнаружил horizontal overflow 266px desktop / 931px mobile на Astro-странице `/articles/kod-da-vinchi/`. root cause: Wikimedia IMG 1280px без `max-width:100%` переполнял `.astro-main`. Fix: `src/styles/global.css` — добавлены `img{max-width:100%;height:auto;display:block}` и `html{overflow-x:hidden;scrollbar-gutter:stable}`. Также пофикшен MDX-контент: 15 пунктов списка дат в `kod-da-vinchi.mdx` сливались с описанием без пробелов (`36739-е` → `367 — 39-е`). AGENTS.md r126-r128 получили machine-readable claims `154 passed · 0 errors`. Добавлена документация `karty/_shared/README.md`: MapEngine API, Route JSON Schema, координатная система. Исправлен false-positive в `dist-smoke-audit.js`: negative overflow (страница уже viewport'а из-за спрятанного scrollbar) теперь корректно = 0. QA: `npm run audit-pro` 154 passed · 0 errors, `npm run validate:all` ✅, strangler build 22 Astro + 423 legacy pages, dist smoke 22/22 overflow=0, URL contract 42/42, SW dist readiness passed. |
| **AGENTS-r130** | 2026-06-15 | **QA gates sweep + deploy-switch prep + dangerous branch audit.**
| **AGENTS-r131** | 2026-06-15 | **Astro shadow-pilot baptisty-rossii index (series hub) + write_file path fix.** Created `src/pages/baptisty-rossii/index.astro` — the main series landing page for «Баптисты России» with full SEO (CollectionPage JSON-LD, breadcrumbs, OG, canonical), summary-card (3-point how-to-read), note-box linking to 3D map, 10-part grid using existing `h-article-*` CSS from site.css (no Tailwind, no gbs2-world JS), research section. Key discovery: write_file tool was creating files at `/home/user/home/user/gb-refactor/...` double-path — file was moved to correct `src/pages/baptisty-rossii/index.astro`. page-ownership.json updated (25 routes). Build: 24 Astro pages, 422 legacy files copied. QA: audit-pro 154 passed · 0 errors, page-ownership:dist passed, dist-smoke 24/24 overflow=0. | Full strangler pipeline verified: `audit-pro` 154 passed · 0 errors, `validate:all` ✅, strangler build 23 Astro + 423 legacy pages, dist-smoke 24/24 overflow=0 (all desktop+mobile viewports), url-contract 42/42 baseline match, SW dist readiness passed. Legacy overflow audit: all 5 nagornaya/chast pages and all 11 baptisty-rossii pages verified overflow=0 at 1366×900 desktop. `feat/gbs-reference-v3` branch analyzed: deletes critical infrastructure (karty/avraam 4777 LOC, karty/_engine/map-engine.js 646 LOC, karty/_shared/, migration/page-ownership.json, all docs/refactor-2026/, _build-tools/konfessii-baptizm/) — DO NOT MERGE. AGENTS.md changelog: removed duplicate r128/r129/r130 rows from 2026-06-13 (superseded by r129 2026-06-15 + unnamed row); fixed r131 QA claim format to satisfy G103 machine-readable check. Deploy-switch prep: pagefind:build:dist completed (16 pages indexed, /pagefind/pagefind.js present in dist), sw:dist:audit:deploy-switch shows only expected CACHE_VERSION advisory. Runbook verified: docs/refactor-2026/DIST_DEPLOY_SWITCH_RUNBOOK_2026-06-15.md complete. QA: `npm run audit-pro` 154 passed · 0 errors, `npm run validate:all` ✅, `npm run avraam:audit` 51/51, `npm run konfessii:audit` I1-I14 green. |
**Historical note:** 2026-06-15 also included a 3D Russian Baptist map UX pass: Timeline landmark-mode, softer map highlight, wheel-capture and no native button titles. That work was completed in the iframe app and guarded by `konfessii:audit`; it remains part of project history but is intentionally kept outside the AGENTS changelog table so the table stays machine-readable.

| **AGENTS-r126** | 2026-06-13 | **3D-карта баптизма: исправлены визуальные баги по скринам владельца — scrollbar/Timeline-noise/native tooltips/raycast blocking.** По скринам 14:53–14:54 найдено: правый document-scrollbar перехватывал wheel вместо zoom, Timeline давал шумное скопление точек и белые браузерные `title` tooltip, крупные близкие декоративные glows/кольца могли мешать выбрать дальний узел. Исправления: (1) fullscreen 3D lock `html/body{overflow:hidden}` + restore on unmount; (2) Timeline ticks сгруппированы по году, minor-события приглушены, native `title` удалён (только aria-label); (3) node hit target уменьшен, decorative children raycast-disabled, клики ловит компактный `interactiveHit`; (4) `konfessii:audit` усилен source guards на scroll lock, declutter/no-title, raycast hygiene. R&D doc обновлён. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit` live Chromium/WebGL, `validate:all`, `audit-pro` green. |
| **AGENTS-r125** | 2026-06-13 | **3D-карта баптизма: маршруты углублены до мини-storyboard.** В нижнем роутере активный маршрут теперь показывает не только summary и chips, но и блок `Сейчас в маршруте`: текущий узел, его год, краткое описание и следующий шаг/тип связи (`transitionLink.label`). Chips получили более информативные title (год + описание узла). Это продолжает паттерн progressive disclosure/details-on-demand: маршрут объясняет, где пользователь находится и куда идёт дальше, без расширения dossier и без новых тяжёлых визуальных эффектов. `konfessii:audit` усилен source guard на storyboard context. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit`, `validate:all`, `audit-pro` 154 passed · 0 errors. |
| **AGENTS-r124** | 2026-06-13 | **3D-карта баптизма: Timeline теперь синхронизирует граф, маршрут и географию.** Продолжение UX-углубления без акцента на Drive: добавлен единый `TIMELINE_TARGETS` (промежуточный data-driven слой до будущих `nodeId/routeId/mapSelectionId` в `timeline.ts`), `handleTimelineEventSelect` теперь не только перелетает к узлу, но и активирует релевантный маршрут/шаг и подсвечивает связанную географию через `findMapSelectionForNode` (Тифлис/Петербург/Москва/Украина/Грузия и т.п.). Это реализует паттерн focus+context: событие времени → узел → маршрут → карта Евразии. `konfessii:audit` усилен source guard, что Timeline синхронизирует map selection. R&D-документ обновлён. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit` source/live passed, `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r123** | 2026-06-13 | **3D-карта баптизма: R&D best-practices doc + тихий learning coach первого входа.** По запросу владельца («не делать сверхакцент на Drive, искать топовые идеи на июнь 2026») создан специализированный документ `_build-tools/konfessii-baptizm/3D-RD-BEST-PRACTICES-2026-06-13.md` с 30+ ссылками и выводами по WebGL/3D graph UX, progressive disclosure, interactive timelines, spatial design, performance-aware Three.js/postprocessing. В 3D добавлен ненавязчивый блок «Как читать карту» (показывается только на desktop, когда нет фокуса/маршрута/раскрытого роутера): объясняет 3 шага чтения карты и даёт CTA «Маршруты»/«Карта». Это реализует паттерн overview → route/timeline/map → details-on-demand без перегруза интерфейса. `konfessii:audit` усилен I10 (source+live guard learning coach). Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit` live Chromium/WebGL passed, `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r122** | 2026-06-13 | **3D-карта баптизма: следующий UX-проход — Timeline ticks фокусируют узлы, маршруты стали кликабельной цепочкой.** На базе R&D по современным паттернам WebGL/инфовизуализации (overview → zoom/filter → details-on-demand, progressive disclosure, interactive timelines, focus+context) сделаны малые безопасные улучшения без расширения dossier: (1) Timeline ticks стали кнопками с `title`/`aria-label`; клик по событию выставляет год и, если событие распознано по ключевым словам, перелетает к соответствующему 3D-узлу (Воронин/Кальвейт/Павлов/Пашков/ВСЕХБ/СЦ/РС ЕХБ и др.); (2) active route в нижнем роутере получил micro-copy «Нажмите этап…» и кликабельную цепочку шагов, каждый chip перелетает к узлу маршрута; (3) source-аудит I8/I9 усилен проверками `onEventSelect`, `handleTimelineEventSelect`, `onRouteStepTo` и кликабельных route step chips. Пересборка Vite singlefile → `_app/index.html`. QA: live `npm run konfessii:audit` Chromium/WebGL passed, `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r121** | 2026-06-13 | **3D-карта баптизма: UX-улучшения Timeline/маршрутов + Drive-source lock.** По запросу владельца продолжен аккуратный проход после фикса `timelineYear is not defined`: (1) в документацию добавлена прямая ссылка на Google Drive React/Vite ZIP-исходник (`react-vite-tailwind`), чтобы будущие агенты сверяли не минифицированный бандл, а `src/components/MindMap3D.tsx` и `src/data/history/*`; (2) событийная карточка Timeline теперь всегда показывает русскую категорию + название + краткое описание события, а ticks на шкале стали кликабельными кнопками с title/aria-label; (3) нижний роутер «Маршруты и города» получил понятный active-route summary, счётчик этапов и компактную цепочку узлов маршрута, а кнопки маршрутов показывают число этапов и summary в title; (4) status-bar активного маршрута показывает текущий узел и подсказку по стрелкам; (5) ширина full dossier НЕ расширялась — Drive-исходник подтвердил канонические 300/320px, поэтому проблему «узко» дальше искать в состояниях/line-clamp/auto-collapse, не простым растягиванием. Пересборка Vite singlefile → `_app/index.html`. QA: `npm run konfessii:audit` live Chromium/WebGL passed (I1–I9), `validate:all` green, `audit-pro` 152 passed · 0 errors. |

Older changelog rows **AGENTS-r77–r120** archived to `docs/AGENTS-CHANGELOG-ARCHIVE-2026-06-14.md` to keep this instruction file scannable; normative rules below remain authoritative.

**Владелец:** Фёдор Милованов (редактор/автор-редактор, не «автор»)
**Прод:** https://gospod-bog.ru · GitHub Pages из ветки `main`
**Node:** требуется `>=22.12.0` (Astro 6 scaffold; legacy scripts также проверены на Node 22 в CI)

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ **Создавать новые CSS/JS файлы.** Архитектурный максимум: **5 CSS + 1 шрифтовой + 11 JS**. Список фиксирован, см. §2.
2. ❌ **Менять byline на «Автор: Фёдор Милованов».** Только `Автор-редактор:` (тип A/B) или `Редактор:` (тип C — переводы). См. §3.1.
3. ❌ **Возвращать `AI-disclosure`.** Удалён 2026-06-02 (`AGENTS-r11`), повторно удалён в PLAN-04 (CSS-остатки). Об ИИ — только на `/about/`.
4. ❌ **Запускать `prettier --write .` или `eslint --fix .`** по всему дереву. Только точечно.
5. ❌ **Обновлять зависимости в `package.json`** без явного запроса.
6. ❌ **Удалять/переименовывать `?v=...` хеши.** Они генерируются `scripts/cache-bust.js`. После любой правки CSS/JS — запусти `npm run cache-bust`.
7. ❌ **Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.** Это контракт разметки.
8. ❌ **Создавать в корне репо `.patch`, `*.py`, `*.tsx`, `src/components/*`** — статический сайт без сборщика, см. §10.
9. ❌ **Дублировать `<meta og:*>`.** Один `og:image` per page. JPG-fallback — только если `.jpg` файл реально есть на диске.
10. ❌ **Создавать legacy-кнопки** `.theme-float-btn`, `#themeFloat`, `#gbSearchFloat`, `.nag-theme-btn`. Удалены в PLAN-04 P5. Единственный canonical блок плавающих контролов — `gbFloatingControls` (`js/site.js` модуль 29), классы `.gb-fc-theme` / `.gb-fc-search`.
11. ❌ **Добавлять новые `!important` без анализа конкурента.** См. §4.2 — обязательный 5-шаговый чеклист.
12. ✅ **После любой правки CSS/JS** → `npm run cache-bust`.
13. ✅ **Перед коммитом** → `npm run validate:all` + `node scripts/audit-pro.js`. Оба должны быть PASS. Эти проверки теперь включают Russian quote policy guard; подробные правила — в `docs/EDITORIAL-SOURCE-POLICY.md`.
14. ❌ **Не оставлять английские прямые цитаты в русских статьях.** Названия книг/статей, URL, DOI и библиографические данные могут быть на английском; цитируемые мысли, прямые речи и сильные фразы автора в теле русской статьи должны быть переведены на русский. Оригинал можно давать только ссылкой на источник, не вставляя англоязычную цитату в текст.

---

## 1. О проекте

Христианский богословский сайт со статьями, биографиями, серией «Нагорная проповедь» (5 частей), серией «Тёмная сторона кафедры» (pastor-series), серией о Джоне Гилле (5 текстов), статьями о Коде да Винчи / герменевтике / Иеремии и др.

**Стек:** статический HTML + CSS + JS, без сборщика, без TypeScript, без React.
**Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`.
**Поисковая индексация:** `.github/workflows/indexnow.yml` уведомляет Яндекс/Bing при push в main.
**Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` открывает GitHub issue (label `ci-failure`).

### 1.1 Целевые браузеры

| Платформа | Браузер | Минимальная версия |
|---|---|---|
| Desktop | Chrome / Edge | 90+ |
| Desktop | Firefox | 90+ |
| Desktop | Safari | 15+ |
| Mobile | iOS Safari | 15+ |
| Mobile | Android Chrome | 90+ |
| Mobile | Samsung Internet | 16+ |

CSS-фичи, не поддерживаемые в этих версиях (`color-mix()`, `grid-template-rows: 0fr`, `:has()`), **обязаны** иметь `@supports`-fallback или каскадный fallback (`property: rgb(...); property: color-mix(...);`).

### 1.2 Метрики качества

| Метрика | Цель |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| `audit-pro` | ✅ PASSED, errors = 0 |
| `validate:all` | ✅ 0 errors, 0 warnings |
| `tokens:check` | ✅ 0 / 0 |
| `visual-audit` (Playwright) | 0 console-errors, 0 network-errors |
| CSS `!important` в `site.css` | цель **≤ 200**; авто-потолок в `audit-pro.js` (сейчас 270, ratchet вниз) |

---

## 2. Архитектура — единственно верная

```
/
├── index.html                      ← главная
├── 404.html                        ← страница ошибки
├── sw.js                           ← Service Worker
├── manifest.json                   ← PWA
├── feed.xml                        ← RSS
├── robots.txt, sitemap.xml         ← SEO
├── llms.txt                        ← правила для LLM
├── AGENTS.md                       ← ⭐ ЭТОТ файл
├── README.md                       ← пользовательская архитектурная документация
├── AUDIT_HISTORY.md                ← консолидированный changelog аудитов
├── CNAME                           ← gospod-bog.ru
│
├── package.json                    ← build-скрипты, без рантайм-зависимостей
├── .github/workflows/              ← deploy.yml + indexnow.yml + notify-on-failure.yml
│
├── css/                            ← РОВНО 5 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← только главная + каталоги (hero, dashboard)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   ├── mobile-hotfix.css           ← мобильные производительные hotfix-правки
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление Нагорной проповеди
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 11 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, quiz, tooltips, gbFloatingControls)
│   ├── site-utils.js               ← утилиты, доступные отдельным страницам
│   ├── scroll-perf.js              ← производительность scroll/observers
│   ├── search.js                   ← Ctrl+K поиск (CommandPalette)
│   ├── enhancements.js             ← scroll-эффекты, lazy load, ambient phrases
│   ├── highlights.js               ← подсветка текста, заметки
│   ├── glossary.js                 ← глоссарий богословских терминов
│   ├── bookmark-engine.js          ← закладки (localStorage)
│   ├── series-cards.js             ← карточки серий
│   ├── nagornaya-mobile-toc.js     ← мобильное TOC для проповеди
│   └── sw-register.js              ← регистрация Service Worker
│
├── data/                           ← JSON-данные для рантайма
│   ├── glossary.json               ← термины глоссария
│   ├── search-manifest.json        ← индекс поиска
│   ├── series.json                 ← карточки серий
│   └── strategic-map-antisovetov.json  ← MAP_DATA для 20-antisovetov-pastoru
│
├── articles/                       ← статьи (каждая = папка с index.html)
│   ├── index.html                  ← каталог всех статей
│   ├── 20-antisovetov-pastoru/
│   ├── dzhon-gill-chast-1-chelovek/
│   ├── dzhon-gill-chast-2-uchenyi/
│   ├── dzhon-gill-chast-3-nasledie/
│   ├── dzhon-gill-istoricheskiy-kontekst/
│   ├── dzhon-gill-spravochnik/
│   ├── hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
│   ├── kod-da-vinchi/
│   └── krajne-li-isporcheno-serdce/
│
├── nagornaya/                      ← серия «Нагорная проповедь»
│   ├── chast-1/ ... chast-5/       ← 5 частей
│   ├── istochniki/                 ← библиография
│   ├── nakhodki/                   ← находки
│   ├── seriya/                     ← обзор серии
│   ├── tw.min.css                  ← Tailwind (НЕ ТРОГАТЬ — отдельная генерация)
│   └── index.html                  ← обзор серии
│
├── about/, pastor-series/, biografii/   ← статичные разделы
│
├── scripts/                        ← build-инструменты (Node.js)
│   ├── cache-bust.js               ← ⭐ генерит ?v=... хеши
│   ├── validate.js                 ← валидация HTML/JSON/манифестов
│   ├── audit-pro.js                ← главный аудит (запускать перед каждым push)
│   ├── seo-audit.js                ← SEO-проверки
│   ├── visual-audit.js             ← Playwright скриншоты + console/network errors
│   ├── update-meta.js              ← обновление meta-тегов
│   ├── check-design-tokens.js      ← валидация дизайн-токенов
│   ├── deep-check.js, _audit-deep.js  ← глубокий аудит (внутренние)
│   ├── download-fonts.js           ← скачка шрифтов
│   ├── build-avif.sh               ← конвертация в AVIF
│   └── resize_og.py                ← рескейл OG-картинок (Pillow)
│
├── audit/                          ← последние audit-pro отчёты + AUDIT_CLEANUP_PLAN
└── images/                         ← все изображения
```

### Запрещено создавать новые CSS-файлы

У сайта **ровно 5 CSS + 1 шрифтовой**. Каждый файл = отдельный HTTP-запрос на статическом хостинге без bundler'а. Новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Общие компоненты, статьи, шапка, тёмная тема | `site.css` |
| Главная + каталоги (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильные hotfix touch-pointer overrides | `mobile-hotfix.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для Нагорной | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ) |

### Запрещено создавать новые JS-файлы в `js/`

Все 11 файлов — фиксированный набор. Новая логика идёт **внутрь существующего** файла по теме (если ничего не подходит — в `enhancements.js`).

---

## 3. PROTECTED — не трогать без письменного разрешения

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **автор-редактор** оригинальных статей и **редактор** переводов. **НЕ «автор»** в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | `.author-card-label` | Карточки в каталогах |
|---|---|---|---|
| Тип A — авторская статья | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип B — авторская серия / разбор | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип C — перевод зарубежной статьи | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |

#### Meta-теги:

- **Тип A/B:** `<meta name="author" content="Фёдор Милованов">` + `<meta property="article:author" content="Фёдор Милованов">`.
- **Тип C:** `<meta name="author" content="Имя оригинального автора">` + `<meta name="translator" content="Фёдор Милованов">` + `<meta property="article:author" content="Имя оригинального автора">`.

#### feed.xml для всех типов:

```xml
<dc:creator>Фёдор Милованов</dc:creator>
```

### 3.2 JSON-LD структура

В каждой статье есть `<script type="application/ld+json">` с `Article` (или `ScholarlyArticle` для переводов) + `BreadcrumbList` + `Person` (автор оригинала или Фёдор как редактор). **Не упрощать, не «оптимизировать», не удалять.** Это критично для SEO.

Для переводов:
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 3.3 OpenGraph + Twitter Card теги

В каждой `index.html` статьи есть полный набор `<meta property="og:*">`. Не удалять, не сокращать «для чистоты». **Один `og:image` per page.** JPG-fallback можно ставить ТОЛЬКО если файл `images/<name>.jpg` реально существует.

### 3.4 Service Worker и cache-bust

Версии файлов в HTML:
```html
<link rel="stylesheet" href="css/site.css?v=2223865f">
<script src="js/site.js?v=54e3f377"></script>
```

Хеши — **CRC32 содержимого файлов**, генерируются `scripts/cache-bust.js`. **Не трогать руками.** После правки CSS/JS — обязательно `npm run cache-bust`.

`CACHE_NAME` в `sw.js` также пересчитывается автоматически.

### 3.5 Структура Нагорной проповеди

Серия = 5 частей + 3 вспомогательных страницы (`istochniki`, `nakhodki`, `seriya`). Внутри каждой части — `<aside class="article-toc">`. **Не упрощать TOC, не сжимать вёрстку, не удалять подключение `tw.min.css`** в Нагорной.

`tw.min.css` — минифицированный Tailwind, генерируется отдельно от основного проекта. Если нужен новый Tailwind-класс в `nagornaya/chast-*` — обратись к владельцу для регенерации.

### 3.6 Изображения

| Правило | Подробнее |
|---|---|
| **Формат** | `.webp` основной; `.png/.jpg` — backup, не для `<img>` напрямую |
| **Размеры** | Обязательно 3 ширины: `600w`, `900w`, `1200w` |
| **Именование** | `images/<name>.webp`, `images/<name>-600w.webp`, ... |
| **Качество WebP** | 82–85% |
| **OG** | один `og:image` per page; JPG-fallback только если файл реален |

### 3.7 Создание новой статьи — требования к качеству (ОБЯЗАТЕЛЬНО)

При создании новой статьи (или значительном обновлении существующей) **обязательно** соблюдать следующие правила качества:

#### 3.7.1 Тултипы и глоссарий
- **Все** исторические названия (города, территории, законы, институты, события) должны быть обёрнуты в `<span class="gterm" data-term="..." data-term-title="...">...</span>`.
- **Все** сложные богословские, герменевтические, раввинистические и апологетические термины должны иметь тултип.
- Пояснения должны быть **не поверхностными** — минимум 1–2 предложения, понятных рядовому читателю, без упрощения до примитива.
- Примеры исторических терминов, требующих тултипа: Кеттеринг, Хорслидаун, Саутварк, Акт о корпорациях, Gin Craze, Банхилл-Филдс, Приорат Сиона, Никейский собор, гностики и т.д.

#### 3.7.2 Квизы
- Каждый квиз должен содержать **минимум 1–2 вопроса по терминологии и понятиям** (не только по фактам и сюжету).
- Все вопросы обязаны иметь `explanation.short` + `explanation.full`.
- `explanation.full` должен давать **глубокое богословское/историческое/методологическое объяснение**, а не просто «верно/неверно».
- Вопросы должны быть **адаптированы под тематику статьи**:
  - Биографии → акцент на личность, решения, контекст.
  - Экзегетика/герменевтика → акцент на метод, термины, аргументацию.
  - Апологетика → акцент на факты, критерий затруднения, контраргументы.
  - Антропология/доктрина → акцент на понятия, различения, богословские нюансы.

#### 3.7.3 Общий принцип
- Статья должна быть **самодостаточной** для читателя без богословского образования.
- Если термин или историческая реалия встречается в статье — читатель должен иметь возможность понять его значение **не выходя из статьи** (через тултип).
| **figcaption** | НЕ вставлять `<span class="ai-note">` или «Изображение сгенерировано ИИ». Прозрачность — только на `/about/`. |

#### Шаблон `<picture>`:

```html
<figure class="article-img wide reveal">
  <picture>
    <source srcset="../../images/<name>-600w.webp 600w,
                    ../../images/<name>-900w.webp 900w,
                    ../../images/<name>-1200w.webp 1200w"
            sizes="(max-width: 640px) 92vw, 1200px" type="image/webp">
    <img src="../../images/<name>.webp" alt="…"
         width="1200" height="630" loading="lazy" decoding="async">
  </picture>
  <figcaption>Подпись без упоминания ИИ.</figcaption>
</figure>
```

---

## 4. CSS-правила

### 4.1 Каскад

Порядок подключения CSS в `<head>` (не менять):

1. `fonts/fonts.css` (preload + stylesheet)
2. `css/site.css`
3. `css/home.css` (на главной и каталогах)
4. `css/command-palette.css`
5. На Нагорной — **сначала** `nagornaya/tw.min.css`, **потом** `site.css` (Tailwind обязан грузиться раньше — site.css перебивает его по каскаду).

### 4.2 `!important` — обязательный чеклист перед добавлением

**Текущее состояние (2026-06-04, после PLAN-04):**

| Файл | `!important` | Назначение |
|---|---:|---|
| `site.css` | **270** ⚠️ | цель ≤200; потолок `IMPORTANT_CEIL` в audit-pro (только вниз) |
| `home.css` | 20 | OK |
| `command-palette.css` | 7 | OK |
| `mobile-hotfix.css` | 74 | touch / pointer:coarse overrides — легитимно |
| `nagornaya-mobile-toc.css` | 122 | Tailwind override на nagornaya-page — легитимно |

**Корректный подсчёт:** `grep -o '!important' file | wc -l` (НЕ `grep -c` — он считает строки).

#### 5-шаговый чеклист перед добавлением нового `!important`:

1. **Найди конкурента.** `grep -nE 'твой-селектор' css/*.css`.
2. **Рассчитай specificity** обоих правил (id=100, class=10, element=1).
3. **Если твоё выше** → `!important` не нужен; используй каскад.
4. **Если ниже** → увеличь специфичность через дополнительный класс/id/атрибут (например, `body.your-page .selector` или `.parent .selector`).
5. **`!important` оправдан ТОЛЬКО для:**
   - `@media print`
   - `@media (prefers-reduced-motion: reduce)`
   - `@media (forced-colors: active)`
   - `@media (scripting: none)` — no-JS fallback
   - Tailwind override на nagornaya (если selectivity не помогает)
   - Defensive disable (`display: none !important`) для скрытия legacy/повреждённого элемента
   - Внутри `@layer components/utilities` — для перебивания правил вне layer (правила вне `@layer` имеют выше priority по spec)

**Если уже есть `!important` на том же селекторе/свойстве — исправь существующий, не добавляй второй.**

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS в `site.js`).

| Правило | Пример |
|---|---|
| ✅ Используй переменные | `color: var(--color-text)`, `background: var(--color-bg)` |
| ❌ Не хардкодить `#fff`, `#000` | искл.: фолбэки в `color-mix(in srgb, ... var(--color-x, #fff))` |
| ✅ `html.dark` всегда | НЕ просто `.dark` — JS выставляет именно `html.dark` |
| ✅ `color-mix()` fallback | Сначала простое значение, потом `color-mix` ниже — каскад перебивает |

### 4.4 CSS Integrity Rules — анти-регрессия

Эти правила введены после серии регрессий май-июнь 2026 (см. AUDIT_HISTORY).

1. **`html.dark` — всегда, никогда просто `.dark`.** Класс `.dark` на body не используется.

2. **Дублирование top-level селекторов запрещено.** Перед добавлением правила для `.foo` — `grep ".foo"` по файлу. Найдено → расширяй существующее, не добавляй новый блок. PLAN-04 P1+P1b слили 9 настоящих дублей.

3. **Пустые правила `{}` — мусор, удалять.** Допустимо только намеренное `:empty` с пояснительным комментарием.

4. **Двойное свойство в одном блоке — первое мёртво.** Два `box-shadow`, два `color` в одном `{}` — первый всегда перебивается. Удаляй его. **Исключение:** color-mix fallback pattern (`color: #fff; color: color-mix(...);`) — это намеренно.

5. **`:hover` с важным эффектом — только внутри `@media (hover: hover) and (pointer: fine)`.** Без guard — срабатывает на тапе (iOS/Android). Исключение: декоративные opacity/color, не меняющие layout.

6. **Переключатель темы — singleton.** Три канонических места:
   - `.theme-toggle` (absolute, в статьях рядом с breadcrumbs)
   - `.gb-fc-theme` (FAB через `gbFloatingControls` site.js модуль 29)
   - `.bar-icon-btn[data-action=theme]` (bottom-bar, mobile)

   ❌ Не создавать четвёртую: `.theme-float-btn`, `#themeFloat`, `.nag-theme-btn` — всё удалено в PLAN-04 P5.

7. **Tooltip — три канонических вида, один контроллер.**
   - `.gterm > .gtip` (глоссарий)
   - `.fn-marker > .tooltip` (академические сноски)
   - `.bref > .btip` (Библейские ссылки)

   Контроллер: `SiteUtils.makeTooltipController()` (единственная реализация).
   ❌ Не добавлять четвёртый тип tooltip с другими классами/позиционированием.

   **Модификатор `.fn-marker--dove`** — это НЕ четвёртый тип, а вариант `fn-marker`
   (та же `.tooltip`, тот же контроллер), у которого числовой маркер заменён на иконку
   голубя. Глиф рисует JS: функция `e()` в `js/site.js` инжектит inline-SVG
   `<svg class="fn-dove-icon">` (тело `.fn-dove-body` + отдельное крыло `.fn-dove-wing`).
   `::before` в CSS — это no-JS фолбэк (статический голубь), он скрывается, когда JS
   проставил `data-gb-dove-ready`. Крыло машет на hover (`@keyframes fn-dove-flap`,
   только `@media (hover:hover) and (pointer:fine)`, отключается при `prefers-reduced-motion`).
   ❌ Не возвращать инлайновый `<svg class="fn-dove-icon">` в HTML статей — JS инжектит его сам
   (audit-pro это проверяет и упадёт).
   ⚠️ **Все inline-маркеры закрывай явно** (`<span ...></span>`). `.fn-marker--dove` —
   `display:inline-flex`; незакрытый `<span>` «проглатывает» следующие `<p>/<h4>`, делая их
   flex-детьми → горизонтальный overflow. То же с «eyebrow»-лейблами `<span style="display:inline-flex">`.
   После правок контента/CSS прогоняй **visual-audit** (Playwright) — он ловит overflow и контраст:
   `python3 -m http.server 8080 & ; sudo npx playwright install-deps chromium ; AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → должно быть `0 raw bugs`.

8. **CSS-переменные — не объявлять «про запас».** Объявленная в `:root` переменная без `var(--...)` нигде = мёртвый код, удалить.

9. **Мёртвый компонент = удалить.** Если класс нигде в HTML/JS не используется (включая динамическую конкатенацию в JS `'class--' + variant`) — удалить CSS-правила. PLAN-04 P5-P7 удалил `.theme-float-btn`, `.ai-disclosure`, `.fx-lift`, `.epilogue-*`, `.float-fallback`, `.sd-url-strip/divider/copy/label-default`, `.article-img--portrait-wide`, `.card.fx-lift` и др.

10. **`!important` лимит для `site.css` — цель ≤ 200, жёсткий потолок задан в `audit-pro.js`.**
    Теперь это **автоматическая проверка** (`IMPORTANT_CEIL` / `IMPORTANT_GOAL` в `scripts/audit-pro.js`):
    - выше `IMPORTANT_CEIL` → **ERROR** (audit падает, push блокируется);
    - выше `IMPORTANT_GOAL` (200) но в пределах потолка → **WARNING** (продолжай гасить долг).
    Потолок — храповик: **только вниз**. Снизил `!important` — снизь и `IMPORTANT_CEIL`.
    Ручная проверка: `grep -o '!important' css/site.css | wc -l`.
    История: PLAN-04 342 → 199; затем dove/tooltip-серия дала регрессию 194 → 295,
    после чистки (унификация tooltip-компонентов) → 270.

    **ПРИЧИНА большого числа `!important`** (важно понимать): `css/site.css` исторически
    собран из НЕзакрытых `@media`/`@supports`/`@layer` блоков — на 2026-06-08 в файле был
    дисбаланс **+151** открывающей скобки (браузер закрывал их на EOF). Из-за этого многие
    правила оказывались «погребены» на глубине вложенности ~151 и применялись только при
    накопленных media-условиях — поэтому их и заставляли работать через `!important`.
    Блок `fn-marker--dove` был восстановлен **плоским, на глубине 0, в конце файла** (после
    явного закрытия всех скобок) — и там `!important` ему уже НЕ нужен (un-layered правило
    бьёт любой `@layer`). Дальнейшее снижение к 200 — тем же приёмом: чинить вложенность,
    а не добавлять `!important`. **Проверяй баланс скобок:**
    `python3 -c "s=open('css/site.css').read();print(s.count('{')-s.count('}'))"` → должно быть 0.
    **`!important` сам по себе не «зло», но >50 в одном файле — запах: каскадные слои
    (`@layer reset,base,components,utilities`) решают специфичность без него.**

---

## 5. JS-правила

### 5.1 Архитектура

Каждый JS-файл — самодостаточный, под одну тему. **НЕ создавать общий `utils.js`** — это сломает текущую модульность (`site-utils.js` существует, но имеет узкую роль). Подробная карта 27 модулей внутри `site.js` — в `README.md`.

### 5.2 Запреты

- ❌ `eval()`, `Function()`, `innerHTML = userInput`
- ❌ `addEventListener` без `removeEventListener` (память)
- ❌ CDN-зависимости (jQuery, Lodash) — проект bessebt (vanilla)
- ❌ ES2024+ фичи без проверки на Safari 15+
- ❌ Переход на TypeScript / Vite / любой bundler — архитектурный выбор vanilla

### 5.3 Обязательные проверки перед коммитом

```bash
# Синтаксис JS — все 11 файлов + sw.js + scripts
node --check js/*.js
node --check scripts/*.js
node --check sw.js

# Хеши cache-bust свежие
npm run cache-bust

# Полная валидация (HTML, JSON, manifest, SEO)
npm run validate:all

# Дизайн-токены
npm run tokens:check

# Главный аудит (38 проверок)
node scripts/audit-pro.js
# Должно: ✅ PASSED, errors = 0
```

Если хоть одна — FAIL, **не коммитить**.

#### Visual audit (Playwright, опционально но рекомендовано перед крупными CSS-правками)

```bash
# 1. Локальный HTTP-сервер (отдельная вкладка)
python3 -m http.server 8080 --bind 127.0.0.1

# 2. Playwright + chromium (один раз)
npm install --no-save playwright
npx playwright install chromium

# 3. Аудит (52 контекста / 156 скринов в shots/)
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
```

Должно: `0 console errors, 0 network errors, 0 raw bugs` (или все подавлены).

---

## 6. Статьи — как добавлять

### 6.1 Структура

```
articles/<slug>/
└── index.html
```

slug — строчные латинские буквы и дефисы, без слэша в начале.

### 6.2 Обязательные блоки в `<head>`

См. [`README.md` § «Добавление новой статьи»](README.md) — полный шаблон с meta-тегами, JSON-LD, OG/Twitter, SITE_CONFIG, breadcrumb JSON-LD.

### 6.3 Runtime-компоненты

| Компонент | Поведение |
|---|---|
| `<header class="article-header">` | h1, byline (см. §3.1), метаданные (дата, ≈мин чтения) |
| `<aside class="author-card">` | Перед `.sources-block` / `.reading-list` |
| `<aside class="article-toc">` | Для длинных статей (>20мин) |
| Глоссарий `<span class="gterm">термин<span class="gtip">…</span></span>` | luxury tooltip, mobile bottom-sheet |
| Академические сноски `<span class="fn-marker">N<span class="tooltip">…</span></span>` | mobile bottom-sheet |
| Библейские ссылки `<button class="bref" data-ref="Иер 17:9">` | tooltip с переводами |
| `.gb-accuracy-btn--email` | mailto: только `viktorcoy2012@gmail.com`, subject/body формируются JS из h1 + URL |

### 6.4 SITE_CONFIG — обязательная часть HTML

См. README.md § «Контракт `window.SITE_CONFIG`».

### 6.5 Quiz Engine v3+

Если `features.quiz.enabled === true` и в `window.SITE_CONFIG.quiz.questions` есть вопросы, HTML обязан содержать канонический mount `<div id="quizPlaceholder"></div>`. **Не вставлять вручную legacy `#quizWrapper`**: runtime сам генерирует `#quizWrapper`, `#quizLaunch`, `#quizQuestion`, `.quiz-option` и bonus-блоки. Ручной wrapper уже ломал Da Vinci / Krajne: overlay открывался, но вопрос и варианты не рендерились.

Вопросы могут содержать `sourceRef` для академического feedback:

```js
{
  id: 'q1',
  type: 'single',
  category: 'theology',
  difficulty: 'medium',
  question: 'Вопрос...',
  options: ['...', '...', '...'],
  correct: 1,
  explanation: {
    short: 'Короткий вывод.',
    full: 'Развёрнутое объяснение ответа.',
    anchor: 'sec-intro'
  },
  sourceRef: { label: 'Иер. 17:9', href: '#sec-intro' }
}
```

`sourceRef` — строка, объект `{ label, href }` или массив. Результаты квиза сохраняются в `localStorage` как `quiz-result-v2:{page.id}`. Legacy-формат `q / answer / ok / err / focus` поддерживается только для старых страниц; новые вопросы писать в новом формате.

### 6.6 Share API (для цитат, результатов квизов)

```js
window.SiteShare.open(button, {
  dialogTitle: 'Поделиться цитатой',
  title: document.title,
  text: '«цитата» — Название статьи',
  url: 'https://gospod-bog.ru/article/#:~:text=...'
});
```

НЕ подменять заголовок диалога через DOM. Все платформы (TG/WA/VK/MAX/OK/Copy) используют `activeShareUrl/Title/Text` из payload.

### 6.7 Язык статей и цитат

Русскоязычная статья должна читаться как цельный русский текст. Это правило закреплено не только документально, но и технически: `scripts/validate.js` и `scripts/audit-pro.js` блокируют английские прямые цитаты в читательском русском тексте и quiz-строках. Полная редакционно-источниковая политика — `docs/EDITORIAL-SOURCE-POLICY.md`.

- ✅ Основной текст, прямые речи, сильные цитаты, цитаты в quiz/explanation, подписи к иллюстрациям и callout-блоки — **на русском**.
- ✅ Английские названия книг, статей, журналов, издательств, URL, DOI, `href`, библиографические записи и технические термины в скобках допустимы, если они нужны для идентификации источника.
- ❌ Не вставлять в тело русской статьи английскую прямую цитату ради «солидности».
- ✅ Если важно показать, что формулировка верифицирована, дать русский перевод и рядом ссылку на оригинал: `МакАртур формулирует: «…» <a href="...">GTY transcript</a>`.
- ✅ Если перевод спорный или авторский, можно добавить: «перевод наш» / «смысловой перевод», но сам цитируемый текст остаётся русским.
- ❌ Не заменять русскую цитату машинным калькированным английским термином. Сначала русский эквивалент, затем при необходимости оригинальный термин в скобках: «различный отбор материала (variant selections)» — допустимо как термин; «variant selections» как самостоятельная цитата — нет.

### 6.8 После добавления статьи

1. Обновить `sitemap.xml` (ISO8601 lastmod с +03:00)
2. Обновить `feed.xml` (`<item>` в начало `<channel>` + `<lastBuildDate>`)
3. Обновить `data/series.json` (если статья входит в серию)
4. Обновить `data/search-manifest.json` (для Ctrl+K)
5. Добавить карточку на `/articles/index.html` и (если уместно) на `/index.html`
6. Подготовить OG-картинку (1200×630, `.webp` или `.jpg`)
7. `npm run cache-bust`
8. `npm run validate:all` + `node scripts/audit-pro.js`

IndexNow при `git push main` сам уведомит Яндекс/Bing.

---

## 7. Красные флаги

| Если ты собираешься… | …почему НЕТ |
|---|---|
| «Создать новый CSS для article-share-buttons.css» | См. §2. Используй `site.css`. |
| «Создать `utils.js` для общих функций» | См. §5.1. У каждого JS своя тема. |
| «Заменить "Редактор" на "Автор" — короче» | См. §3.1. Это намеренно. |
| «Упростить JSON-LD — слишком много свойств» | См. §3.2. Это для SEO. |
| «Удалить старые AUDIT_*.md — лишний мусор» | Оставлять `AUDIT_HISTORY.md`. `audit/AUDIT_CLEANUP_PLAN_*.md` оставлять до завершения плана. |
| «Обновлю pretty каждый файл — для красоты» | НЕТ. Diff нечитаем. |
| «Прогоню `eslint --fix` — улучшит код» | НЕТ. Только точечно. |
| «Поправил CSS — забыл `cache-bust`» | Запусти. SW не подхватит правки. |
| «Заменю vanilla на TypeScript для надёжности» | НЕТ. Архитектурный выбор vanilla. |
| «Верну AI-disclosure для прозрачности» | См. §0 п.3. Об ИИ — только на `/about/`. |
| «Добавлю `!important` на всякий случай» | См. §4.2 чеклист. |
| «Перепишу `summary-card` с `!important` для надёжности» | НЕТ. PLAN-04 P8-P10 сняли 39 ненужных. Конкурентов в каскаде нет (компонент только на 2 не-nagornaya страницах). |

---

## 8. Service Worker — что важно

`sw.js` — версионируется автоматически (`scripts/cache-bust.js` обновляет `CACHE_VERSION`). При правке `sw.js` руками — **не править version-строку**, скрипт это сделает.

Precache список — в самом `sw.js`. При добавлении нового шрифта/JS-файла — добавь в precache.

---

## 9. Безопасность / гигиена

- ❌ Не добавлять `http://` ссылки в контент — `audit-pro` ругается на mixed-content. Используй `https://` или (для умерших источников) `https://web.archive.org/web/2025/http://...`.
- ❌ Не хранить ключи / токены в репозитории. `INDEXNOW_KEY` — только в GitHub Secrets.
- ❌ Не использовать `eval` / `Function` / `innerHTML = userInput`.

---

## 10. Что из корня репо никогда не коммитить

| Файл / маска | Почему нельзя |
|---|---|
| `*.patch` | git-артефакты, не контент |
| `*.py` в корне | Статический сайт. Python — только в `scripts/` (build-tools) |
| `*.tsx`, `*.ts`, `src/components/` | Vanilla проект, TypeScript-компоненты — мёртвый код |
| `README-<что-то>.txt`, `README.txt` | Дубли `README.md` |
| `PATCH-V*-SUMMARY.md`, `AUDIT_REPORT_*.md`, `*_PLAN_*.md` (в корне) | Истёкшие планы; история — в git log и `AUDIT_HISTORY.md`. План в `audit/` — оставлять до завершения. |
| `apply_*.py`, `fix_*.py`, `final_*.py`, `split_*.py` | Одноразовые костыли. Нужен скрипт — в `scripts/` + `package.json` |
| `shots/`, `visual-audit-report.json`, `deep-check.json`, `node_modules/`, `.playwright-browsers/` | Уже в `.gitignore` |
| `<INDEXNOW_KEY>.txt` | Генерируется `deploy.yml` только в Pages-артефакте |

Если AI-агент создал такой файл во время работы — обязан удалить перед коммитом.

---

## 11. История документа (свёрнуто)

Полная история r1..r110 — в `git log` (`git log --oneline --grep="AGENTS-r"`).
Детальные changelog'и r68–r110 свёрнуты при r115 (были занимали >400 строк).

Последние 5 значимых вех (полная таблица r111+ — выше):

Полная история r1..r62 — в `git log` (`git log --oneline --grep="AGENTS-r"`).

Сохранены здесь только последние 5 значимых вех:

| Версия | Дата | Главное |
|---|---|---|

---

## 12. Раздел «Карты» (/karty/) — архитектура и правила

Полная документация: **`docs/MAPS-ARCHITECTURE.md`**.

### 12.1 Ключевые принципы

1. **ОДНА базовая карта** — единая SVG-география Ближнего Востока (viewBox `0 0 1900 1430`). Маршруты = слои данных поверх неё.
2. **Вторая карта = триггер рефакторинга** — вынести base-geo, map-engine.js и route.json. НЕ выносить заранее.
3. **era-теги** — каждое место несёт `era:["bronze"]` (или `["iron"]`, `["roman"]`). При второй карте — фильтрация по эпохе.
4. **Standalone inline** — karty/avraam/ (129 KB, 852 LOC script) автономен от site.js. Лимит inline-JS: warning >500 LOC.

### 12.2 Текущее состояние карты Авраама

| Метрика | Значение |
|---|---|
| Места (PLACES) | 19 (с era-тегами) |
| Контекстные точки (CTX) | 7 (Вавилон, Мари, Эбла, Ниневия, Мегиддо, Пещера Лота, Хацор) |
| Этапы кинотура (STAGES) | 8 (с km дистанциями) |
| Слои (LAYERS) | 9 (abr, lot, war, cand, ctx, trades, waypoints, mounts, debate) |
| Торговые пути | Via Maris, Царская дорога, Дорога Сура (SVG + иврит) |
| Горы | Геризим (גְּרִזִּים), Гевал (עֵיבָל) |
| Археология | 13/19 мест верифицировано по академическим источникам |

### 12.3 URL — НЕ менять

| URL | Что | Почему |
|---|---|---|
| `/karty/` | Хаб библейских карт | Кириллица = SEO под русские запросы |
| `/karty/<slug>/` | Конкретная карта | Слаг = имя героя (avraam, ishod, pavel) |
| `/map/` | Карта связей статей | Служебная, другой тип, НЕ переименовывать |

### 12.4 Запрещено

- ❌ Копипастить avraam/ целиком для новой карты — вынос базы обязателен
- ❌ Растровые подложки / тайлы / спутник — только SVG-вектор
- ❌ Leaflet / MapLibre — оверкилл для стилизованной исторической карты
- ❌ Отдельный «поддомен» / SPA на карту — хаб /karty/ единый


---

> **Если правило кажется глупым — спроси, ПОЧЕМУ оно появилось.**
> Большинство «странных» правил появилось после реальных регрессий.
> Прежде чем менять контракт — открой `AUDIT_HISTORY.md`.


---

## 9. Железобетонные UI-правила (НИКОГДА не нарушать)

### 9.1 Имена Бога на главной странице
- `js/enhancements.js` содержит блок ambient-фраз (42 фразы: иврит/греческий/латинский (35 боковых + 7 центральных))
- **Страж запуска**: `if (!document.getElementById('hScriptureBg')) return;`  
- НЕ менять на проверку `.h-phrase--ambient` — элемента в статическом HTML нет
- При любых правках `js/enhancements.js` — проверить что `document.querySelectorAll('.h-phrase').length >= 35`

### 9.1b Home mobile dashboard — быстрый вход вместо «портянки»
- На главной странице должен существовать mobile-only блок `.h-mobile-dashboard` с 4 quick-start карточками.
- Минимальный набор ссылок в quick-start:
  - `/articles/`
  - `/nagornaya/`
  - `/baptisty-rossii/`
  - `/konfessii/russkij-baptizm/`
- `#main-content` на `/` обязан оставаться `data-pagefind-body`, чтобы домашняя страница индексировалась поиском как точка входа, а не выпадала из discoverability.
- Если меняешь мобильную IA главной, цель — app-like библиотека и быстрый вход в большие разделы, а не длинная неструктурированная «портянка» карточек.

### 9.2 FC-controls (плавающие кнопки тема/поиск)
- Компактный пилл-контейнер с `backdrop-filter`, `border-radius:24px`, `padding:3px`
- Кнопки `36x36px`, NO `border-radius:50%`, NO `background-color` на hover
- Hover: ТОЛЬКО `transform:translateY(-2px)` — никаких кругов, никакого фона
- Высота контейнера ≤ 110px (две кнопки + padding)
- Класс `.gb-floating-controls` в `css/site.css`
- На mobile, если `features.themeToggle.enabled !== false`, должен быть видимый theme control: `.gb-fc-theme`, `#barThemeBtn`, `#themeToggle` или Нагорная sidebar/bottom-bar equivalent. Не скрывать `.gb-fc-theme` только потому, что есть bottom-bar: это уже приводило к отсутствию темы на статьях.

### 9.3 bio-cover в статьях о Гилле
- `articles/dzhon-gill-chast-1-chelovek/index.html` ДОЛЖЕН содержать `.bio-cover` с изображением `gill-authentic-study-cover`
- Это 16:9 кабинетный портрет Гилла в библиотеке — НЕ city-view, НЕ portrait 3:4, НЕ кафедра
- `aspect-ratio` в `.bio-cover` = `16/9` (не 21/9)

### 9.4 Карточки-thumbnails серии Гилла на главной
- Часть 1 (`dzhon-gill-chast-1`): thumbnail = `gill-authentic-study-cover` (широкоформатный кабинетный портрет)
- НЕ использовать `og-gill-authentic-study-cover` как thumbnail-картинку карточки: это social-share OG, а не компактный карточный ресурс

### 9.5 Запрет дублирования контента
- В `chast-1` — НЕ должно быть двух одинаковых портретов Гилла
- `biography-portrait` / малый 3:4 `dzhon-gill-portret` в шапке — НЕ возвращать
- На первом экране Части I должен остаться один главный образ: `.bio-cover` с `gill-authentic-study-cover`

### 9.6 Playwright-регрессионные проверки
`scripts/visual-audit.js` содержит автоматические проверки:
- `ambientPhrases === 0` на `/` → CRITICAL bug
- `fcControlsH > 110` → HIGH bug  
- `.bio-cover` отсутствует на gill chast-1 → HIGH bug

Запуск перед каждым коммитом: `npm run validate:all && node scripts/audit-pro.js`

### 9.7 Theme-toggle / search-icon — ЧИСТЫЙ SVG БЕЗ РАМОК
**Никогда не добавлять** `background`, `border`, `border-radius`, `box-shadow`, `backdrop-filter` к иконкам переключения темы и поиска. Это:
- `.theme-toggle` (absolute, в статьях)
- `.gb-fc-theme`, `.gb-fc-search` (FAB, `js/site.js` модуль 29)
- `.h-cp-btn`, `.gb-nav-search-icon` (в шапке home)
- `.bar-icon-btn` (bottom-bar, mobile)

Должно быть: **только сам SVG** (stroke=currentColor), `background:transparent`, `border:none`, никаких pill/circle обводок. Hover-эффект только `transform:translateY(-2px) scale(1.08)` + изменение `color`, без opacity-флипа (иначе оба `.icon-sun` и `.icon-moon` могут показаться одновременно — баг от 2026-06-08).

**Исключение:** серия «Нагорная проповедь» (`body.nagornaya-page`) — там своя система с Tailwind-классами, не трогать.

**Search keyboard contract:** `Ctrl/⌘+F` — всегда нативный поиск браузера; сайт не должен делать `preventDefault()` и не должен открывать command palette. Command Palette открывается только `Ctrl/⌘+K` (case-insensitive: Chromium/Playwright может дать `key="K"`). `Escape` внутри palette должен закрывать palette, а не только чистить строку. Это защищено `audit-pro` G112 и `npm run interactive-audit`.

**Media/share runtime contract:** image viewer должен открываться по клику на article image, ставить scroll-lock (`html.style.overflow='hidden'`) и закрываться по Escape с восстановлением overflow. Share dialog должен открываться через `#articleEndShareBtn`, иметь `aria-hidden="false"`, закрываться по Escape и опираться на canonical URL, не на preview/local URL. Это проверяет `npm run interactive-audit`.

**Readable/publication contract:** декоративные номера summary (`.summary-card__num`) не должны быть читательским текстом: span пустой, `aria-hidden="true"`, номер хранится в `data-num` и рисуется CSS `content:attr(data-num)`. Главный H1 на `/` в `innerText` обязан читаться как `Господь Бог — Сила Моя`. В публичном тексте не должно быть внутренних enum labels (`Book`, `Confession`, `ChicagoDoc`, `Warning`, `Father`, `Academic`) и overclaim-бейджа `Проверено историками`. Это защищает `npm run readable-audit`.

**Data/source contract:** после изменения карточек, серий или article meta запускать `npm run data:consistency` (readTime/title/search-manifest/series drift). Для внешних источников есть `npm run source:links`: TLS/404/bad-host — ошибка; 403/429/timeout — предупреждение с ручной проверкой, потому академические сайты часто режут ботов.

**Workflow/CI contract:** `indexnow.yml` и `deploy.yml` обязаны запускать `npm run validate:static-publication`; `source-links.yml` и `interactive-audit.yml` должны быть manual+scheduled; `notify-on-failure.yml` должен слушать оба этих workflow. Это защищено `npm run workflows:check`. Локальный `npm run ci:check` теперь = cache-bust + static publication gates + workflow policy.

### 9.8 article-topnav — УДАЛЁН
Sticky шапка `.article-topnav` (показывалась при скролле статьи с «← Господь Бог — Сила Моя | TITLE | поиск») **удалена из всех 8 статей** по запросу владельца 2026-06-08. **Не возвращать.** Хлебных крошек (`.breadcrumb`) достаточно для навигации.

CSS-правила `.article-topnav*` пока остаются в site.css как dead code (для возможного восстановления). При полной чистке можно удалить через PLAN; до этого не реанимировать в HTML.

### 9.9 Hover на ссылках-карточках в тёмной теме — НЕ розовый
`.h-article-card:hover .h-article-title` в светлой теме = `--h-accent` (#8b2626 темно-красный — ок). В **тёмной** теме `--h-accent` = #d97a6c — это **розово-красный**, плохо контрастирующий с золотисто-палевым телом. Поэтому в `html.dark` hover-цвет переопределён на **золотистый `#e8c97a`** (`css/home.css`). Не возвращать на `var(--h-accent)`.

### 9.10 FOUC шрифтов на главной
Кроме `Lora-cyrillic-400`, **обязательно preload** для:
- `Inter-cyrillic-600` (используется в `.h-sacred-ref` — «АВВАКУМ 3:19»)
- `PlayfairDisplay-cyrillic-700` (используется в `.h-section-title`, hero и др.)

Иначе виден FOUC: сначала рендерится fallback Times New Roman, потом подмена. Это видно на главной при перезагрузке.



### 9.13 Изображения владельца — НЕ ЗАМЕНЯТЬ генерациями

**НИКОГДА** не заменять изображения, которые загрузил владелец, на AI-генерации.
Если изображение визуально не устраивает — спроси владельца, а не генерируй замену.

Конкретно:
- `whitefield-preaching.*` — картинка Уайтфилда на Кеннингтон-Коммон. Загружена владельцем.
  Это ВТОРАЯ картинка Уайтфилда в gill-kontekst. НЕ удалять, НЕ заменять.
- `whitefield-field.*` — картинка Уайтфилда в поле. ПЕРВАЯ в gill-kontekst. НЕ удалять.
- Между двумя Уайтфилдами должен быть текст (не ставить подряд).

### 9.12 Голуби (fn-marker--dove) vs Цифры (fn-marker) — РАЗДЕЛЕНИЕ ТИПОВ СНОСОК

Два типа сносок — **железобетонное правило**, не смешивать:

| Тип | Класс | Иконка | Когда использовать |
|---|---|---|---|
| **Цифровая сноска** | `fn-marker` (без `--dove`) | Число (1, 2, 3…) | Ссылки на источники, библиографические сноски, переводческие ссылки на оригинал |
| **Голубь-сноска** | `fn-marker fn-marker--dove` | 🕊️ SVG-голубь | Пояснения редактора, справочная информация, терминологические справки, контекстные примечания |

**По статьям:**
- **Переводы** (герменевтика Чау и др.) → **ТОЛЬКО ЦИФРЫ**. В оригинале были цифровые сноски.
- **Авторские статьи** (20 антисоветов и др.) → **ГОЛУБИ** для авторских/редакторских комментариев.
- **Биографии Гилла** → цифры для ссылок на источники, голуби для пояснительных вставок (†, ‡ и т.д.).
- **Код да Винчи, Иеремия, Римлянам** → цифры (ссылки на источники).

**Запрещено:** ставить голубей на ВСЕ сноски подряд. Голубь — это визуальный маркер «здесь пояснение», а не «здесь источник».

CSS поддерживает оба типа:
- `.fn-marker` — цифра в суперскрипте, hover показывает tooltip
- `.fn-marker.fn-marker--dove` — SVG-голубь с машущим крылом, hover показывает tooltip

JS `site.js` функция `e()` инжектит SVG тело голубя только в `.fn-marker--dove`.

### 9.11 Series World (GBS) — единый канон для серий статей (с 2026-06-11, r96–r99)

Все многочастные серии статей используют **GBS** («мир серии»):
тёмный левый рельс (desktop) + sticky-шапка и нижняя капсула со шторкой (mobile),
weighted-прогресс серии по минутам, живой TOC, hero+kinetic, prev/next-карточки,
era-timeline. Живые эталоны: 5 страниц Гилла + 2 hard-texts.

- Стили: `css/site.css`, секция `body.gbs-world` / `gbs2-*` (минифицировано, ~строки 369–373).
- Поведение: `js/enhancements.js`, 3 IIFE «GBS reference pilot v2».
- Анатомия миграции страницы, плейсхолдеры и грабли: **`docs/GBS-PATTERN.md`**.
- `data/series.json` остаётся источником данных серий (тайтлы/slug'и/минуты/status); формат прежний:
```json
{
  "<series-key>": {
    "title": "Название серии",
    "baseUrl": "/articles/",
    "parts": [
      {"n": 1, "slug": "url-slug-of-part", "title": "Часть I. Заголовок", "status": "published", "readingTime": 25}
    ]
  }
}
```
- Прогресс серии в рельсе — data-атрибуты на body: `data-gbs2-done-min` (сумма минут предыдущих частей), `data-gbs2-part-min`, `data-gbs2-total-min`. При добавлении части — пересчитать на ВСЕХ страницах серии + series.json.
- Для встраивания gbs2-компонентов (timeline, next-card) на страницы БЕЗ `body.gbs-world` (лендинги серий, каталоги) — класс **`.gbs2-scope`** на секции-контейнере (даёт переменные light+dark). Пример: `/hard-texts/`.
- `status: "planned"` части показываются приглушёнными (`opacity:.55`, без href) в рельсе/шторке/next-картах.

**Запрещено:**
- Возвращать legacy series-UI: `data-series-strip` / `data-series-nav` / `.gb-strip` / `.gb-snav` / `.series-next-cta` — удалены со всех страниц в r96–r97; рендереры strip/nav и CSS `.gb-snav` ВЫЧИЩЕНЫ из кода в r107 (по «да» владельца на тотальную чистку). В `js/series-cards.js` остался только режим `data-series-cards` (каталоги); к article-страницам файл не подключается (r99).
- Дублировать inline-карточки «Часть I / II / III» вручную в HTML.
- Создавать новые CSS/JS-файлы под серию — GBS живёт в существующих файлах.
- Оставлять при миграции legacy-блоки `#reading-progress`, `#section-label`, старый `#themeToggle`, `#tocSidebar`, `#bottomBar`, `#btocOverlay` — именно так упал агент до r96 (двойная полоса прогресса).

**Нагорная проповедь** — историческое исключение (свой Tailwind-sidebar + nagornaya-mobile-toc.js). Не трогать; новые серии делать на GBS.

Перед изменением GBS-кода обязательно прогнать `npm run interactive-audit`: он проверяет на всех 7 series-страницах рельс/aria-current/toc/ring, отсутствие legacy-UI, клик по TOC (скролл, не навигация), а на мобиле — открытие шторки, переключение вкладок и закрытие.

**Инварианты дизайна GBS (решения владельца, фаза 2; нарушение = регресс):**
- Все направляющие линии — от реальных центров элементов (getBoundingClientRect), без магических отступов.
- Scroll-spy: кэш позиций + инвалидация на resize/шрифты; низ страницы → последняя секция; гистерезис ~12px.
- Автоподскролл активного пункта TOC — только scrollTop контейнера, НИКОГДА scrollIntoView.
- Один rAF-тик на скролл; классы перекрашиваются только при смене секции.
- view-transition-name не в статическом CSS — только на время перехода (JS вешает/снимает).
- Resume-позиция пишется только после реального скролла пользователя (wheel/touch/клавиши) и y>120.
- prefers-reduced-motion отключает параллакс/кинетику/зерно/отсчёты/VT — функциональность остаётся.
- У каждой картинки интерфейса — дизайн-фолбэк (onerror → градиент + номер части).

**Анти-фичи — владелец ЯВНО отклонил, не возвращать:**
- ❌ чекбокс «Отметить прочитанным» (прогресс только автоматический);
- ❌ «Дочитаете к ЧЧ:ММ» (допустим только тихий «осталось ~N мин»);
- ❌ минуты у пунктов оглавления ЧАСТИ (в списках частей — можно);
- ❌ кикер «СЕРИЯ … — N ИЗ M» над H1 (дублирует hero-подпись);
- ❌ автопереход на следующую часть по таймеру (только подсветка + клик);
- ❌ геймификация с бейджами.

**Ожидает решения владельца (без «да» не делать):** Popover API для тултипов; 3D-карта связей (three.js, этап «в» §2.4); hover-карточки внутренних ссылок / Tufte-сноски / режим фокуса; GBS для pastor-series (осмыслен при ≥2 частях); миграция «Римлянам 8» по docs/GBS-PATTERN.md когда статья будет написана (total пересчитать, обновить series.json + сестринские страницы).


### 9.17 John Gill image system — final editorial lock

  * Часть 1 bio-cover и thumbnail = `gill-authentic-study-cover`: монументальный кабинетный портрет Джона Гилла в библиотеке, 16:9.
  * Малый 3:4 портрет `dzhon-gill-portret` в верхней карточке Части I не использовать: он создаёт дублирование и непремиальную белую рамку.
  * На первом экране Части I должен быть один главный визуальный образ, а не два портрета подряд.
  * В Части I после рассказа о крещении и гимна должна быть иллюстрация `gill-baptism-scene`; не ставить её перед обращением на Быт. 3:9.
  * В Части II в блоке о раввинистике/Талмуде использовать только `gill-talmud-study-authentic`; старую `gill-engraving-talmud-study` не возвращать.
  * Книжная лавка Кеттеринга в историческом контексте = `gill-bookshop-strip` как узкая горизонтальная полоса. Не возвращать вертикальный `gill-context-scroll`.
  * Кафедра Гилла в тексте = `gill-pulpit-strip` как узкая горизонтальная полоса.
  * В Частях I–III не возвращать interstitial-блок `context-bridge` с текстом «Исторический фон серии…». После owner-review 2026-06-10 он признан лишним дублем навигации.
  * Слот скорби/пастырского утешения в Части I = `gill-funeral-sermon`: погребальная проповедь Гилла в капелле XVIII века, а не сцена с одной женщиной и не типография.
  * `gill-pastoral-succession` не трогать: владелец отдельно попросил оставить эту схему как есть. Если файл временно не используется в HTML, не удалять его без отдельного подтверждения.
  * Защищённые исходники схемы преемственности: `images/gill-pastoral-succession.webp`, `images/gill-pastoral-succession.jpg`, `images/gill-pastoral-succession-600w.webp`, `images/gill-pastoral-succession-900w.webp`, `images/gill-pastoral-succession-1200w.webp`.

### 9.18 John Gill grief/consolation slot

  * В Части I слот скорби/пастырского утешения должен использовать `gill-funeral-sermon`.
  * Сцена должна показывать исторически правдоподобную погребальную проповедь: кафедра, открытая Библия, траурное собрание, скорбящая община, а не частную сцену утешения одной девушки.
  * Старую семью `gill-pastoral-consolation` после замены не возвращать.

### 9.19 John Gill image truth-lock — описывать реальное изображение, а не только filename

  * После self-audit 2026-06-10 зафиксировано: у части Gill-asset families filename исторически неточен. **Нельзя слепо писать alt/figcaption по имени файла. Сначала открыть картинку и описать то, что реально видно.**
  * `gill-kettering-1697` = ранняя кеттерингская бытовая/ремесленная среда, дом и дорога под вечерним небом. Это **не** funeral scene и не обязательно «суконные мастерские крупным планом».
  * `gill-spurgeon-succession` = символическая сцена преемственности кафедры (кафедра, Библия, молитва), а **не** буквальный портрет/репортаж со Спердженом. Если используется, подпись должна быть о символе преемственности, не о «фото Сперджена».
  * `gill-bunhill-fields` = погребальная процессия / memorial engraving в Банхилл-Филдс, а не просто пустой вид кладбища. Подпись должна это отражать.
  * `gill-young-boy-shop` в текущей approved-family визуально является still-life с чернильницей и пером. Если используется — подпись о письме/чернилах/инструментах труда, а не о «мальчике в книжной лавке».
  * Если image family кажется семантически неидеальной, **не возвращать старые удалённые семьи автоматически**. Сначала проверь, можно ли честно переписать alt/figcaption под реальный approved image. Старое «restore ради совпадения filename→caption» запрещено без отдельного подтверждения владельца.

### 9.20 John Gill historical-restore lock

  * Если восстанавливаешь Gill-текст из старого git history, после вставки **обязательно** перепроверь `fn-marker` / `fn-marker--dove` вручную. Старые коммиты могли содержать формально «сбалансированные», но семантически сломанные span-обёртки, когда outer-marker проглатывает абзац.
  * После любого history-restore для Gill-страниц: (1) grep по `<figure class="article-img` + captions, (2) browser-check desktop+mobile, (3) verify no stale preload remains for removed/replaced image family.

### 9.21 Glossary/tooltips in summaries — HARD LOCK

  * `.summary-card` / блок «Коротко» — **только краткий plain-text summary**. Внутри summary-card запрещены `.gterm`, `.gtip`, всплывающие glossary-карточки, dotted underline и любые interactive tooltip terms. Термины и всплывающие пояснения допустимы в основном тексте статьи, но не в summary.
  * `js/glossary.js` обязан пропускать `.summary-card` и при авто-hydration текста, и при `hydrateGlossaryTerms()`. Не возвращать glossary auto-markup в summary ради “обогащения”: владелец явно попросил минималистичные summary без пунктирных терминов.
  * Glossary popup desktop-карточка должна быть цельной, без урезанного внутреннего layout: `.gtip-luxury` — block layout, header/title/body не должны вести себя как inline-flow, нормальные короткие определения не должны получать внутренний scrollbar. Mobile bottom-sheet может скроллиться только когда контент реально длинный.
  * Перед любыми правками tooltip/glossary: Playwright smoke на Gill context + Gill part + Krajne: hover/tap `.gterm`, проверить видимую карточку, непрозрачный фон, non-zero width/height, no clipping, no `.summary-card .gterm`.
  * Source-footnote tooltips must be flat DOM: запрещены `.tooltip .fn-marker`, `.tooltip .tooltip`, `.fn-marker .fn-marker`. Это уже ломало статью Chou/hermeneutics: основной текст был проглочен внутрь tooltip. После любых массовых правок сносок прогонять audit-pro G104 и browser hover на статье.
  * `audit-pro.js` guards G104/G106/G107 защищают эти правила. Если они падают — не обходить, а чинить tooltip/summary contract.

### 9.22 Регистр названий отделов/разделов — Title Case (с 2026-06-12)

  * **Названия ОТДЕЛОВ библиотеки** (бренд-лейблы разделов) пишутся в Title Case:
    значимые слова — с заглавной, служебные (предлоги/союзы/частицы) — строчными,
    кроме первого слова. Образец-эталон: **«Конфессии и Деноминации»**.
    Служебные строчными: *и, а, но, или, в, на, по, с, о, об, от, до, для, к, у,
    за, из, под, над, при, без, через*.
  * Это касается именно **имён разделов** (как они звучат в навигации, на карточке
    отдела на главной, в H1 хаба и хлебных крошках нового раздела). Новые отделы
    создавать сразу в этом регистре.
  * **НЕ распространять Title Case на:** заголовки статей, описательные заголовки
    секций, цитаты, имена собственные, ссылки на Писание, ambient-фразы. В русском
    это обычный регистр предложения (sentence case) — он остаётся как есть, иначе
    текст становится неидиоматичным. Слепая массовая «капитализация каждого слова»
    запрещена.
  * Легаси-идентификаторы, уже зашитые в structured data (`articleSection`,
    breadcrumb JSON-LD, `SITE_CONFIG.section`), менять только если меняется ВЕЗДЕ
    согласованно (видимый текст + JSON-LD + breadcrumbs + SITE_CONFIG на всех
    страницах раздела) — иначе не трогать ради косметики.

### 9.23 Отдел «Конфессии и Деноминации» — 3D-карта (iframe-приложение) и регресс-защита (с 2026-06-13)

### 9.24 OG image alignment — выделенные og:image НЕ обязаны совпадать с LCP (с 2026-06-15)

Аудит-про выдал INFO-level notice: 5 страниц имеют `og:image` ≠ LCP-priority изображению.
Это **намеренно** для страниц с выделенным social-share изображением (custom og:image с
кастомным `og:image:alt` для читаемого описания в соцсетях). Страницы: `/`, `/articles/20-antisovetov-pastoru/`, `/articles/kod-da-vinchi/`, `/articles/krajne-li-isporcheno-serdce/`, `/pastor-series/`. Правило: если у страницы есть dedicated og-изображение с кастомным alt — keep it, не выравнивать по LCP.

Документировать OG alignment decision в AGENTS.md §9.24 вместо изменения изображений.

  * `/konfessii/russkij-baptizm/` — **нативная обёртка сайта** (шапка/крошки,
    SEO/OG/JSON-LD/canonical, sr-only `<h1>`, CSP `frame-src 'self'`, Yandex, лоадер),
    внутри `<iframe src="./_app/index.html">`.
  * **Внутри iframe — ОРИГИНАЛЬНОЕ 3D-приложение** из LM Arena (перенос 1-в-1):
    React 19 + TypeScript + Vite + Tailwind 4 + **Three.js + react-force-graph-3d + d3-geo**.
    Настоящая 3D-сцена: сферы-узлы со свечением, торы-орбиты, тубы-связи, карта стран
    (d3-geo Mercator + world-atlas), режимы «граф/карта», маршруты, инспектор, лоадер,
    AI-ассистент (Gemini, без ключа graceful-null). Это собранный singlefile-бандл ~2.2 МБ.
    **Почему так:** ранний vanilla-порт (2D canvas) сильно упрощал оригинал — владелец
    потребовал точное 1-в-1; согласовано встроить оригинал как изолированный iframe-ассет.
  * **`_app/` — built-asset, исключён из статических валидаторов** (skipDirs/EXCLUDE_DIRS
    в validate.js, audit-pro.js, seo-audit.js, readable-audit.js, editorial-lint.js).
    НЕ редактировать бандл руками (кроме обязательных мета — см. README); пересобирать
    из исходников приложения.
  * **CSP бандла** (своя, в `_app/index.html`): Three.js требует `script-src 'unsafe-eval'
    blob:` и `worker-src blob:`; шрифты Inter/JetBrains — `style-src/font-src/connect-src`
    с `fonts.googleapis.com`/`fonts.gstatic.com`. Бандл несёт `robots=noindex` (индексируется
    только обёртка). Обёртка остаётся в строгой CSP сайта + `frame-src 'self'`.
  * **Регресс-защита:** `npm run konfessii:audit` (`scripts/konfessii-map-audit.js`,
    Playwright) — инварианты I1–I14 на desktop+mobile: обёртка (canonical/og/h1/JSON-LD/
    theme-color/CSP/iframe-src), бандл (singlefile/viewport/CSP/noindex/root), live
    (загрузка приложения в iframe, скрытие лоадера, **активация 3D WebGL-canvas**,
    0 pageerror, 0 overflow). I8–I13 защищают событийный data-driven Timeline,
    route-router, learning coach, article previews, BWA-статистику и кейсы гонений/самиздата;
    **I14** защищает smooth physics constants против возврата jitter/tension (`d3AlphaDecay .0165`,
    `d3VelocityDecay .24`, `warmupTicks 150`, `cooldownTicks 220`, `cooldownTime 7000`,
    anchor `*1.28`). Без браузера/WebGL — мягкий SKIP (exit 0). Прогонять после любой
    пересборки `_app`. Если падает — чинить страницу/пересобрать бандл, не упрощать тест.
  * **Сборка/пересборка:** инструкция в `_build-tools/konfessii-baptizm/README.md`
    (исходники приложения — отдельный Vite-проект у владельца; `base:'./'`,
    `vite-plugin-singlefile`, после сборки вернуть CSP/noindex/favicon в `<head>`).
