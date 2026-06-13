# 06. Инвентаризация локальных источников и внешних URL

Этот файл нужен, чтобы не тащить в репозиторий десятки PDF/HTML-слепков, но не потерять, что уже скачано и откуда взято. Бинарные PDF пока лучше держать вне публикационной серии, а в репо хранить ссылки, цитаты и текстовые выжимки.

## Локально скачанные источники, упомянутые в исследованиях

- `/home/user/research/russian_baptism/historyofecb.pdf/txt` — ВСЕХБ 1989, История ЕХБ в СССР. URL: http://rusbaptist.stunda.org/zips/historyofecb.pdf
- `/home/user/research/russian_baptism/sinichkin-kreshchenie-pervogo-russkogo-baptista-2018-real.pdf/txt` — А. Синичкин, крещение Воронина. URL: http://almanah.bogomysliye.com/article/view/133829
- `/home/user/research/russian_baptism/sim_baptist-missionary-magazine_1870-*.txt` — Baptist Missionary Magazine / The Missionary Magazine, 1870. Internet Archive identifiers `sim_baptist-missionary-magazine_1870-01_50_1` ... `1870-12_50_12`.
- `baptisty-rossii/research/raw-sources/batchenko-nkvd-normative-acts-1929-1930.html/txt` — В. С. Батченко, полные тексты актов НКВД 1929. URL: https://www.sedmitza.ru/lib/text/7697292/
- `baptisty-rossii/research/raw-sources/bornovolokov-military-question-ru-real.pdf/txt` — О. Борноволоков, военный вопрос. URL: http://almanah.bogomysliye.com/article/view/281176
- `baptisty-rossii/research/raw-sources/istmat-1919-decree-raw.html` и `istmat-1919-decree.txt` — декрет 4 января 1919. URL: https://istmat.org/node/37823

## Принцип хранения

1. В репо серии храним консолидированные Markdown-досье и ссылки.
2. PDF и большие OCR-файлы добавлять только выборочно, если они критически нужны и не перегружают репозиторий.
3. Каждая статья должна иметь в конце источниковую секцию; после переноса материала в HTML отмечать это в `00-master-source-index-glossary-map.md`.
4. Для карты `/konfessii/russkij-baptizm/` вести отдельный список исправлений в `00-master-source-index-glossary-map.md`, а приложение карты править только через исходники/сборку, не руками в `_app/`.
