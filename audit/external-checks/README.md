# Внешние проверки — verified registry

**Дата первичной верификации:** 2026-06-27
**Коммит:** `819fd3f`
**Назначение:** единая точка входа для внешних проверок качества сайта/репозитория. Не плодить разрозненные MD-файлы и не добавлять в CI инструменты, которые не были реально запущены и оценены.

## Правила для агентов

1. Перед добавлением новой внешней проверки сначала проверь её здесь.
2. Если проверка уже помечена как `REJECTED` или `CONFIG-FIRST`, не добавляй её заново без новой причины.
3. Все найденные баги заноси в общий отчёт `docs/BUGS_FOUND_2026-06-25.md`, а не в отдельные баг-списки.
4. Сырые логи не коммитить по умолчанию. Для воспроизведения используй команды ниже; артефакты держи в `/tmp` или `reports/` только если владелец попросил.
5. В Arena обязательно сначала прочитать `docs/SANDBOX-ENV-2026-06-21.md`: нужен Node 22 из `/tmp` и Playwright deps.

## Local Windows runner

For Fedor's workstation (`C:\Users\Fedor\Projects\gb-is-my-strength`) use:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd C:\Users\Fedor\Projects\gb-is-my-strength
.\audit\external-checks\run-local-windows-audit.ps1
```

Local-only/rejected-in-Arena decisions are tracked in `audit/external-checks/LOCAL-WINDOWS-AUDIT.md`.

## Быстрый setup в Arena

```bash
cd /home/user/repo
if [ ! -x /tmp/node-v22.12.0-linux-x64/bin/node ]; then
  wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz
  tar -xf /tmp/node22.tar.xz -C /tmp/
fi
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm ci
sudo npx playwright install-deps chromium
npx playwright install chromium
npm run strangler:build:production-like
npm run pagefind:build:dist
```

## Верифицированные внешние проверки

| Статус | Проверка | Команда / способ | Результат 2026-06-27 | Решение |
|---|---|---|---|---|
| `KEEP` | `actionlint` | binary from `rhysd/actionlint` releases → `actionlint -color=false .github/workflows/*.yml` | `PASS` | Добавлять в CI полезно: ловит синтаксис/expr GitHub Actions. |
| `KEEP` | `npm audit --json` | `npm audit --json` | `FAIL`: 8 vulnerabilities, `3 low`, `5 moderate` | Держать как dependency gate, но не делать `--force` автоматически. |
| `KEEP` | OSV Scanner | `osv-scanner scan --lockfile package-lock.json --format json` | `FAIL`: найден `esbuild 0.27.7`, `GHSA-g7r4-m6w7-qqqr`, LOW | Полезное независимое подтверждение dependency-risk. |
| `KEEP` | Retire.js repo scan | `npx -y retire --path . --outputformat json --exitwith 0` | `PASS`: vulnerable JS libs not found | Полезно weekly/локально; быстрый. |
| `KEEP` | Retire.js dist scan | `npx -y retire --path dist --outputformat json --exitwith 0` | `PASS` | Полезно после build, проверяет shipped JS. |
| `KEEP` | Pa11y | `npx -y pa11y URL --reporter json --standard WCAG2AA` | `/about/ PASS`, `/ FAIL`: 45 contrast errors | Реально полезно: нашло проверяемый a11y-баг на home. |
| `KEEP` | Lighthouse | `CHROME_PATH=<playwright chromium> npx -y lighthouse URL --output=json ...` | `/`: Perf 66, A11y 95, BP 75, SEO 100; Gill part1: Perf 31, A11y 90, BP 75, SEO 100 | Полезно как **диагностический** perf/a11y отчёт. Не превращать сразу в жёсткий gate: локальный `python3 http.server` не даёт gzip и искажает часть perf-аудитов. |
| `KEEP` | Linkinator | `npx -y linkinator http://127.0.0.1:8090/ --recurse --format json ...` | `PASS`: 346 local links checked | Очень полезно для internal-link smoke после build. |
| `KEEP` | Semgrep CE | `semgrep scan --config p/ci --json .` | `PASS runtime`, но 1 blocking finding: GHA template injection in `shared-files-guard.yml` | Полезно как security SAST для workflow/code. |
| `KEEP` | Checkov GitHub Actions | `checkov -d .github/workflows --framework github_actions --output json` | `FAIL`: 1 policy finding `CKV_GHA_7` in `visual-parity.yml` manual inputs | Полезно, но результаты требуют triage: часть policy-строгая. |
| `KEEP` | detect-secrets | `detect-secrets scan --all-files ...` | `PASS command`, 5 high-entropy candidates; похожи на hashes/assets, не verified secrets | Полезно, но нужен baseline/allowlist, иначе шум. |
| `KEEP` | Gitleaks | `gitleaks dir . --redact --report-format json` | `PASS`: 0 leaks; skipped >2MB artifacts | Хороший secret gate, лучше detect-secrets для CI. |
| `KEEP` | zizmor | `zizmor --format json .github/workflows` | `FAIL`: 34 findings (`unpinned-uses`, `artipacked`, `template-injection`, `dangerous-triggers`) | Полезно для GHA hardening; не включать как blocking без allowlist/решения владельца. |
| `CONFIG-FIRST` | html-validate | `npx -y html-validate 'dist/**/*.html' --formatter json` | `FAIL`: 1591 errors on 53 files | Инструмент работает, но default rules слишком шумные для текущего HTML/Astro output. Нужен `.htmlvalidate.json` с проектными правилами, иначе не добавлять в CI. |
| `REJECTED` | `npx actionlint` | `npx -y actionlint -version` | `BROKEN`: npm не определяет executable | Не использовать npx-вариант. Использовать release binary. |
| `REJECTED` | `npx osv-scanner` | `npx -y osv-scanner ...` | `BROKEN`: package not found in npm registry | Не повторять. Использовать release binary `google/osv-scanner`. |

