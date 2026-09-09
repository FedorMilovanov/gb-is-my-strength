#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  ensureNosniffResponseHeader,
  verifyLiveNosniff,
  NOSNIFF_RULE_REF,
  RESPONSE_HEADER_PHASE,
} from './cloudflare-response-header-owner-lib.mjs';

const TOKEN = 'test-transform-token-that-must-never-leak';
const ZONE_ID = '0123456789abcdef0123456789abcdef';
const API = 'https://api.cloudflare.test/client/v4';
const RULESET_ID = 'ruleset-123';
const RULE_ID = 'rule-456';

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

function desiredOwnedRule(overrides = {}) {
  return {
    id: RULE_ID,
    ref: NOSNIFF_RULE_REF,
    description: 'GB production transport owner: X-Content-Type-Options nosniff',
    expression: 'true',
    action: 'rewrite',
    action_parameters: {
      headers: {
        'X-Content-Type-Options': {
          operation: 'set',
          value: 'nosniff',
        },
      },
    },
    enabled: true,
    ...overrides,
  };
}

function rulesetSummary() {
  return { id: RULESET_ID, kind: 'zone', phase: RESPONSE_HEADER_PHASE };
}

async function testCreatePhaseRuleset() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (calls.length === 1) return jsonResponse({ success: true, result: [] });
    if (calls.length === 2) return jsonResponse({ success: true, result: { id: RULESET_ID } });
    throw new Error('unexpected request');
  };

  const result = await ensureNosniffResponseHeader({
    fetchImpl,
    apiToken: TOKEN,
    zoneId: ZONE_ID,
    apiBaseUrl: API,
  });

  assert.equal(result.operation, 'created-ruleset');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].options.method, 'POST');
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.kind, 'zone');
  assert.equal(body.phase, RESPONSE_HEADER_PHASE);
  assert.equal(body.rules.length, 1);
  assert.equal(body.rules[0].ref, NOSNIFF_RULE_REF);
  assert.equal(body.rules[0].action, 'rewrite');
  assert.equal(body.rules[0].expression, 'true');
  assert.deepEqual(body.rules[0].action_parameters.headers['X-Content-Type-Options'], {
    operation: 'set',
    value: 'nosniff',
  });
}

async function testExistingMatchingRuleIsNoop() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (calls.length === 1) return jsonResponse({ success: true, result: [rulesetSummary()] });
    if (calls.length === 2) {
      return jsonResponse({ success: true, result: { id: RULESET_ID, rules: [desiredOwnedRule()] } });
    }
    throw new Error('unexpected mutation');
  };

  const result = await ensureNosniffResponseHeader({
    fetchImpl,
    apiToken: TOKEN,
    zoneId: ZONE_ID,
    apiBaseUrl: API,
  });
  assert.equal(result.operation, 'noop');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.options.method), ['GET', 'GET']);
}

async function testAddOwnedRuleWithoutReplacingNeighbors() {
  const calls = [];
  const neighbor = {
    id: 'neighbor-rule',
    ref: 'unrelated_neighbor',
    expression: 'true',
    action: 'rewrite',
    action_parameters: { headers: { 'X-Neighbor': { operation: 'set', value: 'keep' } } },
    enabled: true,
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (calls.length === 1) return jsonResponse({ success: true, result: [rulesetSummary()] });
    if (calls.length === 2) return jsonResponse({ success: true, result: { id: RULESET_ID, rules: [neighbor] } });
    if (calls.length === 3) return jsonResponse({ success: true, result: desiredOwnedRule() });
    throw new Error('unexpected request');
  };

  const result = await ensureNosniffResponseHeader({
    fetchImpl,
    apiToken: TOKEN,
    zoneId: ZONE_ID,
    apiBaseUrl: API,
  });
  assert.equal(result.operation, 'created-rule');
  assert.equal(calls[2].options.method, 'POST');
  assert.match(calls[2].url, /\/rulesets\/ruleset-123\/rules$/);
  assert.ok(!calls.some((call) => call.options.method === 'PUT'), 'whole-ruleset PUT is forbidden');
  assert.equal(JSON.parse(calls[2].options.body).ref, NOSNIFF_RULE_REF);
}

