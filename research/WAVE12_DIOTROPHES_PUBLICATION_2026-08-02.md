# Wave 12 — «Диотрефы нашего времени»: публикационная транзакция

**Дата:** 2026-08-02  
**Product authority:** `PRODUCT-OSK-WAVE12-PUBLICATION-2026-08-02`  
**Research authority:** `RESEARCH-OSK-AUTHORITY-2026-08-01-W10-FAITHFUL-WITNESS`  
**Research snapshot:** `f50b21ad6af5dd7aaa53c5be381929b353b26d58`  
**Pre-Wave12 Product base:** `2273b8c930eebf383d429b917d3636bc28a80bae`  
**Route:** `/articles/diotrefy-nashego-vremeni/`  
**Repository status:** `PUBLIC_ROUTE_RELEASED_SOURCE_BOUNDARIES_PRESERVED`

## Что выпущено

Wave 10 и Wave 11 сохранены как исторические evidence snapshots. Wave 12 не переписывает их утверждения и не превращает исследовательский closeout в новую доказательную базу. Она создаёт публичную читательскую композицию из уже утверждённых компонентов:

- 21 core case;
- 15 faithful pathways;
- 20 faithful responses;
- **181 authority sources**;
- **73 reader links**;
- **0 new direct quotes**.

## Публичные поверхности

Транзакция включает:

1. native Astro route и canonical metadata;
2. общий `SeriesReaderChrome` и часть II в `PASTOR_SERIES`;
3. route profile, ownership и strict-native migration contract;
4. Pagefind/search-manifest policy;
5. карточку в `/articles/` и на `/pastor-series/`;
6. отдельный sitemap shard, объявленный в `robots.txt`;
7. отдельный RSS серии, объявленный в head статьи и landing;
8. fail-closed successor contracts для Waves 10–11;
9. отдельный Wave 12 release contract;
10. production-like, browser, no-JS и print gates в GitHub Actions.

## Доказательная граница

- Упоминание лица или организации не означает одинакового юридического статуса дел.
- Уголовный приговор, признание вины, гражданское решение, независимое расследование, церковный вывод, обвинение и публичное заявление не смешиваются.
- Новый публичный маршрут не разрешает прямых цитат, отсутствующих в predecessor authorities.
- B1 не может быть единственной опорой спорного утверждения.
- C/D не входят в evidence core.
- Церковная процедура не заменяет гражданское сообщение и safeguarding.
- Прощение и восстановление общения не означают автоматического возвращения к должности.

## Preservation gate

`diotrophes-wave12-release-contract.mjs` читает точный pre-Wave12 commit и требует сохранить:

- все прежние ownership routes;
- все прежние migration-matrix routes;
- все прежние search-policy routes;
- все прежние search-manifest items и URL;
- все прежние series и parts;
- все прежние ссылки каталога статей.

Wave 12 должна добавить ровно один search item. Потеря любого старого route/item/part делает gate красным.

## Граница заявления

Этот документ фиксирует repository publication state. Внешняя доступность на `gospod-bog.ru` подтверждается только после успешного deployment workflow и отдельного readback; сам commit в `main` не подменяет проверку production URL.