## Проверки проекта, которые раньше ошибочно считались заблокированными

После чтения `docs/SANDBOX-ENV-2026-06-21.md` выяснилось: Node/Astro и Playwright в Arena запускаются нормально.

| Проверка | Результат после правильного setup |
|---|---|
| `npm run strangler:build:production-like` | `PASS` |
| `npm run pagefind:build:dist` | `PASS` |
| `npm run dist:jsonld:audit` | `PASS` |
| `npm run dist:css-parity` | `PASS` |
| `npm run sw:dist:audit:pagefind` | `PASS` |
| `npm run audit:premium-controls` | `PASS` |
| `npm run strangler:smoke` | `PASS` |
| `npm run smoke:maps` | `PASS`, если сервер на `127.0.0.1:8090` |
| `npm run smoke:maps:mobile` | `PASS`, если сервер на `127.0.0.1:8090` |
| `npm run smoke:content:mobile` | `PASS`, если сервер на `127.0.0.1:8090` |
| `npm run smoke:konfessii` | `PASS`, если сервер на `127.0.0.1:8090` |
| `npm run strangler:audit:production-like` | `FAIL`: stale `gbs2-rail` marker check, см. BUG-032 |
| `npm run interactive-audit` | `FAIL`: stale `.gbs2-*` selectors + possible mobile theme issue, см. BUG-033/035 |
| `npm run visual-audit` | `FAIL`: stale Gill cover selector, см. BUG-034 |

## Рекомендуемый внешний набор для CI/локалки

### PR / быстрый security-quality gate

```bash
actionlint -color=false .github/workflows/*.yml
npm audit --json
retire --path . --outputformat json --exitwith 0
gitleaks dir . --redact --report-format json --report-path reports/gitleaks.json
semgrep scan --config p/ci --json --output reports/semgrep.json .
```

### Weekly / scheduled deep gate

