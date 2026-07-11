# ГЕНЕАЛОГИЯ СПАСИТЕЛЯ — FOUNDATION (2026-07-11)

> **Статус:** foundation-аудит / стратегия v2 (proposal-open — ждёт 6 решений владельца).
> **Полный аудит:** AuditRepo `projects/gb-is-my-strength/incoming/claude-genealogy-atlas-strategy/2026-07-11/`
> (REPORT.md + evidence + 65 внешних источников).
> **Заменяет по объёму** GENEALOGY-MASTERPLAN-2026-06-18 §4 («~75–120 узлов»):
> целевой охват теперь — **полная Библия (все именованные персоны, ~3–3.6k)** по
> референсам владельца (`docs/design-references/selected/01_genealogy_references/` +
> 2 новых скрина 2026-07-11). Богословская база (GENEALOGY-DEEP-ANALYSIS-2026-06-18:
> хроногенеалогии MT, disputed-узлы, «все линии ко Христу») — БЕЗ изменений, остаётся каноном.

## 1. Вердикт по текущему v1 (156 персон, React Flow)

v1 = хороший прототип, НЕ финальное ядро. Сохраняем: маршрут `/rodosloviye/` (SEO),
types.ts (расширяем), genealogy.json как **хронологический скелет** (MT AM, disputed,
significance), UX-паттерны (DetailPanel, SplitView Мф/Лк, фокус-линия, тур,
keyboard-nav). Заменяем: рендер-ядро (RF+runtime dagre+hide-zoom), inline-стили,
данные-как-props (128K HTML уже сейчас; ×20 не переживёт).

Инженерные пороги (внешние источники, детально в AuditRepo artifacts):
- SVG комфортен до ~2–3k DOM-элементов; карточка ≈ 5–8 эл. ⇒ 3k+ персон полным
  рендером = ~20k эл. = нельзя. **LOD-агрегация обязательна.**
- React Flow, слово мейнтейнеров: «not intended … 1000+ nodes/edges».
- ⇒ Layout считается на билде; рантайм — pan/zoom + морфинг + lazy-чанки;
  видимых карточек ≤ ~400–500.

## 2. Архитектура v2 (кратко; полная — в AuditRepo REPORT §S5)

**Данные `data/genealogy/v2/`**: persons / groups (кластеры генеалогии) / edges
(типизированные: birth|legal|levirate|spouse|tradition) / eras / views («быстрые
ссылки») + `build/` (генерируемые layout-l0/l1/l2-чанки, search-index).
Пайплайн `scripts/genealogy-build/`: **STEPBible TIPNR** (CC BY 4.0, ядро полноты:
parents/partners/siblings/offspring + все стихи) → merge со 156-скелетом →
русские имена: выравнивание по Синодальному стиху первого упоминания (TIPNR даёт
стих; полный Синодальный JSON — внешний public-domain вход: в repo
`data/bible/synodal/` только ВЫДЕРЖКИ для поповеров, не полный текст) +
**Wikidata** (CC0) + транслит-правила хвоста → валидаторы
(0 orphans/циклов, счётчики кластеров, % ru-имен) → ELK/кастом-layout по эпохам.
Theographic (CC BY-SA) — только независимая сверка, share-alike не наследуем.
Итоговый датасет — CC BY 4.0 с атрибуцией Tyndale/STEPBible; сырой TIPNR не
перепубликуем (просьба STEPBible) — vendored build-input, наружу только производный JSON.
**Оба ядра проверены скачиванием и парсингом** (AuditRepo evidence
dataset-feasibility-probe): Theographic — 3 067 персон (отец у 1 584); TIPNR —
**3 056 персон** (PERSON-секция), 3 329 строк с родителями ⇒ TIPNR подтверждён
ядром; реальный универсум ~3.0–3.1k персон (реф. «3 254» — в 6% от реальности).
**Извлечение русских имён доказано экспериментом**: 60/60 стихов-рефов TIPNR
разрешились в полном Синодальном JSON; 8/9 ручных выравниваний нашли имя прямо в
стихе первого упоминания (Peleg→Фалек, Methuselah→Мафусал…); промах Jesse@Rut.4.17 —
сдвиг версификации, закрывается STEPBible Versification-данными.

**Движок (рекомендация, Решение №2):** `GenealogyEngine` — собственное
SVG-ядро, vanilla TS в `src/lib/genealogy-engine/`, d3-zoom + предвычисленный layout,
FLIP-морфинг кластеров, виртуализация вьюпорта, БЕЗ React в рантайме (цель ≤ 70KB gz
против сегодняшних 136KB gz RF+React). Fallback-мост: RF с жёстким LOD-бюджетом.
Canvas/WebGL-ядро отвергнуто (владелец заказал SVG; a11y/печать/пергамент).

**LOD-контракт:** L0 «Обзор» (хребет Адам→Ной→Авраам→Иаков→Давид→Христос +
10–14 мега-узлов «+N имён») → L1 «Ветвь» (развёртка кластера, 100–300 узлов) →
L2 «Персоны» (полные карточки, ≤ 400–500 видимых, lazy-чанки). Anchor continuity
(ZMLT): якоря не прыгают между уровнями. Фильтры/фокус — поверх LOD.

