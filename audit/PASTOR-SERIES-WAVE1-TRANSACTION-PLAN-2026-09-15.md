# ПЛАН ТРАНЗАКЦИИ ВОЛНЫ 1 — серия «Тёмная сторона кафедры» (2026-09-15)

**Назначение:** пошаговый план исполнения Волны 1 backlog'а (`PASTOR-SERIES-BACKLOG-2026-09-15.md`) —
файл за файлом, с точными строками, новыми значениями и верификацией. План составлен read-only-аудитом;
исполняет владелец в своём lane.

**Протокол безопасности (общая ветка):**
- все правки Волны 1 — **одна транзакция/один PR**: данные и guard меняются вместе, иначе CI
  (`pastor-series-visual-parity-audit.js`) заблокирует половину и спровоцирует откат;
- никаких частичных пушей: guard-скрипт охраняет старые константы и упадёт на полуготовом дереве;
- порядок шагов внутри транзакции не критичен, критична атомарность коммита.

---

## Шаг 0. Базовая линия (до правок)

```bash
cd gb-is-my-strength
git status --porcelain                      # пусто
node scripts/pastor-series-visual-parity-audit.js   # зелёный на старых константах
grep -c "<item>" feed-pastor-series.xml     # 2  (только Досье A и Часть I)
grep -c "<loc>" sitemap-pastor-series.xml   # 3  (landing + I + Досье A)
grep -o 'reviewStatus[^,]*' data/editorial-metadata-supplements/pastor-series-ii-ix-20260908.json | sort | uniq -c  # 8 × migration-freeze-unverified
```

**Измеренная правда (основа пересчёта):** convention сайта ≈200 слов/мин (Часть I: wordCount 13321 ↔ 67 мин).
Фактический объём статей в собранном `dist` (текст внутри `<article>`, 200 wpm):

| Часть | slug | канон сейчас | измерено | новое значение |
|---|---|---|---|---|
| I | 20-antisovetov-pastoru | 67 | ≈68 | **67 (оставить)** |
| II | anatomiya-padeniya-pyat-stadiy | 29 | ≈9 | **9** |
| III | teksty-pisaniya-kotorymi-manipuliruyut | 36 | ≈14 | **14** |
| IV | sem-tipov-razlichenie-uchiteley | 30 | ≈9 | **9** |
| V | cerkovnaya-disciplina-vlast-granicy-zashchita | 34 | ≈11 | **11** |
| VI | kogda-uhodit-kogda-ostavatsya | 33 | ≈11 | **11** |
| VII | vernye-i-neizvestnye-zdorovoe-pastyrstvo | 31 | ≈14 | **14** |
| VIII | priznaki-zdorovoy-cerkvi | 30 | ≈11 | **11** |
| IX | nesovershennyy-chelovek-v-nesovershennoy-cerkvi | 31 | ≈11 | **11** |
| **ядро I–IX** | | **321** | **≈157** | **157** |
| Досье A | diotrefy-nashego-vremeni | 35 | ≈15 | **15** |

Кумулятивы прогресс-рельсы (done-min перед частью): I 0, II 67, III 76, IV 90, V 99, VI 110, VII 121, VIII 135, IX 146.

*Альтернатива (решение владельца):* сохранить 321 как «полный курс с упражнениями», но тогда каждая
витрина обязана нести честную подпись («157 мин чтения + практика»), и пункты T1.4–T1.7 меняются
только в части подписей. Рекомендуемый вариант — честный пересчёт (таблица выше).

---

## T1. Правда времён чтения (WU-1.3, P0-3) — полный инвентарь правок

Минуты сегодня продублированы в **восьми** местах. Все правятся в одном коммите:

**T1.1 `data/series.json`** — реестр серии (SSOT-кандидат):
`pastor-series.parts[]`: readingTime 29→9, 36→14, 30→9, 34→11, 33→11, 31→14, 30→11, 31→11 (n1=67 остаётся).
Проверить наличие записи Досье A (companion) — если есть readingTime 35 → 15.