```bash
npm run strangler:build:production-like
npm run pagefind:build:dist
python3 -m http.server 8090 --bind 127.0.0.1 --directory dist
pa11y http://127.0.0.1:8090/ --reporter json --standard WCAG2AA
lighthouse http://127.0.0.1:8090/ --output=json --output-path=reports/lighthouse-home.json
linkinator http://127.0.0.1:8090/ --recurse --format json
zizmor --format json .github/workflows
checkov -d .github/workflows --framework github_actions --output json
```

## 30+ внешних ссылок, которые уже проверены как релевантные

1. Lighthouse CI configuration — https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
2. Lighthouse CI getting started — https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md
3. Lighthouse CI action — https://github.com/treosh/lighthouse-ci-action
4. Lighthouse docs — https://developer.chrome.com/docs/lighthouse/overview
5. Web.dev performance guidance — https://web.dev/learn/performance/
6. Pa11y README — https://github.com/pa11y/pa11y/blob/main/README.md
7. axe-core — https://github.com/dequelabs/axe-core
8. axe-core Playwright package — https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
9. html-validate — https://html-validate.org/
10. html-validate CLI — https://html-validate.org/usage/index.html
11. vnu-validate-html — https://github.com/mapbox/vnu-validate-html
12. actionlint — https://github.com/rhysd/actionlint
13. actionlint usage — https://github.com/rhysd/actionlint/blob/main/docs/usage.md
14. Semgrep CI — https://semgrep.dev/docs/semgrep-ci/sample-ci-configs
15. Checkov GitHub Actions policy index — https://www.checkov.io/5.Policy%20Index/github_actions.html
16. Retire.js — https://github.com/RetireJS/retire.js
17. Linkinator — https://github.com/JustinBeckwith/linkinator
18. GitHub Dependency Review Action — https://github.com/actions/dependency-review-action
19. GitHub dependency review docs — https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action
20. npm audit docs — https://docs.npmjs.com/cli/commands/npm-audit
21. OSV Scanner — https://github.com/google/osv-scanner
22. Gitleaks — https://github.com/gitleaks/gitleaks
23. Yelp detect-secrets — https://github.com/Yelp/detect-secrets
24. zizmor — https://github.com/woodruffw/zizmor
25. zizmor docs — https://docs.zizmor.sh/
26. OpenSSF Scorecard — https://github.com/ossf/scorecard
27. CodeQL Action — https://github.com/github/codeql-action
28. ShellCheck — https://github.com/koalaman/shellcheck
29. yamllint — https://github.com/adrienverge/yamllint
30. markdownlint-cli2 — https://github.com/DavidAnson/markdownlint-cli2
31. Stylelint — https://github.com/stylelint/stylelint
32. ESLint — https://eslint.org/docs/latest/use/command-line-interface
33. Playwright testing — https://playwright.dev/docs/intro
34. Lychee link checker — https://github.com/lycheeverse/lychee
35. Unlighthouse — https://unlighthouse.dev/
36. Google Rich Results Test — https://search.google.com/test/rich-results
37. Schema.org validator — https://validator.schema.org/
38. W3C Nu HTML Checker — https://validator.w3.org/nu/
39. Mozilla Observatory — https://observatory.mozilla.org/
40. Security Headers — https://securityheaders.com/


## Верификация — волна 2 (2026-06-27)

Дополнительно проверены инструменты, которые часто предлагают агенты для quality/security hygiene. Итог: часть полезна, часть нельзя делать blocking gate без конфигурации.

