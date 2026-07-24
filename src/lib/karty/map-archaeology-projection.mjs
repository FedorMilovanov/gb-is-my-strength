const ACCEPTED_STATUSES = new Set(['accepted-context', 'primary-identification']);
const POSITIVE_EVIDENCE_USES = new Set(['high', 'supporting']);
const INTERPRETATION_USES = new Set(['interpretation']);
const NEGATIVE_EVIDENCE_USES = new Set(['negative']);

const unique = (values) => [...new Set((values || []).filter(Boolean))];

export function buildMapArchaeologyProjection(mapId, registry, provenance) {
  if (!registry || !Array.isArray(registry.sources) || !Array.isArray(registry.claims)) {
    throw new Error('invalid archaeology source registry');
  }
  if (!provenance || !provenance.records || typeof provenance.records !== 'object') {
    throw new Error('invalid archaeology provenance registry');
  }

  const sources = new Map(registry.sources.map((source) => [source.id, source]));
  const sourceMeta = {};
  const byPlace = {};

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

  for (const claim of registry.claims.filter((item) => item.map === mapId)) {
    const evidenceIds = unique(claim.evidenceSources);
    const interpretationIds = unique(claim.interpretationSources);
    const accepted = ACCEPTED_STATUSES.has(claim.status);

    const governedEvidence = evidenceIds.filter((id) => {
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

    const governedInterpretation = interpretationIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      return Boolean(source && record
        && source.status === 'active'
        && INTERPRETATION_USES.has(record.evidenceUse));
    });

    if (accepted && governedEvidence.length === 0) continue;
    if (claim.status === 'candidate' && governedEvidence.length === 0) continue;

    const sourceIds = unique([...governedEvidence, ...governedInterpretation]);
    sourceIds.forEach(exposeSource);

    const card = Object.freeze({
      claimId: claim.id,
      status: claim.status,
      statement: claim.statement,
      limitations: claim.limitations || '',
      evidenceSourceIds: Object.freeze(governedEvidence),
      interpretationSourceIds: Object.freeze(governedInterpretation),
    });

    for (const placeId of unique(claim.places)) {
      if (!byPlace[placeId]) byPlace[placeId] = [];
      byPlace[placeId].push(card);
    }
  }

  for (const placeId of Object.keys(byPlace)) Object.freeze(byPlace[placeId]);

  return Object.freeze({
    schemaVersion: '1.0.0',
    mapId,
    allowedTabs: Object.freeze(['arch', 'sci']),
    byPlace: Object.freeze(byPlace),
    sourceMeta: Object.freeze(sourceMeta),
  });
}
