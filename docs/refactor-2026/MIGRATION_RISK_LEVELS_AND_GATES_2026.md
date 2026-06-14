# MIGRATION_RISK_LEVELS_AND_GATES_2026.md — уровни риска и gates миграции

Дата: 2026-06-12

---

## 1. Risk matrix

| Level | Тип изменения | Пример | Риск | Нужные проверки |
|---:|---|---|---|---|
| 0 | Docs/scripts only | новые .md, extract script | низкий | lint/run script |
| 1 | Build-only | Astro dev page noindex | низкий | build/check |
| 2 | One real page | /about/ | средний | contract + visual + SEO |
| 3 | Collection index | /articles/ | средний | links/sitemap/search |
| 4 | Content batch | 5 статей | средний/высокий | full validation |
| 5 | Interactive | map/search/palette | высокий | a11y/perf/e2e |
| 6 | Hosting | GitHub → Cloudflare/Yandex | высокий | full migration plan |

---

## 2. Gate checklist by level

### Level 0

```text
[ ] docs update
[ ] scripts run
[ ] no production output change
```

### Level 1

```text
[ ] astro check
[ ] astro build
[ ] no public URL replacement
[ ] dev page noindex
```

### Level 2

```text
[ ] URL unchanged
[ ] canonical unchanged
[ ] title/description present
[ ] h1 count == 1
[ ] JSON-LD expected types
[ ] screenshot review
[ ] no JS-only content
```

### Level 3

```text
[ ] generated list correct
[ ] all links valid
[ ] sitemap updated as expected
[ ] search manifest updated
[ ] no missing items
```

### Level 4

```text
[ ] all Level 2 for each URL
[ ] no orphan pages
[ ] related/series valid
[ ] feed/search/sitemap valid
[ ] visual sampling
```

### Level 5

```text
[ ] keyboard navigation
[ ] axe smoke
[ ] INP/performance sample
[ ] reduced motion
[ ] no content hidden behind JS only
[ ] mobile touch
```

### Level 6

```text
[ ] backup previous deploy
[ ] DNS/hosting checklist
[ ] 404/headers/verification files
[ ] sitemap/Search Console/Yandex
[ ] rollback tested
[ ] monitoring window
```

---

## 3. Release readiness score

Перед merge runtime PR:

```text
Contract: pass/fail
Build: pass/fail
SEO: pass/fail
Visual: accepted/rejected
A11y: pass/warn/fail
Performance: pass/warn/fail
Rollback: documented/not documented
```

Если любой critical = fail — не merge.

---

## 4. Critical failures

```text
public URL disappeared
canonical broken
robots noindex on public page
h1 missing/multiple on migrated page
main content not in HTML
sitemap missing public pages
feed broken
verification file missing
404 broken
```

---

## 5. Warning failures

```text
OG image missing on low-priority page
visual diff minor
performance warning but not regression
missing related articles
non-critical JSON-LD type changed
```

---

## 6. Approval rules

```text
Level 0–1: self-review ok
Level 2–3: checklist required
Level 4: sample visual review required
Level 5: manual keyboard test required
Level 6: separate launch window required
```

---

## 7. Итог

Не все изменения одинаковы. Миграция должна двигаться только через gates.