| Статус | Проверка | Команда / способ | Результат | Решение |
|---|---|---|---|---|
| `KEEP` | ShellCheck | `shellcheck -x $(find ... -name '*.sh')` | `FAIL`: 2 research shell scripts with `SC2002`, `SC2155` | Полезно для shell scripts и GitHub Actions embedded shell; добавить после triage старых research scripts. |
| `CONFIG-FIRST` | actionlint + ShellCheck integration | `actionlint -color=false .github/workflows/*.yml` after installing `shellcheck` | `FAIL`: shellcheck warnings in `indexnow.yml`, `visual-parity.yml`; Semgrep injection in `shared-files-guard.yml` fixed in lane | Полезно, но сначала поправить shell snippets или запускать syntax-only: `actionlint -shellcheck ''`. |
| `CONFIG-FIRST` | yamllint | `yamllint -d relaxed .github/workflows` | `FAIL`: many line-length warnings + one EOF issue fixed in lane | Не blocking без `.yamllint`; useful for syntax/style drift. |
| `CONFIG-FIRST` | markdownlint-cli2 | `npx -y markdownlint-cli2 "**/*.md" ...` | `FAIL`: 17k+ errors, mostly line-length/old research docs | Не добавлять blocking без scoped config. Можно использовать только на new docs / changed files. |
| `REJECTED` | CSpell generic scan | `npx -y cspell "**/*.{md,astro,js,ts,tsx,json}" ...` | `FAIL`: 306k+ unknown words because repo is Russian + transliterated slugs | Не использовать без `ru-RU` dictionaries/custom project dictionary. |
| `REJECTED-IN-ARENA` | Knip | `npx -y knip --reporter json`; retry with config + memory option | оба раза crash: `RangeError: Array buffer allocation failed` in `oxc-parser` | Не повторять в Arena. Можно переоценить локально на машине владельца с большим RAM and scoped config. |
| `CONFIG-FIRST` | depcheck | `npx -y depcheck --json` | `FAIL/NOISY`: false positives on `astro:content`, `_build-tools`, top-level `return` in Node scripts | Не blocking без ignore list. Useful only for dependency-cleanup lane. |
| `CONFIG-FIRST` | npm-package-json-lint | `npx -y npm-package-json-lint .` | `FAIL`: no config | Не добавлять без `.npmpackagejsonlintrc`. |
| `KEEP` | license-checker | `npx -y license-checker --summary` | `PASS`: license summary generated; includes LGPL/CC/Python categories for review | Useful as advisory dependency-license inventory, not blocking yet. |
| `KEEP` | madge circular deps | `npx -y madge --extensions js,ts,tsx,astro --circular src scripts` | `PASS`: 493 files, no circular dependency found | Useful low-noise structural check. |
| `KEEP` | Lychee local docs link check | `lychee --format json --exclude 'https?://.*' './README.md' './docs/**/*.md'` | `FAIL`: broken relative link in `docs/LANE_LOCK_POLICY.md`; fixed in lane | Useful for docs/internal links. Prefer local-only in PR, external links weekly. |
| `KEEP` | OpenSSF Scorecard | `scorecard --repo=github.com/FedorMilovanov/gb-is-my-strength --format=json --show-details` | Score `4.5`; weak areas: branch protection, code review, license file, pinned deps, SAST, token permissions | Useful as periodic repository posture check, not local PR gate. |
| `KEEP` | npm dependency tree integrity | `npm ls --all --json` | `PASS`: 0 dependency tree problems | Useful fast sanity check after dependency changes. |
| `KEEP-ADVISORY` | npm outdated | `npm outdated --json` | 5 outdated packages: `astro`, `@astrojs/react`, `@astrojs/mdx`, `@xyflow/react`, `pixelmatch` | Advisory only; upgrades require separate dependency lane + full Astro gates. |

## Wave 2 decisions for future agents

- Do **not** add generic CSpell until there is a Russian/custom dictionary. It is pure noise now.
- Do **not** rerun Knip in Arena unless memory/parser situation changes; two retries failed the same way.
- Do **not** add markdownlint/yamllint/html-validate as blocking gates without project-specific config.
- Prefer `madge`, `lychee local-only`, `ShellCheck`, `license-checker --summary`, and `Scorecard` as advisory checks.
- `actionlint` has two modes:
  - syntax-only: `actionlint -shellcheck '' .github/workflows/*.yml`
  - strict shell-aware: install `shellcheck` and run `actionlint .github/workflows/*.yml`


