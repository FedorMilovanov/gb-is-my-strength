# Герменевтика: строка MSJ в озвучке, «браузерный» PLAY и ширина статьи

**Дата:** 2026-11-02
**Маршрут:** `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`
**Прод:** `gospod-bog.ru`, релиз `bedc3c11910b7e7710bc8ca7ea9d01fc6d1926a3` (deploy run 2026-11-02, success)
**Источники истины:** текущий `main` + `migration/page-ownership.json` + `data/route-profiles/articles-hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki.json`; AuditRepo `projects/gb-is-my-strength` (MASTER, reverify, incoming); GitHub PR/issue history.

```md
Mode: LANE
Lane / owner: reader projection TTS exclusion (bounded)
Purpose and bounded scope: не читать библиографическую строку MSJ в озвучке; исследовать PLAY/движок и ширину без изменения owner-sensitive UX
Base / rollback SHA: bedc3c11910b7e7710bc8ca7ea9d01fc6d1926a3
Allowed files or surfaces: src/runtime/reader-projection.js, src/runtime/reader-tts.js, scripts/reader-projection-source-contract.mjs, audit/**
Adjacent active work / overlap: PR #2244/#2245/#2246 — только dependency bumps, TTS/reader не затрагивают
Source of truth: ReaderProjection (semantic owner) + reader-tts (speech consumer)
Required checks: reader-projection-source-contract, tts-engine-status-contract, tts-download-consent-contract, tts-ort-worker-path-contract, node --check
```

---

## 0. Что было прочитано перед работой

- `AGENTS.md`, `AGENTS-REFERENCE.md`, `docs/WORK_MODES.md`, `docs/OWNER-INVARIANTS.md`, `docs/ARTICLE-STANDARD-CHARTER.md`, `docs/DOCUMENT_AUTHORITY.md`.
- AuditRepo `AUDITREPO_OPERATING_MODEL.md`, `projects/gb-is-my-strength/verified/MASTER_BUG_MATRIX.md`, `reverify/2026-10-2x-*`, `incoming/tts-delivery-architecture-verification-2026-07-08/REPORT.md`.
- 5 191 коммит истории продукта через GitHub API (локальный клон shallow, поэтому история читалась удалённо), PR #2206, #2218, issue #238, #254, #264, #415.
- Ничего в правилах и AuditRepo не правилось — только прочитано.

---

## 1. Почему TTS читал «MSJ 27/2 (Fall 2016) 113–139»

### Причина

`src/runtime/reader-projection.js` — единственный семантический владелец читательского текста. `getTtsSegments()` собирает **все** блоки `h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd` внутри `article.article-body` и исключает только то, что перечислено в `EXCLUDE_SELECTOR`.

Строка выходных данных журнала лежит в шапке статьи как обычный абзац:

```html
<!-- src/components/article-pilots/hermenevtika/HermenevtikaBody.astro:52 -->
<p class="msjline">MSJ 27/2 (Fall 2016) 113–139</p>
```

В `EXCLUDE_SELECTOR` были `nav`, `aside`, `footer`, `[data-reader-exclude]`, `[data-no-speech]`, `.breadcrumb`, `.article-byline` и т. д. — но **не** `.msjline`. Поэтому строка попадала в `getTtsSegments()` и озвучивалась русским голосом как английская цитата. Это же касается `/articles/lot-i-sodom/` (`<p class="msjline">Экзегеза · Бытие 13–19</p>`).

Это не «битая вёрстка»: строка видима и должна печататься. Не хватало именно **речевой** политики, отдельной от печати/поиска.

### Что сделано

- `src/runtime/reader-projection.js:35` — добавлен речевой фильтр:
  ```js
  const TTS_EXCLUDE_SELECTOR = '.msjline, [data-tts-policy="exclude"]';
  ```
- `src/runtime/reader-projection.js:144-160` — `getTtsSegments()` фильтрует такие блоки **до** нарезки на чанки. Печать (`getPrintNodes`), поиск (`getSearchText`) и speakable-проекция не изменены: строка остаётся в статье и в PDF.
- `src/runtime/reader-tts.js` — тот же класс добавлен в bounded fallback-список `EXCLUDED_BLOCK` (используется только если проекции нет), плюс поддержан явный авторский маркер `[data-tts-policy="exclude"]`.
- `scripts/reader-projection-source-contract.mjs` — новый контракт `RP-TTS-08`, чтобы правило нельзя было молча удалить.

Проверено: `node scripts/reader-projection-source-contract.mjs` → **70/70 PASS**.

---

