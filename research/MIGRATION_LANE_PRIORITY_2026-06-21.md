# Migration Lane Priority — Verified 2026-06-21

**Дата:** 2026-06-21  
**Основа:** локальная route taxonomy + внешняя верификация практик Astro / Playwright / CSS layers / strangler migration  
**Входные данные:** `scripts/route-shadow-taxonomy.js`, `research/PRODUCTION_ROUTE_TAXONOMY_2026-06-21.md`

---

## 1. Зачем нужен split-lane roadmap

После повторной верификации production routes выяснилось, что проект нельзя планировать как один «51-route shadow backlog».

Фактическая структура:
- **33** pure full-body shadow routes
- **18** componentized/hybrid shadow routes
- **0** true native production routes

Это автоматически делит работу на **3 разных типа миграции**:

1. **Shell-first lane**  
   Для hybrid routes, где уже существуют extraction seams (`_legacy/*.html`, `*Main.astro`, split segments).

2. **Content/layout-first lane**  
   Для pure routes, где уже есть MDX и orphaned layout layer, но production всё ещё выводит legacy `bodyHtml`.

3. **Parallel-run / high-risk lane**  
   Для карт, genealogy и special-app routes, где одного page swap недостаточно и нужен rollback-first / dual-path подход.

---

## 2. Локальные критерии ранжирования

Маршруты ранжировались по 5 репозиторно-проверяемым признакам:

1. **Route class** — hybrid routes идут раньше pure routes
2. **Legacy HTML size** — чем меньше legacy body, тем дешевле visual-proof migration
3. **Есть ли MDX/live layout target** — критично для pure article routes
4. **Interactive blast radius** — maps/genealogy/special apps идут позже
5. **Owner-risk / business criticality** — главная и большие premium pages не должны быть первыми breakout-кандидатами

---

## 3. Lane A — Shell-first priority (18 hybrid routes)

## 3.1 Page-segment hybrid routes (9)

| Priority | Route | Legacy HTML | Почему |
|---|---|---:|---|
| 1 | `/about/` | 37.8 KB | Уже есть semantic split (`AboutArticle`, `AboutAccuracyBlock`), низкая интерактивность, лучший shell-first pilot |
| 2 | `/karty/` | 14.6 KB | Самый маленький hybrid hub; можно быстро доказать замену raw-fragments на true Astro shell |
| 3 | `/konfessii/` | 23.6 KB | Небольшой hub, низкая интерактивность, отдельный тематический мир без special-app тяжести |
| 4 | `/hard-texts/` | 30.0 KB | Низкий runtime risk, компактный контентный hub |
| 5 | `/pastor-series/` | 35.7 KB | Похоже на `hard-texts`, удобный для repeatable shell recipe |
| 6 | `/articles/` | 38.1 KB | Каталог, важен для pagefind/SEO, но проще home/GBS2 |
| 7 | `/baptisty-rossii/` | 25.9 KB | Небольшой body, но GBS2 chrome повышает риск |
| 8 | `/biografii/` | 50.9 KB | Крупнее и тяжелее по body size |
| 9 | `/` | 72.1 KB | Главная — high business blast radius; её нельзя брать первой |

### Вывод по page-segment lane

**Правильный первый shell pilot = `/about/`, а не `/` и не `/baptisty-rossii/`.**

После `/about/` лучше идти через:
`/karty/` → `/konfessii/` → `/hard-texts/` → `/pastor-series/` → `/articles/` → `/baptisty-rossii/` → `/biografii/` → `/`

Такой порядок минимизирует риск и постепенно наращивает сложность chrome.

---

## 3.2 Delegated hybrid family — Nagornaya (9)

| Priority | Route | Legacy HTML | Почему |
|---|---|---:|---|
| 1 | `/nagornaya/seriya/` | 34.0 KB | Самый компактный представитель семейства |
| 2 | `/nagornaya/` | 45.5 KB | Landing-level proof после `seriya` |
| 3 | `/nagornaya/nakhodki/` | 60.8 KB | Средняя сложность |
| 4 | `/nagornaya/istochniki/` | 87.4 KB | Уже ощутимо тяжелее |
| 5 | `/nagornaya/chast-2/` | 109.5 KB | Первая из «больших частей» |
| 6 | `/nagornaya/chast-3/` | 116.3 KB | Похожа по профилю на `chast-2` |
| 7 | `/nagornaya/chast-1/` | 130.8 KB | Тяжелее, чем `chast-2/3` |
| 8 | `/nagornaya/chast-5/` | 145.5 KB | Крупный body |
| 9 | `/nagornaya/chast-4/` | 157.4 KB | Самый тяжёлый route семейства |

### Вывод по Nagornaya lane

