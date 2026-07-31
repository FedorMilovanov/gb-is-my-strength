# Официальные цифровые коллекции: рукописи, Реформация и протестантская история

**Дата:** 30 июля 2026 года  
**Межпроектный индекс:** https://github.com/FedorMilovanov/Research/blob/main/SOURCE_LIBRARY/OFFICIAL_DIGITAL_COLLECTIONS_70PLUS_INDEX_2026-07-30.md  
**Статус:** `LINK-FIRST / ITEM-LEVEL RIGHTS / NO AUTOMATIC FACSIMILE REPUBLICATION`

## Назначение

Документ отбирает из общего индекса 94 официальных коллекций те точки входа, которые полезны для `gospod-bog.ru`:

- новозаветные рукописи;
- Кумран и 1 Енох;
- древнееврейские библейские рукописи;
- история Реформации;
- пуритане и Вестминстерская ассамблея;
- история протестантизма и баптизма;
- безопасные открытые визуальные альтернативы защищённым факсимиле.

## Основные рукописные порталы

### NTVMR

- https://ntvmr.manuscriptroom.com/

Использование:

- каталогизация греческих рукописей Нового Завета;
- сиглы, датировки и библиография;
- сопоставление loci;
- исследовательский просмотр доступных изображений.

Условия конкретного изображения проверяются отдельно. Доступ в viewer не означает разрешение копировать изображение в production.

### CSNTM

- https://manuscripts.csntm.org/

Использование:

- P72 и другие греческие рукописи;
- навигация по библейским местам;
- сверка последовательности страниц;
- исследовательский просмотр.

Для каждого asset сохраняются manuscript ID, folio/page, institution, landing page и rights note.

### Codex Sinaiticus

- https://www.codexsinaiticus.org/en/
- https://www.codexsinaiticus.org/en/copyright.aspx

Синайский кодекс может использоваться как открытая исследовательская альтернатива только после проверки условий конкретного цифрового изображения. Древность рукописи не отменяет права на современную цифровую съёмку и интерфейс проекта.

### DigiVatLib

- https://digi.vatlib.it/

Приоритет:

- P72 / Papyrus Bodmer VII–VIII;
- метаданные и последовательность листов;
- IIIF manifest для исследовательской навигации.

Публичная online publication изображений требует соблюдения условий Vatican Library. Private-study screenshot не переносится в GitHub или production asset.

### Leon Levy Dead Sea Scrolls Digital Library

- https://www.deadseascrolls.org.il/explore-the-archive

Приоритет:

- 4Q204;
- пластины и фрагменты Кумрана;
- официальные идентификаторы изображений;
- исследовательский просмотр полного спектра и infrared.

До письменного разрешения IAA изображения остаются `LINK-ONLY / PRIVATE-STUDY`. Для сайта используется собственная схема по отдельно лицензированной открытой транскрипции.

### Дополнительные manuscript catalogues

- Digital Bodleian: https://digital.bodleian.ox.ac.uk/
- Cambridge Digital Library: https://cudl.lib.cam.ac.uk/
- British Library digitised manuscripts: https://www.bl.uk/collection/digitised-manuscripts-archives
- Europeana Manuscripts: https://www.europeana.eu/en/themes/manuscripts
- Digital Scriptorium: https://digital-scriptorium.org/
- e-codices: https://www.e-codices.unifr.ch/en
- HMML Reading Room: https://www.vhmml.org/readingRoom/

Эти порталы используются для поиска рукописных аналогов, сравнительных материалов и открытых визуальных решений. Статус повторного использования определяется item-level карточкой.

## Реформация и пуритане

Для исторических портретов и гравюр приоритетны:

- Wikimedia Commons с открытой карточкой;
- Library of Congress Prints & Photographs;
- Europeana;
- Gallica/BnF;
- Digital Bodleian;
- Cambridge Digital Library.

Целевые лица и темы:

- Жан Кальвин;
- Мартин Лютер;
- Джон Оуэн;
- Томас Гудвин;
- Вестминстерская ассамблея;
- английские пуритане;
- ранние баптисты и евангельские христиане.

Нельзя считать портретом человека:

- современный памятник;
- памятную табличку;
- обложку поздней книги;
- перевёрнутую копию того же изображения;
- современную реконструкцию без источника.

Для каждого визуала сохраняются:

```yaml
subject: "John Owen"
object_type: portrait | engraving | manuscript | book | place
creator: "..."
date: "..."
institution: "..."
landing_page: "https://..."
original_url: "https://..."
license: "..."
credit_line: "..."
sha256: "..."
production_status: APPROVED | ATTRIBUTION_REQUIRED | LINK_ONLY | HOLD
```

## Протестантская и баптистская история

Открытые старые книги и периодика ищутся через:

- Library of Congress;
- Internet Archive;
- HathiTrust;
- Google Books;
- Open Library;
- WorldCat;
- Wikimedia Commons Books and Documents.

Приоритет для проекта:

1. история евангельских христиан и баптистов России;
2. первичные конфессиональные документы;
3. Вестминстерское исповедание и катехизисы;
4. труды Оуэна, Гудвина и других пуритан;
5. исследования Реформации;
6. русская религиозная периодика;
7. документальные свидетельства гонений и церковной жизни.

Региональная история отдельного американского штата или общий справочник не должны вытеснять источники, непосредственно связанные с содержанием сайта. Поэтому автоматический поиск проходит тематический и редакционный gate, а не только проверку PDF и лицензии.

## Открытые текстовые альтернативы

Для production безопаснее использовать:

- SBLGNT — греческий текст под CC BY 4.0;
- Qumran-Digital — открытую транскрипцию 4Q204 под CC BY-SA 4.0;
- собственные схемы и карты;
- собственную типографическую реконструкцию с чётким различением сохранившегося и восстановленного текста;
- ссылки на официальные viewers вместо нелицензированных скриншотов.

Открытая транскрипция не передаёт права на институциональное факсимиле.

## HTTP-доступ и runner-ограничения

Research провёл автоматизированный аудит 94 официальных URL:

- 0 подтверждённых мёртвых ссылок;
- 81 прямой успешный ответ;
- 8 endpoints блокировали automation HTTP 403;
- 4 дали timeout;
- 1 российский endpoint был недоступен из Azure-сети.

Документ аудита:

https://github.com/FedorMilovanov/Research/blob/main/SOURCE_LIBRARY/processed/OFFICIAL_COLLECTIONS_LINK_AUDIT_2026-07-30.md

HTTP 403 или timeout GitHub runner не доказывает исчезновение коллекции. Такие источники помечаются `MANUAL-BROWSER-CHECK`.

## Связанные документы

- 4Q204/P72 policy: [`OPEN_SOURCE_MANUSCRIPT_LIBRARY_4Q204_P72_2026-07-30.md`](OPEN_SOURCE_MANUSCRIPT_LIBRARY_4Q204_P72_2026-07-30.md)
- master open-access index: https://github.com/FedorMilovanov/Research/blob/main/SOURCE_LIBRARY/MASTER_OPEN_ACCESS_SOURCE_INDEX_2026-07-30.md
- 94 official collections: https://github.com/FedorMilovanov/Research/blob/main/SOURCE_LIBRARY/OFFICIAL_DIGITAL_COLLECTIONS_70PLUS_INDEX_2026-07-30.md

## Граница хранения

- GitHub: ссылки, метаданные, транскрипции с открытой лицензией, схемы, rights decisions и claim-to-citation ledgers.
- Частный архив: официальные open-access PDF, manifests, SHA-256, переписка учреждений и private-study screenshots.
- Production: только объекты с подтверждённым статусом и корректной атрибуцией.
- Запрещено: IAA/P72 facsimiles без разрешения, современные книги сомнительного происхождения и институциональные viewer screenshots без права публикации.
