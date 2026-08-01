# Agent 03 — единый NoteRegistry

**Дата:** 2026-08-01  
**Статус:** `EXACT_HEAD_VERIFICATION`  
**Production claim:** `no`

## Решение

Существующая authored-разметка `.fn-marker:not(.map-trigger) > .tooltip`
остаётся источником примечания. Production-like postbuild захватывает её один
раз в единый route registry и из него строит все финальные проекции.

`SiteUtils.makeTooltipController` остаётся единственным interaction owner.
Новый runtime/controller не создаётся.

## Stable ID и ordinal

- стабильный ID берётся из authored `data-note-id`, когда он задан;
- иначе используется route + hash нормализованного содержания примечания;
- document ordinal хранится отдельно в `data-note-ordinal`;
- перестановка примечания не меняет stable ID;
- authored ordinal drift блокирует сборку.

## Единые проекции

- body-mounted popover через существующий A04 controller;
- `aria-controls` на popover и `aria-describedby` на endnote;
- screen-reader endnotes;
- TTS `data-speakable` endnotes;
- Pagefind индексирует endnotes, а inline tooltip исключается;
- print endnotes;
- no-JS endnotes.

## Fail-closed границы

Блокируются orphan/multiple/empty notes, duplicate IDs, ordinal drift,
nested authored controls, duplicate final DOM IDs, malformed generated block
и отсутствие authored notes во всём production-like dist.

## Desktop pointer corridor

Floating tooltip shell остаётся hit-test transparent: новый interaction owner не
добавляется. Существующий controller удерживает открытый tooltip по геометрии
указателя. Коридор приведён к 28 px — тому же значению, которое уже использует
sticky path, — чтобы поздний reflow не закрывал примечание между marker и
body-mounted surface. Изменение прошло через существующий label-gated same-repo
autofix capability; label удалён до финального human-authored exact head.

## Параллельность

Karty PR #669 и Nagornaya PR #678 не пересекаются с NoteRegistry scope.
Их файлы не изменяются.

## Definition of done

- schema/registry и migration inventory;
- static mutation contract;
- production-like registry projection и idempotence;
- Chromium/WebKit mapping and interaction witness;
- Chromium no-JS and physical PDF witness;
- A04/glossary, route semantics, search/TTS and publication barriers green;
- review threads 0;
- guarded merge, merged-main verification, branch cleanup;
- Agent 04 и Agent 12 phase 2 handoff.
