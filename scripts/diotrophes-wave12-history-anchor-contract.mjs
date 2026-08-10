#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PRE_WAVE12 = process.env.DIOTROPHES_WAVE12_PRE_WAVE12 ?? '';
const RELEASE_BOUNDARY = process.env.DIOTROPHES_WAVE12_RELEASE_BOUNDARY ?? '';
const HISTORICAL_VALIDATOR = process.env.DIOTROPHES_WAVE12_HISTORICAL_VALIDATOR ?? '';
const HISTORICAL_VALIDATOR_PATH = 'scripts/diotrophes-wave12-release-contract.mjs';
const HISTORICAL_VALIDATOR_BLOB = 'b17f707254ac340d04016a27b1865124d5326864';
const RELEASE_MANIFEST_PATH = 'data/diotrophes-wave12-release-manifest.json';
const ACTIVE_CONTRACTS = [
  '.github/workflows/product-research-release-witness.yml',
  '.github/workflows/diotrophes-wave12-release.yml',
  'scripts/diotrophes-wave12-transaction-scope-contract.mjs',
  'scripts/diotrophes-wave12-release-contract.mjs',
];

const errors = [];
const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
}

function commitExists(sha, label) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`]);
  } catch {
    errors.push(`${label} is not a commit object in the current checkout: ${sha}`);
  }
}

function requireAncestor(older, newer, label) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', older, newer]);
  } catch {
    errors.push(`${label}: ${older} is not an ancestor of ${newer}`);
  }
}

function exactlyOneMatch(source, regex, label) {
  const matches = [...source.matchAll(regex)];
  requireValue(matches.length === 1, `${label}: expected exactly one match, got ${matches.length}`);
  return matches[0];
}

for (const [label, sha] of [
  ['PRE_WAVE12', PRE_WAVE12],
  ['RELEASE_BOUNDARY', RELEASE_BOUNDARY],
  ['HISTORICAL_VALIDATOR', HISTORICAL_VALIDATOR],
]) {
  requireValue(/^[0-9a-f]{40}$/.test(sha), `${label} must be an exact 40-character lowercase SHA`);
}

if (errors.length === 0) {
  commitExists(PRE_WAVE12, 'PRE_WAVE12');
  commitExists(HISTORICAL_VALIDATOR, 'HISTORICAL_VALIDATOR');
  commitExists(RELEASE_BOUNDARY, 'RELEASE_BOUNDARY');
  requireAncestor(PRE_WAVE12, HISTORICAL_VALIDATOR, 'Wave 12 history order');
  requireAncestor(HISTORICAL_VALIDATOR, RELEASE_BOUNDARY, 'Wave 12 history order');
  requireAncestor(RELEASE_BOUNDARY, 'HEAD', 'Wave 12 current-history reachability');
}

let historicalSource = '';
let immutableProductBaseSha = '';
try {
  historicalSource = git(['show', `${HISTORICAL_VALIDATOR}:${HISTORICAL_VALIDATOR_PATH}`]);
  const blob = git(['rev-parse', `${HISTORICAL_VALIDATOR}:${HISTORICAL_VALIDATOR_PATH}`]);
  requireValue(
    blob === HISTORICAL_VALIDATOR_BLOB,
    `historical validator blob drift: ${blob} != ${HISTORICAL_VALIDATOR_BLOB}`
  );
  const match = exactlyOneMatch(
    historicalSource,
    /^const PRE_WAVE12 = '([0-9a-f]{40})';$/gm,
    'historical PRE_WAVE12 provenance'
  );
  immutableProductBaseSha = match?.[1] ?? '';
} catch (error) {
  errors.push(`cannot read pinned historical validator: ${error.stderr?.toString().trim() || error.message}`);
}

if (immutableProductBaseSha) {
  requireValue(
    immutableProductBaseSha !== PRE_WAVE12,
    'history rewrite contract expects immutable provenance and executable PRE_WAVE12 to be distinct identities'
  );
  try {
    const release = JSON.parse(git(['show', `${RELEASE_BOUNDARY}:${RELEASE_MANIFEST_PATH}`]));
    requireValue(
      release.productBaseSha === immutableProductBaseSha,
      `immutable release provenance drift: ${release.productBaseSha} != ${immutableProductBaseSha}`
    );
  } catch (error) {
    errors.push(`cannot validate release manifest at rewritten boundary: ${error.stderr?.toString().trim() || error.message}`);
  }
}

const activeSources = new Map();
for (const file of ACTIVE_CONTRACTS) {
  try {
    activeSources.set(file, readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${file}: cannot read active contract: ${error.message}`);
  }
}

