# Спецификация блока связей внутри статьи

Статус: **каноническая build-time спецификация**  
Владелец данных: relation compiler  
Владелец HTML: `scripts/project-relations-to-dist.mjs`  
Владелец стилей: `src/runtime/relationship-panel.css`

## 1. Цель

Заменить технические блоки «Эта статья ссылается на» и «На эту статью ссылаются» одним спокойным содержательным модулем, который:

- объясняет пользу каждого перехода;
- не повторяет навигацию серии;
- существует без JavaScript;
- одинаково строится для Astro и legacy article output;
- не зависит от сетевой загрузки graph JSON.

## 2. Название

- самостоятельный материал: **«Продолжить исследование»**;
- материал серии: **«Контекст и связи»**.

Series engine остаётся единственным владельцем перехода к другой части серии.

## 3. Место на странице

### Материал серии

1. основной текст;
2. существующая series navigation;
3. «Контекст и связи»;
4. автор и нижние служебные элементы.

### Самостоятельный материал

1. основной текст;
2. «Продолжить исследование»;
3. автор / нижняя навигация.

Build projector использует детерминированный порядок insertion anchors:

1. после `.astro-series-nav`;
2. перед `.astro-author-card`;
3. перед `.author-card`;
4. перед `.related-articles`;
5. перед закрывающим `</article>`.

Отсутствие корректной article boundary считается build error.

## 4. Семантический HTML

Корень:

```html
<nav
  class="gb-relations-panel"
  data-relation-engine="1"
  data-relation-source="ARTICLE_ID"
  aria-labelledby="UNIQUE_HEADING_ID"
>
```

Требования:

- каждый материал — один цельный `<a href>`;
- вложенные интерактивные элементы запрещены;
- заголовок имеет уникальный ID;
- source и edge IDs присутствуют только в `data-*`, не в публичном тексте;
- ссылка в Атлас использует `/map/?focus=<canonical-id>`;
- target URL берётся только из compiled node, никогда не строится из ID.

## 5. Состав

На первом уровне показываются:

- eyebrow «Навигация по исследованию»;
- заголовок;
- короткое объяснение;
- число показанных материалов;
- от одного до четырёх unique target;
- переход к сфокусированному окружению в Атласе.

Каждая связь содержит:

- человекочитаемый relation label;
- название материала;
- rationale или редакционное описание;
- тип материала;
- время чтения при наличии;
- визуальную стрелку без отдельной кнопки.

Если после фильтрации нет полезных внешних связей, блок не создаётся.

## 6. Отбор и ранжирование

Article projection строится только relation compiler.

Порядок определяется числовым score из:

- relation weight;
- article priority типа;
- преимуществ typed catalog перед legacy import;
- наличия rationale;
- полноты метаданных target.

Инварианты:

- максимум четыре target;
- target уникален;
- текущий материал исключён;
- `series-next` не article-visible;
- target той же серии исключён независимо от edge kind;
- draft/deprecated relation не попадает в production;
- typed relation вытесняет legacy pair;
- ranking детерминирован и не зависит от пользователя.

## 7. Визуальная модель

Одна поверхность, а не набор вложенных белых карточек.

- тонкая рамка;
- спокойная глубина без тяжёлого glass/shadow;
- serif для названий;
- sans-serif для метаданных;
- мягкие row-разделители;
- первый материал допускает усиленную иерархию;
- тема определяется CSS variables;
- light, dark и reader theme совместимы;
- цветовая семантика не является единственным носителем смысла.

## 8. Адаптивность

### Desktop

- ширина совпадает с колонкой статьи;
- строки остаются цельными и читаемыми;
- Atlas action находится в нижней полосе;
- focus ring не обрезается.

### Mobile

- одна колонка;
- весь row является touch target;
- target не меньше 44px;
- описание ограничивается двумя строками;
- метаданные не создают horizontal overflow;
- горизонтальные карусели запрещены.

## 9. Build-time поведение

Проектор обязан:

1. загрузить `dist/data/relations.compiled.json`;
2. проверить schema version;
3. удалить старые `.gbx-backlinks`;
4. удалить предыдущую `.gb-relations-panel`;
5. удалить obsolete relationship runtime tags;
6. внедрить новую статическую проекцию;
7. материализовать CSS с content hash;
8. удалить `dist/js/relationship-panel.js`;
9. записать `dist/reports/relation-projection.json`.

Повторный запуск над тем же dist должен давать один panel и одинаковый HTML.

## 10. Отказоустойчивость

После успешной сборки:

- panel не выполняет fetch;
- panel не выполняет JavaScript;
- блок работает при `javaScriptEnabled=false`;
- отказ `/data/*.json` не удаляет и не меняет panel;
- основной текст и series navigation не зависят от relation UI;
- повреждённый compiler payload останавливает build, а не создаёт частичную публикацию.

## 11. Доступность

- `<nav aria-labelledby>`;
- настоящий heading;
- описательные link labels;
- видимый `:focus-visible`;
- touch target ≥ 44px;
- `prefers-reduced-motion` отключает декоративные transitions;
- information order совпадает с DOM order;
- mini-graph не допускается без эквивалентного списка.

## 12. Print

Canonical print/PDF полностью скрывает `.gb-relations-panel`.

Причина: это навигационная, а не содержательная часть публикации. Она не должна менять пагинацию, reference PDF и физическую верстку статьи.

## 13. Browser acceptance

Для серийного и самостоятельного материала проверяются:

- desktop 1440px;
- mobile 390px;
- mobile no-JS;
- ровно один panel;
- 1–4 unique target;
- отсутствие same-series links;
- отсутствие `.gbx-backlinks`;
- отсутствие `/js/relationship-panel.js`;
- отсутствие relation data requests;
- корректный Atlas focus URL;
- width/target geometry;
- horizontal overflow ≤ 2px;
- `display:none` в print media;
- panel сохраняется при принудительном отказе data endpoints.

## 14. Аналитика

Допустимые будущие события:

- `relation_open`;
- `relation_atlas_open`.

Аналитика не имеет права менять ranking, скрывать ссылки или персонализировать смысловую ткань без отдельного публичного контракта.
