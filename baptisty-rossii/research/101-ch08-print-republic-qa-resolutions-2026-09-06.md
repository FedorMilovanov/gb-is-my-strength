# 101. Chapter 8 — Республика печати: QA resolutions

Дата: 2026-09-06  
Authority: subordinate correction layer for files 98–100  
Статус: **RESOLVED CLAIMS + EXPLICIT HOLDS; NOT A SECOND CHAPTER AUTHORITY**

Этот файл не заменяет `98-ch08-print-republic-source-to-claim...`, `99-ch08-print-republic-visual-dossier...` или `100-ch08-periodical-acquisition-and-page-control...`. Он фиксирует точечные QA-решения, чтобы ошибочные MASTER captions или поздние метаданные не попали в production draft.

---

## Q1. `17 сентября 1905` в MASTER → не использовать

MASTER rows 185 / 308 связывают запуск `Христианина` с формулой о манифесте `17 сентября 1905`.

### Resolution

Правовой документ, провозгласивший основы свободы совести, слова, собраний и союзов, — **Высочайший манифест 17 октября 1905 года** (`Об усовершенствовании государственного порядка`).

Прохановский автобиографический trail и поздняя история ЕХБ также связывают начало действий по получению разрешения на `Христианин` с октябрьским Манифестом и последующим разрешением в ноябре 1905.

### Production rule

Forbidden:
> `после манифеста 17 сентября 1905 года`

Allowed:
> `После Манифеста 17 октября 1905 года Проханов получил возможность добиваться легального издания; официальное разрешение на «Христианин» относится к ноябрю 1905 года.`

Не превращать это в тезис `после 17 октября наступила полная свобода печати`: дальнейшие конфискации и преследования показывают реальное, но неполное правовое открытие.

Future media/caption ledger:
`conflict_notes = "MASTER rows 185/308 say 17 Sep 1905; correct manifesto date is 17 Oct 1905. Do not propagate September date."`

Status: **DATE RESOLVED**.

---

## Q2. Первый `Христианин`: `стеклограф` ≠ автоматически `литография`

### Near-memory trail

Я. И. Жидков вспоминает, что первые номера решено было выпускать рукописно, он освоил множительный аппарат, и первые два номера `Христианина` размножались на **стеклографе**.

`Братский Вестник` 1947 №5 также сохраняет память о первых двух рукописных номерах, размноженных на аппарате при участии Жидкова.

### Parallel later wording

В поздних сводках пробный номер ноября 1905 иногда называется выпущенным `литографическим способом`.

### Resolution

На текущем уровне evidence нельзя механически утверждать:
`стеклограф = литография`.

Это может быть:
- разная терминология для раннего малотиражного процесса;
- упрощение позднего автора;
- разные стадии/объекты.

### Production wording

> `Первые выпуски ещё изготавливались рукописно и размножались на множительном аппарате; Жидков прямо вспоминал работу на стеклографе. С января 1906 началась регулярная типографская серия.`

До primary technical resolution не писать `литографирован на стеклографе`.

Status: **NARRATIVE RESOLVED / TECHNICAL TERMINOLOGY HOLD**.

---

## Q3. Конфискованный `Баптист` 1911: MASTER `№97` → **№27**

MASTER rows 1485 / 2264 внутренне противоречат себе:
- сначала называют `№97`;
- позже говорят, что уничтожению/конфискации подвергался `№27`.

### Issue-level verification, 2026-09-06

Полнотекстовый исторический христианский газетный архив показывает:

- `Баптист`, **№27**, 1911;
- дата: **29 июня 1911**;
- page reconstruction: 18 displayed pages;
- page 7: **Фёдор Носков, `Автобиография и исповедь сектанта`**;
- отдельная публикация того же архива прямо называет статью материалом из конфискованного `Баптиста` №27 и говорит, что из-за неё был изъят весь номер.

Public witnesses checked 2026-09-06:
- `https://mscexb.ru/newspaper-cms/view-newspaper.php?id=paper-1767397762-461ce8&page=1`
- `https://mscexb.ru/newspaper-cms/view-newspaper.php?id=paper-1767397762-461ce8&page=7`
- `https://mscexb.ru/автобиография-и-исповедь-сектанта-брат-федор-носков`

### Canonical correction

**Correct issue: `Баптист` №27, 29 июня 1911.**

`№97` следует считать ошибкой MASTER caption / transcription until contrary primary evidence appears.

### Important metadata warning

Современный web archive показывает publisher metadata, которое конфликтует с установленной редакционной хронологией `Баптиста`. Поэтому поле publisher из этого web reconstruction **не использовать как authority**. Для issue number/date/article location источник полезен; для publisher/editor attribution — нет без отдельной сверки.

### What remains open

Ещё не закрыты на primary/legal level:
- точная роль/написание имени временного редактора;
- уголовно-правовая статья;
- точная дата Одесского окружного суда;
- closed-session detail;
- wording оправдания;
- wording решения о конфискации/уничтожении.

Safe now:
> `Журнал «Баптист» №27 от 29 июня 1911 года, содержавший автобиографический текст Фёдора Носкова, был конфискован.`

HOLD:
> полная судебная последовательность 1912 года до independent/primary recovery.

Future ledger:
`conflict_notes = "MASTER rows 1485/2264 first say issue 97 and later issue 27. Full-text issue witness confirms Baptist No.27, 29 Jun 1911, with Fedor Noskov article on p.7 and identifies it as the confiscated issue. Treat No.97 as caption/transcription error. Court details remain source HOLD."`

Status: **ISSUE NUMBER RESOLVED / COURT DETAILS OPEN**.

---

## Summary

| Gate | Before | After |
|---|---|---|
| Manifest date in MASTER | 17 Sep / conflict | **17 Oct 1905 resolved** |
| first `Христианин` production terminology | mixed `lithographic / multiplying / glass hectograph` | **narrative safe; technical equivalence HOLD** |
| confiscated `Баптист` issue | `№97` vs `№27` | **№27, 29 Jun 1911 resolved** |
| Noskov article location | caption-led | **p. 7 in modern full-text reconstruction** |
| court-case details | caption-led | **still HOLD** |

These corrections must be applied to eventual Chapter 8 prose, captions and media ledger before any `BOOK-READY` claim.
