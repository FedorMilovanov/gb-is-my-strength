# Триаж 10 открытых PR — 2026-10-13

**Зачем:** у владельца накопилось 10 открытых PR, из которых два dependabot-а висят с падениями
с 12 октября (и с 6–8 сентября у их парных веток). Задача — сказать по каждому, что именно его
блокирует и что нужно решить, а не «перезапустить и посмотреть».
**Как получено:** `gh pr list --json statusCheckRollup` → для каждого упавшего чека id job'а →
`gh api .../actions/jobs/<id>` (имя упавшего шага); два лога прочитаны целиком (там, где причина
не следует из имени шага). **Ни один PR не мержился, не закрывался и не ребейзился; продукт не
менялся.**

## 1. Сводка

| PR | Ветка | Draft | behind/ahead | Чеки (pass/fail/skip/отменено) | Что это значит |
|---|---|---:|---|---|---|
| #2142 | `reconcile/baptist-ch01-authority-salvage-20260924` | нет | 130 / 1 | 2 / **0** / 1 / 0 | падений нет; ждёт решения по содержимому (1 уникальный файл) |
| #2143 | `genealogy/editorial-direct-name-batch-20260924` | да | 125 / 3 | 14 / **0** / 1 / 0 | падений нет; нужен un-draft + ревью |
| #2144 | `dependabot/npm_and_yarn/npm-non-major-…` | нет | 5 / 1 | 11 / **20** / 2 / 0 | **блокирован осознанным пином** — см. §2.1 |
| #2161 | `arena/avraam-preserve-ready-h1-20261002` | да | 91 / 1 | 17 / 2 / 4 / 1 | два упавших шага — см. §3.1 |
| #2162 | `arena/kod-da-vinchi-timeline-keyboard-20261002` | да | 91 / 1 | 0 / 1 / 0 / 0 | единственный прогон упал до контрактов — §3.2 |
| #2164 | `content/apostasy-five-part-series-20261003` | да | 91 / 5 | 17 / **0** / 4 / 0 | падений нет; нужен un-draft + ревью |
| #2168 | `arena/01a108e4-gb-is-my-strength` | да | 85 / 6 | 25 / 1 / 3 / 1 | один упавший шаг — §3.3 |
| #2179 | `dependabot/github_actions/github-actions-…` | нет | 5 / 1 | 82 / **11** / 7 / 0 | **блокирован реестрами пинов** — см. §2.2 |
| #2181 | `fix/karty-holding-mobile-overflow-2180` | нет | 5 / 1 | 14 / **0** / 3 / 0 | падений нет; готов к решению (rebase + merge) |
| #2183 | `arena/fbf6f1fd-gb-is-my-strength` (мой) | да | 0 / 11 | 14 / **0** / 3 / 0 | падений нет; draft по правилу «агент не мержит себя» |

Колонка «behind/ahead» — число коммитов относительно `main` (`d14da74`) на 2026-10-13.
Пять PR из десяти не имеют ни одного падения — они ждут только решения владельца.

## 2. Два PR, которым нельзя помочь перезапуском

### 2.1 #2144 (dependabot, `npm-non-major`) — 20 падений из 33: контракт требует точный `astro`

Доказательство (лог job 114693263717, шаг «Run npm run strangler:build:production-like»):

```
> gb-is-my-strength@1.6.3 astro:check
> npm run astro:7:satteri:contract && node scripts/astro-cli.mjs check
> node scripts/astro7-satteri-contract.mjs
ASTRO 7 SATTERI CONTRACT: FAIL — astro must be declared exactly as 7.2.9
##[error]Process completed with exit code 1.
```

Тот же шаг — единственный упавший ещё в 13 job'ах (`Bible App — chromium/webkit deep clicks`,
`Binary header + JSON-LD…`, `Chromium WebKit …` ×6, `Home…`, `Native owners…`, `Public surfaces…` ×2
и т. д.), поэтому «20 падений» — это одно и то же падение, размноженное по матрице.

Что именно делает ветка (`git diff main...branch -- package.json`):

```
-    "astro": "7.2.9",                 +    "astro": "7.3.8",
-    "@astrojs/sitemap": "3.7.3",      +    "@astrojs/sitemap": "3.7.4",
-    "@xyflow/react": "^12.11.5",      +    "@xyflow/react": "^12.12.0",
-    "playwright": "^1.62.1",          +    "playwright": "^1.64.0",
-    "react"/"react-dom": "^19.2.8",   +    "^19.3.0",
```

Пин задан не в CI, а в репозитории: `scripts/astro7-satteri-contract.mjs:29`
(`['astro','7.2.9']`), проверка — строка 38 (`must be declared exactly as`). Пин сработал ровно
так, как задумано: **это не поломка бота, а запрет на некоординированный подъём Astro.**

