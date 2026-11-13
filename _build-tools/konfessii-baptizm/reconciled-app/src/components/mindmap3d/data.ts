import type {
  CityMarker,
  LinkData,
  MapArea,
  NodeData,
  NodeGroup,
  RoutePreset,
} from './types';

export const GROUP_COLORS: Record<NodeGroup, string> = {
  root: '#d4a857',
  origin: '#00c8c8',
  ukraine: '#f0a830',
  petersburg: '#ff64b4',
  union: '#8b4dff',
  modern: '#2fd3c7',
  split: '#ff4b6e',
  leader: '#aab0d5',
};

export const GROUP_LABELS: Record<NodeGroup, string> = {
  root: 'Центр',
  origin: 'Закавказье',
  ukraine: 'Украина',
  petersburg: 'Петербург',
  union: 'Союзы',
  modern: 'Современность',
  split: 'Разделение',
  leader: 'Личность',
};

export const NODES: NodeData[] = [
  // Главный узел — самый большой (иерархия уровня 1)
  { id: 'root', label: 'Русский баптизм', group: 'root', size: 32, isCenter: true, x: 42, y: 14, z: 18, desc: 'ЕХБ сформированы из трёх независимых истоков: Тифлис (1867), Южная Украина (1869), Санкт-Петербург (1874). Три линии соединились в сложную историю союзов, гонений, совести и подпольной печати.', stats: { users: '66 732', year: 'BWA', sources: '10' }, stages: [{ year: '1867', text: 'Рождение русского баптизма через крещение Воронина' },{ year: '1869', text: 'Штундистский очаг на Южной Украине' },{ year: '1874', text: 'Петербургское пробуждение и пашковское движение' },{ year: '1909', text: 'Создание ВСЕХ и параллельное развитие союзов' },{ year: '1944', text: 'Создание ВСЕХБ как общего советского центра' }] },
  // Союзы — большие узлы (иерархия уровня 2)
  { id: 'vsehb', label: 'ВСЕХБ', year: '1944', group: 'union', size: 22, x: 18, y: -6, z: 10, desc: 'Всесоюзный совет ЕХБ — официальный центр советского периода.', stats: { users: '~530 000', year: '1944', sources: 'БВ' } },
  { id: 'vsb', label: 'Союз баптистов', year: '1884', group: 'union', size: 20, x: 8, y: -58, z: 6, desc: 'Первый союзный каркас баптистского движения Южной России и Кавказа.' },
  { id: 'vseh', label: 'ВСЕХ', year: '1909', group: 'union', size: 20, x: 78, y: 32, z: 20, desc: 'Всероссийский союз евангельских христиан — линия Проханова, выросшая из петербургской ветви.' },
  { id: 'sc', label: 'СЦ ЕХБ', year: '1965', group: 'split', size: 18, x: -18, y: -88, z: -2, desc: 'Совет Церквей ЕХБ — ветвь сопротивления и отказа от регистрации.' },
  { id: 'rsehb', label: 'РС ЕХБ', year: '1992', group: 'modern', size: 18, x: 54, y: -78, z: -4, desc: 'Российский союз ЕХБ — современная зарегистрированная структура.' },
  // Регионы/истоки — средние узлы (иерархия уровня 3)
  { id: 'spb', label: 'Петербург', year: '1874', group: 'petersburg', size: 17, x: -48, y: 40, z: 24, desc: 'Аристократический исток. Редсток, Пашков, петербургские салоны и будущая линия Проханова.', stages: [{ year: '1874', text: 'Проповеди Редстока' },{ year: '1876', text: 'Общество духовно-нравственного чтения' },{ year: '1884', text: 'Разгром Петербургского съезда' },{ year: '1909', text: 'Создание ВСЕХ' }] },
  { id: 'trans', label: 'Закавказье', year: '1867', group: 'origin', size: 17, x: 66, y: -8, z: 14, desc: 'Тифлисский исток: Кальвейт, Воронин, Павлов и ранняя русскоязычная баптистская община.', stages: [{ year: '1867', text: 'Крещение Воронина в Куре' },{ year: '1871', text: 'Крещение Павлова' },{ year: '1884', text: 'Вхождение в союзную структуру' }] },
  { id: 'ukr', label: 'Южная Украина', year: '1869', group: 'ukraine', size: 17, x: -56, y: -14, z: 12, desc: 'Южный исток: штундистская среда, чтение Нового Завета, Einlage/Alt-Danzig, Цимбал, Вилер и постепенное принятие баптистской формы.', stages: [{ year: '1864', text: 'Первая баптистская церковь из немецких колонистов' },{ year: '1869', text: 'Крещение Цимбала' },{ year: '1884', text: 'Ново-Васильевка и первый съезд' }] },
  // Личности — маленькие узлы (иерархия уровня 4)
  { id: 'voronin', label: 'Н. Воронин', year: '1840–1905', group: 'leader', size: 9, x: 106, y: -34, z: -6, desc: 'Первый русский баптист, крещён Мартином Кальвейтом.' },
  { id: 'pavlov', label: 'В. Павлов', year: '1854–1924', group: 'leader', size: 9, x: 104, y: -76, z: -10, desc: 'Крещён Ворониным, переводчик «Гамбургского исповедания», председатель Союза баптистов.' },
  { id: 'mazaev', label: 'Д. Мазаев', year: '1855–1922', group: 'leader', size: 9, x: -94, y: -56, z: -10, desc: 'Многолетний председатель Союза баптистов России и редактор журнала «Баптист».' },
  { id: 'pashkov', label: 'В. Пашков', year: '1834–1902', group: 'leader', size: 9, x: -108, y: 66, z: -10, desc: 'Организатор петербургского евангельского пробуждения.' },
  { id: 'prokhanov', label: 'И. Проханов', year: '1869–1935', group: 'leader', size: 9, x: 112, y: 70, z: -12, desc: 'Лидер ВСЕХ и ключевая фигура евангельского движения.' },
  { id: 'kargel', label: 'И. Каргель', year: '1849–1937', group: 'leader', size: 9, x: -90, y: 8, z: -14, desc: 'Богослов и связующее звено трёх очагов.' },
  { id: 'zhidkov', label: 'Я. Жидков', year: '1885–1966', group: 'leader', size: 8, x: 86, y: -100, z: -12, desc: 'Первый председатель ВСЕХБ.' },
  { id: 'kryuchkov', label: 'Г. Крючков', year: '1926–2007', group: 'leader', size: 8, x: -54, y: -122, z: -14, desc: 'Лидер Совета Церквей ЕХБ.' },
  { id: 'karev', label: 'А. Карев', year: '1894–1971', group: 'leader', size: 8, x: 126, y: -88, z: -18, desc: 'Генеральный секретарь ВСЕХБ и редактор «Братского вестника».' },
  { id: 'vins', label: 'Г. Винс', year: '1928–1998', group: 'leader', size: 8, x: -104, y: -150, z: -18, desc: 'Секретарь СЦ ЕХБ, узник совести и правозащитник.' },
  { id: 'kalweit', label: 'М. Кальвейт', year: '1833–1918', group: 'leader', size: 7, x: 128, y: 12, z: -18, desc: 'Немецкий баптист, совершивший крещение Никиты Воронина в Тифлисе.' },
  { id: 'redstock', label: 'Лорд Редсток', year: '1833–1913', group: 'leader', size: 7, x: -132, y: 104, z: -20, desc: 'Английский евангелист, чьи проповеди в Петербурге дали толчок пашковскому движению.' },
  { id: 'weiler', label: 'И. Вилер', year: '1839–1889', group: 'leader', size: 7, x: -132, y: -28, z: -18, desc: 'Немецкий баптистский руководитель южно-украинского штундистского очага.' },
  { id: 'tsymbal', label: 'Е. Цимбал', year: 'ок. 1830–1890-е', group: 'leader', size: 7, x: -126, y: -96, z: -16, desc: 'Первый южно-украинский штундист, формально принявший баптистское крещение.' },
];

