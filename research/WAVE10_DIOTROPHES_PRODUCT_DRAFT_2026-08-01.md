# Wave 10 — продуктовый черновик «Диотрефы нашего времени»

**Дата:** 2026-08-01  
**Статус:** `EDITORIAL_DRAFT / PUBLICATION_HOLD / NO PUBLIC ROUTE`  
**Research authority:** `FedorMilovanov/Research@0f2a706dff1682117fad54c45c8d7b25c98b62eb`  
**Product base / rollback:** `41617252e18939599e1e3f45e62d8d10d0fd1b27`

## Lane record

- **Mode:** `LANE` с изолированным read-only evidence workflow;
- **Lane / owner:** `agent/diotrophes-wave10-product-draft-20260801` / ChatGPT;
- **Purpose:** перенести Wave 9 authority в полный reader-form draft без публикационного включения;
- **Allowed:** новый компонент статьи, отдельный manifest, отдельный validator, отдельный read-only workflow и этот отчёт;
- **Forbidden:** `src/pages/**`, `migration/**`, route profiles, route-search policy, search manifest, sitemap, RSS, pastor-series config, shared runtime, CSS/JS и generated HTML;
- **Adjacent active work:** PR #680 владеет NoteRegistry и generated HTML; PR #698 владеет Offline/PWA и generated HTML. Пересечений нет;
- **Production claim:** нет.

## Доказательная рамка

Черновик подчинён `RESEARCH-OSK-AUTHORITY-2026-08-01-W9`:

- 148 записей в полной Research authority;
- 119 case-evidence sources;
- 102 A1/A2/A3;
- 21 `ANTISOVETY_CORE` кейс;
- один главный властный механизм на кейс;
- B1 — только дополнительное подтверждение и хронология;
- C/D не используются;
- dark-side, standalone и conditional маршруты исключены;
- новые прямые цитаты не разрешены.

Для reader draft отобраны 54 записи:

- 42 case-evidence records — по две на каждый core-кейс;
- 12 библейских, экзегетических, академических и safeguarding-контролей;
- 40 прямых читательских ссылок на официальные органы, независимые расследования, суды, академические издательства и первичные библейские ресурсы.

## Архитектура текста

Черновик содержит:

1. библейский профиль Диотрефа по 3 Ин. 9–10;
2. захват и персонализацию власти;
3. использование совета и процедуры;
4. контроль информации и защиту платформы;
5. возмездие и подавление вопросов;
6. духовно-сексуальное принуждение;
7. финансовую зависимость;
8. пастырский вывод;
9. 21 evidence card;
10. источник-рамку и 10 обучающих вопросов.

Ни одна карточка не получает заголовок-приговор вида «X — Диотреф». Установленный судебный факт, независимый review, safeguarding finding, внутренний документ и оспариваемое утверждение не смешиваются.

## Почему route не создаётся в этой волне

Wave 10 доказывает редакционную полноту и корректность reader-form source. Публичное включение затрагивает protected route authority и общие поверхности:

- `migration/page-ownership.json`;
- `data/route-profiles/*`;
- `data/route-search-policy.json`;
- Pagefind/search manifest;
- sitemap/RSS;
- pastor-series navigation;
- browser/visual publication evidence.

Эти изменения будут отдельной Wave 11 после завершения или синхронизации активных системных PR. До этого компонент не является доступной страницей и не может индексироваться.

## Fail-closed контракт

`scripts/diotrophes-wave10-contract.mjs` блокирует:

- менее 21 core-кейса или добавление чужого маршрута;
- менее 54 curated records или менее 40 reader links;
- отсутствие A-class boundary;
- появление excluded cases;
- персональный заголовок «Диотреф»;
- новые прямые цитаты;
- создание публичного route;
- нарушение обязательной структуры статьи;
- объём ниже премиальной редакционной планки.
