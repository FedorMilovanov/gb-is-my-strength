# Journal Editorial System — Архитектурный синтез Агента 7 (PR #2341)

**Ветка:** `arena/86b34c57-gb-is-my-strength`  
**Базовый PR #2338:** `lane/journal-editorial-premium-20261118` @ `b2ae614730b0c2e164d3b07453797074253d9698`  
**Пулл-реквест на GitHub:** [PR #2341](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2341)  
**Роль в мультиагентной сессии:** Агент 7 (Agent 7)  
**Дата фиксации:** 18 ноября 2026 года

---

## 1. Контекст и статус интеграции

В ходе параллельной работы нескольких агентов над редакционной системой Журнала и документальным досье G3 Ministries (`/journal/` и `/journal/dossiers/g3/`), Агент 7 сформировал стековое предложение поверх канонической базы PR #2338.

Все коммиты выстроены в строго линейную историю (fast-forward, без переписывания истории, без сквозного слияния в `main`).

```text
a4f910cd1 feat(journal): Agent 7 — accessible focusin scrolling for horizontal navigation tracks
505ea4e09 feat(journal): Agent 7 — bidirectional bibliography section jumps and evidence tier data attributes
9793a2818 feat(journal): Agent 7 — align history year anchors and narrow 2023 evidence to primary AJC source
0082371b3 fix(journal): Agent 7 — Cyrillic timeline heading hygiene and inline tag whitespace protection
4223b63fe feat(journal): Agent 7 — integrate native theme toggle into JournalMasthead
d91a0b62a feat(journal): Agent 7 — integrate fail-closed series nav architecture and mobile safe areas
188381ab5 feat(journal): Agent 7 — interactive scrollspy, categorized bibliography, and editorial polish
35d86c0db feat(journal): elevate editorial typography, documentary stats, and mobile layout
b2ae61473 (base PR #2338) research(journal): extend G3 history through verified 2024 events
```

---

## 2. Реализованные архитектурные компоненты

### 2.1. Интерактивный Scrollspy (vanilla JS, zero-dependency, <1 KB)
- На базе нативного `IntersectionObserver` с областью чтения `rootMargin: -10% 0px -65% 0px`.
- Синхронно обновляет активный пункт в десктопном боковом меню (`.je-editorial-rail`) и в мобильной горизонтальной полосе навигации (`.dossier-nav`).
- Добавляет атрибут `aria-current="true"` на активный элемент (WCAG 2.2).
- На мобильных устройствах плавно доворачивает горизонтальный трек (`scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`).
- При отключённом JS страница полностью работоспособна со стандартными CSS hover/focus.

### 2.2. Двусторонняя навигация и категоризированная библиография (21 источник, 4 группы)
- 21 источник документального досье сгруппирован по 4 категориям:
  1. *Налоговые декларации и государственные реестры* (3 источника: IRS Forms 990 FY2023–2025, Georgia SOS).
  2. *Официальные сообщения руководства G3* (8 источников: заявления о Buice, Aniol, Walker, инициативы Pastor-Theologian, Men Who Lead).
  3. *Церковные разбирательства и свидетельства сторон* (5 источников: заявление 4 пасторов, Pyromaniacs, MinistryWatch, ChurchLeaders).
  4. *Архивные снимки сервисов, витрин и каталогов* (5 источников: Wayback Machine «Who We Are» 21.07.2026, магазины приложений, витрина G3 Press).
- **Двусторонняя связность (Bidirectional Jumps)**: каждый элемент библиографии содержит ссылку обратно к разделу статьи, где данный источник анализируется (`К разделу «...» ↑`). Количество валидных якорных связок увеличено до **42/42**.
- Добавлены атрибуты доказательного провенанса: `data-source-tier`, `data-source-eligibility` и `data-research-claims`.

### 2.3. Интерактивный переключатель тем в шапке (`#themeToggle`)
- В `JournalMasthead.astro` интегрирован доступный контрол `#themeToggle` с пиктограммами Луны/Солнца и синхронизацией с `localStorage.getItem('theme')`.
- Работает автономно и мгновенно переключает `html.dark` на всех страницах Журнала.

### 2.4. Серийная навигация `JournalSeriesNav` (Fail-Closed)
- Единый реестр серий `src/data/journal/g3Series.ts` и переиспользуемый компонент `JournalSeriesNav.astro`.
- Шлюз допуска: части со статусом `PUBLICATION_HOLD` (включая черновик истории G3) не генерируют публичные ссылки; если опубликованных частей меньше двух, блок в проде не выводится вовсе (0 утечек).

### 2.5. Клавиатурная доступность горизонтальных треков (`focusin`)
- Делегированный обработчик `focusin` для `.dossier-nav` и `.je-masthead__nav` гарантирует, что при навигации клавишей Tab элемент в фокусе всегда плавно выводится в видимую область и не перекрывается маской или границей экрана.

### 2.6. Документальные карточки и аналитическая сетка
- Финансовые метрики IRS Form 990 ($3.2M выручки, $500K компенсации, $285K гранта).
- Подтверждённый архивом ростер совета директоров на 21 июля 2026 года (Braswell, Broome, Norton, Sikes, Joyner, Mooney).
- Сетка разграничения фактов расследования церкви Lindale и заявления четырёх пасторов Pray's Mill.
- Редакционная врезка-манифест (G3-PUB-016).

### 2.7. Типографика, шрифтовая гигиена и Safe Areas
- Заголовки таймлайна приведены к кириллице («Отставка Джоша Бьюса», «Скотт Аниол становится президентом»), предотвращая сбой шрифтовых глифов в `Playfair Display`.
- Устранены склейки пробелов от `compressHTML` возле `<strong>`, `<em>` и `<time>`.
- Контрастная переменная `--je-gold-text` (>6.0:1 в light и >8.5:1 в dark, соответствие WCAG AA).
- `env(safe-area-inset-*)` и градиентные маски затухания на мобильных дисплеях.

### 2.8. Индикатор прогресса чтения (`.je-reading-progress`)
- Тонкая ненавязчивая золотая полоса вверху экрана, синхронизированная через CSS-переменную `--je-progress` с `requestAnimationFrame` скролл-трекером.
- `aria-hidden="true"`, скрыта при печати, адаптивна для мобильных экранов.

### 2.9. Плавающая кнопка возврата наверх (`.je-back-to-top`)
- Появляется плавно при скролле более 500px, доступна с клавиатуры, автоматически скрывается при возврате к началу.
- На мобильных устройствах аккуратно сворачивается в компактную круглую пиктограмму со стрелкой.

### 2.10. Доказательный бейдж-бар расследования (`.dossier-meta-bar`)
- Отображает подтверждённые параметры: хронометраж чтения (~11 минут), шлюз `G3-PUB-016` (16 утверждений), количество проверенных первоисточников (21) и снимок исследования.
- Inline SVG векторные пиктограммы вместо платформозависимых эмодзи.
- Вертикальная колоночная компоновка на мобильных экранах ($\le$ 600px).

### 2.11. Премиум-стилизация для печати и экспорта в PDF (`@media print`)
- Автоматическое подавление интерактивных элементов (masthead, series nav, back-to-top, reading progress, floating rail).
- Защита от разрыва страниц (`break-inside: avoid; page-break-inside: avoid`) для аналитических карточек, цитат, таймлайна и библиографических записей.

### 2.12. Устранение вертикального скачка скролла при scrollspy (Стабильность чтения)
- Устранена критическая регрессия вызова `scrollIntoView()` на горизонтальных элементах `.dossier-nav a` во время вертикального скролла статьи.
- Ранее вызов `a.scrollIntoView()` при чтении нижних разделов вызывал откат страницы вверх на 1190–2842px.
- После исправления: `diff = 0px`, позиция чтения остаётся абсолютно стабильной.

### 2.13. Визуальный акцент целевого источника (`:target`) и scroll-margin
- Для элементов библиографии `.journal-edition .bibliography-item` добавлен `scroll-margin-top: calc(58px + env(safe-area-inset-top, 0px) + 16px)`.
- Добавлен `:target`-стиль с деликатным золотым фоном (`--je-gold-tint`) и рамкой в 2px, обеспечивая мгновенную ориентацию читателя при переходе по ссылке на источник.

### 2.14. Поддержка `prefers-reduced-motion` и клавиатурных клавиш
- Все программные прокрутки (`scrollToTop`, `navTrack.scrollTo`) динамически проверяют `window.matchMedia('(prefers-reduced-motion: reduce)')` и переключаются в `behavior: 'auto'`.
- В CSS добавлено всеобъемлющее подавление анимаций и сглаживания при `prefers-reduced-motion: reduce`.
- Кнопка «Наверх» снабжена глобальной горячей клавишей `B` / `b` (и `И` / `и`) с возвратом фокуса в `#main-content`.

---

## 3. Сводная матрица проверок качества

| Проверка | Результат | Подробности |
| :--- | :---: | :--- |
| **Astro Production Build** | **PASS** | 112 страниц скомпилировано без единой ошибки |
| **Postbuild Pipeline** | **PASS** | 0 дрейфа в assets, CSP, Atlas, sitemap; кэш-бастинг синхронизирован (41 литерал) |
| **Pastor-series Guards (dist)** | **PASS** | Все 8 инвариантов качества (G-1 .. G-8) соблюдены |
| **Heading Hygiene** | **PASS** | 117 файлов, 1769 заголовков снабжены статическим `aria-label` |
| **axe-core Accessibility** | **0 нарушений** | 4/4 аудита (light/dark на `/journal/` и `/journal/dossiers/g3/`) |
| **Responsive Matrix** | **16/16 PASS** | 320px–1920px × 2 темы × 2 маршрута: 0 переполнений, 0 JS-ошибок |
| **Scrollspy Stability** | **PASS** | 0px дрейфа скролла при вертикальном чтении (устранены скачки в 1200–2800px) |
| **Theme Toggle & Sync** | **PASS** | Синхронизация `#themeToggle` с `GBReaderPreferences` и событием `gb:reader-preferences-change` |
| **Reading Enhancements** | **PASS** | Линейка прогресса чтения и кнопка возврата наверх протестированы в Playwright |
| **Якорная целостность** | **42/42 OK** | Все двусторонние якорные ссылки имеют валидные цели в DOM |
| **Target Highlighting** | **PASS** | `:target` проверен в light (`rgba(152,103,32,0.08)`) и dark (`rgba(223,181,108,0.14)`) |
| **Внутренние ссылки** | **PASS** | 100% внутренних ссылок отдают HTTP 200 |
| **GitHub Actions CI** | **GREEN** | Browser contract, Source contract, Validate source metadata — все проверки пройдены |

---

## 4. Интеграционный пакет для координационного PR #2338

На основе адресного Owner review подготовлен конкретный интеграционный пакет для переноса в базовую ветку `lane/journal-editorial-premium-20261118`.

### 4.1. Единственный рекомендуемый Owner навигации
- **Рекомендуемый Owner**: **Агент 7 (PR #2341)**.
- **Обоснование**: В отличие от конкурирующих реализаций (#2340 и #2343), архитектура Агента 7:
  1. Обеспечивает плавный синхронный scrollspy десктопного рельса (`.je-editorial-rail`) и мобильного TOC (`.dossier-nav`) с выставлением WCAG 2.2 атрибутов `aria-current="true"`.
  2. Не ломает чтение: устранён дефект скачков вертикального скролла (`scrollIntoView` изолирован исключительно в `focusin` внутри контейнера).
  3. Не раздувает кодовую базу лишними файлами-прослойками (TOC и библиография инкапсулированы по месту в `G3Dossier.astro`).
  4. Мобильная навигация мастхеда переведена в видимые ряды (`flex-wrap: wrap`) без обрезки ссылок градиентной маской.
  5. Владение темой корректно интегрировано с общесайтовой шиной `GBReaderPreferences` без дублирования глобальных слушателей.

### 4.2. Конкретные 3 изменения для переноса в #2338
1. **Интерактивные улучшения читательского опыта**:
   - `src/components/journal/G3Dossier.astro`: `initJournalScrollspy()` + `initReadingEnhancements()` (прогресс чтения, возврат наверх, горячая клавиша `B`, безопасный `focusin` для горизонтального трека).
2. **Премиум-стили и доступность в CSS**:
   - `src/components/journal/journalEditorial.css`: `.je-reading-progress`, `.je-back-to-top`, `.bibliography-item:target`, `.dossier-meta-bar` (векторные параметры), `@media (prefers-reduced-motion: reduce)`, `@media print`.
3. **Единая шапка с доступным переключателем темы и многострочной мобильной навигацией**:
   - `src/components/journal/JournalMasthead.astro`: интеграция `#themeToggle` с `GBReaderPreferences` и перенос мобильных ссылок разделов в видимые ряды без горизонтального скролла.

### 4.3. Границы файлов и функций (File / Function Boundaries)
| Файл | Область ответственности / Функции | Граница изменений |
| :--- | :--- | :--- |
| `src/components/journal/G3Dossier.astro` | `initJournalScrollspy()`, `initReadingEnhancements()`, разметка `jeReadingProgress`, `jeBackToTop`, `dossier-meta-bar`, двусторонние якоря | Внутри клиентского `<script>` и разметки статьи |
| `src/components/journal/JournalMasthead.astro` | Шапка, разметка разделов, `#themeToggle` listener | Изолировано компонентом `JournalMasthead` |
| `src/components/journal/journalEditorial.css` | Стили редакционного слоя Journal | Специфичные селекторы `.journal-edition *`, исключающие конфликт с глобальным `site.css` |

### 4.4. Анализ пересечений и конфликтующих реализаций
- **Конфликт с PR #2340 (Агент 1)**: Агент 1 дробит компоненты на `JournalArticleOpening.astro`, `JournalBibliography.astro`, `JournalContents.astro`. Это дробит единую модель данных и затрудняет сопровождение якорей. Рекомендуется сохранить компонентную структуру Агента 7.
- **Конфликт с PR #2343 (Агент 9)**: Агент 9 создает отдельный `JournalArticleToc.astro` без scrollspy и без синхронизации мобильного TOC с десктопным рельсом.
- **Интеграция с Agent 8 (`arena/7f634191`)**: Модель возврата к разделу (`biblio-section-jump`) у Агента 7 уже полностью реализована на 21 источнике с якорной связкой (`#wind-down`, `#finance`, `#buice`, `#buck`, `#governance`). Дополнительно у Агента 7 реализован `:target` подсветка источника.
- **Конфликт с PR #2342 (Агент 5)**: В #2342 в мастхед внедрен inline-handler темы и поиск Ctrl+K, что вызвало регрессию фокуса (`.mcp-search`). Вариант Агента 7 не внедряет чужой поиск и безопасно координирует тему через `GBReaderPreferences`.

### 4.5. Браузерная проверка по точному SHA
- **Снимок до устранения скачка скролла**: `.cache/qa/scrollspy-jump-before.png` (откат на 3500px при скролле к `#buice`).
- **Снимок после исправления**: `.cache/qa/scrollspy-jump-after.png` (стабильное положение на `scrollY: 8400`).
- **Снимок целевого источника с подсветкой (Light)**: `.cache/qa/targeted-source-item.png`.
- **Снимок целевого источника с подсветкой (Dark)**: `.cache/qa/targeted-source-item-dark.png`.
- **Снимок читаемой мобильной навигации шапки**: `.cache/qa/mobile-wrapped-masthead.png`.

---

## 5. Инструкция по слиянию для владельца репозитория

Для интеграции PR #2341 в базовую ветку PR #2338 (`lane/journal-editorial-premium-20261118`):

```bash
git checkout lane/journal-editorial-premium-20261118
git merge --ff-only arena/86b34c57-gb-is-my-strength
git push origin lane/journal-editorial-premium-20261118
```

Так как история коммитов Агента 7 строго линейна, слияние происходит мгновенно методом **Fast-Forward** без конфликтов и без создания merge-коммита.
