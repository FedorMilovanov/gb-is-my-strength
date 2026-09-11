# 92. Chapter 6 — Каргель: крещение 1869, discrepancy resolution

**Дата:** 2026-09-06  
**Lane:** `book/ch06-kargel-source-to-claim`  
**Status:** `NARRATIVE RESOLUTION → MARTIN KALWEIT`; `EXACT 1900 FACSIMILE PAGE OPEN`.

## 0. Previous state

В исторической и справочной литературе сосуществуют две версии того, кто крестил И. В. Каргеля в Тифлисе в 1869 году:

- Н. И. Воронин;
- Мартин Кальвейт (Martin Kalweit).

Initial Chapter 6 matrix правильно не нормализовал конфликт до отдельного source pass.

## 1. Early documentary trail — Kalweit

### V. A. Valkevich, Tiflis, 1900

`Записка о пропаганде протестантских сект в России и, в особенности, на Кавказе` — служебное издание 1900 года, составленное по официальным и другим источникам; РГБ хранит и оцифровала книгу, отдельные приложения каталогизированы отдельно.

Современное исследование Синичкина/Потаповой воспроизводит формулировку Валькевича со ссылкой на **с. 108**:

- Мартин Кальвейт назван первым принявшим баптистское крещение от Классена;
- затем прямо сказано, что **им** были крещены его брат Карл, И. В. Каргель и Фридрих Кильблок.

Это ранний печатный документальный witness, существенно ближе к событию, чем поздние биографические справки XX–XXI веков.

### Appendix V, p. 29

Johannes Dyck (2011), используя результаты Gregory Nichols и более ранний documentary corpus, даёт точную биографическую формулу:

- **6 October 1869**;
- около **11 часов ночи**;
- Тифлис;
- река Кура;
- baptizer: **Martin Kalweit**.

Его сноска 3 указывает не на позднюю биографию, а на:

`W. L. Wal'kevitsch ... 1900, Anhang 5, S. 29`.

То есть date/time/baptizer привязаны к **Валькевичу, Приложение V, с. 29**.

### Albert W. Wardin — source-discovery confirmation

Albert Wardin отдельно сообщает, что при работе с приложениями Валькевича обнаружил два важных русских письма. Одно было написано **Карлом Кальвейтом**, братом Мартина, и описывало время и место его собственного крещения, а также **крещения Иоганна Каргеля**.

Это особенно важно: locator `Приложение V, с. 29` связан не только с компилятивным prose Валькевича, но с ранней корреспонденцией внутри самого documentary corpus.

## 2. Physical archive identity recovered

Публичный archival handoff Дениса Самарина даёт два Google Drive объекта:

- книга Валькевича;
- отдельное приложение Валькевича.

Для приложения точный Drive ID:

`1bx53uaNT1X0pOTZXIlZNNmOJarjE1U8j`

Connected Drive metadata confirms physical object:

- title: `Валькевич. Приложение в pdf.7z`;
- MIME: `application/x-7z-compressed`;
- size: **476,916,979 bytes**;
- created/modified in 2020.

Thus the appendix is not a dead citation. A concrete archive object is reachable, but it is a ~477 MB 7z container, so this pass intentionally did not unpack the entire archive blindly.

## 3. The Voronin tradition

Later works that say **Nikita Voronin** baptized Kargel include:

- Православная энциклопедия;
- several Russian evangelical biographical essays;
- a dissertation/history stream citing Karetnikova, Skopina, Kovalenko, Nichols/Sawatsky in later form.

In this pass, however, no **comparably early primary/near-primary locator** was found that explicitly says Voronin himself baptized Kargel.

This matters because simply counting later repetitions as independent evidence would be source multiplication, not source criticism.

## 4. Canonical resolution for Chapter 6

### Reader narrative

The chapter may now state:

`6 октября 1869 года Иван Каргель был крещён Мартином Кальвейтом в реке Куре в Тифлисе.`

If the exact hour materially helps the scene, it may be added as **about 11 p.m.**, with a note that the detail comes through the documentary tradition preserved in Valkevich's appendix.

### Scholarly note / discrepancy note

A concise note should preserve the historiographical discrepancy:

`В части поздней литературы крестителем Каргеля назван Н. И. Воронин. Однако более ранний документальный след у В. А. Валькевича (1900, Прил. V, с. 29), связанный с письмом Карла Кальвейта, указывает на Мартина Кальвейта; эту версию принимает современная исследовательская линия Дика.`

This avoids silently deleting the Voronin tradition while still making an evidence-weighted editorial decision.

## 5. Status classification

### CLOSED for narrative

- year: 1869;
- date: 6 October 1869;
- place: Tiflis / Kura River;
- baptizer: **Martin Kalweit**;
- later Voronin version = historiographical discrepancy, not co-equal default.

### OPEN for facsimile/publication-object use

1. unpack/locate exact file corresponding to Appendix V within the 476.9 MB Drive archive;
2. visually verify p. 29;
3. identify whether the image is original letter, reproduced transcript, or compiled appendix page;
4. receive exact target bytes only, not necessarily the whole archive into Product;
5. compute SHA256 for the extracted target;
6. rights/provenance/caption before displaying facsimile.

## 6. Consequence for research 85

The earlier safe sentence:

`источники расходятся в том, совершил ли крещение Воронин или Кальвейт`

was correct before this pass, but is now too neutral for the weighted evidence.

Book Authority should prefer **Kalweit in main prose**, retaining Voronin in the source note.

## Sources

- В. А. Валькевич, `Записка о пропаганде протестантских сект в России и, в особенности, на Кавказе`, Тифлис, 1900 — RSL open-access record and digitization; p. 108 cited by later research.
- Valkevich Appendix V, p. 29 — exact locator via Johannes Dyck.
- Johannes Dyck, `Johann Kargel und der Weg zu seiner Auslegung der Offenbarung`, BSB-Journal 2/2011, p. 27 and endnote 3.
- Albert W. Wardin, source-collection essay in `Богословские размышления`, confirming Karl Kalweit letter in Valkevich appendix.
- A. V. Sinichkin / N. V. Potapova, `По России с Евангелием`, 2018, reproducing Valkevich's Martin-Kalweit statement and locators.
- Denis Samarin archival handoff, giving exact Google Drive links for Valkevich book and appendix.
