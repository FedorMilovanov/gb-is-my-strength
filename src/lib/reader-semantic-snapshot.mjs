/**
 * Reader Semantic Snapshot v1 — source-owned, read-only adapter.
 *
 * Converts the existing, validated Scripture occurrence index into immutable
 * per-route evidence for any explicitly approved Reader article. Does NOT parse
 * Bible references, scan a new prose grammar, infer DOM coordinates, or
 * publish verse text. The existing source index / Bible reference core remain
 * authoritative. A source witness is not a clickable DOM occurrence.
 *
 * No UI or storage ownership here: W57 desktop, mobile Product Reader,
 * Library and Marginalia may consume this model only after parity acceptance.
 */
const EXCLUDED_ROUTE = /^\/(?:nagornaya|updates|journal|news|g3)(?:\/|$)/;
const SAFE_ROUTE = /^\/(?:[A-Za-z0-9._~!$&'()+,;=:@%\-]+\/)*$/u;

export const READER_SEMANTIC_SNAPSHOT_VERSION = 1;

export function normalizeReaderSemanticRoute(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value.startsWith('/') || value.startsWith('//') || /[?#\s\\]/u.test(value)) return null;
  const route = value.endsWith('/') ? value : value + '/';
  if (!SAFE_ROUTE.test(route) || route.includes('/../') || route.includes('/./')) return null;
  return route;
}

function frozenRouteResult(route, status, mentions = [], rejected = 0) {
  const ids = new Set(mentions.map(item => item.canonical.id));
  const owners = new Set(mentions.map(item => item.provenance.sourceOwner));
  const result = {
    version: READER_SEMANTIC_SNAPSHOT_VERSION,
    route,
    status,
    scope: 'entire-source-article',
    // DOM counterpart and a specific section must be verified separately.
    section: null,
    counts: Object.freeze({
      sourceWitnesses: mentions.length,
      uniqueCanonicalReferences: ids.size,
      distinctSourceOwners: owners.size,
      rejectedIncompleteWitnesses: rejected,
      verifiedDomOccurrences: 0,
    }),
    mentions: Object.freeze(mentions),
    // This is NEVER a statement that the article contains no Bible mentions.
    domParity: 'not-measured',
    browserNavigation: 'not-authorized',
  };
  return Object.freeze(result);
}

export function buildReaderSemanticSnapshot({
  route,
  referenceIndex,
  eligibleRoutes,
} = {}) {
  const normalized = normalizeReaderSemanticRoute(route);
  if (!normalized) return frozenRouteResult(null, 'invalid-route');
  if (EXCLUDED_ROUTE.test(normalized)) return frozenRouteResult(normalized, 'excluded-owner');
  // The caller must supply an explicit, inspected route allowlist. Mere source
  // index membership or a broad /articles/ prefix must never enable a Reader.
  if (!(eligibleRoutes instanceof Set) || !eligibleRoutes.has(normalized))
    return frozenRouteResult(normalized, 'unapproved-route');
  if (!referenceIndex || referenceIndex.schemaVersion !== 1 ||
      !Array.isArray(referenceIndex.references))
    return frozenRouteResult(normalized, 'index-unavailable');

  const mentions = [];
  let rejected = 0;
  for (const ref of referenceIndex.references) {
    if (!ref || typeof ref.id !== 'string' ||
        typeof ref.bookId !== 'string' || typeof ref.key !== 'string' ||
        !Array.isArray(ref.occurrences)) continue;
    for (const occurrence of ref.occurrences) {
      if (normalizeReaderSemanticRoute(occurrence?.url) !== normalized) continue;
      const raw = typeof occurrence.raw === 'string' ? occurrence.raw.trim() : '';
      const sourceOwner = typeof occurrence.sourceOwner === 'string'
        ? occurrence.sourceOwner.trim() : '';
      if (!raw || !sourceOwner) {
        rejected++;
        continue;
      }
      // Ordinal is a transient audit index, NOT a persistent annotation ID.
      // Index entries may coalesce exact duplicate mentions and may be
      // reordered by a new publication; offsets/DOM anchors are unknown.
      const canonical = Object.freeze({
        id: ref.id,
        bookId: ref.bookId,
        key: ref.key,
        kind: typeof ref.kind === 'string' ? ref.kind : 'unspecified',
        label: typeof ref.label === 'string' ? ref.label : ref.id,
      });
      const provenance = Object.freeze({
        sourceOwner,
        sourceKind: typeof occurrence.sourceKind === 'string' ? occurrence.sourceKind : null,
        originalRaw: raw,
        // Index anchor has NOT been verified against the actual DOM.
        indexAnchorUnverified: typeof occurrence.anchor === 'string'
          ? occurrence.anchor : null,
        excerpt: typeof occurrence.context === 'string' ? occurrence.context : '',
      });
      mentions.push(Object.freeze({
        ordinal: mentions.length,
        canonical,
        provenance,
        verifiedSection: null,
        verifiedDomPosition: null,
        rangeSelector: null,
        canNavigateToOccurrence: false,
        confidence: 'source-index-only',
      }));
    }
  }
  return frozenRouteResult(normalized,
    mentions.length ? 'source-indexed-unresolved' : 'source-index-empty-unverified',
    mentions, rejected);
}
