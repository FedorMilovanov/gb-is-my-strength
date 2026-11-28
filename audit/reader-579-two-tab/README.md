# W107 — одна заметка, две вкладки (P0 #579)

Repair candidate на проверенном SHA **`968c0ad0`** — актуальный head Product Draft [#2352](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2352); исходная точка воспроизведения — `02c984111c6c45358da7aad435294baa84c5153e`.
Тесты исполняемые, действия — настоящий UI; подмена только при подготовке фикстуры.

## Что воспроизведено

Один Chromium-контекст = один профиль, две вкладки на одной статье.

| Сценарий | `02c98411` (без фикса) | после фикса |
|---|---|---|
| update/update, W57 ↔ W57 | 5/6 раундов: **текст одной вкладки потерян**, обе показывают «Заметка обновлена» | 0/6 потерь, **ровно один** отказ, черновик остаётся |
| create/create, две разные заметки | 6/6: **целая заметка исчезает** | 6/6: обе заметки на месте |
| update/update, Library ↔ Library | 6/6 «тихая» потеря | 0/6 |

Причина — не в проверках содержимого, а в записи: `notes()` → `map()` → `localStorage.setItem()`
(read-modify-write). Две вкладки читают список **до** того, как любая записала, и поздний `setItem`
затирает чужую запись. Guard `current.text !== editing.text` этого не видит, потому что сравнивает
уже устаревший снимок, и обе вкладки считают свой коммит успешным.

## Где исправлено

- `js/highlights.js` — единственный владелец записи: `commit(key, guard, mutate)`.
  Внутри `navigator.locks.request('gb-library:gb-reader-notes-v1')` заново читается список,
  сравнивается с открытой записью и только потом пишется. Без Web Locks — короткая lease-блокировка
  в `localStorage`. `saveNote` стал `async`, `showEditor` больше не хранит ревизию.
- `research/reader-w57-pilot/assets/reader_w57_annotations.js` — та же блокировка и тот же ключ:
  `withNoteLock()` + `commitNotes()`. Сравнение идёт с **открытой** записью
  (`openingSnapshot.noteId/noteState`), поэтому повторное сохранение в той же вкладке не блокируется,
  а правка в другой — отклоняется без перезаписи. `saveLinkedNote` стал `async`.
- `research/reader-w57-pilot/MANIFEST.json` — обновлены хэши изменённого исходника.
- `scripts/reader-w57-annotations-regression-test.mjs` — фикстура теперь асинхронная и получает
  `localStorage`/`navigator`/`window`/`CustomEvent`; квота эмулируется исключением из `setItem`,
  как в браузере. Добавлен импорт владельца коммита в вырезаемый фрагмент.

Обновление кэша: `sw.js` (`/js/highlights.js?v=a9d032c6`, `CACHE_VERSION=gb-v224-reader-note-write-serialization-20261122`),
`src/lib/asset-version.js` и 12 Astro-компонентов с ревизией `highlights.js` — результат штатного
`node scripts/cache-bust.js --write`; без него `Source contract` падал на stale-ревизии.

Сохранение стало асинхронным (сериализация), поэтому reader-visible результат
(`render()`/`sync()`/статус) вынесен в синхронный `applySavedNote()`, а контракт
`scripts/reader-library-premium-browser-contract.cjs` ждёт коммит через
`waitStore()`/`waitForFunction` — сами утверждения не ослаблены (4/4 ×3 прогона).

Старые заметки: новых полей нет, миграции нет, форма записи байт-в-байт прежняя
(`legacy-compat.mjs`: `textUpdated: true`, `otherFieldsUntouched: true`, `noNewFieldsInvented: true`).

## Запуск

```bash
# dist из SHA
git archive <SHA> | tar -x -C /tmp/mobile-<sha8>
cd /tmp/mobile-<sha8> && npm run strangler:build:production-like
READER_W57_DIST=/tmp/mobile-<sha8>/dist READER_W57_PORT=19227 \
  python3 research/reader-w57-pilot/preview.py

# два вкладочных прогона (один контекст = один профиль)
QA_BASE=http://127.0.0.1:19227 node audit/reader-579-two-tab/two-tab-concurrent.mjs
QA_BASE=http://127.0.0.1:19227 node audit/reader-579-two-tab/two-tab-sequential.mjs
QA_BASE=http://127.0.0.1:19227 node audit/reader-579-two-tab/legacy-compat.mjs
node research/reader-w57-pilot/verify.mjs
```

## Доказательства

- `evidence/before-02c98411.json` — базовый SHA, потеря воспроизведена.
- `evidence/after-fix.json` — тот же прогон на фиксе.
- `evidence/after-fix-built-final.json` — прогон на **собранном** дисте финального кандидата (после cache-bust: `highlights.js?v=ffea1bf8`, `CACHE_VERSION=gb-v224`).
- `evidence/sequential-after-fix-built-final.json` — 19/19: обе вкладки читают одну версию,
  update/update, delete/change, отсутствие воскрешения после reload.

## Границы

Проверено в Chromium (Playwright), эмуляция профиля, не физический браузер пользователя.
WebKit и настоящий многопрофильный сценарий не прогонялись. Блокировка синхронизирует вкладки
одного профиля; два разных профиля/устройства по-прежнему не имеют общей транзакции.

### Что изменилось в контракте W94b (и почему это не ослабление)

Сериализация записи сделала коммит заметки асинхронным (`navigator.locks`), поэтому
`scripts/reader-w57-two-tab-browser-contract.mjs` больше не может читать
`localStorage` синхронно сразу после клика. Вместо этого он ждёт точное ожидаемое
значение (`waitNoteState`) и канонический текст отказа (`waitStatus`). Сами
утверждения не изменились: те же 16 проверок, те же ожидаемые тексты и те же
отказы. Проверено мутантом: контракт падает на сборке без guard
(`stale W57 edit must be refused (status: "Заметка обновлена.")`) и проходит на
кандидате — то есть по-прежнему ловит потерю правки, а не подстраивается под неё.

### Слияние с базой (W121 / Metrika)

База ушла вперёд до `86806138` (W121: Learning quiz → Analytics). Конфликт был только
в `sw.js` (`CACHE_VERSION`): объединены обе версии —
`gb-v226-reader-note-write-serialization-20261123` (база перешла на v226 из-за skip-link-фикса). `MANIFEST.json` W57 после W121
консистентent (12 ассетов), cache-bust синхронен, `js/highlights.js` и
`reader_w57_annotations.js` базой не менялись, поэтому фикс писателей перенесён без
семантических изменений.

Отдельно: job «Chromium + Firefox + WebKit Reader controls and real-asset contracts»
падал и на самой базе `22811811`; база починила его коммитом `a77fae84`
(изоляция внешней Метрики в W94b-контракте). Кандидат перебазирован поверх `a77fae84`,
поэтому это падение больше не воспроизводится.

### Про `interactive-audit` (не наш дефект)

Гейт `interactive-audit` падает и на чистой базе (`64ea5d5f`, `86806138`) с теми же
пятью `quiz-missing-launch`: W121 перенёс квиз в Analytics
(`#gbAnalyticsStudy` / `.gb-study-inline-launch`), а проверка всё ещё требует
`#quizLaunch`. Мой кандидат код W121 не трогает (0 файлов quiz/analytics/gill в диффе)
и воспроизводит то же падение на базе — то есть это отдельная задача W121.
### Состояние CI на базе `968c0ad0` (W129 + W132)

База закрыла почти всё, что падало в моих прогонах. Проверено парой
«чистая база `git archive 968c0ad0`» ↔ «кандидат `44808008`»:

| Проверка | База `968c0ad0` | Кандидат `44808008` | Наш вклад |
|---|---|---|---|
| `reader-controls-a11y-browser-contract` | **294/294 PASS** | **294/294 PASS** | нет |
| `interactive-audit` | 2 issues | **те же 2** | нет |

- 21 a11y-падение Gill mobile bar снято фиксами W129 (44px Play/Search/Settings/Save,
  optical pitch, ink containment).
- `quiz-missing-launch` снято W132 (audit теперь смотрит канонический Analytics-квиз).
- Остались 2 × `command-palette-escape-did-not-close` (Gill часть 1 и «крайне ли
  испорчено сердце») — воспроизводятся и на чистой базе, то есть базовый дефект.

Собственные контракты записи заметок на кандидате: concurrent 8/8, sequential 19/19,
legacy 3/3.

### Фаза 1 внедрена: удаление заметки снимает обратную ссылку

`deleteItem()` удалял запись, но оставлял `quote.annotation.noteId` указывающим на
несуществующий id. Теперь удаление идёт цепочкой под локом:

1. снять `annotation.noteId` у всех цитат, ссылающихся на заметку (`commit(QUOTES_KEY…)`),
2. удалить саму заметку,
3. если шаг 2 упал — вернуть ссылки, чтобы отказ не оставил цитаты развязанными.

Если шаг 1 не удался, запись **не** удаляется (fail closed). Undo возвращает и запись,
и связь. Проверено `audit/reader-579-two-tab/delete-unlink.mjs` на собранном dist:

```
before:      { notes:1, quotePresent:true, noteId:"note-579-unlink" }
afterDelete: { notes:0, quotePresent:true, noteId:null }      ← цитата жива, ссылка снята
afterUndo:   { notes:1, quotePresent:true, noteId:"note-579-unlink" }
```

Обновлены два ожидания, которые кодировали прежнее багованное поведение:
`audit/.../twotab.mjs` и `scripts/reader-w57-two-tab-browser-contract.mjs` теперь
требуют `noteId === null` после удаления (устаревший писатель не имеет права
переставить ссылку), а не сохранения старого id.
