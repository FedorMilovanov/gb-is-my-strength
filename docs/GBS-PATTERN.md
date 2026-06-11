# GBS-PATTERN.md — анатомия GBS-страницы (эталон для миграции)

> Перенесено из `_agent-handoff/PATTERN.md` (2026-06-12) при закрытии временной
> папки координации: раскатка GBS завершена, документ сохранён как постоянный
> справочник для будущих миграций (Римлянам 8, новые части pastor-series).
> Числа серии Гилла обновлены после пересчёта читminut (AGENTS-r104).

> Шаблон собран из живых эталонов:
> `articles/dzhon-gill-istoricheskiy-kontekst/index.html` (плоский TOC)
> `articles/dzhon-gill-chast-1-chelovek/index.html` (вложенный TOC H2+H3).
> При миграции НЕ копируй слепо — бери фрагменты отсюда, подставляй
> значения из README.md §4 и сверяйся с эталоном.

Плейсхолдеры: `{N_ROMAN}` (I…V), `{N}` (1…5), `{TITLE}`, `{COVER}`,
`{PART_MIN}`, `{DONE_MIN}`, `{TOTAL_MIN}`=69 (Гилл, после r104), `{PREV_*}/{NEXT_*}`.

---

## Шаг 0. ЧТО УДАЛИТЬ со старой страницы (см. крах прошлого агента)

Удалить целиком (если присутствуют):

1. `<div id="reading-progress"></div>`
2. `<div aria-hidden="true" id="section-label"></div>`
3. Старую кнопку `<button id="themeToggle" class="theme-toggle">…</button>`
   вместе с комментарием «ВНИМАНИЕ: inline style…» над ней
   (тему теперь переключают кнопки рельса/мобильной шапки).
4. `<div class="toc-sidebar" id="tocSidebar">…</div>`
5. Весь legacy bottom-bar: от `<!-- ===== BOTTOM APP BAR ===== -->`
   `<div class="bottom-bar" id="bottomBar">` до закрытия `btocOverlay`
   включительно (`<!-- ===== BOTTOM TOC OVERLAY ===== -->…</div></div>`).
   Комментарий `<!-- btocShareBtn is wired... -->` тоже можно удалить.
6. `<aside data-series-strip="dzhon-gill" class="gb-strip"></aside>`
7. Старый CTA: `<a class="series-next-cta" …>…</span></a>` или
   `<div class="series-next-cta-wrap reveal">…</span></div>`.

ОСТАВИТЬ как есть: `summary-card`, `author-card`, `article-header`
(к нему только добавляется класс `gbs2-head`), quiz, sources,
bookmark-toast, все `<script>` подключения.

## Шаг 1. `<body>`

```html
<body class="gbs-world" data-gbs2-done-min="{DONE_MIN}" data-gbs2-part-min="{PART_MIN}" data-gbs2-total-min="{TOTAL_MIN}">
```

## Шаг 2. Сразу после skip-link — мобильная шапка

```html
<div class="gbs2-mobile-head">
  <img alt="" height="315" src="../../images/{COVER}" width="600"/>
  <div class="gbs2-mobile-title"><span>Джон Гилл (1697–1771)</span><b>{N_ROMAN} · {TITLE}</b></div>
  <div class="gbs2-mobile-actions">
    <!-- кнопки темы и поиска: скопируй 1-в-1 из эталона chast-1 (data-gbs2-theme / data-gbs2-search) -->
  </div>
</div>
```

## Шаг 3. Обёртка мира + рельс

Открыть `<div class="gbs2-world">` ПЕРЕД `<aside class="gbs2-rail">`,
рельс скопировать из эталона chast-1 целиком и поменять только:

- `aria-current="page"` — на ссылку текущей части (href="./");
- проценты в `<b id="gbs2Pct">` — стартовое значение
  `round((DONE_MIN / TOTAL_MIN) * 100)`%, JS пересчитает;
- `<span id="gbs2Meta">Часть {N} из 5</span>`;
- блок `.gbs2-current`: `--gbs2-cover:url(../../images/{COVER})`,
  заголовок = {TITLE};
