/**
 * spine.mjs — золотой мессианский хребет (Адам → … → Христос) и якорный слой L0.
 *
 * Хребет — постоянный слой генеалогии (ZMLT-persistent): узлы, видимые на всех уровнях
 * зума. Извлекается ИЗ ДАННЫХ (не хардкодом списка имён), затем сверяется с
 * каноническим ожиданием — это одновременно валидатор связности графа: если Адам
 * не достигается от Христа по отцовским рёбрам, данные разорваны.
 *
 * Эта проекция НЕ является буквальной последовательностью Лк 3:23–38.
 * Переход Христос → Мария → Илий — предпочитаемая редакционная гармонизация:
 * Лк 3:23 прямо называет Иосифа и Илия, но не называет Марию дочерью Илия.
 * Поэтому хребет обязан нести явную provenance-модель и не может использоваться
 * как Scripture Fact Graph без interpretation overlay.
 */

/** id мессии и корня по ключам TIPNR (стабильны). */
export const SPINE_ENDPOINTS = { messiahKey: 'Jesus@Isa.7.14', rootKey: 'Adam@Gen.2.19' };

export const SPINE_PROVENANCE = Object.freeze({
  kind: 'interpretive-projection',
  assertion: 'editorial-harmonization',
  confidence: 'disputed',
  editorialPosition: 'preferred',
  directScripture: false,
  refs: ['Мф 1:16', 'Лк 3:23–38'],
  note: 'Переход Иисус → Мария → Илий используется как предпочитаемая гармонизация. Лк 3:23 не называет Марию дочерью Илия.',
});

/** Крупные вехи-якоря, которые обязаны лежать на хребте (сверка полноты). */
export const SPINE_ANCHOR_KEYS = [
  'Adam@Gen.2.19', 'Seth@Gen.4.25', 'Noah@Gen.5.29', 'Shem@Gen.5.32',
  'Abraham@Gen.11.26', 'Isaac@Gen.17.19', 'Israel@Gen.25.26', 'Judah@Gen.29.35',
  'David@Rut.4.17', 'Jesus@Isa.7.14',
];

/**
 * Прослеживает хребет от мессии вверх по «первичному» родителю:
 * для Христа — мать (Мария) как interpretation overlay, далее — отец каждого.
 * @param persons — эмитнутые персоны ({id, key, ru})
 * @param edges — эмитнутые рёбра
 * @returns { chain:[{id,key,ru}], reachedRoot:boolean, missingAnchors:[], length }
 */
export function traceSpine(persons, edges) {
  const byId = new Map(persons.map(p => [p.id, p]));
  const byKey = new Map(persons.map(p => [p.key, p]));

  const fatherOf = new Map();
  const motherOf = new Map();
  for (const e of edges) {
    if (e.kind !== 'parent' && e.kind !== 'ancestor') continue;
    if (e.role === 'father') fatherOf.set(e.to, e.from);
    else if (e.role === 'mother') motherOf.set(e.to, e.from);
  }

  const messiah = byKey.get(SPINE_ENDPOINTS.messiahKey);
  const root = byKey.get(SPINE_ENDPOINTS.rootKey);
  if (!messiah || !root) {
    return { chain: [], reachedRoot: false, missingAnchors: SPINE_ANCHOR_KEYS, length: 0, error: 'endpoints missing' };
  }

  const chain = [];
  const guard = new Set();
  let cur = messiah.id;
  let first = true;
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const p = byId.get(cur);
    if (p) chain.push({ id: p.id, key: p.key, ru: p.ru?.name ?? null });
    // Христос → мать как редакционная гармонизация; дальше — отец
    const next = first ? (motherOf.get(cur) ?? fatherOf.get(cur)) : fatherOf.get(cur);
    first = false;
    cur = next;
  }

  const chainKeys = new Set(chain.map(c => c.key));
  const reachedRoot = chainKeys.has(SPINE_ENDPOINTS.rootKey);
  const missingAnchors = SPINE_ANCHOR_KEYS.filter(k => !chainKeys.has(k));

  return { model: SPINE_PROVENANCE, chain, reachedRoot, missingAnchors, length: chain.length };
}
