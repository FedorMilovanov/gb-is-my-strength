# Повторная проверка исправления `W106` / `W106b` на PR #2352 (`74f71d9cb9b5f63785d47392133b6c056728756e`)

Сборка `74f71d9cb9b5f63785d47392133b6c056728756e` (`ab401a1c fix(reader-w106): preserve reading position across nested modal locks` + `74f71d9c fix(reader-w106b): sync ReaderState precache asset revision`) выполнена в `/tmp/head-74f7-build` (Node `v22.23.4`).

- **Прогон [`research/reader-w57-audit/analytics/gill-panel-resize-state-repro.mjs`](../../research/reader-w57-audit/analytics/gill-panel-resize-state-repro.mjs):** код выхода **`0` (`PASS: all 4 cases preserved section and resume destination`)**:
  - `toc-control` (`844 → 844`): `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
  - `settings-control` (`844 → 844`): `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
  - `toc-resize` (`844 → 720`): `44%` / `#sec-pneumatology` → сохранено `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
  - `settings-resize` (`844 → 720`): `44%` / `#sec-pneumatology` → сохранено `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
- **Смежные сценарии (`74f71d9c`):**
  - `/articles/kod-da-vinchi/` (`#hmSectionBtn` и `#hmSettingsBtn`, ресайз `844 → 720 px`): `45%` / `#canon-timeline-title` сохраняются без искажения (`pass: true`).
  - Модалка «Моя библиотека» (`#gb-hl-panel`) на Gill II (`844 → 720 px`): `44%` / `#sec-pneumatology` сохраняются (`pass: true`).

[Лог прогона](r10-resize-verify.jsonl).
