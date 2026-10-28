# Apostasy — план восстановления материала (2026-10-28)

## Lane record

- **Mode:** LANE (content recovery, план; публикация — отдельным решением владельца)
- **Lane / owner:** `CONTENT-APOSTASY-RECOVERY` / владелец принимает редакционное решение; исполнитель — сессия владельца.
- **Base / rollback SHA:** `main@2d5b1474014596860734fd3de45cf9efe401476d`.
- **Allowed files (будущий lane):** только MDX-файлы ниже; маршруты/хаб — отдельным SYSTEM-шагом по route-контракту.
- **Source of truth:** теги ниже + тела PR #2145/#2164. Этот план ничего не публикует.

## Что сохранено и где

Материал **не потерян и не опубликован**: в текущем `main` этих файлов нет.

| Материал | Источник | Точный SHA / тег | Объём | Статус в источнике |
|---|---|---|---|---|
| Мега-статья «Отступление от веры: Иуда, Евреям 6 и предупреждения всей Библии» | PR #2145, `src/content/articles/otstuplenie-ot-very-iuda-evreyam-6.mdx` | `994b8735f79383c860ee6502ed36a9bcd9531886`, тег `archive/stale-2026-10-28/content/apostasy-bible-study`, дубль `refs/pull/2145/head` | 78 242 байта, 319 строк, readingTime 42 | `draft:false`, `noindex:false` — была готова к публикации |
| Серия «ОТСТУПНИКИ», часть I `otstuplenie-chto-govorit-bibliya.mdx` | PR #2164 | `a95697592c58ef6494ac9e5182ebb851c77cba95`, тег `archive/stale-2026-10-28/content/apostasy-five-part-series-20261003`, дубль `refs/pull/2164/head` | 39 701 байт | `draft:true`, `noindex:true` |
| Часть II `otstupniki-biblii-iuda-saul-ierovoam-dimas.mdx` | PR #2164 | тот же тег | 35 556 байт | draft-кандидат |
| Часть III `petr-i-iuda-padenie-ili-otstuplenie.mdx` | PR #2164 | тот же тег | 39 397 байт | draft-кандидат |
| Часть IV `otreklis-ot-hrista-istoriya-cerkvi.mdx` | PR #2164 | тот же тег | 33 217 байт | draft-кандидат |
| Часть V `kogda-chelovek-uhodit-ot-very.mdx` (пастырский ответ) | PR #2164 | тот же тег | 39 617 байт | draft-кандидат |

Текстовое пересечение мега-статьи и серии — **0%** по содержательным строкам: это два разных произведения, а не редакции одного. Локальная выгрузка всех 6 файлов с сверкой blob-SHA выполнена владельцу на чтение (вне репозитория).

## Почему не в main

- #2145 закрыт владельцем 2026-10-02 при старте successor-серии #2164 (архитектурное supersede, не брак текста).
- #2164 закрыт владельцем 2026-10-28 unmerged: «остаётся draft, нужен owner review»; checks на head были 17 SUCCESS / 4 SKIPPED.
- Ветви удалены cleanup'ом 2026-10-28 только после создания точных архив-тегов.

## Варианты восстановления (решение владельца)

**Вариант A — серия (рекомендуемый исходный замысел).**
1. Свежий content-lane от текущего `main`; перенести 5 MDX из тега:
   `git checkout archive/stale-2026-10-28/content/apostasy-five-part-series-20261003 -- src/content/articles/`
   (дельта обеих веток — только добавление файлов, конфликтов с main нет).
2. Owner review текстов; оставить `draft:true` до готовности.
3. Отдельный SYSTEM-шаг: hub/routes/ownership/search-проекции по route-контракту (`migration/page-ownership.json`, `data/route-profiles/*`), без ручной правки derived matrix.
4. Проверки контент-лейна: production-like build, targeted content/browser контракты, exact-head CI.

**Вариант B — мега-статья одной публикацией.**
Тот же перенос одного файла из тега #2145. Была `draft:false`; перед публикацией обязателен свежий editorial проход (даты, источники, `sourcesRequired:true`) и route-регистрация одной статьи.

**Вариант C — оставить в архиве.** Материал сохраняется тегами; этот план фиксирует, что решение осознанное.

## Запреты lane

- Не восстанавливать старые ветки force-push'ем поверх новых; перенос — только свежим lane от актуального `main` (или восстановлением ветки из тега с последующим reopen PR — по выбору владельца).
- Не публиковать (`draft:false`) без owner review и route-этапа.
- Не удалять архив-теги апостasy до merge выбранного варианта.
