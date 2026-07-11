/**
 * layout-l1.mjs — раскладки уровня L1 «Ветвь» (развёртка кластера).
 *
 * L1 — то, во что раскрывается сжатая группа L0 при зуме/клике (семантический зум,
 * engine-contract §2). Первая реализация — «12 колен Израиля» радиально вокруг Иакова
 * (как референс 06): центр = Иаков, 12 сыновей по кругу в порядке рождения, Иуда
 * (мессианская линия) и Левий (священство) — акцентированы.
 *
 * Детерминированная геометрия (без Date/random). Вход движка Phase 3 (build/layout-l1/*).
 */

// Канонический порядок рождения 12 сыновей + мать (Быт 29–30, 35).
const TRIBE_ORDER = [
  { key: 'Reuben@Gen.29.32',   order: 1,  mother: 'Лия' },
  { key: 'Simeon@Gen.29.33',   order: 2,  mother: 'Лия' },
  { key: 'Levi@Gen.29.34',     order: 3,  mother: 'Лия',    priestly: true },
  { key: 'Judah@Gen.29.35',    order: 4,  mother: 'Лия',    messianic: true },
  { key: 'Dan@Gen.30.6',       order: 5,  mother: 'Валла' },
  { key: 'Naphtali@Gen.30.8',  order: 6,  mother: 'Валла' },
  { key: 'Gad@Gen.30.11',      order: 7,  mother: 'Зелфа' },
  { key: 'Asher@Gen.30.13',    order: 8,  mother: 'Зелфа' },
  { key: 'Issachar@Gen.30.18', order: 9,  mother: 'Лия' },
  { key: 'Zebulun@Gen.30.20',  order: 10, mother: 'Лия' },
  { key: 'Joseph@Gen.30.24',   order: 11, mother: 'Рахиль' },
  { key: 'Benjamin@Gen.35.18', order: 12, mother: 'Рахиль' },
];

const G = {
  centerW: 190, centerH: 74,
  sonW: 156, sonH: 62,
  radius: 372,
};

export function buildTribes12(persons) {
  const byKey = new Map(persons.map(p => [p.key, p]));
  const jacob = byKey.get('Israel@Gen.25.26');

  const sons = TRIBE_ORDER.map((t, i) => {
    const p = byKey.get(t.key);
    // старт сверху (-90°), по часовой стрелке
    const angle = -Math.PI / 2 + (i / TRIBE_ORDER.length) * Math.PI * 2;
    const cxs = Math.cos(angle) * G.radius, cys = Math.sin(angle) * G.radius;
    return {
      id: p?.id ?? t.key, key: t.key,
      name: p?.ru?.name ?? t.key.split('@')[0],
      ref: p?.firstRef?.ru ?? null,
      order: t.order, mother: t.mother,
      messianic: !!t.messianic, priestly: !!t.priestly,
      angle,
      x: cxs - G.sonW / 2, y: cys - G.sonH / 2, w: G.sonW, h: G.sonH,
      cx: cxs, cy: cys,
    };
  });

  const center = {
    id: jacob?.id ?? 'israel', key: 'Israel@Gen.25.26',
    name: jacob?.ru?.name ?? 'Иаков', subtitle: 'Израиль',
    x: -G.centerW / 2, y: -G.centerH / 2, w: G.centerW, h: G.centerH,
  };

  const R = G.radius + Math.max(G.sonW, G.sonH);
  const bbox = { x: -R - 40, y: -R - 40, w: (R + 40) * 2, h: (R + 40) * 2 };

  return {
    _status: 'phase1-draft: L1 развёртка кластера «12 колен» (радиально). Вход движка Phase 3.',
    clusterId: 'tribes-12',
    title: '12 колен Израиля',
    subtitle: 'Потомки Иакова · родоначальники колен',
    center, sons, bbox,
    // мессианская подсказка: через Иуду → … → Христос
    messianicNote: 'Через Иуду — Мессия (Быт 49:10)',
    priestlyNote: 'Левий — священство (Числ 3)',
  };
}
