/**
 * icons.mjs — набор инлайновых SVG-эмблем для узлов «Генеалогии Спасителя».
 *
 * Каждая иконка — внутренняя разметка symbol'а в системе координат 0 0 24 24,
 * рисуется штрихом `currentColor` (цвет задаёт <use> через `color`/`stroke`),
 * читаемая на ~18-22px. Стиль — тонкая золотая линия, как на референсах владельца.
 * Всё self-hosted (CSP): никаких внешних ассетов.
 */

// Общие атрибуты штриха задаются на <use>/<g>; пути — только геометрия.
export const ICON_SYMBOLS = {
  // Человек: голова + плечи
  person: `<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>`,
  // Двое (группа/род)
  people: `<circle cx="8.5" cy="8.6" r="2.7"/><circle cx="15.8" cy="9.2" r="2.3"/><path d="M3.5 18.5c0-2.9 2.2-4.9 5-4.9 1.4 0 2.6.5 3.5 1.3"/><path d="M12.6 18.5c.2-2.4 2-4 4.2-4 2.3 0 4.1 1.8 4.1 4.4"/>`,
  // Ковчег: корпус-лодка + надстройка
  ark: `<path d="M3 12.5c1.6 3 5 4.7 9 4.7s7.4-1.7 9-4.7"/><path d="M6.2 12.4V8.8h11.6v3.6"/><path d="M9.4 8.8V6.4h5.2v2.4"/><path d="M12 6.4V4.6"/>`,
  // Шатёр патриархов: треугольник с центральной опорой и входом
  tent: `<path d="M3 18.5 12 4l9 14.5"/><path d="M12 4v14.5"/><path d="M9.6 18.5c.3-2 1.1-3.4 2.4-3.4s2.1 1.4 2.4 3.4"/>`,
  // Лестница Иакова
  ladder: `<path d="M8 3.5 6.5 20.5M16 3.5 17.5 20.5"/><path d="M7.3 7.5h9.1M7.1 11.2h9.5M6.9 14.9h9.9"/>`,
  // Лев Иуды: маскулинная морда с гривой и ушами (без лучей — не «солнце»)
  lion: `<circle cx="8.7" cy="8" r="1.7"/><circle cx="15.3" cy="8" r="1.7"/><circle cx="12" cy="12.6" r="6"/><circle cx="12" cy="13" r="3.7"/><circle cx="10.4" cy="12.3" r=".62" fill="currentColor" stroke="none"/><circle cx="13.6" cy="12.3" r=".62" fill="currentColor" stroke="none"/><path d="M12 13.8v1.2M10.8 15.1c.75.55 1.65.55 2.4 0"/><path d="M8.9 10.4c.5-.45 1.2-.45 1.7 0M13.4 10.4c.5-.45 1.2-.45 1.7 0"/>`,
  // Корона царя
  crown: `<path d="M4 16.5 3 7l5 4 4-6.5 4 6.5 5-4-1 9.5z"/><path d="M4 16.5h16"/>`,
  // Крест Спасителя (лучистый добавляется отдельным слоем)
  cross: `<path d="M12 3.2v17.6M6.6 9.2h10.8"/>`,
  // Древо (лого/сотворение)
  tree: `<path d="M12 21v-6"/><path d="M12 15c-3.6 0-5.4-2.3-5.4-4.8 0-1 .4-2 .9-2.6-.3-.6-.4-1.3-.2-2 .8.1 1.5.5 2 1.1.6-1 1.6-1.9 2.7-1.9s2.1.9 2.7 1.9c.5-.6 1.2-1 2-1.1.2.7.1 1.4-.2 2 .5.6.9 1.6.9 2.6C17.4 12.7 15.6 15 12 15z"/>`,
  // Свиток
  scroll: `<path d="M7 5.5h10.5v11a2.5 2.5 0 0 1-2.5 2.5H6.5"/><path d="M9.5 9h5.5M9.5 12h5.5"/><path d="M7 5.5A2 2 0 0 0 5 7.5 2 2 0 0 0 7 9.5M6.5 19a2.2 2.2 0 0 0 2.2-2.2V7.5"/>`,
  // Книга (Евангелия)
  book: `<path d="M12 6.2v13"/><path d="M12 6.2C10.4 5 8.4 4.6 5.5 4.6v12.6c2.9 0 4.9.4 6.5 1.6 1.6-1.2 3.6-1.6 6.5-1.6V4.6c-2.9 0-4.9.4-6.5 1.6z"/>`,
  // Храм/священство: фронтон на колоннах
  temple: `<path d="M3.5 8 12 3.5 20.5 8z"/><path d="M4.5 8v8.5M9 8v8.5M15 8v8.5M19.5 8v8.5"/><path d="M3 20h18M3.5 16.5h17"/>`,
  // Менора левитов (7 ветвей)
  menorah: `<path d="M12 5v13"/><path d="M8 8v2.5M16 8v2.5M5.5 9.5v3M18.5 9.5v3"/><path d="M8 10.5c0 1.5-2.5 1.5-2.5 0M16 10.5c0 1.5 2.5 1.5 2.5 0"/><path d="M8.5 18h7"/>`,
  // Верблюд измаильтян (упрощён: горбы+шея)
  camel: `<path d="M4 17.5v-2.3c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.4.8.5-1.9 1.3-3.4 2.4-3.4 1 0 1.7 1.1 2.2 2.6.5-1 1.2-1.7 2.1-1.7 1.4 0 2.3 1.6 2.3 3.8v3.4"/><path d="M18 17.5v-4.2c0-.7.3-1.3.9-1.3"/><path d="M6.5 17.5v1.8M9.5 17.5v1.8M13.5 17.5v1.8M16.5 17.5v1.8"/>`,
  // Гора (Едом)
  mountain: `<path d="M2.5 18.5 9 8l3.2 4.8L15 8.5l6.5 10z"/><path d="M7.4 10.4 9 8l1.6 2.4"/>`,
  // Врата возвращения из плена
  gate: `<path d="M5 20V9a7 7 0 0 1 14 0v11"/><path d="M5 20h14"/><path d="M9 20v-7a3 3 0 0 1 6 0v7"/>`,
  // 12 колен: знамя/сетка
  tribes: `<path d="M6 4h12v13l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11h6"/>`,
  // Народы: земной круг с сеткой
  globe: `<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8v16.4"/><path d="M12 3.8c2.6 2.3 4 5.2 4 8.2s-1.4 5.9-4 8.2c-2.6-2.3-4-5.2-4-8.2s1.4-5.9 4-8.2z"/>`,
};

