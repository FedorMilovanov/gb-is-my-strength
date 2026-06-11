# _agent-handoff — GBS (GB-Series) rollout · временная папка координации агентов

> **Зачем эта папка:** предыдущий агент упал посреди миграции. Чтобы следующий
> агент (ты) не разбирался по крупицам, здесь зафиксированы: статус, план,
> эталон-паттерн и чеклист проверки. Папка ВРЕМЕННАЯ — владелец удалит её,
> когда GBS-раскатка завершится по всем сериям.
>
> **Прочитай СНАЧАЛА `/AGENTS.md` (это договор), потом этот файл.**

| Поле | Значение |
|---|---|
| Обновлено | 2026-06-11 |
| Кто обновил | Arena Agent (session: продолжение после упавшего агента) |
| Текущая фаза | GBS-эталон на серии «Джон Гилл», миграция страниц по одной |
| Прод | https://gospod-bog.ru (GitHub Pages, ветка `main`) |

---

## 1. Что такое GBS

GBS («мир серии») — единый премиальный layout для многочастных серий,
вдохновлённый Нагорной проповедью, но на токенах site.css и без нового
CSS/JS-файла (всё в `css/site.css` секция `gbs2-*` и `js/enhancements.js`,
модули «GBS reference pilot v2»):

- **Десктоп:** тёмный левый рельс 304px (`.gbs2-rail`): шапка серии, кольцо
  прогресса серии (взвешенное по минутам), список частей с обложками,
  карточка «Сейчас читаете» с прогресс-баром части и живым TOC (track-линия,
  точки, активная секция). В подвале рельса: тема, A−/A+, поделиться, поиск, ← Назад.
- **Контент:** hero-фигура 21/9 с параллаксом, кинетическая римская цифра
  справа от заголовка, виньетка ✦, карточки «Назад/Дальше по серии»
  (`.gbs2-next`), горизонтальная «Карта серии» по эпохам (`.gbs2-timeline`).
- **Мобайл (<64em):** рельс скрыт; сверху sticky `.gbs2-mobile-head`
  (обложка + название + тема/поиск), снизу плавающая капсула `.gbs2-bbar`
  (`%` + текущая секция) открывающая шторку `.gbs2-sheet` с двумя
  вкладками: «Части серии» / «Оглавление части».
- Прогресс серии взвешен по минутам: `data-gbs2-done-min` (сумма минут
  предыдущих частей) + прогресс текущей части × `data-gbs2-part-min`,
  делённое на `data-gbs2-total-min`.

## 2. Статус на 2026-06-11 (после коммита dc8d8de7)

| Страница | Состояние |
|---|---|
| `articles/dzhon-gill-istoricheskiy-kontekst/` | ✅ GBS-эталон (визуально согласован владельцем), legacy-CTA удалён |
| `articles/dzhon-gill-chast-1-chelovek/` | ✅ GBS + вложенный TOC (H2+H3). Хвосты упавшего агента вычищены (dc8d8de7) |
| `articles/dzhon-gill-chast-2-uchenyi/` | ⏳ СЛЕДУЮЩАЯ: ещё старый вид (gb-strip + legacy bottom-bar) |
| `articles/dzhon-gill-chast-3-nasledie/` | ⏳ старый вид |
| `articles/dzhon-gill-spravochnik/` | ⏳ старый вид |
| Нагорная проповедь | ❄️ НЕ ТРОГАТЬ функционально (AGENTS-r95). Только cache-bust хэши |
| hard-texts / pastor-series | 🔮 после полного согласования Гилла |

### Где упал предыдущий агент (исправлено, но знай суть)
Он мигрировал `chast-1-chelovek`, но не удалил legacy-блоки:
`#reading-progress`, `#section-label`, старый `#themeToggle`, `#tocSidebar`,
`#bottomBar`, `#btocOverlay` и старый `.series-next-cta`. Это давало ВТОРУЮ
полосу прогресса поверх GBS и дубль карточки следующей части.
**Урок: миграция страницы = вставка GBS-блоков И удаление legacy-блоков, атомарно.**

## 3. План (выполнять по одной странице, после каждой — полный чек)

1. ✅ Вычистить хвосты упавшего агента (сделано, dc8d8de7).
2. ⏳ Мигрировать `dzhon-gill-chast-2-uchenyi` по PATTERN.md.
3. ⏳ Мигрировать `dzhon-gill-chast-3-nasledie`.
4. ⏳ Мигрировать `dzhon-gill-spravochnik`.
5. ⏳ Сквозной Playwright-проход всех 5 страниц серии (desktop+mobile,
   light+dark), сверка скриншотов глазами.
