# Part III — source/exegesis verification receipt

Статус: **SOURCE + EXEGESIS PASS / NO PUBLICATION PROMOTION**
Дата: 2026-09-07
Product base / rollback: `2a5bad736ff76651b1dcf26371ea8872862d1d66`
Product manuscript: `src/content/articles/teksty-pisaniya-kotorymi-manipuliruyut.mdx`
Manuscript blob at base: `78f4ba593d0e235aa2a73f1de593867029806c79`
Manuscript blob after bounded repair: `94d9c7a707a4d3e6e0c17faa9aeaba1099f854f1`
Research authority used for this pass: `FedorMilovanov/Research@56fca4d5a3dbbc4ddb68d4ed5708e91649be8086`
Active correction overlay: `ОБРАТНАЯ СТОРОНА КАФЕДРЫ СЕРИЯ/31A_SCRIPTURE_TEXTS_MANIPULATED_EXEGESIS_CORRECTIONS_2026-09-07.md`
Correction overlay blob: `ce6f79c074baffaadeafd6cd5916fa03aeecb374`
Historical research map: `ОБРАТНАЯ СТОРОНА КАФЕДРЫ СЕРИЯ/31_SCRIPTURE_TEXTS_MANIPULATED.md`
Historical dossier blob: `719a2edfb1ff5af4634e14c3c0f0d09e582f9214`
Governing Product files: `research/pastor-series/MASTER-PLAN.md`, `research/pastor-series/SOURCE-RECONCILIATION-II-IX.md`

## 1. Граница этого pass

Этот receipt закрывает для Части III только две связанные задачи:

1. **source gate** — reader-facing external bibliography и точные публичные locators там, где внешний источник действительно нужен;
2. **Scripture/exegesis gate** — 23 разбираемых текста проверены по ближайшему контексту, жанру, сфере власти и, где вывод зависит от формулировки, по оригинальному языку или текстологии.

Он **не**:

- снимает `draft:true`, `noindex:true` или `sourcesRequired:true`;
- создаёт public route;
- объявляет статью publication-ready;
- заменяет отдельный jurisdiction/safeguarding pass прикладных выводов о преступлении, угрозе, насилии и reporting;
- заменяет cross-link/series consistency, christological, metadata, build/static-publication или release/production witness;
- превращает secondary pastoral/safeguarding literature в authority для значения греческого слова или ближайшего контекста стиха.

## 2. Метод: TEXT → CANONICAL INFERENCE → APPLICATION

Для каждого спорного места действует одна и та же граница:

- **TEXT** — что утверждает сам отрывок в ближайшем контексте;
- **CANONICAL INFERENCE** — вывод из сопоставления с другими текстами Писания;
- **APPLICATION** — prudential/pastoral/safeguarding вывод, который нельзя выдавать за перевод или лексическое значение отдельного слова.

Research dossier 31 сохраняется только как историческая карта 23 текстов. При конфликте с ним действует merged correction overlay `31A...CORRECTIONS...md` на Research anchor выше.

## 3. 23-text exegesis matrix

