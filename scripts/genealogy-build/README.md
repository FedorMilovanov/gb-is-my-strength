# genealogy-build — пайплайн данных «Генеалогии Спасителя» (Phase 1)

Генерирует производный датасет `data/genealogy/v2/` из открытых источников.
Стратегия и контракт: `docs/GENEALOGY-FOUNDATION-2026-07-11.md` +
`FedorMilovanov/AuditRepo` → `projects/gb-is-my-strength/incoming/claude-genealogy-atlas-strategy/2026-07-11/`.

## Запуск

```bash
node scripts/genealogy-build/build.mjs all      # fetch → parse → ru → merge → validate → emit
node scripts/genealogy-build/build.mjs fetch    # только скачивание источников в .cache/
node scripts/genealogy-build/build.mjs test     # самопроверки парсера/экстрактора (fixtures)
node scripts/genealogy-build/build.mjs validate # валидаторы на текущем data/genealogy/v2/
```

Требования: Node ≥ 22 (встроенный `fetch`). Внешних npm-зависимостей НЕТ (намеренно:
пайплайн не должен добавлять ничего в package.json).

> **npm-обёртки** (`npm run genealogy:build/test/validate`) намеренно НЕ добавлены:
> `package.json` — shared/high-risk файл (AGENTS §0), правится только в lane. Скрипты
> пропишутся в lane интеграции генеалогии с рантаймом (Phase 3/5), когда `package.json`
> трогается по делу вместе с deploy/CI-гейтами. Пока — прямой вызов `node …` выше.

## Источники (пины по SHA256 — см. config.mjs)

| Источник | Роль | Лицензия |
|---|---|---|
| STEPBible **TIPNR** (Tyndale House) | ядро: персоны, родители/партнёры/потомки, все ссылки | CC BY 4.0, атрибуция обязательна |
| Синодальный перевод (JSON, 66 книг) | извлечение русских имён по стиху первого упоминания | public domain (1876) |
| `data/genealogy/genealogy.json` (v1, 156 персон) | ручной скелет: русские имена-сиды, MT/LXX/Sam-хронология, disputed, significance | наш, in-repo |
| Theographic Bible Metadata | НЕ входит в пайплайн — независимый свидетель для сверки | CC BY-SA 4.0 (share-alike — потому и не копируем) |

**Лицензионные обязательства выхода:** производный датасет `data/genealogy/v2/` —
CC BY 4.0, атрибуция «Данные персон: STEPBible.org / Tyndale House Cambridge (CC BY 4.0),
русские имена: Синодальный перевод + редакция проекта». Сырой TIPNR-файл в репозиторий
НЕ коммитится (просьба STEPBible не редистрибутить сырьё; скачивается в `.cache/`,
который в .gitignore) — только производный результат.

## Артефакты (коммитятся)

```
data/genealogy/v2/
├── persons.json     # ~3k персон: id, en, ru{name,source,review}, gender, firstRef, tribe, skeleton-поля
├── edges.json       # типизированные связи: parent (отдельно father/mother), spouse; маркеры (a)/(d)/(f)/(?)
├── ru-overrides.json# ручные правки русских имён (редакторский слой; выигрывает у автоизвлечения)
├── meta.json        # счётчики, версия пайплайна, атрибуция, sha256 источников
└── VALIDATION.md    # человекочитаемый отчёт валидаторов (регенерируется)
```

`persons.json`/`edges.json`/`meta.json`/`VALIDATION.md` — генерируемые (руками не
править; правки — через `ru-overrides.json`, скелет v1 или код пайплайна).

## Этапы

1. **fetch** — скачивание источников в `scripts/genealogy-build/.cache/` с проверкой SHA256
   (расхождение = ошибка: источник изменился → осознанно обновить пин в config.mjs).
2. **parse** — строгий парсер PERSON-секции TIPNR: uid `Name@Book.c.v`, родители
   («Отец + Мать»), сиблинги/партнёры/потомки, колено, описание, маркеры `(a)` предок,
   `(d)` народ-потомок, `(f)` основатель, `(?)` неоднозначность (решения Tyndale).
3. **ru** — русские имена: (1) сиды из v1-скелета; (2) извлечение из Синодального
   стиха первого упоминания (паттерны «имя одному: X», «родил X», списки сыновей;
   версификационный фолбэк ±2 стиха); (3) транслит-фолбэк по правилам (метится
   `review: true`). Ручной слой — `ru-overrides.json`, побеждает всё.
4. **merge** — влить v1-скелет (156): хронология MT/LXX/Sam (AM), disputed-узлы,
   significance, lineage/era/role. Мэппинг slug↔TIPNR + таблица исключений; немэпнутые — в отчёт.
5. **validate** — дубликаты id, битые ссылки рёбер, циклы родительского графа,
   изолированные персоны, покрытие ru-имён по source-типам, гендерная целостность.
   Провал жёстких инвариантов = exit 1.
6. **emit** — запись `data/genealogy/v2/*` + VALIDATION.md.

## Статус Phase 1

Exit-критерии (Foundation-док §4.1): 0 orphans/циклов; ключевые персоны (v1-156 +
золотой хребет) — ru-имена руками/сидами; ≥98% персон с ru-именем (авто+редактура);
счётчики кластеров сверены. До достижения — датасет `v2` считается ЧЕРНОВИКОМ
(в рантайм сайта не подключается, /rodosloviye/ живёт на v1).
