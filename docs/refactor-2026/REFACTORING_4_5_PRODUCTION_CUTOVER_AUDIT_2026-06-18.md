# REFACTORING 4.5 — production cutover audit (2026-06-18)

Статус: **post-switch hardening / можно продолжать жить на новом `dist`, но не считать миграцию «байт-в-байт 100% завершённой».**

Этот документ фиксирует глубокую проверку текущего `main` после перехода GitHub Pages с root на Astro/strangler `dist/`.

---

## 1. Что именно проверялось

Методика:

1. Полный inventory tracked files: `git ls-files` — **738 tracked files** на момент аудита.
2. Отдельно просмотрены/проиндексированы:
   - root docs: `README.md`, `AGENTS.md`, `AUDIT_HISTORY.md`;
   - все `docs/refactor-2026/*.md` по heading/размерам;
   - `audit/*.md` и `baptisty-rossii/research/*.md`;
   - `.github/workflows/*.yml`;
   - `package.json` scripts;
   - `src/**`, `scripts/**`, `migration/**`;
   - текущая история коммитов вокруг Astro/refactor switch.
3. Запущены gates:
   - `npm run validate:all` — pass;
   - `npm run strangler:deploy-readiness` — pass после установки Playwright deps в локальной среде;
   - `npm run contract:extract:root` и `npm run contract:extract:dist` — 51 public pages, 0 issues;
   - `npm run source:links` — выявил hard external-link debt; часть исправлена в этом batch, см. §5.
4. Проверена история критических регрессий по `git log --since=2026-06-14` и `git log --grep='fix|regress|critical|deploy|noindex|CSS|paths'`.
5. После hardening batch повторно запущены: `validate:static-publication` ✅ (`audit-pro` 165 passed · 0 warnings · 0 errors), `workflows:check` ✅, `source:links:dist` ✅, `strangler:deploy-readiness` ✅, final `strangler:audit:production-like` ✅, `smoke:maps` ✅, `smoke:maps:mobile` ✅, `smoke:content:mobile` ✅, `npm audit --omit=dev` ✅ (0 vulns).

Локальное примечание: рабочая среда по умолчанию имела Node 20, но проект требует Node `>=22.12.0`; gates запускались через Node 22. В CI уже стоит Node 22.

---

## 2. Production reality сейчас

| Область | Фактическое состояние |
|---|---|
| GitHub Pages artifact | `dist/`, не repo root |
| Build mode | Astro static build + `copy-legacy-to-dist.js --omit-build-only` |
| Public contract | **51 public pages** |
| Page ownership | `migration/page-ownership.json`: Astro routes = `production-dist`; remaining implicit legacy pages copied into `dist` |
| Pagefind | строится в `dist/pagefind` перед deploy |
| CSS parity | blocking gate: `dist:css-parity`, 51/51 pages must carry project CSS |
| SW | `gb-v172-r63-dist-deploy-switch-20260617` differs from pre-switch root baseline |
| Rollback | possible, but must be atomic: artifact path + Pagefind + IndexNow key + `.nojekyll` + SW audit policy |

**Вывод:** технический cutover уже состоялся. Владелец может считать новый refactor site текущим production-каналом, но следующие пункты остаются обязательными guardrails.

---

## 3. Насколько новый сайт «такой же»

Коротко: **URL/SEO contract — да, 100% по baseline; визуально/контентно — не байт-в-байт 100%, а контролируемый production-equivalent strangler.**

Что подтверждено gates:

- `contract:compare:dist` сравнивает `dist` с `data/public-content-baseline.json`: **51/51 OK**.
- `dist-publication-audit` требует indexable/canonical/public shape: pass.
- `dist-smoke-audit` проверяет representative desktop/mobile routes: status 200, H1, canonical, overflow = 0.
- `dist:css-parity` подтверждает: **51/51 страница имеет project CSS**.
- Pagefind source pages: **50** `data-pagefind-body` pages.

