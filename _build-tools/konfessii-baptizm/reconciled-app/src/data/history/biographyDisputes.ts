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
  {
    person: 'И. В. Каргель',
    issue: 'Кто крестил',
    versionA: 'Н. И. Воронин, 1869 (pravenc.ru)',
    versionB: 'Упоминание крещения Кальвейтом у Валькевича / в автобиографии Кальвейта',
    note: 'Возможна ситуация с более ранним вхождением в немецкую общину и последующим повторным включением в русскую общину; вопрос остаётся открытым.',
  },
];
