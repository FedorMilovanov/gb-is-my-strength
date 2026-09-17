import {
  capitalizedTokens,
  normalizeRuCandidate,
  similarity,
  translitEnRu,
} from './ru-extract.mjs';

/**
 * Certify only Russian labels that are directly witnessed in the pinned
 * Synodal verse selected by the extractor. No cross-person propagation is
 * allowed here: every decision must stand on its own textual evidence.
 */
export function directSynodalRussianNameProof(person, synodal) {
  const ru = person?.ru;
  if (!ru?.review || !ru.name || !ru.verseRef) return null;
  if (!['candidate', 'pattern'].includes(ru.source)) return null;

  const text = synodal.verse(ru.verseRef);
  if (!text) return null;
  const tokens = capitalizedTokens(text).map(item => item.token);
  if (!tokens.length) return null;

  const evidenceForm = ru.verseForm ?? ru.name;
  if (!tokens.includes(evidenceForm)) return null;
  if (normalizeRuCandidate(person.en, evidenceForm) !== ru.name) return null;

  // Pattern extraction is frequently inflected. Require the extractor to
  // have preserved a distinct source form before trusting normalization.
  if (ru.source === 'pattern' && !ru.verseForm) return null;

  const approximation = translitEnRu(person.en);
  const scored = tokens
    .map(token => ({ token, score: similarity(approximation, token) }))
    .sort((a, b) => b.score - a.score || a.token.localeCompare(b.token, 'ru'));
  const target = scored.find(row => row.token === evidenceForm);
  if (!target || target.score < 0.72) return null;

  const competitor = scored.find(row => row.token !== evidenceForm);
  const margin = target.score - (competitor?.score ?? 0);
  if (margin < 0.08 && target.score < 0.95) return null;

  return {
    authority: 'pinned-synodal-local-token',
    proof: ru.verseForm ? 'synodal-local-normalized' : 'synodal-local-exact',
    verseRef: ru.verseRef,
    verseForm: evidenceForm,
    canonical: ru.name,
    lexicalScore: Number(target.score.toFixed(4)),
    margin: Number(margin.toFixed(4)),
  };
}