Что не равно «100% одинаково»:

- Astro/MDX pages отличаются от root legacy HTML структурой shell/JSON-LD/robots meta и иногда word-count из-за wrapper/navigation/MDX output.
- Некоторые pages — полноценные Astro/MDX rewrites; некоторые — legacy-faithful wrappers; некоторые legacy assets копируются как есть.
- Карты быстро развиваются на `MapEngine`; это уже не замороженная legacy parity, а отдельный активный продукт.
- Root HTML больше не является тем, что видит пользователь, но остаётся fallback/source layer и поэтому может расходиться с `dist`.

Практическая оценка: **переходить можно / уже перешли**, но сохранять режим post-switch наблюдения минимум на несколько циклов деплоя.

---

## 4. История коммитов: что было опасным

Ключевая линия:

1. 2026-06-14 — подготовка: public baseline, contract extractor, build-time strangler prototype.
2. 2026-06-15 — 42/42 shadow ownership baseline, затем расширение article/catalog/landing routes.
3. 2026-06-16 — MapEngine extraction/regression cluster:
   - `2dfa1b3e`, `c94a3298`, `72807e3d`, `22abf658` — восстановление Avraam/Ishod после неудачного modular refactor/data loss.
   - Документированное правило: **не трогать Авраама как экспериментальную жертву; извлекать фичи в движок через другие карты и проверять `avraam:audit`.**
4. 2026-06-17 — actual deploy switch:
   - `a8fd0476` — switch artifact root→dist;
   - `3b17001b` — critical CSS restore: до фикса 41/50 dist pages были без project CSS;
   - `af4b9442` / `a270b53d` — SEO/noindex fixes for maps;
   - `aff94234` — CSS parity gate.
5. 2026-06-18 — post-switch infra fixes:
   - `a66cdf1a` — critical: deploy/indexnow paths did not include `src/**`;
   - `6b22b9f9` — Pages `build_type: workflow` + `src/**` invariants documented.

---

## 5. Что было найдено в этом 4.5-аудите и исправлено

### 5.1 IndexNow URL mapping после `src/**`

Проблема: после Astro migration workflow уже запускался на `src/**`, но payload builder всё ещё мапил в URL только legacy HTML paths. Поэтому `src/content/articles/*.mdx` или `src/pages/**` могли отправлять в IndexNow только homepage, а не реальную изменённую страницу.

Исправление:

- добавлен `scripts/build-indexnow-urls.js`;
- `.github/workflows/indexnow.yml` теперь передаёт changed files в этот mapper;
- `scripts/check-workflows.js` защищает наличие mapper'а.

### 5.2 Source link audit проверял не production artifact

Проблема: `source-links.yml` запускал audit по repo root. После switch production = `dist`, значит weekly source-link check мог пропустить Astro-generated production output и одновременно проверять stale root.

Исправление:

- `scripts/source-link-audit.js` получил `--root <dir>` и по умолчанию не сканирует локальный generated `dist/` случайно;
- добавлен `npm run source:links:dist`;
- `.github/workflows/source-links.yml` теперь строит `production-like dist` и проверяет `node scripts/source-link-audit.js --root dist`;
- `scripts/check-workflows.js` защищает это.

### 5.3 Hard external links

`source:links` выявил hard errors: TLS/cert/ENOTFOUND у `digitalpuritan.net`, `rusbaptist.stunda.org`, `old.memo.ru`, `almanah.bogomysliye.com`.

Исправлено в production sources и legacy fallback:

- `articles/krajne-li-isporcheno-serdce/index.html`;
- `src/content/articles/krajne-li-isporcheno-serdce.mdx`;
- `baptisty-rossii/spravochnik/index.html`;
- `src/content/articles/spravochnik.mdx`.

Стратегия: заменить browser-invalid canonical external URL на `https://web.archive.org/web/2/<original-url>`, чтобы ссылка оставалась проверяемой и читательской.

### 5.4 Документация и ownership status

