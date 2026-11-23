# Независимый аудит PR #2352 на коммите `6e80075b` (раунд 16)

Проверено на чистой пересборке `6e80075b70ce808c1e4e1f5978504cce4e120a0e` (`/tmp/head-6e80-build`) без модификации продуктового кода репозитория.

## 1. Проверка исправления `6e80075b` (`fix(gill): restore TOC Listen on frontmatter pages`)

- **`/articles/dzhon-gill-istoricheskiy-kontekst/` и `/articles/dzhon-gill-spravochnik/` (`320×568`, `390×844`, `1024×768`):** в футере `#partTocOverlay .gbat-foot` присутствуют все 3 действия: `[data-gbat-listen]` (**«Слушать статью»** + время чтения), `[data-gbat-continue]` («Продолжить») и `.gbat-fbtn--pdf` (печать/PDF).
  - На `320×568`: `136×52` (`Слушать статью` в 2 строки, `listenOverflow: 0`) + `100×52` + `40×52`, `docOv: 0`.
  - На `390×844`: `166×52` (`СЛУШАТЬ СТАТЬЮ` в 1 строку, `listenOverflow: 0`) + `138×52` + `40×52`, `docOv: 0`.
  - На `1024×768`: `207×52` + `173×52` + `42×52`.
- **Действие `[data-gbat-listen]` (`390×844`):** нажатие на `/articles/dzhon-gill-istoricheskiy-kontekst/` закрывает `#partTocOverlay` (`tocOpen: false`) и вызывает `window.speechSynthesis.speak` с первым абзацем статьи (идентично главам серии вроде `/articles/dzhon-gill-chast-2-uchenyi/`).
- **Регрессия `W106` (`gill-panel-resize-state-repro.mjs`):** `REPRO_EXIT=0` ([лог](r16-resize-repro.jsonl)).

## 2. Непроверенные разделы: `/baptisty-rossii/*`, оставшиеся `/karty/*` и `/hard-texts/*` (54 прогона на `320×568` и `1440×900`)

- **Все 10 подстраниц `/baptisty-rossii/*`**, **9 оставшихся `/karty/*`** и **все 8 `/hard-texts/*`**: **0 JS-ошибок (`pageerror`), 0 битых `<img>`, `docOv: 0`, `tableOv: 0`**.
- **Мелкая находка на `/hard-texts/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom/` (`320×568`):** в узкой ячейке таблицы слово `приложение` и диапазон `4Q208–4Q211` переносятся внутри ячейки без горизонтального переполнения.

![TOC Listen на вводной странице Джона Гилла (`6e80075b`)](r16-findings.jpg)

[Сводка проверок](r16-checks.jsonl)