/** Персона-якорь (ключ TIPNR) → иконка. */
export const ANCHOR_ICON = {
  'Adam@Gen.2.19': 'person',
  'Noah@Gen.5.29': 'ark',
  'Shem@Gen.5.32': 'person',
  'Abraham@Gen.11.26': 'tent',
  'Isaac@Gen.17.19': 'person',
  'Israel@Gen.25.26': 'ladder',
  'Judah@Gen.29.35': 'lion',
  'David@Rut.4.17': 'crown',
  'Solomon@2Sa.5.14': 'temple',
  'Jesus@Isa.7.14': 'cross',
};

/** Кластер → иконка. */
export const CLUSTER_ICON = {
  'antediluvian-patriarchs': 'scroll',
  'nations-of-noah': 'globe',
  'abraham-descendants': 'tent',
  'ishmaelites': 'camel',
  'esau-edom': 'mountain',
  'tribes-12': 'tribes',
  'levites': 'menorah',
  'priests': 'temple',
  'house-of-david': 'crown',
  'return-from-exile': 'gate',
  'matthew-1': 'book',
  'luke-3': 'scroll',
  'lords-relatives': 'people',
  'disciples-apostles': 'people',
};

/** Курируемые подзаголовки якорей (курсив под именем, как на референсе). */
export const ANCHOR_SUBTITLE = {
  'Israel@Gen.25.26': 'Израиль',
  'Judah@Gen.29.35': 'Лев от Иуды',
  'David@Rut.4.17': 'Царь',
  'Jesus@Isa.7.14': 'Мессия',
};

/** Собрать <defs><symbol>… для всех иконок. */
export function iconSymbolDefs() {
  return Object.entries(ICON_SYMBOLS)
    .map(([id, inner]) =>
      `<symbol id="ic-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`)
    .join('\n');
}
