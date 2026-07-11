/**
 * views.mjs — сохранённые «быстрые виды» генеалогии (панель-навигатор, ссылки, SEO).
 *
 * Единый источник для: (1) эмита data/genealogy/v2/views.json, (2) панели быстрых
 * видов в камертоне оболочки. Счётчики берутся ИЗ ДАННЫХ (кластеры/персоны), не
 * хардкодом — панель честна ровно настолько, насколько честен пайплайн.
 *
 * kind: focus-spine — фокус золотого хребта; cluster — раскрытие кластера L0;
 *       archetype — отдельная развёртка (напр. Таблица народов); filter — фильтр
 *       по признаку; era — навигация по эпохам.
 */

export function buildViews({ clusters = [], persons = [], nationsCount = 70 } = {}) {
  const c = id => clusters.find(x => x.id === id)?.count ?? 0;
  const women = persons.filter(p => p.gender === 'f').length;
  return [
    { id: 'spine', titleRu: 'Адам → Христос', icon: 'cross', kind: 'focus-spine',
      hint: 'хребет', descRu: 'Золотая мессианская нить через всю Библию' },
    { id: 'tribes-12', titleRu: '12 колен Израиля', icon: 'tribes', kind: 'cluster',
      target: 'tribes-12', count: c('tribes-12'), hint: 'L1',
      descRu: 'Сыновья Иакова — родоначальники колен (радиальная развёртка)' },
    { id: 'house-of-david', titleRu: 'Дом Давида', icon: 'crown', kind: 'cluster',
      target: 'house-of-david', count: c('house-of-david'), hint: `+${c('house-of-david')}`,
      descRu: 'Царская династия от Давида' },
    { id: 'nations', titleRu: 'Народы от Ноя', icon: 'globe', kind: 'archetype',
      target: 'nations', count: nationsCount, hint: String(nationsCount),
      descRu: 'Таблица народов (Быт 10): 70 народов от трёх сыновей Ноя' },
    { id: 'matthew-1', titleRu: 'Родословие Матфея', icon: 'book', kind: 'cluster',
      target: 'matthew-1', count: c('matthew-1'), hint: 'Мф 1',
      descRu: 'Царская (юридическая) линия: Авраам → Иосиф' },
    { id: 'luke-3', titleRu: 'Родословие Луки', icon: 'scroll', kind: 'cluster',
      target: 'luke-3', count: c('luke-3'), hint: 'Лк 3',
      descRu: 'Кровная линия через Марию: Христос → Адам' },
    { id: 'women', titleRu: 'Женские фигуры', icon: 'people', kind: 'filter',
      target: 'gender:f', count: women, hint: String(women),
      descRu: 'Все женщины генеалогии (матери, жёны, дочери)' },
    { id: 'eras', titleRu: 'Хронология (эпохи)', icon: 'ladder', kind: 'era',
      hint: 'I–VI', descRu: 'Шесть эпох от Сотворения до Воплощения' },
  ];
}

/**
 * Компактный поисковый индекс (build-time): персоны и народы.
 * Формат строк: [id, имяRu, имяEn, ссылкаRu] — плоские массивы ради веса.
 */
export function buildSearchIndex({ persons = [], nationsTree = null } = {}) {
  const person = p => [p.id, p.ru?.name ?? null, String(p.en).split('|')[0], p.firstRef?.ru ?? null];
  const nations = [];
  if (nationsTree?.branches) {
    const walk = (n, branch) => {
      nations.push([`ton--${n.id}`, n.ru, n.en, refRuShort(n.ref), branch]);
      (n.children ?? []).forEach(ch => walk(ch, branch));
    };
    for (const b of nationsTree.branches) {
      nations.push([`ton--${b.id}`, b.ru, b.en, refRuShort(b.ref), b.id]);
      b.children.forEach(ch => walk(ch, b.id));
    }
  }
  return {
    v: 1,
    fields: { persons: ['id', 'ru', 'en', 'refRu'], nations: ['id', 'ru', 'en', 'refRu', 'branch'] },
    persons: persons.map(person),
    nations,
  };
}

function refRuShort(ref) {
  const m = /^Gen\.(\d+)\.(\d+)$/.exec(ref ?? '');
  return m ? `Быт ${m[1]}:${m[2]}` : null;
}
