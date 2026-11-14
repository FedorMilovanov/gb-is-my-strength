export interface JournalPeriod {
  period: string;
  editor: string;
  note: string;
}

export const baptistJournalPeriods: JournalPeriod[] = [
  { period: '1907–1909', editor: 'Д. И. Мазаев', note: 'Основатель и первый редактор журнала «Баптист».' },
  { period: '1910–1911', editor: 'В. Г. Павлов', note: 'Главный редактор; в 1911 опубликована «Правда о баптистах».' },
  { period: '1911', editor: 'В. Г. Павлов', note: '«Правда о баптистах» выходила на протяжении 7 номеров.' },
  { period: '1912', editor: 'Д. И. Мазаев', note: 'Возвращение Мазаева к редакторской роли.' },
  { period: '1917 — нач. 1918', editor: 'Д. И. Мазаев', note: 'Последний дореволюционный/революционный период редакции Мазаева.' },
];
