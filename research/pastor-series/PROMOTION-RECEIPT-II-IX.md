# PROMOTION-RECEIPT — Parts II–IX: легализация публикации, якоря и продуктовный минимум

```
PUBLICATION_PROMOTION = APPROVED (owner decision)
DECISION_DATE         = 2026-09-15
DECISION_OWNER        = ФЁДОР МИЛОВАНОВ
DECISION_BASIS        = audit/PASTOR-SERIES-PRODUCT-AUDIT-2026-09-15.md §1 (расхождение статусов) и §12 (вариант B)
EXECUTION_LANE        = редакторский lane проекта, сессия Arena.ai, ветка arena/01a0a1b4-gb-is-my-strength (PR #2058)
SERIES_STATUS         = PUBLISHED, LEGALIZED
CONTENT_GATES         = PASS, кроме JURISDICTION_SAFEGUARDING_GATE = OPEN (§6) и BOUNDED_RE_CLEARANCE = REQUIRED (§5)
```

Части II–IX серии «Тёмная сторона кафедры» находились в противоречивом состоянии: исследовательские
receipts запрещали публикацию, тогда как публичные routes были собраны, проиндексированы и
присутствовали в sitemap. Настоящий документ фиксирует решение владельца: публикация
**разрешена и легализована**. Запретительные статусы объявляются утратившими силу; при этом
открытые содержательные и продуктовые позиции не закрываются, а переносятся в §8.

## 1. Статусы, утратившие силу

| Документ | Строка | Прежняя формулировка | Действует с 2026-09-15 |
|---|---|---|---|
| `CONTENT-CLEARANCE-II-IX.md` | :3 | `PUBLICATION PROMOTION = FORBIDDEN` | `PUBLICATION PROMOTION = APPROVED` |
| `CONTENT-CLEARANCE-II-IX.md` | :262 | `PUBLICATION_PROMOTION = FORBIDDEN IN THIS PR` | `PUBLICATION_PROMOTION = APPROVED BY OWNER DECISION` |
| `SOURCE-RECONCILIATION-II-IX.md` | :32, :119 | `PUBLICATION_PROMOTION = FORBIDDEN` | `PUBLICATION_PROMOTION = APPROVED BY OWNER DECISION` |
| `PART-V-SOURCE-ECCLESIOLOGY-RECEIPT.md` | :162 | `PUBLICATION_PROMOTION = FORBIDDEN` | как выше; `JURISDICTION_SAFEGUARDING_GATE = OPEN` сохраняется (§6) |
| `PART-VI-SOURCE-EXEGESIS-RECEIPT.md` | :160 | `PUBLICATION_PROMOTION = FORBIDDEN` | как выше |
| `PART-VII-SOURCE-CLAIM-MAP-RECEIPT.md` | :172 | `PUBLICATION_PROMOTION = FORBIDDEN` | как выше |
| `PART-II / III / IV / VIII / IX receipts` | :3 и итоговые строки | `NO PUBLICATION PROMOTION` | `PUBLISHED UNDER OWNER DECISION` |
| `MASTER-PLAN.md` | §11, §12 | ворота публикации как условие routes | routes легализованы; открытые позиции перенесены в §8 настоящего документа |

Порядок чтения документов серии после 2026-09-15: сначала настоящий receipt, затем
`SOURCE-RECONCILIATION-II-IX.md` и `CONTENT-CLEARANCE-II-IX.md` (содержательные шлюзы и
детализация по частям), затем частные receipts и `MASTER-PLAN.md` (канон серии).

## 2. Якоря

- **Продуктовое основание (публикация):** `origin/main` `02e182e4a950751521e2b0515637987785b6347f`,
  ветка `arena/01a0a1b4-gb-is-my-strength`.
- **Product clearance base:** `b5d89b276a3085161be205f22b56f53ddfc8e6f6`
  (`CONTENT-CLEARANCE-II-IX.md:12`) — точка сравнения для измерения расхождения рукописей (§5).
- **Product closure base:** `a0d45c13f56f6401aa9c9952165a9177d9292172`
  (`SOURCE-RECONCILIATION-II-IX.md:12`) — более раннее состояние тех же рукописей.
- **Research root authority:** `FedorMilovanov/Research@b5785be744bc8eac14491b972bb99005f1e81322`
  (`SOURCE-RECONCILIATION-II-IX.md:13`) — переносится без переутверждения; в этом lane не менялся.