**T1.2 `src/components/article-pilots/_shared/series/pastorSeriesConfig.ts`:**
- строка 14: `const CORE_TOTAL_MIN = 321;` → `157`;
- items (строки ~40,48,56,64,72,80,88,96): `readingTime: '29 мин'`→`'9 мин'`, `'36 мин'`→`'14 мин'`,
  `'30 мин'`→`'9 мин'`, `'34 мин'`→`'11 мин'`, `'33 мин'`→`'11 мин'`, `'31 мин'`→`'14 мин'`,
  `'30 мин'`→`'11 мин'`, `'31 мин'`→`'11 мин'`; строка ~104 (Досье): `'35 мин'`→`'15 мин'`;
- pages: `readingProgressDoneMin/PartMin` (строки 139, 146, 153 и далее по V–IX/Досье) →
  новые кумулятивы из таблицы выше; `readingProgressTotalMin` наследует CORE_TOTAL_MIN автоматически.

**T1.3 `src/content/articles/*.mdx`** — frontmatter `readingTime:` в 9 файлах II–IX + Досье
(пример: `anatomiya-padeniya-pyat-stadiy.mdx:23` 29→9); Часть I (67) не трогать.
Эти значения питают `data-gbs2-part-min` общих страниц (PastorSeriesArticlePage.astro:171).

**T1.4 `src/components/pastor-series/PastorSeriesPageHead.astro:122`:**
`readingTime: 321` → `readingTime: 157`; `companionReadingTime: 35` → `companionReadingTime: 15`.

**T1.5 `src/components/pastor-series/PastorSeriesStatsSection.astro:11`:** витринная цифра `321` → `157`
(проверить подпись рядом — если «минут курса», формулировка остаётся валидной).

**T1.6 `src/components/pastor-series/PastorSeriesCardsSection.astro`:** кикеры карточек —
«Часть II · 29 мин»→«· 9 мин», III 36→14, IV 30→9, V 34→11, VI 33→11, VII 31→14, VIII 30→11, IX 31→11,
«35 мин» (Досье)→«15 мин». Часть I «67 мин» остаётся.

**T1.7 `src/pages/articles/20-antisovetov-pastoru/index.astro`:** в `<body>` хардкод
`data-gbs2-part-min="67"` (остаётся), `data-gbs2-total-min="321"` → `"157"`.
Страницы II–IX берут атрибуты из config (T1.2) — отдельной правки не требуют, проверяются после пересборки.

**Не трогать:** `AntisovetovPageHead.astro` wordCount 13321 (честный), `numberOfItems: 9`.

## T2. Синхронизация guard'а (D-04) — тот же коммит, что T1

`scripts/pastor-series-visual-parity-audit.js`:
- строки 64–74, массив `expectedCore`: minutes 29→9, 36→14, 30→9, 34→11, 33→11, 31→14, 30→11, 31→11;
- строка 110: `must(head, 'readingTime: 321', …)` → `'readingTime: 157'`;
- строка 111: `must(head, 'companionReadingTime: 35', …)` → `'companionReadingTime: 15'`;
- строка 193: `equal(expectedCoreMinutes, 321, 'contract canonical-core minute total')` → `157`;
- `mustNot(head, 'readingTime: 356')` — **оставить** (356 по-прежнему неверно);
- строка 105 `must(head, 'href="…/feed-pastor-series.xml")` — **оставить** (T3 чинит содержимое фида, не ссылку);
- **рекомендуемая деривация:** вместо дублирования массива expectedCore читать минуты из `data/series.json`
  (guard уже его загружает, строка 60/178–191) — тогда SSOT один, и будущие правки времён не требуют
  синхронизации трёх таблиц.

## T3. Фид и sitemap серии (WU-1.4, P0-4)

Фактура: `feed-pastor-series.xml` (корень репо) — 2 item'а (Досье A 2026-08-01, Часть I 2026-05-12),
lastBuildDate 2026-08-01; `sitemap-pastor-series.xml` — 3 loc, lastmod 2026-08-02;
`robots.txt:123` уже рекламирует шард (правка robots не нужна).

1. Добавить в фид 8 item'ов II–IX (title/link/description из `data/series.json` + editorial-метадаты).
2. **Политика pubDate (решение владельца, согласовать с T4):** рекомендуемая — дата фактического релиза
   2026-09-08 для II–IX (фид должен отражать публикацию, а не рукопись); альтернатива — рукописные даты
   (2026-07-10/2026-09-06), но тогда и metadata остаётся на рукописных датах. Фид и metadata **не должны расходиться**.
