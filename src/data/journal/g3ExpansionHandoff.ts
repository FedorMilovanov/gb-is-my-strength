/** Separate adopted extension; the original #628/history and crisis seals remain immutable.
 * Two text projections, the selected catalogue matrix, annual finance and one metadata correction
 * are activated in the integration candidate. Release gates remain separate.
 */
export const G3_EXPANSION_HANDOFF = {
  researchHandoffUrl: 'https://github.com/FedorMilovanov/Research/blob/f49d20d31931ec389690b3033cefbb66cda67522/G3_HISTORY/PRODUCT_HANDOFF_G3_EXPANSION_BOUNDED_2026-11-24.md',
  evidenceCommit: '1c51adbfaf34dd2bd96dc89525dfc105080a3d0a',
  adoptedClaimIds: ["G3-HIST-PUB-10","G3-HIST-PUB-11","G3-HIST-PUB-12","G3-PUB-017"],
  activeTextClaimIds: ['G3-HIST-PUB-10', 'G3-HIST-PUB-11'],
  activeComponentClaimIds: ['G3-HIST-PUB-12', 'G3-PUB-017'],
  pendingComponentClaimIds: [],
  metadataCorrectionId: 'G3-BIB-CORR-2026-11-24-01',
  rights: 'TEXTUAL_PARAPHRASE_LINK_AND_ORIGINAL_DATA_GRAPHICS_ONLY',
} as const;