6. ⏳ Обновить AGENTS.md changelog (новая строка r9N) + этот файл.
7. 🔮 Обсудить с владельцем перенос паттерна на hard-texts (3 части)
   и будущие серии. НЕ масштабировать без его «да».

## 4. Числа серии «Джон Гилл» (для data-атрибутов)

total = 89 мин. Порядок и done-min (сумма минут предыдущих):

| # | slug | title | part-min | done-min |
|---|---|---|---|---|
| I | dzhon-gill-istoricheskiy-kontekst | Исторический контекст | 16 | 0 |
| II | dzhon-gill-chast-1-chelovek | Часть I. Человек | 28 | 16 |
| III | dzhon-gill-chast-2-uchenyi | Часть II. Учёный | 12 | 44 |
| IV | dzhon-gill-chast-3-nasledie | Часть III. Наследие | 22 | 56 |
| V | dzhon-gill-spravochnik | Справочник по Гиллу | 11 | 78 |

Обложки (rail-thumb и sheet, все существуют в /images/):
- I: `og-dzhon-gill-istoricheskiy-kontekst-600w.webp`
- II: `gill-authentic-study-cover-600w.webp`
- III: `og-dzhon-gill-chast-2-uchenyi-600w.webp`
- IV: `og-dzhon-gill-chast-3-nasledie-600w.webp`
- V: `gill-five-volumes-shelf-600w.webp`

## 5. Чеклист проверки КАЖДОЙ мигрированной страницы (обязателен до push)

```bash
npm run cache-bust            # если менялись CSS/JS
npm run validate:all          # 0 errors
node scripts/audit-pro.js     # 0 errors (warnings допустимы только старые)
```

Playwright (локальный сервер `python3 -m http.server 8080`):
- [ ] desktop 1440: рельс на месте, кольцо %, активная часть подсвечена,
      TOC следит за скроллом, нет ДВУХ полос прогресса
- [ ] desktop низ: gbs2-next карточки (1-2 шт), timeline, НЕТ старого
      `.series-next-cta`
- [ ] mobile 390: sticky-шапка сверху, капсула `%·секция` снизу, шторка
      открывается, вкладки переключаются
- [ ] `document.querySelectorAll('.series-next-cta').length === 0`
- [ ] `!document.getElementById('reading-progress') && !document.getElementById('bottomBar')`
- [ ] 0 pageerror в консоли (CSP-warnings про favicon на localhost — норма)
- [ ] тёмная тема: переключить кнопкой в рельсе, проверить контраст

## 6. Жёсткие правила (из AGENTS.md, нарушение = регресс)

- ❌ НЕ создавать новые CSS/JS файлы. GBS живёт в `css/site.css` + `js/enhancements.js`.
- ❌ НЕ трогать Нагорную функционально.
- ❌ НЕ менять byline («Автор-редактор:»).
- ❌ НЕ удалять `<header class="article-header">` / `<aside class="author-card">` —
  GBS добавляет классы рядом, но контракт-блоки остаются.
- ✅ После правки CSS/JS — `npm run cache-bust` (он обновит `?v=` на ВСЕХ
  страницах, включая Нагорную — это ок и ожидаемо).
- ✅ Каждая страница — отдельный коммит с внятным сообщением `feat(gbs): ...`.
- ✅ Перед push — полный чеклист §5. Упавший до тебя агент пушил без него.

## 7. Файлы-эталоны

- **PATTERN.md** (рядом) — анатомия GBS-страницы: какие блоки, в каком
  порядке, что удалять, шаблоны фрагментов с плейсхолдерами.
- Живой эталон №1 (плоский TOC): `articles/dzhon-gill-istoricheskiy-kontekst/index.html`
- Живой эталон №2 (вложенный TOC H2+H3, длинная статья): `articles/dzhon-gill-chast-1-chelovek/index.html`
- CSS: `css/site.css`, ищи `body.gbs-world` (строки ~369–373, минифицировано).
- JS: `js/enhancements.js`, три IIFE с комментарием «GBS reference pilot v2».

## 8. Если ты упал и тебя перезапустили

1. `git log --oneline -10` — что успело закоммититься.
2. `git status` — есть ли незакоммиченный мусор; недоделанную страницу легче
   откатить `git checkout -- <file>` и сделать заново по PATTERN.md, чем чинить.
3. Прогони чеклист §5 на последней тронутой странице.
4. Обнови таблицу статуса §2 и закоммить этот файл.
