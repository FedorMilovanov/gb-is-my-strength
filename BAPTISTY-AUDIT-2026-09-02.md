# «Баптисты России» — Аудит готовности книги
**Дата:** 2026-09-02
**Аудитор:** Arena.ai Agent

---

## 1. Текущее состояние

### Опубликованная поверхность
| Метрика | Значение |
|---|---|
| Опубликованных маршрутов | 10 (9 статей + справочник) |
| Навигация | 4 главы |
| Общее время чтения | ~229 минут |
| Target слов (legacy) | 47 400 |
| Target слов (книга) | 90 000–120 000 |

### Research-корпус
| Ресурс | Количество |
|---|---|
| Research-файлы | 84+ |
| MASTER Workbook | https://docs.google.com/spreadsheets/d/1y9d_7bWAEsz8iYdMuRrtb6onDYEXLQx5PgT95oYNsSM |
| Постов Telegram | 5 269 |
| Фото (всего) | 2 841 |
| Фото с подписью | 2 585 |
| Фото article-ready | 2 031 |
| PDF в архиве | 130 |
| PDF нужно докачать | 390 |
| Периодических выпусков | 98 |
| Внешних ссылок | 607 |

### Research Repo
- **Репозиторий:** `FedorMilovanov/Research`
- **Текущий статус:** legacy binding → требуется review
- **Research root:** `БАПТИСТЫ РОССИИ`

---

## 2. Планируемая архитектура книги

### 5 частей / 20 глав

| Часть | Название | Главы |
|---|---|---|
| I | До имени — рождение русского баптизма | 1–4 |
| II | Евангелие выходит в публичность | 5–9 |
| III | Короткое окно — свобода, образование и мировое братство | 10–13 |
| IV | Советская ночь и контролируемое единство | 14–17 |
| V | Совесть под давлением | 18–20 |

---

## 3. Что сделано (SYSTEM foundation)

### ✅ Завершено

1. **Book Authority v2** (`docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`)
   - Разделение текущей публичной поверхности и long-horizon book target
   - Evidence model bridge: A1/A2/A3/B1/C/D + independent state axes
   - Publication Definition of Ready / Done
   - Media pipeline с правами
   - Guardrails против false-green

2. **Expansion Roadmap v4** (`data/baptisty-rossii-expansion-roadmap.json`)
   - Machine-readable projection с fail-closed invariants
   - Legacy vs book target separation
   - 10 текущих частей привязаны к будущим главам

