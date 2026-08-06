#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'data/reference-transfer-contracts.json');
const POLICY_PATH = path.join(ROOT, 'docs/REFERENCE_TRANSFER_POLICY.md');
const ALLOWED_MODES = new Set([
  'exact-replica',
  'adaptive-approved',
  'native-contract',
  'legacy-preserve',
  'performance-target',
  'inventory',
]);
const ALLOWED_STATUSES = new Set(['active', 'advisory', 'planned', 'retired']);
const BLOCKING_MODES = new Set(['exact-replica', 'adaptive-approved', 'native-contract', 'legacy-preserve']);

const problems = [];
const warnings = [];

function ok(message) {
  console.log(`✅ ${message}`);
}

function problem(message) {
  problems.push(message);
  console.error(`❌ ${message}`);
}

function warning(message) {
  warnings.push(message);
  console.log(`ℹ️ ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    problem(`${path.relative(ROOT, file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function isRepoRelative(value) {
  if (typeof value !== 'string' || !value.trim() || path.isAbsolute(value)) return false;
  const normalized = value.replaceAll('\\', '/');
  return !normalized.split('/').includes('..');
}

function uniqueStrings(values, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    problem(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
    return [];
  }
  const normalized = values.map((value) => typeof value === 'string' ? value.trim() : '');
  if (normalized.some((value) => !value)) problem(`${label} must contain only non-empty strings`);
  if (new Set(normalized).size !== normalized.length) problem(`${label} must not contain duplicates`);
  return normalized;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function markerFailure(contract, message) {
  if (contract.blocking) problem(`${contract.id}: ${message}`);
  else warning(`${contract.id}: ${message}`);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  problem('missing data/reference-transfer-contracts.json');
}
if (!fs.existsSync(POLICY_PATH)) {
  problem('missing docs/REFERENCE_TRANSFER_POLICY.md');
}

const manifest = fs.existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : null;

if (manifest) {
  if (manifest.version !== 1) problem(`manifest version must be 1, got ${JSON.stringify(manifest.version)}`);
  const policy = manifest.policy || {};
  const maxBlocking = Number(policy.maxBlockingContracts);
  const maxGuards = Number(policy.maxDelegatedGuardsPerContract);
  const maxMarkers = Number(policy.maxMarkersPerKindPerFile);

  if (policy.defaultEnforcement !== 'advisory') problem('policy.defaultEnforcement must remain advisory');
  if (policy.automaticHtmlTokenHarvest !== false) problem('automaticHtmlTokenHarvest must remain false');
  if (policy.newContractsStartAdvisory !== true) problem('newContractsStartAdvisory must remain true');
  if (policy.exactReplicaRequiresSnapshotDigest !== true) problem('exactReplicaRequiresSnapshotDigest must remain true');
  if (!Number.isInteger(maxBlocking) || maxBlocking < 1 || maxBlocking > 12) problem('maxBlockingContracts must be an integer from 1 to 12');
  if (!Number.isInteger(maxGuards) || maxGuards < 1 || maxGuards > 4) problem('maxDelegatedGuardsPerContract must be an integer from 1 to 4');
  if (!Number.isInteger(maxMarkers) || maxMarkers < 1 || maxMarkers > 20) problem('maxMarkersPerKindPerFile must be an integer from 1 to 20');

  const contracts = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  if (contracts.length === 0) problem('manifest.contracts must be non-empty');

  const ids = new Set();
  let blockingCount = 0;

  for (const contract of contracts) {
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      problem('every contract must be an object');
      continue;
    }

    const id = typeof contract.id === 'string' ? contract.id.trim() : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) problem(`invalid contract id: ${JSON.stringify(contract.id)}`);
    if (ids.has(id)) problem(`duplicate contract id: ${id}`);
    ids.add(id);

    if (!ALLOWED_MODES.has(contract.mode)) problem(`${id}: unsupported mode ${JSON.stringify(contract.mode)}`);
    if (!ALLOWED_STATUSES.has(contract.status)) problem(`${id}: unsupported status ${JSON.stringify(contract.status)}`);
    if (typeof contract.blocking !== 'boolean') problem(`${id}: blocking must be boolean`);
    if (contract.blocking) blockingCount += 1;

    if (contract.blocking && !BLOCKING_MODES.has(contract.mode)) {
      problem(`${id}: ${contract.mode} entries must not block Product work`);
    }
    if (contract.status === 'planned' && contract.blocking) problem(`${id}: planned entries must be non-blocking`);
    if (contract.status === 'retired' && contract.blocking) problem(`${id}: retired entries must be non-blocking`);

    if (typeof contract.title !== 'string' || contract.title.trim().length < 8) problem(`${id}: title is too short`);
    if (typeof contract.referenceEvidence !== 'string' || contract.referenceEvidence.trim().length < 12) {
      problem(`${id}: referenceEvidence must identify a durable source`);
    }
    if (typeof contract.ownerDecision !== 'string' || contract.ownerDecision.trim().length < 40) {
      problem(`${id}: ownerDecision must explain the bounded intent`);
    }

    uniqueStrings(contract.routes, `${id}.routes`);
    const watchPaths = uniqueStrings(contract.watchPaths, `${id}.watchPaths`);
    for (const watchPath of watchPaths) {
      if (!isRepoRelative(watchPath)) problem(`${id}: invalid repository-relative watch path ${JSON.stringify(watchPath)}`);
    }

    const guards = contract.delegatedGuards === undefined
      ? []
      : uniqueStrings(contract.delegatedGuards, `${id}.delegatedGuards`, { allowEmpty: true });
    if (Number.isFinite(maxGuards) && guards.length > maxGuards) {
      problem(`${id}: ${guards.length} delegated guards exceed policy maximum ${maxGuards}`);
    }
    for (const guard of guards) {
      if (!isRepoRelative(guard)) {
        problem(`${id}: invalid guard path ${JSON.stringify(guard)}`);
        continue;
      }
      const absolute = path.resolve(ROOT, guard);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) problem(`${id}: delegated guard does not exist: ${guard}`);
    }

    const markerChecks = contract.markerChecks === undefined ? [] : contract.markerChecks;
    if (!Array.isArray(markerChecks)) {
      problem(`${id}.markerChecks must be an array`);
    } else {
      for (const [index, check] of markerChecks.entries()) {
        if (!check || typeof check !== 'object' || Array.isArray(check)) {
          problem(`${id}.markerChecks[${index}] must be an object`);
          continue;
        }
        if (!isRepoRelative(check.path)) {
          problem(`${id}.markerChecks[${index}].path must be repository-relative`);
          continue;
        }
        const required = uniqueStrings(check.required || [], `${id}.markerChecks[${index}].required`, { allowEmpty: true });
        const forbidden = uniqueStrings(check.forbidden || [], `${id}.markerChecks[${index}].forbidden`, { allowEmpty: true });
        const ordered = uniqueStrings(check.ordered || [], `${id}.markerChecks[${index}].ordered`, { allowEmpty: true });
        if (Number.isFinite(maxMarkers) && (required.length > maxMarkers || forbidden.length > maxMarkers)) {
          problem(`${id}: marker count exceeds policy maximum ${maxMarkers}`);
        }
        const absolute = path.resolve(ROOT, check.path);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
          markerFailure(contract, `marker target does not exist: ${check.path}`);
          continue;
        }
        const source = fs.readFileSync(absolute, 'utf8');
        for (const marker of required) {
          if (!source.includes(marker)) markerFailure(contract, `${check.path} missing required marker ${JSON.stringify(marker)}`);
        }
        for (const marker of forbidden) {
          if (source.includes(marker)) markerFailure(contract, `${check.path} contains forbidden marker ${JSON.stringify(marker)}`);
        }
        let previous = -1;
        for (const marker of ordered) {
          const position = source.indexOf(marker);
          if (position === -1) {
            markerFailure(contract, `${check.path} missing ordered marker ${JSON.stringify(marker)}`);
            break;
          }
          if (position <= previous) {
            markerFailure(contract, `${check.path} violates required marker order at ${JSON.stringify(marker)}`);
            break;
          }
          previous = position;
        }
      }
    }

    if (contract.mode === 'exact-replica') {
      if (!contract.blocking || contract.status !== 'active') problem(`${id}: exact-replica must be active and blocking`);
      const snapshot = contract.referenceSnapshot;
      if (!snapshot || !isRepoRelative(snapshot.path) || !/^[a-f0-9]{64}$/.test(snapshot.sha256 || '')) {
        problem(`${id}: exact-replica requires referenceSnapshot.path and a 64-character SHA-256 digest`);
      } else {
        const absolute = path.resolve(ROOT, snapshot.path);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) problem(`${id}: reference snapshot does not exist: ${snapshot.path}`);
        else if (sha256(absolute) !== snapshot.sha256) problem(`${id}: reference snapshot digest mismatch: ${snapshot.path}`);
      }
      if (!Array.isArray(markerChecks) || markerChecks.length === 0) problem(`${id}: exact-replica requires explicit markerChecks`);
    }

    if (contract.mode === 'adaptive-approved') {
      const deviations = uniqueStrings(contract.allowedDeviations, `${id}.allowedDeviations`);
      if (deviations.length === 0) problem(`${id}: adaptive-approved requires at least one explicit allowed deviation`);
    }

    if (contract.mode === 'legacy-preserve') {
      if (typeof contract.doNotModernizeReason !== 'string' || contract.doNotModernizeReason.trim().length < 40) {
        problem(`${id}: legacy-preserve requires doNotModernizeReason`);
      }
    }

    if (contract.blocking && guards.length === 0 && (!Array.isArray(markerChecks) || markerChecks.length === 0)) {
      problem(`${id}: blocking contract must delegate to an existing guard or own a bounded marker check`);
    }
  }

  if (Number.isFinite(maxBlocking) && blockingCount > maxBlocking) {
    problem(`${blockingCount} blocking contracts exceed policy maximum ${maxBlocking}`);
  }

  if (problems.length === 0) {
    ok(`${contracts.length} reference contracts are structurally valid`);
    ok(`${blockingCount}/${maxBlocking} blocking-contract budget used`);
    ok('automatic HTML token harvesting remains disabled');
  }
}

console.log('\nREFERENCE TRANSFER CONTRACTS');
console.log(`Warnings: ${warnings.length}`);
if (problems.length) {
  console.error(`❌ ${problems.length} blocking problem(s)`);
  process.exit(1);
}
console.log('✅ Reference transfer policy passed');