export const LINKS: LinkData[] = [
  { id: 'l1', source: 'spb', target: 'root', label: 'Петербургский исток', desc: '1874' },{ id: 'l2', source: 'trans', target: 'root', label: 'Тифлисский исток', desc: '1867' },{ id: 'l3', source: 'ukr', target: 'root', label: 'Украинский исток', desc: '1869' },{ id: 'l4', source: 'spb', target: 'vseh', label: 'Линия Проханова', desc: '1909' },{ id: 'l5', source: 'trans', target: 'vsb', label: 'Образовали', desc: '1884' },{ id: 'l6', source: 'ukr', target: 'vsb', label: 'Образовали', desc: '1884' },{ id: 'l7', source: 'vsb', target: 'vsehb', label: 'Слились в', desc: '1944' },{ id: 'l8', source: 'vseh', target: 'vsehb', label: 'Слились в', desc: '1944' },{ id: 'l9', source: 'vsehb', target: 'sc', label: 'Раскол', desc: '1961–1965' },{ id: 'l10', source: 'vsehb', target: 'rsehb', label: 'Реорганизация', desc: '1992' },
  { id: 'l11', source: 'voronin', target: 'trans', label: 'Тифлис', desc: '1867' },{ id: 'l12', source: 'pavlov', target: 'trans', label: 'Тифлис', desc: '1871' },{ id: 'l13', source: 'pavlov', target: 'vsb', label: 'Председатель', desc: '1909' },{ id: 'l14', source: 'mazaev', target: 'vsb', label: 'Председатель', desc: '1887–1909' },{ id: 'l15', source: 'pashkov', target: 'spb', label: 'Организовал', desc: '1874' },{ id: 'l16', source: 'prokhanov', target: 'vseh', label: 'Основал', desc: '1909' },{ id: 'l17', source: 'kargel', target: 'spb', label: 'Богослов', desc: 'Петербург' },{ id: 'l18', source: 'kargel', target: 'trans', label: 'Крещение', desc: '1869' },{ id: 'l19', source: 'kargel', target: 'ukr', label: 'Вилер', desc: '1872–1873' },{ id: 'l20', source: 'zhidkov', target: 'vsehb', label: 'Председатель', desc: '1944' },{ id: 'l21', source: 'kryuchkov', target: 'sc', label: 'Лидер', desc: '1965' },{ id: 'l22', source: 'kalweit', target: 'trans', label: 'Крестил', desc: '1867' },{ id: 'l23', source: 'redstock', target: 'spb', label: 'Пробуждение', desc: '1874' },{ id: 'l24', source: 'weiler', target: 'ukr', label: 'Штундизм', desc: '1860-е' },{ id: 'l25', source: 'tsymbal', target: 'ukr', label: 'Крещение', desc: '1869' },{ id: 'l26', source: 'karev', target: 'vsehb', label: 'Редактор', desc: '1945' },{ id: 'l27', source: 'vins', target: 'sc', label: 'Секретарь', desc: '1965' },
];

