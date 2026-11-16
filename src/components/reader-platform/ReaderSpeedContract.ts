/**
 * Canonical reader speed scale. Single authoring source for both
 * standalone-article and series mobile selectors.
 *
 * Interaction state, TTS and persisted preference consumers are separate;
 * this is the shared display contract, not another audio engine.
 */
export const READER_SPEED_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
