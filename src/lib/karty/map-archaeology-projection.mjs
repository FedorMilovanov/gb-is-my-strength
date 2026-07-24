const ACCEPTED_STATUSES = new Set(['accepted-context', 'primary-identification']);
const POSITIVE_EVIDENCE_USES = new Set(['high', 'supporting']);
const INTERPRETATION_USES = new Set(['interpretation']);
const NEGATIVE_EVIDENCE_USES = new Set(['negative']);

const unique = (values) => [...new Set((values || []).filter(Boolean))];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function categoryApplies(category, mapId, profile) {
  if (!category || !category.id) return false;
  return (category.mapScopes || []).includes(mapId)
    || (profile.categoryIds || []).includes(category.id);
}

function governedTargets(claim, categoryIds, profile) {
  const targetIds = new Set(unique(claim.places));
  const claimPlaces = asObject(profile.claimPlaces);
  const topicPlaces = asObject(profile.topicPlaces);
  const categoryPlaces = asObject(profile.categoryPlaces);

  unique(claimPlaces[claim.id]).forEach((id) => targetIds.add(id));
  unique(claim.topics).forEach((topic) => {
    unique(topicPlaces[topic]).forEach((id) => targetIds.add(id));
  });
  unique(categoryIds).forEach((categoryId) => {
    unique(categoryPlaces[categoryId]).forEach((id) => targetIds.add(id));
  });

  const allowed = new Set(unique(profile.routePlaceIds));
  return [...targetIds].filter((id) => allowed.size === 0 || allowed.has(id));
}

export function buildMapArchaeologyProjection(mapId, registry, provenance, routeProfile = {}) {
  if (!mapId || typeof mapId !== 'string') throw new Error('mapId is required');
  if (!registry || !Array.isArray(registry.sources) || !Array.isArray(registry.claims)) {
    throw new Error('invalid archaeology source registry');
  }
  if (!provenance || !provenance.records || typeof provenance.records !== 'object') {
    throw new Error('invalid archaeology provenance registry');
  }

  const profile = asObject(routeProfile);
  const sources = new Map(registry.sources.map((source) => [source.id, source]));
  const claims = new Map(registry.claims.map((claim) => [claim.id, claim]));
  const selectedCategories = (registry.runtimeCategories || [])
    .filter((category) => categoryApplies(category, mapId, profile));
  const categoryById = new Map(selectedCategories.map((category) => [category.id, category]));
  const claimInputs = new Map();
  const sourceMeta = {};
  const byPlace = {};

  function includeClaim(claim, category = null) {
    if (!claim || !claim.id) return;
    const current = claimInputs.get(claim.id) || {
      claim,
      categoryIds: new Set(),
      categorySourceIds: new Set(),
    };
    if (category) {
      current.categoryIds.add(category.id);
      unique(category.sourceIds).forEach((id) => current.categorySourceIds.add(id));
    }
    claimInputs.set(claim.id, current);
  }

  registry.claims.filter((claim) => claim.map === mapId).forEach((claim) => includeClaim(claim));
  selectedCategories.forEach((category) => {
    unique(category.claimIds).forEach((claimId) => includeClaim(claims.get(claimId), category));
  });

  function exposeSource(id) {
    if (sourceMeta[id]) return sourceMeta[id];
    const source = sources.get(id);
    const record = provenance.records[id];
    if (!source || !record) throw new Error(`missing source/provenance pair: ${id}`);
    sourceMeta[id] = Object.freeze({
      id,
      title: source.title,
      organization: source.organization,
      url: record.canonicalUrl || source.url || '',
      year: record.publicationYear,
      accessedAt: record.accessedAt || source.accessedAt || source.verifiedAt || null,
      status: source.status,
      verification: source.verification,
      evidenceUse: record.evidenceUse,
      perspective: record.perspective,
      workType: record.workType,
      review: record.review,
    });
    return sourceMeta[id];
  }

  for (const input of claimInputs.values()) {
    const { claim } = input;
    const accepted = ACCEPTED_STATUSES.has(claim.status);
    const categorySourceIds = [...input.categorySourceIds];
    const evidenceCandidates = unique([...claim.evidenceSources || [], ...categorySourceIds]);
    const interpretationCandidates = unique([...claim.interpretationSources || [], ...categorySourceIds]);

    const governedEvidence = evidenceCandidates.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      if (!source || !record) return false;
      if (source.status === 'retracted') {
        return !accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse);
      }
      if (source.status !== 'active' || source.verification !== 'verified') return false;
      return POSITIVE_EVIDENCE_USES.has(record.evidenceUse)
        || (!accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse));
    });

    const governedInterpretation = interpretationCandidates.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      return Boolean(source && record
        && source.status === 'active'
        && source.verification === 'verified'
        && INTERPRETATION_USES.has(record.evidenceUse));
    });

    if (accepted && governedEvidence.length === 0) continue;
    if (claim.status === 'candidate' && governedEvidence.length === 0) continue;
    if (claim.status === 'rejected' && !governedEvidence.some((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      return source?.status === 'retracted' || record?.evidenceUse === 'negative';
    })) continue;

    const placeIds = governedTargets(claim, [...input.categoryIds], profile);
    if (placeIds.length === 0) continue;

    const sourceIds = unique([...governedEvidence, ...governedInterpretation]);
    sourceIds.forEach(exposeSource);

    const card = Object.freeze({
      claimId: claim.id,
      categoryIds: Object.freeze([...input.categoryIds]),
      status: claim.status,
      statement: claim.statement,
      limitations: claim.limitations || '',
      evidenceSourceIds: Object.freeze(governedEvidence),
      interpretationSourceIds: Object.freeze(governedInterpretation),
    });

    placeIds.forEach((placeId) => {
      if (!byPlace[placeId]) byPlace[placeId] = [];
      byPlace[placeId].push(card);
    });
  }

  for (const placeId of Object.keys(byPlace)) Object.freeze(byPlace[placeId]);

  return Object.freeze({
    schemaVersion: '2.0.0',
    mapId,
    allowedTabs: Object.freeze(['arch', 'sci']),
    categories: Object.freeze([...categoryById.values()].map((category) => Object.freeze({
      id: category.id,
      label: category.label,
      mapScopes: Object.freeze(unique(category.mapScopes)),
    }))),
    byPlace: Object.freeze(byPlace),
    sourceMeta: Object.freeze(sourceMeta),
  });
}