Nagornaya нельзя мигрировать page-by-page без предварительного распила `NagornayaPageMain.astro`.

Поэтому реальный порядок такой:
1. распилить `NagornayaPageMain` на subcomponents,
2. доказать shell на `seriya` или landing,
3. только потом двигать chapters.

---

## 4. Lane B — Content/layout-first priority (20 MDX-backed pure routes)

## 4.1 Лучшие первые breakout-candidates

| Priority | Route | Legacy HTML | Why first |
|---|---|---:|---|
| 1 | `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` | 66.6 KB | Низкая интерактивность, MDX есть, низкий traffic risk, уже выбранный best pilot |
| 2 | `/baptisty-rossii/dva-sezda-1884/` | 30.7 KB | Очень компактный pure route, хороший series-layout pilot |
| 3 | `/baptisty-rossii/noch-na-kure/` | 33.1 KB | Небольшой и low-risk |
| 4 | `/baptisty-rossii/yuzhnaya-shtunda/` | 33.5 KB | Небольшой и low-risk |
| 5 | `/baptisty-rossii/peterburgskaya-liniya/` | 39.4 KB | Всё ещё компактный |
| 6 | `/baptisty-rossii/vsehib-1944/` | 45.3 KB | Умеренный размер |
| 7 | `/baptisty-rossii/sovetskaya-noch/` | 48.1 KB | Умеренный размер |
| 8 | `/baptisty-rossii/goneniya-i-sovest/` | 49.2 KB | Умеренный размер |
| 9 | `/baptisty-rossii/iniciativnaya-gruppa/` | 50.8 KB | Умеренный размер |
| 10 | `/baptisty-rossii/podpolnaya-pechat/` | 51.5 KB | Умеренный размер |

## 4.2 Второй эшелон: article-layout routes

| Priority bucket | Routes | Почему позже |
|---|---|---|
| Medium | `dzhon-gill-spravochnik`, `dzhon-gill-istoricheskiy-kontekst` | Хорошие кандидаты, но лучше идти после первого article + первого series breakout |
| Medium-high | `dzhon-gill-chast-1/2/3`, `kod-da-vinchi`, `krajne-li-isporcheno-serdce` | Крупнее и содержательно тяжелее |
| Highest-risk among MDX | `20-antisovetov-pastoru`, `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki` | Самые крупные и визуально чувствительные статьи |

### Вывод по content lane

Правильный порядок не должен начинаться с самых длинных статей.

**Оптимальная цепочка доказательства:**
1. `rimlyanam-7`
2. один короткий `baptisty-rossii/*` route
3. ещё 2–3 коротких series routes
4. затем `gill-spravochnik` / `gill-kontekst`
5. только потом большие article bodies

---

## 5. Lane C — Parallel-run / high-risk priority

Эта lane нужна для routes, где одного switch с legacy body на native layout мало.

| Priority | Route/group | Почему нужен parallel-run, а не обычный page breakout |
|---|---|---|
| 1 | `/karty/ishod/` и другие engine maps малого размера | уже data-driven, но всё ещё tied to engine runtime |
| 2 | `/map/` | special map landing / runtime surface |
| 3 | `/rodosloviye/` | React / genealogy / special rendering path |
| 4 | `/konfessii/russkij-baptizm/` | special-app route, не обычная article page |
| 5 | `/karty/avraam/` | самый дорогой и самый защищённый route; последним |

### Практическое правило

Для этой lane нельзя полагаться только на `git revert`.
Нужны:
- feature flag,
- dual-path routing,
- или parallel-run verification.

---

## 6. Recommended 12-step execution order

### Wave 1 — доказать shell-first lane
1. `/about/`
2. `/karty/`
3. `/konfessii/`

### Wave 2 — доказать content/layout-first lane
4. `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`
5. `/baptisty-rossii/dva-sezda-1884/`
6. `/baptisty-rossii/noch-na-kure/`

### Wave 3 — закрепить repeatable recipes
7. `/hard-texts/`
8. `/pastor-series/`
9. `/articles/`

### Wave 4 — тяжёлые семьи
10. `/nagornaya/seriya/` → `/nagornaya/`
11. `/baptisty-rossii/` → `/biografii/` → `/`
12. parallel-run lane (`/karty/*`, `/rodosloviye/`, `/konfessii/russkij-baptizm/`, last = `/karty/avraam/`)

---

## 7. Bottom line

### Самая важная смена мышления

Раньше backlog выглядел так:
- «есть 51 shadow routes, вырываем их из shadow по очереди»

Теперь правильная картина такая:
- **18 hybrid routes** = shell-first lane
- **20 MDX-backed pure routes** = content/layout-first lane
- **special-app pure routes** = parallel-run lane

Именно это должно стать основой следующей итерации Refactoring 6.0.
