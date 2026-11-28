# №10 — W1 Option B FEASIBILITY: metric-matched font fallback — NO_GO (измерено)

**Кому:** техлид №1 (#2340), дизайн-лид №8 (через #2338) · **От:** агент №10 (PR #2348, docs-only)
**Дата:** 2026-11-19 · **База:** exact №8 `8168e46efef6e212729da1f4cf8be57ba650f45a` (production-like build, Node 22.23.4, Chromium 153) · canonical #2338 без изменений `b2ae614730b0c2e164d3b07453797074253d9698`
**Вердикт по критерию owner** (C2 держит CLS≈C0 **и** Back не хуже C1 одновременно): **NO_GO** — с измеренными причинами и границей достижимого.

## 1. Варианты (scratch dist, ничего не пушилось)

| | Состав |
|---|---|
| **C0** | exact исходник: 6 font-preloads + 1 style-preload, `font-display:swap`, smooth on |
| **C1** | C0 минус все preloads |
| **C2** | C1 + metric-matched fallback faces (`Lora-fb`/`SS3-fb`/`PF-fb`: `size-adjust` 96.02/90.54/97.12%, `ascent/descent-override` по метрикам woff2 через fontTools; стеки переписаны в scratch-копиях site.css/JournalEditorialShell) |
| **C3** | C2 + `font-display:optional` (scratch-копия fonts.css) |
| **C4/C5** | C3 + smooth off (C5 = с уточнёнными override без деления на size-adjust) |
| **C6** | C2 + только style-preload (Back-безопасен, доказано P1) |

## 2. CLS, throttled cold (1.6Mbps/150ms/4×CPU), JS on, N=3, median

| Вариант | 320 | 390 | 1440 | Тёмная тема |
|---|---|---|---|---|
| C0 | **0** | **0** | **0** | 0 (parity) |
| C1 | 0.160 | 0.090 | 0.043 | = light |
| C2 | 0.096 | 0.031 | 0.042 | = light |
| C3 | **0** | **0** | **0** | — |
| C4/C5 | **0** | **0** | **0** | — |
| C6 | 0.096 | 0.032 | 0.042 | — |

## 3. no-JS Back (`#catalog-materials` → последняя карточка → native Back), drift px, N≥4

| Вариант | 390 | 1440 | Итог |
|---|---|---|---|
| C0 | −21724 ×5 | −10262 ×3 | **FAIL детерминированный** |
| C1 | 0 ×5 | 0 ×3 | **PASS** |
| C2 | 0 ×5 | 0 ×3 | **PASS 8/8** |
| C3 | 0,0,0,**−1728**,0 ×8+3 | 0,**−664**,0 | частичные остатки ~6–19% прогонов |
| C4 (smooth off) | **−1728 ×8 детерминированно** | −664 ×3, 0 ×1 | FAIL (scroll-anchoring на reflow) |
| C5 (fixed metrics) | −1728 ×8 | 0,−663,0,−420 | FAIL (override-правка не влияет на offset) |
| C6 | 0 ×5 | — | PASS |

## 4. Измеренные причины NO_GO

1. **C2 не удерживает CLS≈C0:** 0.031–0.096 против gate ≤0.01. Fallback (в sandbox: DejaVu-резолв Georgia/Arial) совпадает по вертикальным метрикам, но расходится по ширине глифов → переносы строк → накопленный drift на длинной странице. Это принципиальный предел metric-matching на реальных кириллических fallback-шрифтах, а не недожим конкретных цифр (C5 с уточнёнными override offset не сдвинул).
2. **C3 удерживает CLS=0, но переносит проблему в Back:** с `optional` шрифт на restored-странице применяется из кэша пост-фактум → reflow → scroll-anchoring смещение (−1728@390, −664@1440). Со smooth on это проявляется редко (2–3/16), со smooth off — детерминированно. Strict ≤1px недостижим.
3. **Пересечения нет:** единственный путь к Back=exact без preloads — swap-рендер (C2/C6), а он не даёт CLS≤0.01; единственный путь к CLS=0 без preloads — `optional`, а он ломает exact Back.

## 5. Дополнительные измеренные факты (вход для №1/№8)

- **`prefers-reduced-motion` НЕ спасает C0:** smooth уже за media-query, Back при reduced-motion всё равно −21724 (мгновенно). Значит гейтить smooth за reduced-motion как «фикс» нельзя — только как harm-reduction анимации.
- **Keyboard Tab→link→Enter→Back на C2:** чистый прогон drift +2px, focus до = `A.articles-entry`, после = `SECTION#catalog-materials` (фокус на секции при exact-позиции scroll). 2/3 повтора ушли в harness-гонку Enter/goBack — фиксирую как flake харнесса, не продукта.
- **Warm-context C2:** exact 0/0.
- **/karty/avraam/ CLS:** 0 в C0/C1/C2 — его font-preload можно снимать без CLS-платы (у него ещё есть `rel="preload" as="fetch"` route.json — отдельная история).
- **Journal @360 C0: CLS 0.0119** — маленький pre-existing сдвиг kicker-зоны чуть выше 0.01 **уже в текущем состоянии**, не вызван моими вариантами. Отдельная заметка, не подмена Articles-результата.
- Типографика в устоявшемся состоянии C0=C2=C3: абзац 350×108px, line-height 27px, реальные Lora/Source Sans 3 загружены везде; разница fallback-ов только в loading window.

## 6. Рекомендация (не решение)

Остаётся в силе **Опция A из первого memo** для freeze W1: preloads не трогаем (CLS=0), smooth гейтим (`html.js` или route-scope; `css/site.css:2` — shared legacy → SYSTEM lane), no-JS остаток = мгновенный return-to-section-start (969@390/712@1440) с подписью owner как browser-native residual. Option B переоткрывать только как отдельную типографическую линию №8 с бюджетом на per-weight/per-width fallback метрики и реальные Georgia/Arial-таблицы.

## 7. Честные ограничения

Fallback-метрики вычислены против sandbox-резолва (Georgia→DejaVu Serif, Arial→DejaVu Sans); production-значения для Georgia/Arial будут другими — но на вердикт NO_GO это не влияет: предел задаётся расхождением ширин глифов, а не конкретными числами. Firefox/WebKit недоступны; истинный 200% zoom и физическая клавиатура не верифицируемы в headless (покрыто goBack machinery + Tab-фокус трейсингом).

**№10 → STOP/ON_CALL.**
