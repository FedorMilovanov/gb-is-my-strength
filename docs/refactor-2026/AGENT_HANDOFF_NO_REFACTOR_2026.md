# AGENT_HANDOFF_NO_REFACTOR_2026.md — handoff для следующих агентов

Дата: 2026-06-12  
Статус: **ИСТОРИЧЕСКИЙ HANDOFF, superseded 2026-06-18.** Тогда рефакторинг был запрещён; сейчас refactoring 4.5 уже перевёл production на Astro/strangler `dist`. Текущий документ истины: `docs/refactor-2026/REFACTORING_4_5_PRODUCTION_CUTOVER_AUDIT_2026-06-18.md`.

> Не удалять: этот файл объясняет, почему ранние шаги были осторожными. Но не использовать его как актуальный запрет на уже выполненный `dist` deploy.

---

## 1. Исторический режим работы на 2026-06-12

Владелец проекта тогда явно зафиксировал:

```text
Пока не делаем рефакторинги.
Другие агенты будут работать над статьями.
```

Поэтому этот пакет документов и скриптов тогда был **аудит/план/страховка**, а не разрешение менять архитектуру. С 2026-06-18 фактическая архитектура изменилась: production = `dist`.

---

## 2. Что можно было делать безопасно тогда

```text
[ ] править статьи и контент в текущей legacy-структуре;
[ ] запускать существующие проверки;
[ ] поддерживать sitemap/feed/meta через текущие scripts;
[ ] использовать docs/refactor-2026 как справочник;
[ ] расширять route.draft.json только без подключения к production;
[ ] добавлять новые исследования в docs/refactor-2026;
```

---

## 3. Что тогда НЕ делать без отдельного согласования

```text
❌ не устанавливать Astro зависимости;
❌ не менять deploy.yml на dist;
❌ не менять production build pipeline;
❌ не переносить страницы в MDX;
❌ не менять URL/canonical;
❌ не менять hosting;
❌ не включать Cloudflare/Vercel/Netlify;
❌ не подключать CMS;
❌ не переписывать карту Авраама UI;
❌ не удалять legacy HTML/CSS/JS;
```

---

## 4. Проверки перед коммитами статей

Минимальный набор:

```bash
npm run validate:static-publication
npm run workflows:check
```

Если затронуты карты/data:

```bash
npm run maps:validate
npm run data:consistency
```

Если затронуты URL/meta/sitemap:

```bash
npm run contract:extract
npm run contract:compare
```

`reports/` генерируется локально и не должен попадать в git.

---

## 5. Что уже добавлено этим аудитом

```text
docs/refactor-2026/                  — вся стратегия миграции/SEO/карт/тестов
scripts/extract-url-contract.js      — извлечение URL/meta baseline (`--root`, `--out-json`, `--out-md`)
scripts/compare-url-contract.js      — сравнение contracts / legacy root vs future dist
scripts/validate-map-routes.js       — проверка `karty/*/route.json`
karty/_shared/route.schema.json      — JSON Schema для карт
karty/avraam/route.json              — production data/full route для Авраама
karty/ishod/route.json               — scaffold data для будущей карты Исхода (валидируется `maps:validate`)
data/public-content-baseline.json    — тогдашний content baseline 42 public pages (сейчас 50)
```

---

## 6. Исторический следующий шаг — выполнен

Пункт `scripts/extract-url-contract.js --root/--out` выполнен, Astro scaffold выполнен, build-time strangler выполнен, root→dist switch выполнен. Дальше пользоваться актуальным post-switch audit, а не этим старым handoff.

---

## 7. Главный принцип

```text
One PR. One risk. One rollback.
```

Текущая задача агентов после refactoring 4.5 — развивать контент и Astro/MapEngine малыми проверяемыми шагами, не ломая `dist` production pipeline.
