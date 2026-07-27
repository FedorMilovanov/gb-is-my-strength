/** Canonical, deterministic relation compiler shared by SSR, Atlas and dist. */
export const RELATION_SCHEMA_VERSION = 1;
export const RELATION_ENGINE_VERSION = '1.0.0';

const type = (direction, label, inverseLabel, articlePriority, defaultWeight, articleVisible = true) =>
  Object.freeze({ direction, label, inverseLabel, articlePriority, defaultWeight, articleVisible });

export const RELATION_TYPES = Object.freeze({
  'series-next': type('directed', 'Следующая часть', 'Предыдущая часть', 0, 100, false),
  'part-of': type('directed', 'Входит в раздел', 'Содержит материал', 30, 55),
  'historical-context': type('directed', 'Исторический контекст', 'Использует этот исторический контекст', 90, 88),
  'methodological-context': type('directed', 'Методологический контекст', 'Применяет этот метод', 86, 84),
  explains: type('directed', 'Объясняет основание', 'Развивает объяснённую тему', 82, 80),
  expands: type('directed', 'Расширяет аргумент', 'Исходная постановка', 78, 76),
  contrasts: type('undirected', 'Сопоставляет позицию', 'Сопоставляет позицию', 74, 72),
  cites: type('directed', 'Использует как источник', 'Цитируется в материале', 68, 66),
  'biography-of': type('directed', 'Биография участника темы', 'Тема раскрывается в биографии', 64, 64),
  'map-of': type('directed', 'Карта событий', 'События показаны на карте', 62, 62),
  'same-topic': type('undirected', 'Связано по теме', 'Связано по теме', 48, 44),
  'recommended-next': type('directed', 'Рекомендуемое продолжение', 'Предшествующий материал', 92, 90),
  related: type('undirected', 'Связанное исследование', 'Связанное исследование', 34, 32),
});

export const GROUP_META = Object.freeze({
  gill: { label: 'Джон Гилл', color: '#c3925a' },
  nagornaya: { label: 'Нагорная проповедь', color: '#d8ae4e' },
  'hard-texts': { label: 'Трудные тексты', color: '#6f9fd3' },
  stand: { label: 'Баптисты России', color: '#4e86bd' },
  'russian-baptism': { label: 'Баптисты России', color: '#4e86bd' },
  karty: { label: 'Библейские карты', color: '#5eb9bd' },
  biografii: { label: 'Биографии служителей', color: '#d68158' },
  'pastor-series': { label: 'Практическое служение', color: '#ce6486' },
  standalone: { label: 'Отдельные исследования', color: '#78aa72' },
  landing: { label: 'Разделы библиотеки', color: '#9a8ac5' },
});

const SERIES_GROUP = Object.freeze({ nagornaya: 'nagornaya', 'dzhon-gill': 'gill', 'hard-texts': 'hard-texts', 'pastor-series': 'pastor-series', 'russian-baptism': 'stand' });
const HUB_IDS = new Set(['biografii', 'hard-texts', 'pastor-series', 'karty']);
const STATUSES = new Set(['verified', 'draft', 'deprecated']);
const GROUP_ORDER = ['gill', 'nagornaya', 'biografii', 'stand', 'hard-texts', 'karty', 'pastor-series', 'standalone', 'landing'];
const ATLAS_ORDER = ['series', 'cluster', 'structure', 'bridge'];
const ATLAS_LABEL = { series: 'Порядок серии', cluster: 'Внутри темы', structure: 'Раздел и материал', bridge: 'Мост между темами' };

export function normalizeUrl(value) {
  let path = String(value || '/').split(/[?#]/)[0].replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  return path.length > 1 && !path.endsWith('/') ? `${path}/` : path || '/';
}

const clean = (value) => String(value || '').trim();
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9а-яё_-]+/giu, '-').replace(/^-+|-+$/g, '') || 'item';
const pairKey = (a, b) => [a, b].sort().join('~');
const semanticKey = (edge) => edge.direction === 'directed' ? `${edge.kind}:${edge.source}>${edge.target}` : `${edge.kind}:${pairKey(edge.source, edge.target)}`;

