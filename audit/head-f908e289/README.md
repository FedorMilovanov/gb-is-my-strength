# Раунд 13: проверка `W109` (`f908e289e59b423f98d129b20552e6d6d3092b04`), 9 разделов сайта и поиска в Dark-теме

Сборка `f908e289e59b423f98d129b20552e6d6d3092b04` выполнена в `/tmp/head-f908-build` (Node `v22.23.4`, `strangler:build` + postbuild) и проверена в реальном Chromium без правки продуктового кода.

- **`W109` (`GillSeriesMobileBar.astro`):** `.reader-mobile-speed-chip` получил `pointer-events: none` — клик в область нарисованного чипа `1×` попадает в `.reader-mobile-play` (`hitOwnerId: "gb-ember mobile-top-ember reader-mobile-play"`), при этом `#mobSpdBadge` по-прежнему открывает рейл скоростей (`speedOpen: true`).
- **9 ранее не проверявшихся верхнеуровневых маршрутов (`/about/`, `/biografii/`, `/journal/`, `/konfessii/`, `/otstupniki/`, `/pastor-series/`, `/podrostok-za-kadrom/`, `/updates/`, `/baptisty-rossii/`) на `320×568` и `1440×900`:** 0 JS `pageerror`, 0 битых `<img>`, 0 переполнений таблиц и заголовков (`docOv <= 0`).
- **Поиск `#gbSearchBtn` в тёмной теме (`320×568`):** палитра и возврат фокуса по `Escape` на `#gbSearchBtn` работают чисто, однако 4-я вкладка фильтра **`АВТОРЫ`** по-прежнему обрезается у правого края (`АВТОР`, см. [`r13-search-dark-320.jpg`](r13-search-dark-320.jpg)).
- **Десктопный прогресс серии Gill (`1440×900`):** после прочтения Части I до `96%` общая строка серии на Части II показывает `25%` (`COMPLETE_AT = 97%`).

[Скриншот поиска](r13-search-dark-320.jpg) · [замеры](r13-checks.jsonl).