| # | Текст | Проверенный boundary | Verdict |
| ---: | --- | --- | --- |
| 1 | 1 Пар. 16:22 / Пс. 104:15 | Контекст — Божья защита патриархов/помазанников от причинения зла; текст не создаёт новозаветный иммунитет пастора от проверки или обличения | `PASS_CONTEXT` |
| 2 | 1 Цар. 24; 26 | Повествование запрещает самовольную месть/убийство Саула; Давид при этом нравственно обличает его. Narrative ≠ запрет критики служителя | `PASS_GENRE` |
| 3 | Евр. 13:17 | `πείθεσθε` нельзя редуцировать к одной «убеждаемости»: стих содержит и `ὑπείκετε`; реальное повиновение сочетается с отчётностью лидеров перед Богом | `PASS_ORIGINAL_LANGUAGE` |
| 4 | Рим. 13:1–7 | Ближайшая сфера — гражданская власть, меч и налоги; это не специальный текст о церковном старейшинстве | `PASS_SPHERE` |
| 5 | 1 Пет. 2:18–21 | Текст говорит о `οἰκέται`, подчинении и незаслуженном страдании; не содержит сам по себе исторической формулы «выход был невозможен» и не делает причинителя неправды правым | `PASS_CONTEXT` |
| 6 | Мф. 7:1–5, 15–20 | Запрет лицемерного суда не отменяет нравственного различения; встречный guardrail запрещает чтение мотивов и приговор без evidence | `PASS_CONTEXT` |
| 7 | Мф. 18:15–17 | `εἰς σέ` имеет текстологическую вариативность; процедуру нельзя ограничить только грехом лично «против меня» и нельзя сделать универсальным предварительным условием обращения к гражданской власти при возможном преступлении | `PASS_WITH_TEXTUAL_NOTE` |
| 8 | 1 Тим. 5:19–21 | `παραδέχου` не кодирует современную схему `intake → investigation → verdict`; текст одновременно защищает пресвитера от легковесного обвинения и знает реальную дисциплину согрешающего пресвитера | `PASS_PROCESS_BOUNDARY` |
| 9 | 2 Кор. 13:1 | Павел применяет принцип подтверждения в собственном коринфском разбирательстве; стих поддерживает доказательность, но не запрещает само получение первого сообщения | `PASS_CONTEXT` |
| 10 | Притч. 18:17 | Мудрое наблюдение требует услышать вторую сторону/проверить дело; proverb не является процессуальным кодексом автоматического недоверия первому сообщившему | `PASS_GENRE` |
| 11 | Еф. 5:21–33 | Взаимность 5:21 не стирает разных адресных повелений супругам; подчинение жены и жертвенная любовь мужа сохраняются, а грех/насилие не становятся законным требованием | `PASS_CONTEXT_AND_CANON` |
| 12 | Мал. 3:8–10 | Адресат обвинения — Израиль/«весь народ» в храмово-заветном контексте; текст нельзя напрямую превращать в новозаветную fundraising-формулу или обещание материального возврата | `PASS_COVENANT_CONTEXT` |
| 13 | Гал. 6:1 | `παράπτωμα` не означает обязательно случайный грех; `καταρτίζετε` имеет широкий смысл восстановления и не доказывает pastoral procedure через ложную «медицинскую этимологию» | `PASS_LEXICAL` |
| 14 | 2 Кор. 2:5–11 | Павел требует простить/утешить после достаточного взыскания; текст не перечисляет все признаки внутреннего состояния и не делает восстановление должности автоматическим | `PASS_CONTEXT` |
| 15 | 4 Цар. 2:23–24 | Конкретное повествование о пророке и Божьем суде нельзя превращать в универсальную угрозу всякому критику современного пастора | `PASS_GENRE` |
| 16 | 1 Кор. 6:1–8 | Павел говорит о тяжбах верующих; запрет нельзя автоматически расширять на сообщение о возможном преступлении гражданской власти. Это канонически сопоставляется с Рим. 13 и использованием Павлом законных прав | `PASS_JURISDICTION_SYNTHESIS` |
| 17 | 1 Пет. 4:8 | Любовь внутри общины «покрывает множество грехов»; это не лексическое разрешение скрывать серьёзное зло от законной ответственности | `PASS_CONTEXT` |
| 18 | 1 Тим. 3:1–7 / Тит. 1:5–9 | Павел даёт наблюдаемые квалификации характера и учения; современный психологический диагноз не содержится автоматически в этих терминах | `PASS_QUALIFICATIONS` |
| 19 | Иак. 5:14–16 | `ἀλλήλοις` грамматически даёт взаимность исповедания/молитвы; consent, confidentiality, safeguarding и mandatory reporting требуют отдельного основания и не выводятся из одного слова | `PASS_WITH_APPLICATION_SPLIT` |
| 20 | 3 Ин. 9–10 | Диотреф описан через конкретные наблюдаемые действия, а не через психологический диагноз; этот кейс нельзя использовать как blanket-label для сильного лидера | `PASS_OBSERVABLE_BEHAVIOR` |
| 21 | Иез. 34 / Иер. 23 | Ветхозаветное обличение руководителей Божьего народа является серьёзным каноническим фоном для пастырства, но не превращает любое непопулярное решение в «Иез. 34» без фактов | `PASS_CANONICAL_SYNTHESIS` |
| 22 | Деян. 20:28–31 / 1 Пет. 5:1–4 | Старейшины реально поставлены пасти/надзирать; одновременно Пётр запрещает `κατακυριεύοντες` — господство — и требует быть образцами | `PASS_AUTHORITY_AND_LIMIT` |
| 23 | Мф. 23:8–12 | Христос обличает религиозное самовозвышение; текст не отменяет новозаветные роли учителей/пастырей/старейшин | `PASS_ROLE_NOT_ABOLITION` |

Результат матрицы: **23/23 имеют bounded verdict; 0/23 остаются без экзегетического disposition.**

