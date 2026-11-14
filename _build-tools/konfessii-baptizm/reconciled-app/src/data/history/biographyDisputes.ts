export interface BiographyDispute {
  person: string;
  issue: string;
  versionA: string;
  versionB: string;
  note: string;
}

export const biographyDisputes: BiographyDispute[] = [
  {
    person: 'В. Г. Павлов',
    issue: 'Место рождения',
    versionA: 'Воронцовка Шемахинской губернии',
    versionB: 'с. Воронцовка Александропольского уезда Эриванской губернии',
    note: 'ourbaku.com уточняет: молоканское село Воронцовка недалеко от Тифлиса; окончательная проверка требует метрики.',
  },

];
