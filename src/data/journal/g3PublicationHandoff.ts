export const G3_PUBLICATION_HANDOFF = {
  researchRepo: 'FedorMilovanov/Research',
  researchEvidenceCommit: '893e952de4e7ae617af02aca1344d385abcdf71b',
  researchSealCommit: '298d00ddc4db46522c8ad904016e98a4426c9fcf',
  handoffPath: 'G3_HISTORY/PRODUCT_HANDOFF_G3_DOSSIER_2026-09-09.md',
  publicationDecision: 'PUBLICATION_AUTHORIZED_FOR_PINNED_CLAIM_SET',
  correctionBaseline: 'Research evidence snapshot 893e952de4e7ae617af02aca1344d385abcdf71b plus publication seal 298d00ddc4db46522c8ad904016e98a4426c9fcf',
  productMetadata: {
    readingTimeMinutes: 8,
    readingTimeBasis: 'editorial-estimate',
    librarySection: 'Журнал',
    topicCategory: 'Документальные досье',
  },
  claimIds: [
    'G3-PUB-001', 'G3-PUB-002', 'G3-PUB-003', 'G3-PUB-004',
    'G3-PUB-005', 'G3-PUB-006', 'G3-PUB-007', 'G3-PUB-008',
    'G3-PUB-009', 'G3-PUB-010', 'G3-PUB-011', 'G3-PUB-012',
    'G3-PUB-013', 'G3-PUB-014', 'G3-PUB-015', 'G3-PUB-016',
  ],
  sourceIds: [
    'G3-S001', 'G3-S002', 'G3-S008', 'G3-S009', 'G3-S010', 'G3-S011',
    'G3-S012', 'G3-S015', 'G3-S017', 'G3-S023', 'G3-S024', 'G3-S028',
    'G3-S033', 'G3-S035', 'G3-S042', 'G3-S046', 'G3-S047', 'G3-S050',
    'G3-S053', 'G3-S054', 'G3-S096',
  ],
  excludedClaims: [
    'G3-C003', 'G3-C004', 'G3-C007', 'G3-C014', 'G3-C020', 'G3-C023',
    'G3-C024', 'G3-C025', 'G3-C026', 'G3-C030', 'G3-C033', 'G3-C034',
    'G3-C035', 'G3-C036', 'G3-C041', 'G3-C043', 'G3-C048', 'G3-C057',
    'G3-C062', 'G3-C063', 'G3-C067', 'G3-C068',
    'Q003.crisis_day_continuity', 'Q004.broader_director_mechanics',
    'Q006.named_transferee', 'Q006.completed_closing', 'Q006.transaction_terms',
    'Q006.g3_press_same_transaction', 'Q006A.property_identity', 'Q006A.counterparty',
    'Q006A.note_linkage', 'Q007.item_level_quotes', 'Q008.proven_instance_count',
    'Q009.exact_actor_chain', 'Q010.resignation_mechanics', 'Q011.motive',
    'Q013.quantitative_prevalence', 'Q014.attendance_series', 'Q016.macarthur_intent',
  ],
  knownOpenQuestions: [
    'Точный состав совета G3 в момент позднеавгустовского кризиса 2026 года после архивного снимка 21 июля.',
    'Точная механика ухода и назначения отдельных директоров в 2025 году за пределами подтверждённых президентских дат.',
    'Личность приобретателя G3+, юридическое закрытие сделки, условия и объём передачи G3 Press.',
    'Идентификация недвижимости, контрагент и связь с векселем/receivable по операции FY2022–FY2023.',
    'Точная механика отставок пасторов Pray’s Mill Baptist Church.',
    'Поэпизодная человеческая проверка аудио, издания источника и контекста атрибуции в деле Tom Buck.',
    'Точная цепочка отправителей анонимных почтовых пакетов и мотив.',
    'Количественные доли/тренды политико-культурного контента и сопоставимая хронология посещаемости.',
    'Первичные артефакты эпизода MacArthur 2021 и вопрос намерения.',
  ],
  mediaDecisions: {
    buckMachineTranscripts: 'PRIVATE_STUDY_ONLY / NOT_QUOTE_SAFE / DO_NOT_PUBLISH',
    buckDossier: 'PRIVATE_STUDY_ONLY / DO_NOT_REPRODUCE / allegation_object_only',
    fourPastorLetter: 'ATTRIBUTED_PARAPHRASE_ONLY unless original body becomes directly controlled',
    g3PlusSubscriberScreenshot: 'RESEARCH_EVIDENCE_ONLY pending privacy/rights clearance',
    publicRecords: 'FACTUAL_EXTRACTION_ALLOWED_WITH_CITATION_AND_NO_OVERCLAIM',
    thirdPartyImages: 'NO_REUSE_AUTHORIZATION_IMPLIED',
  },
} as const;

export type G3PublicationClaimId = (typeof G3_PUBLICATION_HANDOFF.claimIds)[number];

const allowedClaims = new Set<string>(G3_PUBLICATION_HANDOFF.claimIds);
const excludedClaims = new Set<string>(G3_PUBLICATION_HANDOFF.excludedClaims);

export function assertG3PublicationProjection(claimId: string): asserts claimId is G3PublicationClaimId {
  if (excludedClaims.has(claimId) || !allowedClaims.has(claimId)) {
    throw new Error(`G3 publication claim is not authorized by immutable Research handoff: ${claimId}`);
  }
}

export function researchSnapshotShort(): string {
  return G3_PUBLICATION_HANDOFF.researchSealCommit.slice(0, 12);
}
