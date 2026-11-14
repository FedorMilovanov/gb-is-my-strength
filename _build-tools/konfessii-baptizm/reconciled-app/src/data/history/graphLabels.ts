const labels: Record<string, string> = {
  root: 'Русский баптизм',
  trans: 'Закавказье',
  ukr: 'Южная Украина',
  spb: 'Петербург',
  vsb: 'Союз баптистов',
  vseh: 'ВСЕХ',
  vsehb: 'ВСЕХБ',
  sc: 'СЦ ЕХБ',
  rsehb: 'РС ЕХБ',
  voronin: 'Н. Воронин',
  pavlov: 'В. Павлов',
  mazaev: 'Д. Мазаев',
  pashkov: 'В. Пашков',
  prokhanov: 'И. Проханов',
  kargel: 'И. Каргель',
  zhidkov: 'Я. Жидков',
  kryuchkov: 'Г. Крючков',
  kalweit: 'М. Кальвейт',
  redstock: 'Лорд Редсток',
  weiler: 'И. Вилер',
  tsymbal: 'Е. Цымбал',
  karev: 'А. Карев',
  vins: 'Г. Винс',
};

export function getGraphNodeLabel(id: string) {
  return labels[id] || id;
}