## 4. Точные public locators для спорных языковых мест

Эти locators используются только там, где вывод зависит от текста/лексики:

1. **Мф. 18:15 — NET textual note, `εἰς σέ`**  
   https://classic.net.bible.org/verse.php?book=Mat&chapter=18&theme=false&verse=15

2. **Евр. 13:17 — SBLGNT, `πείθεσθε` + `ὑπείκετε`**  
   https://www.biblegateway.com/passage/?search=Hebrews%2013%3A17&version=SBLGNT%3BNIV

3. **1 Тим. 5:19–21 — SBLGNT, `παραδέχου` + ближайший контекст**  
   https://www.biblegateway.com/passage/?search=1%20Timothy%205%3A19-21&version=SBLGNT

4. **Гал. 6:1 — SBLGNT, `παράπτωμα` / `καταρτίζετε`**  
   https://www.biblegateway.com/passage/?search=Galatians%206%3A1&version=SBLGNT

5. **Иак. 5:16 — SBLGNT, `ἀλλήλοις`**  
   https://www.biblegateway.com/passage/?search=James%205%3A16&version=SBLGNT

6. **Еф. 5:21–22 — SBLGNT**  
   https://www.biblegateway.com/passage/?search=Ephesians%205%3A21-22&version=SBLGNT

7. **1 Тим. 3 / Тит. 1 — SBLGNT + translation comparison**  
   https://www.biblegateway.com/passage/?search=1%20Timothy%203&version=NET%3BSBLGNT  
   https://www.biblegateway.com/passage/?search=Titus%201%3A5-9&version=SBLGNT%3BNIV

## 5. Русские прямые цитаты — Синодальный contract

Owner invariant `docs/OWNER-INVARIANTS.md` требует: прямые цитаты Писания дословны по заявленному изданию, по умолчанию Синодальному; пересказ не выдаётся за цитату.

Проверены reader-facing короткие цитаты:

- Пс. 104:15 — «Не прикасайтесь к помазанным Моим» — https://www.bible.com/ru/bible/400/PSA.104.15.SYNO
- Евр. 13:17 — «Повинуйтесь наставникам вашим и будьте покорны» — https://www.bible.com/ru/bible/400/HEB.13.17.SYNO
- Рим. 13:1 — «Всякая душа да будет покорна высшим властям» — https://www.bible.com/ru/bible/400/ROM.13.1.SYNO
- Мф. 7:1 — «Не судите, да не судимы будете» — https://www.bible.com/ru/bible/compare/MAT.7.1
- Мф. 18:15 — «между тобою и им одним» — https://www.bible.com/ru/bible/400/MAT.18.15.SYNO
- 2 Кор. 13:1 — «при устах двух или трех свидетелей» — https://www.bible.com/ru/bible/compare/2CO.13.1
- Притч. 18:17 — «Первый в тяжбе своей прав» — https://bible.by/verse-syn/20/18/17/
- 1 Пет. 4:8 — «любовь покрывает множество грехов» — https://www.bible.com/ru/bible/400/1PE.4.8.SYNO

Reader heading Мал. 3 изменён с кавычечного «обкрадывание Бога» на описательное «обвинение в обкрадывании Бога», чтобы пересказ не выглядел прямой библейской цитатой.

## 6. Reader-safe external bibliography и role boundary

### Ecclesiology / conscience support

- **Jeramie Rinne / 9Marks, “How Far Does an Elder’s Authority Go?” (2026)**  
  https://www.9marks.org/article/how-far-does-an-elders-authority-go/  
  Role: реальность старейшинской власти + её пределы; Scripture remains normative. Не используется как Greek authority.

- **London Baptist Confession of Faith (1689), chapter 21**  
  https://founders.org/library/chapter-21-christian-liberty-and-liberty-of-conscience/  
  Role: confessional support для свободы совести и отказа от absolute/blind obedience человеческим повелениям, не содержащимся в Слове.

- **London Baptist Confession of Faith (1689), chapter 26**  
  https://founders.org/library/chapter-26-the-church/  
  Role: confessional support для верховенства Христа, реальности церкви/служителей и церковной власти. Confession subordinate to Scripture.

### Application / safeguarding support

- **GRACE, “Responding to Pastoral Abuse Allegations”**  
  https://www.netgrace.org/resources/responding-to-pastor-abuse-allegations  
  Role: safeguarding/application evidence; не textual authority для Мф. 18.