## Верификация — волна 3 (2026-06-27)

| Статус | Проверка | Команда / способ | Результат | Решение |
|---|---|---|---|---|
| `KEEP` | npm registry signatures | `npm audit signatures` | `PASS`: 476 packages with verified registry signatures, 106 attestations | Useful fast supply-chain check. |
| `KEEP` | lockfile-lint | `lockfile-lint --path package-lock.json --type npm --validate-https --allowed-hosts npm --validate-integrity` | `PASS`: no lockfile host/HTTPS/integrity issues | Useful PR gate for lockfile safety. |
| `KEEP` | JSON syntax scan | Node `JSON.parse` over repo JSON files excluding `node_modules`/`dist` | `PASS`: 90 JSON files, 0 parse errors | Useful fast data sanity check. |
| `KEEP` | XML syntax scan | `xmllint --noout` over XML/XSL files | `PASS` | Useful for sitemap/feed validation. |
| `CONFIG-FIRST` | Prettier | first `npx prettier --check`; retry with temp `prettier-plugin-astro` install | First run failed on `.astro` parser; plugin retry worked but reports many formatting diffs and one CSS parse issue in `css/site-layered.css` | Do not add blocking until project chooses Prettier config/plugins and excludes generated/layered CSS as needed. |
| `CONFIG-FIRST` | ESLint v9 | `npx eslint .` | `FAIL`: no `eslint.config.*` | Not useful until config exists. |
| `CONFIG-FIRST` | Stylelint | `npx stylelint ...` | `FAIL`: no Stylelint config | Not useful until `.stylelintrc` / standard config decision. |
| `KEEP-ADVISORY` | jscpd duplicate detector | `jscpd src scripts js css --format javascript,typescript,css --min-lines 12 --min-tokens 80` | `PASS command`, found 27 clones; especially duplicated visual-parity audit scaffolding and Gill visual-parity scripts | Useful refactor advisory; not blocking. |
| `KEEP-ADVISORY` | dependency-cruiser no-config | `dependency-cruiser --no-config --output-type err-long --include-only "^(src|scripts|js)" src scripts js` | `PASS`: no dependency violations, but only 0 dependencies cruised under no-config | Low value without config; keep as optional architecture-lane tool. |

## Wave 3 decisions for future agents

- `npm audit signatures`, `lockfile-lint`, JSON parse, and XML parse are low-noise and good candidates for fast checks.
- Prettier/ESLint/Stylelint are **not** ready as blocking gates; they require project config first.
- `jscpd` is useful to reveal duplicated audit scripts, but should produce refactor backlog, not fail CI.
- `dependency-cruiser` needs config to be valuable; no-config mode did not discover meaningful dependency graph for this repo.


## Верификация — волна 4 (2026-06-27)

| Статус | Проверка | Команда / способ | Результат | Решение |
|---|---|---|---|---|
| `KEEP` | Runtime interactive audit after v16 selector update | `AUDIT_BASE=http://127.0.0.1:8080 npm run interactive-audit` against root server | `PASS`: 41 pages, series/theme/search/media checks green | Keep as high-value runtime gate. It now supports both legacy `gbs2-*` and Gill v16 `gbs-*` UI. |
| `KEEP` | Visual audit after Gill cover selector update | `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` | `PASS`: 52 pages, 156 screenshots, 0 unsuppressed bugs | Keep as browser visual smoke. The stale `bio-cover-missing` false positive is removed. |
| `KEEP-ADVISORY` | axe-core Playwright | temp install `@axe-core/playwright`, scan `/`, `/about/`, Gill part1, Nagornaya part1 | Found real a11y backlog: contrast, `aria-hidden-focus`, glossary/abbr ARIA, nested interactive source marker | Useful as weekly a11y audit; not blocking until baseline/allowlist exists. |

## Wave 4 decisions for future agents