Решение владельца (два варианта, оба вне этой сессии):
1. **Отклонить PR** (закрыть без merge) — повышение версий не входит в текущий контур;
2. **Принять отдельным лейном:** поднять пин в контракте + прогнать все зависимые контракты
   (273 объявления action-пинов и родственные реестры), затем перегенерировать lock и перезапустить
   полный набор браузерных/сборочных проверок. Парная ветка `deps/npm-non-major-20260906-r2`
   (тоже про зависимости) ждёт ровно этого же решения — см. §5 файла
   `audit/BRANCH-CLEANUP-DISPOSITION-2026-10-13.md`.

### 2.2 #2179 (dependabot, `github-actions`) — 11 падений из 100: bump меняет SHA экшенов

Ветка поднимает `actions/setup-node` `v7.0.0 → v7.1.0` и `actions/upload-artifact`
`v7.0.1 → v7.0.2` — 169 замен в **74** файлах `.github/workflows/*.yml`.

Упавшие job'ы (все — контракты пинов, прав и провенанса, ни одного «содержательного»):

| Job | Упавший шаг |
|---|---|
| `exact-pins` | Enforce workflow and toolchain contracts |
| `guard` | Workflow policy contracts |
| `native-source-contract` | Validate workflow policy |
| `Machine writer lease and workflow CAS contract` | Enforce all registered write capabilities |
| `Consent, assets and release source contract` | Build-once release pipeline contract |
| `contract` | Prove redirect-chain, evidence redaction and workflow policy |
| `history-forensic` | Verify website-map force-reset provenance · Upload forensic inventory |
| `Regenerate pinned v2 corpus` | Regenerate v2 from pinned upstream inputs |
| `validate` / `validate-draft` | Enforce bounded Wave 11 / Wave 10 diff |
| `npm-audit` | Enforce dependency security contract |

Вывод: репозиторий держит пины экшенов в собственных декларациях (в т. ч. «273 declarations» из
`GLOBAL GITHUB ACTIONS PIN CONTRACT`, machine-writer-lease и контракт релизного конвейера).
Dependabot меняет `uses:` в 74 файлах, но **не** обновляет эти декларации — отсюда падения.
Решение владельца: принять координированно (обновить реестры + перепроверить контракты) или закрыть
PR; слепой «rebase» ничего не изменит.

## 3. Точечные падения (1–2 чека) — здесь помогает переrebase и разбор конкретного шага

1. **#2161** (`arena/avraam-preserve-ready-h1-20261002`): `guard :: Map initial-state regressions`
   и `Chromium + WebKit full-site menu contract :: Run full-site menu visual geometry contract`.
   Правка одна (`src/pages/karty/avraam/index.astro`), но она ломает начальное состояние карты и
   геометрию меню — это требует не «перезапуска», а правки самой ветки.
2. **#2162** (`arena/kod-da-vinchi-timeline-keyboard-20261002`): единственный прогон упал на шаге
   `guard :: Resolve live PR diff authority` — пайплайн не дошёл до контрактов вообще. Похоже на
   проблему резолва базы диффа у сильно отставшей ветки (behind 91); первый шаг — обновить ветку от
   `main` и перезапустить один job.
3. **#2168** (`arena/01a108e4-gb-is-my-strength`, он же цель #2162-соседа по содержимому):
   `Native owners + Chromium WebKit :: Run retained-capability browser contract` — падает браузерный
   контракт retained-capability; 25 других чеков зелёные, т. е. проблема локальна для этого шага.

Важно: у всех трёх веток `ahead` = 1–6 при `behind` 85–91, поэтому разумная последовательность —
сначала обновление от `main`, потом перезапуск; если шаг падает и на свежей базе, правку надо
разбирать в самой ветке.

## 4. PR без падений (решение только за владельцем)

* **#2181** `fix(karty): prevent narrow-screen overflow in map holding titles` — 14/0, не draft,
  behind 5. Готов: rebase/update branch → merge.
* **#2143** `data(genealogy): review first direct-name Synodal batch` — 14/0, **draft**;
  нужно снять draft и принять редакторское решение (5 уникальных файлов).
* **#2164** `content: replace single apostasy draft with five-part series` — 17/0, **draft**;
  пять новых MDX готовы, нужно решение по контенту.
* **#2142** `research(baptists): salvage chapter 1 authority reconciliation` — 2/0, behind 130;
  блокирует ветку-близнец `reconcile/ch01-pre-baptist-origins-research-20260911` (§5 диспозиции).
* **#2183** — мой PR, правила: draft, агент не мержит и не закрывает.

## 5. Что я не делал и почему

* Не трогал чужие PR (ни rebase, ни close, ни merge) — это решения владельца;
* не обновлял пины версий и реестры пинов — это отдельный лейн с прогоном всех контрактов;
* не «перезапускал до зелёного» там, где причина доказана (оба dependabot-PR),
  чтобы не создавать ложного впечатления прогресса;
* единственное, что подготовлено к применению — патч ECFA-ссылки:
  `audit/patches/ECFA-FW10-RZI-01-archive-repair.patch` (для отдельного Wave-11-only PR; проверен
  `git apply --check` на текущем `main`-состоянии файлов + `node scripts/diotrophes-wave11-faithful-witness-contract.mjs` → exit 0).