**Бюджеты (CI):** JS ≤ 120KB gz (цель 70), initial data ≤ 300KB gz, DOM ≤ 2k эл.,
60fps desktop / ≥40fps throttled mobile, LCP < 2.5s, Lighthouse mobile ≥ 90 / a11y ≥ 95.

**Статический слой (обязателен):** build-time HTML-оглавление генеалогии (эпохи →
кластеры → персоны, `data-pagefind-body`), noscript, print-CSS, JSON-LD Dataset.

## 3. Куда и как вводить

- URL: `/rodosloviye/` (не менять; бренд H1 «Генеалогия Спасителя»). НЕ /karty/.
- Режим: strict-native-app (уже назначен в ownership/route-profile).
- Только lane: `lane/genealogy-<phase>`, Risk 2–3; PremiumControls не трогаем
  (§3.10); legacy `/css/`+`/js/` не расширяем (новый код в `src/**`); Tailwind не
  вводим (§2.1) — токены сайта + scoped CSS; обе темы (`html.dark`).
- CSP/SW: всё self-hosted; данные lazy-чанками; SW precache — только shell,
  чанки — runtime-cache.
- Гейты lane: cache-bust (при legacy-затрагивании) → validate:static-publication →
  guard:shared-files → data:consistency → strangler:deploy-readiness →
  visual-audit + interactive-audit (добавить сценарии генеалогии) → бюджеты §2.
- **Discoverability**: сейчас у маршрута 0 входящих ссылок (orphan). Карточку на
  главной, ссылку из karty-hub и статей включаем ТОЛЬКО по достижении эталонного уровня.
- v1 живёт на проде до полного паритета v2; переключение — одним lane с
  visual-baseline до/после.

## 4. Фазы (месяцы; без дедлайнов — доктрина владельца 2026-07-07)

0. **Решения владельца** (6 шт. — AuditRepo REPORT §S10: объём, движок B/A,
   пост-Христос слой, MT+LXX toggle, бренд, слой женских фигур).
1. **Фундамент данных** (4–8 нед): пайплайн + v2-датасет + валидаторы + отчёт.
   Без единой строки UI. Exit: 0 orphans, ключевые имена ru-редактированы.
2. **Контракт движка** (3–6 нед, дизайн-до-кода): GENEALOGY-ENGINE-CONTRACT.md +
   throwaway-прототип морфинга, держащий бюджеты на реальном L0/L1.
3. **Флагман-рендер** (6–10 нед): ядро + L0/L1/L2 + поиск/фокус/минимапа/туры/
   URL-share + mobile (vertical cards, pinch — паттерн MyHeritage 2025).
4. **Контент и апологетика** (3–6 нед): все disputed-узлы, MT/LXX/Sam toggle,
   «после Христа» (предание — отдельным слоем), статический SEO-слой.
5. **QA + релиз** (2–4 нед): visual-baseline, a11y, перф на устройствах, включение
   ссылок, 14-дневный freeze.

Acceptance = 8 критериев эталонного уровня (AuditRepo REPORT §S8): визуал по референсам,
полнота с честным счётчиком, навигация ≤2 действий до персоны, богословская
честность, перф-бюджеты, a11y, издательский слой, валидаторы данных в CI.

## 5. Анти-паттерны, которые уже сработали в проекте (не повторять)

A2 engine-as-afterthought (движок до флагмана), A4 feature creep до фундамента,
A5 inline CSS-in-JS (v1-остров весь такой), A9 schema-not-data-driven,
force-layout полного графа (урок bible-family-tree: «клубок» вместо связной генеалогии).

## 6. Открытые вопросы → владельцу

См. AuditRepo REPORT §S10 (6 решений). Владелец 2026-07-11 дал команду «начинай» —
рабочие дефолты по §S10 приняты (AuditRepo proposal-OWNER-decisions-working-defaults);
каждый переопределяем, до Phase 3 цена смены низкая.

## 7. Прогресс реализации (живой, 2026-07-11)

- **Стратегия** (main): этот док + `GENEALOGY-ENGINE-CONTRACT-2026-07-11.md` (Phase 2,
  дизайн-до-кода). Полный аудит + 89 источников — AuditRepo intake.
- **Phase 1 «Фундамент данных»** (ветка `claude/biblical-genealogy-svg-6l6qb8`,
  статус draft — в рантайм НЕ подключено):
  - `scripts/genealogy-build/` — пайплайн TIPNR→v2 (чистый Node 22, 0 npm-deps,
    16 самопроверок): парсер, ru-имена, кластеры, народы, хребет, валидаторы.
  - `data/genealogy/v2/` — 3056 персон (100% с ru-именем; override 29, seed 138,
    structural 13, остальное авто с review-очередью), 2053 ребра, 14 кластеров генеалогии, 76 народов, золотой хребет **Христос→Адам связан (76 узлов, все якоря)**.
  - Инварианты чисты: 0 циклов / 0 дублей / 0 битых рёбер; валидатор коллизий
    мэппинга поймал 2 реальных бага (патриарх Иаков, цепь Луки).
- **Осталось в Phase 1** (AuditRepo task): review-очередь имён (выборочная редактура),
  BradyStephenson 3-й свидетель рёбер (провенанс explicit/inferred), 69 нерезолвнутых
  ссылок, версификационная таблица.
- **Дальше:** Phase 2 прототип морфинга (4 вопроса контракта §12) → Phase 3 рендер.