- `interactive-audit` and `visual-audit` are no longer stale on Gill v16 after this wave.
- axe-core is more precise than generic CSpell/markdownlint noise, but needs baseline before CI blocking.
- Remaining axe issues should be fixed in an accessibility lane: contrast, glossary tooltip ARIA, `selection-share-popup`, nested source marker.


## Верификация — волна 5 (2026-06-27)

| Статус | Проверка | Команда / способ | Результат | Решение |
|---|---|---|---|---|
| `KEEP-ADVISORY` | axe-core Playwright after a11y runtime fixes | scan `/about/`, Gill part1, Nagornaya part1 | `aria-hidden-focus` on `#selection-share-popup` closed; glossary `aria-allowed-attr` reduced/closed; remaining: contrast, nested source markers, link-in-text-block | Keep as accessibility backlog tracker. |
| `KEEP` | JS syntax checks for runtime fixes | `node --check js/site.js js/glossary.js js/floating-cluster-controller.js scripts/interactive-audit.js scripts/visual-audit.js` | `PASS` | Required after editing minified/runtime JS. |

## Wave 5 decisions for future agents

- The selection-share popup should remain `inert` while hidden; do not remove this or axe will report `aria-hidden-focus` again.
- Glossary hosts with `aria-expanded`/`aria-describedby` must have `role="button"` and `tabindex="0"`.
- Remaining axe work is mostly visual/content-level: contrast, nested source marker structure, and links distinguished by more than color.


## Верификация — волна 6 (2026-06-27)

| Статус | Проверка | Команда / способ | Результат | Решение |
|---|---|---|---|---|
| `KEEP` | actionlint strict shell-aware mode | `actionlint -color=false .github/workflows/*.yml` after ShellCheck install | `PASS` after fixing `indexnow.yml` and `visual-parity.yml` shell snippets | Promote from syntax-only to preferred workflow lint when ShellCheck is available. |
| `KEEP` | npm SBOM | `npm sbom --sbom-format cyclonedx --json` | `PASS`: CycloneDX 1.5, 476 components | Useful SBOM artifact check. |
| `KEEP` | CycloneDX npm SBOM | `cyclonedx-npm --output-format JSON --package-lock-only` | `PASS` | Useful alternative SBOM generator. |
| `KEEP` | Trivy secret/misconfig | `trivy fs --scanners secret,misconfig ...` | `PASS`: no secret/misconfig findings in scoped scan | Useful advisory scan. |
| `REJECTED-IN-ARENA` | Trivy full vuln DB scan | `trivy fs --scanners vuln,secret,misconfig ...` | failed before scan: DB download hit sandbox disk limit (`no space left on device`) | Do not retry full Trivy vuln DB in this Arena; use npm audit + OSV here, run Trivy full in CI/local with enough disk. |
| `KEEP-ADVISORY` | oxlint | `npx oxlint js scripts src` | `PASS command`: 0 errors, 1094 warnings | Useful no-config advisory linter; not blocking until warning budget/config exists. |
| `CONFIG-FIRST` | Biome | `npx @biomejs/biome check js scripts src --reporter=json` | `FAIL/NOISY`: 1466 errors, 2855 warnings, mostly formatting/import organization | Do not add as blocking gate without Biome config and migration decision. |

## Wave 6 decisions for future agents

- actionlint strict mode is now green; use it instead of syntax-only when ShellCheck exists.
- Full Trivy vulnerability scan is not practical in this Arena because DB download can exhaust disk; do not keep retrying it here.
- SBOM generation is low-noise and should be kept as a release/security artifact candidate.
- oxlint is useful as advisory; Biome is config/migration-first only.

## Не добавлять без новой верификации

- `npx actionlint` — не работает в npm-варианте; нужен бинарь.
- `npx osv-scanner` — не npm-пакет; нужен бинарь GitHub release.
- `html-validate` как blocking gate без конфигурации — слишком много шума.
- Lighthouse как жёсткий perf gate на `python3 http.server` — искажает gzip/cache/CDN-сигналы. Использовать как диагностический отчёт или запускать против production/preview с реальными headers.
