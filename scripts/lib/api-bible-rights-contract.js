'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ARCHITECTURE_REL = 'docs/API-BIBLE-RIGHTS-ARCHITECTURE-2026-09-06.md';
const RIGHTS_STATUSES = new Set(['disabled', 'metadata-only', 'api-render', 'api-render-with-cache']);
const SEARCH_MODES = new Set(['disabled', 'api-backed']);
const ENABLED_RIGHTS_STATUSES = new Set(['api-render', 'api-render-with-cache']);
const FORBIDDEN_SECRET_FIELDS = ['apiKey', 'apiKeyValue', 'authorization', 'token', 'secret'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createDisabledApiBibleEdition(metadata = {}) {
  return {
    provider: 'api.bible',
    apiBibleId: typeof metadata.apiBibleId === 'string' ? metadata.apiBibleId : '',
    language: typeof metadata.language === 'string' ? metadata.language : '',
    displayName: typeof metadata.displayName === 'string' ? metadata.displayName : '',
    abbreviation: typeof metadata.abbreviation === 'string' ? metadata.abbreviation : '',
    copyrightNotice: typeof metadata.copyrightNotice === 'string' ? metadata.copyrightNotice : '',
    attribution: typeof metadata.attribution === 'string' ? metadata.attribution : '',
    ...(typeof metadata.sourceUrl === 'string' ? { sourceUrl: metadata.sourceUrl } : {}),
    rightsStatus: 'disabled',
    searchMode: 'disabled',
    cacheMaxAgeDays: null,
    publicCorpusRedistribution: false,
    publicFullTextIndex: false,
    verifiedAt: typeof metadata.verifiedAt === 'string' ? metadata.verifiedAt : '',
    evidenceScope: typeof metadata.evidenceScope === 'string' ? metadata.evidenceScope : '',
  };
}

function validateApiBibleEditionRights(edition) {
  const problems = [];

  if (!edition || typeof edition !== 'object' || Array.isArray(edition)) {
    return ['API.Bible edition metadata must be an object'];
  }

  if (edition.provider !== 'api.bible') problems.push("provider must be 'api.bible'");
  if (!RIGHTS_STATUSES.has(edition.rightsStatus)) problems.push('rightsStatus must be explicit and recognized');
  if (!SEARCH_MODES.has(edition.searchMode)) problems.push('searchMode must be disabled or api-backed');
  if (edition.publicCorpusRedistribution !== false) problems.push('publicCorpusRedistribution must remain false');
  if (edition.publicFullTextIndex !== false) problems.push('publicFullTextIndex must remain false');

  for (const field of FORBIDDEN_SECRET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(edition, field) && edition[field] != null && edition[field] !== '') {
      problems.push(`secret-bearing field is forbidden in public edition metadata: ${field}`);
    }
  }

  const isEnabled = ENABLED_RIGHTS_STATUSES.has(edition.rightsStatus);
  if (isEnabled) {
    for (const field of [
      'apiBibleId',
      'language',
      'displayName',
      'abbreviation',
      'copyrightNotice',
      'attribution',
      'verifiedAt',
      'evidenceScope',
    ]) {
      if (!isNonEmptyString(edition[field])) problems.push(`enabled edition requires ${field}`);
    }
  }

  if (edition.rightsStatus === 'api-render-with-cache') {
    if (!Number.isInteger(edition.cacheMaxAgeDays) || edition.cacheMaxAgeDays < 1 || edition.cacheMaxAgeDays > 30) {
      problems.push('api-render-with-cache requires integer cacheMaxAgeDays between 1 and 30');
    }
  } else if (edition.cacheMaxAgeDays !== null) {
    problems.push('cacheMaxAgeDays must be null unless rightsStatus is api-render-with-cache');
  }

  if (!isEnabled && edition.searchMode !== 'disabled') {
    problems.push('disabled or metadata-only editions must keep searchMode disabled');
  }

  return problems;
}

