# TEST_COVERAGE_GAP_ANALYSIS_2026.md — недостающие тесты и hardening-план

Дата: 2026-06-12  
Статус: итоговая проверка пробелов перед коммитом аудита и перед будущим Astro-рефакторингом.

---

## 1. Что уже хорошо покрыто

В текущем репозитории уже есть сильный набор проверок:

```text
validate.js                      — HTML/CSS/JS/link/image/SEO базовые проверки
seo-audit.js                     — SEO/meta аудит
check-design-tokens.js           — дизайн-токены
audit-pro.js                     — расширенный публикационный аудит
readable-audit.js                — readable/publication layer
editorial-lint.js                — редакционная политика
check-data-consistency.js        — consistency data/search/series
source-link-audit.js             — внешние источники
interactive-audit.js             — runtime интерактивные сценарии
visual-audit.js                  — визуальный аудит
check-workflows.js               — workflow policy
extract-url-contract.js          — URL/meta baseline
compare-url-contract.js          — contract compare
validate-map-routes.js           — integrity checks для route.json карт
```

Текущие команды проходят:

```text
npm run contract:extract ✅
npm run contract:compare ✅
npm run maps:validate ✅
npm run workflows:check ✅
npm run validate:static-publication ✅
```

---

## 2. Главный пробел №1 — extractor должен уметь root/out

Сейчас:

```text
scripts/extract-url-contract.js
```

анализирует repo root и пишет фиксированные:

```text
reports/url-contract-draft.json
reports/url-contract-draft.md
```

Для Astro нужен режим:

```bash
node scripts/extract-url-contract.js --root .    --out-json reports/legacy-contract.json --out-md reports/legacy-contract.md
node scripts/extract-url-contract.js --root dist --out-json reports/dist-contract.json   --out-md reports/dist-contract.md
```

Без этого нельзя безопасно сравнить:

```text
legacy root vs Astro dist
```

Приоритет:

```text
P0 перед Astro scaffold
```

---

## 3. Главный пробел №2 — dist parity check

Статус на 2026-06-15: **практически закрывается связкой** `dist-publication-audit.js` + `check-page-ownership.js` + `compare-url-contract.js` + `dist-smoke-audit.js` + `sw-dist-readiness-audit.js`.

Когда появится Astro `dist`, нужен отдельный script:

```text
scripts/check-dist-parity.js
```

Проверяет:

```text
[ ] все public URL из baseline есть в dist
[ ] все system files есть: CNAME, robots.txt, verification files, 404.html
[ ] sitemap.xml есть
[ ] feed.xml есть
[ ] manifest.json есть
[ ] sw.js либо есть, либо явно отключён/заменён
[ ] css/js/images/fonts referenced by legacy pages скопированы
[ ] Astro-owned pages не перезаписаны copy-legacy скриптом
```

Приоритет:

```text
P0 перед deploy switch to dist — текущая реализация уже входит в `npm run strangler:deploy-readiness`
```

---

## 4. Главный пробел №3 — page ownership test

Статус на 2026-06-15: **частично закрыто для текущего build-time strangler**.

Добавлено:

```text
migration/page-ownership.json
scripts/check-page-ownership.js
npm run page-ownership:check
npm run page-ownership:dist
npm run page-ownership:dist:production-like
```

Текущая модель: manifest объявляет non-implicit ownership exceptions (`astro`, `astro-noindex`, `built-app`), а публичные baseline pages, не перечисленные в manifest, считаются implicit legacy until promoted.

Покрыто сейчас:

```text
[x] no duplicate ownership — JSON route keys unique by construction
[x] every src/pages/* Astro route declared in migration/page-ownership.json
[x] Astro source route matches route key
[x] Astro-owned URL exists in dist
[x] Astro-owned URL is not byte-identical to legacy root copy
[x] build-only Astro route absent from production-like dist
[x] built-app entry copied to dist and remains noindex
[x] system files copied into dist
[x] baseline public URLs resolve in dist
```

Остаётся на будущие партии миграции:

```text
[ ] если legacy pages начнут явно перечисляться в manifest, потребовать owner для каждого URL
[ ] добавить per-route migration status report для batches
[x] copy manifest/dry-run log для legacy copy operation добавлен в `copy-legacy-to-dist.js`
```

