# REPO_SPECIFIC_PROFESSIONAL_MIGRATION_AUDIT_2026.md — аудит текущего репо и профессиональный путь миграции

Дата: 2026-06-12

---

## 1. Текущее состояние репозитория

Проект уже не «хаотичный HTML». В репозитории есть зрелая статическая публикационная система:

```text
32 HTML files
5 CSS files
11 JS files
локальные шрифты
sitemap.xml
feed.xml
robots.txt
llms.txt
search-manifest
links-graph
series/glossary/original-words data
GitHub Pages workflows
IndexNow workflow
runtime interactive audit
source link audit
notify-on-failure
```

Также уже есть сильный validation layer:

```text
validate.js
seo-audit.js
audit-pro.js
readable-audit.js
editorial-lint.js
check-data-consistency.js
source-link-audit.js
interactive-audit.js
visual-audit.js
```

Это важно: переход на Astro должен **сохранить и встроить** существующую культуру качества, а не заменить её «магией фреймворка».

---

## 2. Проверка текущего состояния

Команды выполнены:

```bash
npm run contract:extract
npm run contract:compare
npm run maps:validate
npm run validate:static-publication
```

Результат после исправления `data/search-manifest.json`:

```text
contract extract: 32 HTML files
contract compare: 0 errors, 0 warnings
maps validate: 0 errors, 0 warnings
validate:static-publication: passed
```

Были найдены и исправлены missing `id` в `data/search-manifest.json` для:

```text
/karty/          → id: karty
/karty/avraam/   → id: karty-avraam
/map/            → id: map-connections
/hard-texts/     → id: hard-texts
```

---

## 3. Текущие предупреждения, которые не блокируют миграцию

`audit-pro.js` даёт 4 warnings:

```text
1. CSS total 418002 bytes exceeds budget 390000
2. site.css has 215 !important, above goal 200 but below ceiling 270
3. karty/avraam/index.html has large inline script 852 LOC
4. map/index.html cImg missing width/height
```

Интерпретация:

```text
[1–2] решать постепенно через design system/Astro components.
[3] решается картографическим data/engine extraction, не срочно.
[4] можно исправить малым patch, но не критично для Astro strategy.
```

---

## 4. Текущие GitHub workflows

### deploy.yml

Сейчас:

```text
push asset-only / workflow_run after IndexNow / manual dispatch
npm ci
fonts download
cache-bust
validate:static-publication
IndexNow key file
Pagefind build: npx pagefind --site . --output-path pagefind
.nojekyll
upload whole repo root
Deploy Pages
```

Профессиональный вывод:

```text
Astro нельзя просто подключить и сразу заменить deploy.yml.
```

Почему:

```text
сейчас deploy загружает корень repo;
Pagefind индексирует корень repo;
Astro будет собирать dist;
нужно не сломать IndexNow/cache-bust/validation/Pagefind;
```

### indexnow.yml

Сейчас:

```text
update-meta.js
cache-bust.js
validate:static-publication
commit auto meta/cache-bust
submit IndexNow to Bing/Yandex
```

Вывод:

```text
Astro migration должна учесть update-meta/cache-bust или заменить их новым build-time metadata pipeline только после пилотов.
```

### interactive/source audits

Есть scheduled runtime checks. Их сохранить.

---

## 5. Профессиональный безопасный путь

### Phase 0 — Keep legacy as source of production truth

```text
Production = current root HTML.
Astro = experimental/build-only.
No deploy change.
```

### Phase 1 — Add Astro under separate scripts

Добавить только:

```text
astro:dev
astro:check
astro:build
astro:preview
```

Не менять `build` и `deploy.yml`.

### Phase 2 — Build-only `/dev/astro-test/`

Astro собирает `dist`, но GitHub Pages production не меняется.

### Phase 3 — Shadow compare tooling

Нужен режим extractor для разных roots:

```text
legacy root → reports/legacy-contract.json
Astro dist  → reports/astro-contract.json
compare-url-contract.js legacy vs astro
```

Текущий `extract-url-contract.js` пока работает по repo root. Его нужно расширить флагом:

```bash
node scripts/extract-url-contract.js --root dist --out reports/astro-contract.json
```

