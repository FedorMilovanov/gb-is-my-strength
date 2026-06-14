# SECURITY_CSP_IMPLEMENTATION_PLAN.md — конкретный план CSP hardening

Дата: 2026-06-12  
Связано с:

- `docs/DEPLOYMENT_SECURITY_ENV_2026.md`
- `docs/ASTRO_IMPLEMENTATION_BLUEPRINT_2026.md`

---

## 1. Текущее состояние

Сейчас страницы используют CSP с `unsafe-inline` для script/style, потому что HTML монолитный и включает inline CSS/JS.

Пример текущей логики:

```text
script-src 'self' 'unsafe-inline' https://mc.yandex.ru ...
style-src 'self' 'unsafe-inline'
```

Это работает, но долгосрочно не идеально.

---

## 2. Цель

Снизить CSP-risk без поломки:

```text
не сломать Yandex.Metrika;
не сломать JSON-LD;
не сломать карты;
не сломать preview;
постепенно убрать unsafe-inline там, где возможно.
```

---

## 3. Почему не сразу strict CSP

Сейчас много inline:

```text
inline styles
inline scripts
JSON-LD
Yandex.Metrika snippet
map scripts
page-specific CSS
```

Если резко включить strict CSP, можно сломать сайт, метрику и интерактив.

---

## 4. CSP phases

### Phase 0 — inventory

Собрать:

```text
[ ] все inline script blocks
[ ] все inline style blocks
[ ] все external script origins
[ ] all connect-src targets
[ ] all img-src targets
[ ] Yandex domains
[ ] blob/data usage
```

### Phase 1 — Astro extraction

Astro сборка должна вынести:

```text
CSS → bundled/static CSS
JS → modules/chunks
map engine → module
```

Оставшиеся inline:

```text
JSON-LD
analytics snippet optional
small critical config optional
```

### Phase 2 — Yandex.Metrika CSP

Yandex docs по Metrica+CSP указывают, что для counter code с CSP нужен `script-src` nonce, плюс `img-src`, `connect-src`, `child-src`/`frame-src` для session replay/click maps [1](https://yandex.com/support/metrica/en/code/install-counter-csp).

Базовые домены:

```text
script-src: https://mc.yandex.ru https://yastatic.net
img-src: https://mc.yandex.ru data:
connect-src: https://mc.yandex.ru
frame-src/child-src: blob: https://mc.yandex.ru
```

Текущий проект также использует yandex.com/yandex.ru wildcard. Нужно проверить реально нужный список.

### Phase 3 — hashes/nonces

MDN/OWASP CSP guidance: вместо `unsafe-inline` использовать nonce-source или hash-source для inline scripts; hashes чувствительны к whitespace, nonce должен быть уникальным на ответ [1](https://github.com/mdn/content/blob/main/files/en-us/web/http/reference/headers/content-security-policy/script-src/index.md?plain=1).

Для полностью статического сайта nonce сложнее, потому что nonce должен быть per request. Поэтому для static output практичнее:

```text
hashes для стабильных inline scripts
или вынести inline scripts во внешние файлы
```

JSON-LD:

```text
script type="application/ld+json" часто нужно учитывать в CSP script-src.
```

### Phase 4 — remove unsafe-inline for script-src

Только если:

```text
[ ] analytics работает
[ ] maps работают
[ ] JSON-LD работает
[ ] no CSP violations in report-only
```

---

## 5. Report-Only mode

Перед enforcement:

```http
Content-Security-Policy-Report-Only: ...
```

Собирать violations.

На статическом хостинге без endpoint можно временно смотреть DevTools console и synthetic tests.

---

## 6. Candidate CSP after Astro extraction

Черновик:

```text
default-src 'self';
script-src 'self' https://mc.yandex.ru https://yastatic.net;
style-src 'self';
img-src 'self' data: blob: https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com;
font-src 'self' data:;
connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru;
frame-src 'self' blob: https://mc.yandex.ru https://*.yandex.ru;
object-src 'none';
base-uri 'self';
```

Но это не финал. Проверять через report-only.

---

## 7. Что делать с inline styles

Astro component styles и global CSS должны убрать большинство inline `<style>`.

Но могут остаться:

```text
style attributes для динамических цветов
SVG inline style
critical CSS
```

Решения:

```text
[ ] заменить style attributes на classes/CSS vars
[ ] CSS vars задавать через class/data-attrs где возможно
[ ] для SVG — атрибуты fill/stroke вместо style
```

---

## 8. Что делать с картами

Карты сейчас inline SVG+JS+CSS. В будущем:

```text
map.css
map-engine.js
route.json
inline SVG base maybe external/component
```

Это позволит убрать inline script/style.

---

## 9. CSP checks CI

Будущий скрипт:

```text
scripts/check-csp-readiness.js
```

Проверять:

```text
[ ] inline event handlers onclick= отсутствуют
[ ] javascript: href отсутствуют
[ ] inline scripts count reported
[ ] inline styles count reported
[ ] external origins listed
[ ] no eval/new Function
```

---

## 10. Запреты

```text
❌ unsafe-eval
❌ inline event handlers onclick="..."
❌ javascript: URLs
❌ wildcard * без причины
❌ подключение CDN scripts без необходимости
```

---

## 11. Итог

CSP hardening — отдельная фаза после Astro stabilization.

```text
Сначала переносим layout/контент.
Потом выносим inline.
Потом report-only.
Потом enforcement.
```
