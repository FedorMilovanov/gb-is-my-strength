#!/usr/bin/env node

import fs from 'node:fs';

const file = 'data/gill-submenu-anchor-reconciliation.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data.relabels ||= {};

const currentNativeLabels = {
  'articles/dzhon-gill-istoricheskiy-kontekst/index.html': {
    '#sec-from-puritans-to-baptists': 'I. От пуритан к диссентерам: путь в полтора века',
    '#sec-particular-vs-general': 'II. Партикулярные и генеральные баптисты: почему это важно',
    '#sec-great-ejection': 'III. Тень 1662 года: Великое изгнание',
    '#sec-clarendon': 'IV. Кларендонский кодекс и позднейшие религиозные тесты',
    '#sec-academies': 'V. Диссентерские академии: образование вне Оксфорда и Кембриджа',
    '#sec-salters-hall': 'VI. Солтерс-Холл (1719): спор о подписке',
    '#sec-coffee-house': 'VII. Кофейни как публичные пространства',
    '#sec-southwark': 'VIII. Саутварк: социальная среда служения',
    '#sec-books': 'IX. Кеттеринг и книжная лавка',
    '#sec-conclusion': 'X. Итог: диссентерский пастор, тринитарный полемист и самоучка',
  },
  'articles/dzhon-gill-chast-1-chelovek/index.html': {
    '#sec-birth-prophecy': 'Утро рождения: три пророчества',
    '#sec-education': 'Книжная лавка вместо грамматической школы',
    '#sec-evangelism': 'Евангельская активность: свидетельства и границы',
    '#sec-personal-credo': 'Три личных высказывания: человек за богословом',
    '#sec-context-southwark': 'Исторический контекст: Саутварк, джиновая лихорадка, правовое бесправие',
  },
  'articles/dzhon-gill-chast-2-uchenyi/index.html': {
    '#sec-systematics': 'Догматический и практический «Свод богословия»',
  },
  'articles/dzhon-gill-chast-3-nasledie/index.html': {
    '#sec-church-gov': 'Управление церковью: пасторы, дьяконы и выбор общины',
    '#sec-america': 'Американская рецепция и архивные границы',
    '#sec-contemporaries': 'Современники и поздняя биографическая память',
    '#sec-gill-muller-rediscovery': 'Современная переоценка и цифровые проекты',
  },
};

for (const [route, labels] of Object.entries(currentNativeLabels)) {
  data.relabels[route] = { ...(data.relabels[route] || {}), ...labels };
}

data.reconciledAt = '2026-07-25';
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Corrected 20 stale PR #231 labels to current native headings.');