async function testPatchOnlyOwnedDrift() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (calls.length === 1) return jsonResponse({ success: true, result: [rulesetSummary()] });
    if (calls.length === 2) {
      return jsonResponse({
        success: true,
        result: {
          id: RULESET_ID,
          rules: [desiredOwnedRule({ action_parameters: { headers: { 'X-Content-Type-Options': { operation: 'set', value: 'wrong' } } } })],
        },
      });
    }
    if (calls.length === 3) return jsonResponse({ success: true, result: desiredOwnedRule() });
    throw new Error('unexpected request');
  };

  const result = await ensureNosniffResponseHeader({
    fetchImpl,
    apiToken: TOKEN,
    zoneId: ZONE_ID,
    apiBaseUrl: API,
  });
  assert.equal(result.operation, 'updated-rule');
  assert.equal(calls[2].options.method, 'PATCH');
  assert.match(calls[2].url, /\/rules\/rule-456$/);
  assert.ok(!calls.some((call) => call.options.method === 'PUT'), 'whole-ruleset PUT is forbidden');
  const patched = JSON.parse(calls[2].options.body);
  assert.equal(patched.ref, NOSNIFF_RULE_REF);
  assert.equal(patched.action_parameters.headers['X-Content-Type-Options'].value, 'nosniff');
}

async function testDuplicateOwnedRefFailsClosed() {
  const fetchImpl = async (url) => {
    if (url.endsWith('/rulesets')) return jsonResponse({ success: true, result: [rulesetSummary()] });
    return jsonResponse({
      success: true,
      result: { rules: [desiredOwnedRule({ id: 'a' }), desiredOwnedRule({ id: 'b' })] },
    });
  };

  await assert.rejects(
    ensureNosniffResponseHeader({ fetchImpl, apiToken: TOKEN, zoneId: ZONE_ID, apiBaseUrl: API }),
    /multiple rules use owned ref/,
  );
}

async function testProviderFailureDoesNotLeakSecrets() {
  const fetchImpl = async () => jsonResponse({ success: false, errors: [{ message: TOKEN }] }, { ok: false, status: 403 });
  let message = '';
  try {
    await ensureNosniffResponseHeader({ fetchImpl, apiToken: TOKEN, zoneId: ZONE_ID, apiBaseUrl: API });
  } catch (error) {
    message = String(error?.stack || error);
  }
  assert.ok(message);
  assert.ok(!message.includes(TOKEN));
  assert.ok(!message.includes(ZONE_ID));
  assert.match(message, /Cloudflare HTTP 403/);
}

async function testLiveWitness() {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return {
      status: url.includes('not-found') ? 404 : 200,
      headers: { get: (name) => name.toLowerCase() === 'x-content-type-options' ? 'nosniff' : null },
    };
  };
  const result = await verifyLiveNosniff({ fetchImpl, attempts: 1, delayMs: 0 });
  assert.equal(result.result, 'PASS');
  assert.equal(result.evidence.length, 3);
  assert.ok(result.evidence.every((entry) => entry.passed));
  assert.ok(seen.some((url) => url.includes('__transport-nosniff-witness-not-found__')));
}

async function testLiveWitnessFailsClosed() {
  const fetchImpl = async () => ({
    status: 200,
    headers: { get: () => '' },
  });
  await assert.rejects(
    verifyLiveNosniff({ fetchImpl, attempts: 1, delayMs: 0 }),
    (error) => Array.isArray(error.evidence) && error.evidence.every((entry) => entry.passed === false),
  );
}

await testCreatePhaseRuleset();
await testExistingMatchingRuleIsNoop();
await testAddOwnedRuleWithoutReplacingNeighbors();
await testPatchOnlyOwnedDrift();
await testDuplicateOwnedRefFailsClosed();
await testProviderFailureDoesNotLeakSecrets();
await testLiveWitness();
await testLiveWitnessFailsClosed();

console.log('CLOUDFLARE RESPONSE HEADER OWNER CONTRACT: PASS');
