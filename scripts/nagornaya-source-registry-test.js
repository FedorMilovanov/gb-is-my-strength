#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data/nagornaya/source-registry.json');
const SCHEMA_PATH = path.join(ROOT, 'data/nagornaya/source-registry.schema.json');
const COMPONENT_PATH = path.join(ROOT, 'src/components/nagornaya/istochniki/NagornayaIstochnikiMainShell.astro');
const VISUAL_WORKFLOW_PATH = path.join(ROOT, '.github/workflows/visual-parity.yml');

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const component = fs.readFileSync(COMPONENT_PATH, 'utf8');
const visualWorkflow = fs.readFileSync(VISUAL_WORKFLOW_PATH, 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return new Set(values).size === values.length;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function sameMembers(left, right) {
  return [...left].sort().join('\n') === [...right].sort().join('\n');
}

function validateRecordShape(record, definition, label, problems) {
  const required = definition.required || [];
  const allowed = new Set(Object.keys(definition.properties || {}));

  for (const key of required) {
    if (!(key in record)) problems.push(`${label}: missing required field ${key}`);
  }
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) problems.push(`${label}: unknown field ${key}`);
  }
}

function validateRegistry(candidate) {
  const problems = [];
  const sourceDef = schema.$defs.source;
  const claimDef = schema.$defs.claim;
  const sourceRoles = new Set(sourceDef.properties.sourceRole.enum);
  const sourceStatuses = new Set(sourceDef.properties.status.enum);
  const extractionMethods = new Set(sourceDef.properties.extractionMethod.enum);
  const attributionLevels = new Set(sourceDef.properties.attributionLevel.enum);
  const claimLayers = new Set(claimDef.properties.layer.enum);
  const confidenceLevels = new Set(claimDef.properties.confidence.enum);
  const attributionRank = new Map([
    ['author', 0],
    ['editorial-venue', 1],
    ['institution', 2],
  ]);

  const allowedTopLevel = new Set(Object.keys(schema.properties || {}));
  for (const key of schema.required || []) {
    if (!(key in candidate)) problems.push(`registry: missing required field ${key}`);
  }
  for (const key of Object.keys(candidate)) {
    if (!allowedTopLevel.has(key)) problems.push(`registry: unknown field ${key}`);
  }
  if (candidate.version !== 1) problems.push('registry: version must be 1');
  if (candidate.scope !== 'nagornaya') problems.push('registry: scope must be nagornaya');
  if (!validDate(candidate.lastReviewed)) problems.push('registry: lastReviewed must be a valid YYYY-MM-DD date');
  if (!Array.isArray(candidate.sources) || candidate.sources.length === 0) problems.push('registry: sources must be non-empty');
  if (!Array.isArray(candidate.claims) || candidate.claims.length === 0) problems.push('registry: claims must be non-empty');

  const sources = Array.isArray(candidate.sources) ? candidate.sources : [];
  const claims = Array.isArray(candidate.claims) ? candidate.claims : [];
  const sourceIds = sources.map((source) => source.id);
  const claimIds = claims.map((claim) => claim.id);
  if (!unique(sourceIds)) problems.push('registry: duplicate source id');
  if (!unique(claimIds)) problems.push('registry: duplicate claim id');

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));

  for (const source of sources) {
    const label = `source ${source.id || '<missing-id>'}`;
    validateRecordShape(source, sourceDef, label, problems);

    if (!validHttpsUrl(source.requestedUrl)) problems.push(`${label}: requestedUrl must be HTTPS`);
    if (!validHttpsUrl(source.resolvedUrl)) problems.push(`${label}: resolvedUrl must be HTTPS`);
    if (!sourceRoles.has(source.sourceRole)) problems.push(`${label}: invalid sourceRole ${source.sourceRole}`);
    if (!sourceStatuses.has(source.status)) problems.push(`${label}: invalid status ${source.status}`);
    if (!extractionMethods.has(source.extractionMethod)) problems.push(`${label}: invalid extractionMethod ${source.extractionMethod}`);
    if (!attributionLevels.has(source.attributionLevel)) problems.push(`${label}: invalid attributionLevel ${source.attributionLevel}`);
    if (!validDate(source.lastChecked)) problems.push(`${label}: lastChecked must be a valid YYYY-MM-DD date`);

    for (const key of ['claimIds', 'supports', 'doesNotSupport']) {
      if (!Array.isArray(source[key])) problems.push(`${label}: ${key} must be an array`);
      else if (!unique(source[key])) problems.push(`${label}: ${key} must contain unique ids`);
    }

    const supports = Array.isArray(source.supports) ? source.supports : [];
    const doesNotSupport = Array.isArray(source.doesNotSupport) ? source.doesNotSupport : [];
    const declaredClaims = Array.isArray(source.claimIds) ? source.claimIds : [];
    if (!sameMembers(supports, declaredClaims)) problems.push(`${label}: claimIds and supports must agree`);
    for (const claimId of supports) {
      if (!claimById.has(claimId)) problems.push(`${label}: supports unknown claim ${claimId}`);
      if (doesNotSupport.includes(claimId)) problems.push(`${label}: ${claimId} appears in both supports and doesNotSupport`);
    }
    for (const claimId of doesNotSupport) {
      if (!claimById.has(claimId)) problems.push(`${label}: doesNotSupport references unknown claim ${claimId}`);
    }

    if (source.status === 'verified' && /\.pdf$/i.test(source.exactObject || '')) {
      if (!source.pages) problems.push(`${label}: verified PDF requires pages`);
      if (!source.extractionMethod) problems.push(`${label}: verified PDF requires extractionMethod`);
      if (!source.lastChecked) problems.push(`${label}: verified PDF requires lastChecked`);
      for (const [field, urlValue] of [['requestedUrl', source.requestedUrl], ['resolvedUrl', source.resolvedUrl]]) {
        if (validHttpsUrl(urlValue)) {
          const objectName = new URL(urlValue).pathname.split('/').pop();
          if (objectName !== source.exactObject) problems.push(`${label}: ${field} does not resolve to exactObject ${source.exactObject}`);
        }
      }
    }
  }

  for (const claim of claims) {
    const label = `claim ${claim.id || '<missing-id>'}`;
    validateRecordShape(claim, claimDef, label, problems);

    if (!claimLayers.has(claim.layer)) problems.push(`${label}: invalid layer ${claim.layer}`);
    if (!confidenceLevels.has(claim.confidence)) problems.push(`${label}: invalid confidence ${claim.confidence}`);
    if (!attributionLevels.has(claim.attributionLevel)) problems.push(`${label}: invalid attributionLevel ${claim.attributionLevel}`);
    if (!Array.isArray(claim.primaryEvidence)) problems.push(`${label}: primaryEvidence must be an array`);
    else if (!unique(claim.primaryEvidence)) problems.push(`${label}: primaryEvidence must contain unique source ids`);
    if (!claim.alternative || !claim.seriesPosition || !claim.changeCondition) problems.push(`${label}: comparison fields must be non-empty`);

    const evidence = Array.isArray(claim.primaryEvidence) ? claim.primaryEvidence : [];
    if (claim.confidence === 'unsupported' && evidence.length > 0) problems.push(`${label}: unsupported claim must not cite primaryEvidence`);
    if (claim.confidence !== 'unsupported' && evidence.length === 0) problems.push(`${label}: supported claim requires primaryEvidence`);

    for (const sourceId of evidence) {
      const source = sourceById.get(sourceId);
      if (!source) {
        problems.push(`${label}: unknown primaryEvidence source ${sourceId}`);
        continue;
      }
      if (source.doesNotSupport.includes(claim.id)) problems.push(`${label}: ${sourceId} explicitly doesNotSupport this claim`);
      if (!source.supports.includes(claim.id)) problems.push(`${label}: ${sourceId} does not declare support for this claim`);
      if (attributionRank.get(source.attributionLevel) < attributionRank.get(claim.attributionLevel)) {
        problems.push(`${label}: author/editorial source ${sourceId} cannot be promoted to ${claim.attributionLevel} attribution`);
      }
    }
  }

  const expectedPilot = {
    'tmsj-green-ipsissima-vox': {
      author: 'Donald E. Green',
      exactObject: 'tmsj12d.pdf',
      pages: '49–68',
      title: 'Evangelicals and Ipsissima Vox',
    },
    'tmsj-thomas-jesus-seminar': {
      author: 'Robert L. Thomas',
      exactObject: 'tmsj7d.pdf',
      pages: '75–105',
      title: 'Evangelical Responses to the Jesus Seminar',
    },
    'tmsj-nichols-davidic-kingdom': {
      author: 'Stephen J. Nichols',
      exactObject: 'tmsj7h.pdf',
      pages: '213–239',
      title: 'The Dispensational View of the Davidic Kingdom',
    },
  };
  for (const [id, expected] of Object.entries(expectedPilot)) {
    const source = sourceById.get(id);
    if (!source) {
      problems.push(`pilot: missing ${id}`);
      continue;
    }
    for (const [field, value] of Object.entries(expected)) {
      if (source[field] !== value) problems.push(`pilot ${id}: ${field} must be ${JSON.stringify(value)}`);
    }
  }

  const neutralModel = claimById.get('green-ipsissima-vox-model');
  if (!neutralModel || neutralModel.layer !== 'literary-model' || neutralModel.confidence === 'unsupported') {
    problems.push('pilot: neutral ipsissima vox model comparison is missing');
  } else if (!/broader ipsissima vox model/i.test(neutralModel.alternative)) {
    problems.push('pilot: neutral ipsissima vox alternative is not explicit');
  }

  return problems;
}