## 2. Почему PLAY играет «браузерную» озвучку

### Кто владеет кликом

1. `src/components/reader-platform/ReaderActionsRuntime.astro` подключает `js/vosk-tts-engine.js` (revisioned) и модули `reader-projection.js` → `reader-tts.js`.
2. `reader-tts.js` вешает capture-обработчик на `[data-fc-action="play"]` и забирает событие себе (`claim()`), поэтому старый `js/floating-cluster-controller.js` на Astro-маршруте уже не играет — он остаётся только как совместимость для не-Astro страниц.
3. Клик → `beginSession()` → `speakCurrent()` → `selectEngine()`.

### Точная причина

`src/runtime/reader-tts.js:326-333`:

```js
function selectEngine() {
  if (window.VoskTTSEngine?.isReady?.()) return 'vosk';
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
    void warmVosk();      // <-- только запускает загрузку/инициализацию
    return 'webspeech';   // <-- и сразу отдаёт сессию системному голосу
  }
  return 'vosk';
}
```

То есть **нейроголос используется только если модель уже полностью готова в момент клика**. Иначе первый PLAY по определению идёт системным голосом, а Vosk догружается в фоне. Это не регрессия, а зафиксированное продуктовое поведение:

- `js/floating-cluster-controller.js:561-577` (старый владелец) — то же самое, с комментарием «Пока модель не готова — используем Web Speech без задержки»;
- historical `AGENTS-REFERENCE` (pre-split, §TTS): «First "Слушать" click plays Web Speech and warms the ~280MB model in the background for next time — this implicit download is **intentional but pending an owner UX decision** (consent gate), do NOT remove or "fix" it unilaterally»;
- AuditRepo `incoming/tts-delivery-architecture-verification-2026-07-08/REPORT.md` §5 (W1-CI-38): тот же вывод, решение вынесено владельцу, код доставки не менялся.

### Почему «месяцами ничего не меняется»

«Готовность» Vosk — это не флаг, а завершённая цепочка в `js/vosk-tts-worker.js`:

1. `idbGet(MODEL_URL)` — кэш IndexedDB;
2. при промахе — `fetch('https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip')` (строка 9), это **~280 МБ**;
3. SHA-256 всего буфера должен совпасть с `EXPECTED_MODEL_SHA256 = '34e742ce…'` (строка 10, проверка `verifyIntegrity`, строка 186);
4. распаковка zip, запись в IndexedDB, создание ONNX-сессий (`ort.InferenceSession.create`).

Любой сбой на любом шаге (обрыв/таймаут 280 МБ, блокировка/замедление HuggingFace, смена байтов модели, квота/приватный режим IndexedDB, отсутствие `SharedWorker`/`Worker`/WASM) обрывает цепочку. Ошибка ловится в `warmVosk().catch()` и **не влияет на воспроизведение**: остаётся системный голос. В лог уходит только `console.warn` и цель Метрики `vosk_tts_failed`. Пользователь видит «старую озвучку» и ничего больше.

Отдельный риск, который аудит уже фиксировал в июле: URL модели **mutable** (`resolve/main/...`), а кэш-ключ и SHA прибиты гвоздями. Если модель на HF когда-либо перезалили — новые байты не совпадут с SHA, Vosk будет отклоняться **у всех и навсегда**, а внешне это выглядит как «работает браузерный голос». Рекомендация аудита — `resolve/<commit-sha>/model-quant.zip` — тогда так и не была внедрена.

### Что проверено и НЕ является причиной сейчас

- **CSP**: на живом маршруте `HermenevtikaPageHead.astro:8` разрешает `huggingface.co`, `*.aws.cdn.hf.co`, `cdn.jsdelivr.net`, а post-build `scripts/astro-cache-bust-postbuild.js:120-170` добавляет `'wasm-unsafe-eval'` во все HTML. Июльский дефект #415 (ONNX-WASM резался CSP) закрыт.
- **Ревизии ассетов**: `js/vosk-tts-engine.js → d1c35564`, `js/vosk-tts-worker.js → ccc621c4`, `css/tts-download-notice.css → b9ef192f` — совпадают с md5 файлов и с SW-precache.
- **Service Worker**: HTML — network-first, revisioned JS/CSS — network-first; застрять на старом бандле нельзя.
- **Деплой**: Pages `build_type=workflow`, последний деплой `bedc3c1` — success; `articles/.../index.html` — legacy-тень, а не публикуемая страница (`page-ownership.json`: source = `src/pages/articles/.../index.astro`).

### Единственный способ подтвердить на конкретном устройстве (30 секунд)

