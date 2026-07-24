const ACCEPTED_STATUSES = new Set(['accepted-context', 'primary-identification']);
const POSITIVE_EVIDENCE_USES = new Set(['high', 'supporting']);
const INTERPRETATION_USES = new Set(['interpretation']);
const NEGATIVE_EVIDENCE_USES = new Set(['negative']);
const unique = (values) => [...new Set((values || []).filter(Boolean))];

export function buildMapArchaeologyProjection(mapId, registry, provenance) {
  if (!mapId || typeof mapId !== 'string') throw new Error('mapId is required');
  if (!registry || !Array.isArray(registry.sources) || !Array.isArray(registry.claims)) {
    throw new Error('invalid archaeology source registry');
  }
  if (!provenance || !provenance.records || typeof provenance.records !== 'object') {
    throw new Error('invalid archaeology provenance registry');
  }

  const sources = new Map(registry.sources.map((source) => [source.id, source]));
  const sourceMeta = {};
  const byPlace = {};
  const mapCards = [];
  const categories = (registry.runtimeCategories || []).filter((category) =>
    Array.isArray(category.mapScopes) && category.mapScopes.includes(mapId));
  const categoryClaimIds = new Set(categories.flatMap((category) => category.claimIds || []));

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

  const claims = registry.claims.filter((claim) => claim.map === mapId || categoryClaimIds.has(claim.id));
  for (const claim of claims) {
    const evidenceIds = unique(claim.evidenceSources);
    const interpretationIds = unique(claim.interpretationSources);
    const accepted = ACCEPTED_STATUSES.has(claim.status);

    const governedEvidence = evidenceIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      if (!source || !record) return false;
      if (source.status === 'retracted') return !accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse);
      if (source.status !== 'active' || source.verification !== 'verified') return false;
      return POSITIVE_EVIDENCE_USES.has(record.evidenceUse)
        || (!accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse));
    });

    const governedInterpretation = interpretationIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      return Boolean(source && record && source.status === 'active' && INTERPRETATION_USES.has(record.evidenceUse));
    });

    if (accepted && governedEvidence.length === 0) continue;
    if (claim.status === 'candidate' && governedEvidence.length === 0) continue;
    if (claim.status === 'project-interpretation' && governedInterpretation.length === 0) continue;

    unique([...governedEvidence, ...governedInterpretation]).forEach(exposeSource);
    const card = Object.freeze({
      claimId: claim.id,
      category: claim.category || null,
      status: claim.status,
      statement: claim.statement,
      limitations: claim.limitations || '',
      topics: Object.freeze(unique(claim.topics)),
      evidenceSourceIds: Object.freeze(governedEvidence),
      interpretationSourceIds: Object.freeze(governedInterpretation),
    });

    const places = unique(claim.places);
    if (places.length === 0) mapCards.push(card);
    for (const placeId of places) {
      if (!byPlace[placeId]) byPlace[placeId] = [];
      byPlace[placeId].push(card);
    }
  }

  for (const placeId of Object.keys(byPlace)) Object.freeze(byPlace[placeId]);
  return Object.freeze({
    schemaVersion: '1.1.0',
    mapId,
    runtimeCategoryIds: Object.freeze(categories.map((category) => category.id)),
    allowedTabs: Object.freeze(['arch', 'sci']),
    mapCards: Object.freeze(mapCards),
    byPlace: Object.freeze(byPlace),
    sourceMeta: Object.freeze(sourceMeta),
  });
}
