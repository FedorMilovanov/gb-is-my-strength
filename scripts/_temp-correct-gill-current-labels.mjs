#!/usr/bin/env node

import fs from 'node:fs';

const file = 'src/components/article-pilots/gill-series/gillSeriesData.ts';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing canonical Gill label: ${before}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Duplicate canonical Gill label: ${before}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  '/** Exact historical pre-v16 GBS submenu label. Roman prefix appears only on real top-level rows. */',
  '/** Current rendered submenu label. Historical wording remains immutable in the pre-v16 reference manifest; documented editorial relabels must match the current target heading. */',
);

const labelReplacements = [
  ['label: "I. От пуритан к диссентерам: путь в полтора века"', 'label: "I. От пуританского спора к устойчивому миру диссента"'],
  ['label: "II. Партикулярные и генеральные баптисты: почему это важно"', 'label: "II. Партикулярные и генеральные баптисты: две традиции, а не две монолитные партии"'],
  ['label: "III. Тень 1662 года: Великое изгнание"', 'label: "III. 1662 год и рождение устойчивого нонконформизма"'],
  ['label: "IV. Кларендонский кодекс и позднейшие религиозные тесты"', 'label: "IV. После терпимости: три разных стены"'],
  ['label: "V. Диссентерские академии: образование вне Оксфорда и Кембриджа"', 'label: "V. Диссентерские академии: не один подпольный университет, а целая экосистема"'],
  ['label: "VI. Солтерс-Холл (1719): спор о подписке"', 'label: "VI. Солтерс-Холл, 1719: Троица, подписка и власть церковной формулы"'],
  ['label: "VII. Кофейни как публичные пространства"', 'label: "VII. Лондонские сети: кофейни, письма, фонды и лекции"'],
  ['label: "VIII. Саутварк: социальная среда служения"', 'label: "VIII. Саутварк: пасторство на южном берегу"'],
  ['label: "IX. Кеттеринг и книжная лавка"', 'label: "IX. Кеттерингская книжная лавка: что действительно сообщает Риппон"'],
  ['label: "X. Итог: диссентерский пастор, тринитарный полемист и самоучка"', 'label: "X. Итог: что исторический контекст объясняет — и чего не объясняет"'],
  ['label: "Утро рождения: три пророчества"', 'label: "Риппоновское предание об утре рождения"'],
  ['label: "Книжная лавка вместо грамматической школы"', 'label: "Грамматическая школа, книжная лавка и самообразование"'],
  ['label: "Евангельская активность: свидетельства и границы"', 'label: "Евангельская активность: свидетельства и границы доказательства"'],
  ['label: "Три личных высказывания: человек за богословом"', 'label: "Личные высказывания: только с прослеживаемой передачей"'],
  ['label: "Исторический контекст: Саутварк, джиновая лихорадка, правовое бесправие"', 'label: "Кеттеринг, Саутварк и правовой мир диссентеров"'],
  ['label: "Догматический и практический «Свод богословия»"', 'label: "«Полный свод богословия» — первая баптистская сумма"'],
  ['label: "Управление церковью: пасторы, дьяконы и выбор общины"', 'label: "Управление церковью: один пастор и власть общины"'],
  ['label: "Американская рецепция и архивные границы"', 'label: "Влияние на Америку и Фонд партикулярных баптистов"'],
  ['label: "Современники и поздняя биографическая память"', 'label: "Как современники видели Гилла: портрет из первых уст"'],
  ['label: "Современная переоценка и цифровые проекты"', 'label: "Современное переиздание и новый этап исследований: «Проект Джона Гилла»"'],
];

for (const [before, after] of labelReplacements) replaceOnce(before, after);

fs.writeFileSync(file, source, 'utf8');
console.log(`Updated ${labelReplacements.length} canonical Gill rail labels to current native headings.`);
