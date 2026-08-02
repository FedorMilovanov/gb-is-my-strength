# A03 — единый NoteRegistry: чистое архитектурное ядро

**Дата:** 2026-08-02  
**Статус:** `CORE_EXACT_HEAD_VERIFICATION`  
**Production claim:** `no`

## Решение

Authored-разметка `.fn-marker:not(.map-trigger) > .tooltip` остаётся единственным
источником содержания примечаний. Production-like postbuild один раз собирает её
в `dist/data/note-registry.json` и создаёт семантические проекции.

`SiteUtils.makeTooltipController` остаётся единственным владельцем взаимодействия.
NoteRegistry не добавляет event listeners, второй controller или route-local runtime.

## Стабильная идентичность

1. Предпочтителен явный authored `data-note-id`.
2. Fallback строится из route, нормализованного текста примечания и ближайшего
   authored heading identity.
3. Ordinal хранится отдельно и не участвует в stable ID.
4. Изменение соседнего абзаца не меняет stable ID.
5. Два одинаковых примечания под одним heading блокируют сборку до добавления
   явных `data-note-id`; проектор не угадывает идентичность по случайному контексту.

## Проекции

- marker получает `data-note-id`, ordinal, `aria-controls` и `aria-describedby`;
- inline tooltip остаётся popover-источником существующего controller и исключается
  из Pagefind-дублирования;
- один статический endnote-блок обслуживает screen reader, TTS, Pagefind, print и no-JS;
- CSS хранится один раз в `src/runtime/note-registry.css` и материализуется в
  `dist/css/note-registry.css`; большой inline style в каждую страницу не копируется.

## Fail-closed границы

Сборка останавливается при orphan marker, непрямом или множественном tooltip,
пустом содержании, неверном/дублирующемся stable ID, authored ordinal drift,
nested interactive control, malformed generated block, отсутствии stylesheet
или полном отсутствии authored notes в production-like dist.

## Что намеренно не входит в core

- переписывание `js/site.js` и `css/site.css`;
- WebKit/touch/click normalizer-цепочки;
- route-local CSS fixes;
- tracked generated HTML и массовые cache-bust ревизии;
- изменения Wave 12, RSS, sitemap и соседних release-contracts.

Эти задачи могут быть отдельными узкими PR только с собственным доказательством.
Core не зависит от них и не использует их как скрытое условие корректности.