3. `lastBuildDate` → дата транзакции.
4. `sitemap-pastor-series.xml`: 3 → 11 loc (landing + I–IX + Досье A), lastmod = согласованные даты.
5. Проверить основной `feed.xml`: записи II–IX уже есть с рукописными датами — привести к той же политике.
6. Прогнать нормализаторы и их тесты: `node scripts/rss-feed-normalizer-test.js`,
   `node scripts/sitemap-route-contract-test.js` (и сами нормализаторы, если они часть пайплайна сборки).
7. Контракты wave12 (`scripts/diotrophes-wave12-*.mjs`) ссылаются на discovery фида — не ломать ссылку (см. T2).

## T4. Editorial-метаданные (D-05)

`data/editorial-metadata-supplements/pastor-series-ii-ix-20260908.json` (8 записей):
- `reviewStatus: "migration-freeze-unverified"` → `"verified"` — **только после фактической перепроверки**
  владельцем (это не косметика: статус утверждает, что контент сверен);
- `editorialPublishedAt`: рукописные 2026-07-10/2026-09-06 → 2026-09-08 (релиз #1923) — или иное решение
  по политике T3.2, но единое для фида/sitemap/JSON-LD;
- `editorialModifiedAt` 2026-09-06/07 → фактическая дата последней правки (≥ даты публикации);
- после пересборки проверить downstream: JSON-LD `datePublished/dateModified` на страницах II–IX,
  `lastmod` sitemap, `pubDate` фида — всё из одного решения.

## T5. partToc частей II–IX (WU-1.2, P0-2)

`pastorSeriesConfig.ts`, записи pages II–IX (+ Досье A): сейчас `partToc: [...startToc]` (1 элемент).
Заменить на реальные массивы по H2 каждой части (12–21 пункт; id уже рукописные латинские — якоря стабильны):

1. Сгенерировать скелет (одноразово, вне репо):
```bash
python3 - <<'PY'
import re
for slug in ['anatomiya-padeniya-pyat-stadiy','teksty-pisaniya-kotorymi-manipuliruyut',
             'sem-tipov-razlichenie-uchiteley','cerkovnaya-disciplina-vlast-granicy-zashchita',
             'kogda-uhodit-kogda-ostavatsya','vernye-i-neizvestnye-zdorovoe-pastyrstvo',
             'priznaki-zdorovoy-cerkvi','nesovershennyy-chelovek-v-nesovershennoy-cerkvi']:
    h=open(f'dist/articles/{slug}/index.html',encoding='utf-8').read()
    print('==',slug)
    for m in re.finditer(r'<h2[^>]*id="([^"]+)"[^>]*>(.*?)</h2>',h,re.S):
        print("  { href: '#%s', label: '%s', level: 2, summary: '' }," %
              (m.group(1), re.sub(r'<[^>]+>','',m.group(2)).strip()[:70]))
PY
```
2. Редакторски заполнить `summary` каждой строки (одно предложение — это текст «Конспекта» в learning-sheet).
3. Исключения: служебные H2 (сервис-дубль) в TOC не включать; «Коротко» включать первым пунктом.
4. Эффект: оживает рельса «Оглавление части» и вкладка «Конспект» (заглушка D-03 исчезает автоматически —
   `outline.length` станет >0; вкладка «Термины» остаётся пустой до WU-2.3/gterm — это Волна 2).
5. Часть I: partToc уже заполнен (строка 120+, включая `#sec-quiz` «Проверь себя») — после T6 якорь обязан
   остаться валидным (он останется: id переносится вместе с блоком).

## T6. «Проверь себя» внутрь article (WU-1.7, E-01)

`src/components/article-pilots/antisovetov/AntisovetovBody.astro`:
- Текущее состояние: `<article …data-pagefind-body>` (строка 8) … `</article>` (строка 1122); затем aside «Нашли неточность»
  и **после него** `<h2 id="sec-quiz">Проверь себя</h2>` + `<div id="quizPlaceholder"></div>` (строки 1165–1166).
- Правка: перенести эти два элемента (h2 + quizPlaceholder) **внутрь article**, рекомендуемо — непосредственно
  перед `<section class="sources-block" id="istochniki">` (строка 1101): самопроверка до источников — логичный
  порядок; `</article>` не двигать; aside «Нашли неточность» и author-card остаются снаружи (это chrome).
- «Контекст и связи» **не трогать**: это post-build проекция `scripts/project-relations-to-dist.mjs`
  (строка 120), она по дизайну вне article и вне Pagefind-корня; уточнение E-01: претензия касается только «Проверь себя».
- Риск-чек: рантайм квиза ищет `#quizPlaceholder` по id — позиция внутри article не ломает рендер;
  TTS-проекция получит квиз-блок — интерактив исключается из озвучки штатно (buttons/aria-hidden в NON_PROJECTABLE).

## T7. Reconciliation + receipt (WU-1.5, P0-5) — lane владельца (Research/AuditRepo)

1. `research/pastor-series/MASTER-PLAN.md` и CONTENT-CLEARANCE: отразить факт публикации II–IX
   (PR #1923, 2026-09-08), новые канонические минуты (157/15), закрытые устаревшие секции.
2. В AuditRepo (`verified/`) — receipt-запись по модели: verify → close stale → repair confirmed → reverify;
   ссылка на коммит транзакции.

---

## Финальная верификация транзакции

```bash
npm run astro:build && node scripts/copy-legacy-to-dist.js
node scripts/pastor-series-visual-parity-audit.js          # зелёный на новых константах
node scripts/rss-feed-normalizer-test.js                   # зелёный
node scripts/sitemap-route-contract-test.js                # зелёный
grep -c "<item>" feed-pastor-series.xml                    # 10 (I–IX + Досье A)
grep -c "<loc>" sitemap-pastor-series.xml                  # 11
grep -rn "321\|companionReadingTime: 35" src/components/pastor-series/ data/series.json | wc -l   # 0
grep -o 'data-gbs2-total-min="[0-9]*"' dist/articles/*/index.html | sort | uniq -c                # все 157
grep -o 'reviewStatus[^,]*' data/editorial-metadata-supplements/pastor-series-ii-ix-20260908.json | grep -c unverified  # 0
python3 -c "h=open('dist/articles/20-antisovetov-pastoru/index.html',encoding='utf-8').read(); i=h.find('sec-quiz'); a=h.find('</article>'); print('sec-quiz INSIDE article' if 0<i<a else 'STILL OUTSIDE')"
```

Плюс визуальный чек владельца: рельса прогресса на II–IX (новые done-min), «Оглавление части» и «Конспект»
не пусты, карточки лендинга показывают новые минуты, RSS-клиент показывает свежие даты.

**Рекомендуемое сообщение коммита:**
`fix(pastor-series): truthful reading times, series feed/sitemap, partToc II–IX, self-check inside article; sync parity guard (Wave 1)`

**Откат:** транзакция атомарна — откат одного коммита возвращает согласованное старое состояние
(данные + guard вместе), полусостояний не возникает.

---

## Реестр поправок к предыдущим отчётам (verify-before-repair)

- **C-1 (D-01 опровергнут):** `article-strategic-map.js:142` ставит aria-label-fallback на все триггеры;
  строка «Открыть пояснение» присутствует в dist-бандле ReaderActionsRuntime → имя доступно в рантайме.
  Pass-2 измерял статическую разметку до гидрации. Переквалификация: P0 → P3-hardening (серверный aria-label).
- **C-2 (P0-1 уточнён):** карточки III–IX на лендинге живые и помечены «Опубликована»; «планируется» относится
  к другому хабу (Genesis6Hub). Остаток — визуальный класс заглушки `h-article-thumb--planned` у опубликованных
  карточек и задизейбленная карточка «Полевой справочник» без статус-тега. Переквалификация: P0 → P2 (Волна 4).
- **C-3 (E-01 сужен):** «Контекст и связи» — проекция dist-скрипта вне article по дизайну; претензия остаётся
  только к «Проверь себя» (контентный блок вне Pagefind/TTS-корня).
- **C-4 (уточнение pass-1):** таблица серии — в Части V = `cerkovnaya-disciplina-vlast-granicy-zashchita`
  (в pass-3 уже зафиксировано).
- **C-5 (D-04 расширен):** minutes-фикция продублирована в трёх независимых таблицах guard'а
  (expectedCore 64–74, must 110–111, equal 193) плюс `data/series.json` — всего 8 поверхностей;
  рекомендован перевод guard'а на чтение из реестра.
