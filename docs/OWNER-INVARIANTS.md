# OWNER INVARIANTS — канонический список инвариантов владельца

**Updated:** 2026-08-02
**Owner decision:** issue #219 + direct owner directive 2026-08-02

> Этот файл хранит устойчивые требования владельца, а не снимок конкретной ветки,
> sandbox-сессии или UI-итерации. Менять его можно только по прямому решению владельца
> в отдельном SYSTEM PR с exact-head проверкой.

## 1. Порядок авторитета

При конфликте используются, по убыванию силы:

1. прямое текущее решение владельца;
2. текущий `docs/OWNER-INVARIANTS.md` и нормативные разделы `AGENTS.md`;
3. текущий `main`, открытые PR/issues и exact-head CI;
4. текущие `WORK_MODES`, `LANE_LOCK_POLICY`, source registries и guards;
5. AuditRepo как канон подтверждённого backlog/reverify evidence;
6. исторические PR, отчёты, sandbox-документы и старые visual baselines.

Исторический документ не становится вечным инвариантом только из-за того, что когда-то
был каноническим. Одновременно новый агент не вправе отменять owner-sensitive правило
только потому, что оно старое.

## 2. Контент и правда

1. **Никакой правдоподобной лжи.** Квизы, «Коротко», числовые заявления, цитаты,
   имена и подписи берутся из фактического текста или заявленного источника. Визуальный
   или Astro↔legacy паритет не доказывает фактологическую истинность.
2. **Свежесть не подделывается.** CSS/JS/технические коммиты не меняют
   `article:modified_time`, `dateModified` и sitemap `lastmod`. Дата обновляется только
   при значимом редакционном изменении.
3. **Цитаты Писания дословны по заявленному изданию** (по умолчанию Синодальный).
   Пересказ или модернизация не выдаются за прямую цитату.
4. **Авторство:** `Автор-редактор` для типов A/B и `Редактор` для типа C. Формулировку
   `Автор: Фёдор Милованов` и удалённый AI-disclosure не восстанавливать.

## 3. UI и владельческие зоны

5. **PremiumControls / Floating Cluster / Gill остаются owner-sensitive.** Запрещены
   самовольный редизайн, перенос контролов, изменение смысловой иерархии, ослабление
   accessibility/keyboard/TTS контрактов и обход текущих visual/browser guards.

   При этом исторический `pre-v16` submenu, rounded-frame или иной старый снимок — это
   provenance, а не бессрочная архитектурная истина. Он обязателен только если закреплён
   текущим owner decision, текущим source contract или exact-head blocking guard.
   Полезное изменение проводится отдельным owner-authorized lane с side-by-side evidence;
   blanket freeze и календарный срок сами по себе не заменяют проверку.
6. **Глоссарий и Bible tooltips — owner-controlled data.** Массовые правки
   `data/glossary.json`, `data/verses.json`, `data/bible/` агентами запрещены без
   отдельного решения. `.summary-card` остаётся plain-text hard lock.
7. **Визуальный контракт нельзя ухудшать.** Нужны текущие screenshots, browser checks
   и owner review; фраза «выглядит нормально» не является доказательством.
8. **Изображения владельца не заменяются AI-генерациями** без прямого запроса.

## 4. Процесс и доверие

9. **Все обычные изменения идут через branch + PR.** FAST означает малый scope,
   а не прямой push в `main`. Emergency direct-main требует явного решения владельца,
   немедленной exact-head проверки и reconciliation.
10. **Production-like green не равен финальному green.** До merge проверяется финальный
    SHA PR; deploy/live witness фиксируется отдельно и не подменяется source-CI.
11. **Зелёный шаг workflow не равен доказательству.** Допуски `continue-on-error`,
    `|| true`, skipped jobs и bot-commits анализируются явно. Закрытие требует fixture,
    fix, применимых gates и immutable SHA.
12. **Каноническая правда аудита — текущий AuditRepo**, прежде всего
    `verified/MASTER_BUG_MATRIX.md` и актуальные verified ledgers/recovery evidence.
    `SUPER_AUDIT_2026-07-06_14a49be8.md` сохраняется как важный исторический baseline,
    но не является единственным или автоматически самым свежим источником.
13. **Среда определяется live-discovery.** Старый sandbox-документ полезен как список
    известных ловушек, но не гарантирует текущие CPU/RAM, persistence, сеть, редактор
    или установленные браузеры.
14. **Временная автоматика не переживает свою транзакцию.** Writer, materializer,
    trigger, patcher и workflow удаляются до финального exact-head merge proof.

## 5. Verified backlog и цель закрытия

15. **AuditRepo — проверенный backlog, а не телеметрия `main`.** Матрица обязана хранить
    подтверждённые проблемы, их disposition и evidence, но не должна догонять каждый
    source commit, deploy, route count или временное движение active PR.
16. **Цель владельца — довести verified open backlog до нуля.** Работа идёт циклом:
    актуальная верификация → закрытие fixed/stale/false/duplicate → bounded repair
    confirmed-current проблем → exact-head reverify.
17. **Сначала verify, потом repair.** Исторический, raw или suspected claim не является
    разрешением менять product. На одном exact source anchor нужно установить реальный
    исход: fixed-current, stale-on-current-head, false-positive, duplicate/merged,
    partial/narrowed либо confirmed-current.
18. **Историю не стирать.** Реальную исправленную находку закрывать как fixed, устаревшую
    как stale, ошибочную как false-positive, дубль как merged/duplicate. Evidence и
    provenance сохраняются; частично исправленная строка остаётся открытой только в
    суженной фактической формулировке.
19. **Reconciliation должна быть пропорциональной.** AuditRepo обновляется при реальном
    изменении статуса, scope, evidence, repair-readiness, счётчиков или meaningful handoff.
    Отдельная синхронизация только ради нового `main` SHA не требуется и не должна
    задерживать маленький доказанный repair.
20. **Не превращать закрытие в мегапроект.** Подтверждённые проблемы ремонтируются
    независимыми mergeable lanes по root cause/поверхности. Нельзя смешивать матричную
    уборку, несвязанные product fixes, README/authority sync и production claims в один
    гигантский PR. Каждый lane заканчивается применимыми checks на final head.