Исправлено:

- `README.md` больше не утверждает, что проект «без сборщика»; описывает refactoring 4.5 и dist-as-production.
- `AGENTS.md` обновлён: `src/**` теперь production Astro layer, а не запрещённый dead code.
- `migration/page-ownership.json` обновлён: status `shadow-pilot` → `production-dist` для Astro-owned public routes.
- `migration/sw-cache-version-baseline.json` превращён из future-switch baseline в historical completed-switch baseline.
- `scripts/check-page-ownership.js` и `scripts/sw-dist-readiness-audit.js` сообщения синхронизированы с dist-as-production.
- Astro check hints убраны из `ArticleLayout.astro` / `SeriesArticleLayout.astro`.

---

## 6. Что ещё не закрыто / где вероятна регрессия

### P0/P1 — держать под постоянным guard

1. **Pages build_type must be `workflow`.** Если GitHub Pages вернётся в legacy branch/path mode, root и dist начнут конкурировать. Симптом: прод «прыгает» между старым root и новым dist.
2. **CSS parity.** Историческая регрессия была тяжёлая: 41/50 страниц без CSS. Не удалять `dist:css-parity` из deploy.
3. **MapEngine / Avraam.** История уже показала data-loss при modular refactor. Любая правка карт: `npm run maps:validate`, `npm run avraam:audit`, browser smoke для карт.
4. **IndexNow.** После этого batch mapper закрывает src/MDX gap; не возвращать grep-only URL builder.
5. **Source links.** Внешние богословские/исторические источники стареют быстро; weekly workflow должен проверять `dist`, не root.
6. **SW cache.** Не precache content HTML pages, кроме `/404.html`; при смене artifact/cache strategy — проверять `sw:dist:audit:deploy-switch`.

### P2 — качество и parity debt

1. **Manual visual review не заменён полностью автоматикой.** Playwright smoke ловит status/H1/overflow/errors, но не доказывает pixel-perfect parity.
2. **Root vs dist word-count/JSON-LD differs on many Astro pages.** Это ожидаемо, но новые контентные migrations должны иметь explicit parity gates.
3. **Docs/refactor-2026 содержит исторические документы.** Многие «не делать deploy switch» docs теперь historical/superseded. Central index обновлён, но старые документы лучше не удалять — они объясняют решения.
4. **Root legacy HTML может расходиться с MDX source.** Пока root нужен как fallback/source layer, правки важных материалов надо вносить в production source (`src/**`) и при необходимости в legacy root.
5. **Network warnings remain normal:** 403/418/timeouts от VK, Wiley, Monergism, ArchivesHub и др. — не hard errors, но если станут 404/TLS, архивировать.

---

## 7. Go / no-go

**GO:** жить на refactoring 4.5 / `dist` можно. Текущий architecture path правильный: Astro/MDX + build-time strangler + legacy rollback layer.

**NO-GO для безусловного “100% всё закрыто”:** нельзя говорить, что миграция полностью завершена как byte-identical rewrite. Остались:

- исторические docs cleanup;
- визуальный manual review отдельных сложных страниц;
- ongoing MapEngine risk;
- external source link aging;
- discipline вокруг dual source (`src/**` vs root legacy).

Рекомендуемый next step: **не новый большой refactor**, а 1–2 цикла post-switch наблюдения: source-links-dist уже green (hard-check), sitemap/theme-color warnings closed, дальше map smoke и visual screenshots для representative pages, затем только точечные migrations/features.

---

## 8. Команды для следующего агента

```bash
npm ci
npm run validate:static-publication
npm run workflows:check
npm run strangler:deploy-readiness
npm run source:links:dist
```

Если правились карты:

```bash
npm run maps:validate
npm run avraam:audit
npm run smoke:maps
npm run smoke:maps:mobile
```

Если правился deploy/SW:

```bash
npm run strangler:audit:production-like
npm run sw:dist:audit:deploy-switch
```