- **Michael J. Kruger, “What is Spiritual Abuse?”**  
  https://michaeljkruger.com/what-is-spiritual-abuse/  
  Role: bounded application vocabulary для злоупотребления духовной властью; не blanket-label и не экзегетическая authority.

- **Wade Mullen, _Something’s Not Right_ — official Tyndale page**  
  https://www.tyndale.com/p/somethings-not-right/9781496444707  
  Role: наблюдаемые tactics / impression management; не authority для biblical semantics.

- **Diane Langberg, _Redeeming Power_ — Baker**  
  https://bakerpublishinggroup.com/products/9781587434389_redeeming-power  
  Public excerpt: https://cdn.bakerpublishinggroup.com/processed/book-resources/files/Excerpt_Langberg_short.pdf  
  Role: application layer о производной власти и злоупотреблении; не authority для original-language claims.

`CCEF / David Powlison` удалён из reader bibliography: в текущем manuscript ему не соответствует конкретный reader-facing claim с точным locator. Оставлять общий бренд «для солидности» хуже, чем не ссылаться вовсе.

## 7. Выполненный bounded manuscript repair

На blob `94d9c7a707a4d3e6e0c17faa9aeaba1099f854f1` выполнено только следующее:

1. внутреннее reader-facing «Исследовательское досье 31» удалено; Research provenance остаётся в этом receipt;
2. Мф. 18:15 получил необходимую текстологическую оговорку `εἰς σέ`;
3. Иак. 5:16 теперь явно разделяет грамматическую взаимность и современный application (`consent / confidentiality / safeguarding / reporting`);
4. «обкрадывание Бога» перестало выглядеть прямой цитатой;
5. vague bibliography заменена точными public locators и role boundaries;
6. никакой современный safeguarding/pastoral source не используется как authority для значения греческого;
7. `draft:true`, `noindex:true`, `sourcesRequired:true` сохранены;
8. route/RSS/sitemap/series-data/runtime/workflows не менялись.

## 8. Allowed / forbidden wording после pass

### Разрешено

- «Евр. 13:17 требует реального повиновения и одновременно подчёркивает отчётность руководителей»;
- «Мф. 18 — реальный путь церковного исправления, но не исчерпывающий уголовно-процессуальный кодекс»;
- «1 Тим. 5:19 защищает пресвитера от легковесного обвинения, а 5:20 исключает неприкосновенность согрешающего пресвитера»;
- «библейская власть реальна, но не абсолютна и не безошибочна»;
- «application по safeguarding должен быть отделён от лексического значения отдельного слова».

### Запрещено без нового evidence

- «`πείθεσθε` означает только “быть убеждаемым”, поэтому повиновения нет»;
- «Мф. 18:15 относится только к греху лично против меня»;
- «Мф. 18 всегда требует личной встречи до сообщения о возможном преступлении»;
- «`παραδέχου` само по себе означает современную фазу verdict, а не intake/investigation»;
- «`παράπτωμα` означает обязательно случайный/непреднамеренный грех»;
- «`καταρτίζω` — медицинский термин, который сам доказывает pastoral procedure»;
- «`ἀλλήλοις` само по себе устанавливает consent/confidentiality/reporting policy»;
- психологическая диагностика лидера как прямое значение 1 Тим. 3 / Тит. 1;
- blanket-label `abuse` для всякой твёрдой власти, дисциплины, несогласия или неприятного решения.

## 9. Quote-safe verdict

В reader manuscript не добавлены прямые английские цитаты из Kruger/Mullen/Langberg/GRACE/9Marks/LBCF.

`EXTERNAL_DIRECT_QUOTE_STATUS = NONE`

Любая будущая прямая цитата требует отдельной проверки точного текста/locator и русского перевода.

## 10. Verdict

`SOURCE_GATE = PASS`

`SCRIPTURE_EXEGESIS_GATE = PASS`

`TEXTS_REVIEWED = 23/23`

`READER_SAFE_LOCATORS = PASS`

`PUBLICATION_READY = NO`

Часть III теперь имеет статус:

`CONTENT MANUSCRIPT / SOURCE + EXEGESIS VERIFIED / OTHER GATES OPEN`

Открыты как минимум:

- отдельный jurisdiction/safeguarding pass для прикладных формулировок о преступлении, угрозе, насилии, reporting и гражданской юрисдикции;
- cross-link/series consistency pass;
- финальный christological/theological consistency pass серии;
- MDX/structure/source/static-publication exact-head checks;
- route/reader/landing/RSS/sitemap/metadata release transaction;
- production witness после будущего release merge.

До этих доказательств publication promotion запрещён.