- **Канон серии:** `research/pastor-series/MASTER-PLAN.md` (нумерация I–IX + Досье A без номера).
- **О нумерации строк:** номера строк исследовательских документов указаны по состоянию на
  2026-09-15 — после того, как в `CONTENT-CLEARANCE-II-IX.md` и `SOURCE-RECONCILIATION-II-IX.md`
  добавлены аннотации о утрате силы запретительных статусов (§1).

## 3. Ворота контента на момент решения

| Ворота | Статус | Основание |
|---|---|---|
| `SOURCE_GATE` | PASS 8/8 | `SOURCE-RECONCILIATION-II-IX.md` |
| `SCRIPTURE_EXEGESIS_GATE` / `ECCLESIOLOGY_EXEGESIS_GATE` | PASS | частные receipts II–VII |
| `CLAIM_MAP_GATE` | PASS | `CONTENT-CLEARANCE-II-IX.md`, `PART-VII/VIII/IX receipts` |
| `CONFESSIONAL_PRIMARY_LOCATOR_GATE` | PASS | `CONTENT-CLEARANCE-II-IX.md` |
| `FALSE_SYMMETRY_RED_TEAM` | PASS | `CONTENT-CLEARANCE-II-IX.md:252` |
| `CHRISTOLOGICAL_THEOLOGICAL_PASS` | PASS | `CONTENT-CLEARANCE-II-IX.md:254` |
| `PUBLIC_SOURCE_HYGIENE` | PASS | `CONTENT-CLEARANCE-II-IX.md:256` |
| `CROSS_LINK_CONTENT_CLEARANCE` | PASS (требовался атомарный выпуск) | `CONTENT-CLEARANCE-II-IX.md:258` |
| `MDX_STRUCTURE_AUDIT` | PASS | `scripts/mdx-structure-audit.js`: 64 файла, 0 ошибок, 0 предупреждений |
| `ENGINE_CONTRACTS` | PASS | `npm run engine:contracts` |
| `SERIES_READER_FRAGMENT_AUDIT` | PASS | 64 страницы, 1124 уникальные цели, 0 битых якорей |
| `PASTOR_SERIES_NATIVE_PUBLICATION_AUDIT` | PASS | `scripts/pastor-series-visual-parity-audit.js` |
| `PUBLIC_CONTENT_BASELINE` | PASS | `npm run content:guard` (43 базовые страницы) |
| `AUDIT_PRO` | PASS | `node scripts/audit-pro.js` |
| `JURISDICTION_SAFEGUARDING_GATE` | **OPEN** | §6 |
| `BOUNDED_RE_CLEARANCE` (идентичность рукописей) | **REQUIRED** | §5 |

## 4. Опубликованные рукописи на 2026-09-15

| Часть | Рукопись | Blob (после правок §7) |
|---|---|---|
| II | `src/content/articles/anatomiya-padeniya-pyat-stadiy.mdx` | `3164310b96439ca6a9b76e1483b95c0bbf116733` |
| III | `src/content/articles/teksty-pisaniya-kotorymi-manipuliruyut.mdx` | `4d50c537bc361283933f7f7c2b4b0b322d57ab20` |
| IV | `src/content/articles/sem-tipov-razlichenie-uchiteley.mdx` | `78bf36dac13581d80ad259daac54cbc7330e223e` |
| V | `src/content/articles/cerkovnaya-disciplina-vlast-granicy-zashchita.mdx` | `14bd4ee830e79bbf5e313e8e585bcd47d60bca31` |
| VI | `src/content/articles/kogda-uhodit-kogda-ostavatsya.mdx` | `369335c4af5de1dcf7e296e8e8be34d950bf6dc4` |
| VII | `src/content/articles/vernye-i-neizvestnye-zdorovoe-pastyrstvo.mdx` | `1262d0685eee58af370c7538d0988ceea996bd89` |
| VIII | `src/content/articles/priznaki-zdorovoy-cerkvi.mdx` | `6ba93bc40c98a5eef5556f4df963df06c0c84e48` |
| IX | `src/content/articles/nesovershennyy-chelovek-v-nesovershennoy-cerkvi.mdx` | `744354f5e95194a2d5f116fd680de5f609602ae1` |

Часть I (`20-antisovetov-pastoru`) и Досье A (`diotrefy-nashego-vremeni`) настоящим документом
не затрагиваются: их публикационные статусы зафиксированы ранее и сохраняют силу.

## 5. Расхождение рукописей с сертифицированными blob'ами

