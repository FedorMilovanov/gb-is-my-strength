# Phase Audit — safe stabilization log (2026-06-03)

Проект: `gb-is-my-strength` / `gospod-bog.ru`  
Правило работы: маленькие фазы, без агрессивного рефакторинга, с cache-bust и браузерной проверкой Playwright после рискованных изменений.

## Guardrails

- Не создавать новые runtime CSS/JS файлы: архитектура остаётся **5 CSS + 11 JS**.
- Не менять protected article/nagornaya structure без необходимости.
- Не трогать byline/JSON-LD/OG упрощениями.
- После CSS/JS: `npm run cache-bust`.
- Перед commit/push: syntax, validate, SEO, tokens, audit-pro, Playwright desktop+mobile.
- `audit/` держать чистым: последние 2–3 `audit-pro` отчёта, без `shots/` и `visual-audit-report.json`.

## Completed phases

### r61.7 — Safe cleanup + Playwright hardening

- Убран локальный audit/visual мусор.
- `scripts/visual-audit.js` получил portable Playwright path, `AUDIT_BASE`, `bypassCSP`.
- Добавлен `npm run visual-audit`.
- `404.html` получил description + OpenGraph meta.

### r61.8 — Safe CSS inline cleanup

- Inline CSS `404.html` перенесён в `css/site.css`.
- Дубли `.skip-link` удалены из `/biografii/` и `20-antisovetov`.
- Cache-bust обновлён.

### r61.9 — Biografii inline CSS migration

- `/biografii/` hub-only inline `@layer components` перенесён в `css/site.css`.
- `biografii/index.html`: inline `<style>` стало `0`.
- Breakpoint `720px` в перенесённом CSS приведён к каноническому `760px`.
- Cache-bust обновлён.

### r61.10 — Visual audit false-positive hardening

- Visual audit больше не считает багами intentional hidden states:
  - `aria-hidden` Hebrew backs;
  - pre-scroll article topnav title;
  - offscreen reveal cards;
  - image/gradient-backed hero text.
- Результат: `npm run visual-audit` → 0 filtered findings.

### r61.11 — 20-Antisovetov JS/HTML stabilization

- Fixed an `enhancements.js` reachability bug: the 20-Antisovetov strategic-map popover module was accidentally inside the homepage ambient-scripture early-return path.
- Closed unclosed hidden `data-pagefind-meta` spans in four article pages; they were swallowing visible article DOM under `display:none` spans.
- Closed malformed FAQ button spans in `20-antisovetov`, restoring proper FAQ layout semantics.
- Stabilized the page-specific FAQ handler in `enhancements.js`: it marks enhanced accordions, skips the generic competing handler, and synchronizes `.is-open` with canonical `.open` so both the inline premium styles and global grid animation work together.

## Verification matrix used

```bash
node --check js/*.js scripts/*.js sw.js
npm run cache-bust
npm run validate:all
npm run tokens:check
node scripts/audit-pro.js
npm run visual-audit
```

## Current known non-blocking debt

- `audit-pro`: CSS/JS byte budgets still warn.
- `articles/20-antisovetov-pastoru/index.html` still has a large page-specific inline CSS island. Treat it as high-risk: reduce only by proven duplicate chunks, one small patch at a time.
- `site.js` remains large; avoid broad rewrites. Prefer tiny guard/helper dedup patches with Playwright after each.

## Next safe candidates

1. 20-antisovetov inline CSS: extract only selectors proven not to conflict.
2. Image audit: verify used images by page context before deleting any asset.
3. JS micro-dedup: event-handler conflicts/guards first, not architecture rewrites.