- статический `<ul class="gbs2-toc" id="gbs2Toc">` можно оставить ПУСТЫМ
  (только `<span class="gbs2-track"><i></i></span>`) — JS построит его из
  H2[id]/H3[id] статьи сам (gbs2BuildToc). В эталонах он пререндерен для
  no-JS — если пререндеришь, бери реальные id заголовков страницы.

Существующий `<div class="page-wrap" id="content">` становится вторым
ребёнком `.gbs2-world` (как в эталоне). НЕ забудь закрыть `</div>`
(gbs2-world) после закрытия page-wrap — упавший агент чуть не потерял
закрывающий div.

## Шаг 4. Hero + заголовок

Перед `<header class="article-header">`:

```html
<figure class="gbs2-hero" data-n="{N_ROMAN}" id="gbs2Hero">
  <img alt="(опиши РЕАЛЬНОЕ изображение — см. AGENTS §9.14)" decoding="async" height="315" src="../../images/{COVER}" width="600"/>
  <figcaption class="gbs2-hero-cap"><i aria-hidden="true"></i>Серия «Джон Гилл» · Часть {N} из 5</figcaption>
</figure>
```

`article-header` получает класс `gbs2-head`, первым ребёнком:
`<span aria-hidden="true" class="gbs2-kinetic">{N_ROMAN}</span>`.

ВАЖНО: hero-img должен быть БЕЗ `loading="lazy"` (это LCP). Если на
странице был preload старого hero — обнови href на {COVER} или удали.

## Шаг 5. Конец статьи (перед `</article>`)

```html
<div aria-hidden="true" class="gbs2-vignette"></div>
<nav aria-label="Соседние части серии" class="gbs2-next">
  <a class="gbs2-next-card" href="../{PREV_SLUG}/">
    <span class="gbs2-next-cover" style="background-image:url('../../images/{PREV_COVER}')"></span>
    <span><span class="gbs2-next-eyebrow">Назад по серии · {N-1} из 5 · ~{PREV_MIN} мин</span>
    <span class="gbs2-next-title">{PREV_TITLE}</span>
    <span class="gbs2-next-desc">{PREV_DESC}</span></span>
  </a>
  <a class="gbs2-next-card" href="../{NEXT_SLUG}/">
    <span class="gbs2-next-cover" style="background-image:url('../../images/{NEXT_COVER}')"></span>
    <span><span class="gbs2-next-eyebrow">Дальше по серии · {N+1} из 5 · ~{NEXT_MIN} мин</span>
    <span class="gbs2-next-title">{NEXT_TITLE}</span>
    <span class="gbs2-next-desc">{NEXT_DESC}</span></span>
  </a>
</nav>
<section aria-label="Карта серии по эпохам" class="gbs2-timeline">
  <!-- скопируй из эталона chast-1 без изменений (5 эпох 1697→1771) -->
</section>
```

У первой части серии нет «Назад» (одна карточка, как в kontekst),
у последней — нет «Дальше».

## Шаг 6. После page-wrap (внутри body, в самом низу)

Мобильная капсула + шторка: скопируй из эталона chast-1 блок
`<button class="gbs2-bbar" id="gbs2Bbar">…` + `<div class="gbs2-sheet" id="gbs2Sheet">…`,
поменяй `aria-current="page"` на текущую часть в списке `.gbs2-sheet-part`.

## Шаг 7. Прогон

Полный чеклист README.md §5. Потом отдельный коммит
`feat(gbs): migrate <slug> to series world`.

---

## Известные грабли

1. **Smooth scroll в Playwright**: `scrollTo(bottom)` со smooth даёт
   «пустые» скриншоты. Перед скроллом ставь
   `document.documentElement.style.scrollBehavior='auto'`.
2. **CSP-ошибки favicon на localhost** — норма (абсолютные URL на прод),
   на проде их нет. Не «чинить».
3. **cache-bust меняет ?v= на всех страницах**, включая Нагорную — это
   ожидаемо и не является «трогать Нагорную».
4. **audit-pro G101 (orphan images)**: если меняешь обложку — проверь, что
   старая где-то ещё используется, иначе guard упадёт.
5. **Минифицированный site.css**: gbs2-стили лежат одной строкой
   (~369–373). Правки только точечные, не переформатируй файл —
   история уже знает катастрофу с «balance braces» (AGENTS-r71).