function atlasGroup(node) {
  if (node.group !== 'landing') return node.group || 'standalone';
  return HUB_IDS.has(node.id) ? node.id : 'landing';
}

function atlasKind(edge, nodes) {
  if (edge.kind === 'series-next') return 'series';
  if (edge.kind === 'part-of') return 'structure';
  return nodes.get(edge.source)?.atlasGroup === nodes.get(edge.target)?.atlasGroup ? 'cluster' : 'bridge';
}

function buildNodes(graphData, seriesData, errors) {
  const nodes = [], byId = new Map(), byUrl = new Map(), seriesPaths = [];
  for (const raw of Array.isArray(graphData?.nodes) ? graphData.nodes : []) {
    const id = clean(raw?.id), title = clean(raw?.title), url = normalizeUrl(raw?.url), group = clean(raw?.group) || 'standalone';
    if (!id || !title || url === '/') { errors.push(`invalid graph node ${id || '<unknown>'}`); continue; }
    if (byId.has(id) || byUrl.has(url)) { errors.push(`duplicate graph node ${id} / ${url}`); continue; }
    const node = { id, title, url, group, atlasGroup: atlasGroup({ id, group }), readingTime: Number(raw?.readingTime) || undefined, cover: clean(raw?.cover) || undefined, desc: clean(raw?.desc) || undefined, tags: Array.isArray(raw?.tags) ? raw.tags.map(clean).filter(Boolean) : [], isHub: group === 'landing' || HUB_IDS.has(id), source: 'graph' };
    nodes.push(node); byId.set(id, node); byUrl.set(url, node);
  }
  for (const [seriesId, series] of Object.entries(seriesData || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const ids = [], group = SERIES_GROUP[seriesId] || 'standalone';
    for (const [index, part] of (Array.isArray(series?.parts) ? series.parts : []).entries()) {
      if (part?.status && part.status !== 'published') continue;
      const partSlug = clean(part?.slug), title = clean(part?.title);
      if (!partSlug || !title) { errors.push(`invalid published part in ${seriesId}`); continue; }
      const url = normalizeUrl(`${series?.baseUrl || '/'}${partSlug}/`);
      let node = byUrl.get(url);
      if (!node) {
        let id = `series-${slug(seriesId)}-${slug(partSlug)}`, n = 2;
        while (byId.has(id)) id = `series-${slug(seriesId)}-${slug(partSlug)}-${n++}`;
        node = { id, title, url, group, atlasGroup: group, readingTime: Number(part?.readingTime) || undefined, desc: `Материал серии «${clean(series?.title) || seriesId}».`, tags: [clean(series?.title) || seriesId, 'серия'], isHub: false, source: 'series-registry' };
        nodes.push(node); byId.set(id, node); byUrl.set(url, node);
      }
      Object.assign(node, { seriesId, seriesTitle: clean(series?.title) || seriesId, seriesIndex: index + 1, atlasGroup: group });
      if (!node.readingTime && Number(part?.readingTime)) node.readingTime = Number(part.readingTime);
      ids.push(node.id);
    }
    if (ids.length > 1) seriesPaths.push({ seriesId, title: clean(series?.title) || seriesId, ids });
  }
  return { nodes, byId, seriesPaths };
}

function relationStore(byId, errors) {
  const edges = [], ids = new Set(), semantics = new Set();
  return {
    edges,
    add(edge) {
      if (!byId.has(edge.source) || !byId.has(edge.target)) { errors.push(`relation ${edge.id} references a missing node`); return false; }
      if (edge.source === edge.target || ids.has(edge.id) || semantics.has(semanticKey(edge))) { errors.push(`duplicate/invalid relation ${edge.id}`); return false; }
      ids.add(edge.id); semantics.add(semanticKey(edge)); edge.atlasKind = atlasKind(edge, byId); edges.push(edge); return true;
    },
  };
}

function compileCatalog(catalogData, store, errors) {
  const explicitPairs = new Set(); let drafts = 0, deprecated = 0;
  for (const raw of Array.isArray(catalogData?.relations) ? catalogData.relations : []) {
    const id = clean(raw?.id), source = clean(raw?.source), target = clean(raw?.target), kind = clean(raw?.kind), status = clean(raw?.editorialStatus) || 'verified', def = RELATION_TYPES[kind];
    if (!id || !source || !target || !def || !STATUSES.has(status)) { errors.push(`invalid catalog relation ${id || '<unknown>'}`); continue; }
    explicitPairs.add(pairKey(source, target));
    if (status === 'draft') { drafts += 1; continue; }
    if (status === 'deprecated') { deprecated += 1; continue; }
    const weight = raw?.weight == null ? def.defaultWeight : Number(raw.weight);
    if (!Number.isFinite(weight) || weight < 1 || weight > 100) { errors.push(`invalid weight in ${id}`); continue; }
    store.add({ id, source, target, kind, direction: def.direction, label: clean(raw?.label) || def.label, inverseLabel: clean(raw?.inverseLabel) || def.inverseLabel, rationale: clean(raw?.rationale), weight, editorialStatus: status, origin: 'catalog' });
  }
  return { explicitPairs, drafts, deprecated };
}

function compileSeries(seriesPaths, store) {
  let count = 0;
  for (const path of seriesPaths) for (let index = 0; index < path.ids.length - 1; index += 1) {
    const def = RELATION_TYPES['series-next'];
    if (store.add({ id: `series:${slug(path.seriesId)}:${String(index + 1).padStart(2, '0')}`, source: path.ids[index], target: path.ids[index + 1], kind: 'series-next', direction: def.direction, label: def.label, inverseLabel: def.inverseLabel, rationale: `Канонический порядок серии «${path.title}».`, weight: def.defaultWeight, editorialStatus: 'verified', origin: 'series-registry' })) count += 1;
  }
  return count;
}

function compileLegacy(graphData, explicitPairs, byId, store, errors) {
  const seen = new Set(); let imported = 0, suppressed = 0;
  for (const raw of Array.isArray(graphData?.edges) ? graphData.edges : []) {
    if (!Array.isArray(raw) || raw.length < 2) continue;
    let source = clean(raw[0]), target = clean(raw[1]); const pair = pairKey(source, target);
    if (!source || !target || source === target || seen.has(pair)) continue;
    seen.add(pair);
    if (explicitPairs.has(pair)) { suppressed += 1; continue; }
    const a = byId.get(source), b = byId.get(target);
    if (!a || !b) { errors.push(`legacy edge ${source} ↔ ${target} references a missing node`); continue; }
    if (a.seriesId && a.seriesId === b.seriesId) { suppressed += 1; continue; }
    let kind = 'related', direction = 'undirected', weight = 26;
    if (a.isHub !== b.isHub) { kind = 'part-of'; direction = 'directed'; weight = 46; if (a.isHub) [source, target] = [target, source]; }
    else if (a.atlasGroup === b.atlasGroup) { kind = 'same-topic'; weight = 34; }
    const def = RELATION_TYPES[kind];
    if (store.add({ id: `legacy:${pair.replace(/~/g, ':')}`, source, target, kind, direction, label: def.label, inverseLabel: def.inverseLabel, rationale: '', weight, editorialStatus: 'verified', origin: 'legacy-import' })) imported += 1;
  }
  return { imported, suppressed };
}

function buildGroups(nodes) {
  const ids = [...new Set(nodes.map((node) => node.atlasGroup || 'standalone'))];
  ids.sort((a, b) => (GROUP_ORDER.indexOf(a) < 0 ? 999 : GROUP_ORDER.indexOf(a)) - (GROUP_ORDER.indexOf(b) < 0 ? 999 : GROUP_ORDER.indexOf(b)) || a.localeCompare(b, 'ru'));
  return ids.map((id) => ({ id, ...(GROUP_META[id] || { label: id, color: '#9a8ac5' }), count: nodes.filter((node) => node.atlasGroup === id).length }));
}

function buildProjections(nodes, edges, byId) {
  const byNode = Object.fromEntries(nodes.map((node) => [node.id, { neighbors: [], article: [] }]));
  const add = (currentId, targetId, edge, orientation) => {
    const current = byId.get(currentId), target = byId.get(targetId); if (!current || !target) return;
    const entry = { edgeId: edge.id, targetId, kind: edge.kind, atlasKind: edge.atlasKind, orientation, label: edge.direction === 'directed' && orientation === 'incoming' ? edge.inverseLabel : edge.label, rationale: edge.rationale, weight: edge.weight, origin: edge.origin };
    byNode[currentId].neighbors.push(entry);
    const def = RELATION_TYPES[edge.kind], sameSeries = current.seriesId && current.seriesId === target.seriesId;
    if (!def.articleVisible || sameSeries || target.url === current.url) return;
    const score = edge.weight * 1000 + def.articlePriority * 100 + (edge.origin === 'catalog' ? 80 : 0) + (edge.rationale ? 60 : 0) + (target.desc ? 25 : 0) + (target.readingTime ? 5 : 0);
    byNode[currentId].article.push({ ...entry, score });
  };
  for (const edge of edges) { add(edge.source, edge.target, edge, 'outgoing'); add(edge.target, edge.source, edge, edge.direction === 'directed' ? 'incoming' : 'undirected'); }
  for (const node of nodes) {
    const projection = byNode[node.id];
    projection.neighbors.sort((a, b) => b.weight - a.weight || a.targetId.localeCompare(b.targetId));
    const best = new Map();
    for (const entry of projection.article) if (!best.has(entry.targetId) || entry.score > best.get(entry.targetId).score) best.set(entry.targetId, entry);
    projection.article = [...best.values()].sort((a, b) => b.score - a.score || byId.get(a.targetId).title.localeCompare(byId.get(b.targetId).title, 'ru')).slice(0, 4);
  }
  return { byNode };
}

export function compileRelations({ graphData = {}, seriesData = {}, catalogData = {}, strict = true } = {}) {
  const errors = [], built = buildNodes(graphData, seriesData, errors), store = relationStore(built.byId, errors);
  const catalog = compileCatalog(catalogData, store, errors), seriesRelations = compileSeries(built.seriesPaths, store), legacy = compileLegacy(graphData, catalog.explicitPairs, built.byId, store, errors);
  if (strict && errors.length) { const error = new Error(`Relation compiler rejected ${errors.length} issue(s):\n- ${errors.join('\n- ')}`); error.issues = errors; throw error; }
  const rank = new Map(GROUP_ORDER.map((id, index) => [id, index]));
  const nodes = built.nodes.slice().sort((a, b) => (rank.get(a.atlasGroup) ?? 999) - (rank.get(b.atlasGroup) ?? 999) || (a.seriesId === b.seriesId ? (a.seriesIndex || 0) - (b.seriesIndex || 0) : 0) || a.title.localeCompare(b.title, 'ru') || a.id.localeCompare(b.id));
  const edges = store.edges.slice().sort((a, b) => ATLAS_ORDER.indexOf(a.atlasKind) - ATLAS_ORDER.indexOf(b.atlasKind) || a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.id.localeCompare(b.id));
  const projections = buildProjections(nodes, edges, built.byId), atlasKinds = Object.fromEntries(ATLAS_ORDER.map((id) => [id, 0])), semanticKinds = {}, origins = {}, degree = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) { atlasKinds[edge.atlasKind] += 1; semanticKinds[edge.kind] = (semanticKinds[edge.kind] || 0) + 1; origins[edge.origin] = (origins[edge.origin] || 0) + 1; degree[edge.source] += 1; degree[edge.target] += 1; }
  const groups = buildGroups(nodes), orphanIds = Object.entries(degree).filter(([, count]) => count === 0).map(([id]) => id);
  return { schemaVersion: RELATION_SCHEMA_VERSION, engineVersion: RELATION_ENGINE_VERSION, nodes, edges, groups, edgeKinds: ATLAS_ORDER.map((id) => ({ id, label: ATLAS_LABEL[id], count: atlasKinds[id] })), projections, relationTypes: RELATION_TYPES, stats: { nodes: nodes.length, edges: edges.length, groups: groups.length, articlePanels: Object.values(projections.byNode).filter((p) => p.article.length).length, orphanNodes: orphanIds.length, orphanIds, atlasKinds, semanticKinds, origins, catalogDrafts: catalog.drafts, catalogDeprecated: catalog.deprecated, seriesRelations, legacyImported: legacy.imported, legacySuppressed: legacy.suppressed, errors } };
}
