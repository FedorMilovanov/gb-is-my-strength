# 12. ВСЕХБ 1944 — «Братский Вестник» №1, 1945: source identity и acquisition gap

**Дата:** 2026-09-06  
**Lane:** `book/vsehib-1944-golden-chapter` / PR #1792  
**Статус:** `ISSUE IDENTITY / CONTENT INDEX VERIFIED`; `LOCAL BINARY / FACSIMILE OPEN`.

## Что подтверждено

Официальная публикационная поверхность Московской церкви ЕХБ содержит отдельную карточку:

- `Братский Вестник`, №1, 1945;
- прямой PDF endpoint: `https://mbchurch.ru/upload/iblock/80f/bv_1945_1.pdf`;
- заявленный размер загрузки на официальной PDF-странице: около 7.93 MiB.

Карточка выпуска перечисляет, среди прочего:

- «От редакции»;
- «Наш журнал»;
- «Христианин и родина»;
- новогоднее послание ВСЕХБ;
- «Всесоюзное совещание евангельских христиан и баптистов в Москве с 26 по 29 октября 1944 г.»;
- «Образование объединенного союза евангельских христиан и баптистов»;
- приветственную телеграмму д-ра Рашбрука;
- «Мои впечатления от Всесоюзного совещания».

РГБ отдельно каталогизирует серию `Братский вестник` с началом в Москве в 1945 году и в составе указывает `1945, № 1-3`.

Этого достаточно для source identity и для использования официально опубликованного текстового представления как supporting witness. Этого недостаточно для утверждения, что exact PDF bytes уже находятся в нашем controlled archive.

## Сверка с MASTER

Канонический MASTER sheet `02 Periodicals` был просканирован по 1945 году.

В найденной строке присутствует:

- row 43;
- series `БРАТСКИЙ ВЕСТНИК`;
- year `1945`;
- issue `2`;
- file `_Братский Вестник__2_1945 год..pdf`;
- Drive ID `10fn4zQI-kuC5jgUBy0ZIYpcJXZwSS4kd`;
- SHA256 `25c43a0bd3c7c6f72d968b45361cb037ddea361ea95e7283aef56a71fb7a10f9`.

При том же bounded scan отдельной строки для выпуска №1 не найдено.

Следовательно:

- №2/1945 имеет canonical MASTER receipt;
- №1/1945 нельзя маркировать `IN DRIVE` или `LOCAL BINARY VERIFIED` только по существованию официального внешнего PDF;
- acquisition gap для №1 остаётся реальным и должен быть закрыт получением exact bytes и записью в канонический архивный контур, а не ссылкой-заменителем.

## Web-render limitation

Попытка открыть официальный `bv_1945_1.pdf` через текущий web PDF renderer возвращает cache miss. Поэтому `page_visual_verified` не выставляется.

Это инфраструктурная проблема чтения текущим renderer, а не доказательство отсутствия файла на стороне официального сайта.

## Production gate

Для будущего facsimile в главе `/vsehib-1944/` требуется:

1. получить exact binary `bv_1945_1.pdf` по официальной публикационной линии либо из другого проверенного archive holding;
2. вычислить SHA256 exact bytes;
3. визуально проверить титул и конкретные страницы материалов о совещании 26–29.10.1944 / образовании объединённого Союза;
4. записать page locators;
5. определить rights/attribution;
6. только после этого делать web derivative и `page_visual_verified=true`.

## Guard

Не подменять №1 уже полученным №2 и не использовать внешний PDF URL как суррогат локального archival receipt.

## Public references

- Московская церковь ЕХБ, issue page: `https://mbchurch.ru/publications/brotherly_journal/150/`
- Московская церковь ЕХБ, PDF catalog page: `https://mbchurch.ru/publications/brotherly_pdf/?PAGEN_1=4`
- exact PDF endpoint discovered from the official download control: `https://mbchurch.ru/upload/iblock/80f/bv_1945_1.pdf`
- РГБ serial catalog: `https://search.rsl.ru/ru/record/01002420890`