`CONTENT-CLEARANCE-II-IX.md:57` и `:264` устанавливают: любая содержательная мутация после
сертифицированных blob'ов инвалидирует вердикт по затронутой части и требует bounded re-review.
Измерение выполнено против product clearance base `b5d89b276a3085161be205f22b56f53ddfc8e6f6`
(объявлен в `CONTENT-CLEARANCE-II-IX.md:12`; объект получен точечным fetch):

| Часть | Certified blob (`CONTENT-CLEARANCE` §3) | Blob clearance base | Опубликованный blob | Изменений к clearance base |
|---|---|---|---|---|
| II | `15ce0f99dfcb` | `3bdd78ab9e9c` | `3164310b9643` | +7 / −12 |
| III | `1af73097730d` | `94d9c7a707a4` | `4d50c537bc36` | +8 / −15 |
| IV | `245d323aebf3` | `f53aa9f785fa` | `78bf36dac135` | +8 / −21 |
| V | `598d25d344aa` | `2c572a50e4d1` | `14bd4ee830e7` | +10 / −13 |
| VI | `6eb7fb5f958e` | `19686692b373` | `369335c4af5d` | +6 / −11 |
| VII | `4b451a066691` | `d2b0d9682cb9` | `1262d0685eee` | +11 / −17 |
| VIII | `fdbeb67bbff2` | `f1c9204ecfc4` | `6ba93bc40c98` | +16 / −23 |
| IX | `a823ec4e1afc` | `00d2643463c9` | `744354f5e951` | +12 / −18 |

Итого 78 добавленных и 130 удалённых строк на восемь частей.

Два отдельных вывода:

1. **Опубликованный текст не совпадает с сертифицированным.** Вердикты clearance выданы на
   текст, который больше не публикуется, — формальное требование bounded re-review не закрыто.