### Phase 4 — About pilot

Перенести `/about/` в Astro, но deploy менять только после compare.

### Phase 5 — Deploy switch only for tested pages

На GitHub Pages без server routing сложно смешивать root legacy и Astro dist частично. Поэтому есть два безопасных варианта:

#### Вариант A — Astro копирует legacy assets/pages в dist

Astro build output становится полным сайтом:

```text
dist contains migrated Astro pages + copied legacy pages/assets
```

Плюс:

```text
один artifact dist
```

Минус:

```text
нужно настроить copy legacy carefully
```

#### Вариант B — отдельная branch/prototype deploy не production

Не менять production, пока Astro не умеет собрать полный сайт.

Рекомендация:

```text
Для GitHub Pages production лучше идти к варианту A: dist as full static site.
Но только после /about/ и first article pilot.
```

---

## 6. Главная техническая ловушка

GitHub Pages не даёт удобный path-level proxy/facade. Поэтому классический strangler через routing proxy невозможен без смены хостинга.

Значит strangler для static GitHub Pages должен быть build-time:

```text
Build facade, not runtime facade.
```

То есть:

```text
Astro build решает, какие страницы генерировать новым способом,
а какие legacy HTML просто копировать в dist.
```

---

## 7. Целевая build architecture для GitHub Pages

```text
src/                     — Astro new system
legacy/ or root legacy   — old HTML/assets during transition
scripts/copy-legacy.js   — copies not-yet-migrated pages/assets into dist
astro build              — generates migrated pages
postbuild copy           — fills dist with legacy pages not owned by Astro
validate dist            — contract compare
pagefind --site dist
upload dist
```

Важно: текущий repo root является production site. На переходном этапе лучше не физически перемещать всё в `legacy/` сразу, а сделать прототип в ветке и тщательно протестировать copy strategy.

---

## 8. Нужные новые скрипты перед production switch

```text
scripts/extract-url-contract.js --root --out
scripts/copy-legacy-to-dist.js
scripts/check-dist-parity.js
scripts/generate-search-manifest-from-content.js
scripts/generate-feed-from-content.js
scripts/generate-sitemap-from-content.js
```

Но не все сразу.

Минимальный следующий технический скрипт:

```text
extract-url-contract.js support --root and --out
```

---

## 9. Deploy.yml future change — only after readiness

Текущий deploy uploads root. Будущий Astro deploy должен upload `dist`:

```yaml
- run: npm run astro:build
- run: npx pagefind --site dist --output-path dist/pagefind
- run: touch dist/.nojekyll
- uses: actions/upload-pages-artifact@v3
  with:
    path: dist
```

Но это Level 6-ish change for pipeline and must wait.

---

## 10. Professional order of implementation

```text
PR 1: docs/scripts only — done mostly
PR 2: extractor --root/--out
PR 3: Astro scaffold no production deploy
PR 4: /dev/astro-test build-only
PR 5: /about/ Astro page in dist preview only
PR 6: dist parity checker
PR 7: first article MDX preview only
PR 8: decide dist-as-full-site copy strategy
PR 9: controlled deploy pipeline switch
```

---

## 11. Why not switch deploy now

Because current deploy has important behavior:

```text
cache bust
metadata update through indexnow workflow
static publication gates
Pagefind index
IndexNow key file
.nojekyll
```

Replacing it too early risks:

```text
stale assets
missing pagefind
missing verification files
broken sitemap/feed
lost IndexNow flow
uploading wrong root
```

---

## 12. Immediate small fixes recommended

```text
[done] search-manifest missing ids fixed.
[optional] add og:image:type to map/index.html.
[optional] add width/height or CSS aspect handling for map cImg.
[later] reduce CSS/!important via Astro componentization.
```

---

## 13. Final recommendation

Professional path:

```text
Do not replace deploy pipeline yet.
Do not move hosting.
Do not move all legacy files.
Make Astro prove itself in isolation.
Then create build-time strangler: Astro dist + copied legacy.
Only then switch GitHub Pages artifact from root to dist.
```

This is the safest way to migrate a static GitHub Pages site without runtime proxy.