В консоли Яндекс.Браузера на странице статьи:

```js
window.VoskTTSEngine?.getStatus();                 // ready? loading? optedOut? workerMode?
localStorage.getItem('gbx-vosk-warmup');           // 'off' = пользователь когда-то отказался навсегда
await navigator.storage.estimate();                // сколько места и usage
indexedDB.databases?.();
```

и во вкладке Network фильтр `model-quant.zip` (статус/размер), а также `window.addEventListener('gb:vosk-status', e => console.log(e.detail))` перед нажатием PLAY. Три типовых исхода:

| Наблюдение | Диагноз |
|---|---|
| `gbx-vosk-warmup = 'off'` | модель отключена сохранённым отказом; кнопка «Включить» в уведомлении |
| запрос `model-quant.zip` падает/висит/`integrity mismatch` | сеть до HF или смена байтов модели (mutable URL) |
| `ready: true`, но звук системный | выиграл не тот владелец клика / старый бандл / другой маршрут |

### Почему я не поменял это «молча»

Изменение первого клика (ждать 280 МБ вместо мгновенного старта, либо consent-gate) — это ровно то решение, которое в репозитории и AuditRepo помечено как **owner decision**, а не баг. Самовольно его менять запрещено (`AGENTS.md` §5, historical AGENTS-REFERENCE).

Варианты для решения владельца:

| | Что делаем | Плюс | Минус |
|---|---|---|---|
| **A** | Оставить мгновенный системный старт, но сделать индикатор движка постоянным + авто-переключение на Vosk по готовности | ничего не ломает | «старый голос» в начале каждого визита остаётся |
| **B** | Consent-gate: «Нейроголос ~280 МБ — загрузить / системный» | честный трафик | большинство не нажмёт, нейроголос почти никто не услышит |
| **C** | При загрузке страницы в idle проверять **наличие модели в IndexedDB** и, если она есть, инициализировать Vosk заранее | первый клик сразу нейроголосом, без лишнего трафика | нужен cache-probe в worker (новая небольшая поверхность) |
| **D** | Прибить модель к immutable revision HF + зеркало, доступное из РФ; сверять SHA | убирает целый класс «навсегда сломалось» | нужен commit SHA модели и хостинг зеркала |
| **E** | Уменьшить модель/перейти на hosted-инференс | радикально решает 280 МБ | отдельный архитектурный проект |

Рекомендация: **C + D** как следующая bounded-полоса; A — как немедленное улучшение видимости. B/E — только по решению владельца.

---

## 3. Почему статья «узкая» и кто это должен был решить

### Фактическая геометрия (расчёт по текущей CSS-цепочке)

- `css/reader-preferences.css:18-21`: `narrow 36rem` / `normal 46rem` / `wide 52rem`.
- `src/components/article-pilots/_shared/ReaderSettings.astro:159-171`: `--hm-article-measure: var(--gb-reader-measure)`; оболочка `calc(measure + 6rem)`; каждый блок `.article-body > *` ограничен `max-width: var(--hm-article-measure)`.
- `src/components/article-pilots/_shared/ReaderRail.astro:275-295`: оболочка `min(52rem, доступное)`, читаемая ширина `min(46rem, оболочка − 48px)`.

Итог для «Обычно» на любом десктопе ≥1200px:

```text
колонка текста = 736px (46rem)
оболочка статьи = 832px (52rem)
слева рельс 270px + отступы 40+48px
```

Это **фиксированные 736px при любой ширине экрана**: на 1366, 1440, 1920 и 2560 — одинаково. На 1920 мониторе это 38% ширины и выглядит как узкая полоса. «Узко» (36rem) даёт 576px, «Широко» (52rem) — 832px.

### История вопроса (кто и когда)

| Дата | Что | Кто |
|---|---|---|
| 2026-10-26 | аудит нашёл «desktop measure aliasing»: на 1600px `normal` 752→712, `wide` 880→712, оба схлопываются из-за капа 760px | AuditRepo `reverify/2026-10-26-reader-material-glossary-tooltip-audit.md` |
| 2026-10-28 | **PR #2206** / merge `0e83c2a…`: убран обрыв на 1599/1600, шкала 36/43/44.5rem, кап 760px; audit-строка `GBS-READER-MEASURE-DESKTOP-ALIAS-AND-BREAKPOINT-REGRESSION` → `FIXED-CURRENT` | агентская полоса + owner merge |
| 2026-10-29 | **PR #2218** / commit `3ac4c06e` / merge `c8b8bde5…`: по прямой реплике владельца «дефолт узкий какой-то» — `normal 43→46rem`, `wide 44.5→52rem`, кап оболочки `760→900px` | владелец (PR author FedorMilovanov), локальные гейты зелёные |
| 2026-10-29 → | AuditRepo **не получил** evidence-пакет по #2218: волны 21–42 того дня разбирают PR #2217, а не measure | — |