3. **Public evidence-language sync** (PR #1767)
   - Справочник обновлён с A/B/C/D на reader-facing labels
   - Meta descriptions синхронизированы

4. **Source matrices** (аудиты)
   - Origins Source Matrix (2026-08-22)
   - Petersburg Source Matrix (2026-08-20)
   - South Shtunda Source Matrix (2026-08-24)
   - Soviet Night Source Matrix (2026-08-24)
   - Evidence Language Handoff (2026-08-20)
   - Marathon Handoff (2026-08-20)

---

## 4. Что осталось сделать

### 🚧 Очередь lanes (по Book Authority v2)

| # | Lane | Статус | Приоритет | Описание |
|---|---|---|---|---|
| 1 | **Petersburg Golden Chapter** | Ожидает | P0 | Source-to-section matrix + разделение перегруженной главы |
| 2 | **Origins Wave** | Ожидает | P0 | Кура → Южная штунда → 1884/1885 |
| 3 | **Public Square Wave** | Ожидает | P1 | Мазаев/Проханов → Печать → Фетлер |
| 4 | **1917–1928 Wave** | Ожидает | P1 | Самостоятельный документальный блок |
| 5 | **Soviet Night Wave** | Ожидает | P0 | 1929 → 1930-е → 1944 → 1945–1959 |
| 6 | **1960–1991 Wave** | Ожидает | P0 | Инструктивное письмо → разлом → самиздат/узники/семьи → память |
| 7 | **Book Experience Wave** | Ожидает | P2 | Atlas, quizzes, reader additions, homepage launch, structured data |

### 📋 Конкретные задачи по главам

#### Текущие статьи → углубление

| Статья | Target слов | Что углубить |
|---|---|---|
| Ночь на Куре | 4 200 | Кура/Тифлис как сцена, Воронин/Кальвейт/Деляков, письмо 1889, граница память/источник |
| Южная штунда | 4 600 | Унгер, Цимбал, Рябошапка, Ратушный, Прицкау; отличие штунды от баптизма |
| Две развилки 1884 | 3 800 | Два разных события, первое исповедание, порядок братства |
| Петербургское пробуждение | 4 600 | Редсток, Пашков, Каргель, Проханов; **разделить на 4 главы** |
| Свобода совести | 4 200 | Военный вопрос 1905–1945+, хронология позиций |
| Советская ночь | 5 200 | 1929 закон, Инструкция НКВД, механизм репрессий, **разделить на 2 главы** |
| ВСЕХБ 1944 | 4 600 | Братский Вестник, ХВЕ, цена легального пространства |
| Инициативная группа | 5 000 | 1960–1966, церковная совесть vs административный контроль |
| Подпольная печать | 5 200 | Физический каталог выпусков, типографии, конфискации |

#### Новые главы (planned, status: 0)

| ID | Глава | Источники | Media slots |
|---|---|---|---|
| 1 | До баптистов: поиск Писания | молокане, пиетисты, меннониты, книгоноши | 2–4 фото/документа |
| 6 | Каргель: богослов и соединительный мост | research/47 | 2–4 фото |
| 7 | Мазаев и Проханов: два проекта братства | research/44 | 2–4 фото |
| 8 | Печатная республика | 73 официальных PDF | 3–5 обложек |
| 9 | Фетлер и Дом Евангелия | research/65 | 2–4 фото |
| 10 | 1917–1921 | research/77 | 2–4 документа |
| 11 | Голод и международное братство | research/56, 58, 64 | 2–4 фото |
| 12 | Школа, Библия и несостоявшееся единство | research/53 | 2–3 фото |
| 14 | 1929: закон | research/52 | 2–3 документа |
| 15 | 1930-е: разрушение | research/16, 41 | 3–5 кейсов |
| 17 | ВСЕХБ 1945–1959 | research/53 | 2–4 фото |
| 20 | После ночи: 1991 и память | research/57, 28 | 2–4 фото |

---

## 5. Media Pipeline — текущее состояние

### Статус по категориям фото

| Категория | Количество | article-ready |
|---|---|---|
| 01 — People & Portraits | 131 | — |
| 02 — Churches, Buildings | 346 | — |
| 03 — Baptisms, Services, Congresses | 994 | — |
| 04 — Documents, Books, Press | 467 | — |
| 05 — Places, Maps, Cemeteries | 117 | — |
| 09 — Uncaptioned | 786 | ❌ |
| **ИТОГО** | **2 841** | **2 031** |

### Pipeline status

```
candidate → identity → provenance → rights → exact caption → 
local binary → SHA → derivatives → media ledger → publication
```

**Текущее состояние:**
- ✅ Identity check: 2 585 фото с подписью
- ✅ Rights check: article-ready = 2 031
- ❌ LOCAL BINARY: 390 PDF ещё не скачаны
- ❌ MEDIA LEDGER: требуется интеграция
- ❌ PUBLICATION: массевое импортирование запрещено

---

## 6. Source Matrices — ключевые выводы

### Petersburg Matrix (2026-08-20)
- 43 утверждения проанализированы
- READY: 18 | VERIFY: 16 | HOLD: 9
- **Ключевые HOLD:** Prokhanov 1911 timeline, Каргель identity, Фетлер 1917 connection

### Soviet Night Matrix (2026-08-24)
- 50 утверждений проанализированы
- READY: 12 | VERIFY: 20 | HOLD: 18
- **Ключевые HOLD:** SN-21 (Bible courses identity), SN-26 (Ivanov-Klyshnikov), SN-28 (Timoshenko), SN-42 (Slesarev archival)

### South Shtunda Matrix (2026-08-24)
- Основные вехи подтверждены
- **Ключевые gaps:** Dorodnitsyn 1884 rules (A1), Рождественский/Tiflis connection

### Origins Matrix (2026-08-22)
- Pre-1867 precursors требуют отдельной проверки
- 1867–1884 lineage: strong evidence для Воронин-Кальвейт
- **Open questions:** 26 различных расхождений в источниках

---

## 7. Четырёхголосая модель — применение

Для спорных и обвинительных утверждений обязательны 4 источника:

| Голос | Пример |
|---|---|
| Официальный церковный | Протоколы съездов, Братский Вестник |
| Внутренний альтернативный | Инициативники, самиздат, письма семей |
| Государственный | Законы, инструкции НКВД, архивы |
| Внешний | BWA, Keston, академические исследования |

**Применяется к:** утверждениям о причинности, обвинениям, богословским выводам

---

## 8. Незавершённые проверки

### По Research
- [ ] Research repo: обновить binding с `work` → `main`
- [ ] Проверить актуальность Research authority SHA
- [ ] Review всех HOLD-статусов на предмет снятия

### По Media
- [ ] 390 PDF докачать в Drive
- [ ] 786 фото без подписей → идентифицировать
- [ ] 130 локальных PDF → интегрировать в media ledger
- [ ] Rights check для всех 2 031 article-ready фото

### По Sources
- [ ] «Баптист» 1910: докачать №12, №44–49
- [ ] «Баптист» 1912: найти №4–9, №15–16
- [ ] «Баптист» 1914: найти №5–8, №15–16
- [ ] «Баптист» 1917: найти №2, №5
- [ ] «Христианин» 1906: №2, №3, №7 факсимиле
- [ ] «Слово истины» 1918: докачать №1–8

### По тексту
- [ ] Все 9 статей: deep claim-to-source review
- [ ] Direct quotes: проверить locator для каждого
- [ ] «Коротко» в каждой статье: 4–6 пунктов, вытекающих из текста

---

## 9. Границы (No-Go List)

- ❌ Создавать 17 пустых URL «на будущее»
- ❌ Добивать word target водой
- ❌ Массово переносить Research prose без повторной проверки
- ❌ Ослаблять claim ради драматургии
- ❌ Считать `article-ready = site-ready`
- ❌ Создавать пустой Product confidence registry для CI
- ❌ Менять `dateModified` на техническом коммите

---

## 10. Зависимости и ожидания

| Элемент | Owner | Статус |
|---|---|---|
| Book Authority v2 | ✅ Завершён | SYSTEM lane #1765 merged |
| Evidence language | ✅ Завершён | PR #1767 merged |
| Roadmap v4 | ✅ Завершён | In main |
| Source matrices | 🚧 Частично | Petersburg, Soviet Night, South Shtunda, Origins |
| Research binding | ⏳ Требует review | legacy-review-required |
| Media pipeline | ⏳ Требует интеграции | 390 PDF pending |
| Golden Chapters | ⏳ Ожидает | Lane queue |

---

## 11. Заключение

**Сделано:** SYSTEM foundation стабильна. Book Authority, evidence model, publication gates и roadmap tooling готовы.

**Осталось:** 7 волн реализации (Petersburg → Origins → Public Square → 1917–1928 → Soviet Night → 1960–1991 → Book Experience).

**Ближайший шаг:** 
1. Petersburg Golden Chapter — source-to-section matrix + безопасное разделение
2. Обновить Research binding → current main
3. Докачать 390 PDF
4. Review и снятие HOLD-статусов по мере поступления архивных данных

---

**Документ создан:** 2026-09-02
**Основание:** research/baptisty-rossii/, audit/, docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md, data/baptisty-rossii-expansion-roadmap.json, MASTER Workbook