Приоритет:

```text
P0 перед deploy switch to dist — текущий минимальный guard включён в strangler readiness
```

---

## 5. Главный пробел №4 — copy-legacy safety

Статус на 2026-06-15: **частично закрыто**.

Текущий:

```text
scripts/copy-legacy-to-dist.js
```

Имеет guards:

```text
[x] dry-run mode: node scripts/copy-legacy-to-dist.js --dry-run
[x] npm wrapper: npm run strangler:copy:dry-run
[x] no-overwrite Astro-owned files
[x] preserves existing dist files instead of overwriting silently
[x] logs copied file count / bytes / skipped Astro-owned routes
[x] copies required assets and required system files
[x] produces ignored operation manifest:
    reports/dist-copy-manifest.json
    reports/dist-copy-dry-run-manifest.json
```

Остаётся на будущие партии:

```text
[ ] classify unknown file conflicts more strictly when Astro starts emitting shared assets with legacy names
[ ] add per-route promotion report for batch migrations
```

Команды:

```bash
npm run strangler:copy:dry-run
node scripts/copy-legacy-to-dist.js
node scripts/copy-legacy-to-dist.js --omit-build-only
```

Приоритет:

```text
P0 перед full dist prototype
```

---

## 6. Главный пробел №5 — generated artifacts hygiene

Сейчас `reports/` генерируется при `contract:extract` и содержит timestamp.

Риск:

```text
случайно закоммитить нестабильные generated reports.
```

Рекомендация:

```text
Не коммитить reports/url-contract-draft.* как обычный артефакт.
Если нужен baseline — сохранить явно именованный stable snapshot:
reports/url-contract-baseline-2026-06-12.json
```

Нужен тест/политика:

```text
[ ] reports/*draft* не коммитить
[ ] baseline files именовать явно
```

Приоритет:

```text
P1 перед коммитом/PR discipline
```

---

## 7. Map route validation — усилить Ajv

Сейчас `validate-map-routes.js` делает integrity checks, а JSON Schema validation включится только если установить:

```text
ajv
ajv-formats
```

Нужно позже:

```bash
npm install -D ajv ajv-formats
```

И добавить:

```text
[ ] strict schema validation required in CI
[ ] schemaVersion checked
[ ] canonical checked
[ ] live maps require full SEO fields
[ ] sourceIds all exist
[ ] disputed places require debate/source
```

Приоритет:

```text
P1 перед расширением route.draft.json до всех 19 places
```

---

## 8. Search/Pagefind tests

Сейчас Pagefind строится в deploy workflow на repo root:

```bash
npx pagefind --site . --output-path pagefind
```

После Astro/dist должно быть:

```bash
npx pagefind --site dist --output-path dist/pagefind
```

Нужны тесты:

```text
[ ] pagefind/pagefind.js exists
[ ] pagefind index size below budget
[ ] key Russian benchmark queries return expected URLs
[ ] no admin/system/noindex pages indexed
[ ] data-pagefind-body present on article templates
[ ] data-pagefind-ignore on nav/footer
```

Benchmark queries:

```text
авраам
авраама
ур халдейский
римлянам 7
сердце
джон гилл
σάρκινος
חֶסֶד
```

Приоритет:

```text
P2 before switching search to Pagefind as production full-text
```

---

## 9. Accessibility tests missing

Текущий аудит покрывает много HTML hygiene, но нужны targeted Playwright keyboard tests:

```text
[ ] header navigation by Tab
[ ] mobile menu open/close by keyboard
[ ] command palette Ctrl/Cmd+K → input focus → Esc returns focus
[ ] search results keyboard navigation
[ ] map: zoom buttons keyboard accessible
[ ] map: places list keyboard accessible
[ ] map: marker/panel Esc behavior
[ ] modal/dialog focus return
```

Инструменты:

```text
@axe-core/playwright
manual keyboard smoke
Playwright tests for critical flows
```

Приоритет:

```text
P1 before React islands production
```

---

## 10. Visual regression missing

Нужны stable screenshots для:

```text
/
/about/
/articles/
/articles/kod-da-vinchi/
/karty/
/karty/avraam/
/map/
/404.html
```

Правила:

