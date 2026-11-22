/**
 * Standalone G3 history manuscript is NOT a published route.
 * A new signed Research handoff is mandatory before routing or indexation.
 */
export const G3_HISTORY_DRAFT_METADATA = {
  title: 'G3 Ministries: от конференции к служению',
  description: 'История G3 в 2013–2024 годах: церковь Pray’s Mill, выступления известных проповедников, богословские споры, издательство и региональные конференции.',
  proposedCanonical: 'https://gospod-bog.ru/journal/dossiers/g3/history/',
  publicationStatus: 'PUBLICATION_HOLD',
  researchPr: 'https://github.com/FedorMilovanov/Research/pull/582',
  approvalClaimIds: ['G3-HIST-PUB-01', 'G3-HIST-PUB-02', 'G3-HIST-PUB-03', 'G3-HIST-PUB-04', 'G3-HIST-PUB-05', 'G3-HIST-PUB-06', 'G3-HIST-PUB-07', 'G3-HIST-PUB-08', 'G3-HIST-PUB-09'],
  // Draft body ≈ 1,350 words at 200 wpm; the bibliography is a reference appendix.
  readingTimeMinutesEstimate: 7,
  readingTimeBasis: 'draft-body-estimate-excludes-bibliography',
} as const;