for (const workflow of [
  '.github/workflows/product-research-release-witness.yml',
  '.github/workflows/diotrophes-wave12-release.yml',
]) {
  const source = activeSources.get(workflow) ?? '';
  for (const [name, expected] of [
    ['DIOTROPHES_WAVE12_PRE_WAVE12', PRE_WAVE12],
    ['DIOTROPHES_WAVE12_RELEASE_BOUNDARY', RELEASE_BOUNDARY],
    ['DIOTROPHES_WAVE12_HISTORICAL_VALIDATOR', HISTORICAL_VALIDATOR],
  ]) {
    const match = exactlyOneMatch(
      source,
      new RegExp(`^\\s+${name}: ([0-9a-f]{40})$`, 'gm'),
      `${workflow} ${name}`
    );
    requireValue(match?.[1] === expected, `${workflow} ${name} drift: ${match?.[1]} != ${expected}`);
  }
}

const transactionSource = activeSources.get('scripts/diotrophes-wave12-transaction-scope-contract.mjs') ?? '';
for (const [name, expected] of [
  ['PRE_WAVE12', PRE_WAVE12],
  ['RELEASE_BOUNDARY', RELEASE_BOUNDARY],
]) {
  const match = exactlyOneMatch(
    transactionSource,
    new RegExp(`^const ${name} = '([0-9a-f]{40})';$`, 'gm'),
    `transaction contract ${name}`
  );
  requireValue(match?.[1] === expected, `transaction contract ${name} drift: ${match?.[1]} != ${expected}`);
}

const releaseSource = activeSources.get('scripts/diotrophes-wave12-release-contract.mjs') ?? '';
for (const [name, expected] of [
  ['PRE_WAVE12', PRE_WAVE12],
  ['HISTORICAL_VALIDATOR', HISTORICAL_VALIDATOR],
]) {
  const match = exactlyOneMatch(
    releaseSource,
    new RegExp(`^const ${name} = '([0-9a-f]{40})';$`, 'gm'),
    `current release contract ${name}`
  );
  requireValue(match?.[1] === expected, `current release contract ${name} drift: ${match?.[1]} != ${expected}`);
}

if (immutableProductBaseSha) {
  for (const [file, source] of activeSources) {
    requireValue(
      !source.includes(immutableProductBaseSha),
      `${file}: active contract embeds retired pre-rewrite PRE_WAVE12 identity ${immutableProductBaseSha}`
    );
  }
}

const rebindFlag = '--rebind-historical-validator';
const rebindIndex = process.argv.indexOf(rebindFlag);
if (rebindIndex !== -1) {
  const target = process.argv[rebindIndex + 1];
  requireValue(Boolean(target), `${rebindFlag} requires a target file`);
  if (target && historicalSource && immutableProductBaseSha) {
    try {
      const targetSource = readFileSync(target, 'utf8').trimEnd();
      requireValue(targetSource === historicalSource, 'historical validator temp copy must exactly match pinned immutable source before rebinding');

      const oldDeclaration = `const PRE_WAVE12 = '${immutableProductBaseSha}';`;
      const newDeclaration = `const PRE_WAVE12 = '${PRE_WAVE12}';\nconst IMMUTABLE_PRODUCT_BASE_SHA = '${immutableProductBaseSha}';`;
      const oldManifestAssertion = "requireValue(release.productBaseSha === PRE_WAVE12, 'pre-Wave12 Product base drift');";
      const newManifestAssertion = "requireValue(release.productBaseSha === IMMUTABLE_PRODUCT_BASE_SHA, 'pre-Wave12 Product base drift');";

      requireValue(targetSource.split(oldDeclaration).length === 2, 'historical validator must contain exactly one PRE_WAVE12 declaration');
      requireValue(targetSource.split(oldManifestAssertion).length === 2, 'historical validator must contain exactly one productBaseSha assertion');

      if (errors.length === 0) {
        const rebound = targetSource
          .replace(oldDeclaration, newDeclaration)
          .replace(oldManifestAssertion, newManifestAssertion);
        writeFileSync(target, `${rebound}\n`, 'utf8');
      }
    } catch (error) {
      errors.push(`cannot rebind historical validator temp copy: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(`❌ Wave 12 post-rewrite history anchor contract failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `✅ Wave 12 post-rewrite history anchors passed: PRE=${PRE_WAVE12}, ` +
  `HISTORICAL=${HISTORICAL_VALIDATOR}, BOUNDARY=${RELEASE_BOUNDARY}, ` +
  `immutable provenance=${immutableProductBaseSha}`
);