export const MAP_AREAS: MapArea[] = [
  { id: 'country-643', label: 'Россия', color: '#d4a857', nodes: ['root', 'spb', 'vseh', 'vsehb', 'rsehb', 'sc', 'pashkov', 'prokhanov', 'kargel', 'zhidkov', 'kryuchkov'], left: 57, top: 31, width: 54, height: 34, rotate: -8, kind: 'country' },
  { id: 'country-804', label: 'Украина', color: '#f0a830', nodes: ['ukr', 'vsb', 'mazaev', 'kargel'], left: 26, top: 56, width: 18, height: 11, rotate: -10, kind: 'country' },
  { id: 'country-268', label: 'Грузия', color: '#00c8c8', nodes: ['trans', 'voronin', 'pavlov', 'kargel'], left: 44, top: 67, width: 12, height: 8, rotate: -8, kind: 'country' },
  { id: 'country-276', label: 'Германия', color: '#8b4dff', nodes: ['vseh', 'pavlov', 'kargel'], left: 10, top: 48, width: 12, height: 9, rotate: 2, kind: 'country' },
];

export const COUNTRY_FOCUS: Record<string, { id: string; label: string; color: string; nodes: string[] }> = {
  '643': { id: 'country-643', label: 'Россия', color: '#d4a857', nodes: ['root', 'spb', 'vseh', 'vsehb', 'rsehb', 'sc', 'pashkov', 'prokhanov', 'kargel', 'zhidkov', 'kryuchkov', 'redstock', 'karev', 'vins'] },
  '804': { id: 'country-804', label: 'Украина', color: '#f0a830', nodes: ['ukr', 'vsb', 'mazaev', 'kargel', 'weiler', 'tsymbal'] },
  '268': { id: 'country-268', label: 'Грузия', color: '#00c8c8', nodes: ['trans', 'voronin', 'pavlov', 'kargel', 'kalweit'] },
  '276': { id: 'country-276', label: 'Германия', color: '#8b4dff', nodes: ['vseh', 'pavlov', 'kargel', 'kalweit', 'redstock'] },
  '398': { id: 'country-398', label: 'Казахстан', color: '#aab0d5', nodes: ['sc', 'kryuchkov'] },
  '792': { id: 'country-792', label: 'Турция', color: '#aab0d5', nodes: ['trans'] },
};