2. **Сертифицированные blob'ы не воспроизводятся из истории main.** Ни один из восьми blob'ов
   §3 `CONTENT-CLEARANCE-II-IX.md` не совпадает с деревом его же clearance base `b5d89b27`
   и не присутствует в доступных объектах репозитория (`git cat-file` — «could not get object
   info»). То есть blob-таблица clearance зафиксировала состояние рабочей ветки (Product #1899),
   а не состояние, вошедшее в main. Переутверждение вердиктов возможно только на текстовом
   уровне, не по blob-идентичности.

**Что именно менялось после сертификации** (проверено диффом по всем восьми частям):

- публикационный флаг: сняты `draft: true`, `noindex: true`, `contentStatus: "draft"` и
  служебные комментарии frontmatter («страница/маршрут ещё не собраны», «снять только при
  publication release», «Content-only manuscript: public route is intentionally absent»);
- удалены внутренние workflow-разделы и абзацы: «Редакционный hold» (IV, VII, VIII, IX),
  ссылки на пути bounded receipts (V, VI, VII), заголовки вида «Источники и publication gate» /
  «Источники и claim-map» → «Источники» (II, V, VI, VII, VIII, IX),
  «Исследовательская база и publication gate» → «Исследовательская база» (II);
- русифицирован читательский текст (S15): «prudential process» → «практическая процессуальная
  рамка» и «prudential governance diagnostics» → «практические признаки устройства и
  подотчётности» (VII), «prudential tests» / «prudential process questions» /
  «prudential financial control» / «safeguarding application» / «plurality» → русские
  соответствия (VIII), «Safeguarding, pastoral и confessional материалы… authority» →
  «Материалы по защите, пастырской практике и конфессиональной экклезиологии…» (III),
  «Parts VI и IX» → «части VI и IX» (IX);
- усилены юрисдикционные и safeguarding-оговорки: в части V добавлен абзац «Конкретные
  обязанности по сообщению, сохранению доказательств, защите детей и уязвимых взрослых
  зависят…»; в части VI расширена формулировка о правовых обязанностях («по стране, роли и
  характеру дела»); в части VIII сохранена оговорка о том, что конкретные правовые обязанности
  и маршруты зависят от юрисдикции;
- уточнены границы утверждений: «редакционная аналитическая рамка» → «аналитическая рамка» (IX),
  переименован раздел `#minimum` «Практический институциональный checklist» → «Практические
  контуры здорового устройства» (VIII);
- исправлена опечатка якоря `id="tri-osи"` → `id="tri-osi"` (II);
- правки этого lane в частях III и IV (§7): удалён мёртвый раздел «Нашли неточность?»,
  в IV раздел «Связанные рукописи серии» → «Связанные материалы серии» с русскими
  наименованиями и рабочими ссылками.

**Проверка потерь:** ни один URL источника не утрачен ни в одной из восьми частей (в части IX
добавлено 2 URL); библейские ссылки в читательских списках сохранены — единственное
«исчезнувшее» упоминание `Евр. 13:17` в части VII находилось внутри удалённого служебного
раздела «Редакционный hold», а не в корпусе цитат.

**Направление изменений** — гигиеническое и уточняющее: опубликованный текст строже
сертифицированного по формулировкам, чище по читательскому языку и содержит больше
юрисдикционных оговорок. Содержательных оснований снимать публикацию это расхождение не даёт.

**Вывод:** решение владельца легализует публикацию; bounded re-clearance всех восьми частей на
текущем тексте остаётся обязательным follow-up (§8, строка «Bounded re-clearance рукописей
II–IX»). Это переутверждение уже
выданных вердиктов на актуальном тексте, а не новая исследовательская работа.

## 6. Открытые ворота `JURISDICTION_SAFEGUARDING_GATE`

Единый jurisdiction/safeguarding pass — слой 2 из перечня проверенных gate-слоёв
(`CONTENT-CLEARANCE-II-IX.md:22–29`) — **не проводился сквозным методом по всем восьми
частям**. Решение владельца: публикация продолжается, pass остаётся обязательным follow-up
(§8, строка «Единый jurisdiction/safeguarding pass»).

Компенсирующие контроли, присутствующие в опубликованном тексте (номера строк — по рукописям
в `src/content/articles/` на 2026-09-15):

- **Часть V**, раздел «Церковная дисциплина и гражданская юрисдикция» (`:174`): разграничение
  церковной процедуры и гражданской ответственности; `:191` — «Конкретные обязанности по
  сообщению, сохранению доказательств, защите детей и уязвимых взрослых зависят от применимого
  права, роли и характера события»; `:285` — GRACE «не определяют требования закона конкретной
  страны и не заменяют проверку применимой юрисдикции».
- **Часть VI**: `:122` — «Мф. 18 не отменяет собственную юрисдикцию гражданской власти»;
  `:347` — GRACE «не заменяют проверку конкретных правовых обязанностей по применимой
  юрисдикции».
- **Часть VIII**: `:248` — «Конкретные правовые обязанности и маршруты зависят от юрисдикции,
  роли и характера события»; `:312` — GRACE «процедурные рекомендации не заменяют Писание и
  проверку применимого права».
- **Досье A**, note-box «Как читать этот материал» — разделение статусов (уголовный приговор,
  гражданское решение, независимое расследование, церковный вывод, публичное заявление), отказ
  от диагнозов и от новых прямых цитат.

Дополнительно: после сертификации текста оговорки усилены, а не ослаблены (§5) — в части V
добавлен отдельный абзац об обязанностях по сообщению и защите уязвимых, в части VI расширена
формулировка о правовых обязанностях. То есть опубликованный текст содержит больше
юрисдикционных границ, чем сертифицированный; открытым остаётся не текст частей, а отсутствие
единого сквозного pass'а по всем восьми частям и по Досье A одним методом.

Ограничение до проведения pass: новые материалы серии, содержащие юридические или
safeguarding-утверждения, не публиковать без отдельного clearance; правки существующих
формулировок по этим темам выполнять только вместе с pass'ом.

## 7. Правки рукописей, выполненные этим lane

Аргументация, экзегеза, цитаты и списки источников не изменялись. Выполнены три служебные
правки (учтены в цифрах §5 для частей III и IV):

1. **Часть III** — удалён раздел `## Нашли неточность?` (заголовок и один абзац, −4 строки).
   Раздел предлагал «сообщить редактору проекта», не давая способа связи.
2. **Часть IV** — удалён тот же мёртвый раздел (−4 строки).
3. **Часть IV** — раздел `## Связанные материалы серии`: латинские обозначения `Part II` /
   `Part VI` заменены русскими наименованиями частей с рабочими ссылками
   (`/articles/anatomiya-padeniya-pyat-stadiy/`, `/articles/kogda-uhodit-kogda-ostavatsya/`).
   Основание: S15 (единый язык читательского текста), S21 (навигация без тупиков).

Канал обратной связи заменён на работающий: на всех десяти страницах серии выводится единый
leaf-блок `src/components/about/AboutAccuracyBlock.astro` (почта и Telegram) — тот же, что в
Части I и в серии «Сердце». Основание: S22 («Исправимость»).

## 8. Follow-up после легализации

Публикация разрешена; продуктовное качество серии остаётся незавершённым. Номера позиций —
по спектру работ `audit/PASTOR-SERIES-PRODUCT-AUDIT-2026-09-15.md` §12 (пакеты 1–4).

Выполнено этим lane:

| № | Позиция | Результат |
|---|---|---|
| 2.1 | Заполнить `partToc` для 8 частей | **DONE** — 117 строк оглавления вместо 8 (по одной строке «Начало статьи» на часть). Оглавление работает в reader rail (счётчик `1 / N`) и в мобильном листе «Оглавление части»; 0 мёртвых якорей |
| 2.2 | Подключить `AboutAccuracyBlock` на все страницы серии и убрать мёртвый `<h2>Нашли неточность?</h2>` из III/IV | **DONE** — блок на 10 из 10 страниц (I–IX и Досье A), мёртвые разделы удалены |
| 2.5 | Оживить «Связанные материалы серии» в Части IV | **DONE** — «Часть II» и «Часть VI» кириллицей, с рабочими ссылками на routes |

Остаётся открытым:

| № | Позиция | Статус на 2026-09-15 |
|---|---|---|
| 1.1 | «181 источник» против 73 кликабельных читательских ссылок | OPEN |
| 1.5 | Время чтения: 321 мин на ядро против ≈178 мин при 200 сл/мин (I–IX = 35 073 слов) | OPEN |
| 2.3 | Кросс-ссылки между частями (минимум 3–5 на часть) | OPEN |
| 2.4 | «Читайте также» в каждую часть (2–4 ссылки, включая другие серии) | OPEN |
| 2.6 | Ссылки в «Источниках» Частей VI и VIII | OPEN |
| 2.7 | Унифицировать название секции источников по серии | OPEN |
| 2.8 | Вычистить англицизмы (III, IV, V, VI, VIII, IX, Досье A) | OPEN (частично закрыто правками, сделанными до сертификации, §5) |
| 2.10 | Объявить перевод Писания в каждой части | OPEN |
| 2.14 | Вернуть блок Wave 11 внутрь `<article>`/`<main>` (3 821 слово, 53 % страницы Досье A) | OPEN |
| 2.15 | Убрать номера волн из читательской навигации | OPEN |
| 3.3 | Квиз для Частей II–IX (вкладка «Тест» пуста) | OPEN |
| 3.5 | Иллюстрации для Частей II–IX (0 изображений) | OPEN |
| 3.8 | Глоссарий серии и тултипы терминов | OPEN |
| 4.1 | Гейт `partToc.length >= 5` | OPEN — теперь есть что проверять (8–19 строк на часть) |
| 4.2 | Гейт наличия `gb-accuracy-block` на каждой статье | OPEN — теперь выполняется на 10/10 |
| 4.7 | Гейт соответствия блобов рукописей сертифицированным в clearance | OPEN — дефект подтверждён измерением (§5) |
| — | Единый jurisdiction/safeguarding pass (слой 2 clearance) | OPEN (§6) |
| — | Bounded re-clearance рукописей II–IX на текущем тексте | OPEN (§5) |
| — | `summary`-строки `partToc` для вкладки «Конспект» в Learning sheet | OPEN (новая позиция: в отчёте не фигурировала; сейчас вкладка показывает empty-state при заполненном оглавлении) |

Состав оглавления (решение этого lane): в `partToc` включены только H2 основного тела.
Не включены служебный кикер `#тёмная-сторона-кафедры`, карточка `#коротко` и удалённые
служебные разделы — по образцу `HARD_TEXTS_PART_TOC` в `hardTextsSeriesConfig.ts`.
Якоря, начинающиеся с цифры (`#1tim`, `#1tim5`), проверены на совместимость: нативный
`js/floating-cluster-controller.js` разрешает цели через `document.getElementById`, а не через
CSS-селектор, поэтому такие идентификаторы безопасны.

## 9. Подписи

```
OWNER DECISION  = ФЁДОР МИЛОВАНОВ — публикация частей II–IX разрешена (вариант B), 2026-09-15
EXECUTION       = редакторский lane проекта, сессия Arena.ai
CONTENT GATES   = PASS; JURISDICTION_SAFEGUARDING_GATE = OPEN (§6); BOUNDED_RE_CLEARANCE = REQUIRED (§5)
PRODUCT GATES   = PARTIAL — продуктовый минимум 2.1 и 2.2 выполнен, спектр §8 открыт
```