function expectInvalid(candidate, pattern, label) {
  const problems = validateRegistry(candidate);
  assert.ok(problems.some((problem) => pattern.test(problem)), `${label}: expected ${pattern}, got:\n${problems.join('\n')}`);
}

assert.deepStrictEqual(validateRegistry(registry), [], 'canonical source registry must validate');

const wrongThomasObject = clone(registry);
const thomas = wrongThomasObject.sources.find((source) => source.id === 'tmsj-thomas-jesus-seminar');
thomas.exactObject = 'tmsj7h.pdf';
thomas.requestedUrl = 'https://tms.edu/wp-content/uploads/2021/09/tmsj7h.pdf';
thomas.resolvedUrl = 'https://tms.edu/wp-content/uploads/2021/09/tmsj7h.pdf';
expectInvalid(wrongThomasObject, /pilot tmsj-thomas-jesus-seminar: exactObject/, 'Thomas→Nichols object mutation');

const authorPromotion = clone(registry);
authorPromotion.claims.find((claim) => claim.id === 'green-ipsissima-vox-model').attributionLevel = 'institution';
expectInvalid(authorPromotion, /cannot be promoted to institution attribution/, 'author→institution promotion mutation');

const conflictingEvidence = clone(registry);
const unsupportedInstitutionClaim = conflictingEvidence.claims.find((claim) => claim.id === 'tms-institutional-ipsissima-vox-position');
unsupportedInstitutionClaim.primaryEvidence = ['tmsj-green-ipsissima-vox'];
unsupportedInstitutionClaim.confidence = 'high';
expectInvalid(conflictingEvidence, /explicitly doesNotSupport this claim/, 'doesNotSupport conflict mutation');