export const CITY_MARKERS: CityMarker[] = [
  { id: 'city-Санкт-Петербург', label: 'Санкт-Петербург', lon: 30.3, lat: 59.9, color: '#ff64b4', nodes: ['spb', 'pashkov', 'prokhanov', 'kargel', 'vseh', 'redstock'] },
  { id: 'city-Москва', label: 'Москва', lon: 37.6, lat: 55.8, color: '#d4a857', nodes: ['root', 'vsehb', 'rsehb', 'sc', 'zhidkov', 'kryuchkov', 'karev'] },
  { id: 'city-Ново-Васильевка', label: 'Ново-Васильевка', lon: 36.2, lat: 47.1, color: '#f0a830', nodes: ['ukr', 'vsb', 'mazaev', 'weiler', 'tsymbal'] },
  { id: 'city-Тифлис (Тбилиси)', label: 'Тифлис (Тбилиси)', lon: 44.8, lat: 41.7, color: '#00c8c8', nodes: ['trans', 'voronin', 'pavlov', 'kalweit'] },
  { id: 'city-Гамбург', label: 'Гамбург', lon: 10.0, lat: 53.5, color: '#8b4dff', nodes: ['vseh', 'pavlov', 'kargel', 'kalweit'] },
];

export const ROUTE_PRESETS: RoutePreset[] = [
  { id: 'route-origins', label: 'Три истока', color: '#d4a857', nodes: ['root', 'spb', 'trans', 'ukr', 'vseh', 'vsb', 'vsehb'], linkIds: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8'], focus: 'root', summary: 'Петербург, Закавказье и Южная Украина сходятся в единую историю ЕХБ.' },
  { id: 'route-tiflis', label: 'Тифлис', color: '#00c8c8', nodes: ['trans', 'voronin', 'pavlov', 'kalweit', 'kargel', 'vsb'], linkIds: ['l2', 'l5', 'l11', 'l12', 'l18', 'l22'], focus: 'trans', summary: 'Кальвейт, Воронин, Павлов и Каргель показывают тифлисскую линию.' },
  { id: 'route-ukraine', label: 'Украина', color: '#f0a830', nodes: ['ukr', 'weiler', 'tsymbal', 'mazaev', 'kargel', 'vsb'], linkIds: ['l3', 'l6', 'l14', 'l19', 'l24', 'l25'], focus: 'ukr', summary: 'Южная сеть: чтение Писания, Цимбал, Вилер, Мазаев и будущая союзная форма.' },
  { id: 'route-petersburg', label: 'Петербург', color: '#ff64b4', nodes: ['spb', 'redstock', 'pashkov', 'kargel', 'prokhanov', 'vseh'], linkIds: ['l1', 'l4', 'l15', 'l16', 'l17', 'l23'], focus: 'spb', summary: 'Петербургское пробуждение: Редсток, Пашков, Каргель и Проханов.' },
  { id: 'route-soviet', label: 'Советский период', color: '#ff4b6e', nodes: ['vsehb', 'zhidkov', 'karev', 'sc', 'kryuchkov', 'vins', 'rsehb'], linkIds: ['l9', 'l10', 'l20', 'l21', 'l26', 'l27'], focus: 'vsehb', summary: 'ВСЕХБ, раскол, Совет Церквей и постсоветская реорганизация.' },
];

export const ANCHORS: Record<string, { x: number; y: number; z: number; strength: number }> = {
  root: { x: 0, y: 2, z: 0, strength: 0.026 }, spb: { x: -58, y: 54, z: 12, strength: 0.019 }, vseh: { x: 78, y: 40, z: 10, strength: 0.017 }, trans: { x: 78, y: -8, z: 10, strength: 0.017 }, ukr: { x: -66, y: -14, z: 8, strength: 0.017 }, vsb: { x: 0, y: -66, z: 2, strength: 0.017 }, vsehb: { x: 16, y: -2, z: 4, strength: 0.016 }, sc: { x: -24, y: -98, z: -8, strength: 0.013 }, rsehb: { x: 60, y: -86, z: -8, strength: 0.013 }, voronin: { x: 100, y: -20, z: -18, strength: 0.011 }, pashkov: { x: -106, y: 78, z: -18, strength: 0.011 }, pavlov: { x: 106, y: -66, z: -18, strength: 0.011 }, mazaev: { x: -104, y: -64, z: -18, strength: 0.011 }, prokhanov: { x: 106, y: 74, z: -18, strength: 0.011 }, kargel: { x: -94, y: 14, z: -20, strength: 0.011 }, zhidkov: { x: 92, y: -102, z: -16, strength: 0.011 }, kryuchkov: { x: -58, y: -120, z: -16, strength: 0.011 }, kalweit: { x: 116, y: 10, z: -18, strength: 0.011 }, redstock: { x: -120, y: 90, z: -20, strength: 0.011 }, weiler: { x: -118, y: -28, z: -18, strength: 0.011 }, tsymbal: { x: -112, y: -86, z: -16, strength: 0.011 }, karev: { x: 112, y: -80, z: -18, strength: 0.011 }, vins: { x: -92, y: -130, z: -18, strength: 0.011 },
};