```text
[ ] one OS/browser in CI
[ ] disable animations
[ ] wait for fonts/images
[ ] mask dynamic content
[ ] review baseline changes manually
```

Приоритет:

```text
P2 before batch migration
```

---

## 11. Performance budget missing

Нужны budgets не как «оценка», а как CI/report:

```text
[ ] article page JS must not include React unless island used
[ ] total JS/CSS budget report
[ ] LCP image not lazy
[ ] image width/height/aspect ratio
[ ] pagefind size report
[ ] map JS size report
```

Lighthouse CI можно добавить позже сначала warning-only.

Приоритет:

```text
P2 after Astro scaffold, before mass migration
```

---

## 12. Service worker migration test

Сейчас есть `sw.js` и проверки precache.

Astro/dist переход должен решить:

```text
[ ] оставить sw.js?
[ ] обновить PRECACHE_ASSETS?
[ ] отключить старый SW?
[ ] не закешировать старые HTML навсегда?
```

Нужен test:

```text
[ ] sw.js references existing dist assets
[ ] CACHE_VERSION bumps when asset strategy changes
[ ] no stale root HTML after deploy
```

Приоритет:

```text
P1 before deploy switch to dist
```

---

## 13. Security tests missing

Уже есть security hygiene, но усилить:

```text
[ ] no secrets in repo/docs/reports
[ ] no .env committed
[ ] no tokens in workflow logs
[ ] no inline event handlers
[ ] no javascript: href
[ ] no unsafe eval/new Function
[ ] CSP readiness report
[ ] dependencies audit advisory report
```

Перед коммитом токена/пушем:

```text
никогда не коммитить token;
не вставлять token в docs;
не echo token в logs;
после push revoke token.
```

---

## 14. Token safety workflow

Если всё-таки используется GitHub token в этой среде:

```text
[ ] fine-grained token
[ ] only target repo
[ ] Contents: Read/Write
[ ] no workflow permission unless editing .github/workflows
[ ] short expiration: 1 day or less
[ ] revoke immediately after push
[ ] git remote should not store token permanently
[ ] verify git config does not contain token
```

Prefer:

```bash
GITHUB_TOKEN=... git push https://x-access-token:${GITHUB_TOKEN}@github.com/OWNER/REPO.git HEAD:branch
unset GITHUB_TOKEN
```

But safest:

```text
owner pushes locally.
```

---

## 15. Deployment smoke tests missing

After GitHub Pages deploy:

```text
[ ] GET / 200
[ ] GET /about/ 200
[ ] GET /sitemap.xml 200
[ ] GET /feed.xml 200
[ ] GET /robots.txt 200
[ ] GET verification files 200
[ ] GET /404.html 200 or custom 404 behavior checked
[ ] key CSS/JS/image assets 200
```

Future script:

```text
scripts/post-deploy-smoke.js
```

---

## 16. External systems checks missing

Manual after pilot:

```text
[ ] Google Search Console Live URL
[ ] Yandex Webmaster important pages
[ ] Yandex.Metrika pageview still fires
[ ] IndexNow key file available
[ ] Bing/Yandex IndexNow returns 2xx or warning not fatal
```

---

## 17. Priority roadmap

### P0 before Astro scaffold

```text
[ ] extractor --root/--out
[ ] generated reports policy
```

### P0 before deploy switch to dist

```text
[ ] dist parity checker
[ ] page ownership checker
[ ] copy-legacy safety script
[ ] service worker decision/test
```

### P1 before expanding maps

```text
[ ] Ajv schema validation in CI
[ ] map source/refs strict checks
```

### P1 before React islands production

```text
[ ] keyboard Playwright tests
[ ] axe smoke tests
```

### P2 before batch migration

```text
[ ] visual regression
[ ] Lighthouse/performance budget warning
[ ] Pagefind Russian benchmark
```

---

## 18. Итог

Текущий репозиторий уже хорошо защищён. Главные недостающие тесты связаны не с текущим legacy, а с будущим переходом:

```text
legacy root vs Astro dist parity;
build-time strangler ownership;
copy safety;
keyboard/a11y for React islands;
service worker transition;
Pagefind Russian search quality;
post-deploy smoke;
token/secret hygiene around push.
```