function validateArchitectureReceipt(receipt) {
  const problems = [];
  for (const marker of [
    'Tracking issue: #1753',
    'cacheMaxAgeDays <= 30',
    'publicCorpusRedistribution: false',
    'publicFullTextIndex: false',
    'rightsStatus = disabled',
    'searchMode = disabled',
    'Tests must use synthetic or clearly redistributable fixtures',
    'the first implementation PR must reference this contract and #1753',
  ]) {
    if (!receipt.includes(marker)) problems.push(`API.Bible architecture receipt missing required marker: ${marker}`);
  }
  return problems;
}

function runMutationSelfCheck() {
  const disabled = createDisabledApiBibleEdition();
  if (validateApiBibleEditionRights(disabled).length !== 0) {
    throw new Error('valid fail-closed API.Bible default fixture was rejected');
  }

  const enabled = {
    provider: 'api.bible',
    apiBibleId: 'synthetic-rus-demo',
    language: 'Russian',
    displayName: 'Synthetic Russian Fixture',
    abbreviation: 'SYN',
    copyrightNotice: 'Synthetic fixture only',
    attribution: 'Synthetic fixture only; no Scripture text',
    rightsStatus: 'api-render-with-cache',
    searchMode: 'api-backed',
    cacheMaxAgeDays: 30,
    publicCorpusRedistribution: false,
    publicFullTextIndex: false,
    verifiedAt: '2026-09-06',
    evidenceScope: 'synthetic validation fixture',
  };
  if (validateApiBibleEditionRights(enabled).length !== 0) {
    throw new Error('valid synthetic enabled API.Bible fixture was rejected');
  }

  const missingId = { ...enabled, apiBibleId: '' };
  if (!validateApiBibleEditionRights(missingId).some((problem) => problem.includes('apiBibleId'))) {
    throw new Error('enabled edition without exact apiBibleId was not rejected');
  }

  const staleCache = { ...enabled, cacheMaxAgeDays: 31 };
  if (!validateApiBibleEditionRights(staleCache).some((problem) => problem.includes('between 1 and 30'))) {
    throw new Error('cache TTL above 30 days was not rejected');
  }

  const localSearch = { ...enabled, searchMode: 'local-full-text' };
  if (!validateApiBibleEditionRights(localSearch).some((problem) => problem.includes('searchMode'))) {
    throw new Error('local protected full-text search mode was not rejected');
  }

  const redistributed = { ...enabled, publicCorpusRedistribution: true };
  if (!validateApiBibleEditionRights(redistributed).some((problem) => problem.includes('publicCorpusRedistribution'))) {
    throw new Error('public protected-corpus redistribution was not rejected');
  }

  const secretBearing = { ...disabled, apiKey: 'synthetic-placeholder' };
  if (!validateApiBibleEditionRights(secretBearing).some((problem) => problem.includes('apiKey'))) {
    throw new Error('secret-bearing public metadata was not rejected');
  }

  const disabledSearch = { ...disabled, searchMode: 'api-backed' };
  if (!validateApiBibleEditionRights(disabledSearch).some((problem) => problem.includes('keep searchMode disabled'))) {
    throw new Error('disabled edition with active search was not rejected');
  }
}

function assertApiBibleRightsContract() {
  runMutationSelfCheck();

  const architecturePath = path.join(ROOT, ARCHITECTURE_REL);
  if (!fs.existsSync(architecturePath)) throw new Error(`API.Bible rights architecture missing: ${ARCHITECTURE_REL}`);

  const receiptProblems = validateArchitectureReceipt(fs.readFileSync(architecturePath, 'utf8'));
  if (receiptProblems.length) {
    throw new Error(`API.Bible rights architecture contract failed:\n- ${receiptProblems.join('\n- ')}`);
  }

  console.log('✅ API.Bible edition metadata defaults remain fail-closed and rights-bounded');
}

module.exports = {
  assertApiBibleRightsContract,
  createDisabledApiBibleEdition,
  validateApiBibleEditionRights,
};
