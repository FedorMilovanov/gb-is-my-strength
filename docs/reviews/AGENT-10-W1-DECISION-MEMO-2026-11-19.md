# №10 — W1 no-JS Back DECISION MEMO (bounded wave, final)

**Кому:** техлид №1 (#2340), дизайн-лид №8 (через #2338) · **От:** агент №10 (PR #2348, docs-only)
**Дата:** 2026-11-19 · **База:** exact `36e69c4d822f752d4f99914a55a6de798f7164e3`, production-like build на Node 22.23.4, Chromium 153, JS OFF
**Статус результата:** root cause закрыт контрольными сериями; строгий ≤1px gate при текущем дизайне = **FAIL → нужно решение owner** (не тихая замена теста)

## 1. Root cause (доказано повторениями)

При back-navigation на URL с `#fragment` Chromium сначала **точно** восстанавливает позицию (~60–70 мс, замерено CDP), а затем **повторно применяет fragment-scroll к началу секции**, если в момент DCL/load завершаются font-subresources.

**Триггер на реальной странице — `<link rel="preload" as="font">`:** любой ОДИН font-preload (даже нигде не используемый, toy-доказательство) детерминированно перезапускает deferred fragment-scroll. Style-preload (`as="style"`) НЕ триггерит. `scroll-behavior:smooth` (legacy `css/site.css:2`) — не причина, а **усилитель**: превращает мгновенный скачок в 1.9-секундный animated-захват (на простых toy-страницах smooth самодостаточен — отдельное проявление того же механизма).

**Исключено контрольными сериями (каждая N≥4):** resource-ablation из первого отчёта (images/fonts PASS) — **экспериментальный шум** (при N=10 fragment-wins 10/10 во всех условиях); tabindex фрагмент-цели; sub-ids заголовков; images; `overflow-x:clip`; containment (гигантская секция-обёртка); offsetTop фрагмента; scroll-padding; оба Astro CSS-бандла; inline-стили; хвост страницы (series+footer); viewport extras; вес промежуточной страницы (toyH PASS, toyI FAIL — триггер в entry-page).

## 2. Инженерная развилка — квантифицирована

Font-preloads — это несущая часть CLS-ремонта №8. Конфликт абсолютен в текущем дизайне:

| Конфигурация `/articles/` | no-JS Back drift (390/1440) | Cold CLS, JS on, throttled (N=5, median) |
|---|---|---|
| Оригинал (7 preloads, smooth on) | −23264 (10/10 FAIL) | **0** |
| Без preloads, smooth on (V22) | **0 (13/13 PASS)** | 0.0765 (RED) |
| Без preloads, smooth off (V23) | **0 (PASS)** | 0.0852 (RED) |
| Только style-preload (P1) | **0 (4/4 PASS)** | 0.0852 (RED) |
| Только nav600 font-preload (P3) | −23264 (4/4 FAIL) | 0.0664 (RED) |

Безопасного подмножества preloads нет: любой font-preload ломает Back; CLS=0 требует полного набора.

## 3. Две опции (owner decision)

**Опция A — «Заморозить W1 сейчас» (рекомендую):** preloads оставить (CLS=0 не трогаем); убрать/загейтить global smooth (`css/site.css:2` — legacy shared → SYSTEM/owner lane; вариант: применять smooth только при `html.js`). Тогда no-JS остаток = **мгновенный** детерминированный возврат к началу секции каталога (969@390 / 712@1440 — ровно та секция, откуда пользователь вошёл), без 1.9-секундной анимации. Задокументировать как browser-native поведение для no-JS fragment-URL history entries; JS-on не затронут (Product JS выигрывает гонку — PASS). По строгому ≤1px gate: **FAIL → подпись owner о принятии bounded residual**.

**Опция B — «Оба зелёныхых, отдельной линией»:** заменить font-preloads на metric-matched fallbacks (`size-adjust`/`ascent-override`/`descent-override`/`line-gap-override` в `@font-face` для Lora/SourceSans3/PlayfairDisplay) → CLS≈0 без единого font-preload → Back PASS (доказано на V22/V23). Реализация — домен №8 + полная CLS/browser ревалидация; риск кросс-браузерных метрик. Дополнительный плюс: smooth можно оставить (V22 PASS со smooth).

**Рекомендация:** A для freeze W1; B как follow-up lane №8, если owner хочет strict ≤1px без acceptance.

## 4. Условная инструкция для №1 (transfer, БЕЗ исполнения мной)

Canonical #2338 HEAD `b2ae614730b0c2e164d3b07453797074253d9698`; compare `b2ae614...36e69c4d` = ancestor, ahead 23 / behind 0 → технический fast-forward доступен (47 файлов, restricted surfaces не затронуты; `data/scripture-search-index.json` — derived-счётчик, регенерировать пост-перенос). Порядок при наличии owner mandate + lease: verify canonical HEAD всё ещё `b2ae614` (иначе ancestry пересчитать заново) → FF до выбранного SHA → build на Node 22.23.4 (`npm i --prefix /tmp/node22 node-linux-x64@22.23.4`) → contracts/CI → no-HOLD check (G3 history 9 claims remain PUBLICATION_HOLD) → real-browser smoke на pushed SHA. Writer-роль — только отдельным мандатом owner, не этим memo.

## 5. Воспроизводимость (новый уникальный control)

Минимальное доказательство триггера без продуктового кода — **toyQ+preloads-only**: каркас-страница (секция `#tgt` + 30 строк-заполнителей + ссылка), 6 font-preload тегов, НОЛЬ продуктового CSS/JS → FAIL 5/5; та же страница без preloads → PASS 5/5.

```bash
# runner: playwright + @sparticuz/chromium (см. owner-инструкцию браузера в sandbox)
# сценарий: goto page#tgt → scrollIntoView последней ссылки → click → goBack →
# poll scrollY по CDP Page.getLayoutMetrics каждые 25 мс (3 с) → drift = final − deepY
```

JSON-результаты ключевых серий:

```json
{
  "toyQ_preloads_only": {"drifts": [-30427,-30427,-30427,-30427,-30427], "verdict": "FAIL"},
  "toyQ_no_preloads":    {"drifts": [0,0,0,0,0], "verdict": "PASS"},
  "real_V22_nopre_smoothON":  {"390": [0,0,0,0,0], "1440": [0,0,0,0], "cls_median": 0.0765},
  "real_V23_nopre_smoothOFF": {"390": [0,0,0,0,0], "1440": [0,0,0,0], "cls_median": 0.0852},
  "real_original":            {"390_drift": "-23264 x10/10", "1440": "712 landing (№1 match)", "cls_median": 0}
}
```

## 6. Честные ограничения волны

Firefox/WebKit недоступны в sandbox (как и у №4). Синтетический Alt+ArrowLeft в headless не доходит до browser-UI (остался на промежуточной странице) — физическая клавиатура не верифицирована; навигационная machinery покрыта goBack. Истинный 200% browser-zoom в headless недоступен (layout идентичен при равной CSS-ширине). Платформенное воспроизведение — Chromium 153; семейство багов известное (history restore vs fragment), но я НЕ заявляю cross-browser охват.

**По окончании: №10 → STOP/ON_CALL** по owner-директиве; новых волн не начинаю.
