# 100. Chapter 8 — Республика печати: QA resolutions

Дата: 2026-09-06  
Authority: subordinate correction layer for files 98–99  
Статус: **RESOLVED CLAIMS + EXPLICIT HOLDS; NOT A SECOND CHAPTER AUTHORITY**

Этот файл не заменяет `98-ch08-print-republic-source-to-claim...` и `99-ch08-print-republic-visual-dossier...`. Он фиксирует три точечных QA-решения, найденных после их создания, чтобы ошибочные MASTER captions или поздние метаданные не попали в production draft.

---

## Q1. `17 сентября 1905` в MASTER → не использовать

MASTER rows 185 / 308 связывают запуск `Христианина` с формулой о манифесте `17 сентября 1905`.

### Resolution

Правовой документ, провозгласивший основы свободы совести, слова, собраний и союзов, — **Высочайший манифест 17 октября 1905 года** (`Об усовершенствовании государственного порядка`).

Сам текст манифеста включает свободу:
- совести;
- слова;
- собраний;
- союзов.

Прохановский автобиографический trail также связывает начало действий по получению разрешения на `Христианин` именно с выходом **Манифеста 17 октября 1905** и сообщает о получении официального разрешения в ноябре.

Поздняя история ЕХБ повторяет ту же последовательность: Манифест 17 октября → разрешение → пробный выпуск в ноябре 1905.

### Production rule

**Forbidden:**
> `после манифеста 17 сентября 1905 года`

**Allowed:**
> `после Манифеста 17 октября 1905 года Проханов получил возможность добиваться легального издания; официальное разрешение на «Христианин» относится к ноябрю 1905 года.`

### Important nuance

Не превращать Манифест в тезис `после 17 октября наступила полная свобода печати`. История конфискаций и преследования религиозной печати показывает, что правовое открытие было реальным, но неполным и конфликтным.

### MASTER handling

Google Sheet не переписывать через shadow catalog. Для будущего media/caption ledger записать:

`conflict_notes = "MASTER rows 185/308 say 17 Sep 1905; correct manifesto date is 17 Oct 1905 (old style). Do not propagate September date."`

Status: **DATE RESOLVED**.

---

## Q2. Первый `Христианин`: `стеклограф` ≠ автоматически `литография`

### First-person / near-memory trail

Я. И. Жидков вспоминает:
- издательское дело было сложным и дорогим;
- первые номера решено было выпустить рукописно;
- он освоил множительный аппарат;
- первые два номера `Христианина` были размножены на **стеклографе**.

`Братский Вестник` 1947 №5 также передаёт память о первых двух рукописных номерах, отпечатанных/размноженных на множительном аппарате, причём текст для размножения писал Жидков.

### Parallel later wording

В поздних сводках первый пробный номер ноября 1905 называется выпущенным `литографическим способом`.

### Resolution

На текущем уровне evidence нельзя механически объявлять:

`стеклограф = литография`.

Это могут быть:
- разные терминологические описания одного раннего малотиражного процесса;
- упрощение позднего автора;
- либо разные стадии/объекты.

### Production wording

До facsimile/technical source resolution:

> `Первые выпуски ещё изготавливались рукописно и размножались на множительном аппарате; Жидков прямо вспоминал работу на стеклографе. С января 1906 началась регулярная типографская серия.`

Do not write:
> `первый номер был литографирован на стеклографе`

unless a primary technical/source object establishes that terminology.

### P0 visual target

Need controlled facsimile of 1905 trial issue(s) or exact early source describing production method.

Status: **NARRATIVE RESOLVED / TECHNICAL TERMINOLOGY HOLD**.

---

## Q3. Confiscated `Баптист` 1911: MASTER `№97` → **№27**

MASTER rows 1485 / 2264 contain an internally contradictory caption:
- first: article allegedly in `№97`;
- later: `№27` ordered destroyed.

### External issue-level verification

A current full-text historical Christian newspaper archive exposes:

**`Баптист`, №27, 1911**  
Date: **29 June 1911**  
Full issue: 18 displayed pages in the digital reconstruction.

Its contents show:
- page 7: **Фёдор Носков, `Автобиография и исповедь сектанта`**;
- the page is explicitly identified as material from the confiscated `Баптист` №27;
- a separate article reproducing Noskov's text likewise calls **№27, 1911** the confiscated issue and says the whole number was seized.

This independently resolves the issue-number contradiction.

### Canonical correction

**`№97` = MASTER caption transcription/OCR error.**  
**Correct issue = `Баптист` №27, 29 June 1911.**

### What is NOT yet resolved

The modern archive's generated metadata labels the `publisher` in a way that conflicts with established Baptist editorial chronology. Therefore its publisher field is **not authoritative** for Chapter 8.

MASTER's later court narrative also still requires independent verification for:
- exact acting-editor spelling / role;
- criminal-code article;
- exact Odessa District Court date;
- closed-session detail;
- acquittal wording;
- exact legal wording of confiscation/destruction order.

### Production rule

Safe now:

> `Журнал «Баптист» №27 от 29 июня 1911 года, содержавший автобиографический текст Фёдора Носкова, был конфискован.`

HOLD:

> full 1912 court sequence, until primary/independent source recovery.

### MASTER conflict note

`conflict_notes = "MASTER rows 1485/2264 first say issue 97 and later issue 27. Full-text issue witness confirms Baptist No.27, 29 Jun 1911, with Fedor Noskov article on p.7 and identifies it as the confiscated issue. Treat No.97 as caption/OCR error. Court details remain source HOLD."`

Status: **ISSUE NUMBER RESOLVED / COURT DETAILS OPEN**.

---

## Summary

| Gate | Before | After |
|---|---|---|
| Manifest date in MASTER | 17 Sep / uncertain | **17 Oct 1905 resolved** |
| first `Христианин` production terminology | mixed `lithographic / multiplying / glass hectograph` | **narrative safe; technical equivalence HOLD** |
| confiscated `Баптист` issue | `№97` vs `№27` conflict | **№27, 29 Jun 1911 resolved** |
| court case details | caption-led | **still HOLD** |

These corrections must be applied to the eventual Chapter 8 prose, captions and media ledger before any `BOOK-READY` claim.
