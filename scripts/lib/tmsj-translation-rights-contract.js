'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_REL = 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro';
const RECEIPT_REL = 'docs/TMSJ-TRANSLATION-RIGHTS.md';
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const OFFICIAL_SOURCE = 'https://tms.edu/wp-content/uploads/2021/09/TMSJ-Volume-27-Number-2.pdf';
const CURRENT_GRANT_MARKER = 'Русский перевод этой статьи публикуется с разрешения TMS Journal.';
const NARROW_SCOPE_MARKER = 'Разрешение относится к данной публикации и не распространяется автоматически на другие материалы TMSJ.';
const STALE_PROVISIONAL_PATTERNS = [
  /в ознакомительных целях/i,
  /по (?:запросу|требованию) правообладателя будет удал[её]н/i,
];

function validateTmsjRightsContract(source, receipt) {
  const problems = [];

  if (!source.includes(CURRENT_GRANT_MARKER)) {
    problems.push('current TMS Journal permission marker is missing from the public source owner');
  }
  if (!source.includes(NARROW_SCOPE_MARKER)) {
    problems.push('current-publication-only permission boundary is missing from the public source owner');
  }
  for (const pattern of STALE_PROVISIONAL_PATTERNS) {
    if (pattern.test(source)) problems.push(`stale provisional rights wording remains in public source: ${pattern}`);
  }

  for (const marker of [
    ROUTE,
    OFFICIAL_SOURCE,
    '2026-08-20',
    'current Russian translation',
    'does not automatically authorize additional TMSJ translations',
    'Future TMSJ translation work remains fail-closed',
  ]) {
    if (!receipt.includes(marker)) problems.push(`rights receipt missing required boundary/evidence marker: ${marker}`);
  }

  return problems;
}

function runMutationSelfCheck() {
  const validSource = `${CURRENT_GRANT_MARKER}\n${NARROW_SCOPE_MARKER}`;
  const validReceipt = [
    ROUTE,
    OFFICIAL_SOURCE,
    '2026-08-20',
    'current Russian translation',
    'does not automatically authorize additional TMSJ translations',
    'Future TMSJ translation work remains fail-closed',
  ].join('\n');

  if (validateTmsjRightsContract(validSource, validReceipt).length !== 0) {
    throw new Error('valid TMSJ rights fixture was rejected');
  }

  const stale = `${validSource}\nМатериал публикуется в ознакомительных целях; по требованию правообладателя будет удалён.`;
  if (validateTmsjRightsContract(stale, validReceipt).length < 2) {
    throw new Error('stale provisional-rights fixture was not rejected');
  }

  const broad = CURRENT_GRANT_MARKER;
  if (!validateTmsjRightsContract(broad, validReceipt).some((problem) => problem.includes('current-publication-only'))) {
    throw new Error('over-broad current-grant fixture was not rejected');
  }

  const missingReceiptBoundary = validReceipt.replace('does not automatically authorize additional TMSJ translations', '');
  if (!validateTmsjRightsContract(validSource, missingReceiptBoundary).some((problem) => problem.includes('additional TMSJ translations'))) {
    throw new Error('future-translation boundary mutation was not rejected');
  }
}

function assertTmsjTranslationRightsContract() {
  runMutationSelfCheck();

  const sourcePath = path.join(ROOT, SOURCE_REL);
  const receiptPath = path.join(ROOT, RECEIPT_REL);
  if (!fs.existsSync(sourcePath)) throw new Error(`TMSJ rights source owner missing: ${SOURCE_REL}`);
  if (!fs.existsSync(receiptPath)) throw new Error(`TMSJ rights receipt missing: ${RECEIPT_REL}`);

  const problems = validateTmsjRightsContract(
    fs.readFileSync(sourcePath, 'utf8'),
    fs.readFileSync(receiptPath, 'utf8'),
  );
  if (problems.length) {
    throw new Error(`TMSJ translation rights contract failed:\n- ${problems.join('\n- ')}`);
  }

  console.log('✅ TMSJ current-translation permission and future-work boundary are explicit');
}

module.exports = {
  assertTmsjTranslationRightsContract,
  validateTmsjRightsContract,
};
