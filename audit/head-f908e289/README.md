# Раунд 13: проверка `W109` (`f908e289e59b423f98d129b20552e6d6d3092b04`), 9 разделов сайта и поиска в Dark-теме

Сборка `f908e289e59b423f98d129b20552e6d6d3092b04` выполнена в `/tmp/head-f908-build` (Node `v22.23.4`, `strangler:build` + postbuild) и проверена в реальном Chromium без правки продуктового кода.

- **`W109` (`GillSeriesMobileBar.astro`):** `.reader-mobile-speed-chip` получил `pointer-events: none` — клик в область нарисованного чипа `1×` попадает в `.reader-mobile-play` (`hitOwnerId: "gb-ember mobile-top-ember reader-mobile-play"`), при этом `#mobSpdBadge` по-прежнему открывает рейл скоростей (`speedOpen: true`).
- **9 ранее не проверявшихся верхнеуровневых маршрутов (`/about/`, `/biografii/`, `/journal/`, `/konfessii/`, `/otstupniki/`, `/pastor-series/`, `/podrostok-za-kadrom/`, `/updates/`, `/baptisty-rossii/`) на `320×568` и `1440×900`:** 0 JS `pageerror`, 0 битых `<img>`, 0 переполнений таблиц и заголовков (`docOv <= 0`).
- **Поиск `#gbSearchBtn` в тёмной теме (`320×568`):** палитра и возврат фокуса по `Escape` на `#gbSearchBtn` работают чисто, однако 4-я вкладка фильтра **`АВТОРЫ`** по-прежнему обрезается у правого края (`АВТОР`, см. [`r13-search-dark-320.jpg`](r13-search-dark-320.jpg)).
- **Десктопный прогресс серии Gill (`1440×900`):** после прочтения Части I до `96%` общая строка серии на Части II показывает `25%` (`COMPLETE_AT = 97%`).

[Скриншот поиска](r13-search-dark-320.jpg) · [замеры](r13-checks.jsonl).

## Раунд 14: `/konfessii/russkij-baptizm/`, «Нагорная» (`chast-2..5`, `istochniki`, `nakhodki`, `seriya`), 6 статей и типографика (`f908e289`)

- **`/konfessii/russkij-baptizm/` (`320×568`, [`r14-konfessii-320.jpg`](r14-konfessii-320.jpg)):** 0 JS-ошибок и `docOv: 0`, однако ссылка в шапке обрезана по середине слова (`← Конфессии и Деноми`), а надпись загрузчика `ЗАГРУЗКА ИНТЕРАКТИВНОЙ 3D-КАРТЫ...` имеет сверхнизкий контраст тёмного по тёмному.
- **`/nagornaya/chast-2..5/`, `/nagornaya/istochniki/`, `/nagornaya/nakhodki/`, `/nagornaya/seriya/` (`320×568`, `768×1024`, `1440×900`):** все 21 прогон без JS-ошибок, без `docOv > 0`, без `tableOv > 0` и без склейки `Опубликовано:1`.
- **6 ранее не проверявшихся статей (`/articles/diotrefy-nashego-vremeni/`, `/articles/steven-lawson-samoobman-i-publichnyy-golos/`, `/articles/vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti/`, `/articles/podrostok-za-kadrom-chto-delat-tserkvi/`, `/articles/otstupniki-biblii-iuda-saul-ierovoam-dimas/`, `/articles/teksty-pisaniya-kotorymi-manipuliruyut/` на `320×568` и `1440×900`):** 0 JS-ошибок, 0 битых `<img>`, 0 переполнений таблиц и разрывов слов.
- **Десктопная типографика Gill II (`1440×900`):** переключение `Cormorant Garamond` + `Свободный` интерлиньяж + `Широкая` строка (`Lora → Cormorant Garamond`, `28.8px → 33.3px`, `734px → 846px`) срабатывает чисто.

[Скриншот конфессии](r14-konfessii-320.jpg) · [замеры](r14-checks.jsonl).

## Раунд 15: оставшиеся 19 статей `/articles/*` (38 прогонов) и интерактив `/konfessii/russkij-baptizm/` (`f908e289`)

- **19 ранее не проверявшихся статей `/articles/*` на `320×568` и `1440×900` (38 прогонов):** `anatomiya-padeniya-pyat-stadiy`, `cerkovnaya-disciplina-vlast-granicy-zashchita`, `kogda-chelovek-uhodit-ot-very`, `kogda-uhodit-kogda-ostavatsya`, `lot-i-sodom`, `nesovershennyy-chelovek-v-nesovershennoy-cerkvi`, `otreklis-ot-hrista-istoriya-cerkvi`, `otstuplenie-chto-govorit-bibliya`, `petr-i-iuda-padenie-ili-otstuplenie`, `priznaki-zdorovoy-cerkvi`, `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`, `sem-tipov-razlichenie-uchiteley`, `serdce-spravochnik`, `sovershennoletie-roditelskaya-vlast-chto-menyaetsya`, `strah-bozhij-rabskij-ili-synovnij`, `svoboda-vo-hriste`, `vernye-i-neizvestnye-zdorovoe-pastyrstvo`, `vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya`, `vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie` — **0 JS-ошибок, 0 битых `<img>`, `docOv <= 0`, `tableOv: 0`, разрывов слов в таблицах нет**.
- **`/konfessii/russkij-baptizm/` (`_app/index.html` внутри iframe):** при ожидании >1.8 с интерактивная карта «Карта Русского Баптизма» загружается и отрисовывается без локальных 404 или JS-исключений (единственный внешний запрос, отклонённый песочницей — `mc.yandex.ru`).

[Замеры](r15-checks.jsonl).