const missingVerifiedPages = clone(registry);
missingVerifiedPages.sources[0].pages = '';
expectInvalid(missingVerifiedPages, /verified PDF requires pages/, 'verified PDF pages mutation');

const unknownTopLevel = clone(registry);
unknownTopLevel.unreviewedEscapeHatch = true;
expectInvalid(unknownTopLevel, /registry: unknown field unreviewedEscapeHatch/, 'top-level schema escape mutation');

assert.match(component, /import sourceRegistry from ['"]\.\.\/\.\.\/\.\.\/\.\.\/data\/nagornaya\/source-registry\.json['"];/,
  'native sources page must import the canonical registry');
for (const hardcoded of [
  'https://tms.edu/wp-content/uploads/2021/09/tmsj12d.pdf',
  'https://tms.edu/wp-content/uploads/2021/09/tmsj7d.pdf',
  'https://tms.edu/wp-content/uploads/2021/09/tmsj7h.pdf',
  'Evangelicals and Ipsissima Vox',
  'Evangelical Responses to the Jesus Seminar',
  'The Dispensational View of the Davidic Kingdom',
]) {
  assert.ok(!component.includes(hardcoded), `native component duplicates registry metadata: ${hardcoded}`);
}
for (const id of ['tmsj-green-ipsissima-vox', 'tmsj-thomas-jesus-seminar', 'tmsj-nichols-davidic-kingdom']) {
  assert.ok(component.includes(id), `native component must resolve pilot source ${id}`);
}

const baselineRoute = '/nagornaya/istochniki/';
const baselineOccurrences = visualWorkflow.split(baselineRoute).length - 1;
assert.ok(baselineOccurrences >= 2,
  'visual parity workflow must include /nagornaya/istochniki/ in both dispatch and automatic default routes');

console.log('✅ Nagornaya source registry: schema shape, exact PDFs, attribution boundaries, conflicts, native derivation and literal browser baseline coverage passed');
