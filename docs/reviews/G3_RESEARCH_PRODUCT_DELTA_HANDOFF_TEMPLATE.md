# G3 Research → Product: шаблон delta handoff A/B

Локальный вспомогательный шаблон по [Owner7052283178](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338#issuecomment-7052283178), не новая редакционная политика, реестр claims или разрешение публикации. Research-роли и подписи — по [Research7052277937](https://github.com/FedorMilovanov/Research/pull/582#issuecomment-7052277937). Product/UI writer — только №8; №1 координирует проверку и приёмку.

## Две статьи, разный допуск

- **A — история:** исследовательский scope 2011–2024; текущий headline 2013–2024 самовольно не расширять. `G3HistoryArticle.astro` / `G3HistoryFeature.astro` — source-only рукопись. Все девять `G3-HIST-PUB` остаются `PUBLICATION_HOLD`; production guards неизменны. Без signed research approval нельзя включать historical route, index, RSS или sitemap. Сохранять оговорки: нынешний `g3min.org` может быть иным сайтом; карточка GNL не равна расшифровке проповеди.
- **B — кризисы 2025–2026:** `G3Dossier.astro`, `/journal/dossiers/g3/`. Existing immutable 16 claims / 21 sources, URL и date provenance не переопределять новым материалом. Изменение или добавление claims требует отдельного проверенного Research→Product handoff и явного corrections provenance, а не молчаливого расширения старого seal.
- **C — не утверждена:** возможный отдельный вопрос о разногласиях/коалиции 2018–2024 должен быть обоснован Research №1+№3 и отдельно одобрен. Пока не создавать route, дизайн, SEO, пустую карточку или третью bibliography. Не дублировать утверждения A/B.

## Скопировать для одной атомарной правки

Все поля ниже — незаполненные поля, не свидетельства и не подписи. Для нескольких claims — отдельные записи, не одно общее одобрение пакета.

```text
Handoff ID / revision: <уникальный ID и версия>
Research provenance: <repo/PR, exact SHA, evidence path и SHA256>
Target Product: <exact base SHA; source path; heading/paragraph anchor>
Article A/B: <A или B; почему именно эта статья, без повтора другой>
Claim ID: <существующий ID либо явно proposed ID; новый ID не означает допуск>
Exact source locator: <первоисточник URL + архив/дата; страница/раздел
  либо media timestamp + transcript lines; точный фрагмент и полный контекст>
Article fragment improved: <какой конкретный фрагмент улучшен и зачем>
Old sentence: <дословно на указанном Product base; для вставки — точное место>
New sentence: <точный предлагаемый текст, включая подпись/сноску при изменении>
Source limits / alternatives: <что доказано; чего источник не доказывает;
  значимые возражения; карточка/транскрипт/пересказ не взаимозаменяемы>
Rights / publication state: <права на цитату/media/transcript, ограничения,
  evidence state и отдельно publication state; CATALOG_ONLY/CAPTIONS_READ
  не выдавать за просмотр/прослушивание оригинала; неизвестное явно>
Reviewer: <имя/роль, прочитанный оригинал, claim/locator/rights;
  ACCEPTED/REJECTED/HOLD с причиной и ссылкой-подписью>
Cross-review: <для существенной исторической поправки — профильная + независимая
  сверка; для репутационного claim — также сильнейшая противоположная версия>
Signed Research handoff: <утверждённая revision/SHA, подписант и immutable receipt>
Product acceptance: PENDING — <№8: ACCEPT/REJECT, принятая revision,
  exact Product SHA и receipt; №1: проверка результата/основание решения>
Corrections provenance: <что и почему исправляется; correction-log entry;
  для B — отдельная связь с прежним seal и date provenance>
Publication authorization: NOT_GRANTED — <отдельное разрешение уполномоченного
  Owner на конкретный материал/SHA; для A до него PUBLICATION_HOLD>
```

## Fail-closed перед интеграцией

1. Нет точного locator, подтверждения прав, reviewer или signed Research handoff — запись остаётся candidate/рукописью, не Product-фактом. До handoff допустимы только рукопись/candidate и безопасная изолированная preview, не public route. `Product acceptance: PENDING` и `Publication authorization: NOT_GRANTED` не трактовать как согласие.
2. №8 принимает только отдельный bounded content integration: нужные абзацы, подписи, сноски и источники нужной статьи; никаких прямых Research-коммитов в Product-ветку. Сохранить premium visual, SOURCE navigation, heading hierarchy, mobile TOC, print, SEO/canonical, correction log, byline/date/media и существующие ownership/guards. Значимую редакционную дату менять только по фактической принятой правке и её provenance.
3. Проверки — на фактическом итоговом SHA и затронутом содержимом/поверхностях. Signed Research handoff, Product acceptance, публикационный допуск и release GO — разные решения. Шаблон не отменяет текущие CLS/noJS/Back/focus/BEFORE→AFTER gates, не разрешает merge/deploy и не задерживает текущий TOC/visual RC ожиданием новых Research deltas.