То есть вопрос ширины **уже решался дважды**, последний раз — 29 октября, за 4 дня до этой сессии, и именно по жалобе владельца на узкий дефолт. Страница «Герменевтика» наследует новые токены (в #2218 у неё менялась только ревизия ассета в `HermenevtikaPageHead.astro`).

Открытых audit-строк «дефолт статьи слишком узкий» нет. В MASTER остаётся только другой, узкий остаток `GBS-SERIES-READER-COMPACT-DESKTOP-CAPACITY-CONFLICT` — cold first paint со сдвигом на 304px и пересечение компакт-бара с текстом на 1024px; к 736px колонке он отношения не имеет.

### Что это значит практически

- 736px — это **не незакрытый баг**, а текущее owner-approved значение (46rem ≈ 74–78 знаков в строке для кириллицы, обоснование в `css/reader-preferences.css:1-16`).
- Если на устройстве колонка заметно уже ~736px — почти наверняка сохранён режим «Узко» (36rem = 576px) в `gb:reader-preferences:v1` / legacy `gb:gill-measure:v1`; проверить: Настройки чтения → «Ширина статьи» → «Обычно/Широко».
- Если владелец хочет, чтобы статья **выглядела** шире на больших мониторах, это уже новое продуктовое решение (например, другой дефолт или более широкая композиция оболочки), а не восстановление потерянного фикса. Менять типографику «на вкус агента» запрещено (`AGENTS.md` §5.13), поэтому в этой полосе не менялось.

### Процессный вывод

Разрыв не в коде, а в цикле: продуктовая правка #2218 сделана и задеплоена, но AuditRepo не получил ни строки, ни reverify-пакета, а браузерные контракты в PR были отложены «за CI». Поэтому у владельца нет независимого подтверждения, что 46rem — это то, что он просил, а у аудита нет записи, что вопрос закрыт. Это стоит закрыть отдельной audit-волной (замер CPL/ширины на живом маршруте и запись disposition), а не новой правкой CSS.

---

## 4. Изменённые файлы

```text
src/runtime/reader-projection.js              +19 −9   речевой фильтр .msjline / data-tts-policy
src/runtime/reader-tts.js                     +2  −2   тот же фильтр в bounded fallback
scripts/reader-projection-source-contract.mjs +1  −0   контракт RP-TTS-08
audit/TTS-WIDTH-HERMENEVTIKA-INVESTIGATION-2026-11-02.md  (этот отчёт)
```

## 5. Проверки

```text
node --check src/runtime/reader-projection.js                PASS
node --check src/runtime/reader-tts.js                       PASS
node scripts/reader-projection-source-contract.mjs           PASS 70/70
node scripts/tts-engine-status-contract-test.js              PASS (16 mutations rejected)
node scripts/tts-download-consent-contract-test.js           PASS (14 mutations rejected)
node scripts/tts-ort-worker-path-contract.js                 PASS (3 mutations rejected)
```

Дополнительно — DOM-прогон (временный jsdom-стенд в `/tmp`, в репозиторий зависимости не добавлялись) на фикстуре «шапка статьи + msjline + byline + 2 абзаца»:

```text
ДО фикса    getTtsSegments() → ["MSJ 27/2 (Fall 2016) 113–139", "Оценка христоцентричной герменевтики", "Первый абзац статьи.", "Второй абзац."]
ПОСЛЕ фикса getTtsSegments() → ["Оценка христоцентричной герменевтики", "Первый абзац статьи.", "Второй абзац."]
print/getSearchText по-прежнему содержат строку MSJ (на печать и в поиск не влияет)
```

Браузерных прогонов в этой песочнице нет (Playwright не установлен), поэтому живой замер ширины и реальная загрузка 280 МБ модели не заявляются как проверенные; для них даны точные шаги проверки выше.

## 6. Открытые решения владельца

1. **TTS первого клика** — выбрать A/B/C (таблица §2). Рекомендация: C + D, затем A.
2. **Модель** — прибить URL к immutable revision и добавить доступное из РФ зеркало (D).
3. **Ширина** — если 736px недостаточно, зафиксировать новое целевое значение и проверить его браузерным контрактом + audit-строкой; это отдельная правка, не «потерянный фикс».
